# AGENTS.md - AI Coding Agent Guide for riterm

> **riterm** is a P2P Terminal Session Sharing app built with Rust (CLI/backend),
> SolidJS (frontend), and Tauri 2 (desktop/mobile). Uses iroh for decentralized
> P2P networking with NAT traversal and ChaCha20-Poly1305 encryption.

## Project Structure

```
riterm/
├── cli/           # Rust CLI binary (host server, PTY handling)
├── shared/        # Rust shared library (QUIC server, message protocol)
├── app/           # Tauri 2 desktop/mobile app backend (Rust)
├── browser/       # WebAssembly P2P client (Rust → WASM, edition 2021)
├── src/           # Frontend (SolidJS/TypeScript)
│   ├── components/    # UI components (.tsx)
│   ├── stores/        # State management (signals/stores)
│   ├── hooks/         # SolidJS hooks
│   └── utils/         # Utilities including mobile helpers
└── logs/          # Runtime log files
```

## Build Commands

| Task              | Command                                      |
| ----------------- | -------------------------------------------- |
| Install deps      | `pnpm install`                               |
| Frontend dev      | `pnpm dev`                                   |
| Frontend build    | `pnpm build`                                 |
| TypeScript check  | `pnpm tsc`                                   |
| Desktop dev       | `pnpm tauri dev`                             |
| Desktop build     | `pnpm tauri build`                           |
| Android dev       | `pnpm tauri android dev`                     |
| iOS dev           | `pnpm tauri ios dev`                         |
| Build all Rust    | `cargo build --workspace`                    |
| Build CLI only    | `cargo build -p cli`                         |
| Build shared lib  | `cargo build -p riterm-shared`               |
| Build app backend | `cargo build -p app`                         |
| WASM build        | `cd browser && wasm-pack build --target web` |

## Test Commands

```bash
cargo test --workspace                         # All tests
cargo test -p cli test_name                    # Single test in CLI crate
cargo test -p riterm-shared mod::test_name     # Single test in shared
cargo test -p app test_name                    # Single test in app
cargo test -p cli test_name -- --nocapture     # With stdout output
cargo test -p cli test_name -- --exact         # Exact match only
```

## Lint & Format

```bash
cargo fmt --all -- --check                     # Check Rust formatting (CI uses this)
cargo fmt                                      # Auto-format Rust code
cargo clippy --workspace -- -D warnings        # Lint all crates (CI treats warnings as errors)
cargo clippy -p cli                            # Lint specific crate
pnpm tsc                                       # TypeScript type check
```

**Before committing:** Run `cargo fmt && cargo clippy --workspace -- -D warnings` for Rust, `pnpm tsc` for TypeScript. CI enforces these checks.

## Rust Code Style

### Error Handling

- Use `anyhow::Result` with `?` operator for error propagation
- Add context: `.with_context(|| format!("Failed to do X: {}", path))?`
- Avoid `.unwrap()`/`.expect()` except in tests
- Handle `Option`/`Result` explicitly with `match` or combinators

### Imports (order: std → third-party → workspace → local)

```rust
use std::collections::HashMap;

use anyhow::Result;
use tokio::sync::mpsc;
use tracing::info;

use riterm_shared::QuicMessageServerConfig;

use crate::message_server::CliMessageServer;
```

### Logging

- Use `tracing` macros: `error!`, `warn!`, `info!`, `debug!`, `trace!`
- Avoid `println!` in production code
- Use structured fields: `info!(session_id = %id, "Connected")`

### Naming Conventions

- `snake_case`: functions, variables, modules
- `PascalCase`: types, structs, enums
- `SCREAMING_SNAKE_CASE`: constants

### Async/Concurrency

- Use `tokio::spawn` with proper error handling
- Use `tokio::select!` for concurrent operations
- Ensure types are `Send + Sync` for async boundaries
- Persist `mpsc::Sender` handles to prevent channel closure

### Types

- Prefer explicit struct fields over tuples
- Use `#[derive(Debug, Clone, Serialize, Deserialize)]` appropriately
- Use descriptive field names

## TypeScript/SolidJS Code Style

### General

- Use `const`/`let`, never `var`
- Avoid `any`; use explicit types (strict mode enforced)
- tsconfig: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`

### SolidJS Patterns

```tsx
import { createSignal, onMount, onCleanup } from "solid-js";

function MyComponent() {
  const [value, setValue] = createSignal("");

  onMount(() => {
    /* setup */
  });
  onCleanup(() => {
    /* cleanup */
  });

  return <div>{value()}</div>;
}
```

- Keep hooks at component top level
- Derive state from signals; avoid redundant state
- Use `onMount`/`onCleanup` for lifecycle

### Naming

- `camelCase`: variables, functions, props
- `PascalCase`: components, types
- Prefix hooks: `useConnection`, `useToolbarPreferences`

## Styling

- **Tailwind CSS v4** + **DaisyUI v5** components
- Custom CSS in `src/styles/`
- Themes: dark, light, corporate, business, night, forest, dracula, luxury, synthwave

## Workspace Crates

| Crate            | Edition | Description                          |
| ---------------- | ------- | ------------------------------------ |
| `cli`            | 2024    | CLI host server with PTY support     |
| `riterm-shared`  | 2024    | Shared QUIC server, message protocol |
| `app`            | 2024    | Tauri 2 backend for desktop/mobile   |
| `riterm-browser` | 2021    | WebAssembly client for browser       |

## Key Dependencies

- **tokio 1.47**: Async runtime
- **iroh 0.95**: P2P networking with NAT traversal
- **chacha20poly1305**: End-to-end encryption
- **portable-pty**: Cross-platform PTY
- **tauri 2**: Desktop/mobile framework
- **solid-js 1.9**: Reactive UI framework
- **ghostty-web**: Terminal emulator

## Common Patterns

### TCP Forwarding Session Lifecycle

1. App creates pending session → sends `CreateSession` to CLI
2. CLI creates session, responds with `{session_id, status: "created"}`
3. App receives response → calls `start_session_listener()`
4. App saves `shutdown_tx` to `shutdown_senders` HashMap (prevents immediate closure)
5. Local client connects → App opens QUIC bidi stream with session handshake
6. CLI receives stream, connects to target, bidirectional forwarding begins

### Message Protocol

- Messages use `MessagePayload` enum variants
- Response matching: check `session_id + status` before generic `sessions` field
- Use `tracing::debug!` for verbose logs, `tracing::info!` for key events

## Best Practices

1. Keep changes minimal and aligned with existing patterns
2. Run lint/format before committing (CI will fail otherwise)
3. Persist channel senders to prevent premature closure
4. Use `#[cfg(debug_assertions)]` for debug-only logs
5. Match enum variants exactly (e.g., `"ListenToRemote"` vs `"local-to-remote"`)
6. Use `BASE32_NOPAD` with `.to_ascii_lowercase()` for ticket encoding
7. Use `release-logging` feature flag for release build logging
