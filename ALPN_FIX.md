# ALPN 协议修复

## 问题描述

连接失败，错误信息：
```
Failed to connect to server: Failed to connect to node PublicKey(...): 
aborted by peer: the cryptographic handshake failed: error 120: 
peer doesn't support any known protocol
```

## 根本原因

这是一个 **ALPN (Application-Layer Protocol Negotiation)** 协议不匹配的问题。

- **客户端**：在连接时指定了 ALPN 协议 `b"com.riterm.messages/1"`
- **服务器端**：创建 endpoint 时没有声明支持任何 ALPN 协议

在 TLS/QUIC 握手过程中，客户端和服务器必须协商一个双方都支持的应用层协议。如果服务器没有声明支持客户端请求的 ALPN，连接就会失败。

## 修复方案

在创建 iroh `Endpoint` 时，必须使用 `.alpns()` 方法声明支持的 ALPN 协议列表。

### 修复前（错误）

```rust
// 服务器端 - 没有声明 ALPN
let endpoint = Endpoint::builder()
    .discovery(DnsDiscovery::n0_dns())
    .bind()
    .await?;

// 客户端 - 也没有声明 ALPN
let endpoint = Endpoint::builder()
    .discovery(DnsDiscovery::n0_dns())
    .bind()
    .await?;

// 连接时使用 ALPN - 但服务器不支持！
connection.connect(node_addr, QUIC_MESSAGE_ALPN).await?;
```

### 修复后（正确）

```rust
// 服务器端 - 声明支持的 ALPN
let endpoint = Endpoint::builder()
    .alpns(vec![QUIC_MESSAGE_ALPN.to_vec()])
    .discovery(DnsDiscovery::n0_dns())
    .bind()
    .await?;

// 客户端 - 也声明支持的 ALPN
let endpoint = Endpoint::builder()
    .alpns(vec![QUIC_MESSAGE_ALPN.to_vec()])
    .discovery(DnsDiscovery::n0_dns())
    .bind()
    .await?;

// 连接时使用 ALPN - 现在双方都支持了！
connection.connect(node_addr, QUIC_MESSAGE_ALPN).await?;
```

## 修改的文件

- `shared/src/quic_server.rs`:
  - `QuicMessageServer::new()` - 服务器端 endpoint 创建
  - `QuicMessageClient::new()` - 客户端 endpoint 创建

## ALPN 协议标识符

```rust
pub const QUIC_MESSAGE_ALPN: &[u8] = b"com.riterm.messages/1";
```

这个标识符用于：
1. 区分不同的应用协议
2. 确保客户端和服务器使用相同的消息格式
3. 在 QUIC 握手时进行协议协商

## 参考

参考了 dumbpipe (iroh 0.93) 的实现：
```rust
let endpoint = Endpoint::builder()
    .secret_key(secret_key)
    .alpns(alpns)  // ← 关键：必须设置 ALPN
    .bind()
    .await?;
```

## 测试

修复后，客户端应该能够成功连接到服务器：

1. 启动 CLI 服务器：`./cli/target/release/cli host`
2. 复制生成的 ticket
3. 在 Tauri 应用中使用 ticket 连接
4. 连接应该成功，不再出现 "peer doesn't support any known protocol" 错误

## 学习要点

在使用 iroh 0.93 时：
- ✅ **必须**在 `Endpoint::builder()` 时使用 `.alpns()` 声明支持的协议
- ✅ **必须**确保客户端和服务器使用相同的 ALPN 标识符
- ✅ 连接时使用的 ALPN 必须在 endpoint 创建时已经声明

这是 iroh P2P 网络中应用层协议协商的标准做法。
