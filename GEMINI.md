# ClawdPilot Project Context

ClawdPilot is a multi-agent local/remote management platform that provides a unified session management experience for controlling multiple AI agents (Claude, Codex, Gemini, OpenCode, OpenClaw) across local and remote environments.

## Project Overview

- **Architecture:** Tauri (Rust backend) + SolidJS (frontend).
- **Core Components:**
    - `app/`: Tauri desktop and mobile application backend.
    - `cli/`: Rust CLI entry point, used for hosting remote agent sessions.
    - `shared/`: Shared networking and protocol library. Uses `iroh` for P2P/networking and a custom unified message protocol.
    - `src/`: Frontend UI implemented with SolidJS, Vite, and Tailwind CSS.
    - `browser/`: WebAssembly client for browser-based interactions.
- **Tech Stack:**
    - **Backend:** Rust, Tauri v2, Tokio, Iroh, Serde, Clap.
    - **Frontend:** SolidJS, Vite, Tailwind CSS v4, DaisyUI v5, Kobalte UI primitives.
    - **Protocol:** Custom binary protocol (bincode-serialized) supporting agent sessions, TCP forwarding, file browsing, and Git operations.

## Key Features

- **Unified Multi-Agent Workspace:** Run and control multiple AI agents in one place.
- **Local & Remote Sessions:** Manage lifecycle for local agents or control remote sessions via a secure connection.
- **Permission Workflows:** Granular control with modes like `AlwaysAsk`, `AcceptEdits`, `Plan`, and `AutoApprove`.
- **Structured UI:** Dedicated views for chat, tool calls, approvals, file browsing, and system events.

## Development Guide

### Prerequisites
- **Rust stable**
- **Node.js 20+**
- **pnpm 10+**

### Building and Running

| Command | Description |
|---------|-------------|
| `pnpm install` | Install frontend and project dependencies |
| `pnpm dev` | Start the frontend development server |
| `pnpm tauri:dev` | Launch the Tauri desktop application in development mode |
| `cargo run -p cli -- host` | Run the CLI host for remote sessions |
| `pnpm build` | Build the production frontend |
| `cargo build --workspace` | Build all Rust crates in the workspace |
| `pnpm tauri:build` | Build the production Tauri application |
| `cargo test --workspace` | Run all Rust tests |
| `pnpm tsc` | Run TypeScript/SolidJS type checking |

### Code Style and Linting
- **Rust:** Follow standard Rust conventions. Use `cargo fmt --all` and `cargo clippy --workspace -- -D warnings`.
- **Frontend:** Use Prettier for formatting. The project uses Tailwind CSS v4 and DaisyUI v5 for styling.

## Repository Structure

```text
.
├── app/          # Tauri backend (Rust)
├── cli/          # CLI host entry (Rust)
├── shared/       # Shared protocol and networking (Rust)
├── src/          # SolidJS frontend source code
│   ├── components/ # UI components (Chat, Sidebar, etc.)
│   ├── stores/     # State management (Solid stores)
│   └── utils/      # Frontend utilities
├── browser/      # WASM client
├── web/          # Web-specific streaming/server components
├── docs/         # Project documentation
└── Cargo.toml    # Workspace configuration
```

## Important Files
- `shared/src/message_protocol.rs`: Defines the unified communication protocol between components.
- `app/tauri.conf.json`: Tauri application configuration.
- `package.json`: Frontend dependencies and scripts.
- `DEVELOPMENT.md`: Detailed developer instructions (in Chinese/English).
