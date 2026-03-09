# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClawdPilot** (directory: `riterm`) is a multi-agent local/remote management platform built with Rust (CLI/backend), SolidJS (frontend), and Tauri 2 (desktop/mobile). It provides unified session management for running and controlling multiple AI agents (Claude, Codex, Gemini, OpenCode, OpenClaw) across local and remote modes.

## Project Naming

- **Product**: ClawdPilot
- **CLI crate**: `cli` (binary name: `cli`, command: `clawdpilot`)
- **Tauri app crate**: `app` (lib name: `clawdpilot`)
- **Directory**: `riterm` (repository root)
- **Frontend**: SolidJS (not React)

## Architecture

### Cargo Workspace Structure

| Crate | Edition | Purpose |
|-------|---------|---------|
| **cli/** | 2024 | CLI binary — `clawdpilot host` subcommand only |
| **shared/** | 2024 | P2P networking, message protocol, QUIC server, event manager, agent protocols |
| **app/** | 2024 | Tauri 2 desktop+mobile backend — Tauri commands, P2P client, TCP forwarding |
| **browser/** | 2021 | WebAssembly browser client |

The `web/` directory is a separate Cloudflare Workers web application with its own pnpm workspace (not part of the Cargo workspace).

### Data Directories

| Path | Purpose |
|------|---------|
| `~/.config/clawdpilot/agents.json` | Agent command overrides |
| `./clawdchat_secret_key` | CLI P2P secret key (in working directory) |
| `./logs/clawdpilot-cli.log` | CLI logs (in working directory) |

### Agent Configuration

Override agent commands/args/env in `~/.config/clawdpilot/agents.json` (or `~/.clawdpilot/agents.json`):

```json
{
  "agents": {
    "claude": { "command": "claude-agent-acp", "args": [], "env": {} },
    "codex": { "command": "codex-acp", "args": [], "env": {} },
    "gemini": { "command": "gemini", "args": ["--experimental-acp"], "env": { "GEMINI_API_KEY": "..." } }
  }
}
```

If an agent binary is not found at session start, `AgentManager` attempts auto-install via `pnpm`, `npm`, `bun`, or `yarn` (see `try_install_package` in `shared/src/agent/mod.rs`).

### Frontend Stack

- **SolidJS** with Vite + vite-plugin-solid
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **@kobalte/core** — headless UI primitives (Accordion, Dialog, Combobox, etc.)
- **tailwindcss-animate** — animation utilities
- Design system uses HSL CSS variables (ShadCN/Kobalte-style, configured in `tailwind.config.js`)
- Path alias: `~` → `./src/` (configured in `vite.config.ts` and `tsconfig.json`)
- Custom `fix-cjs-modules` Vite plugin in `plugins/fix-cjs-modules.ts` for solid-markdown CJS compatibility

### Message Flow

```
Frontend (ChatView.tsx) → Tauri invoke → P2P (QUIC/iroh) → CLI Host
  → AgentManager → SessionKind → AI agent subprocess
  → AgentTurnEvent broadcast → Tauri event ("agent-message") → Frontend
```

### Multi-Session Event Routing

The `sessionEventRouter.ts` provides centralized event management for concurrent sessions:
- Single global listener per event type (not per ChatView instance)
- Routes events to correct session handlers by sessionId
- Tracks streaming state and unread indicators per session
- Active session is exempt from unread notifications
- `removeSession()` cleans up handler sets and streaming state to prevent memory leaks

### QUIC Connection Health & Auto-Reconnect

The `QuicMessageClientHandle` implements connection health monitoring for mobile stability:

- **Health monitor** (`start_health_monitor`): 15-second heartbeat probes via bi-directional QUIC streams. After 2 consecutive failures, triggers reconnection.
- **Auto-reconnect** (`attempt_reconnect`): Exponential backoff (2^n * 2s, capped at 30s). Broadcasts synthetic heartbeat messages with status `"reconnecting"` / `"connected"` through the existing `broadcast::channel`.
- **Connection state flow**: `connected` → `connection_lost` → `reconnecting` → `connected` (or back to `connection_lost`). States are signaled via `MessageBuilder::heartbeat("system", 0, status)`.
- **Lock-free sends**: `send_message_to_server` reads from `server_connections: Arc<RwLock<...>>` directly, bypassing the client `Mutex`. I/O happens outside any lock.
- **Bounded reads**: All stream reads use 16 MiB cap + 30s timeout (prevents OOM from malformed peers).
- **Mobile keys**: Mobile platforms use persistent secret keys stored in `app_data_dir/clawdchat_app_secret_key` for session resumption across app restarts.
- **Endpoint readiness**: `endpoint.online().await` is called after endpoint creation to ensure relay registration and NAT traversal are complete before connecting.

### Connection State (Frontend)

```
ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error"
```

- Backend emits `"connection-state-changed"` Tauri events with `{ sessionId, state }` payload
- `sessionStore` manages state transitions; `App.tsx` listens and updates UI
- `handleRemoteConnect` guards against duplicate concurrent calls via `isConnecting` check

### Session Cleanup

- **Server-side** (`QuicMessageServer`): `cleanup_inactive_connections()` removes connections idle beyond a timeout. `shutdown()` gracefully closes all connections with `connection.close()` before dropping.
- **Client-side** (`app/src/lib.rs`): Background cleanup task runs every 5 minutes, evicts sessions with no activity for 30+ minutes via `CancellationToken`.
- **Frontend**: `sessionStore.removeSession()` calls `sessionEventRouter.removeSession()` to clean up handler maps and streaming state.

### Message Protocol (`shared/src/message_protocol.rs`)

Central `Message` struct with `MessageType` discriminator:
- `AgentSession` - AI agent session management
- `AgentMessage` - User <-> AI messages
- `AgentPermission` - Permission requests/responses
- `AgentControl` - Control messages (interrupt, shutdown)
- `AgentMetadata` - State updates
- `FileBrowser`, `GitStatus`, `RemoteSpawn`, `Notification`, `SlashCommand`, etc.

Serialized with bincode. `MessageHandler` trait for extensible dispatch.

### Agent Session Protocols

The `shared/src/agent/` module manages AI agent subprocesses via two session protocols:

- **`SessionKind::Acp`** (`acp.rs`) — External agents via Agent Client Protocol (ACP)
- **`SessionKind::OpenClawWs`** (`openclaw_ws.rs`) — OpenClaw agent using WebSocket Gateway

`AgentManager` routes to the correct protocol based on `AgentType`. Both implement a common interface: `send_message`, `interrupt`, `subscribe`, `get_pending_permissions`, `respond_to_permission`, `shutdown`.

Session recovery uses ACP's built-in `resume_session()` feature.

## Supported AI Agents

| Agent | AgentType enum | Protocol | Default Command |
|-------|---------------|----------|-----------------|
| Claude Agent | `ClaudeCode` | ACP | `claude-agent-acp` |
| OpenCode | `OpenCode` | ACP | `opencode` |
| OpenAI Codex | `Codex` | ACP | `codex-acp` |
| Gemini CLI | `Gemini` | ACP | `gemini` |
| OpenClaw | `OpenClaw` | WebSocket Gateway | `openclaw gateway` |

## Development Commands

### Frontend Development

```bash
pnpm install              # Install dependencies
pnpm dev                  # Frontend dev server (Vite, localhost:1420)
pnpm tauri:dev            # Full Tauri app with hot reload
pnpm build                # Build frontend → dist/
pnpm tauri:build          # Build Tauri app bundle
pnpm tsc                  # TypeScript type checking
```

### Rust Development

```bash
cargo build -p cli --release    # Build CLI binary → target/release/cli
./target/release/cli host       # Run CLI (prints QR code for mobile connection)

cargo check                             # Quick compilation check
cargo test --workspace                  # Run all tests
cargo test -p cli <test_name>           # Single test in a crate
cargo test --workspace -- --nocapture   # Tests with stdout
cargo fmt --all                         # Format
cargo clippy --workspace -- -D warnings # Lint (strict)
```

### Mobile Development

Mobile builds use the `mobile` feature on the `shared` crate to exclude desktop-only agent dependencies (agent-client-protocol, portable-pty, etc.).

```bash
pnpm tauri:android:dev    # Android development
pnpm tauri:android:build  # Android build
pnpm tauri:ios:dev        # iOS development (macOS only)
pnpm tauri:ios:build      # iOS build (macOS only)
```

### WASM Development

```bash
cd browser && wasm-pack build --target web
```

## Key Crate Dependencies

- **iroh** 0.95 + **iroh-tickets** — P2P with QUIC and NAT traversal
- **agent-client-protocol** — ACP for external agents
- **tauri** 2 — cross-platform desktop/mobile
- **bincode** — network serialization
- **chacha20poly1305** — E2E encryption
- **tokio-util** — `CancellationToken` for task lifecycle (included in `mobile` feature)
- **tauri-nspanel** — macOS floating panel support (macOS-only dependency)

### Crate Patches

`Cargo.toml` patches these crates from forks:
- `tokio-tungstenite` and `tungstenite` — OpenAI forks (WebSocket gateway support)
- `agent-client-protocol-schema` — forked to handle nullable `used` field in `UsageUpdate`

### Build Profiles

- `release` — LTO enabled, stripped symbols, single codegen unit
- `production` — inherits `release` + `panic = "abort"`
- `release-logging` feature flag (in `cli` and `app`) — enables tracing in release builds

## Frontend Development Patterns

### SolidJS Patterns

- Use Solid reactive primitives (`createSignal`, `createMemo`, `createResource`)
- Avoid React patterns like `useEffect` or prop drilling where stores are better

### Example Component Pattern

```tsx
import { createSignal, Show } from "solid-js";

interface Props {
  title: string;
}

export function MyComponent(props: Props) {
  const [active, setActive] = createSignal(false);

  return (
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div class="p-6">
        <h2 class="text-lg font-semibold">{props.title}</h2>
        <Show when={active()}>
          <span class="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
            Active
          </span>
        </Show>
      </div>
    </div>
  );
}
```

### Styling

- Tailwind CSS v4 via `@tailwindcss/vite` plugin (see `vite.config.ts`)
- Design tokens via HSL CSS variables (`--primary`, `--background`, `--border`, etc.) in `tailwind.config.js`
- Dark mode uses Kobalte's `data-kb-theme="dark"` attribute
- Prefer utility classes; avoid `@apply`

## Rust Code Style (Edition 2024)

### Error Handling

- Use `anyhow::Result<T>` for fallible APIs and `?` for propagation
- Add context with `.with_context(|| format!("..."))?` when errors need explanation
- Avoid `.unwrap()` and `.expect()` in non-test code

### Async and Concurrency

- Use `tokio` for async and `tokio::select!` for multi-branch concurrency
- Ensure types crossing await points are `Send`

### Logging

- Use `tracing` (`info!` for events, `debug!` for structured data)
- Do not use `println!` in production paths

### Shared State

- Use `Arc<Mutex<T>>` or `Arc<RwLock<T>>` for shared mutable state
- Prefer coarse-grained locking with clear ownership boundaries
- For hot-path fields updated on every event (e.g., `last_activity: Instant`), use `std::sync::Mutex` instead of `tokio::sync::RwLock` to avoid async overhead
- Promote frequently-accessed fields out of a wrapping `Mutex` into their own `Arc<RwLock<T>>` for lock-free reads (see `QuicMessageClientHandle`)

### Imports Order

1. `std` / `core`
2. External crates (`anyhow`, `tokio`, `tracing`)
3. Workspace crates (`shared`)
4. `crate::` (local modules)

### Naming

- Variables/Functions: `snake_case`
- Types/Structs/Enums: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

## TypeScript Style

- Strict mode is enabled in `tsconfig.json` (no `any`)
- Prefer explicit interfaces/types for public component props
- Avoid unused locals/parameters (compiler enforces this)

## Adding a New Agent

1. Add variant to `AgentType` in `shared/src/message_protocol.rs`
2. Add session creation logic in `shared/src/agent/mod.rs` (`AgentManager::start_session_with_id`)
3. Add factory entry in `shared/src/agent/factory.rs`
4. If ACP: implement output parser in `shared/src/agent/` (see `opencode.rs`, `gemini.rs` for patterns)
5. Add Tauri command handling in `app/src/lib.rs`
6. Update frontend stores (`sessionStore.ts`) and `ChatView.tsx`

## Linting & Formatting

```bash
cargo fmt --all -- --check                          # Verify Rust formatting
cargo clippy --workspace -- -D warnings             # Rust lint (strict)
pnpm tsc                                            # Frontend type check
pnpm exec prettier --write "src/**/*.{ts,tsx}"      # Frontend formatting
```

## Debugging

```bash
# CLI with debug logging
RUST_LOG=debug ./target/debug/cli host

