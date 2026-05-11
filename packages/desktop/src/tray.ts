import { Tray, Menu, nativeImage, app } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import path from 'path';
import type { UpdateStatus } from './update-service';

const MAX_RECENT_APPS = 5;

export class TrayManager {
  private tray: Tray | null = null;
  private onOpenPanel: () => void;
  private onOpenSettings: () => void;
  private getRecentApps: () => string[];
  private getDisplayName: (slug: string) => string;
  private isDetectionEnabled: () => boolean;
  private onOpenPanelWithApp: (slug: string) => void;
  // TASK-0023: auth callbacks — read at menu-open time so state is always current.
  private isAuthenticated: () => boolean;
  private onSignIn: () => void;
  private onSignOut: () => void;
  // TASK-0033: update callbacks — read at menu-open time.
  private onCheckForUpdates: () => void;
  private onRestartAndInstall: () => void;
  private getUpdateStatus: () => UpdateStatus;

  constructor(
    onOpenPanel: () => void,
    onOpenSettings: () => void,
    getRecentApps: () => string[],
    getDisplayName: (slug: string) => string,
    isDetectionEnabled: () => boolean,
    onOpenPanelWithApp: (slug: string) => void,
    isAuthenticated: () => boolean,
    onSignIn: () => void,
    onSignOut: () => void,
    onCheckForUpdates: () => void,
    onRestartAndInstall: () => void,
    getUpdateStatus: () => UpdateStatus,
  ) {
    this.onOpenPanel = onOpenPanel;
    this.onOpenSettings = onOpenSettings;
    this.getRecentApps = getRecentApps;
    this.getDisplayName = getDisplayName;
    this.isDetectionEnabled = isDetectionEnabled;
    this.onOpenPanelWithApp = onOpenPanelWithApp;
    this.isAuthenticated = isAuthenticated;
    this.onSignIn = onSignIn;
    this.onSignOut = onSignOut;
    this.onCheckForUpdates = onCheckForUpdates;
    this.onRestartAndInstall = onRestartAndInstall;
    this.getUpdateStatus = getUpdateStatus;
  }

  /**
   * Builds the tray context menu fresh on every call so that the
   * "Recent Apps" submenu always reflects the current session state.
   */
  private buildContextMenu(): Menu {
    const recentAppsSubmenu = this.buildRecentAppsSubmenu();
    // Read auth state at menu-build time so the item is always current.
    const authItem: MenuItemConstructorOptions = this.isAuthenticated()
      ? { label: 'Sign out', click: () => this.onSignOut() }
      : { label: 'Sign in', click: () => this.onSignIn() };

    // TASK-0033: update items — read status at menu-build time.
    const updateStatus = this.getUpdateStatus();
    const updateItems: MenuItemConstructorOptions[] =
      updateStatus === 'ready'
        ? [
            {
              label: 'Update available — restart to apply',
              enabled: false,
            },
            {
              label: 'Restart to update',
              click: () => this.onRestartAndInstall(),
            },
          ]
        : [
            {
              label: 'Check for updates',
              click: () => this.onCheckForUpdates(),
            },
          ];

    return Menu.buildFromTemplate([
      {
        label: 'Open Keyboard Command Center',
        click: () => this.onOpenPanel(),
      },
      {
        label: 'Recent Apps',
        type: 'submenu',
        submenu: recentAppsSubmenu,
      },
      {
        label: 'Settings',
        click: () => this.onOpenSettings(),
      },
      ...updateItems,
      { type: 'separator' },
      authItem,
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]);
  }

  /**
   * Rebuilds and re-sets the static context menu after an auth state change.
   * On macOS and Windows we use popUpContextMenu on click so the menu is
   * already rebuilt on each open — this method exists for the TRD contract
   * and for platforms that use a static context menu.
   */
  refreshMenu(_isAuthenticated: boolean): void {
    // buildContextMenu reads isAuthenticated() directly at call time,
    // so no parameter threading needed.
    if (this.tray !== null) {
      this.tray.setContextMenu(this.buildContextMenu());
    }
  }

  /**
   * Builds the "Recent Apps" submenu items.
   * Shows up to 5 recently detected apps, or a disabled placeholder when
   * detection is off or no apps have been detected yet.
   */
  private buildRecentAppsSubmenu(): MenuItemConstructorOptions[] {
    if (!this.isDetectionEnabled()) {
      return [{ label: 'Detection off', enabled: false }];
    }

    const recent = this.getRecentApps().slice(0, MAX_RECENT_APPS);

    if (recent.length === 0) {
      return [{ label: 'No recent apps', enabled: false }];
    }

    return recent.map((slug) => ({
      label: this.getDisplayName(slug),
      enabled: true,
      click: () => this.onOpenPanelWithApp(slug),
    }));
  }

  create(): void {
    // Use a platform-appropriate icon. macOS uses a template image (white-on-transparent
    // PNG) so the system can invert for dark/light menu bar. Windows uses a regular PNG.
    const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    let icon = nativeImage.createFromPath(iconPath);

    if (process.platform === 'darwin') {
      // Mark as template so macOS renders it correctly in both light and dark menu bars.
      icon = icon.resize({ width: 16, height: 16 });
      icon.setTemplateImage(true);
    }

    try {
      this.tray = new Tray(icon);
    } catch {
      // On minimal Linux window managers (i3, Sway, etc.) no system tray is available.
      // The app remains fully functional via the global hotkey — log and continue.
      console.log('[kcc] No system tray detected — use [hotkey] to open the shortcut panel.');
      this.tray = null;
      return;
    }

    this.tray.setToolTip('Keyboard Command Center');

    if (process.platform === 'darwin') {
      // On macOS, clicking the menu bar icon shows the context menu — rebuilt on each open.
      this.tray.on('click', () => {
        this.tray!.popUpContextMenu(this.buildContextMenu());
      });
    } else {
      // On Windows, right-click shows the menu (rebuilt fresh); left-click opens the panel.
      this.tray.on('right-click', () => {
        this.tray!.popUpContextMenu(this.buildContextMenu());
      });
      this.tray.on('click', () => this.onOpenPanel());
    }
  }

  destroy(): void {
    if (this.tray !== null) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
