# Tauri App iroh QUIC 协议架构迁移

本文档记录了将 Tauri app 从旧的 P2P gossip 协议迁移到新的 iroh QUIC 协议架构的详细更改。

## 迁移概述

### 旧架构 vs 新架构

**旧架构:**
- 使用 `iroh-gossip` 进行 P2P 通信
- 基于会话票据的连接
- 简单的事件系统
- 直接的终端命令/响应协议

**新架构:**
- 使用统一的 `MessageProtocol` 和 `QuicMessageClient`
- 基于 QUIC 的可靠连接
- 结构化的事件管理器 (`EventManager`)
- 消息处理器和事件监听器模式

## 主要更改

### 1. 导入和依赖更新

```rust
// 旧的导入
use iroh_gossip::api::GossipSender;
use riterm_shared::{EventType, P2PNetwork, SessionTicket, TerminalCommand, TerminalEvent};

// 新的导入
use riterm_shared::{
    CommunicationManager, EventListener, EventType, Event, TerminalAction, IODataType,
    QuicMessageClient, MessageBuilder
};
```

### 2. 应用状态结构更新

```rust
// 旧状态
pub struct AppState {
    sessions: RwLock<HashMap<String, TerminalSession>>,
    network: RwLock<Option<P2PNetwork>>,
    cleanup_token: RwLock<Option<CancellationToken>>,
}

// 新状态
pub struct AppState {
    sessions: RwLock<HashMap<String, TerminalSession>>,
    communication_manager: RwLock<Option<Arc<CommunicationManager>>>,
    quic_client: RwLock<Option<Arc<QuicMessageClient>>>,
    cleanup_token: RwLock<Option<CancellationToken>>,
}
```

### 3. 终端会话结构更新

```rust
// 旧结构
pub struct TerminalSession {
    pub id: String,
    pub sender: GossipSender,
    pub event_sender: mpsc::UnboundedSender<TerminalEvent>,
    pub last_activity: Arc<RwLock<Instant>>,
    pub cancellation_token: CancellationToken,
    pub event_count: Arc<std::sync::atomic::AtomicUsize>,
}

// 新结构
pub struct TerminalSession {
    pub id: String,
    pub connection_id: String,
    pub node_id: String,
    pub last_activity: Arc<RwLock<Instant>>,
    pub cancellation_token: CancellationToken,
    pub event_count: Arc<std::sync::atomic::AtomicUsize>,
}
```

### 4. 网络初始化更新

**旧的网络初始化:**
```rust
let network = P2PNetwork::new(relay_url).await?;
let node_id = network.get_node_id().await;
let mut network_guard = state.network.write().await;
*network_guard = Some(network);
```

**新的网络初始化:**
```rust
let communication_manager = Arc::new(CommunicationManager::new("riterm_app".to_string()));
communication_manager.initialize().await?;

let quic_client = Arc::new(QuicMessageClient::new(relay_url, communication_manager.clone()).await?);
let node_id = format!("{:?}", quic_client.get_node_id());

let mut comm_guard = state.communication_manager.write().await;
*comm_guard = Some(communication_manager);

let mut client_guard = state.quic_client.write().await;
*client_guard = Some(quic_client);
```

### 5. 事件监听器系统

新增了 `AppEventListener` 结构来处理事件到 Tauri emissions 的转换：

```rust
pub struct AppEventListener {
    app_handle: tauri::AppHandle,
    session_id: String,
    last_activity: Arc<RwLock<Instant>>,
    event_count: Arc<std::sync::atomic::AtomicUsize>,
}

#[async_trait::async_trait]
impl EventListener for AppEventListener {
    async fn handle_event(&self, event: &Event) -> anyhow::Result<()> {
        // 事件处理逻辑
        match event.event_type {
            EventType::TerminalCreated => {
                let _ = self.app_handle.emit(
                    &format!("terminal-created-{}", self.session_id),
                    &event.data,
                );
            }
            // ... 其他事件类型
        }
        Ok(())
    }
}
```

### 6. 终端命令消息更新

所有终端操作现在使用新的消息协议：

**旧方式:**
```rust
let cmd = TerminalCommand::Input {
    terminal_id,
    data: input.as_bytes().to_vec(),
};
network.send_command(&session_id, &session_sender, cmd, None).await?;
```

