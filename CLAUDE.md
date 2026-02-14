# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RiTerm** is a P2P AI agent remote management tool with a chat-centric UI. It enables remote control of AI coding agents (Claude Code, OpenCode, Gemini CLI, GitHub Copilot, Qwen Code, etc.) through a Tauri-based multi-platform application. The system uses iroh's P2P networking with end-to-end encryption for secure remote access. The project supports both Chinese and English users.

## Architecture

The project is organized as a Cargo workspace with four main components:

- **cli/** - CLI host server that manages AI agent sessions and handles P2P communication
- **app/** - Tauri-based multi-platform application (desktop + mobile) with chat UI
- **shared/** - Common networking and messaging protocols
- **browser/** - Web browser client implementation (WebAssembly)
- **src/** - SolidJS frontend application with chat-centric UI

### Core Components

1. **P2P Networking** (`shared/src/`)
   - `message_protocol.rs` - Core message types including AgentMessage, AgentSession, AgentControl, etc.
   - `quic_server.rs` - QUIC-based server implementation
   - `event_manager.rs` - Event handling and coordination
   - `browser.rs` - Browser-specific P2P implementation (WASM)

2. **CLI Tool** (`cli/src/`)
   - `message_server.rs` - Host server with MessageHandler implementations for agent messages
   - `agent_wrapper/` - AI agent management module:
     - `mod.rs` - AgentManager for session lifecycle
     - `factory.rs` - AgentFactory for creating agent instances
     - `claude.rs`, `opencode.rs`, `gemini.rs`, `copilot.rs`, `qwen.rs`, `codex.rs` - Agent-specific output parsers
     - `claude_streaming.rs`, `generic_streaming.rs` - Streaming session implementations
     - `events.rs` - AgentTurnEvent for event broadcasting
   - `command_router.rs` - Slash command parsing and routing (RiTerm builtins vs agent passthrough)
   - `main.rs` - CLI entry point with `host` subcommand

3. **Tauri App** (`app/src/`)
   - `lib.rs` - Main Tauri backend with agent session management and Tauri commands
   - `tcp_forwarding.rs` - TCP forwarding session management
   - `main.rs` - Tauri application entry point
   - Agent session coordination and P2P message routing

4. **Frontend** (`src/`)
   - **SolidJS Start** (`@solidjs/start`) with Vinxi build tool
   - File-based routing with `src/routes/` directory
   - Entry points: `src/app.tsx` (root), `src/entry-client.tsx`, `src/entry-server.tsx`
   - **Chat-centric UI** with `ChatView.tsx` as the main interface
   - Stores: `sessionStore.ts` (agent sessions), `chatStore.ts` (messages, permissions)
   - Components: `ChatView.tsx`, `HomeView.tsx`, `SettingsModal.tsx`
   - Mobile-first responsive design with DaisyUI styling

## Development Commands

### Build and Run

```bash
# Build CLI tool
cd cli && cargo build --release

# Run CLI host server (manages AI agents)
./cli/target/release/cli host

# Build Tauri app
pnpm tauri:build

# Development mode (full app with hot reload)
pnpm tauri:dev

# Build frontend only (Vinxi build to .output/public)
pnpm build

# Development server (Vinxi dev server on localhost:1420)
pnpm dev

# Type checking
pnpm tsc
```

### Mobile Development

```bash
# Android development
pnpm tauri:android:dev

# Build Android APK
pnpm tauri:android:build

# iOS development (macOS only)
pnpm tauri:ios:dev

# View iOS device logs (macOS)
idevicesyslog | grep RiTerm
```

### Testing

```bash
# Rust tests
cargo test

# Run from workspace root
cargo test --workspace

# Test specific components
cd cli && cargo test
cd shared && cargo test
cd app && cargo test
cd browser && cargo test
```

### Code Quality

```bash
# TypeScript type checking
pnpm tsc

# Rust compilation check
cargo check

# Rust formatting
cargo fmt

# Rust linting
cargo clippy
```

**Package Manager**: The project specifies `pnpm@10.28.2` as the package manager in `package.json`.

## Key Technical Details

### Supported AI Agents

| Agent | Type Enum | Command |
|-------|-----------|---------|
| Claude Code | `ClaudeCode` | `claude` |
| OpenCode | `OpenCode` | `opencode` |
| Gemini CLI | `Gemini` | `gemini` |
| GitHub Copilot | `Copilot` | `gh copilot` |
| Qwen Code | `Qwen` | `qwen-agent` |
| OpenAI Codex | `Codex` | `codex` |
| Custom | `Custom` | configurable |

### Message Protocol Architecture

The project implements a unified message system through `shared/src/message_protocol.rs`:

- **Message Struct**: Central message type with structured payload and routing
- **MessageType Enum**: AgentSession, AgentMessage, AgentControl, AgentPermission, AgentMetadata, etc.
- **MessageHandler Trait**: Extensible handler system for different message types
- **Serialization**: Uses bincode for efficient network serialization

**Key Message Types:**

- `AgentSession` - Session registration, status updates, listing
- `AgentMessage` - User messages, AI responses, tool calls, notifications
- `AgentControl` - Pause, resume, terminate, send input, interrupt
- `AgentPermission` - Permission requests and responses
- `AgentMetadata` - Todos, summary, available tools, slash commands

**Message Flow:**

1. Frontend (ChatView) → Tauri invoke → P2P Network → CLI Host
2. CLI's AgentManager processes message and forwards to AI agent subprocess
3. Agent output is parsed and streamed back via AgentTurnEvent
4. Events are broadcast to frontend via Tauri events (`agent-message`)

**Important**: The frontend uses **SolidJS**, not React. SolidJS has fine-grained reactivity, distinct from React's component model.

### AI Agent Wrapper System (`cli/src/agent_wrapper/`)

The agent wrapper module manages AI coding agent subprocesses:

- **AgentManager** (`mod.rs`) - Session lifecycle, message routing, metadata management
- **StreamingAgentSession** trait - Common interface for streaming sessions
- **ClaudeStreamingSession** (`claude_streaming.rs`) - Claude Code specific streaming
- **GenericStreamingSession** (`generic_streaming.rs`) - Generic adapter for other agents
- **Output Parsers** (`claude.rs`, `opencode.rs`, etc.) - Regex-based parsing of agent stdout

### Slash Command System (`cli/src/command_router.rs`)

Commands are routed based on type:

**RiTerm Builtins:** `/list`, `/spawn`, `/stop`, `/quit`, `/approve`, `/deny`, `/help`

**Agent Passthrough:** All other commands are forwarded to the AI agent (e.g., `/plugin`, `/compact`, `/sessions`)

### Session and Connection Management

- **Session Tickets**: Uses iroh-tickets (base64-encoded NodeAddr) for P2P connection sharing
- **Concurrent Connections**: Up to 50 simultaneous participants per session
- **Event Buffering**: 5000 event limit with automatic cleanup
- **Session Recovery**: Automatic reconnection after network interruptions

### Frontend Architecture

- **@solidjs/start Framework**: Modern SSR-ready architecture with file-based routing
- **Chat-centric UI**: `ChatView.tsx` as the main interface for agent interactions
- **Stores**: `sessionStore.ts` (agent sessions), `chatStore.ts` (messages, permissions)
- **Mobile-first**: Responsive layouts with DaisyUI styling
- **Real-time Updates**: Reactive UI using SolidJS fine-grained reactivity

## Configuration Files

- `Cargo.toml` - Workspace configuration with shared dependencies and build profiles
- `package.json` - Frontend dependencies and build scripts, specifies pnpm@10.28.2
- `app/tauri.conf.json` - Tauri application configuration (devUrl: localhost:1420)
- `app/capabilities/` - Platform-specific permission configurations
- `app.config.ts` - @solidjs/start configuration with Vinxi build tool

## Dependencies

### Core Rust Dependencies

- **iroh** (0.95) - P2P networking with NAT traversal and QUIC protocol
- **tokio** (1.47) - Async runtime with full features
- **tauri** (2) - Cross-platform desktop/mobile framework
- **bincode** (1.3) - Binary serialization for message protocol
- **chacha20poly1305** (0.10) - End-to-end encryption

### Frontend Dependencies

- **solid-js** (1.9.11) - Reactive UI framework (SolidJS, not React)
- **@solidjs/start** (1.2.1) - Modern SolidJS framework with SSR support
- **vinxi** (0.5.11) - Build tool wrapping Vite
- **daisyui** (5.5.14) - TailwindCSS component library

## Common Development Patterns

### Adding New Agent Features

1. Define message types in `shared/src/message_protocol.rs`
2. Implement CLI handlers in `cli/src/message_server.rs`
3. Add agent wrapper logic in `cli/src/agent_wrapper/`
4. Add Tauri commands in `app/src/lib.rs`
5. Update frontend stores and `ChatView.tsx`

### Adding Slash Commands

1. Add command to `command_router.rs` (RiTerm builtin or agent passthrough)
2. Implement handler in `message_server.rs` if it's a builtin
3. Update frontend to handle command responses

### Mobile Development Tips

- Test with both Android and iOS when possible
- Consider touch targets and gesture handling
- Use conditional compilation for platform-specific features
- iOS device logs: `idevicesyslog | grep RiTerm`

### Session Management

- Always handle session cleanup in component unmount effects
- Monitor event count to stay within buffer limits
- Implement proper error handling for network interruptions

## Internationalization

- The project supports both Chinese and English users
- README.md contains comprehensive Chinese documentation
- Error messages and logs may include Chinese content
