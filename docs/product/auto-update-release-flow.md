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

Before release, verify signing and notarization:

```bash
pkgutil --check-signature dist/macos/*.pkg
xcrun stapler validate dist/macos/*.pkg
spctl --assess --type install -vv dist/macos/*.pkg
codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/slateVault.app
spctl --assess --type exec -vv src-tauri/target/release/bundle/macos/slateVault.app
```

## Build `latest.json`

Collect the release artifacts you plan to upload into one folder.
For the current Windows plus Apple Silicon macOS release shape:

```bash
rm -rf release-assets
mkdir -p release-assets

cp dist/macos/slateVault-0.1.0-aarch64-apple-darwin.pkg release-assets/
cp src-tauri/target/release/bundle/macos/slateVault.app.tar.gz release-assets/slateVault-aarch64.app.tar.gz
cp src-tauri/target/release/bundle/macos/slateVault.app.tar.gz.sig release-assets/slateVault-aarch64.app.tar.gz.sig

# On Windows, also copy the NSIS installer and Tauri updater signature:
# copy src-tauri\target\release\bundle\nsis\*setup.exe release-assets\
# copy src-tauri\target\release\bundle\nsis\*setup.exe.sig release-assets\
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

For Apple Silicon-only macOS support, upload:

```text
slateVault-0.1.0-aarch64-apple-darwin.pkg
slateVault-aarch64.app.tar.gz
slateVault-aarch64.app.tar.gz.sig
latest.json
```

When Windows is included, also upload:

```text
slateVault_0.1.0_x64-setup.exe
slateVault_0.1.0_x64-setup.exe.sig
```

For a future `v0.1.1` release, rebuild everything after bumping the app version,
copy fresh artifacts into `release-assets/`, regenerate `latest.json` using
`--version 0.1.1` and `--base-url https://github.com/nwohater/slateVault/releases/download/v0.1.1`,
then upload the fresh files to the `v0.1.1` GitHub Release.

Do not include `darwin-x86_64` in `latest.json` unless an Intel macOS updater
archive and signature were actually built and uploaded.

## Windows Code Signing Plan

Windows signing uses Authenticode, not Apple notarization.
The Windows installer should be signed after `npm run build:windows-installer`
produces the NSIS `.exe`.

Recommended options:

- Azure Artifact Signing / Trusted Signing for managed certificate storage.
- Traditional OV or EV code-signing certificate from a CA such as DigiCert, Sectigo, or SSL.com.

After a Windows certificate is configured, sign the generated installer with
`signtool` and a timestamp server:

```powershell
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a "src-tauri\target\release\bundle\nsis\*.exe"
signtool verify /pa /v "src-tauri\target\release\bundle\nsis\YourInstaller.exe"
```

Signing identifies the publisher and preserves file integrity, but new Windows
downloads can still show SmartScreen warnings until reputation builds.

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
