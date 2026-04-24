# Auto-Update Release Flow

slateVault now uses Tauri's signed updater with a static GitHub Releases manifest.
The updater checks:

```text
https://github.com/nwohater/slateVault/releases/latest/download/latest.json
```

## Platform Model

A single GitHub Release should carry updater artifacts for every supported platform.
`latest.json` must include every platform you want existing installs to update on.

Current targets:

- `windows-x86_64`
- `darwin-x86_64`
- `darwin-aarch64`

## Required Secrets And Files

- Private updater key: `C:\Users\brand\.tauri\slatevault.key` on Windows or `~/.tauri/slatevault.key` on macOS
- Public updater key: already embedded in `src-tauri/tauri.conf.json`
- Environment variable for release builds:

Windows PowerShell:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-password-here"
```

macOS shell:

```bash
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-password-here"
```

## Windows Release Build

From the repo root on Windows:

```powershell
npm run build:windows-installer
```

Important outputs:

- `src-tauri/target/release/bundle/nsis/*setup.exe`
- `src-tauri/target/release/bundle/nsis/*setup.exe.sig`

## macOS Release Build

From the repo root on macOS:

```bash
npm run build:macos-installer
```

Important outputs:

- Installer for human download: `dist/macos/*.pkg`
- Updater payload for Tauri: `src-tauri/target/release/bundle/macos/*.app.tar.gz`
- Updater signature: `src-tauri/target/release/bundle/macos/*.app.tar.gz.sig`

The updater uses the `.app.tar.gz` archive, not the `.pkg`.
The `.pkg` is still useful as the primary downloadable installer for new installs.

## Build `latest.json`

Collect the updater artifacts you plan to upload into one folder, for example:

```text
release-assets/
  slateVault_0.1.0_x64-setup.exe
  slateVault_0.1.0_x64-setup.exe.sig
  slateVault_aarch64.app.tar.gz
  slateVault_aarch64.app.tar.gz.sig
  slateVault_x64.app.tar.gz
  slateVault_x64.app.tar.gz.sig
```

Then generate the manifest:

```bash
npm run build:updater-manifest -- \
  --version 0.1.0 \
  --assets-dir ./release-assets \
  --base-url https://github.com/nwohater/slateVault/releases/download/v0.1.0 \
  --output ./release-assets/latest.json
```

Optional release notes:

```bash
npm run build:updater-manifest -- \
  --version 0.1.0 \
  --assets-dir ./release-assets \
  --base-url https://github.com/nwohater/slateVault/releases/download/v0.1.0 \
  --notes-file ./release-notes.txt \
  --output ./release-assets/latest.json
```

## Upload To GitHub Release

Create a GitHub Release whose tag matches the URLs used above, for example `v0.1.0`.
Upload all of these assets to the same release:

- Windows installer `.exe`
- Windows installer `.sig`
- macOS updater `.app.tar.gz`
- macOS updater `.app.tar.gz.sig`
- macOS `.pkg` installer for new installs
- `latest.json`

## Testing

1. Install an older signed SlateVault build.
2. Publish a newer release with matching signed updater assets.
3. Open SlateVault.
4. Use `Settings -> App -> Check for Updates`.
5. Confirm the status bar badge changes when an update is available.
6. Install the update and verify the app relaunches into the new version.

## Notes

- The updater validates the full `latest.json`, so incomplete platform entries can break update checks.
- Keep the private key and password safe. Losing either means existing installs cannot trust future updates.
- If you ship only one macOS architecture at first, leave the other one out of `latest.json` until you have a real signed artifact for it.
