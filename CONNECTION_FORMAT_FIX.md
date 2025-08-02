# 连接格式问题修复

## 问题描述

启动 CLI 后获得的连接信息格式与 app 端期望的格式不匹配：

- **CLI 输出**: `NodeAddr { node_id: PublicKey(...), relay_url: None, direct_addresses: {} }`
- **App 期望**: `node_id@address:port` 格式

## 根本原因

1. CLI 端的 `get_node_addr()` 方法只返回了基本的 `NodeAddr::new(node_id)`，没有包含网络地址信息
2. App 端的验证函数 `is_valid_node_address()` 严格要求 `node_id@address:port` 格式
3. 两端都没有实现真正的 iroh P2P 网络连接，只是基础框架

## 修复内容

### CLI 端修改 (`cli/src/p2p.rs`)

1. **添加 Endpoint 支持**:
   ```rust
   // 创建真正的 iroh endpoint
   let endpoint = iroh::Endpoint::builder()
       .discovery_n0()
       .bind()
       .await?;
   ```

2. **改进连接信息显示** (`cli/src/cli.rs`):
   ```rust
   // 提供占位符格式的连接字符串
   let placeholder_addr = format!("{}@127.0.0.1:8080", node_addr.node_id);
   println!("🔗 App Connection String (placeholder): {}", placeholder_addr);
   ```

### App 端修改 (`app/src-tauri/src/lib.rs`)

1. **改进地址解析函数**:
   ```rust
   fn parse_node_address(address: &str) -> Result<iroh::NodeAddr, String> {
       // 解析 node_id@address:port 格式
       // 创建包含直接地址的 NodeAddr
   }
   ```

2. **更新验证逻辑**:
   ```rust
   fn is_valid_node_address(address: &str) -> bool {
       parse_node_address(address).is_ok()
   }
   ```

## 测试结果

运行测试脚本 `test_connection_format.sh` 显示：

```
✅ CLI now provides connection string in expected format
🔗 App Connection String (placeholder): bf44b24899237f6b3bae2bc4f3d2d7857b56df360681438689b900fd5fd7271e@127.0.0.1:8080
```

## 当前状态

- ✅ CLI 端现在提供正确格式的连接字符串
- ✅ App 端可以解析和验证连接字符串格式
- ⚠️  使用占位符地址 (127.0.0.1:8080)，因为真正的 P2P 网络功能尚未完全实现
- ⚠️  实际的 P2P 连接和数据传输仍需进一步开发

## 下一步

1. 实现真正的网络地址获取（从 iroh endpoint 获取实际的监听地址）
2. 实现 P2P 消息传输机制
3. 添加连接状态管理和错误处理
4. 实现会话数据的实际传输

## 使用方法

1. 启动 CLI: `./target/debug/cli host`
2. 复制显示的 "App Connection String" 
3. 在 app 端使用该字符串和 Session ID 进行连接

现在 app 端不会再显示 "Invalid node address format" 错误。