# AGENTS.md - AI Coding Agent Guide for ClawdChat

> **ClawdChat** is a P2P Terminal Session Sharing app built with Rust (CLI/backend), SolidJS (frontend), and Tauri 2 (desktop/mobile).

## Quick Start Commands

| Task           | Command                                      |
| :------------- | :------------------------------------------- |
| Install deps   | `pnpm install`                               |
| Frontend Dev   | `pnpm dev`                                   |
| Frontend Build | `pnpm build`                                 |
| Type Check     | `pnpm tsc`                                   |
| Desktop Dev    | `pnpm tauri dev`                             |
| Desktop Build  | `pnpm tauri build`                           |
| Android Dev    | `pnpm tauri:android:dev`                     |
| Android Build  | `pnpm tauri:android:build`                   |
| iOS Dev        | `pnpm tauri:ios:dev`                         |
| iOS Build      | `pnpm tauri:ios:build`                       |
| CLI Build      | `cargo build -p cli`                         |
| WASM Build     | `cd browser && wasm-pack build --target web` |

## Testing

```bash
# Rust tests
cargo test --workspace                     # Run all tests
cargo test -p cli <test_name>              # Single test (CLI)
cargo test -p shared <test_name>    # Single test (Shared)
cargo test -p app <test_name>              # Single test (App)
cargo test -- --nocapture                  # Show stdout

# CLI-specific test helper
./test_ticket_output.sh                    # Test CLI ticket generation
```

## Linting & Formatting

```bash
# Rust formatting and lint
cargo fmt --all -- --check                 # Verify formatting
cargo clippy --workspace -- -D warnings    # Lint (strict)

# Frontend formatting
pnpm tsc                                   # TypeScript type check
```

## Code Style: Rust (Edition 2024)

### Error Handling

- Use `anyhow::Result<T>` for fallible APIs and `?` for propagation.
- Add context with `.with_context(|| format!("..."))?` or `.context("...")?` when errors need explanation.
- Use `.ok_or_else(|| anyhow::anyhow!("..."))?` for `Option` to `Result` conversions.
- Avoid `.unwrap()` and `.expect()` in non-test code.

### Async and Concurrency

- Use `tokio` for async and `tokio::select!` for multi-branch concurrency.
- Ensure types crossing await points are `Send`.

### Logging

- Use `tracing` (`info!` for events, `debug!` for structured data).
- Do not use `println!` in production paths.

### Shared State

- Use `Arc<Mutex<T>>` or `Arc<RwLock<T>>` for shared mutable state.
- Prefer coarse-grained locking with clear ownership boundaries.

### Imports Order

1. `std` / `core`
2. External crates (`anyhow`, `tokio`, `tracing`)
3. Workspace crates (`shared`, `clawdchat_*`)
4. `crate::` (local modules)

### Naming

- Variables/Functions: `snake_case`
- Types/Structs/Enums: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Comments & Documentation

- Use `///` for item-level, `//!` for module-level docs
- Include doc examples in ` ```rust ` blocks when useful
- Use `#[cfg(test)]` modules with `#[test]`/`#[tokio::test]`

## Code Style: TypeScript + SolidJS

### TypeScript

- Strict mode is enabled in `tsconfig.json` (no `any`).
- Prefer explicit interfaces/types for public component props.
- Avoid unused locals/parameters (compiler enforces this).

### SolidJS Patterns

- Use Solid reactive primitives (`createSignal`, `createMemo`, `createResource`).
- Avoid React patterns like `useEffect` or prop drilling where stores are better.

### Example Component Pattern

```tsx
import { createSignal, Show } from "solid-js";

interface Props {
  title: string;
}

export function MyComponent(props: Props) {
  const [active, setActive] = createSignal(false);

  return (
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">{props.title}</h2>
        <Show when={active()}>
          <div class="badge badge-primary">Active</div>
        </Show>
      </div>
    </div>
  );
}
```

### Styling

- Tailwind CSS v4 is configured in `tailwind.config.js`.
- Prefer utility classes; avoid `@apply`.
- Use the existing font stacks (see `tailwind.config.js`).

## Project Architecture

| Directory  | Language | Description                                 |
| :--------- | :------- | :------------------------------------------ |
| `cli/`     | Rust     | Host server, PTY handling, shell detection. |
| `shared/`  | Rust     | QUIC server, message protocol, crypto.      |
| `app/`     | Rust     | Tauri 2 backend, session management.        |
| `browser/` | Rust     | WASM client (no TCP forwarding).            |
| `src/`     | TSX      | SolidJS frontend, ghostty-web terminal.     |

## Protocol and Runtime Notes

- Networking: `iroh` (P2P + NAT traversal).
- Encryption: `chacha20poly1305` (end-to-end).
- Messages: `MessagePayload` enum in `shared` using `bincode` serialization.

## Session Lifecycle

1. App sends `CreateSession` -> CLI responds `{session_id}`.
2. App starts `start_session_listener`.
3. P2P client connects -> App opens QUIC stream.
4. Data is forwarded bidirectionally (App <-> CLI <-> PTY).

## Agent Rules (Cursor/Copilot)

- No `.cursor/rules/` or `.cursorrules` present in this repo.
- No `.github/copilot-instructions.md` present in this repo.
