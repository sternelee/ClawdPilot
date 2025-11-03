# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RiTerm is a P2P terminal session sharing tool built with Rust backend and Flutter frontend. It enables real-time collaborative terminal sessions with end-to-end encryption using iroh P2P network and QUIC protocol. The project also includes TCP forwarding capabilities for exposing local services through P2P connections.

## Architecture

This is a multi-platform application with the following components:

### Backend Components (Rust)
- **CLI Tool** (`cli/`) - Command-line interface for hosting terminal sessions
- **Shared Library** (`shared/`) - Core P2P networking and message types
- **Flutter Bridge** (`app/rust/`) - Rust backend that bridges to Flutter via FFI

### Frontend Components
- **Flutter Mobile App** (`app/`) - Cross-platform mobile application
- **Web Interface** (referenced in README) - React-based web interface

## Common Development Commands

### Building the CLI Tool
```bash
cd cli
cargo build --release
```

### Running the CLI Host
```bash
./cli/target/release/cli host
```

### Flutter Development
```bash
cd app
flutter pub get
flutter run
```

### Building Flutter App
```bash
cd app
flutter pub get           # Install dependencies
flutter build apk          # Android
flutter build ios          # iOS
flutter build windows      # Windows
flutter build macos        # macOS
flutter build linux        # Linux
```

### Code Generation (Required for Flutter-Rust Bridge)
```bash
cd app
flutter_rust_bridge_codegen generate \
  --rust-input rust_lib_app \
  --dart-output lib/bridge_generated.dart
```

### Running Development Builds
```bash
# CLI development server
cd cli && cargo run -- host

# Flutter app in development mode
cd app && flutter run
```

### Running Tests
```bash
# Rust tests
cd cli && cargo test
cd shared && cargo test

# Flutter tests
cd app && flutter test
```


## Key Technical Details

### P2P Network Architecture
- Uses iroh P2P library with QUIC protocol for high-performance communication
- End-to-end encryption with ChaCha20Poly1305
- Session tickets contain connection info and encryption keys
- Supports NAT traversal and relay servers
- Unified message protocol for terminal, TCP forwarding, and system control

### Message Types
The system uses a unified message protocol with these main categories:
1. **Terminal Management** - Create, stop, resize, and manage terminal instances
2. **Terminal I/O** - Real-time input/output for terminal sessions
3. **TCP Forwarding** - Create and manage TCP forwarding sessions
4. **TCP Data** - Actual data flow for TCP forwarding connections
5. **System Control** - Session management and system monitoring
6. **Heartbeat** - Connection health monitoring

### Flutter-Rust Integration
- Uses flutter_rust_bridge for FFI communication (version 2.11.1)
- Rust backend in `app/rust/` exposes APIs to Flutter
- Key APIs: IrohClient, message bridge, terminal management functions
- Uses cargokit for cross-platform Rust compilation
- Generated bridge code located in `app/lib/bridge_generated.dart`

### Terminal Management
- `TerminalManager` handles multiple terminal instances
- Supports real terminals with PTY (pseudo-terminal) management using portable-pty
- Cross-platform shell support (bash, zsh, fish, PowerShell, cmd, etc.)
- Real-time bidirectional I/O with low latency

### TCP Forwarding
- High-performance TCP proxy for exposing local services through P2P
- Supports thousands of concurrent connections
- Real-time connection monitoring and traffic statistics
- Session-based resource management and graceful shutdown

## Development Workflow

### Adding New Features
1. **Protocol changes**: Add message types to `shared/src/message_protocol.rs`
2. **CLI changes**: Implement handlers in `cli/src/message_server.rs`
3. **Flutter bridge changes**: Add bridge methods in `app/rust/src/lib.rs`
4. **Code generation**: Run flutter_rust_bridge_codegen after bridge changes
5. **UI changes**: Implement Flutter screens and widgets in `app/lib/`

### Testing P2P Features
1. Start CLI host: `./cli/target/release/cli host`
2. Copy session ticket from host output (base32-encoded string)
3. Use Flutter app to connect via ticket or QR code
4. Test terminal creation and management
5. Test TCP forwarding by exposing local services

### Message Flow
1. Host creates P2P session and generates ticket
2. Client joins session using ticket
3. Messages are encrypted and transmitted via QUIC protocol
4. Terminal I/O and TCP data are routed through P2P network
5. Unified message protocol handles all communication types

## File Structure Notes

### Key Files
- `shared/src/message_protocol.rs` - Core message protocol and type definitions
- `shared/src/quic_server.rs` - QUIC server implementation
- `cli/src/message_server.rs` - CLI message server and terminal/TCP management
- `cli/src/terminal_runner.rs` - Terminal session management and PTY handling
- `app/rust/src/lib.rs` - Flutter bridge API definitions
- `app/rust/src/message_bridge.rs` - Message protocol bridge implementation
- `app/lib/main.dart` - Flutter app entry point
- `app/lib/stores/app_store.dart` - Flutter state management

### Configuration Files
- `Cargo.toml` (root) - Workspace configuration with shared dependencies
- `cli/Cargo.toml` - CLI-specific dependencies
- `shared/Cargo.toml` - Shared library dependencies
- `app/pubspec.yaml` - Flutter dependencies including solidart state management
- `app/rust/Cargo.toml` - Rust bridge dependencies
- `app/rust_builder/` - CargoKit build system for cross-platform compilation

## Debugging and Troubleshooting

### Logs
- CLI logs are written to `logs/` directory
- Use `RUST_LOG=debug` environment variable for verbose logging
- Flutter logs are available through flutter logs

### Common Issues
- P2P connection failures: Check network connectivity and relay settings
- Terminal creation issues: Verify shell paths and permissions
- Flutter bridge errors: Regenerate bridge code after API changes with flutter_rust_bridge_codegen
- CargoKit build issues: Clean build cache and ensure Rust toolchain is up to date
- TCP forwarding problems: Check if local port is available and firewall settings

### Testing Terminal Features
Use the CLI host to create terminals and test the Flutter app's ability to:
- List available terminals
- Create new terminals with different shells
- Send input to terminals and see real-time output
- Resize and stop terminals
- Test multiple concurrent terminal sessions

### Testing TCP Forwarding
Use the Flutter app to test TCP forwarding capabilities:
- Create TCP forwarding sessions for local services
- Monitor connection statistics and data transfer
- Test with different types of local services (web servers, databases, APIs)
- Verify graceful shutdown of forwarding sessions

## Security Considerations

- All P2P communications are end-to-end encrypted with ChaCha20Poly1305
- Session tickets contain sensitive information and should be treated as secrets
- Terminal input/output and TCP data are transmitted securely through the P2P network
- TCP forwarding exposes local services only to connected P2P peers
- No services are exposed to the public internet by default

## Additional Resources

- [TCP Forwarding Examples](TCP_FORWARDING_EXAMPLES.md) - Detailed examples of TCP forwarding usage
- [QUIC Architecture](QUIC_ARCHITECTURE.md) - Technical details about the QUIC implementation
- [docs/](docs/) - Additional technical documentation