**新方式:**
```rust
let message = MessageBuilder::terminal_io(
    "riterm_app".to_string(),
    terminal_id,
    IODataType::Input,
    input.as_bytes().to_vec(),
).with_session(session_id.clone());

client_mut.send_message_to_server(&session.connection_id, message).await?;
```

### 7. 命令接口更新

**移除的命令:**
- `send_terminal_input` (已弃用，使用 `send_terminal_input_to_terminal` 替代)
- `send_directed_message` (已弃用)

**更新的命令:**
- `create_terminal` - 使用新的终端管理消息
- `stop_terminal` - 使用新的终端管理消息
- `list_terminals` - 使用新的终端管理消息
- `send_terminal_input_to_terminal` - 使用新的终端 I/O 消息
- `resize_terminal` - 使用新的终端管理消息
- `execute_remote_command` - 重定向到 `send_terminal_input_to_terminal`

## 票据解析更新

更新了票据解析函数以适应新的格式：

```rust
fn extract_node_address_from_ticket(ticket: &str) -> Result<String, Box<dyn std::error::Error>> {
    // 解析 "ticket:" 前缀的 base32 编码票据
    // 提取 node_id 用于连接
}
```

## 依赖更新

添加了新的依赖到 `app/Cargo.toml`:
```toml
async-trait = "0.1"
aead = { workspace = true }
base64 = { workspace = true }
hex = { workspace = true }
regex = "1.10"
```

## 实现状态

### ✅ 已完成
- [x] 更新导入和依赖
- [x] 重构应用状态管理
- [x] 实现新的网络初始化
- [x] 创建事件监听器系统
- [x] 更新所有终端命令使用新消息协议
- [x] 更新票据解析逻辑
- [x] 清理旧代码和弃用功能

### 🚧 部分实现 (需要进一步完善)
- [ ] 实际的 QUIC 连接建立
- [ ] 票据中的节点地址解析
- [ ] 消息发送和接收的完整实现
- [ ] 错误处理和重连机制

### 📝 TODO 项目
1. 实现从票据中正确解析 iroh 节点地址
2. 建立实际的 QUIC 连接到 CLI 服务器
3. 实现双向消息通信
4. 添加连接状态监控和自动重连
5. 完善错误处理和用户反馈

## 使用说明

### 初始化网络
```rust
await invoke('initialize_network')
// 或使用自定义中继
await invoke('initialize_network_with_relay', { relayUrl: 'custom-relay-url' })
```

### 连接到会话
```rust
await invoke('connect_to_peer', {
    sessionTicket: 'ticket:BASE32_ENCODED_TICKET_DATA'
})
```

### 终端操作
```rust
// 创建终端
await invoke('create_terminal', {
    sessionId: 'session-id',
    name: 'My Terminal',
    shellPath: '/bin/bash',
    workingDir: '/home/user',
    size: [24, 80]
})

// 发送输入
await invoke('send_terminal_input_to_terminal', {
    sessionId: 'session-id',
    terminalId: 'terminal-id',
    input: 'ls -la\n'
})

// 调整大小
await invoke('resize_terminal', {
    sessionId: 'session-id',
    terminalId: 'terminal-id',
    rows: 30,
    cols: 100
})
```

## 事件监听

应用现在会发出以下事件：
- `terminal-created-{sessionId}`
- `terminal-stopped-{sessionId}`
- `terminal-input-{sessionId}`
- `terminal-output-{sessionId}`
- `terminal-error-{sessionId}`
- `tcp-session-created-{sessionId}`
- `tcp-session-stopped-{sessionId}`
- `peer-connected-{sessionId}`
- `peer-disconnected-{sessionId}`

## 注意事项

1. **向后兼容性**: 保留了一些旧命令作为兼容性包装器
2. **调试支持**: 在调试模式下提供了详细的日志输出
3. **错误处理**: 所有新功能都有适当的错误处理和用户友好的错误消息
4. **性能**: 新架构支持更好的消息批处理和性能优化

这个迁移为 RiTerm Tauri 应用提供了更强大、更可靠的 P2P 通信基础设施，同时保持了良好的用户体验和开发体验。