# CLI flags
./target/release/cli host --temp-key   # Temporary key (no persistence)
./target/release/cli host --daemon     # Background mode after printing QR

# Tauri app with debug logging
RUST_LOG=debug pnpm tauri:dev

# App log locations
# macOS: ~/Library/Logs/ClawdPilot/
# Linux: ~/.local/share/ClawdPilot/logs/
# Windows: %APPDATA%\ClawdPilot\logs\
```

## Key Files

| File | Purpose |
|------|---------|
| `shared/src/message_protocol.rs` | Central message protocol definition |
| `shared/src/agent/mod.rs` | AgentManager routing logic and SessionKind enum |
| `shared/src/agent/factory.rs` | Agent session factory (command resolution, auto-install) |
| `shared/src/agent/acp.rs` | ACP session implementation |
| `shared/src/agent/openclaw_ws.rs` | OpenClaw WebSocket session |
| `shared/src/agent/session.rs` | Agent session trait and process state |
| `shared/src/event_manager.rs` | Event manager for inter-component communication |
| `shared/src/quic_server.rs` | QUIC/iroh P2P server |
| `cli/src/main.rs` | CLI entry point (host subcommand) |
| `cli/src/message_server.rs` | CLI message handling and slash commands |
| `app/src/lib.rs` | Tauri commands and P2P client |
| `src/components/ChatView.tsx` | Main chat interface |
| `src/components/ui/ChatInput.tsx` | Chat input with tool buttons and file attachment |
| `src/stores/sessionStore.ts` | Session state management |
| `src/stores/chatStore.ts` | Messages and permissions |
| `src/stores/sessionEventRouter.ts` | Multi-session event routing and unread tracking |

## Package Manager

**pnpm v10+** (lockfileVersion 9.0 in `pnpm-lock.yaml`)
