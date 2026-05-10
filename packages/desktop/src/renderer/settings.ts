import './settings.css';

const hotkeyDisplay = document.getElementById('hotkey-display') as HTMLSpanElement;
const changeHotkeyBtn = document.getElementById('change-hotkey-btn') as HTMLButtonElement;
const hotkeyFeedback = document.getElementById('hotkey-feedback') as HTMLSpanElement;
const recordingHint = document.getElementById('recording-hint') as HTMLParagraphElement;
const loginStartupToggle = document.getElementById('login-startup-toggle') as HTMLInputElement;

let recording = false;

async function loadSettings(): Promise<void> {
  const settings = await window.kccSettings.getSettings();
  hotkeyDisplay.textContent = settings.hotkey;
  loginStartupToggle.checked = settings.loginStartup;
}

function setFeedback(message: string, type: 'success' | 'error' | ''): void {
  hotkeyFeedback.textContent = message;
  hotkeyFeedback.className = `feedback ${type}`;
}

function startRecording(): void {
  recording = true;
  changeHotkeyBtn.disabled = true;
  changeHotkeyBtn.textContent = 'Recording…';
  recordingHint.classList.remove('hidden');
  setFeedback('', '');
}

function stopRecording(): void {
  recording = false;
  changeHotkeyBtn.disabled = false;
  changeHotkeyBtn.textContent = 'Change Hotkey';
  recordingHint.classList.add('hidden');
}

/**
 * Convert a KeyboardEvent into an Electron accelerator string.
 * e.g. Ctrl+Shift+A → "Ctrl+Shift+A", Cmd+Space → "Cmd+Space"
 */
function eventToAccelerator(event: KeyboardEvent): string | null {
  const parts: string[] = [];

  // Require at least one modifier — bare keys aren't valid global hotkeys.
  const hasModifier = event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
  if (!hasModifier) return null;

  if (event.metaKey) parts.push('Cmd');
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  // Skip bare modifier key presses.
  const modifierKeys = new Set(['Meta', 'Control', 'Alt', 'Shift']);
  if (modifierKeys.has(event.key)) return null;

  // Map special keys to Electron accelerator names.
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
  };
  const key = keyMap[event.key] ?? event.key.toUpperCase();
  parts.push(key);

  return parts.join('+');
}

document.addEventListener('keydown', async (event: KeyboardEvent) => {
  if (!recording) return;

  event.preventDefault();
  event.stopPropagation();

  const accelerator = eventToAccelerator(event);
  if (accelerator === null) {
    // Incomplete combo (e.g. just Shift held) — keep recording.
    return;
  }

  stopRecording();

  const result = await window.kccSettings.setHotkey(accelerator);
  if (result.success) {
    hotkeyDisplay.textContent = accelerator;
    setFeedback('Hotkey saved.', 'success');
  } else {
    setFeedback(result.message, 'error');
  }
});

changeHotkeyBtn.addEventListener('click', () => {
  if (recording) {
    stopRecording();
  } else {
    startRecording();
  }
});

loginStartupToggle.addEventListener('change', async () => {
  await window.kccSettings.setLoginStartup(loginStartupToggle.checked);
});

// Load current settings on page ready.
loadSettings().catch((err: unknown) => {
  console.error('[Settings] Failed to load settings:', err);
});
