import { Tray, Menu, nativeImage, app } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import path from 'path';

const MAX_RECENT_APPS = 5;

export class TrayManager {
  private tray: Tray | null = null;
  private onOpenPanel: () => void;
  private onOpenSettings: () => void;
  private getRecentApps: () => string[];
  private getDisplayName: (slug: string) => string;
  private isDetectionEnabled: () => boolean;
  private onOpenPanelWithApp: (slug: string) => void;

  constructor(
    onOpenPanel: () => void,
    onOpenSettings: () => void,
    getRecentApps: () => string[],
    getDisplayName: (slug: string) => string,
    isDetectionEnabled: () => boolean,
    onOpenPanelWithApp: (slug: string) => void,
  ) {
    this.onOpenPanel = onOpenPanel;
    this.onOpenSettings = onOpenSettings;
    this.getRecentApps = getRecentApps;
    this.getDisplayName = getDisplayName;
    this.isDetectionEnabled = isDetectionEnabled;
    this.onOpenPanelWithApp = onOpenPanelWithApp;
  }

  /**
   * Builds the tray context menu fresh on every call so that the
   * "Recent Apps" submenu always reflects the current session state.
   */
  private buildContextMenu(): Menu {
    const recentAppsSubmenu = this.buildRecentAppsSubmenu();

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
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]);
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

    this.tray = new Tray(icon);
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
