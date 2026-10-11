# Experiments

This document describes the controlled experiments and their expected results. Each experiment produces artifacts in `results/`.

## Experiment 1: Worker Kill → Recovery

**Purpose**: Demonstrate that the queue-based architecture tolerates worker failure without data loss.

```bash
bash scripts/failure_experiment.sh worker 45
```

**Expected results**:
- API continues accepting records (returns 202) throughout the outage
- Queue lag grows during the outage, then drains back to 0 after recovery
- MTTR < 60 seconds (Docker restart policy + XAUTOCLAIM)
- Zero data loss (UNIQUE constraint + XACK-after-commit)
- Zero duplicates (ON CONFLICT DO NOTHING)

**Artifacts**: `results/failure_timeline_*.csv`, `results/failure_report_*.md`

## Experiment 2: Redis Kill → Recovery

**Purpose**: Show impact of Redis outage on both ingestion and processing.

```bash
bash scripts/failure_experiment.sh redis 45
```

**Expected results**:
- API returns 500 during Redis outage (cannot enqueue)
- Worker reconnects automatically when Redis returns
- Data already in PostgreSQL is not affected
- MTTR < 90 seconds

## Experiment 3: Blue/Green Deployment (Happy Path)

**Purpose**: Demonstrate zero-downtime deployment with health gate.

```bash
bash scripts/deploy.sh 1.1.0
```

**Expected results**:
- Standby container starts and passes health check
- Traffic cuts over after smoke test
- Watch window (60s) monitors error rate
- Old container stops gracefully
- `results/deploy_timeline.log` shows full timeline

## Experiment 4: Faulty Release → Auto-Rollback

**Purpose**: Demonstrate automatic rollback when error rate exceeds 5%.

```bash
bash scripts/deploy.sh 1.2.0-bad --faulty
```

**Expected results**:
- Faulty release passes health gate (health endpoint exempt from fault injection)
- After cutover, 50% of requests return 500
- Watch window detects error rate > 5% within 30 seconds
- Automatic rollback to previous color
- Total rollback time < 60 seconds
- `deploy.sh` exits with code 2

## Experiment 5: Detection Quality Evaluation

**Purpose**: Measure precision, recall, and F1 of the detection system.

```bash
python scripts/evaluate_detection.py
```

**Expected results** (after 14-day seed):
- Recall ≥ 0.90 (detect at least 90% of injected anomalies)
- Precision ≥ 0.80 (80%+ of flagged anomalies are real)
- New-resource detection is reliable
- Spike detection fires within the correct hour
- Drift detection fires within the 12-hour drift window

**Artifacts**: `results/detection_eval_*.md`

## Experiment 6: Load Testing

**Purpose**: Characterize system performance under increasing load.

```bash
bash scripts/run_loadtests.sh
```

**Expected results**:

| Level | Users | Expected RPS | Expected P95 |
|-------|-------|-------------|-------------|
| Low | 10 | >20 | <200ms |
| Medium | 50 | >80 | <500ms |
| High | 200 | >150 | <2000ms |

**Artifacts**: `results/loadtest_*.csv`, `results/loadtest_summary.md`

## Experiment 7: Config Drift Detection

**Purpose**: Verify that runtime changes to detection thresholds are detected as drift.

```bash
# 1. Change a threshold via API
curl -sk -X PUT https://localhost:8443/api/v1/config/thresholds \
  -H "Authorization: Bearer TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"detection": {"z_threshold": 2.0}}'

# 2. Run drift check (should detect DRIFT for detection.z_threshold)
python scripts/drift_check.py

# 3. Reset
curl -sk -X PUT https://localhost:8443/api/v1/config/thresholds \
  -H "Authorization: Bearer TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"detection": {"z_threshold": 3.0}}'
```
