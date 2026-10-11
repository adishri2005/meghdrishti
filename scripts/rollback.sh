#!/bin/bash
# Manual instant rollback: switch to the previous color
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UPSTREAM_FILE="$SCRIPT_DIR/../nginx/active/upstream.inc"
RESULTS_DIR="$SCRIPT_DIR/../results"
mkdir -p "$RESULTS_DIR"

CURRENT=$(cat "$UPSTREAM_FILE" | grep -oP 'api-(blue|green)' || echo "api-blue")
ACTIVE="${CURRENT#api-}"

if [ "$ACTIVE" = "blue" ]; then
    PREVIOUS="green"
else
    PREVIOUS="blue"
fi

echo "Current active: $ACTIVE"
echo "Rolling back to: $PREVIOUS"

# Ensure the previous container is running
RUNNING=$(docker compose ps --format json "api-${PREVIOUS}" 2>/dev/null | python -c "import sys,json; print(json.load(sys.stdin).get('State',''))" 2>/dev/null || echo "")
if [ "$RUNNING" != "running" ]; then
    echo "Starting api-${PREVIOUS}..."
    docker compose --profile "$PREVIOUS" up -d --no-deps "api-${PREVIOUS}"
    echo "Waiting for health..."
    sleep 10
fi

START_TIME=$(date +%s%N)
bash "$SCRIPT_DIR/switch_color.sh" "$PREVIOUS"
END_TIME=$(date +%s%N)
ELAPSED=$(( (END_TIME - START_TIME) / 1000000 ))

echo "[$(date -Iseconds)] rollback_triggered to=$PREVIOUS elapsed=${ELAPSED}ms" | tee -a "$RESULTS_DIR/deploy_timeline.log"
echo "=== ROLLBACK COMPLETE in ${ELAPSED}ms ==="
