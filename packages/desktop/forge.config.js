module.exports = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
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
          ],
        },
      },
    },
  ],
};
