import './settings.css';
// AuthState and AuthSignedInPayload are declared in kccSettings.d.ts,
// included via tsconfig.renderer.json — no import needed.

const hotkeyDisplay = document.getElementById('hotkey-display') as HTMLSpanElement;
const changeHotkeyBtn = document.getElementById('change-hotkey-btn') as HTMLButtonElement;
const hotkeyFeedback = document.getElementById('hotkey-feedback') as HTMLSpanElement;
const recordingHint = document.getElementById('recording-hint') as HTMLParagraphElement;
const loginStartupToggle = document.getElementById('login-startup-toggle') as HTMLInputElement;

// Overlay section
const overlaySection = document.getElementById('overlay-section') as HTMLFieldSetElement;

// Overlay controls
const overlayEnabled = document.getElementById('overlay-enabled') as HTMLInputElement;
const overlayHotkeyBtn = document.getElementById('overlay-hotkey-btn') as HTMLButtonElement;
const overlayHotkeyDisplay = document.getElementById('overlay-hotkey-display') as HTMLSpanElement;
const overlayHotkeyError = document.getElementById('overlay-hotkey-error') as HTMLSpanElement;
const overlayRecordingHint = document.getElementById('overlay-recording-hint') as HTMLParagraphElement;
const overlayOpacity = document.getElementById('overlay-opacity') as HTMLInputElement;
const overlayOpacityDisplay = document.getElementById('overlay-opacity-display') as HTMLSpanElement;
const overlayPosition = document.getElementById('overlay-position') as HTMLSelectElement;
const overlaySizeRadios = document.querySelectorAll<HTMLInputElement>('input[name="overlay-size"]');

let recording = false;
let overlayRecording = false;

async function loadSettings(): Promise<void> {
  const settings = await window.kccSettings.getSettings();
  hotkeyDisplay.textContent = settings.hotkey;
  loginStartupToggle.checked = settings.loginStartup;

  // Hide the overlay section entirely on platforms where the feature is unsupported.
  const overlaySupported = await window.kccSettings.overlay.isSupported();
  if (!overlaySupported) {
    overlaySection.hidden = true;
    return;
  }

  const overlayPrefs = await window.kccSettings.overlay.getOverlay();
  overlayEnabled.checked = overlayPrefs.enabled;
  overlayHotkeyDisplay.textContent = overlayPrefs.hotkey;
  // Opacity stored as 0.2–0.8 float; slider is 20–80 int.
  overlayOpacity.value = String(Math.round(overlayPrefs.opacity * 100));
  overlayOpacityDisplay.textContent = `${Math.round(overlayPrefs.opacity * 100)}%`;
  overlayPosition.value = overlayPrefs.position;
  overlaySizeRadios.forEach((radio) => {
    radio.checked = radio.value === overlayPrefs.size;
  });
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

function startOverlayRecording(): void {
  overlayRecording = true;
  overlayHotkeyBtn.textContent = 'Recording…';
  overlayRecordingHint.classList.remove('hidden');
  overlayHotkeyError.textContent = '';
}

function stopOverlayRecording(): void {
  overlayRecording = false;
  overlayHotkeyBtn.textContent = '';
  overlayHotkeyBtn.appendChild(overlayHotkeyDisplay);
  overlayRecordingHint.classList.add('hidden');
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
  if (recording) {
    event.preventDefault();
    event.stopPropagation();

    const accelerator = eventToAccelerator(event);
    if (accelerator === null) return; // incomplete combo — keep recording

    stopRecording();

    const result = await window.kccSettings.setHotkey(accelerator);
    if (result.success) {
      hotkeyDisplay.textContent = accelerator;
      setFeedback('Hotkey saved.', 'success');
    } else {
      setFeedback(result.message, 'error');
    }
    return;
  }

  if (overlayRecording) {
    event.preventDefault();
    event.stopPropagation();

    const accelerator = eventToAccelerator(event);
    if (accelerator === null) return; // incomplete combo — keep recording

    stopOverlayRecording();
    overlayHotkeyDisplay.textContent = accelerator;

    const result = await window.kccSettings.overlay.setHotkey(accelerator);
    if (result.conflict) {
      overlayHotkeyError.textContent = result.message;
    } else {
      overlayHotkeyError.textContent = '';
    }
  }
});

changeHotkeyBtn.addEventListener('click', () => {
  if (recording) {
    stopRecording();
  } else {
    startRecording();
  }
});

overlayHotkeyBtn.addEventListener('click', () => {
  if (overlayRecording) {
    stopOverlayRecording();
  } else {
    startOverlayRecording();
  }
});

overlayEnabled.addEventListener('change', async () => {
  await window.kccSettings.overlay.setEnabled(overlayEnabled.checked);
});

overlayOpacity.addEventListener('input', async () => {
  const sliderVal = Number(overlayOpacity.value);
  overlayOpacityDisplay.textContent = `${sliderVal}%`;
  // Convert slider 20–80 to float 0.2–0.8 for the IPC layer.
  await window.kccSettings.overlay.setOpacity(sliderVal / 100);
});

overlayPosition.addEventListener('change', async () => {
  await window.kccSettings.overlay.setPosition(overlayPosition.value);
});

overlaySizeRadios.forEach((radio) => {
  radio.addEventListener('change', async () => {
    if (radio.checked) {
      await window.kccSettings.overlay.setSize(radio.value);
    }
  });
});

loginStartupToggle.addEventListener('change', async () => {
  await window.kccSettings.setLoginStartup(loginStartupToggle.checked);
});

// Load current settings on page ready.
loadSettings().catch((err: unknown) => {
  console.error('[Settings] Failed to load settings:', err);
});

// ---------------------------------------------------------------------------
// TASK-0023: Account section — auth state display.
// ---------------------------------------------------------------------------

const authSignedIn = document.getElementById('auth-signed-in') as HTMLDivElement;
const authSignedOut = document.getElementById('auth-signed-out') as HTMLDivElement;
const authAvatar = document.getElementById('auth-avatar') as HTMLDivElement;
const authDisplayNameEl = document.getElementById('auth-display-name') as HTMLSpanElement;
const signInBtn = document.getElementById('sign-in-btn') as HTMLButtonElement;
const signOutBtn = document.getElementById('sign-out-btn') as HTMLButtonElement;

function renderAuthState(
  isAuthenticated: boolean,
  displayName: string | null,
): void {
  if (isAuthenticated) {
    authSignedIn.hidden = false;
    authSignedOut.hidden = true;
    // Derive initials from display name for the avatar circle.
    const initials = displayName
      ? displayName
          .split(' ')
          .map((w) => w[0] ?? '')
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : '?';
    authAvatar.textContent = initials;
    authDisplayNameEl.textContent = displayName ?? 'Signed in';
  } else {
    authSignedIn.hidden = true;
    authSignedOut.hidden = false;
  }
}

async function loadAuthState(): Promise<void> {
  const state = await window.kccSettings.auth.getAuthState();
  renderAuthState(state.isAuthenticated, state.displayName);
}

// Subscribe to push events from main process (fired while window is open).
window.kccSettings.auth.onSignedIn((payload) => {
  renderAuthState(true, payload.displayName);
});

window.kccSettings.auth.onSignedOut(() => {
  renderAuthState(false, null);
});

signInBtn.addEventListener('click', async () => {
  await window.kccSettings.auth.signIn();
});

signOutBtn.addEventListener('click', async () => {
  await window.kccSettings.auth.signOut();
});

loadAuthState().catch((err: unknown) => {
  console.error('[Settings] Failed to load auth state:', err);
});
