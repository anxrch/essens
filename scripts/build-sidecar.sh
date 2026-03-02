#!/bin/bash
set -euo pipefail

# Build the sidecar as a Node.js Single Executable Application (SEA)
# Usage: ./scripts/build-sidecar.sh [target-triple]
# Example: ./scripts/build-sidecar.sh x86_64-unknown-linux-gnu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SIDECAR_DIR="$ROOT_DIR/packages/sidecar"
BINARIES_DIR="$ROOT_DIR/apps/desktop/src-tauri/binaries"

# Detect target triple
if [ -n "${1:-}" ]; then
  TARGET_TRIPLE="$1"
else
  ARCH=$(uname -m)
  OS=$(uname -s)
  case "$OS" in
    Linux)
      case "$ARCH" in
        x86_64)  TARGET_TRIPLE="x86_64-unknown-linux-gnu" ;;
        aarch64) TARGET_TRIPLE="aarch64-unknown-linux-gnu" ;;
        *)       echo "Unsupported arch: $ARCH"; exit 1 ;;
      esac
      ;;
    Darwin)
      case "$ARCH" in
        x86_64)  TARGET_TRIPLE="x86_64-apple-darwin" ;;
        arm64)   TARGET_TRIPLE="aarch64-apple-darwin" ;;
        *)       echo "Unsupported arch: $ARCH"; exit 1 ;;
      esac
      ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      TARGET_TRIPLE="x86_64-pc-windows-msvc"
      ;;
    *)
      echo "Unsupported OS: $OS"; exit 1
      ;;
  esac
fi

echo "Building sidecar for target: $TARGET_TRIPLE"

# 1. Build TypeScript
echo "[1/5] Building TypeScript..."
cd "$ROOT_DIR"
pnpm --filter @essens/core build
pnpm --filter @essens/sidecar build

# 2. Bundle with esbuild into a single JS file
echo "[2/5] Bundling with esbuild..."
npx esbuild "$SIDECAR_DIR/dist/index.js" \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile="$SIDECAR_DIR/dist/bundle.cjs" \
  --format=cjs \
  --external:sodium-native

# 3. Generate SEA blob
echo "[3/5] Generating SEA config..."
cat > "$SIDECAR_DIR/dist/sea-config.json" <<SEACFG
{
  "main": "$SIDECAR_DIR/dist/bundle.cjs",
  "output": "$SIDECAR_DIR/dist/sea-prep.blob",
  "disableExperimentalSEAWarning": true,
  "useSnapshot": false,
  "useCodeCache": true
}
SEACFG

echo "[4/5] Creating SEA blob..."
node --experimental-sea-config "$SIDECAR_DIR/dist/sea-config.json"

# 4. Create executable
echo "[5/5] Creating executable..."
mkdir -p "$BINARIES_DIR"

SIDECAR_NAME="essens-sidecar-$TARGET_TRIPLE"

case "$TARGET_TRIPLE" in
  *windows*)
    SIDECAR_NAME="${SIDECAR_NAME}.exe"
    cp "$(command -v node)" "$BINARIES_DIR/$SIDECAR_NAME"
    # On Windows, use postject via npx
    npx postject "$BINARIES_DIR/$SIDECAR_NAME" NODE_SEA_BLOB "$SIDECAR_DIR/dist/sea-prep.blob" \
      --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
    ;;
  *darwin*)
    cp "$(command -v node)" "$BINARIES_DIR/$SIDECAR_NAME"
    codesign --remove-signature "$BINARIES_DIR/$SIDECAR_NAME" 2>/dev/null || true
    npx postject "$BINARIES_DIR/$SIDECAR_NAME" NODE_SEA_BLOB "$SIDECAR_DIR/dist/sea-prep.blob" \
      --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
      --macho-segment-name NODE_SEA
    codesign --sign - "$BINARIES_DIR/$SIDECAR_NAME" 2>/dev/null || true
    ;;
  *)
    cp "$(command -v node)" "$BINARIES_DIR/$SIDECAR_NAME"
    npx postject "$BINARIES_DIR/$SIDECAR_NAME" NODE_SEA_BLOB "$SIDECAR_DIR/dist/sea-prep.blob" \
      --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
    ;;
esac

chmod +x "$BINARIES_DIR/$SIDECAR_NAME"

echo ""
echo "Sidecar built: $BINARIES_DIR/$SIDECAR_NAME"
ls -lh "$BINARIES_DIR/$SIDECAR_NAME"
