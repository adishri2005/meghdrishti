# Assumptions

This document records assumptions made during development where the specification was ambiguous or the environment imposed constraints.

## Environment

1. **Python version**: The host has Python 3.13.5 available. The Docker image uses Python 3.11-slim for stability. All code is tested against 3.11+.

2. **Windows host**: Development machine runs Windows with Docker Desktop. All bash scripts are designed to run inside WSL2 or Git Bash. The `.gitattributes` enforces LF line endings for cross-platform compatibility.

3. **`make` availability**: The Makefile uses GNU Make syntax. On Windows, install via `choco install make` or use Git Bash. All targets can also be run as direct commands.

4. **Docker Compose V2**: The system uses `docker compose` (V2 syntax, not `docker-compose`). Docker Compose v5.3.1 is available.

## Architecture

5. **Single Docker image**: One Dockerfile produces one image used for both the API server and worker. The entrypoint script selects the mode based on the command argument (`api` or `worker`).

6. **Blue/green via profiles**: The `api-green` service uses a Docker Compose profile (`green`) so it doesn't start by default. Deploy scripts activate it explicitly.

7. **Self-signed TLS**: Nginx uses self-signed certificates for HTTPS. Production deployments should use Let's Encrypt or AWS ACM.

8. **Advisory lock for migrations**: When blue and green containers start simultaneously, an advisory lock (`pg_advisory_lock(42)`) prevents concurrent Alembic migrations.

## Detection

9. **Welford baseline updates**: Baselines are updated only with normal (non-anomalous) records to prevent the "poisoned baseline" problem where spikes inflate the expected cost.

10. **EWMA drift method exclusivity**: EWMA drift fires only when neither z-score nor pct-jump triggered, so slow leaks get their own label rather than being masked by more specific rules.

11. **Ground truth matching**: For detection evaluation, a ground-truth anomaly is considered detected if any anomaly exists for the same resource with `record_ts` within `[start_ts, end_ts + 1h]`.

## Dependencies

12. **Pin flexibility**: If exact version pins fail to resolve, the nearest compatible version is used. The Docker image pins via `requirements.txt` for reproducibility.

13. **Redis 7+**: The system uses Redis 7 features (XAUTOCLAIM with `lag` field in XINFO GROUPS). Earlier Redis versions fall back to XLEN-based lag estimation.
