#!/usr/bin/env node
/**
 * macOS notarization afterSign hook — called by electron-builder after code signing.
 *
 * Guards: only runs on macOS builds with CI_NOTARIZE=1 set. Local builds skip
 * notarization so developers don't need Apple credentials to run a local build.
 *
 * Required env vars (set as GitHub Actions secrets in the release workflow):
 *   APPLE_ID                   — your Apple ID email (e.g. you@example.com)
 *   APPLE_APP_SPECIFIC_PASSWORD — app-specific password from appleid.apple.com
 *   APPLE_TEAM_ID              — 10-char Team ID from developer.apple.com
 *   CI_NOTARIZE               — must be "1" to enable notarization
 */

'use strict';

const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds.
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Guard: skip unless CI_NOTARIZE is explicitly set to "1".
  // This prevents local builds from failing when Apple credentials aren't available.
  if (process.env.CI_NOTARIZE !== '1') {
    console.log('[notarize] CI_NOTARIZE not set — skipping notarization.');
    return;
  }

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;

  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    throw new Error(
      '[notarize] Missing required env vars: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID'
    );
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`[notarize] Submitting ${appPath} for Apple notarization...`);

  await notarize({
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });

  console.log('[notarize] Notarization complete.');
};
