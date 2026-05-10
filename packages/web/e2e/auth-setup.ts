/**
 * Playwright global setup — creates a valid Auth.js v5 session cookie for E2E authenticated tests.
 *
 * Auth.js v5 uses JWE (JSON Web Encryption) with A256CBC-HS512. The encryption key is derived
 * from AUTH_SECRET using HKDF(sha256), with the cookie name as the salt. We replicate that
 * encoding here so the dev server (started with the same AUTH_SECRET) will accept the cookie.
 */

import { hkdf } from '@panva/hkdf';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/** Fixed secret — must match AUTH_SECRET in playwright.config.ts webServer command. */
export const TEST_AUTH_SECRET = 'playwright-e2e-test-secret-min32charslong!';

const COOKIE_NAME = 'authjs.session-token';
const ALG = 'dir';
const ENC = 'A256CBC-HS512';

async function getDerivedKey(secret: string, salt: string): Promise<Uint8Array> {
  // Replicates Auth.js getDerivedEncryptionKey — 64 bytes for A256CBC-HS512
  return hkdf('sha256', secret, salt, `Auth.js Generated Encryption Key (${salt})`, 64);
}

async function encodeSessionToken(secret: string): Promise<string> {
  // Dynamic import — jose is ESM-only
  const { EncryptJWT, base64url, calculateJwkThumbprint } = await import('jose');

  const encKey = await getDerivedKey(secret, COOKIE_NAME);
  const thumbprint = await calculateJwkThumbprint(
    { kty: 'oct', k: base64url.encode(encKey) },
    `sha${encKey.byteLength << 3}` as 'sha512',
  );

  const now = Math.floor(Date.now() / 1000);
  return new EncryptJWT({
    name: 'Test User',
    email: 'test@example.com',
    picture: null,
    sub: 'test-user-id',
  })
    .setProtectedHeader({ alg: ALG, enc: ENC, kid: thumbprint })
    .setIssuedAt(now)
    .setExpirationTime(now + 30 * 24 * 60 * 60)
    .setJti(crypto.randomUUID())
    .encrypt(encKey);
}

export default async function globalSetup() {
  const sessionToken = await encodeSessionToken(TEST_AUTH_SECRET);
  const expires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  const storageState = {
    cookies: [
      {
        name: COOKIE_NAME,
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        expires,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };

  // __dirname is injected by Playwright's esbuild transpiler; fall back to import.meta for ESM
  const thisDir: string =
    typeof __dirname !== 'undefined'
      ? __dirname
      : dirname(fileURLToPath((import.meta as { url: string }).url));

  const fixturesDir = join(thisDir, 'fixtures');
  mkdirSync(fixturesDir, { recursive: true });
  writeFileSync(join(fixturesDir, 'authenticated.json'), JSON.stringify(storageState, null, 2));
}
