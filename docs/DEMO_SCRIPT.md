# Demo Script (Viva Walkthrough)

This script walks through a 15–20 minute live demonstration of the CCAD system. Each section includes the commands to run and what to explain.

---

## 1. Show System Running (2 min)

```bash
docker compose ps
curl -sk https://localhost:8443/health | python -m json.tool
```

**Explain**: "The system runs 10 containers: PostgreSQL, Redis, API (blue), worker, Nginx, Prometheus, Grafana, and three exporters. The health endpoint checks both DB and Redis connectivity."

---

## 2. Login and Show API (2 min)

```bash
# Get a JWT
TOKEN=$(curl -sk -X POST https://localhost:8443/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@12345"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

echo $TOKEN
```

**Explain**: "Authentication uses bcrypt password hashing and JWT tokens. There are three roles: admin, analyst, and service. Each role has different permissions enforced by middleware."

Open Swagger docs: `https://localhost:8443/docs`

---

## 3. Ingest Normal Data (3 min)

```bash
# Show the cost summary is empty
curl -sk "https://localhost:8443/api/v1/costs/summary?group_by=service" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

# Seed 7 days of history
python scripts/simulate.py seed --days 7

# Show cost summary now has data
curl -sk "https://localhost:8443/api/v1/costs/summary?group_by=service" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Explain**: "The simulator generates realistic cost patterns: daily sinusoidal cycles, weekend dips, and Gaussian noise. Records flow through Redis Streams to the worker, which builds per-resource Welford baselines."

---

## 4. Inject Spike Anomaly (3 min)

```bash
# Inject a 12x spike on GPU instance
python scripts/simulate.py inject --kind spike --resource ec2-ml-gpu-01 --multiplier 12

# Wait 10 seconds for worker to process
sleep 10

# Check anomalies
curl -sk "https://localhost:8443/api/v1/anomalies?severity=critical&limit=5" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Explain**: "The z-score rule fires because cost = 12× mean, giving z ≈ 50. The root cause analysis identifies ec2-ml-gpu-01 as responsible for 95%+ of the hourly increase. Severity is 'critical' because z > 10."

```bash
# View root cause detail
ANOMALY_ID=1
curl -sk "https://localhost:8443/api/v1/anomalies/$ANOMALY_ID" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

---

## 5. Show Grafana Dashboard (2 min)

Open `http://localhost:3000` → CCAD dashboard.

**Point out**: Request rate, queue lag during processing, anomaly detection count, detection delay p95.

---

## 6. Blue/Green Deployment (3 min)

```bash
# Deploy v1.1.0
bash scripts/deploy.sh 1.1.0
```

**Explain**: "The deploy script builds a new image, starts the standby container, waits for its health check, runs a smoke test, cuts Nginx traffic over, then monitors error rate for 60 seconds. If errors exceed 5%, it rolls back automatically."

```bash
# Check health shows the new version
curl -sk https://localhost:8443/health | python -m json.tool
```

---

## 7. Faulty Release + Rollback (3 min)

```bash
# Deploy a faulty release
bash scripts/deploy.sh 1.2.0-bad --faulty
```

**Explain**: "The faulty release passes the health gate because /health is exempt from fault injection. But 50% of normal requests return 500. The watch window detects the high error rate and rolls back within 30 seconds."

```bash
# Verify we're back on the good version
curl -sk https://localhost:8443/health | python -m json.tool
```

---

## 8. Unit Tests (1 min)

```bash
python -m pytest tests/ -v --tb=short
```

**Explain**: "Detection logic is pure functions with no DB dependency — they take baseline stats and cost values as input and return verdicts. This makes them easy to test, modify, and explain."

---

## 9. Drift Check (1 min)

```bash
python scripts/drift_check.py
```

**Explain**: "This compares the desired state in config.yaml against live runtime thresholds in the database, reports on container health, and checks the Nginx upstream."
