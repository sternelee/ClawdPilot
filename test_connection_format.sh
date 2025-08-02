#!/bin/bash

echo "Testing CLI connection format fix..."

# Start CLI in background and capture output
./target/debug/cli host --width 80 --height 24 > cli_output.txt 2>&1 &
CLI_PID=$!

# Wait a bit for startup
sleep 3

# Kill the CLI process
kill $CLI_PID 2>/dev/null

# Check if the output contains the expected format
if grep -q "App Connection String (placeholder):" cli_output.txt; then
    echo "✅ CLI now provides connection string in expected format"
    grep "App Connection String" cli_output.txt
else
    echo "❌ CLI output doesn't contain expected connection format"
fi

# Clean up
rm -f cli_output.txt

echo "Test completed."