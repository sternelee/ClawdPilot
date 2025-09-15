#!/bin/bash

# Build script for RiTerm with different logging configurations

set -e

echo "🚀 Building RiTerm with optimized logging configurations..."

# Build debug version (all logs enabled)
echo "📝 Building debug version (all logs enabled)..."
cargo build

# Build release version (default - info/warn logs still enabled)
echo "🔧 Building release version (info/warn logs enabled)..."
cargo build --release

# Build production version with minimal logging (error-only logs)
echo "🔒 Building production version with minimal logging (error-only logs)..."
cargo build --release --features release-logging

# Build Tauri app for production
echo "📱 Building Tauri app for production..."
cd app
cargo build --release --features release-logging

echo "✅ All builds completed successfully!"

echo ""
echo "📊 Build Results:"
echo "  - Debug build: target/debug/ (all logs enabled)"
echo "  - Release build: target/release/ (info/warn logs enabled)"
echo "  - Production build: target/release/ with --features release-logging (error-only logs)"
echo ""
echo "🔍 To verify logging levels:"
echo "  - Debug: RUST_LOG=debug ./target/debug/cli"
echo "  - Release: RUST_LOG=info ./target/release/cli"
echo "  - Production: RUST_LOG=error ./target/release/cli --features release-logging"
echo ""
echo "🏗️  For Tauri app builds:"
echo "  - Development: npm run tauri dev"
echo "  - Production: npm run tauri build --features release-logging"