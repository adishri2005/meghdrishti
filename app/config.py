"""
Application configuration loaded from environment variables and config.yaml.

Why pydantic-settings: gives us validated, typed configuration with automatic
env-var parsing.  The YAML file holds detection/severity defaults that are
seeded into the database on first startup; runtime reads come from the DB
(with an in-process TTL cache) so operators can tune thresholds without
redeploying.
"""

from __future__ import annotations

import json
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

_CONFIG_YAML_PATH = Path(__file__).resolve().parent.parent / "config" / "config.yaml"

# ---------------------------------------------------------------------------
# In-process cache for detection config (avoids hitting the DB every request)
# ---------------------------------------------------------------------------
_detection_cache: dict[str, Any] = {}
_detection_cache_ts: float = 0.0
_DETECTION_CACHE_TTL = 30.0  # seconds


class Settings(BaseSettings):
    """Main application settings, populated from environment variables."""

    # --- Environment ---
    environment: str = "development"

    # --- Postgres ---
    database_url: str = "postgresql+psycopg2://meghdrishti:change_me_pg@postgres:5432/meghdrishti"
    postgres_user: str = "meghdrishti"
    postgres_password: str = "change_me_pg"
    postgres_db: str = "meghdrishti"

    # --- Redis ---
    redis_url: str = "redis://redis:6379/0"

    # --- JWT ---
    jwt_secret: str = "change_me_to_a_long_random_string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30

    # --- Seed users ---
    admin_username: str = "admin"
    admin_password: str = "Admin@12345"
    analyst_username: str = "analyst"
    analyst_password: str = "Analyst@12345"
    service_api_key: str = "svc-ingest-key-change-me"

    # --- App ---
    app_version: str = "1.0.0"
    app_color: str = "blue"
    faulty_release: bool = False

    # --- Logging ---
    log_level: str = "INFO"
    log_file: str = "/var/log/app/app.log"

    # --- Alerting ---
    alert_webhook_url: str = ""

    # --- Grafana ---
    grafana_admin_password: str = "change_me_grafana"

    # --- Ports ---
    http_port: int = 8080
    https_port: int = 8443

    @field_validator("faulty_release", mode="before")
    @classmethod
    def parse_faulty_release(cls, v: Any) -> bool:
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes")
        return bool(v)

    @model_validator(mode="after")
    def validate_production_secrets(self) -> Settings:
        env = (self.environment or "").lower()
        is_prod = env in ("production", "prod")

        secrets_to_check = [
            ("jwt_secret", self.jwt_secret, "change_me_to_a_long_random_string", 32),
            ("admin_password", self.admin_password, "Admin@12345", 8),
            ("analyst_password", self.analyst_password, "Analyst@12345", 8),
            ("service_api_key", self.service_api_key, "svc-ingest-key-change-me", 16),
            ("postgres_password", self.postgres_password, "change_me_pg", 8),
        ]

        for name, val, default_val, min_len in secrets_to_check:
            if is_prod:
                if val == default_val or "change_me" in str(val).lower():
                    raise ValueError(
                        f"CRITICAL SECURITY CONFIGURATION ERROR: Default insecure value for '{name}' "
                        f"is forbidden in production. You must set a strong, unique secret."
                    )
                if len(str(val)) < min_len:
                    raise ValueError(
                        f"CRITICAL SECURITY CONFIGURATION ERROR: Secret '{name}' must be at least "
                        f"{min_len} characters long in production."
                    )
            else:
                if val == default_val or "change_me" in str(val).lower():
                    import logging
                    logging.getLogger("meghdrishti.config").warning(
                        f"INSECURE DEFAULT: '{name}' is using default development credentials."
                    )
        return self

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the singleton Settings instance (cached after first call)."""
    return Settings()


def load_yaml_config() -> dict[str, Any]:
    """Load the default config.yaml from disk.

    This is used to seed the ``settings`` database table on first startup.
    At runtime the application reads thresholds from the DB, not from this
    file, so operators can change thresholds through the API.
    """
    path = _CONFIG_YAML_PATH
    if not path.exists():
        # Fallback for running inside Docker where the file is at /app/config
        path = Path("/app/config/config.yaml")
    with open(path) as f:
        return yaml.safe_load(f)


def get_detection_config(db_session: Any = None) -> dict[str, Any]:
    """Return the detection configuration, with a 30-second in-process cache.

    Priority: DB ``settings`` table → ``config.yaml`` defaults.

    The ``db_session`` parameter is optional; when ``None`` the function
    returns the YAML defaults directly (useful during startup before the
    DB is available).
    """
    global _detection_cache, _detection_cache_ts

    now = time.time()
    if _detection_cache and (now - _detection_cache_ts) < _DETECTION_CACHE_TTL:
        return _detection_cache

    yaml_cfg = load_yaml_config()

    if db_session is not None:
        try:
            from app.models import SettingsRow  # avoid circular import

            rows = db_session.execute(
                SettingsRow.__table__.select()
            ).fetchall()
            db_cfg: dict[str, Any] = {}
            for row in rows:
                db_cfg[row.key] = row.value if isinstance(row.value, dict) else json.loads(row.value)

            # Merge: DB values override YAML defaults
            merged = {}
            for section in ("detection", "severity", "queue", "cache"):
                yaml_section = yaml_cfg.get(section, {})
                db_section = db_cfg.get(section, {})
                if isinstance(yaml_section, dict) and isinstance(db_section, dict):
                    merged[section] = {**yaml_section, **db_section}
                else:
                    merged[section] = db_section if db_section else yaml_section

            _detection_cache = merged
            _detection_cache_ts = now
            return merged
        except Exception:
            # DB not ready yet — fall back to YAML
            pass

    _detection_cache = yaml_cfg
    _detection_cache_ts = now
    return yaml_cfg


def invalidate_detection_cache() -> None:
    """Force the next ``get_detection_config`` call to re-read from the DB."""
    global _detection_cache_ts
    _detection_cache_ts = 0.0
