#!/bin/bash

# 测试历史消息发送功能
# 这个脚本会启动一个主机会话，然后模拟客户端加入并接收历史记录

set -e

echo "🧪 Testing History Message Sending Functionality"
echo "================================================"

# 清理之前的日志文件
echo "🧹 Cleaning up previous logs..."
rm -rf logs/
mkdir -p logs/

# 编译项目
echo "🔨 Building the project..."
cargo build --release --package cli

echo ""
echo "📋 Test Plan:"
echo "1. Start a host session in background"
echo "2. Generate some terminal output"
echo "3. Start a client session to join"
echo "4. Verify history is received"
echo ""

# 创建测试用的临时脚本
cat > temp_host_commands.sh << 'EOF'
#!/bin/bash
echo "Host session started"
echo "Current directory: $(pwd)"
echo "Current user: $(whoami)"
echo "Date: $(date)"
ls -la
echo "This is some test output for history"
sleep 2
echo "More output after delay"
EOF

chmod +x temp_host_commands.sh

echo "🚀 Starting host session..."
echo "   This will create a session and generate some output"
echo "   The session ticket will be saved to ticket.txt"

# 启动主机会话（在后台运行，但输出到前台）
timeout 10s ./target/release/cli host --shell bash 2>&1 | tee host_output.log &
HOST_PID=$!

# 等待主机启动
sleep 3

# 检查是否有ticket生成
if [ -f "host_output.log" ]; then
    # 从输出中提取ticket
    TICKET=$(grep "Join using:" host_output.log | cut -d' ' -f3- | head -1)
    if [ -n "$TICKET" ]; then
        echo "✅ Found session ticket: $TICKET"
        echo "$TICKET" > ticket.txt
        
        echo ""
        echo "🔗 Now testing client join..."
        sleep 2
        
        # 启动客户端会话
        echo "Starting client session to join and receive history..."
        timeout 5s ./target/release/cli join "$TICKET" 2>&1 | tee client_output.log || true
        
        echo ""
        echo "📊 Test Results:"
        echo "==============="
        
        # 检查日志文件是否创建
        if [ -d "logs" ] && [ "$(ls -A logs/)" ]; then
            echo "✅ Log files created:"
            ls -la logs/
            echo ""
            echo "📄 Log file content sample:"
            head -20 logs/*.log 2>/dev/null || echo "No log content found"
        else
            echo "❌ No log files found"
        fi
        
        # 检查客户端是否收到历史记录
        if grep -q "Session History" client_output.log 2>/dev/null; then
            echo "✅ Client received session history"
            echo "📜 History content:"
            grep -A 10 "Session History" client_output.log || true
        else
            echo "❌ Client did not receive session history"
            echo "📄 Client output:"
            cat client_output.log 2>/dev/null || echo "No client output found"
        fi
        
    else
        echo "❌ Could not extract session ticket from host output"
        echo "📄 Host output:"
        cat host_output.log
    fi
else
    echo "❌ No host output file found"
fi

# 清理进程
kill $HOST_PID 2>/dev/null || true
wait $HOST_PID 2>/dev/null || true

# 清理临时文件
rm -f temp_host_commands.sh ticket.txt host_output.log client_output.log

echo ""
echo "🏁 Test completed!"
echo "💡 If you see '✅ Client received session history', the feature is working correctly."