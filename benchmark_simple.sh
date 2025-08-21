#!/bin/bash

# 简单的性能基准测试
echo "⚡ riterm 性能基准测试"
echo "===================="

# 编译项目
echo "🔨 编译项目..."
cd cli
cargo build --release --quiet
cd ..

# 测试编译时间
echo "📊 编译性能："
time (cd cli && cargo build --release --quiet)

# 测试启动时间
echo ""
echo "🚀 启动性能测试："
echo "测试 CLI 工具启动时间..."

# 测试帮助命令的响应时间
time ./cli/target/release/cli --help > /dev/null

echo ""
echo "📈 内存使用测试："
echo "启动主机会话并监控内存使用..."

# 在后台启动主机会话并监控内存
timeout 5s ./cli/target/release/cli host --shell bash &
PID=$!
sleep 1

if ps -p $PID > /dev/null; then
    echo "进程 PID: $PID"
    # 获取内存使用情况（macOS）
    if command -v ps > /dev/null; then
        echo "内存使用："
        ps -o pid,rss,vsz,comm -p $PID
    fi
fi

# 清理
kill $PID 2>/dev/null || true
wait $PID 2>/dev/null || true

echo ""
echo "✅ 基准测试完成！"