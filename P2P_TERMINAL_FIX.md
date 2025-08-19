# P2P Terminal 输入输出测试指南

## 问题修复说明

已修复的问题：
- 终端交互的输入与输出未能正确发送给P2P远程客户端

## 修复内容

### 1. P2P 消息处理改进
- **文件**: `cli/src/p2p.rs`
  - 修复了 `handle_gossip_message` 中远程输入未正确传递给 PTY 的问题
  - 添加了 ANSI 转义序列的序列化/反序列化处理
  - 使用 Arc 包装 sessions 以支持在多个任务间共享
  - 移除了创建 sessions 副本的逻辑，直接使用原始引用

### 2. 终端输入处理优化
- **文件**: `cli/src/terminal.rs`
  - 增加了详细的调试日志来追踪远程输入处理流程
  - 确保远程输入被正确写入 PTY

### 3. CLI 客户端改进
- **文件**: `cli/src/cli.rs`
  - 重构了 `join_session` 函数，使用异步 stdin 读取
  - 改进了输入事件的处理逻辑
  - 添加了更多调试日志

## 手动测试步骤

### 1. 编译项目
```bash
cd cli
cargo build --release
cd ..
```

### 2. 启动主机端（终端1）
```bash
# 设置日志级别为 info 以查看详细信息
export RUST_LOG=info

# 启动主机会话
./cli/target/release/cli host --shell bash
```

主机端会显示：
- Session ID
- Node ID
- Session Ticket（重要：复制这个票据）

### 3. 启动客户端（终端2）
```bash
# 设置日志级别
export RUST_LOG=info

# 使用票据加入会话（替换 TICKET 为实际的票据）
./cli/target/release/cli join-ticket TICKET
```

### 4. 测试交互

#### 在客户端终端：
1. 输入任意命令，如 `ls`、`echo "Hello P2P"`
2. 观察是否在主机端执行
3. 检查输出是否返回到客户端

#### 预期行为：
- **客户端输入** → 通过 P2P 网络 → **主机端 PTY 执行** → **输出通过 P2P 返回** → **客户端显示**

### 5. 查看日志

主机端应该显示：
```
INFO Host received remote input from P2P network: "ls\n"
INFO Successfully wrote remote input to PTY
```

客户端应该显示：
- 执行命令的输出结果

## 调试提示

如果仍有问题，启用 debug 日志：
```bash
export RUST_LOG=debug
```

查看关键日志：
- `"Host received remote input from P2P network"` - 主机收到远程输入
- `"Successfully wrote remote input to PTY"` - 输入已写入 PTY
- `"Sending terminal output"` - 发送终端输出
- `"Received gossip message"` - 收到 P2P 消息

## 已知限制

1. 需要等待几秒钟让 P2P 连接建立
2. 首次连接可能需要重试
3. ANSI 转义序列会被转换以确保传输安全

## 问题排查

如果输入输出仍未传输：

1. **检查网络连接**
   - 确认两端都显示 "Peer connected"
   - 检查是否有 "Failed to send" 错误

2. **检查 PTY 处理**
   - 查看是否有 "Failed to write to PTY" 错误
   - 确认 shell 类型正确

3. **检查消息序列化**
   - 查看是否有 "Failed to deserialize message" 错误
   - 确认消息格式正确