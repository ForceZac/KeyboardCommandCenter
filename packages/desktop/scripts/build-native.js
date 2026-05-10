#!/usr/bin/env node
/**
 * Postinstall script — compiles the napi-rs native module if Rust is available.
 *
 * Design: fail-soft rather than hard. The TypeScript wrapper at
 * src/platform/active-window.ts returns null when the .node binary is absent,
 * so the Electron app starts in dev mode even without a compiled binary.
 *
 * Developers who need active-window detection must install Rust:
 *   https://rustup.rs
 * Then run:
 *   npm run build:native -w packages/desktop
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');

const NATIVE_DIR = path.join(__dirname, '..', 'native');

// Check if Rust / cargo is available.
const rustCheck = spawnSync('cargo', ['--version'], { stdio: 'pipe' });
if (rustCheck.error || rustCheck.status !== 0) {
  console.warn(
    '\n[kcc-native] Rust toolchain not found — skipping native module build.\n' +
    '  Active window detection will not work until the native module is compiled.\n' +
    '  To enable detection: install Rust (https://rustup.rs) then run:\n' +
    '    npm run build:native -w packages/desktop\n'
  );
  process.exit(0); // Non-fatal — let npm install succeed
}

// Check if napi CLI is available.
const napiCheck = spawnSync('npx', ['@napi-rs/cli', '--version'], { stdio: 'pipe' });
if (napiCheck.error || napiCheck.status !== 0) {
  console.warn(
    '\n[kcc-native] @napi-rs/cli not found — skipping native module build.\n' +
    '  Run: npx @napi-rs/cli --version to diagnose.\n'
  );
  process.exit(0);
}

console.log('[kcc-native] Building native module (this may take 30-60s on first build)...');

try {
  execSync('npx @napi-rs/cli build --release --js false', {
    cwd: NATIVE_DIR,
    stdio: 'inherit',
  });
  console.log('[kcc-native] Native module built successfully.');
} catch (err) {
  console.warn(
    '\n[kcc-native] Native module build failed.\n' +
    '  Active window detection will return null until the build succeeds.\n' +
    '  Error: ' + (err.message || String(err)) + '\n'
  );
  // Exit 0 so npm install does not fail — detection degrades gracefully.
  process.exit(0);
}
