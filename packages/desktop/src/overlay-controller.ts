/**
 * OverlayController interface + singleton registry.
 *
 * TASK-0019 registers IPC handlers that call through this interface.
 * TASK-0017 implements the interface (OverlayWindowManager) and calls
 * registerOverlayController() at startup.
 *
 * Until TASK-0017 ships, overlayController is null and live-preview calls
 * are no-ops — settings persist correctly regardless.
 */

export interface OverlayController {
  setEnabled(enabled: boolean): void;
  setHotkey(accelerator: string): void;
  setOpacity(opacity: number): void;
  setPosition(position: string): void;
  setSize(size: string): void;
}

export let overlayController: OverlayController | null = null;

export function registerOverlayController(controller: OverlayController): void {
  overlayController = controller;
}
