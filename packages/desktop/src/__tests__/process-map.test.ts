import { describe, it, expect } from 'vitest';
import { lookupApp } from '../process-map';

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
