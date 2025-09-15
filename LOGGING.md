# RiTerm Logging Configuration

This document explains the logging configuration system implemented in RiTerm to optimize builds for different environments.

## Overview

RiTerm uses conditional compilation to control logging levels based on the build profile and feature flags. This allows for:

- **Development builds**: All logs enabled (debug, info, warn, error)
- **Release builds**: Info and above (info, warn, error)
- **Production builds**: Error only logs

## Configuration

### Build Profiles

1. **Debug Profile** (`cargo build`)
   - All logs enabled
   - Default log level: `info`
   - Can be overridden with `RUST_LOG` environment variable

2. **Release Profile** (`cargo build --release`)
   - Info, warn, and error logs enabled
   - Default log level: `info`
   - Can be overridden with `RUST_LOG` environment variable

3. **Production Profile** (`cargo build --release --features release-logging`)
   - Only error logs enabled
   - Default log level: `error`
   - Minimizes runtime overhead and binary size

### Feature Flags

- `release-logging`: When enabled in release builds, sets logging to error-level only

### Implementation Details

#### CLI Application (`cli/src/main.rs`)

```rust
// Conditional logging based on build profile and features
#[cfg(all(not(debug_assertions), feature = "release-logging"))]
let console_filter = EnvFilter::try_from_default_env()
    .unwrap_or_else(|_| "error,netwatch::netmon::bsd=error".into());

#[cfg(not(all(not(debug_assertions), feature = "release-logging")))]
let console_filter = EnvFilter::try_from_default_env()
    .unwrap_or_else(|_| "info,netwatch::netmon::bsd=error".into());
```

#### Tauri Application (`app/src/lib.rs`)

```rust
// Initialize tracing with conditional log levels
fn init_tracing() {
    #[cfg(all(not(debug_assertions), feature = "release-logging"))]
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "error".into());

    #[cfg(not(all(not(debug_assertions), feature = "release-logging")))]
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info".into());

    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().with_filter(filter))
        .init();
}
```

#### Conditional Log Statements

Throughout the codebase, log statements are conditionally compiled:

```rust
// Only compile logging in debug builds or when release-logging is NOT enabled
#[cfg(any(debug_assertions, not(feature = "release-logging")))]
tracing::info!("Session {} disconnected successfully", session_id);

#[cfg(any(debug_assertions, not(feature = "release-logging")))]
tracing::warn!("Session {} approaching event limit: {}/{}",
    session_id, current_count, MAX_EVENTS_PER_SESSION);
```

## Build Commands

### Development
```bash
# Full logging enabled
cargo build
./target/debug/cli
```

### Release (with info/warn logs)
```bash
# Standard release build
cargo build --release
./target/release/cli
```

### Production (error-only logs)
```bash
# Minimal logging build
cargo build --release --features release-logging
./target/release/cli
```

### Tauri Application

#### Development
```bash
npm run tauri dev
```

#### Production Build
```bash
npm run tauri build --features release-logging
```

## Environment Variables

You can still override logging levels using the `RUST_LOG` environment variable:

```bash
# Enable debug logging in any build
RUST_LOG=debug ./target/release/cli

# Disable all logging
RUST_LOG=off ./target/release/cli

# Module-specific logging
RUST_LOG=riterm=debug,iroh=info ./target/release/cli
```

## Benefits

1. **Performance**: Production builds have minimal logging overhead
2. **Security**: Reduces information leakage in production
3. **Binary Size**: Smaller binaries when debug/info logs are compiled out
4. **Flexibility**: Can still enable detailed logging when needed via environment variables

## File Logging

The CLI application maintains detailed file logging regardless of console log level:
- Location: `logs/iroh-code-remote-cli.log`
- Rotation: Daily
- Level: Always `debug` (full logging to file)
- Format: Plain text (no ANSI colors)

This ensures that detailed logs are always available for debugging, even in production builds.