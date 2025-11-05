# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RiTerm** is a P2P terminal session sharing tool built with Rust, SolidJS, and Tauri. It enables real-time terminal collaboration across multiple platforms using iroh's P2P networking with end-to-end encryption.

## Architecture

The project is organized as a Cargo workspace with three main components:

- **cli/** - Command-line interface tool for hosting terminal sessions
- **app/** - Tauri-based multi-platform application (desktop + mobile)
- **shared/** - Common networking and messaging protocols
- **src/** - SolidJS frontend application

### Core Components

1. **P2P Networking** (`shared/src/`)
   - `message_protocol.rs` - Core message types and protocols
   - `quic_server.rs` - QUIC-based server implementation
   - `event_manager.rs` - Event handling and coordination

2. **CLI Tool** (`cli/src/`)
   - `message_server.rs` - Host server for Tauri/mobile connections
   - `terminal_runner.rs` - Terminal session management
   - `shell.rs` - Shell detection and configuration

3. **Tauri App** (`app/src/`)
   - `lib.rs` - Main Tauri backend with session management
   - Terminal creation, input handling, and P2P coordination

4. **Frontend** (`src/`)
   - SolidJS with TypeScript
   - Mobile-first responsive design
   - Terminal UI components using xterm.js

## Development Commands

### Build and Run
```bash
# Build CLI tool
cd cli && cargo build --release

# Run CLI host server
./cli/target/release/cli host

# Build Tauri app
npm run tauri build

# Development mode
npm run tauri dev

# Build frontend only
npm run build

# Development server
npm run dev
```

### Mobile Development
```bash
# Android development
npm run tauri android dev

# Build Android APK
npm run tauri android build

# iOS development (macOS only)
npm run tauri ios dev
```

### Testing
```bash
# Rust tests
cargo test

# Run from workspace root
cargo test --workspace
```

## Key Technical Details

### Message System
The project uses a structured message system with `TerminalCommand` and `TerminalResponse` types for terminal operations, replacing the previous free-form messaging approach.

### Session Management
- Sessions support up to 50 concurrent connections
- Event buffering limits (5000 events per session)
- Automatic cleanup of inactive sessions
- Memory management with periodic cleanup tasks

### P2P Architecture
- Uses iroh for P2P networking with NAT traversal
- ChaCha20Poly1305 end-to-end encryption
- Session tickets for connection sharing
- No central server required

### Terminal Support
- Cross-platform shell detection (Zsh, Bash, Fish, Nushell, PowerShell)
- Real-time terminal output streaming
- Terminal creation, resizing, and management
- Mobile-optimized terminal interface

## Configuration Files

- `Cargo.toml` - Workspace configuration with shared dependencies
- `package.json` - Frontend dependencies and build scripts
- `app/tauri.conf.json` - Tauri application configuration
- `app/capabilities/` - Platform-specific permission configurations

## Development Notes

- The codebase uses conditional compilation for mobile vs desktop features
- Performance optimizations include event batching and memory limits
- Logging levels are adjusted based on build configuration (debug vs release)
- Mobile apps include gesture controls and adaptive layouts

## Build Targets

- CLI: `cli/target/release/cli`
- Desktop: `src-tauri/target/release/bundle/`
- Mobile: Generated in `app/gen/android/` and `app/gen/apple/`
