# 双向流响应读取修复

## 问题描述

CLI 服务器日志显示：
```
ERROR riterm_shared::event_manager: Failed to queue incoming message: channel closed
ERROR riterm_shared::quic_server: Failed to send response: sending stopped by peer: error 0
```

## 根本原因

在客户端的 `send_message_to_server` 实现中：

```rust
// 旧实现（有问题）
pub async fn send_message_to_server(&mut self, connection_id: &str, message: Message) -> Result<()> {
    let (mut send_stream, _recv_stream) = connection.open_bi().await?;
    let data = MessageSerializer::serialize_for_network(&message)?;
    send_stream.write_all(&data).await?;
    send_stream.finish()?;  // ← 立即关闭发送流
    Ok(())                   // ← 丢弃接收流，不读取响应
}
```

问题：
1. **立即关闭发送流** - `send_stream.finish()` 告诉服务器不会再发送数据
2. **丢弃接收流** - `_recv_stream` 被丢弃，没有人读取服务器的响应
3. **流被销毁** - 函数返回时，接收流被drop，连接被关闭

结果：
- 服务器处理请求后尝试发送响应
- 发现客户端已经关闭/丢弃了接收端
- 响应发送失败：`sending stopped by peer: error 0`

## 解决方案

修改 `send_message_to_server` 来等待和读取响应：

```rust
// 新实现（正确）
pub async fn send_message_to_server(&mut self, connection_id: &str, message: Message) -> Result<()> {
    let (mut send_stream, mut recv_stream) = connection.open_bi().await?;
    
    // 发送消息
    let data = MessageSerializer::serialize_for_network(&message)?;
    send_stream.write_all(&data).await?;
    send_stream.finish()?;
    
    // 如果消息需要响应，等待读取响应
    if message.requires_response {
        debug!("Waiting for response to message: {}", message.id);
        let mut buffer = vec![0u8; 8192];
        match recv_stream.read(&mut buffer).await {
            Ok(Some(n)) => {
                let response_data = &buffer[..n];
                match MessageSerializer::deserialize_from_network(response_data) {
                    Ok(response) => {
                        debug!("Received response: {:?}", response.message_type);
                        // 广播接收到的响应
                        let _ = self.message_tx.send(response);
                    }
                    Err(e) => {
                        error!("Failed to deserialize response: {}", e);
                    }
                }
            }
            Ok(None) => {
                debug!("Response stream closed by server");
            }
            Err(e) => {
                error!("Error reading response: {}", e);
            }
        }
    }
    
    Ok(())
}
```

## 关键改进

1. **保留接收流** - `recv_stream` 不再被丢弃，而是用于读取响应
2. **条件等待** - 只有当消息需要响应时才等待（`message.requires_response`）
3. **读取响应** - 使用 `recv_stream.read()` 读取服务器的响应
4. **广播响应** - 将响应通过 `message_tx` 广播给应用层

## 消息类型

某些消息类型需要响应：

```rust
// MessageBuilder 中的实现
pub fn terminal_management(...) -> Message {
    Message::new(...)
        .requires_response()  // ← 标记需要响应
}
```

需要响应的消息类型：
- `terminal_management` - 终端管理操作
- `system_status_request` - 系统状态查询
- `tcp_connection` - TCP 连接请求

## 流程说明

### 旧流程（错误）
```
Client                          Server
  |                               |
  |------ open_bi() ------------->|
  |                               |
  |------ send request ---------->|
  |                               |
  |------ finish() -------------->| (关闭发送端)
  |                               |
  drop recv_stream                | (处理请求)
  |                               |
  |                               |--- send response -X (失败！)
```

### 新流程（正确）
```
Client                          Server
  |                               |
  |------ open_bi() ------------->|
  |                               |
  |------ send request ---------->|
  |                               |
  |------ finish() -------------->| (关闭发送端)
  |                               |
  |                               | (处理请求)
  |                               |
  |<----- receive response -------|
  |                               |
  broadcast to app                |
```

## 测试

修复后，执行以下测试：

1. 启动 CLI 服务器：`cargo run --bin cli -- host`
2. 从 Tauri 应用连接
3. 创建终端：发送 `create_terminal` 请求
4. 观察日志：
   - ✅ 不应该出现 "channel closed" 错误
   - ✅ 不应该出现 "sending stopped by peer" 错误
   - ✅ 应该看到 "Received response" 日志

## 相关文件

- `shared/src/quic_server.rs` - `QuicMessageClient::send_message_to_server()`
- `shared/src/message_protocol.rs` - 消息的 `requires_response` 字段

## 注意事项

- 这个修复确保双向通信正常工作
- 响应通过 broadcast channel 传递给应用层
- 应用层需要订阅 message_rx 来接收响应
- 对于不需要响应的消息，仍然可以快速返回

## 未来优化

可以考虑：
1. 为需要响应的消息添加超时机制
2. 实现请求-响应的 ID 匹配
3. 支持流式响应（多个响应块）
4. 添加重试机制
