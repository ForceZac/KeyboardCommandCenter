import { describe, it, expect } from 'vitest';
import { lookupApp, getDisplayName } from '../process-map';

// PRD-specified top 10 apps
describe('lookupApp — PRD top-10 apps', () => {
  it('VS Code: "code" → vscode', () => {
    expect(lookupApp('code')).toBe('vscode');
  });

  it('VS Code: "Code.exe" → vscode (case-insensitive, .exe stripped)', () => {
    expect(lookupApp('Code.exe')).toBe('vscode');
  });

  it('VS Code: "Code Helper" → vscode', () => {
    expect(lookupApp('Code Helper')).toBe('vscode');
  });

  it('Chrome: "chrome" → google-chrome', () => {
    expect(lookupApp('chrome')).toBe('google-chrome');
  });

  it('Chrome: "Google Chrome" → google-chrome', () => {
    expect(lookupApp('Google Chrome')).toBe('google-chrome');
  });

  it('Photoshop: "photoshop" → photoshop', () => {
    expect(lookupApp('photoshop')).toBe('photoshop');
  });

  it('Photoshop: "Adobe Photoshop 2024" → photoshop', () => {
    expect(lookupApp('Adobe Photoshop 2024')).toBe('photoshop');
  });

  it('Figma: "figma" → figma', () => {
    expect(lookupApp('figma')).toBe('figma');
  });

  it('Figma: "Figma" → figma (case-insensitive)', () => {
    expect(lookupApp('Figma')).toBe('figma');
  });

  it('Slack: "slack" → slack', () => {
    expect(lookupApp('slack')).toBe('slack');
  });

  it('Terminal (macOS bundle ID): com.apple.Terminal → macos', () => {
    expect(lookupApp('', 'com.apple.Terminal')).toBe('macos');
  });

  it('Finder (macOS bundle ID): com.apple.finder → macos', () => {
    expect(lookupApp('', 'com.apple.finder')).toBe('macos');
  });

  it('Word: "winword" → microsoft-word', () => {
    expect(lookupApp('winword')).toBe('microsoft-word');
  });

  it('Word: "Microsoft Word" → microsoft-word', () => {
    expect(lookupApp('Microsoft Word')).toBe('microsoft-word');
  });

  it('Excel: "excel" → microsoft-excel', () => {
    expect(lookupApp('excel')).toBe('microsoft-excel');
  });

  it('Excel: "Microsoft Excel" → microsoft-excel', () => {
    expect(lookupApp('Microsoft Excel')).toBe('microsoft-excel');
  });

  it('Spotify: "spotify" → spotify', () => {
    expect(lookupApp('spotify')).toBe('spotify');
  });
});

// Normalization behaviour
describe('lookupApp — normalization', () => {
  it('strips .exe suffix: "slack.exe" → slack', () => {
    expect(lookupApp('slack.exe')).toBe('slack');
  });

  it('strips .exe case-insensitively: "SLACK.EXE" → slack', () => {
    expect(lookupApp('SLACK.EXE')).toBe('slack');
  });

  it('is case-insensitive: "SLACK" → slack', () => {
    expect(lookupApp('SLACK')).toBe('slack');
  });

  it('trims leading/trailing whitespace', () => {
    expect(lookupApp('  slack  ')).toBe('slack');
  });
});

// Bundle ID priority
describe('lookupApp — bundleId priority', () => {
  it('prefers bundleId match over mismatched processName', () => {
    // bundleId says "slack" but processName says something unrelated
    expect(lookupApp('some-other-process', 'com.tinyspeck.slackmacgap')).toBe(
      'slack'
    );
  });

  it('falls through to processName when bundleId has no match', () => {
    expect(lookupApp('slack', 'com.unknown.app')).toBe('slack');
  });

  it('Chrome by bundleId: com.google.Chrome → google-chrome', () => {
    expect(lookupApp('', 'com.google.Chrome')).toBe('google-chrome');
  });

  it('VS Code by bundleId: com.microsoft.VSCode → vscode', () => {
    expect(lookupApp('', 'com.microsoft.VSCode')).toBe('vscode');
  });
});

