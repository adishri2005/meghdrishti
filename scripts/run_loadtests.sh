#!/bin/bash
# Run Locust load tests at three levels: low, medium, high
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
RESULTS_DIR="$PROJECT_DIR/results"
LOCUST_FILE="$PROJECT_DIR/loadtests/locustfile.py"
BASE_URL="https://localhost:${HTTPS_PORT:-8443}"
mkdir -p "$RESULTS_DIR"

echo "=== Load Tests ==="

run_test() {
    local LEVEL=$1
    local USERS=$2
    local SPAWN=$3
    local DURATION=$4

    echo ""
    echo "--- Level: $LEVEL (users=$USERS, spawn=$SPAWN, duration=$DURATION) ---"

    locust -f "$LOCUST_FILE" \
        --headless \
        --host "$BASE_URL" \
        -u "$USERS" \
        -r "$SPAWN" \
        -t "$DURATION" \
        --csv "$RESULTS_DIR/loadtest_${LEVEL}" \
        --csv-full-history \
        --only-summary \
        2>&1 | tail -20

    echo "  Results saved to $RESULTS_DIR/loadtest_${LEVEL}_stats.csv"
}

run_test "low"    10   2   "2m"
run_test "medium" 50   10  "3m"
run_test "high"   200  20  "5m"

echo ""
echo "=== All load tests complete ==="
echo "Generating summary..."
python "$SCRIPT_DIR/summarize_loadtests.py"
