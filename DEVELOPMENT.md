# RiTerm Development Guide

This document describes the development workflow and CI/CD process for RiTerm.

## 🚀 Overview

RiTerm uses a comprehensive CI/CD pipeline that builds CLI tools, desktop applications, and mobile apps across multiple platforms.

## 📋 Project Structure

```
riterm/
├── cli/                     # CLI tool (Rust)
├── app/                     # Tauri application (Rust + SolidJS)
├── shared/                  # Shared networking library (Rust)
├── src/                     # Frontend (SolidJS)
├── .github/workflows/       # CI/CD configurations
├── package.json            # Frontend dependencies
└── Cargo.toml              # Rust workspace configuration
```

## 🛠️ Development Workflow

### Local Development

#### Prerequisites
- **Rust** (latest stable)
- **Node.js** 20+
- **npm** or **pnpm**
- For mobile development: **Android Studio** (Android) / **Xcode** (iOS)

#### Setup
```bash
# Clone repository
git clone https://github.com/sternelee/riterm.git
cd riterm

# Install frontend dependencies
npm install

# Build all components
cargo build --workspace
```

#### Development Commands
```bash
# Frontend development server
npm run dev

# Tauri desktop app development
npm run tauri:dev

# CLI development (use workspace)
cargo run -p cli -- host

# Android development
npm run tauri:android:dev

# iOS development (macOS only)
npm run tauri:ios:dev
```

#### Building
```bash
# Build frontend only
npm run build

# Build desktop apps
npm run tauri:build

# Build CLI
cargo build -p cli --release

# Build mobile apps
npm run tauri:android:build
npm run tauri:ios:build  # macOS only
```

## 🔄 CI/CD Pipeline

### Workflows

#### 1. Development Build and Test (`.github/workflows/build-and-test.yml`)
- **Triggers**: Push to `main`/`app`, Pull Requests, Manual dispatch
- **Actions**:
  - Code quality checks (rustfmt, clippy)
  - Unit tests
  - Frontend build verification
  - CLI builds for all platforms
  - Desktop app builds (development mode)
  - Security audit

#### 2. Release Pipeline (`.github/workflows/publish-to-auto-release.yml`)
- **Triggers**: Git tags starting with `v*` (e.g., `v1.0.0`)
- **Actions**:
  - CLI builds for 8 platforms (Linux, macOS, Windows, ARM64 variants)
  - Desktop app builds for 4 platforms (macOS Intel/ARM, Linux, Windows)
  - Mobile app builds (Android, iOS) - optional
  - Automatic GitHub release creation
  - Asset organization and checksums
  - Sync to separate release repository

### Build Matrix

#### CLI Targets
- `x86_64-unknown-linux-gnu`
- `aarch64-unknown-linux-gnu`
- `x86_64-unknown-linux-musl`
- `aarch64-unknown-linux-musl`
- `x86_64-apple-darwin`
- `aarch64-apple-darwin`
- `x86_64-pc-windows-msvc`
- `aarch64-pc-windows-msvc`

#### Desktop App Targets
- macOS (Intel and Apple Silicon)
- Windows (x64)
- Linux (AppImage, deb)

#### Mobile Apps
- Android (APK)
- iOS (IPA) - requires Apple Developer account

## 📦 Release Process

### Creating a Release

1. **Update version numbers**:
   ```bash
   # Update package.json
   npm version patch|minor|major

   # Update app/tauri.conf.json version field
   ```

2. **Create and push tag**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **CI/CD automatically**:
   - Builds all artifacts
   - Creates GitHub release
   - Generates release notes
   - Creates checksums
   - Syncs to release repository

### Release Types

- **Stable Release**: `v1.0.0`
- **Prerelease**: `v1.0.0-alpha`, `v1.0.0-beta`, `v1.0.0-rc`
- **Test Release**: Any tag containing `-test` (skips mobile builds)

## 🧪 Testing

### Running Tests
```bash
# Rust tests
cargo test --workspace

# Frontend tests (if available)
npm test

# Integration tests
cargo test --workspace -- --ignored
```

### Code Quality
```bash
# Rust formatting
cargo fmt --all

# Rust linting
cargo clippy --workspace -- -D warnings

# TypeScript checking
npm run tsc
```

## 🔧 Configuration

### Environment Variables
- `CARGO_TERM_COLOR`: Set to `always` for colored output
- `OPENAI_API_KEY`: For AI features (in production)
- `GITHUB_TOKEN`: For release automation (provided by Actions)

### Tauri Configuration
See `app/tauri.conf.json` for:
- Bundle targets
- Permissions and capabilities
- Build settings
- Platform-specific options

### Rust Workspace
See `Cargo.toml` for:
- Workspace members
- Shared dependencies
- Build profiles
- Compiler optimizations

## 🐛 Debugging

### CLI Debugging
```bash
# Debug build
cargo build -p cli

# Run with logging
RUST_LOG=debug ./target/debug/cli host

# Check system info
./target/debug/cli system-info
```

### App Debugging
```bash
# Development mode with detailed logs
RUST_LOG=debug npm run tauri:dev

# Check app logs
# Windows: %APPDATA%\RiTerm\logs\
# macOS: ~/Library/Logs/RiTerm/
# Linux: ~/.local/share/RiTerm/logs/
```

## 📊 Monitoring

### CI/CD Monitoring
- GitHub Actions dashboard
- Build artifacts and reports
- Security audit results
- Performance metrics

### Release Analytics
- Download counts from GitHub releases
- Issue tracking and bug reports
- User feedback and feature requests

## 🚀 Deployment

### CLI Distribution
- GitHub releases
- Package managers (optional: brew, apt, snap)
- Docker images (optional)

### App Distribution
- GitHub releases
- App Store (optional for iOS/macOS)
- Microsoft Store (optional for Windows)
- Snap Store/Flatpak (optional for Linux)

### Mobile Distribution
- GitHub releases (APK files)
- Google Play Store (optional)
- Apple App Store (optional)

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Run tests and quality checks
5. Submit pull request
6. CI/CD runs automatically

### Code Style
- Rust: `cargo fmt` and `cargo clippy`
- TypeScript: Follow existing patterns
- SolidJS: Use established patterns
- Comments: Document complex logic

## 📚 Resources

- [Tauri Documentation](https://tauri.app/)
- [SolidJS Documentation](https://www.solidjs.com/)
- [Rust Documentation](https://doc.rust-lang.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

For questions or issues, please refer to the [GitHub repository](https://github.com/sternelee/riterm).