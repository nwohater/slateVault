#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_TAURI_DIR="$ROOT_DIR/src-tauri"
DIST_DIR="$ROOT_DIR/dist/linux"
DEBROOT_DIR="$DIST_DIR/debroot"

HOST_TARGET="$(rustc --print host-tuple)"
TARGET="${TARGET:-$HOST_TARGET}"
BUILD_TARGET_ARGS=()
TARGET_DIR="$SRC_TAURI_DIR/target/release"

if [[ "$TARGET" != "$HOST_TARGET" ]]; then
  BUILD_TARGET_ARGS=(--target "$TARGET")
  TARGET_DIR="$SRC_TAURI_DIR/target/$TARGET/release"
fi

MCP_BINARY="$TARGET_DIR/slatevault-mcp"
SIDECAR_BINARY="$SRC_TAURI_DIR/binaries/slatevault-mcp-$TARGET"
SKIP_TAURI_BUILD="${SKIP_TAURI_BUILD:-0}"

usage() {
  cat <<EOF
Build a Linux .deb installer for slateVault.

Unlike Tauri's stock .deb (which only bundles the MCP sidecar as an app
resource), this script also installs slatevault-mcp to /usr/bin so it's
on PATH after installing the package.

Environment:
  TARGET             Rust target triple. Defaults to current host.
  SKIP_TAURI_BUILD    Set to 1 to repackage an existing Tauri .deb build.

Examples:
  scripts/build-linux-installer.sh
  TARGET=aarch64-unknown-linux-gnu scripts/build-linux-installer.sh
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
require_command rustc
require_command npm
require_command dpkg-deb
require_command md5sum

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
  echo "==> Building Tauri .deb bundle"
  # .deb isn't a supported target for Tauri's built-in updater, so disable
  # updater-artifact generation for this build (it otherwise fails without
  # a configured signing key, even though no updater artifact is produced
  # for deb anyway).
  if [[ "$TARGET" != "$HOST_TARGET" ]]; then
    (cd "$ROOT_DIR" && npm run tauri build -- --bundles deb --config '{"bundle":{"createUpdaterArtifacts":false}}' "${BUILD_TARGET_ARGS[@]}")
  else
    (cd "$ROOT_DIR" && npm run tauri build -- --bundles deb --config '{"bundle":{"createUpdaterArtifacts":false}}')
  fi
else
  echo "==> Skipping Tauri build because SKIP_TAURI_BUILD=1"
fi

DEB_SRC="$(compgen -G "$TARGET_DIR/bundle/deb/*.deb" | head -n 1 || true)"
if [[ -z "$DEB_SRC" ]]; then
  echo "Expected .deb bundle was not found under: $TARGET_DIR/bundle/deb" >&2
  exit 1
fi

echo "==> Staging .deb contents to add the MCP binary"
rm -rf "$DEBROOT_DIR"
mkdir -p "$DIST_DIR"
dpkg-deb -R "$DEB_SRC" "$DEBROOT_DIR"

mkdir -p "$DEBROOT_DIR/usr/bin"
install -m 755 "$MCP_BINARY" "$DEBROOT_DIR/usr/bin/slatevault-mcp"

echo "==> Regenerating md5sums and Installed-Size"
(
  cd "$DEBROOT_DIR"
  find . -type f -not -path './DEBIAN/*' -printf '%P\n' | sort | xargs md5sum > DEBIAN/md5sums
)
TOTAL_KB="$(du -sk "$DEBROOT_DIR" | cut -f1)"
DEBIAN_KB="$(du -sk "$DEBROOT_DIR/DEBIAN" | cut -f1)"
INSTALLED_SIZE_KB=$((TOTAL_KB - DEBIAN_KB))
if grep -q '^Installed-Size:' "$DEBROOT_DIR/DEBIAN/control"; then
  sed -i "s/^Installed-Size:.*/Installed-Size: $INSTALLED_SIZE_KB/" "$DEBROOT_DIR/DEBIAN/control"
else
  echo "Installed-Size: $INSTALLED_SIZE_KB" >> "$DEBROOT_DIR/DEBIAN/control"
fi

DEB_NAME="$(basename "$DEB_SRC")"
DEB_PATH="$DIST_DIR/$DEB_NAME"
echo "==> Building final .deb"
dpkg-deb --build --root-owner-group "$DEBROOT_DIR" "$DEB_PATH"

echo
echo "Built installer:"
echo "  $DEB_PATH"
echo
echo "Installs:"
echo "  slateVault app (see /usr/share/applications and /usr/bin)"
echo "  /usr/bin/slatevault-mcp"
