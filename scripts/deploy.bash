#!/bin/bash

# deploy.sh
set -e

LOG_FILE="/tmp/yarn_install.log"
EXIT_CODE_FILE="/tmp/yarn_exit_code"
SCREEN_SESSION="yarn_install"

# Cleanup any existing files
rm -f "$LOG_FILE" "$EXIT_CODE_FILE"

# Kill any existing screen session
screen -S "$SCREEN_SESSION" -X quit 2>/dev/null || true

echo "Starting yarn install in screen session..."

# Start yarn install in screen with logging
screen -dmS "$SCREEN_SESSION" -L -Logfile "$LOG_FILE" bash -c "
    cd /home/${DEPLOY_USER}/wol-backend
    yarn install --production --frozen-lockfile --network-timeout 1800000
    echo \$? > $EXIT_CODE_FILE
"

echo "Yarn install started. Monitoring progress..."

# Monitor the process and show logs
while [ ! -f "$EXIT_CODE_FILE" ]; do
    if [ -f "$LOG_FILE" ]; then
        echo "=== Last 5 lines of yarn install log ==="
        tail -5 "$LOG_FILE" 2>/dev/null || echo "Log not ready yet"
        echo "========================================"
    fi
    echo "Still running... ($(date))"
    sleep 15
done

# Get the exit code
exit_code=$(cat "$EXIT_CODE_FILE")

echo "=== Yarn install completed with exit code: $exit_code ==="

if [ "$exit_code" -eq 0 ]; then
    echo "SUCCESS: Yarn install completed successfully!"
    echo "=== Final log output ==="
    tail -10 "$LOG_FILE" 2>/dev/null || echo "No log available"
else
    echo "FAILED: Yarn install failed!"
    echo "=== Error log output ==="
    tail -20 "$LOG_FILE" 2>/dev/null || echo "No log available"
fi

# Cleanup
rm -f "$EXIT_CODE_FILE"

# Keep log file for debugging (optional - remove this line if you want to clean it up)
echo "Full log available at: $LOG_FILE"

exit $exit_code