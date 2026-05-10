import { globalShortcut, app } from 'electron';
import { getHotkey, setHotkey } from './settings';

export class HotkeyManager {
  // Current accelerator string — read from settings on construction.
  private accelerator: string;
  private onTriggered: () => void;

  constructor(onTriggered: () => void) {
    this.onTriggered = onTriggered;
    this.accelerator = getHotkey();
  }

  register(): void {
    const registered = globalShortcut.register(this.accelerator, () => {
      this.onTriggered();
    });

    if (!registered) {
      // Log a warning but do not crash — the OS may have a conflict.
      console.warn(
        `[HotkeyManager] Failed to register global hotkey "${this.accelerator}". ` +
          'Another application may be using this shortcut.',
      );
    } else {
      console.log(`[HotkeyManager] Registered global hotkey: ${this.accelerator}`);
    }
  }

  /**
   * Hot-swap the global hotkey binding at runtime.
   * Unregisters the current binding, attempts the new one, and persists on success.
   * If the new binding is already claimed, re-registers the old one and returns conflict.
   */
  changeBinding(accelerator: string): { success: boolean; conflict: boolean } {
    globalShortcut.unregister(this.accelerator);

    const registered = globalShortcut.register(accelerator, () => {
      this.onTriggered();
    });

    if (registered) {
      this.accelerator = accelerator;
      setHotkey(accelerator);
      return { success: true, conflict: false };
    }

    // New binding failed — restore the previous one.
    globalShortcut.register(this.accelerator, () => {
      this.onTriggered();
    });
    return { success: false, conflict: true };
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll();
  }
}

// Ensure all shortcuts are released on quit.
export function bindHotkeyLifecycle(manager: HotkeyManager): void {
  app.on('will-quit', () => {
    manager.unregisterAll();
  });
}
