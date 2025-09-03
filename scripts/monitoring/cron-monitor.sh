#!/bin/bash

# Railway Monitor Cron Script
# This script can be run from cron to ensure the monitor is always running

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/monitoring/cron.log"
PID_FILE="$PROJECT_ROOT/logs/monitoring/monitor.pid"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check if monitor is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            return 0  # Running
        else
            # Stale PID file
            rm -f "$PID_FILE"
            return 1  # Not running
        fi
    else
        return 1  # Not running
    fi
}

# Start the monitor
start_monitor() {
    cd "$SCRIPT_DIR"
    node monitor-service.js start >> "$LOG_FILE" 2>&1 &
    local pid=$!
    echo $pid > "$PID_FILE"
    log_message "Started monitor service with PID: $pid"
}

# Main logic
if is_running; then
    log_message "Monitor is already running"
else
    log_message "Monitor is not running, starting..."
    start_monitor
fi

# Clean old logs (keep last 30 days)
find "$(dirname "$LOG_FILE")" -name "health-*.json" -mtime +30 -delete 2>/dev/null
find "$(dirname "$LOG_FILE")" -name "*.log" -mtime +30 -delete 2>/dev/null