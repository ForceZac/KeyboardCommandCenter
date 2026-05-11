// TASK-0023: Auth token storage — electron-store encrypted at rest via safeStorage.
// Kept separate from SettingsStore: auth lifecycle (sign in/out) and user
// preferences (hotkey, startup) are independent concerns.
import { safeStorage } from 'electron';
import Store from 'electron-store';

interface AuthSchema {
  // Base64-encoded ciphertext when safeStorage is available; empty string when signed out.
  encryptedToken: string;
}

export class AuthStore {
  private store: Store<AuthSchema>;

  constructor() {
    // 'name' gives this store its own JSON file, separate from the settings store.
    this.store = new Store<AuthSchema>({
      name: 'auth',
      defaults: { encryptedToken: '' },
    });
  }

  /**
   * Returns the decrypted session token, or null if not signed in or decryption fails.
   * Logs an error and returns null if safeStorage is unavailable — never stores plain text.
   */
  getToken(): string | null {
    const encrypted = this.store.get('encryptedToken');
    if (!encrypted) return null;
    if (!safeStorage.isEncryptionAvailable()) {
      console.error('[AuthStore] safeStorage not available — cannot decrypt token');
      return null;
    }
    try {
      const buf = Buffer.from(encrypted, 'base64');
      return safeStorage.decryptString(buf);
    } catch (err) {
      console.error('[AuthStore] Failed to decrypt token:', err);
      return null;
    }
  }

  /**
   * Encrypts plain with safeStorage and stores the result.
   * No-op (with error log) if safeStorage is unavailable — never writes plain text.
   */
  setToken(plain: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      console.error('[AuthStore] safeStorage not available — token will not be persisted');
      return;
    }
    const encrypted = safeStorage.encryptString(plain);
    this.store.set('encryptedToken', encrypted.toString('base64'));
  }

  /** Clears the stored token, signing the user out of local storage. */
  clearToken(): void {
    this.store.set('encryptedToken', '');
  }

  /** Returns true if a token is present and decryptable. */
  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }
}
