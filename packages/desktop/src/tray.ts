import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';

export class TrayManager {
  private tray: Tray | null = null;
  private onOpenPanel: () => void;

  constructor(onOpenPanel: () => void) {
    this.onOpenPanel = onOpenPanel;
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

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Keyboard Command Center',
        click: () => this.onOpenPanel(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]);

    if (process.platform === 'darwin') {
      // On macOS, any click on the menu bar icon should show the context menu.
      this.tray.setContextMenu(contextMenu);
    } else {
      // On Windows, right-click shows the menu; left-click opens the panel.
      this.tray.setContextMenu(contextMenu);
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
