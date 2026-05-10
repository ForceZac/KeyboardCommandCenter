import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Electron module mock — TrayManager imports Tray, Menu, MenuItem, nativeImage
// and app from 'electron', none of which exist in a Node/Vitest environment.
// ---------------------------------------------------------------------------
vi.mock('electron', () => {
  /** Minimal MenuItem stub that records construction args. */
  class MockMenuItem {
    label: string;
    enabled: boolean;
    click?: () => void;

    constructor(opts: { label: string; enabled?: boolean; click?: () => void }) {
      this.label = opts.label;
      this.enabled = opts.enabled !== false; // default true
      this.click = opts.click;
    }
  }

  /** Menu stub — buildFromTemplate returns a { items } object the tests can inspect. */
  class MockMenu {
    items: MockMenuItem[] = [];

    static buildFromTemplate(template: unknown[]): MockMenu {
      const menu = new MockMenu();
      // Collect items (including submenu items) into a flat-ish shape for testing.
      menu.items = template as MockMenuItem[];
      return menu;
    }
  }

  return {
    Tray: vi.fn(() => ({
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn(),
      popUpContextMenu: vi.fn(),
      destroy: vi.fn(),
    })),
    Menu: MockMenu,
    MenuItem: MockMenuItem,
    nativeImage: {
      createFromPath: vi.fn(() => ({
        resize: vi.fn().mockReturnThis(),
        setTemplateImage: vi.fn(),
      })),
    },
    app: {
      quit: vi.fn(),
    },
  };
});

// Also mock 'path' so __dirname-based path resolution doesn't throw.
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return { ...actual, join: (...args: string[]) => args.join('/') };
});

import { TrayManager } from '../tray';

// ---------------------------------------------------------------------------
// Helper: build a TrayManager with injected stubs.
// ---------------------------------------------------------------------------
function makeTrayManager(opts: {
  recentApps?: string[];
  detectionEnabled?: boolean;
  onOpenPanelWithApp?: (slug: string) => void;
}) {
  const onOpenPanel = vi.fn();
  const onOpenSettings = vi.fn();
  const getRecentApps = vi.fn(() => opts.recentApps ?? []);
  const getDisplayName = vi.fn((slug: string) => slug.toUpperCase()); // deterministic stub
  const isDetectionEnabled = vi.fn(() => opts.detectionEnabled !== false);
  const onOpenPanelWithApp = opts.onOpenPanelWithApp ?? vi.fn();

  const manager = new TrayManager(
    onOpenPanel,
    onOpenSettings,
    getRecentApps,
    getDisplayName,
    isDetectionEnabled,
    onOpenPanelWithApp,
  );

  return { manager, onOpenPanel, onOpenSettings, getRecentApps, getDisplayName, isDetectionEnabled, onOpenPanelWithApp };
}

