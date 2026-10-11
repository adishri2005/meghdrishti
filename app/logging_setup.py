"""
Structured JSON logging, request-ID middleware, and audit helper.

Why JSON logs: structured logs are machine-parseable, making it easy to
search by request_id, user, event type, or any field in log aggregation
tools (ELK, CloudWatch, Loki).  Every log line includes a request_id so
the full journey of a request can be traced across API and worker.
"""

from __future__ import annotations

import logging
import logging.handlers
import os
import uuid
from contextvars import ContextVar
from pathlib import Path

from pythonjsonlogger import jsonlogger

from app.config import get_settings

# Context variable: every coroutine in the same request shares this ID
request_id_var: ContextVar[str] = ContextVar("request_id", default="")
request_user_var: ContextVar[str] = ContextVar("request_user", default="")
request_role_var: ContextVar[str] = ContextVar("request_role", default="")


class CCadJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter that injects request context into every log line."""

    def add_fields(self, log_record: dict, record: logging.LogRecord, message_dict: dict) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record["timestamp"] = self.formatTime(record)
        log_record["level"] = record.levelname
        log_record["logger"] = record.name

        # Inject context vars (safe even if not in a request context)
        rid = request_id_var.get("")
        if rid:
            log_record["request_id"] = rid
        user = request_user_var.get("")
        if user:
            log_record["user"] = user
        role = request_role_var.get("")
        if role:
            log_record["role"] = role


def setup_logging() -> None:
    """Configure root logger with JSON formatting, stdout and file output.

    Called once during application startup (both API and worker).
    """
    settings = get_settings()
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    formatter = CCadJsonFormatter(
        fmt="%(timestamp)s %(level)s %(logger)s %(message)s"
    )

    # Stdout handler
    stdout_handler = logging.StreamHandler()
    stdout_handler.setFormatter(formatter)

    handlers: list[logging.Handler] = [stdout_handler]

    # File handler (rotating, 10 MB × 5 backups)
    log_file = settings.log_file
    try:
        log_dir = Path(log_file).parent
        log_dir.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=5
        )
        file_handler.setFormatter(formatter)
        handlers.append(file_handler)
    except Exception:
        # If we can't create the log file (e.g. read-only FS), continue
        # with stdout only
        pass

    logging.basicConfig(level=log_level, handlers=handlers, force=True)

    # Quiet down noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_request_id() -> str:
    """Return the current request ID (or empty string outside a request)."""
    return request_id_var.get("")
