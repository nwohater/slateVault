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

## One-Time Apple Setup

For direct distribution outside the Mac App Store, slateVault uses Developer ID
signing and notarization.

Current bundle identifier:

```text
com.golackey.slatevault
```

Required Apple assets on the build Mac:

- `Developer ID Application: Brandon Lackey (863L77DKWJ)`
- `Developer ID Installer: Brandon Lackey (863L77DKWJ)`
- App Store Connect API key ID, issuer ID, and downloaded `.p8` key for notarization

Confirm the app signing identity:

```bash
security find-identity -v -p codesigning
```

Confirm the installer certificate:

```bash
security find-certificate -a -c "Developer ID Installer" -Z ~/Library/Keychains/login.keychain-db
```

The `.p8` key is not installed into Keychain. Keep it somewhere stable, such as:

```text
~/Documents/AuthKey_U9RSG7N3LK.p8
```

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
3. Builds the Tauri `.app` bundle and updater archive.
4. Signs the app bundle and MCP binary when signing identities are provided.
5. Creates a `.pkg` that installs the app and `/usr/local/bin/slatevault-mcp`.
6. Submits the `.pkg` for notarization and staples it when Apple API env vars are provided.

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

## Signing And Notarization

For distribution, export the signing and notarization values before building:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Brandon Lackey (863L77DKWJ)"
export APP_SIGN_IDENTITY="$APPLE_SIGNING_IDENTITY"
export INSTALLER_SIGN_IDENTITY="Developer ID Installer: Brandon Lackey (863L77DKWJ)"

export APPLE_API_KEY="U9RSG7N3LK"
export APPLE_API_ISSUER="your-app-store-connect-issuer-id"
export APPLE_API_KEY_PATH="$HOME/Documents/AuthKey_U9RSG7N3LK.p8"

export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/slatevault.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='your-tauri-updater-key-password'

npm run build:macos-installer
```

The script signs:

- `slateVault.app`
- `/usr/local/bin/slatevault-mcp`
- the final `.pkg`

The script notarizes and staples the `.pkg` automatically when `APPLE_API_KEY`,
`APPLE_API_ISSUER`, and `APPLE_API_KEY_PATH` are present.

If zsh treats `!` in the Tauri updater key password as history expansion, run:

```bash
unsetopt BANG_HIST
```

Then set the password again.

If an old staging directory was created with root ownership, remove only the
generated package root before rebuilding:

```bash
cd /Users/blackey/Development/Source/slateVault
sudo rm -rf dist/macos/pkgroot
```

Installing into `/usr/local/bin` may require an administrator password during
installation, depending on the target machine's permissions.

## Verification

After the build completes, verify the installer:

```bash
pkgutil --check-signature dist/macos/*.pkg
xcrun stapler validate dist/macos/*.pkg
spctl --assess --type install -vv dist/macos/*.pkg
```

Expected results:

```text
Status: signed by a developer certificate issued by Apple for distribution
Notarization: trusted by the Apple notary service
The validate action worked!
accepted
source=Notarized Developer ID
```

Verify the app bundle:

```bash
codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/slateVault.app
spctl --assess --type exec -vv src-tauri/target/release/bundle/macos/slateVault.app
```

Expected result:

```text
valid on disk
satisfies its Designated Requirement
accepted
source=Notarized Developer ID
```

Check that clean Mac installs will not depend on Homebrew OpenSSL:

```bash
otool -L src-tauri/target/release/bundle/macos/slateVault.app/Contents/MacOS/slatevault-app
otool -L src-tauri/target/release/bundle/macos/slateVault.app/Contents/MacOS/slatevault-mcp
```

The output should not contain:

```text
/opt/homebrew/opt/openssl@3
```

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
