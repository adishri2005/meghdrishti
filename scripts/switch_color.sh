#!/bin/bash
# Switch Nginx upstream to the specified color (blue or green)
# Usage: ./switch_color.sh <blue|green>
set -e

COLOR="${1:?Usage: switch_color.sh <blue|green>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UPSTREAM_FILE="$SCRIPT_DIR/../nginx/active/upstream.inc"
START_TIME=$(date +%s%N)

if [ "$COLOR" != "blue" ] && [ "$COLOR" != "green" ]; then
    echo "ERROR: Color must be 'blue' or 'green', got '$COLOR'"
    exit 1
fi

echo "server api-${COLOR}:8000;" > "$UPSTREAM_FILE"
echo "Upstream switched to $COLOR"

# Validate and reload Nginx
docker compose exec -T nginx nginx -t 2>&1
docker compose exec -T nginx nginx -s reload 2>&1

END_TIME=$(date +%s%N)
ELAPSED=$(( (END_TIME - START_TIME) / 1000000 ))
echo "Switch completed in ${ELAPSED}ms"
