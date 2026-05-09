import './app.css';

// Escape key dismisses the panel via IPC → main process hides the BrowserWindow.
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    window.kcc.hidePanel();
  }
});
