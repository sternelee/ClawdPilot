# RiTerm TCP Forwarding

RiTerm provides powerful TCP forwarding capabilities inspired by [dumbpipe](https://github.com/n0-computer/dumbpipe), allowing you to expose local services through P2P connections or access remote services securely.

## Overview

RiTerm's TCP forwarding supports two main modes:

1. **Listen to Remote**: Expose a local service to remote clients through P2P
2. **Connect to Remote**: Access a remote service locally through P2P tunnel

This is similar to SSH port forwarding but works over P2P connections with automatic NAT traversal and end-to-end encryption.

## Architecture

The TCP forwarding system consists of:

- **TCP Forwarding Manager** (`shared/src/tcp_forwarding.rs`): Core forwarding logic
- **Message Protocol** (`shared/src/message_protocol.rs`): Communication between CLI and Flutter
- **CLI Server** (`cli/src/message_server.rs`): Handles forwarding requests and manages connections
- **Flutter Bridge** (`app/rust/src/message_bridge.rs`): Provides Flutter API for TCP forwarding

## Usage Examples

### 1. Expose Local Web Server (Listen to Remote)

**CLI Side:**
```bash
# Start the CLI host server
./cli/target/release/cli host
```

The CLI will output a connection ticket like:
```
🎫 Connection Ticket:
┌─────────────────────────────────────────────────────────────┐
│ ticket:PMRGC3DQNYRDUITSNF2GK4TNL5YXK2LDEIWCEY3SMVQXIZLEL5QXI...
└─────────────────────────────────────────────────────────────┘
```

**Flutter App:**
```dart
// Connect to CLI using ticket
String sessionId = await RustLib.api.crateMessageBridgeConnectByTicket(
  client: flutterClient,
  ticket: "ticket:PMRGC3DQNYRDUITSNF2GK4TNL5YXK2LDEIWCEY3SMVQXIZLEL5QXI..."
);

// Create TCP forwarding session to expose local port 3000
String tcpSessionId = await RustLib.api.crateMessageBridgeCreateTcpForwardingSession(
  client: flutterClient,
  sessionId: sessionId,
  localAddr: "127.0.0.1:3000",
  remoteHost: null,  // Local service
  remotePort: null,   // Local service
  forwardingType: "ListenToRemote"
);
```

**Result:**
- Remote clients can connect to your local service through the P2P tunnel
- Perfect for sharing development servers, APIs, or any local service

### 2. Access Remote SSH Server (Connect to Remote)

**CLI Side:**
```bash
# Start CLI host with the SSH server
./cli/target/release/cli host
```

**Flutter App:**
```dart
// Connect to CLI using ticket
String sessionId = await RustLib.api.crateMessageBridgeConnectByTicket(
  client: flutterClient,
  ticket: "ticket:PMRGC3DQNYRDUITSNF2GK4TNL5YXK2LDEIWCEY3SMVQXIZLEL5QXI..."
);

// Create TCP forwarding session to access remote SSH
String tcpSessionId = await RustLib.api.crateMessageBridgeCreateTcpForwardingSession(
  client: flutterClient,
  sessionId: sessionId,
  localAddr: "127.0.0.1:2222",  // Local port
  remoteHost: "remote-server.com",
  remotePort: 22,  // SSH port
  forwardingType: "ConnectToRemote"
);
```

**Result:**
- You can SSH to `ssh user@127.0.0.1 -p 2222` to connect to the remote SSH server
- All traffic is encrypted and routed through the P2P tunnel

### 3. Forward Multiple Services

```dart
// Forward web server
String webSession = await RustLib.api.crateMessageBridgeCreateTcpForwardingSession(
  client: flutterClient,
  sessionId: sessionId,
  localAddr: "127.0.0.1:3000",
  remoteHost: null,
  remotePort: null,
  forwardingType: "ListenToRemote"
);

// Forward database
String dbSession = await RustLib.api.crateMessageBridgeCreateTcpForwardingSession(
  client: flutterClient,
  sessionId: sessionId,
  localAddr: "127.0.0.1:5432",
  remoteHost: "database.example.com",
  remotePort: 5432,
  forwardingType: "ConnectToRemote"
);
```

## Advanced Features

### Connection Monitoring

```dart
// List all active TCP forwarding sessions
List<FlutterTcpForwardingSession> sessions =
    await RustLib.api.crateMessageBridgeGetTcpForwardingSessions(
      client: flutterClient,
      sessionId: sessionId
    );

for (var session in sessions) {
  print('Session: ${session.id}');
  print('Local: ${session.localAddr}');
  print('Remote: ${session.remoteEndpoint}');
  print('Connections: ${session.activeConnections}');
  print('Bytes sent: ${session.bytesSent}');
  print('Bytes received: ${session.bytesReceived}');
}
```

### Session Management

```dart
// Stop a specific TCP forwarding session
await RustLib.api.crateMessageBridgeStopTcpForwardingSession(
  client: flutterClient,
  sessionId: sessionId,
  tcpSessionId: tcpSessionId
);

// Disconnect from CLI server
await RustLib.api.crateMessageBridgeDisconnectFromCliServer(
  client: flutterClient,
  sessionId: sessionId
);
```

## Security Features

- **End-to-End Encryption**: All traffic is encrypted using TLS
- **NAT Traversal**: Automatic hole punching when possible
- **Relay Fallback**: Uses relay servers when direct connection fails
- **Ticket-Based Authentication**: Secure connection tickets prevent unauthorized access

## Performance Considerations

- **Connection Limits**: Default maximum of 50 concurrent connections
- **Buffer Sizes**: 8KB buffers for optimal throughput
- **Async I/O**: Non-blocking operations for high performance
- **Connection Pooling**: Efficient connection management

## Comparison with SSH Port Forwarding

| Feature | RiTerm TCP Forwarding | SSH Port Forwarding |
|---------|---------------------|-------------------|
| P2P Connectivity | ✅ | ❌ |
| NAT Traversal | ✅ | ❌ |
| Mobile-Friendly | ✅ | Limited |
| Ticket-Based | ✅ | ❌ |
| End-to-End Encryption | ✅ | ✅ |
| Multiple Sessions | ✅ | ✅ |
| Connection Monitoring | ✅ | Limited |

## Troubleshooting

### Connection Issues

1. **Check Network Connectivity**:
   ```dart
   // Verify connection status
   List<FlutterSession> sessions = await RustLib.api.crateMessageBridgeGetActiveSessions(
     client: flutterClient
   );
   ```

2. **Validate Address Formats**:
   - Local addresses: `"127.0.0.1:3000"` or `"0.0.0.0:8080"`
   - Remote hosts: `"example.com"` or `"192.168.1.100"`
   - Ports: `1-65535`

3. **Check Firewall Settings**:
   - Ensure local ports are not blocked
   - Verify outbound connections are allowed

### Performance Issues

1. **Monitor Connection Statistics**:
   ```dart
   List<FlutterTcpForwardingSession> sessions =
       await RustLib.api.crateMessageBridgeGetTcpForwardingSessions(
         client: flutterClient,
         sessionId: sessionId
       );

   for (var session in sessions) {
     print('Throughput: ${session.bytesSent + session.bytesReceived} bytes');
     print('Active connections: ${session.activeConnections}');
   }
   ```

2. **Optimize Buffer Sizes**:
   - Default 8KB buffers work well for most use cases
   - Larger buffers may help for high-bandwidth applications

## API Reference

### TcpForwardingType

```dart
enum TcpForwardingType {
  ListenToRemote,  // Expose local service to remote clients
  ConnectToRemote  // Access remote service locally
}
```

### FlutterTcpForwardingSession

```dart
class FlutterTcpForwardingSession {
  String id;
  String localAddr;
  String remoteEndpoint;
  String forwardingType;
  int activeConnections;
  int bytesSent;
  int bytesReceived;
  int createdAt;
}
```

### Key Functions

- `createTcpForwardingSession()`: Create a new TCP forwarding session
- `stopTcpForwardingSession()`: Stop an existing session
- `getTcpForwardingSessions()`: List all active sessions
- `formatForwardingType()`: Convert enum to string

## Examples

See the complete demo in `examples/tcp_forwarding_demo.rs` for a working example of all TCP forwarding features.

## Best Practices

1. **Use Meaningful Local Addresses**: Choose local ports that don't conflict with existing services
2. **Monitor Sessions**: Regularly check session status and statistics
3. **Clean Up Resources**: Always stop sessions when done to free resources
4. **Error Handling**: Implement proper error handling for network issues
5. **Security**: Only share tickets with trusted recipients

## Limitations

- **Protocol Support**: Currently supports TCP only (UDP planned)
- **Throughput**: Limited by P2P connection speed
- **Concurrent Connections**: Default limit of 50 connections per session
- **Platform Support**: Works on all major platforms with networking capabilities