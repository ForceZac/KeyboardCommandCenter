import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const DESKTOP_FILENAME = 'keyboard-command-center.desktop';

function getAutostartDir(): string {
  return path.join(app.getPath('home'), '.config', 'autostart');
}

function getAutostartPath(): string {
  return path.join(getAutostartDir(), DESKTOP_FILENAME);
}

function buildDesktopEntry(): string {
  const execPath = process.execPath;
  const lines = [
    '[Desktop Entry]',
    'Name=Keyboard Command Center',
    'Comment=Keyboard shortcuts for every app',
    `Exec=${execPath} %U`,
    'Icon=keyboard-command-center',
    'Type=Application',
    'Categories=Utility;',
    'StartupNotify=false',
    'X-GNOME-Autostart-enabled=true',
  ];
  return lines.join('\n') + '\n';
}

export function isAutostartEnabled(): boolean {
  return fs.existsSync(getAutostartPath());
}

export function enableAutostart(): void {
  const dir = getAutostartDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getAutostartPath(), buildDesktopEntry(), 'utf-8');
}

export function disableAutostart(): void {
  const filePath = getAutostartPath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function setAutostart(enabled: boolean): void {
  if (enabled) {
    enableAutostart();
  } else {
    disableAutostart();
  }
}