// Null / unrecognised inputs
describe('lookupApp — null returns', () => {
  it('returns null for unknown process name', () => {
    expect(lookupApp('zerglings.exe')).toBeNull();
  });

  it('returns null for empty process name and no bundleId', () => {
    expect(lookupApp('')).toBeNull();
  });

  it('returns null for empty string bundleId that has no entry', () => {
    expect(lookupApp('', 'com.notreal.app')).toBeNull();
  });

  it('returns null for both empty', () => {
    expect(lookupApp('', '')).toBeNull();
  });
});

// Additional app coverage
describe('lookupApp — extended app coverage', () => {
  it('Neovim: "nvim" → neovim', () => {
    expect(lookupApp('nvim')).toBe('neovim');
  });

  it('VS Code Insiders: "code - insiders" → vscode', () => {
    expect(lookupApp('code - insiders')).toBe('vscode');
  });

  it('Blender: "blender" → blender', () => {
    expect(lookupApp('blender')).toBe('blender');
  });

  it('Zoom: "zoom" → zoom', () => {
    expect(lookupApp('zoom')).toBe('zoom');
  });

  it('Discord: "discord" → discord', () => {
    expect(lookupApp('discord')).toBe('discord');
  });

  it('OBS: "obs" → obs-studio', () => {
    expect(lookupApp('obs')).toBe('obs-studio');
  });

  it('Obsidian: "obsidian" → obsidian', () => {
    expect(lookupApp('obsidian')).toBe('obsidian');
  });

  it('Safari by bundleId: com.apple.Safari → safari', () => {
    expect(lookupApp('safari', 'com.apple.Safari')).toBe('safari');
  });

  it('Xcode by bundleId: com.apple.dt.Xcode → xcode', () => {
    expect(lookupApp('xcode', 'com.apple.dt.Xcode')).toBe('xcode');
  });

  it('Windows Explorer: "explorer" → windows-explorer', () => {
    expect(lookupApp('explorer')).toBe('windows-explorer');
  });

  it('Windows Terminal: "windowsterminal" → windows-terminal', () => {
    expect(lookupApp('windowsterminal')).toBe('windows-terminal');
  });

  it('IntelliJ: "idea64" → intellij-idea', () => {
    expect(lookupApp('idea64')).toBe('intellij-idea');
  });

  it('WebStorm: "webstorm" → webstorm', () => {
    expect(lookupApp('webstorm')).toBe('webstorm');
  });

  it('Ableton Live: "ableton live 11 suite" → ableton-live', () => {
    expect(lookupApp('ableton live 11 suite')).toBe('ableton-live');
  });

  it('FL Studio: "fl64" → fl-studio', () => {
    expect(lookupApp('fl64')).toBe('fl-studio');
  });
});

// getDisplayName — display name lookup and title-case fallback
describe('getDisplayName — known slugs', () => {
  it('google-chrome → "Google Chrome"', () => {
    expect(getDisplayName('google-chrome')).toBe('Google Chrome');
  });

  it('vscode → "VS Code"', () => {
    expect(getDisplayName('vscode')).toBe('VS Code');
  });

  it('obs-studio → "OBS Studio"', () => {
    expect(getDisplayName('obs-studio')).toBe('OBS Studio');
  });

  it('microsoft-word → "Microsoft Word"', () => {
    expect(getDisplayName('microsoft-word')).toBe('Microsoft Word');
  });

  it('ableton-live → "Ableton Live"', () => {
    expect(getDisplayName('ableton-live')).toBe('Ableton Live');
  });

  it('intellij-idea → "IntelliJ IDEA"', () => {
    expect(getDisplayName('intellij-idea')).toBe('IntelliJ IDEA');
  });
});

