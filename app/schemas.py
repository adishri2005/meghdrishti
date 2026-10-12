"""
Pydantic request/response schemas for the REST API.

Separation from ORM models: these schemas define the API contract and
include validation rules (min length, value ranges, examples) that belong
at the boundary, not in the database layer.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, json_schema_extra={"example": "admin"})
    password: str = Field(..., min_length=1, json_schema_extra={"example": "Admin@12345"})


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    role: str


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(..., pattern=r"^(admin|analyst)$")


class RegisterResponse(BaseModel):
    id: int
    username: str
    role: str


class ApiClientCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)


class ApiClientCreateResponse(BaseModel):
    id: int
    name: str
    api_key: str  # returned once, then only the hash is stored


# ---------------------------------------------------------------------------
# Records / Ingestion
# ---------------------------------------------------------------------------

class CostRecordIn(BaseModel):
    """A single cost data point submitted for ingestion."""

    resource_id: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., min_length=1, max_length=50)
    service: str = Field(..., min_length=1, max_length=50)
    region: str = Field(..., min_length=1, max_length=50)
    team_tag: str = Field(..., min_length=1, max_length=50)
    timestamp: datetime
    usage_quantity: float = Field(..., ge=0)
    unit_cost: float = Field(..., ge=0)
    cost: float = Field(..., ge=0)

    @field_validator("usage_quantity", "unit_cost", "cost", mode="before")
    @classmethod
    def validate_finite_non_negative(cls, v: float, info) -> float:
        if isinstance(v, (int, float)) and not math.isfinite(v):
            raise ValueError(f"{info.field_name} must be a finite number")
        return v

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp_sanity(cls, v: datetime) -> datetime:
        min_ts = datetime(2020, 1, 1, tzinfo=timezone.utc)
        ts = v if v.tzinfo is not None else v.replace(tzinfo=timezone.utc)
        if ts < min_ts:
            raise ValueError("timestamp cannot be earlier than 2020-01-01T00:00:00Z")
        return v


class BatchIngestRequest(BaseModel):
    records: list[CostRecordIn] = Field(..., min_length=1, max_length=5000)
    backfill: bool = False


class BatchIngestResponse(BaseModel):
    job_id: str
    accepted: int
    status: str = "queued"


class JobStatusResponse(BaseModel):
    id: str
    submitted_by: str
    record_count: int
    processed_count: int
    failed_count: int
    status: str
    backfill: bool
    created_at: datetime
    finished_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Anomalies
# ---------------------------------------------------------------------------

class AnomalyOut(BaseModel):
    id: int
    scope: str
    resource_id: Optional[int] = None
    resource_name: Optional[str] = None
    detected_at: datetime
    record_ts: datetime
    observed_cost: float
    expected_cost: float
    z_score: Optional[float] = None
    pct_increase: Optional[float] = None
    severity: str
    method: str
    root_cause_summary: Optional[str] = None
    status: str
    occurrences: int
    peak_cost: Optional[float] = None
    last_seen_ts: Optional[datetime] = None


class AnomalyDetail(AnomalyOut):
    root_cause: Optional[Any] = None
    alerts: list[AlertOut] = []


class AlertOut(BaseModel):
    id: int
    channel: str
    sent_at: datetime
    delivery_status: str
    detail: Optional[str] = None


# Forward ref fix
AnomalyDetail.model_rebuild()


class AnomalyPatchRequest(BaseModel):
    status: str = Field(..., pattern=r"^(acknowledged|resolved)$")


# ---------------------------------------------------------------------------
# Costs
# ---------------------------------------------------------------------------

class CostSummaryGroup(BaseModel):
    group: str
    total_cost: float
    record_count: int


class CostSummaryResponse(BaseModel):
    group_by: str
    groups: list[CostSummaryGroup]
    overall_total: float
    overall_count: int
    cached: bool = False


class ResourceCostPoint(BaseModel):
    ts: datetime
    cost: float
    usage_quantity: float
    baseline_mean: Optional[float] = None
    baseline_std: Optional[float] = None


class ResourceCostsResponse(BaseModel):
    resource_id: str
    points: list[ResourceCostPoint]


# ---------------------------------------------------------------------------
# Config / Thresholds
# ---------------------------------------------------------------------------

class ThresholdsResponse(BaseModel):
    detection: dict[str, Any]
    severity: dict[str, Any]


class ThresholdsUpdateRequest(BaseModel):
    detection: Optional[dict[str, Any]] = None
    severity: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Admin / Simulate
# ---------------------------------------------------------------------------

class SimulateRequest(BaseModel):
    start_time: Optional[datetime] = None
    hours: int = Field(default=1, ge=1, le=168)
    inject: Optional[str] = Field(default=None, pattern=r"^(spike|drift|new_resource)$")
    resource_id: Optional[str] = None
    multiplier: float = Field(default=10.0, gt=0)
    backfill: bool = False


class SimulateResponse(BaseModel):
    job_ids: list[str]
    records_generated: int
    injection: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class LivenessResponse(BaseModel):
    status: str
    version: str


class HealthResponse(BaseModel):
    status: str
    version: str
    color: str
    db: bool
    redis: bool


# ---------------------------------------------------------------------------
# Error
# ---------------------------------------------------------------------------

class ErrorDetail(BaseModel):
    code: int
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


# ---------------------------------------------------------------------------
# Deployments
# ---------------------------------------------------------------------------

class DeploymentCreate(BaseModel):
    version: str
    color: str
    status: str = "deployed"
    note: Optional[str] = None


class DeploymentOut(BaseModel):
    id: int
    version: str
    color: str
    status: str
    deployed_at: datetime
    activated_at: Optional[datetime] = None
    rolled_back_at: Optional[datetime] = None
    note: Optional[str] = None