// ---------------------------------------------------------------------------
// Access the private buildContextMenu via type cast for white-box testing.
// ---------------------------------------------------------------------------
function buildMenu(manager: TrayManager) {
  return (manager as unknown as { buildContextMenu(): { items: unknown[] } }).buildContextMenu();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrayManager — buildContextMenu: recent apps submenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detection enabled + 3 recent apps → submenu with 3 enabled entries', () => {
    const { manager } = makeTrayManager({
      recentApps: ['vscode', 'slack', 'figma'],
      detectionEnabled: true,
    });

    const menu = buildMenu(manager);
    // Find the "Recent Apps" item
    const recentItem = (menu.items as Array<{ label: string; submenu?: unknown[] }>).find(
      (item) => item.label === 'Recent Apps',
    );

    expect(recentItem).toBeDefined();
    const submenu = recentItem!.submenu as Array<{ label: string; enabled: boolean }>;
    expect(submenu).toHaveLength(3);
    // All entries are enabled
    submenu.forEach((entry) => expect(entry.enabled).toBe(true));
  });

  it('detection enabled + 0 recent apps → submenu with single disabled "No recent apps" item', () => {
    const { manager } = makeTrayManager({
      recentApps: [],
      detectionEnabled: true,
    });

    const menu = buildMenu(manager);
    const recentItem = (menu.items as Array<{ label: string; submenu?: unknown[] }>).find(
      (item) => item.label === 'Recent Apps',
    );
    const submenu = recentItem!.submenu as Array<{ label: string; enabled: boolean }>;

    expect(submenu).toHaveLength(1);
    expect(submenu[0].label).toBe('No recent apps');
    expect(submenu[0].enabled).toBe(false);
  });

  it('detection disabled → submenu with single disabled "Detection off" item', () => {
    const { manager } = makeTrayManager({
      recentApps: ['vscode'],
      detectionEnabled: false,
    });

    const menu = buildMenu(manager);
    const recentItem = (menu.items as Array<{ label: string; submenu?: unknown[] }>).find(
      (item) => item.label === 'Recent Apps',
    );
    const submenu = recentItem!.submenu as Array<{ label: string; enabled: boolean }>;

    expect(submenu).toHaveLength(1);
    expect(submenu[0].label).toBe('Detection off');
    expect(submenu[0].enabled).toBe(false);
  });

  it('5+ apps → submenu capped at 5 entries', () => {
    const { manager } = makeTrayManager({
      recentApps: ['vscode', 'slack', 'figma', 'chrome', 'spotify', 'zoom'],
      detectionEnabled: true,
    });

    const menu = buildMenu(manager);
    const recentItem = (menu.items as Array<{ label: string; submenu?: unknown[] }>).find(
      (item) => item.label === 'Recent Apps',
    );
    const submenu = recentItem!.submenu as unknown[];

    expect(submenu).toHaveLength(5);
  });

  it('clicking an app entry invokes onOpenPanelWithApp with the correct slug', () => {
    const onOpenPanelWithApp = vi.fn();
    const { manager } = makeTrayManager({
      recentApps: ['vscode', 'slack'],
      detectionEnabled: true,
      onOpenPanelWithApp,
    });

    const menu = buildMenu(manager);
    const recentItem = (menu.items as Array<{ label: string; submenu?: unknown[] }>).find(
      (item) => item.label === 'Recent Apps',
    );
    const submenu = recentItem!.submenu as Array<{ click?: () => void }>;

    // Click the first entry (vscode)
    submenu[0].click?.();
    expect(onOpenPanelWithApp).toHaveBeenCalledWith('vscode');

    // Click the second entry (slack)
    submenu[1].click?.();
    expect(onOpenPanelWithApp).toHaveBeenCalledWith('slack');
  });
});

describe('TrayManager — menu structure', () => {
  it('menu has Open, Recent Apps, Settings, separator, and Quit items', () => {
    const { manager } = makeTrayManager({ recentApps: [] });
    const menu = buildMenu(manager);
    const labels = (menu.items as Array<{ label?: string; type?: string }>).map(
      (item) => item.label ?? item.type,
    );

    expect(labels).toContain('Open Keyboard Command Center');
    expect(labels).toContain('Recent Apps');
    expect(labels).toContain('Settings');
    expect(labels).toContain('separator');
    expect(labels).toContain('Quit');
  });

  it('"Recent Apps" appears between "Open" and "Settings"', () => {
    const { manager } = makeTrayManager({ recentApps: [] });
    const menu = buildMenu(manager);
    const labels = (menu.items as Array<{ label?: string; type?: string }>).map(
      (item) => item.label ?? item.type,
    );

    const openIdx = labels.indexOf('Open Keyboard Command Center');
    const recentIdx = labels.indexOf('Recent Apps');
    const settingsIdx = labels.indexOf('Settings');

    expect(openIdx).toBeLessThan(recentIdx);
    expect(recentIdx).toBeLessThan(settingsIdx);
  });
});
