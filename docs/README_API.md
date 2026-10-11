# API Reference

Base URL: `https://localhost:8443/api/v1`

All endpoints return JSON. Errors use the format `{"error": {"code": N, "message": "..."}}`.

## Authentication

### POST /auth/login
Authenticate and receive a JWT.

```bash
curl -sk -X POST https://localhost:8443/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin", "password": "Admin@12345"}'
```
Response (200):
```json
{"access_token": "eyJ...", "token_type": "bearer", "expires_in": 1800, "role": "admin"}
```

### POST /auth/register (admin only)
```bash
curl -sk -X POST https://localhost:8443/api/v1/auth/register \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"username": "newuser", "password": "SecurePass1", "role": "analyst"}'
```

### POST /auth/api-clients (admin only)
```bash
curl -sk -X POST https://localhost:8443/api/v1/auth/api-clients \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"name": "my-service"}'
```
Response (201): `{"id": 2, "name": "my-service", "api_key": "abc...xyz"}` (key shown once)

## Ingestion

### POST /records/batch (service API key or admin)
```bash
curl -sk -X POST https://localhost:8443/api/v1/records/batch \
  -H 'X-API-Key: svc-ingest-key-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"records": [{"resource_id": "ec2-web-01", "type": "EC2", "service": "EC2", "region": "us-east-1", "team_tag": "web", "timestamp": "2026-10-11T14:00:00Z", "usage_quantity": 20.0, "unit_cost": 0.05, "cost": 1.0}], "backfill": false}'
```
Response (202): `{"job_id": "uuid", "accepted": 1, "status": "queued"}`

### GET /records/jobs/{job_id}
```bash
curl -sk https://localhost:8443/api/v1/records/jobs/JOB_ID \
  -H 'Authorization: Bearer TOKEN'
```

## Anomalies

### GET /anomalies
```bash
curl -sk 'https://localhost:8443/api/v1/anomalies?severity=critical&status=open&limit=10' \
  -H 'Authorization: Bearer TOKEN'
```

### GET /anomalies/{id}
Full detail including root_cause JSON and alerts.

### PATCH /anomalies/{id}
```bash
curl -sk -X PATCH https://localhost:8443/api/v1/anomalies/1 \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"status": "acknowledged"}'
```

## Costs

### GET /costs/summary
```bash
curl -sk 'https://localhost:8443/api/v1/costs/summary?group_by=service' \
  -H 'Authorization: Bearer TOKEN'
```

### GET /costs/resources/{resource_id}/costs
```bash
curl -sk 'https://localhost:8443/api/v1/costs/resources/ec2-ml-gpu-01/costs?hours=48' \
  -H 'Authorization: Bearer TOKEN'
```

## Configuration

### GET /config/thresholds
### PUT /config/thresholds (admin only)
```bash
curl -sk -X PUT https://localhost:8443/api/v1/config/thresholds \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"detection": {"z_threshold": 2.5}}'
```

## Admin

### POST /admin/simulate (admin only)
```bash
curl -sk -X POST https://localhost:8443/api/v1/admin/simulate \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"hours": 1, "inject": "spike", "resource_id": "ec2-ml-gpu-07", "multiplier": 12}'
```

## Health (not under /api/v1)

### GET /health
```bash
curl -sk https://localhost:8443/health
```
Response (200): `{"status": "ok", "version": "1.0.0", "color": "blue", "db": true, "redis": true}`

### GET /metrics
Prometheus metrics in text format.
