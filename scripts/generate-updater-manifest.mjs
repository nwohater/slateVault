#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    i += 1;
  }
  return result;
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function readTrimmed(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim();
}

function discoverWindowsArtifact(assetsDir) {
  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
  const installer = entries
    .filter((entry) => entry.isFile() && /setup\.exe$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort()[0];

  if (!installer) return null;

  const installerPath = path.join(assetsDir, installer);
  const signaturePath = `${installerPath}.sig`;
  ensureFile(signaturePath, 'Windows updater signature');

  return {
    platform: 'windows-x86_64',
    urlPath: installer,
    signature: readTrimmed(signaturePath),
  };
}

function discoverMacArtifacts(assetsDir) {
  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.app\.tar\.gz$/i.test(entry.name))
    .map((entry) => {
      const archivePath = path.join(assetsDir, entry.name);
      const signaturePath = `${archivePath}.sig`;
      ensureFile(signaturePath, 'macOS updater signature');

      const lower = entry.name.toLowerCase();
      let platform = null;
      if (lower.includes('aarch64')) platform = 'darwin-aarch64';
      if (lower.includes('x64') || lower.includes('x86_64')) platform = 'darwin-x86_64';
      if (!platform) {
        throw new Error(
          `Could not infer macOS platform from artifact name: ${entry.name}. Include x64/x86_64 or aarch64 in the filename.`
        );
      }

      return {
        platform,
        urlPath: entry.name,
        signature: readTrimmed(signaturePath),
      };
    });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = args.version;
  const releaseBaseUrl = args['base-url'];
  const assetsDir = args['assets-dir'];
  const outputPath = args.output;
  const notesFile = args['notes-file'];
  const pubDate = args['pub-date'] || new Date().toISOString();

  if (!version) throw new Error('--version is required');
  if (!releaseBaseUrl) throw new Error('--base-url is required');
  if (!assetsDir) throw new Error('--assets-dir is required');
  if (!outputPath) throw new Error('--output is required');

  if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
    throw new Error(`Assets directory not found: ${assetsDir}`);
  }

  const platforms = {};
  const windows = discoverWindowsArtifact(assetsDir);
  if (windows) {
    platforms[windows.platform] = {
      signature: windows.signature,
      url: `${releaseBaseUrl}/${encodeURIComponent(windows.urlPath).replace(/%2F/g, '/')}`,
    };
  }

  for (const artifact of discoverMacArtifacts(assetsDir)) {
    platforms[artifact.platform] = {
      signature: artifact.signature,
      url: `${releaseBaseUrl}/${encodeURIComponent(artifact.urlPath).replace(/%2F/g, '/')}`,
    };
  }

  if (Object.keys(platforms).length === 0) {
    throw new Error(`No updater artifacts found in ${assetsDir}`);
  }

  const manifest = {
    version,
    notes: notesFile ? fs.readFileSync(notesFile, 'utf8').trim() : '',
    pub_date: pubDate,
    platforms,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote updater manifest: ${outputPath}`);
  console.log(`Platforms: ${Object.keys(platforms).join(', ')}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
