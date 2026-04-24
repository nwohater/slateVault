#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_TAURI_DIR="$ROOT_DIR/src-tauri"
DIST_DIR="$ROOT_DIR/dist/macos"
PKGROOT_DIR="$DIST_DIR/pkgroot"

HOST_TARGET="$(rustc --print host-tuple)"
TARGET="${TARGET:-$HOST_TARGET}"
BUILD_TARGET_ARGS=()
TARGET_DIR="$SRC_TAURI_DIR/target/release"

if [[ "$TARGET" != "$HOST_TARGET" ]]; then
  BUILD_TARGET_ARGS=(--target "$TARGET")
  TARGET_DIR="$SRC_TAURI_DIR/target/$TARGET/release"
fi

PRODUCT_NAME="$(node -e "const c=require(process.argv[1]); process.stdout.write(c.productName)" "$SRC_TAURI_DIR/tauri.conf.json")"
VERSION="$(node -e "const c=require(process.argv[1]); process.stdout.write(c.version)" "$SRC_TAURI_DIR/tauri.conf.json")"
APP_BUNDLE="$TARGET_DIR/bundle/macos/$PRODUCT_NAME.app"
UPDATER_ARCHIVE_PATTERN="$TARGET_DIR/bundle/macos/*.app.tar.gz"
MCP_BINARY="$TARGET_DIR/slatevault-mcp"
SIDECAR_BINARY="$SRC_TAURI_DIR/binaries/slatevault-mcp-$TARGET"
PKG_PATH="$DIST_DIR/$PRODUCT_NAME-$VERSION-$TARGET.pkg"
SIGNING_KEY_PATH="${TAURI_SIGNING_PRIVATE_KEY_PATH:-$HOME/.tauri/slatevault.key}"

APP_SIGN_IDENTITY="${APP_SIGN_IDENTITY:-}"
INSTALLER_SIGN_IDENTITY="${INSTALLER_SIGN_IDENTITY:-}"
SKIP_TAURI_BUILD="${SKIP_TAURI_BUILD:-0}"

usage() {
  cat <<EOF
Build a macOS .pkg installer for slateVault.

Environment:
  TARGET                         Rust target triple. Defaults to current host.
  APP_SIGN_IDENTITY              Optional Developer ID Application identity.
  INSTALLER_SIGN_IDENTITY        Optional Developer ID Installer identity.
  SKIP_TAURI_BUILD               Set to 1 to package an existing Tauri build.
  TAURI_SIGNING_PRIVATE_KEY_PATH Updater private key path. Defaults to ~/.tauri/slatevault.key.
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD Required if the updater private key is password protected.

Examples:
  scripts/build-macos-installer.sh
  TARGET=aarch64-apple-darwin scripts/build-macos-installer.sh
  APP_SIGN_IDENTITY="Developer ID Application: Example (TEAMID)" \
  INSTALLER_SIGN_IDENTITY="Developer ID Installer: Example (TEAMID)" \
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD="..." \
    scripts/build-macos-installer.sh
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command cargo
require_command ditto
require_command node
require_command npm
require_command pkgbuild
require_command rustc

echo "==> Building slatevault-mcp for $TARGET"
cargo build \
  --manifest-path "$SRC_TAURI_DIR/Cargo.toml" \
  --release \
  -p slatevault-mcp \
  ${BUILD_TARGET_ARGS+"${BUILD_TARGET_ARGS[@]}"}

if [[ ! -x "$MCP_BINARY" ]]; then
  echo "Expected MCP binary was not built: $MCP_BINARY" >&2
  exit 1
fi

echo "==> Updating Tauri sidecar binary"
mkdir -p "$SRC_TAURI_DIR/binaries"
install -m 755 "$MCP_BINARY" "$SIDECAR_BINARY"

if [[ "$SKIP_TAURI_BUILD" != "1" ]]; then
  if [[ ! -f "$SIGNING_KEY_PATH" ]]; then
    echo "Updater signing key not found: $SIGNING_KEY_PATH" >&2
    exit 1
  fi

  if [[ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" ]]; then
    echo "TAURI_SIGNING_PRIVATE_KEY_PASSWORD is required to build signed updater artifacts." >&2
    exit 1
  fi

  export TAURI_SIGNING_PRIVATE_KEY_PATH="$SIGNING_KEY_PATH"

  echo "==> Building Tauri app bundle and updater artifacts"
  if [[ "$TARGET" != "$HOST_TARGET" ]]; then
    (cd "$ROOT_DIR" && npm run tauri build -- --bundles app "${BUILD_TARGET_ARGS[@]}")
  else
    (cd "$ROOT_DIR" && npm run tauri build -- --bundles app)
  fi
else
  echo "==> Skipping Tauri build because SKIP_TAURI_BUILD=1"
fi

if [[ ! -d "$APP_BUNDLE" ]]; then
  echo "Expected app bundle was not found: $APP_BUNDLE" >&2
  exit 1
fi

echo "==> Staging package root"
rm -rf "$PKGROOT_DIR"
mkdir -p "$PKGROOT_DIR/Applications" "$PKGROOT_DIR/usr/local/bin"
ditto "$APP_BUNDLE" "$PKGROOT_DIR/Applications/$PRODUCT_NAME.app"
install -m 755 "$MCP_BINARY" "$PKGROOT_DIR/usr/local/bin/slatevault-mcp"

if [[ -n "$APP_SIGN_IDENTITY" ]]; then
  require_command codesign
  echo "==> Signing app bundle and MCP binary"
  codesign --force --deep --options runtime --sign "$APP_SIGN_IDENTITY" \
    "$PKGROOT_DIR/Applications/$PRODUCT_NAME.app"
  codesign --force --options runtime --sign "$APP_SIGN_IDENTITY" \
    "$PKGROOT_DIR/usr/local/bin/slatevault-mcp"
else
  echo "==> APP_SIGN_IDENTITY not set; package contents will be unsigned"
fi

echo "==> Building pkg"
mkdir -p "$DIST_DIR"
PKGBUILD_ARGS=(
  --root "$PKGROOT_DIR"
  --identifier "dev.slatevault.app"
  --version "$VERSION"
  --install-location /
)

if [[ -n "$INSTALLER_SIGN_IDENTITY" ]]; then
  PKGBUILD_ARGS+=(--sign "$INSTALLER_SIGN_IDENTITY")
else
  echo "==> INSTALLER_SIGN_IDENTITY not set; installer will be unsigned"
fi

pkgbuild "${PKGBUILD_ARGS[@]}" "$PKG_PATH"

UPDATER_ARCHIVE="$(compgen -G "$UPDATER_ARCHIVE_PATTERN" | head -n 1 || true)"
UPDATER_SIGNATURE=""
if [[ -n "$UPDATER_ARCHIVE" && -f "$UPDATER_ARCHIVE.sig" ]]; then
  UPDATER_SIGNATURE="$UPDATER_ARCHIVE.sig"
fi

echo

echo "Built installer:"
echo "  $PKG_PATH"
if [[ -n "$UPDATER_ARCHIVE" ]]; then
  echo "Updater archive:"
  echo "  $UPDATER_ARCHIVE"
fi
if [[ -n "$UPDATER_SIGNATURE" ]]; then
  echo "Updater signature:"
  echo "  $UPDATER_SIGNATURE"
fi

echo

echo "Installs:"
echo "  /Applications/$PRODUCT_NAME.app"
echo "  /usr/local/bin/slatevault-mcp"
echo "  Produces signed updater artifacts for GitHub Releases"
