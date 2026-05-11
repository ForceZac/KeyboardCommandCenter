/**
 * TypeScript wrapper for the kcc-native active window detection module.
 *
 * This is the only file that the rest of the Electron main process imports.
 * The native Rust crate is never imported directly — all platform-specific
 * binding details are contained here.
 *
 * If the compiled .node binary is absent (e.g. Rust is not installed, or
 * the developer is running in an environment where the native build didn't
 * run), all calls to `getActiveWindow()` return null without throwing.
 * The polling service handles null results as "detection unavailable" and
 * continues operating in a degraded state.
 */

export interface ActiveWindowInfo {
  /** Process executable name (e.g. "Code", "chrome", "Photoshop"). */
  processName: string;
  /**
   * Window title or app display name.
   * On macOS: the localizedName (e.g. "Visual Studio Code").
   * On Windows: the actual window title string.
   * May be an empty string if unavailable.
   */
  windowTitle: string;
  /**
   * macOS bundle identifier (e.g. "com.microsoft.VSCode").
   * Always undefined on Windows.
   */
  bundleId?: string;
  /**
   * True when active window detection is unavailable on this session.
   * Set by the Rust layer when a Wayland compositor does not expose a supported
   * DBus introspection API. Always false/undefined on macOS, Windows, and X11.
   * When true, processName and windowTitle are empty strings.
   */
  detectionUnavailable?: boolean;
}

/** Shape of the native module's exported function. */
export interface NativeModule {
  getActiveWindow(): {
    processName: string;
    windowTitle: string;
    bundleId?: string;
    detectionUnavailable?: boolean;
  } | null;
}

/**
 * Attempt to load the compiled .node binary.
 *
 * Resolution strategy (in order):
 *   1. process.resourcesPath/native — packaged Electron app (extraResources)
 *   2. __dirname/../../native — development (relative to .webpack/main/)
 *   3. __dirname/../native — non-webpack test runners (vitest, relative to src/platform/)
 *
 * Returns null if no path yields a loadable module.
 */
export function loadNativeModule(): NativeModule | null {
  // path is resolved lazily to avoid issues in browser renderer contexts.
  const { join } = require('path') as typeof import('path');

  const candidates: string[] = [];

  // Packaged app: native binaries land in resources/native/.
  if (
    typeof process !== 'undefined' &&
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  ) {
    candidates.push(
      join(
        (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!,
        'native',
        'kcc-native.node',
      ),
    );
  }

  // Development / webpack: __dirname is typically .webpack/main/
  candidates.push(join(__dirname, '..', '..', 'native', 'kcc-native.node'));
  // Non-webpack test runners: __dirname is src/platform/
  candidates.push(join(__dirname, '..', 'native', 'kcc-native.node'));

  for (const modulePath of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(modulePath) as NativeModule;
      if (mod && typeof mod.getActiveWindow === 'function') {
        return mod;
      }
    } catch {
      // Module not at this path — try the next candidate.
    }
  }

  return null;
}

/**
 * Creates a `getActiveWindow` function bound to the provided native module.
 *
 * Exported for unit testing — callers pass a mock NativeModule to verify
 * wrapper behaviour without a compiled .node binary. Production code calls
 * the default `getActiveWindow` export which uses the auto-loaded module.
 */
export function createActiveWindowDetector(
  nativeMod: NativeModule | null,
): () => ActiveWindowInfo | null {
  if (!nativeMod) {
    // Non-fatal warning — detection degrades gracefully.
    console.warn(
      '[kcc-native] Native module not loaded — active window detection unavailable.\n' +
        '  To enable: install Rust (https://rustup.rs) and run: npm run build:native -w packages/desktop',
    );
  }

  return function getActiveWindowImpl(): ActiveWindowInfo | null {
    if (!nativeMod) return null;

    try {
      const result = nativeMod.getActiveWindow();
      if (!result) return null;
      return {
        processName: result.processName,
        windowTitle: result.windowTitle,
        bundleId: result.bundleId,
        detectionUnavailable: result.detectionUnavailable ?? false,
      };
    } catch {
      // Defensive: if the native call throws unexpectedly, return null rather
      // than propagating an exception that could crash the main process.
      return null;
    }
  };
}

/**
 * Returns information about the currently active (foreground) window,
 * or null if detection fails, the binary is absent, or the platform is
 * unsupported (Linux — deferred to Goal 10).
 */
export const getActiveWindow = createActiveWindowDetector(loadNativeModule());
