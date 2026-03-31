# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClawdPilot** is a multi-agent local/remote management platform built with Rust (CLI/backend), SolidJS (frontend), and Tauri 2 (desktop/mobile). It provides unified session management for running and controlling multiple AI agents (Claude, Codex, Gemini, OpenCode, OpenClaw) across local and remote modes.

## Repository Structure

```
cli/      # CLI binary (clawdpilot host) - P2P server for remote connections
app/      # Tauri 2 backend - exposes commands to frontend, manages QUIC client
shared/   # Core library - P2P networking (iroh), message protocol, agent management
browser/  # WebAssembly client (Edition 2021)
src/      # SolidJS frontend - Vite + Tailwind CSS v4 + DaisyUI + Kobalte
web/      # Cloudflare Workers SSR app (TanStack Start) - separate pnpm workspace
```

## Architecture

### P2P Networking (iroh QUIC)

Remote agent management uses `iroh` for P2P QUIC connections with NAT traversal:
- **Server**: `cli host` (`shared/src/quic_server.rs`)
- **Client**: Tauri app (`shared/src/quic_client.rs`)
- Connections use tickets (base64: node ID + relay URL + ALPN)
- Auto-reconnect with exponential backoff for mobile stability

### Message Protocol

Unified bincode-serialized protocol in `shared/src/message_protocol.rs`. Key types:
- `AgentSession`: Start/stop sessions
- `AgentMessage`: Text and tool messages
- `AgentPermission`: Tool execution requests/responses
- `AgentControl`: Interrupt or modify agent behavior
- `TcpForwarding`/`TcpData`: Port forwarding

### Event Manager

`EventManager` (`shared/src/event_manager.rs`) provides a unified event bus. Components implement `EventListener` for async event handling.

### Agent Management

`AgentManager` (`shared/src/agent/mod.rs`) wraps AI subprocesses via `SessionKind`:
- **ACP** (`acp.rs`): Agent Client Protocol (Claude, Codex, Gemini, OpenCode)
- **OpenClaw** (`openclaw_ws.rs`): WebSocket Gateway connection

## Frontend Architecture (SolidJS)

Uses SolidJS reactivity (`createSignal`, `createStore`) - avoid React patterns like `useEffect`.

### Key Stores
- `sessionStore.ts`: Agent sessions, connection state, tickets
- `chatStore.ts`: Message history, tool calls, permission requests per session
- `sessionEventRouter.ts`: Centralizes Tauri event listeners (`"agent-message"`, `"local-agent-event"`), routes to session components, prevents memory leaks in multi-session environment

### Styling
- Tailwind CSS v4 via `@tailwindcss/vite`
- `@kobalte/core` for headless accessible UI components
- DaisyUI themes: `light`, `dark` (via `[data-theme]` attribute)
- HSL CSS variables in `tailwind.config.js` (`--primary`, `--background`, etc.)
- Use `cn()` from `~/lib/utils` for conditional class merging

## Development Commands

**Prerequisites:** Rust stable, Node.js 20+, pnpm 10+.

```bash
# Frontend
pnpm install               # Install dependencies
pnpm dev                   # Vite dev server (localhost:1420)
pnpm build                 # Production build
pnpm tsc                   # TypeScript check

# Tauri Desktop/Mobile
pnpm tauri:dev             # Desktop app with hot reload
pnpm tauri:build           # Build desktop app
pnpm tauri:android:dev     # Android dev build (macOS)
pnpm tauri:ios:dev         # iOS dev build (macOS only)

# CLI
cargo run -p cli -- host   # Run CLI host (prints QR code/ticket)
cargo run -p cli -- host --daemon  # Background mode (Unix only)
cargo build -p cli --release

# Testing
cargo test --workspace                 # All Rust tests
cargo test -p shared acp               # Specific module tests
cargo test -- --nocapture              # Show stdout/stderr
./test_ticket_output.sh                # CLI ticket verification

# Linting & Formatting
cargo fmt --all
cargo clippy --workspace -- -D warnings
pnpm exec prettier --write "src/**/*.{ts,tsx}"
```

**Pre-commit check:** `cargo fmt --all && cargo clippy --workspace -- -D warnings && pnpm tsc`

### Web App (Cloudflare Workers)

```bash
cd web && pnpm install
cd web && pnpm dev         # Dev server on port 3000
cd web && pnpm build       # Production build
cd web && pnpm deploy      # Deploy to Cloudflare
```

## Coding Conventions

Detailed frontend conventions are in `AGENTS.md`.

### Rust (Edition 2024)
- Use `anyhow::Result<T>` with `.with_context(|| "...")?` for error context
- Avoid `.unwrap()`/`.expect()` in non-test code
- Use `tokio` with `Arc<RwLock<T>>` or `Arc<Mutex<T>>`; prefer `std::sync::Mutex` for hot-path fields
- Use `tracing` macros (`info!`, `debug!`, `error!`, `warn!`) - no `println!` in production

### TypeScript / SolidJS
- Strict mode; no implicit/explicit `any`
- Define explicit interfaces for component props
- Use `~` alias for src imports (e.g., `~/components/ui/Button`)
- Three-section component structure: `// Types`, `// Variant Classes`, `// Component`

### Mobile vs Desktop (Tauri)

The `app/Cargo.toml` configures different dependencies:
- **Desktop** (`cfg(not(any(target_os = "android", target_os = "ios")))`): Full agent support with ACP, portable-pty, shell plugin
- **Mobile** (`cfg(any(target_os = "android", target_os = "ios"))`): Lightweight build excludes heavy agent dependencies, uses barcode-scanner plugin

## Agent Permissions

`PermissionHandler` (`shared/src/agent/permission_handler.rs`) manages automatic approval based on `PermissionMode`:
- `AlwaysAsk`, `AcceptEdits`, `Plan`, `AutoApprove`

Frontend uses Tauri commands `approve_permission`/`deny_permission`, updates via `chatStore` and `PermissionCard`.

## Adding a New Agent

1. Add to `AgentType` enum in `shared/src/message_protocol.rs`
2. Configure launch in `shared/src/agent/factory.rs`
3. Add session handling in `shared/src/agent/mod.rs` (`start_session_with_id`)
4. For ACP agents: create parser in `shared/src/agent/` (e.g., `gemini.rs`)
5. Expose commands in `app/src/lib.rs`
6. Update `sessionStore.ts` and UI

## Release Process

Releases are triggered by version tags:

```bash
git tag v0.3.7
git push origin v0.3.7
```

Workflow (`.github/workflows/publish-to-auto-release.yml`):
- Tauri app packaging via `tauri-apps/tauri-action`
- CLI artifacts published as `clawdpilot_cli-*`

Android release builds require GitHub secrets: `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_BASE64`.
