"""Initial schema: all tables for CCAD

Revision ID: 0001
Revises: None
Create Date: 2026-10-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(100), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="analyst"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"])

    # api_clients
    op.create_table(
        "api_clients",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("api_key_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="service"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # resources
    op.create_table(
        "resources",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("resource_id", sa.String(200), unique=True, nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("service", sa.String(50), nullable=False),
        sa.Column("region", sa.String(50), nullable=False),
        sa.Column("team_tag", sa.String(50), nullable=False),
        sa.Column("first_seen", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_resources_resource_id", "resources", ["resource_id"])

    # ingestion_jobs
    op.create_table(
        "ingestion_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("submitted_by", sa.String(100), nullable=False),
        sa.Column("record_count", sa.Integer, nullable=False),
        sa.Column("processed_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("backfill", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )

    # cost_records
    op.create_table(
        "cost_records",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("resource_id", sa.BigInteger, sa.ForeignKey("resources.id"), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("usage_quantity", sa.Numeric(14, 4), nullable=False),
        sa.Column("unit_cost", sa.Numeric(14, 6), nullable=False),
        sa.Column("cost", sa.Numeric(14, 4), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("ingestion_jobs.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_cost_record_resource_ts", "cost_records", ["resource_id", "ts"])
    op.create_index("ix_cost_records_resource_ts", "cost_records", ["resource_id", "ts"])
    op.create_index("ix_cost_records_ts", "cost_records", ["ts"])

    # baselines
    op.create_table(
        "baselines",
        sa.Column("resource_id", sa.BigInteger, sa.ForeignKey("resources.id"), primary_key=True),
        sa.Column("hour_of_day", sa.Integer, primary_key=True),
        sa.Column("n", sa.Integer, nullable=False, server_default="0"),
        sa.Column("mean", sa.Float, nullable=False, server_default="0"),
        sa.Column("m2", sa.Float, nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # resource_state
    op.create_table(
        "resource_state",
        sa.Column("resource_id", sa.BigInteger, sa.ForeignKey("resources.id"), primary_key=True),
        sa.Column("ewma_ratio", sa.Float, nullable=False, server_default="1.0"),
        sa.Column("last_ts", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # anomalies
    op.create_table(
        "anomalies",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("scope", sa.String(20), nullable=False),
        sa.Column("resource_id", sa.BigInteger, sa.ForeignKey("resources.id"), nullable=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("record_ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("observed_cost", sa.Float, nullable=False),
        sa.Column("expected_cost", sa.Float, nullable=False),
        sa.Column("z_score", sa.Float, nullable=True),
        sa.Column("pct_increase", sa.Float, nullable=True),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("method", sa.String(30), nullable=False),
        sa.Column("root_cause_summary", sa.Text, nullable=True),
        sa.Column("root_cause", JSONB, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("occurrences", sa.Integer, nullable=False, server_default="1"),
        sa.Column("peak_cost", sa.Float, nullable=True),
        sa.Column("last_seen_ts", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", sa.String(100), nullable=True),
    )
    op.create_index("ix_anomalies_status_detected", "anomalies", ["status", sa.text("detected_at DESC")])
    op.create_index("ix_anomalies_severity", "anomalies", ["severity"])
    op.create_index("ix_anomalies_resource_ts", "anomalies", ["resource_id", "record_ts"])

    # alerts
    op.create_table(
        "alerts",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("anomaly_id", sa.BigInteger, sa.ForeignKey("anomalies.id"), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("delivery_status", sa.String(20), nullable=False),
        sa.Column("detail", sa.Text, nullable=True),
    )

    # audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("actor", sa.String(100), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity", sa.String(100), nullable=True),
        sa.Column("entity_id", sa.String(200), nullable=True),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("result", sa.String(20), nullable=False),
        sa.Column("detail", JSONB, nullable=True),
        sa.Column("ts", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_ts", "audit_logs", [sa.text("ts DESC")])

    # settings
    op.create_table(
        "settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", JSONB, nullable=False),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # deployments
    op.create_table(
        "deployments",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("color", sa.String(10), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("deployed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rolled_back_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
    )

    # ground_truth_anomalies
    op.create_table(
        "ground_truth_anomalies",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("resource_id", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("start_ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("multiplier", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ground_truth_anomalies")
    op.drop_table("deployments")
    op.drop_table("settings")
    op.drop_table("audit_logs")
    op.drop_table("alerts")
    op.drop_table("anomalies")
    op.drop_table("resource_state")
    op.drop_table("baselines")
    op.drop_table("cost_records")
    op.drop_table("ingestion_jobs")
    op.drop_table("resources")
    op.drop_table("api_clients")
    op.drop_table("users")
