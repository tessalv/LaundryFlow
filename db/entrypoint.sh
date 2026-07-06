#!/bin/bash
# =========================================================
# LaundryFlow Database Initialization Script
# =========================================================
# Purpose:
# - Starts SQL Server
# - Waits for SQL Server to become available
# - Runs database initialization script once the server is ready
#
# Responsibilities:
# - Start SQL Server in the background
# - Check SQL Server availability (health check)
# - Retry connection with a timeout mechanism
# - Execute /db/init.sql when connection succeeds
# =========================================================

set -e

echo "Starting SQL Server..."
/opt/mssql/bin/sqlservr &
SQLSERVR_PID=$!

echo "Waiting for SQL Server to be ready..."

# Connection retry configuration
RETRY_COUNT=0
MAX_RETRIES=30

# Active wait loop for SQL Server availability
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    /opt/mssql-tools18/bin/sqlcmd \
        -S localhost \
        -U sa \
        -P "$SA_PASSWORD" \
        -C \
        -Q "SELECT 1" > /dev/null 2>&1

    # Check if the previous command succeeded
    if [ $? -eq 0 ]; then
        echo "SQL Server is ready!"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "SQL Server not ready yet... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 1
done

# Verify successful connection
if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: Could not connect to SQL Server after $MAX_RETRIES attempts"
    kill "$SQLSERVR_PID" 2>/dev/null || true
    exit 1
fi

# Run database initialization script
echo "Running database initialization script..."
/opt/mssql-tools18/bin/sqlcmd \
    -S localhost \
    -U sa \
    -P "$SA_PASSWORD" \
    -C \
    -i /db/init.sql

# Check initialization result
if [ $? -eq 0 ]; then
    echo "Database initialization completed successfully!"
else
    echo "ERROR: Database initialization failed!"
    kill "$SQLSERVR_PID" 2>/dev/null || true
    exit 1
fi

wait "$SQLSERVR_PID"
