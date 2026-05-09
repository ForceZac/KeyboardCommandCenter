import { globalShortcut, app } from 'electron';

export class HotkeyManager {
  // Platform default: Cmd+Shift+Space on macOS, Ctrl+Shift+Space on Windows.
  private readonly accelerator: string =
    process.platform === 'darwin' ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space';

  private onTriggered: () => void;

  constructor(onTriggered: () => void) {
    this.onTriggered = onTriggered;
  }

  register(): void {
    const registered = globalShortcut.register(this.accelerator, () => {
      this.onTriggered();
    });

    if (!registered) {
      // Log a warning but do not crash — the OS may have a conflict.
      // A settings UI for remapping the hotkey is a follow-on Goal 3 task.
      console.warn(
        `[HotkeyManager] Failed to register global hotkey "${this.accelerator}". ` +
          'Another application may be using this shortcut.',
      );
    } else {
      console.log(`[HotkeyManager] Registered global hotkey: ${this.accelerator}`);
    }
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
