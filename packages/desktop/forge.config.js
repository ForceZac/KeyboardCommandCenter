module.exports = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
    // The .node binary must be outside the ASAR archive — native modules cannot
    // be loaded from within an ASAR. We place it in extraResources so it lands
    // in resources/ of the packaged app, and the TypeScript wrapper resolves it
    // relative to process.resourcesPath at runtime.
    extraResources: [
      {
        from: './native',
        to: 'native',
        filter: ['**/*.node'],
      },
      // TASK-0017: Vite-built overlay renderer must be bundled outside ASAR so
      // OverlayWindowManager can load it via win.loadFile() at runtime.
      {
        from: '../../packages/overlay/dist',
        to: '../../packages/overlay/dist',
      },
    ],
  },
  rebuildConfig: {},
  makers: [],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/renderer/index.html',
              js: './src/renderer/index.ts',
              name: 'main_window',
              preload: {
                js: './src/preload.ts',
              },
            },
            {
              html: './src/renderer/settings.html',
              js: './src/renderer/settings.ts',
              name: 'settings_window',
              preload: {
                js: './src/settings-preload.ts',
              },
            },
            // TASK-0017: stub entry — generates OVERLAY_WINDOW_PRELOAD_WEBPACK_ENTRY.
            // The real overlay renderer is Vite-built; see OverlayWindowManager.loadFile().
            {
              html: './src/renderer/overlay-stub.html',
              js: './src/renderer/overlay-stub.ts',
              name: 'overlay_window',
              preload: {
                js: './src/overlay-preload.ts',
              },
            },
          ],
        },
      },
    },
  ],
};