// Linux-specific process name entries (Goal 10 — TASK-0036)
describe('lookupApp — Linux process names', () => {
  it('firefox-esr → mozilla-firefox', () => {
    expect(lookupApp('firefox-esr')).toBe('mozilla-firefox');
  });

  it('librewolf → mozilla-firefox', () => {
    expect(lookupApp('librewolf')).toBe('mozilla-firefox');
  });

  it('waterfox → mozilla-firefox', () => {
    expect(lookupApp('waterfox')).toBe('mozilla-firefox');
  });

  it('google-chrome (Linux binary name) → google-chrome', () => {
    expect(lookupApp('google-chrome')).toBe('google-chrome');
  });

  it('google-chrome-s (15-char /proc/comm truncation) → google-chrome', () => {
    expect(lookupApp('google-chrome-s')).toBe('google-chrome');
  });

  it('chromium → google-chrome', () => {
    expect(lookupApp('chromium')).toBe('google-chrome');
  });

  it('chromium-browser → google-chrome', () => {
    expect(lookupApp('chromium-browser')).toBe('google-chrome');
  });

  it('code-insiders (Linux hyphen variant) → vscode', () => {
    expect(lookupApp('code-insiders')).toBe('vscode');
  });

  it('gimp → gimp', () => {
    expect(lookupApp('gimp')).toBe('gimp');
  });

  it('gimp-2.10 → gimp', () => {
    expect(lookupApp('gimp-2.10')).toBe('gimp');
  });

  it('gimp-3.0 → gimp', () => {
    expect(lookupApp('gimp-3.0')).toBe('gimp');
  });

  it('idea.sh (JetBrains Linux launcher) → intellij-idea', () => {
    expect(lookupApp('idea.sh')).toBe('intellij-idea');
  });

  it('webstorm.sh → webstorm', () => {
    expect(lookupApp('webstorm.sh')).toBe('webstorm');
  });

  it('pycharm.sh → pycharm', () => {
    expect(lookupApp('pycharm.sh')).toBe('pycharm');
  });

  it('goland.sh → goland', () => {
    expect(lookupApp('goland.sh')).toBe('goland');
  });

  it('clion → clion', () => {
    expect(lookupApp('clion')).toBe('clion');
  });

  it('clion.sh → clion', () => {
    expect(lookupApp('clion.sh')).toBe('clion');
  });

  it('Discord (capital D Linux variant) → discord', () => {
    expect(lookupApp('Discord')).toBe('discord');
  });

  it('soffice (LibreOffice main process) → libreoffice', () => {
    expect(lookupApp('soffice')).toBe('libreoffice');
  });

  it('soffice.bin → libreoffice', () => {
    expect(lookupApp('soffice.bin')).toBe('libreoffice');
  });

  it('com.obsproject. (OBS Flatpak 15-char truncation) → obs-studio', () => {
    expect(lookupApp('com.obsproject.')).toBe('obs-studio');
  });

  it('steam-runtime → steam', () => {
    expect(lookupApp('steam-runtime')).toBe('steam');
  });

  it('pressure-ves (15-char truncation of pressure-vessel) → steam', () => {
    expect(lookupApp('pressure-ves')).toBe('steam');
  });

  it('gnome-terminal → gnome-terminal', () => {
    expect(lookupApp('gnome-terminal')).toBe('gnome-terminal');
  });

  it('gnome-termina (15-char truncation of gnome-terminal-server) → gnome-terminal', () => {
    expect(lookupApp('gnome-termina')).toBe('gnome-terminal');
  });

  it('konsole → konsole', () => {
    expect(lookupApp('konsole')).toBe('konsole');
  });

  it('alacritty → alacritty', () => {
    expect(lookupApp('alacritty')).toBe('alacritty');
  });

  it('kitty → kitty', () => {
    expect(lookupApp('kitty')).toBe('kitty');
  });

  it('tilix → tilix', () => {
    expect(lookupApp('tilix')).toBe('tilix');
  });

  it('xterm → xterm', () => {
    expect(lookupApp('xterm')).toBe('xterm');
  });

  it('emacs-30.1 → emacs', () => {
    expect(lookupApp('emacs-30.1')).toBe('emacs');
  });
});

describe('getDisplayName — title-case fallback', () => {
  it('unknown slug falls back to title-casing: "my-cool-app" → "My Cool App"', () => {
    expect(getDisplayName('my-cool-app')).toBe('My Cool App');
  });

  it('single-word slug: "zoom" → "Zoom"', () => {
    expect(getDisplayName('zoom')).toBe('Zoom');
  });

  it('single-word unknown slug: "zerglings" → "Zerglings"', () => {
    expect(getDisplayName('zerglings')).toBe('Zerglings');
  });
});
