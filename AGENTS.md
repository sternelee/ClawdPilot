# Repository Guidelines

## Project Structure & Module Organization
- `cli/` Rust CLI binary (`clawdchat`), host command and terminal handling.
- `app/` Tauri backend (Rust) for desktop/mobile app.
- `shared/` Rust networking and protocol library shared by CLI/app.
- `src/` SolidJS frontend (Vite + TailwindCSS + DaisyUI).
- `browser/` WebAssembly browser client.
- `plugins/` Vite/Tauri build helpers (e.g., `fix-cjs-modules.ts`).
- `public/` static assets; `docs/` design/notes if present.

## Build, Test, and Development Commands
Prereqs: Rust stable, Node.js 20+, pnpm 10+.
- `pnpm install` install frontend deps.
- `pnpm dev` run SolidJS dev server (Vite).
- `pnpm tauri:dev` run Tauri desktop app in dev mode.
- `cargo build --workspace` build all Rust crates.
- `cargo run -p cli -- host` run CLI host in workspace.
- `pnpm build` build frontend only.
- `pnpm tauri:build` build desktop app.
- `cargo build -p cli --release` build CLI release binary.
- Mobile (macOS): `pnpm tauri:android:dev|build`, `pnpm tauri:ios:dev|build`.

## Coding Style & Naming Conventions
- Rust edition 2024; `snake_case` vars/functions, `PascalCase` types, `SCREAMING_SNAKE_CASE` consts.
- Error handling: prefer `anyhow::Result`, add context via `.with_context(...)`, avoid `unwrap/expect` outside tests.
- Logging with `tracing` (no `println!` in production paths).
- Frontend: TailwindCSS v4 utility classes (avoid `@apply`), keep existing font stacks.
- TypeScript: strict mode, no implicit `any`, define prop interfaces explicitly.
- Formatting/lint: `cargo fmt --all -- --check`, `cargo clippy --workspace -- -D warnings`, `pnpm tsc`.

## Testing Guidelines
- Rust: `cargo test --workspace`.
- Targeted tests: `cargo test -p cli|shared|app <test_name>`.
- Show output: `cargo test -- --nocapture`.
- CLI helper: `./test_ticket_output.sh`.
- Frontend tests (if present): `pnpm test`.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:` with optional scopes (e.g., `feat(ui): ...`).
- PRs should include: concise summary, testing performed (commands + results), and UI screenshots for visual changes.
- Link related issues when applicable.

## Security & Configuration Tips
- Do not commit secrets or local keys (e.g., `clawdchat_secret_key`).
- For mobile builds, ensure platform tooling is installed (Android Studio/Xcode).
