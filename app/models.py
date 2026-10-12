"""
SQLAlchemy ORM models for the Cloud Cost Anomaly Detection system.

Design rationale:
- TIMESTAMPTZ everywhere so the system is timezone-aware.
- UNIQUE(resource_id, ts) on cost_records for idempotent writes — the worker
  can safely replay messages without creating duplicates.
- Welford statistics in ``baselines`` for O(1) incremental mean/std updates.
- JSONB in ``anomalies.root_cause`` stores structured contributor rankings
  without needing a separate join table.
- ``settings`` table holds runtime-editable detection thresholds; the YAML
  file is only the initial seed.
"""

from __future__ import annotations

import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db import Base


class User(Base):
    """Human operator account (admin or analyst)."""

    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="analyst")  # admin | analyst
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ApiClient(Base):
    """Machine-to-machine API client (role = service)."""

    __tablename__ = "api_clients"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    api_key_hash = Column(String(64), unique=True, nullable=False)  # sha256 hex
    role = Column(String(20), nullable=False, default="service")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Resource(Base):
    """Cloud resource entry (e.g. ec2-ml-gpu-07)."""

    __tablename__ = "resources"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    resource_id = Column(String(200), unique=True, nullable=False, index=True)
    type = Column(String(50), nullable=False)
    service = Column(String(50), nullable=False)
    region = Column(String(50), nullable=False)
    team_tag = Column(String(50), nullable=False)
    first_seen = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    cost_records = relationship("CostRecord", back_populates="resource")
    baselines = relationship("Baseline", back_populates="resource")


class IngestionJob(Base):
    """Tracks the lifecycle of a batch ingestion request."""

    __tablename__ = "ingestion_jobs"

    id = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    submitted_by = Column(String(100), nullable=False)
    record_count = Column(Integer, nullable=False)
    processed_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="queued", nullable=False)  # queued|processing|done|failed
    backfill = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at = Column(DateTime(timezone=True), nullable=True)


class CostRecord(Base):
    """Hourly cost data point for one resource."""

    __tablename__ = "cost_records"
    __table_args__ = (
        UniqueConstraint("resource_id", "ts", name="uq_cost_record_resource_ts"),
        Index("ix_cost_records_resource_ts", "resource_id", "ts"),
        Index("ix_cost_records_ts", "ts"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    resource_id = Column(
        BigInteger, ForeignKey("resources.id"), nullable=False
    )
    ts = Column(DateTime(timezone=True), nullable=False)
    usage_quantity = Column(Numeric(14, 4), nullable=False)
    unit_cost = Column(Numeric(14, 6), nullable=False)
    cost = Column(Numeric(14, 4), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("ingestion_jobs.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    resource = relationship("Resource", back_populates="cost_records")


class Baseline(Base):
    """Welford online statistics per (resource, hour_of_day).

    Why Welford: we update mean and variance incrementally in O(1) as each
    record arrives, avoiding a full re-scan of history.  ``m2`` stores the
    sum of squared deviations; std = sqrt(m2 / (n - 1)) when n >= 2.
    """

    __tablename__ = "baselines"

    resource_id = Column(
        BigInteger, ForeignKey("resources.id"), primary_key=True
    )
    hour_of_day = Column(Integer, primary_key=True)  # 0..23
    n = Column(Integer, default=0, nullable=False)
    mean = Column(Float, default=0.0, nullable=False)
    m2 = Column(Float, default=0.0, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    resource = relationship("Resource", back_populates="baselines")

    @property
    def std(self) -> float:
        import math
        return math.sqrt(max(self.m2 / (self.n - 1), 0.0)) if self.n >= 2 else 0.0


class ResourceState(Base):
    """Per-resource EWMA state for drift detection."""

    __tablename__ = "resource_state"

    resource_id = Column(
        BigInteger, ForeignKey("resources.id"), primary_key=True
    )
    ewma_ratio = Column(Float, default=1.0, nullable=False)
    last_ts = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Anomaly(Base):
    """Detected cost anomaly (resource-level or aggregate)."""

    __tablename__ = "anomalies"
    __table_args__ = (
        Index("ix_anomalies_status_detected", "status", "detected_at"),
        Index("ix_anomalies_severity", "severity"),
        Index("ix_anomalies_resource_ts", "resource_id", "record_ts"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    scope = Column(String(20), nullable=False)  # resource | aggregate
    resource_id = Column(BigInteger, ForeignKey("resources.id"), nullable=True)
    detected_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    record_ts = Column(DateTime(timezone=True), nullable=False)
    observed_cost = Column(Float, nullable=False)
    expected_cost = Column(Float, nullable=False)
    z_score = Column(Float, nullable=True)
    pct_increase = Column(Float, nullable=True)
    severity = Column(String(20), nullable=False)  # critical|high|medium|low
    method = Column(String(30), nullable=False)
    root_cause_summary = Column(Text, nullable=True)
    root_cause = Column(JSONB, nullable=True)
    status = Column(String(20), default="open", nullable=False)
    occurrences = Column(Integer, default=1, nullable=False)
    peak_cost = Column(Float, nullable=True)
    last_seen_ts = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String(100), nullable=True)

    resource = relationship("Resource")
    alerts = relationship("Alert", back_populates="anomaly")


class Alert(Base):
    """Record of an alert notification sent for an anomaly."""

    __tablename__ = "alerts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    anomaly_id = Column(BigInteger, ForeignKey("anomalies.id"), nullable=False)
    channel = Column(String(20), nullable=False)  # log | webhook | email
    sent_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    delivery_status = Column(String(20), nullable=False)  # sent | failed
    detail = Column(Text, nullable=True)

    anomaly = relationship("Anomaly", back_populates="alerts")


class AuditLog(Base):
    """Immutable audit trail for security-relevant actions."""

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_ts", "ts"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    actor = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    entity = Column(String(100), nullable=True)
    entity_id = Column(String(200), nullable=True)
    ip = Column(String(45), nullable=True)
    result = Column(String(20), nullable=False)  # success | denied | error
    detail = Column(JSONB, nullable=True)
    ts = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SettingsRow(Base):
    """Runtime configuration stored in the database.

    Keys: 'detection', 'severity', 'queue', 'cache'.
    Values are JSONB documents that mirror config.yaml sections.
    """

    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(JSONB, nullable=False)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Deployment(Base):
    """Tracks blue/green deployment events for audit and rollback."""

    __tablename__ = "deployments"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    version = Column(String(50), nullable=False)
    color = Column(String(10), nullable=False)
    status = Column(String(20), nullable=False)  # deployed|active|rolled_back|failed
    deployed_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    activated_at = Column(DateTime(timezone=True), nullable=True)
    rolled_back_at = Column(DateTime(timezone=True), nullable=True)
    note = Column(Text, nullable=True)


class GroundTruthAnomaly(Base):
    """Labelled anomaly injected by the simulator, for evaluation."""

    __tablename__ = "ground_truth_anomalies"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    resource_id = Column(String(200), nullable=False)
    kind = Column(String(30), nullable=False)  # spike | drift | new_resource
    start_ts = Column(DateTime(timezone=True), nullable=False)
    end_ts = Column(DateTime(timezone=True), nullable=False)
    multiplier = Column(Float, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
