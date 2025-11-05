# 前端消息接收修复

## 问题描述

Tauri 前端没有收到来自 CLI 的终端列表和创建响应。

## 根本原因

前端只监听了 `terminal-event-${sessionId}` 和 `terminal-output-${sessionId}` 事件，但是后端发送的响应消息使用了不同的事件名称：

- `session-response-${sessionId}` - 响应消息（包含终端列表、创建结果等）
- `terminal-management-${sessionId}` - 终端管理事件

## 解决方案

在 `src/components/RemoteSessionView.tsx` 的 `setupTerminalEventListeners` 函数中添加新的事件监听器：

```typescript
// 监听响应消息
await listen(`session-response-${props.sessionId}`, (event: any) => {
  console.log("Received response message:", event.payload);
  
  const response = event.payload;
  if (response.success && response.data) {
    try {
      // 解析 JSON 字符串（因为后端将 serde_json::Value 转换为 String）
      const data = JSON.parse(response.data);
      console.log("Parsed response data:", data);
      
      // 如果是终端列表响应
      if (data.terminals) {
        console.log("Setting terminal list:", data.terminals);
        setTerminals(data.terminals);
        setLoading(false);
      }
      
      // 如果是终端创建响应
      if (data.terminal_id) {
        console.log("Terminal created:", data.terminal_id);
        // 重新获取终端列表
        fetchTerminals();
      }
    } catch (error) {
      console.error("Failed to parse response data:", error, response.data);
    }
  }
});

// 监听终端管理消息
await listen(`terminal-management-${props.sessionId}`, (event: any) => {
  console.log("Received terminal management message:", event.payload);
  // 终端创建、停止等操作后，重新获取列表
  fetchTerminals();
});
```

## 消息流程

### 1. 创建终端
```
前端 RemoteSessionView.tsx
  ↓ invoke("create_terminal")
Tauri app/src/lib.rs::create_terminal
  ↓ QuicClient::send_message_to_server
CLI cli/src/message_server.rs::TerminalMessageHandler
  ↓ handle TerminalAction::Create
  ↓ create_terminal()
  ↓ 创建 ResponseMessage
后端 shared/src/quic_server.rs
  ↓ 发送响应
  ↓ 客户端读取响应
Tauri app/src/lib.rs::消息接收任务
  ↓ emit("session-response-{sessionId}")
前端 RemoteSessionView.tsx
  ↓ 接收并解析响应
  ↓ setTerminals() 更新状态
```

### 2. 获取终端列表
```
前端 fetchTerminals()
  ↓ invoke("get_terminal_list")
Tauri app/src/lib.rs::list_terminals
  ↓ 发送 TerminalAction::List
CLI 处理并返回终端列表
  ↓ ResponseMessage { terminals: [...] }
前端接收 session-response 事件
  ↓ 解析 data.terminals
  ↓ setTerminals() 更新 UI
```

## 调试步骤

### 1. 检查浏览器控制台

在开发者工具中应该看到：

```javascript
// 创建终端后
Received response message: { request_id: "...", success: true, data: "{\"terminal_id\":\"...\"}", message: "..." }
Parsed response data: { terminal_id: "...", status: "created" }
Terminal created: d0daab6a-aea9-4840-a0c9-c3f5246b7ab7

// 获取列表后
Received response message: { request_id: "...", success: true, data: "{\"terminals\":[...]}", message: "..." }
Parsed response data: { terminals: [...] }
Setting terminal list: [...]
```

### 2. 检查后端日志

CLI 应该显示：

```
INFO cli::message_server: Creating terminal session: d0daab6a-...
INFO cli::message_server: Terminal session created successfully: d0daab6a-...
INFO riterm_shared::quic_server: Received response: Response
```

### 3. 验证事件名称

在前端 `setupTerminalEventListeners` 中临时添加：

```typescript
console.log("Setting up listeners for session:", props.sessionId);
console.log("Listening on: session-response-" + props.sessionId);
console.log("Listening on: terminal-management-" + props.sessionId);
```

### 4. 检查 response.data 格式

由于我们将 `ResponseMessage.data` 改为 `Option<String>`，需要在前端解析：

```typescript
// response.data 是 JSON 字符串，需要 JSON.parse
const data = JSON.parse(response.data);
```

## 常见问题

### Q: 前端收不到任何消息

**A:** 检查：
1. 事件名称是否匹配（包括 sessionId）
2. 浏览器控制台是否有 JavaScript 错误
3. 后端是否真的发送了响应（查看 CLI 日志）

### Q: 前端收到消息但解析失败

**A:** 检查：
1. `response.data` 是否是有效的 JSON 字符串
2. 是否调用了 `JSON.parse()`
3. 解析后的数据结构是否符合预期

### Q: 终端列表为空

**A:** 检查：
1. CLI 是否真的创建了终端（查看日志）
2. `list_terminals()` 返回的数据格式
3. 前端的 `terminals` signal 是否正确更新

### Q: TerminalSession 字段不匹配

**A:** 后端 `TerminalSession` 结构：
```rust
pub struct TerminalSession {
    pub id: String,
    pub name: Option<String>,
    pub shell_type: String,
    pub current_dir: String,
    pub size: (u16, u16),
    pub running: bool,           // ← 注意：不是 status
    pub created_at: SystemTime,  // ← 注意：不是 last_activity
}
```

前端期望：
```typescript
interface TerminalInfo {
  id: string;
  name?: string;
  shell_type: string;
  current_dir: string;
  status: "Starting" | "Running" | "Paused" | "Stopped";  // ← 需要映射
  created_at: number;
  last_activity: number;  // ← 后端没有此字段
  size: [number, number];
  process_id?: number;
}
```

可以在前端添加映射：
```typescript
const terminals = data.terminals.map(t => ({
  ...t,
  status: t.running ? "Running" : "Stopped",
  last_activity: t.created_at,
}));
setTerminals(terminals);
```

## 修改的文件

1. `app/src/lib.rs`:
   - 添加响应消息 emit: `session-response-{sessionId}`
   - 添加管理消息 emit: `terminal-management-{sessionId}`

2. `src/components/RemoteSessionView.tsx`:
   - 添加 `session-response` 事件监听
   - 添加 `terminal-management` 事件监听
   - 解析响应数据并更新状态

## 测试

1. 启动 CLI 服务器：`cargo run --bin cli -- host`
2. 在 Tauri 应用中连接
3. 打开浏览器开发者工具（F12）
4. 点击"创建终端"
5. 观察控制台输出：
   - ✅ 应该看到 "Received response message"
   - ✅ 应该看到 "Terminal created"
   - ✅ 应该看到 "Setting terminal list"
   - ✅ UI 应该显示新创建的终端

## 下一步

如果仍然看不到终端列表，请：

1. 在浏览器控制台执行：
   ```javascript
   // 检查事件监听器
   console.log("Active listeners:", window.__TAURI__);
   ```

2. 在前端添加更多日志：
   ```typescript
   const setupTerminalEventListeners = async () => {
     console.log("🎧 Setting up event listeners for session:", props.sessionId);
     
     const unlisten1 = await listen(`session-response-${props.sessionId}`, (event: any) => {
       console.log("📨 Received response:", event);
       // ...
     });
     console.log("✅ Registered session-response listener");
     
     // ...
   };
   ```

3. 检查后端是否真的发送了消息：
   在 `app/src/lib.rs` 的消息接收任务中添加日志，确认响应被广播。
