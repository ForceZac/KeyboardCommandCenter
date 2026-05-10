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
          ],
        },
      },
    },
  ],
};
