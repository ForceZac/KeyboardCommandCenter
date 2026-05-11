import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getPath: () => '/home/testuser',
  },
}));

import {
  isAutostartEnabled,
  enableAutostart,
  disableAutostart,
  setAutostart,
} from './linux-autostart';

const AUTOSTART_DIR = '/home/testuser/.config/autostart';
const AUTOSTART_FILE = path.join(AUTOSTART_DIR, 'keyboard-command-center.desktop');

describe('linux-autostart', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAutostartEnabled', () => {
    it('returns true when .desktop file exists', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      expect(isAutostartEnabled()).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(AUTOSTART_FILE);
    });

    it('returns false when .desktop file does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(isAutostartEnabled()).toBe(false);
    });
  });

  describe('enableAutostart', () => {
    it('creates autostart directory and writes .desktop file', () => {
      const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);

      enableAutostart();

      expect(mkdirSpy).toHaveBeenCalledWith(AUTOSTART_DIR, { recursive: true });
      expect(writeSpy).toHaveBeenCalledWith(
        AUTOSTART_FILE,
        expect.stringContaining('[Desktop Entry]'),
        'utf-8',
      );
    });

    it('writes correct Exec path from process.execPath', () => {
      vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);

      enableAutostart();

      const content = writeSpy.mock.calls[0]![1] as string;
      expect(content).toContain(`Exec=${process.execPath} %U`);
    });

    it('includes X-GNOME-Autostart-enabled=true', () => {
      vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);

      enableAutostart();

      const content = writeSpy.mock.calls[0]![1] as string;
      expect(content).toContain('X-GNOME-Autostart-enabled=true');
    });

    it('is idempotent — can be called multiple times', () => {
      vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
      vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);

      enableAutostart();
      enableAutostart();

      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('disableAutostart', () => {
    it('removes .desktop file when it exists', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

      disableAutostart();

      expect(unlinkSpy).toHaveBeenCalledWith(AUTOSTART_FILE);
    });

    it('does nothing when .desktop file does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

      disableAutostart();

      expect(unlinkSpy).not.toHaveBeenCalled();
    });
  });

  describe('setAutostart', () => {
    it('enables autostart when true', () => {
      vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
      vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);

      setAutostart(true);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('disables autostart when false', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

      setAutostart(false);

      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });
});
