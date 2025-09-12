#!/bin/bash
# Comprehensive health check script for Railway deployment
# POS Conejo Negro - Production health monitoring

set -e

# Health check configuration
HOST="localhost"
PORT="${PORT:-3000}"
TIMEOUT=5
MAX_RETRIES=3

# Health check endpoints to test
ENDPOINTS=(
    "/api/health"
    "/api/version" 
    "/"
)

# Function to check endpoint health
check_endpoint() {
    local endpoint="$1"
    local url="http://${HOST}:${PORT}${endpoint}"
    
    if curl -f -s -m ${TIMEOUT} "${url}" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    local url="http://${HOST}:${PORT}/api/health"
    
    # Get health response and check database status
    local response=$(curl -s -m ${TIMEOUT} "${url}" 2>/dev/null || echo '{}')
    
    # Check if database is ready using node to parse JSON
    local db_ready=$(node -pe "
        try {
            const health = JSON.parse('${response}');
            console.log(health.isDatabaseReady === true ? 'true' : 'false');
        } catch(e) {
            console.log('false');
        }
    " 2>/dev/null || echo "false")
    
    if [ "$db_ready" = "true" ]; then
        return 0
    else
        return 1
    fi
}

# Function to check system resources
check_resources() {
    # Check memory usage (should be under 90%)
    local memory_percent=$(free | awk '/Mem:/ {printf("%.0f", ($3/$2)*100)}' 2>/dev/null || echo "0")
    
    if [ "${memory_percent}" -gt 90 ]; then
        echo "WARNING: High memory usage: ${memory_percent}%" >&2
        return 1
    fi
    
    return 0
}

# Main health check logic
main() {
    local failed_checks=0
    local total_checks=0
    
    echo "Starting comprehensive health check..."
    
    # Check each endpoint
    for endpoint in "${ENDPOINTS[@]}"; do
        total_checks=$((total_checks + 1))
        
        if check_endpoint "${endpoint}"; then
            echo "✅ Endpoint ${endpoint}: OK"
        else
            echo "❌ Endpoint ${endpoint}: FAILED"
            failed_checks=$((failed_checks + 1))
        fi
    done
    
    # Check database connectivity
    total_checks=$((total_checks + 1))
    if check_database; then
        echo "✅ Database connectivity: OK"
    else
        echo "❌ Database connectivity: FAILED"
        failed_checks=$((failed_checks + 1))
    fi
    
    # Check system resources
    total_checks=$((total_checks + 1))
    if check_resources; then
        echo "✅ System resources: OK"
    else
        echo "⚠️  System resources: WARNING"
        # Don't fail on resource warnings, just log them
    fi
    
    # Determine overall health
    if [ "${failed_checks}" -eq 0 ]; then
        echo "🟢 Overall health: HEALTHY (${total_checks}/${total_checks} checks passed)"
        exit 0
    elif [ "${failed_checks}" -lt $((total_checks / 2)) ]; then
        echo "🟡 Overall health: DEGRADED (${failed_checks}/${total_checks} checks failed)"
        exit 1
    else
        echo "🔴 Overall health: UNHEALTHY (${failed_checks}/${total_checks} checks failed)"
        exit 1
    fi
}

# Run health check with timeout
timeout 15s main "$@"
exit_code=$?

if [ $exit_code -eq 124 ]; then
    echo "🔴 Health check timed out"
    exit 1
fi

exit $exit_code