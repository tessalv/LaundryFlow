#!/bin/bash
# LaundryFlow Database Initialization Script
# This script waits for SQL Server to be ready, then initializes the database

echo "Waiting for SQL Server to be ready..."

# Retry counter
RETRY_COUNT=0
MAX_RETRIES=30

# Wait for SQL Server to be ready
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -Q "SELECT 1" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "SQL Server is ready!"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "SQL Server not ready yet... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 1
done

# Check if we successfully connected
if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: Could not connect to SQL Server after $MAX_RETRIES attempts"
    exit 1
fi

# Run the initialization script
echo "Running database initialization script..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -i /db/init.sql

if [ $? -eq 0 ]; then
    echo "Database initialization completed successfully!"
else
    echo "ERROR: Database initialization failed!"
    exit 1
fi
