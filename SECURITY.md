# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

We take the security of Cloud Cost Anomaly Detection (CCAD) seriously. If you believe you have found a security vulnerability, please follow responsible disclosure guidelines:

1. **Do not open a public issue.**
2. Report vulnerabilities confidentially via email to: `security@example.com` or via GitHub Private Vulnerability Reporting.
3. Include detailed steps to reproduce the issue (proof of concept, curl command, HTTP request payload, affected endpoints).
4. Our security team will acknowledge receipt of reports within **24 hours** and provide a status update within **72 hours**.

---

## Incident Response & Secret Rotation Runbook

### 1. Rotating Compromised JWT Secret (`JWT_SECRET`)
If `JWT_SECRET` is suspected to be leaked:
1. Generate a new cryptographically secure secret (minimum 32 bytes):
   ```bash
   openssl rand -hex 32
   ```
2. Update the environment variable or secrets manager in production:
   ```bash
   JWT_SECRET="<new-hex-token>"
   ```
3. Restart backend API instances (`docker compose restart api`). All existing JWT tokens will be immediately invalidated and users will be required to re-authenticate.

### 2. Rotating Compromised Database Password (`POSTGRES_PASSWORD`)
1. Update database user password in PostgreSQL:
   ```sql
   ALTER USER ccad WITH PASSWORD 'NewStrongPassword#2026';
   ```
2. Update `DATABASE_URL` in environment / secrets manager:
   ```bash
   DATABASE_URL="postgresql+psycopg2://ccad:NewStrongPassword#2026@postgres:5432/ccad"
   ```
3. Restart API and worker containers.

### 3. Rotating Compromised API Client Keys
1. In the CostGuard console under Admin -> API Clients or via API:
   ```bash
   curl -X POST https://localhost:8443/api/v1/auth/api-clients \
     -H "Authorization: Bearer <ADMIN_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"name": "new-pipeline-key"}'
   ```
2. Update the client key in the calling pipeline.
3. Remove or deactivate the previous client record in the `api_clients` table.

---

## Database Migration Rollback Runbook

If a migration fails or must be rolled back:
1. Inspect current revision:
   ```bash
   alembic current
   ```
2. Downgrade one revision:
   ```bash
   alembic downgrade -1
   ```
3. Or downgrade to a specific target revision:
   ```bash
   alembic downgrade <revision_id>
   ```
