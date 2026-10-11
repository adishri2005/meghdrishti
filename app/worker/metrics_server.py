"""
Worker metrics server: exposes Prometheus /metrics on port 8001.

Runs in a background thread so the main consumer loop isn't blocked.
"""

from __future__ import annotations

import logging
import threading

from prometheus_client import start_http_server

logger = logging.getLogger("ccad.worker.metrics")

_started = False


def start_metrics_server(port: int = 8001) -> None:
    """Start the Prometheus metrics HTTP server in a daemon thread.

    Idempotent: calling this multiple times is safe.
    """
    global _started
    if _started:
        return
    _started = True

    def _serve():
        try:
            start_http_server(port)
            logger.info(f"Worker metrics server started on port {port}")
        except Exception as exc:
            logger.error(f"Failed to start metrics server: {exc}")

    t = threading.Thread(target=_serve, daemon=True)
    t.start()
