# macOS Installer

slateVault should ship on macOS as a `.pkg` when agent integration matters.
The package installs both the desktop app and the MCP server binary:

```text
/Applications/slateVault.app
/usr/local/bin/slatevault-mcp
```

The `/usr/local/bin/slatevault-mcp` install is the key piece for AI tools.
MCP clients launch stdio servers by command name, so the command needs to be on
a normal PATH instead of living only inside the app bundle.

## Build The Installer

From the repo root:

```bash
scripts/build-macos-installer.sh
```

Or through npm:

```bash
npm run build:macos-installer
```

The script:

1. Builds `slatevault-mcp` in release mode.
2. Copies it into `src-tauri/binaries/slatevault-mcp-$TARGET` for Tauri sidecar bundling.
3. Builds the Tauri `.app` bundle.
4. Creates a `.pkg` that installs the app and `/usr/local/bin/slatevault-mcp`.

The output is written to:

```text
dist/macos/slateVault-<version>-<target>.pkg
```

## Target Selection

By default the script uses the current Rust host target:

```bash
rustc --print host-tuple
```

To build for a specific macOS target:

```bash
TARGET=aarch64-apple-darwin scripts/build-macos-installer.sh
TARGET=x86_64-apple-darwin scripts/build-macos-installer.sh
```

The requested target must already be installed in Rust:

```bash
rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin
```

## Signing

For local testing, unsigned packages are fine. For distribution, sign the app
contents and installer:

```bash
APP_SIGN_IDENTITY="Developer ID Application: Example Name (TEAMID)" \
INSTALLER_SIGN_IDENTITY="Developer ID Installer: Example Name (TEAMID)" \
  scripts/build-macos-installer.sh
```

The script signs:

- `slateVault.app`
- `/usr/local/bin/slatevault-mcp`
- the final `.pkg`

Notarization is still a separate release step after the `.pkg` is created.

Installing into `/usr/local/bin` may require an administrator password during
installation, depending on the target machine's permissions.

## MCP Client Setup

After installing the package, this should resolve:

```bash
which slatevault-mcp
slatevault-mcp --help
```

Claude Code can register it with:

```bash
claude mcp add -s user slatevault -- slatevault-mcp
```

Other MCP clients should use:

```json
{
  "command": "slatevault-mcp",
  "args": []
}
```

The MCP server chooses its vault in this order:

1. `SLATEVAULT_PATH`
2. `~/.slatevault/active-vault`
3. `~/.slatevault`

The desktop app should continue writing `~/.slatevault/active-vault` when a vault
is opened so external agents attach to the same vault the user is working in.

## Fast Repackaging

If the Tauri app bundle already exists and only the package staging needs to be
recreated:

```bash
SKIP_TAURI_BUILD=1 scripts/build-macos-installer.sh
```

Use this only when the existing app bundle is already current.
