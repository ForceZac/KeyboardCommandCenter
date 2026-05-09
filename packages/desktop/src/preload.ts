import { contextBridge, ipcRenderer } from 'electron';

// Expose a minimal, typed API to the renderer process.
// contextIsolation: true — renderer cannot access Node.js APIs directly.
contextBridge.exposeInMainWorld('kcc', {
  hidePanel: (): void => {
    ipcRenderer.send('hide-panel');
  },
});
