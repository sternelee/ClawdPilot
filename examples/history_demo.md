# 历史消息发送功能演示

这个演示展示了 riterm 的历史消息自动发送功能。

## 功能概述

当新的参与者加入一个正在进行的终端会话时，他们会自动接收到完整的会话历史记录，包括：

- 所有之前的终端输出
- 使用的 Shell 类型（zsh, bash, fish 等）
- 当前工作目录
- 会话开始时间

## 使用步骤

### 1. 启动主机会话

```bash
# 启动一个 zsh 会话
./cli/target/release/cli host --shell zsh

# 或者使用默认 shell
./cli/target/release/cli host
```

输出示例：

```
🚀 Starting shared terminal session...
📋 Session ID: 550e8400-e29b-41d4-a716-446655440000
🐚 Shell: Zsh (/bin/zsh)
📏 Size: 80x24

🌐 Node ID: 2kx7v3q8m9n4p5r6s7t8u9v0w1x2y3z4
📍 Node Address: NodeAddr { node_id: 2kx7v3q8..., direct_addresses: [...] }
🎫 Session Ticket: MFRGG43FMVZXG5DFON2HE2LTMVZXG5DFON2HE2LTMVZXG5DF...
💡 Others can join using: roterm join MFRGG43FMVZXG5DFON2HE2LTMVZXG5DF...
```

### 2. 在主机会话中执行一些命令

```bash
# 在主机终端中执行这些命令
pwd
ls -la
echo "Hello from the host session!"
cd /tmp
echo "Changed directory to /tmp"
date
```

这些命令的输出都会被记录到日志文件中：`logs/{session_id}.log`

### 3. 新参与者加入会话

在另一个终端窗口中：

```bash
# 使用主机提供的 ticket 加入会话
./cli/target/release/cli join MFRGG43FMVZXG5DFON2HE2LTMVZXG5DF...
```

### 4. 自动接收历史记录

新参与者加入后会立即看到：

```
🔗 Joining session with ticket...
🌐 Your Node ID: 8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p
📡 Successfully parsed ticket for topic: 4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u
✅ Joined session. Receiving terminal output...
💡 Type to send input to the remote session. Press Ctrl+C to exit.

📜 Session History (Shell: zsh, CWD: /Users/username/project)
/Users/username/project
total 48
drwxr-xr-x  12 user  staff   384 Jan 21 11:00 .
drwxr-xr-x   8 user  staff   256 Jan 21 10:30 ..
-rw-r--r--   1 user  staff  1234 Jan 21 11:00 README.md
...
Hello from the host session!
Changed directory to /tmp
Mon Jan 21 11:15:30 CST 2025
--- End of History ---

# 现在可以看到实时的终端输出
```

## 技术实现细节

### 消息流程

1. **参与者加入**：

   - 主机接收到加入通知

2. **历史记录获取**：

   - 主机通过回调函数获取当前会话的历史记录
   - 历史记录包括：logs、shell 类型、当前工作目录

3. **历史数据发送**：

   - 主机发送 `HistoryData` 消息给新参与者
   - 消息经过加密传输

4. **历史记录显示**：
   - 新参与者接收并显示历史记录
   - 格式化显示：Shell 类型、工作目录、完整日志

### 日志文件结构

```
logs/
├── session_550e8400-e29b-41d4-a716-446655440000.log
├── session_661f9511-f3a5-42e5-b827-557766551111.log
└── ...
```

每个日志文件包含该会话的完整终端输出历史。

### 会话信息格式

```rust
pub struct SessionInfo {
    pub logs: String,    // 完整的终端输出历史
    pub shell: String,   // shell 类型 (zsh, bash, fish, etc.)
    pub cwd: String,     // 当前工作目录
}
```

## 配置选项

### 主机端选项

```bash
# 指定 shell 类型
./cli/target/release/cli host --shell zsh
./cli/target/release/cli host --shell bash
./cli/target/release/cli host --shell fish

# 指定终端大小
./cli/target/release/cli host --width 120 --height 30

# 启用直通模式（类似 asciinema）
./cli/target/release/cli host --passthrough

# 保存会话到文件
./cli/target/release/cli host --save session_recording.json
```

### 客户端选项

```bash
# 加入会话
./cli/target/release/cli join <ticket>

# 列出活跃会话
./cli/target/release/cli list

# 播放录制的会话
./cli/target/release/cli play session_recording.json
```

## 故障排除

### 常见问题

1. **历史记录未接收**：

   - 检查网络连接
   - 确认 ticket 正确
   - 查看日志文件是否存在

2. **连接失败**：

   - 检查防火墙设置
   - 尝试使用自定义中继服务器：`--relay https://your-relay.com`

3. **日志文件未创建**：
   - 检查文件权限
   - 确认 `logs/` 目录可写

### 调试信息

启用详细日志：

```bash
RUST_LOG=debug ./cli/target/release/cli host --shell zsh
```

这将显示详细的网络连接和消息传输信息。

## 安全性

- 所有消息都使用 ChaCha20Poly1305 加密
- 每个会话使用唯一的加密密钥
- 密钥通过 session ticket 安全分发
- 支持自定义中继服务器

## 性能特性

- 异步 I/O，不阻塞终端操作
- 智能锁管理，避免死锁
- 内存缓冲 + 文件持久化
- 增量消息传输，减少网络开销

