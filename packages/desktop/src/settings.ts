import Store from 'electron-store';

interface SettingsSchema {
  hotkey: string;
  loginStartup: boolean;
}

// Platform-appropriate default hotkey.
const defaultHotkey =
  process.platform === 'darwin' ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space';

const store = new Store<SettingsSchema>({
  defaults: {
    hotkey: defaultHotkey,
    loginStartup: true,
  },
});

export function getHotkey(): string {
  return store.get('hotkey');
}

export function setHotkey(accelerator: string): void {
  store.set('hotkey', accelerator);
}

export function getLoginStartup(): boolean {
  return store.get('loginStartup');
}

export function setLoginStartup(enabled: boolean): void {
  store.set('loginStartup', enabled);
}
