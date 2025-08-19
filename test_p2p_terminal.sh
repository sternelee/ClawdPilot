#!/bin/bash

# 测试终端P2P输入输出传输
# Test Terminal P2P Input/Output Transmission

set -e

echo "================================"
echo "Testing P2P Terminal Communication"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Build the CLI first
echo -e "${YELLOW}Building CLI...${NC}"
cd cli
cargo build --release
cd ..

# Path to CLI binary
CLI_BIN="./cli/target/release/cli"

# Start host session in background
echo -e "${YELLOW}Starting host session...${NC}"
RUST_LOG=info,debug $CLI_BIN host --shell bash > host.log 2>&1 &
HOST_PID=$!

# Wait for host to start
sleep 3

# Extract session ticket from host log
TICKET=$(grep "Session Ticket:" host.log | tail -1 | awk '{print $3}')

if [ -z "$TICKET" ]; then
    echo -e "${RED}Failed to get session ticket from host${NC}"
    kill $HOST_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}Got session ticket: $TICKET${NC}"

# Start client session in background
echo -e "${YELLOW}Starting client session...${NC}"
RUST_LOG=info,debug $CLI_BIN join-ticket "$TICKET" > client.log 2>&1 &
CLIENT_PID=$!

# Wait for client to connect
sleep 5

# Send test command from client
echo -e "${YELLOW}Sending test command from client...${NC}"
echo "echo 'Hello from P2P client'" | nc -w 1 localhost 11204 2>/dev/null || true

# Wait a bit for transmission
sleep 2

# Check if the output was received
echo -e "${YELLOW}Checking logs for transmission...${NC}"

# Check host log for remote input
if grep -q "Host received remote input from P2P network" host.log; then
    echo -e "${GREEN}✅ Host received remote input${NC}"
else
    echo -e "${RED}❌ Host did NOT receive remote input${NC}"
fi

# Check if terminal processed the input
if grep -q "Successfully wrote remote input to PTY" host.log; then
    echo -e "${GREEN}✅ Remote input was written to PTY${NC}"
else
    echo -e "${RED}❌ Remote input was NOT written to PTY${NC}"
fi

# Check client log for output
if grep -q "Hello from P2P client" client.log; then
    echo -e "${GREEN}✅ Client received output from host${NC}"
else
    echo -e "${RED}❌ Client did NOT receive output from host${NC}"
fi

# Clean up
echo -e "${YELLOW}Cleaning up...${NC}"
kill $HOST_PID 2>/dev/null || true
kill $CLIENT_PID 2>/dev/null || true

echo "================================"
echo "Test completed. Check host.log and client.log for details."
echo "================================"