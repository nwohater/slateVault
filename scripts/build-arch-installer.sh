#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$ROOT_DIR/packaging/arch"

usage() {
  cat <<EOF
Build an Arch Linux pacman package for slateVault (app + slatevault-mcp).

Examples:
  scripts/build-arch-installer.sh
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

require_command makepkg
require_command cargo
require_command npm

echo "==> Building Arch package with makepkg"
(cd "$PKG_DIR" && makepkg -f --noconfirm)

PKG_FILE="$(compgen -G "$PKG_DIR"/*.pkg.tar.zst | head -n 1 || true)"
if [[ -z "$PKG_FILE" ]]; then
  echo "Expected .pkg.tar.zst was not found under: $PKG_DIR" >&2
  exit 1
fi

echo
echo "Built package:"
echo "  $PKG_FILE"
echo
echo "Install with:"
echo "  sudo pacman -U \"$PKG_FILE\""
