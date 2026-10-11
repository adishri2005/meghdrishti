#!/bin/bash
# Blue/green deploy with health gate, smoke test, watch window, auto rollback
# Usage: ./deploy.sh <version> [--faulty]
set -euo pipefail

VERSION="${1:?Usage: deploy.sh <version> [--faulty]}"
FAULTY=false
[ "${2:-}" = "--faulty" ] && FAULTY=true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
UPSTREAM_FILE="$PROJECT_DIR/nginx/active/upstream.inc"
RESULTS_DIR="$PROJECT_DIR/results"
WATCH_DURATION="${WATCH_DURATION:-60}"
mkdir -p "$RESULTS_DIR"

TS=$(date +%Y%m%d_%H%M%S)

# --- Determine active/standby colors ---
CURRENT=$(cat "$UPSTREAM_FILE" | grep -oP 'api-(blue|green)' || echo "api-blue")
ACTIVE_COLOR="${CURRENT#api-}"
if [ "$ACTIVE_COLOR" = "blue" ]; then
    STANDBY="green"
else
    STANDBY="blue"
fi

echo "=== Deploy v${VERSION} ==="
echo "Active: $ACTIVE_COLOR | Standby: $STANDBY | Faulty: $FAULTY"
echo "[$(date -Iseconds)] deploy_started version=$VERSION standby=$STANDBY" | tee -a "$RESULTS_DIR/deploy_timeline.log"

# --- Build image ---
echo "Building image ccad-api:${VERSION}..."
docker compose build --build-arg APP_VERSION="$VERSION" "api-${STANDBY}"

# --- Start standby ---
FAULTY_ENV="FAULTY_RELEASE_$(echo $STANDBY | tr 'a-z' 'A-Z')=$FAULTY"
export "${FAULTY_ENV}"
export "${STANDBY^^}_TAG=$VERSION"

echo "Starting api-${STANDBY}..."
docker compose --profile "$STANDBY" up -d --no-deps "api-${STANDBY}"

# --- Readiness gate ---
echo "Waiting for api-${STANDBY} to become healthy..."
READY=false
for i in $(seq 1 30); do
    HEALTH=$(docker compose exec -T "api-${STANDBY}" curl -sf http://localhost:8000/health 2>/dev/null || echo '{"status":"down"}')
    STATUS=$(echo "$HEALTH" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','down'))" 2>/dev/null || echo "down")
    if [ "$STATUS" = "ok" ]; then
        READY=true
        echo "  Healthy after $((i*2)) seconds"
        break
    fi
    echo "  Attempt $i/30: $STATUS"
    sleep 2
done

if [ "$READY" != "true" ]; then
    echo "ERROR: Standby never became healthy. Removing."
    docker compose stop "api-${STANDBY}" 2>/dev/null || true
    echo "[$(date -Iseconds)] deploy_failed version=$VERSION" | tee -a "$RESULTS_DIR/deploy_timeline.log"
    exit 1
fi

# --- Smoke test ---
echo "Running smoke test against api-${STANDBY}..."
SMOKE_OK=true
# Login
TOKEN=$(docker compose exec -T "api-${STANDBY}" curl -sf -X POST http://localhost:8000/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${ADMIN_USERNAME:-admin}\",\"password\":\"${ADMIN_PASSWORD:-Admin@12345}\"}" 2>/dev/null \
    | python -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
    echo "  WARNING: Smoke test login failed, continuing..."
    SMOKE_OK=false
fi

# --- Record before metrics ---
echo "Recording 'before' metrics..."
python "$SCRIPT_DIR/prom_query.py" 'histogram_quantile(0.95, sum(rate(api_latency_seconds_bucket[1m])) by (le))' > "$RESULTS_DIR/before_${TS}.json" 2>/dev/null || echo '{"value": "N/A"}' > "$RESULTS_DIR/before_${TS}.json"

# --- Cutover ---
echo "Cutting over traffic to $STANDBY..."
bash "$SCRIPT_DIR/switch_color.sh" "$STANDBY"
echo "[$(date -Iseconds)] deploy_cutover version=$VERSION color=$STANDBY" | tee -a "$RESULTS_DIR/deploy_timeline.log"

# --- Watch window ---
echo "Watch window: ${WATCH_DURATION}s (checking every 5s)..."
ROLLBACK_NEEDED=false
CONSECUTIVE_FAILURES=0

for i in $(seq 1 $((WATCH_DURATION / 5))); do
    sleep 5

    # Query error rate from Prometheus
    ERROR_RATE=$(python "$SCRIPT_DIR/prom_query.py" \
        'sum(rate(api_requests_total{status=~"5.."}[30s])) / sum(rate(api_requests_total[30s]))' \
        2>/dev/null | python -c "import sys,json; print(json.load(sys.stdin).get('value', 0))" 2>/dev/null || echo "0")

    # Generate some test traffic
    curl -sk "https://localhost:${HTTPS_PORT:-8443}/health" > /dev/null 2>&1 || true

    echo "  Check $i: error_rate=$ERROR_RATE"

    # Save during snapshot
    echo "{\"check\": $i, \"error_rate\": \"$ERROR_RATE\", \"ts\": \"$(date -Iseconds)\"}" >> "$RESULTS_DIR/during_${TS}.json"

    # Check thresholds
    IS_BAD=$(python -c "print('yes' if float('${ERROR_RATE}') > 0.05 else 'no')" 2>/dev/null || echo "no")
    if [ "$IS_BAD" = "yes" ]; then
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    else
        CONSECUTIVE_FAILURES=0
    fi

    if [ "$CONSECUTIVE_FAILURES" -ge 2 ]; then
        ROLLBACK_NEEDED=true
        echo "ERROR: Error rate exceeded threshold for 2 consecutive checks!"
        break
    fi
done

# --- Rollback or finalize ---
if [ "$ROLLBACK_NEEDED" = "true" ]; then
    echo "ROLLING BACK to $ACTIVE_COLOR..."
    bash "$SCRIPT_DIR/switch_color.sh" "$ACTIVE_COLOR"
    ROLLBACK_TIME=$(date -Iseconds)
    echo "[${ROLLBACK_TIME}] rollback_triggered version=$VERSION" | tee -a "$RESULTS_DIR/deploy_timeline.log"

    # Record after metrics
    python "$SCRIPT_DIR/prom_query.py" 'histogram_quantile(0.95, sum(rate(api_latency_seconds_bucket[1m])) by (le))' > "$RESULTS_DIR/after_${TS}.json" 2>/dev/null || echo '{"value": "N/A"}' > "$RESULTS_DIR/after_${TS}.json"

    echo "=== DEPLOYMENT ROLLED BACK ==="
    exit 2
fi

echo "Watch window passed. Deployment successful!"
echo "[$(date -Iseconds)] deploy_active version=$VERSION color=$STANDBY" | tee -a "$RESULTS_DIR/deploy_timeline.log"

# Record after metrics
python "$SCRIPT_DIR/prom_query.py" 'histogram_quantile(0.95, sum(rate(api_latency_seconds_bucket[1m])) by (le))' > "$RESULTS_DIR/after_${TS}.json" 2>/dev/null || echo '{"value": "N/A"}' > "$RESULTS_DIR/after_${TS}.json"

# Optionally stop the old color
echo "Stopping old api-${ACTIVE_COLOR} after grace period..."
sleep 5
docker compose stop "api-${ACTIVE_COLOR}" 2>/dev/null || true

echo "=== DEPLOYMENT COMPLETE: v${VERSION} on ${STANDBY} ==="
