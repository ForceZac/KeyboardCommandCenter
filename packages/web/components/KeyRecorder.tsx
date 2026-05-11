'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Pure normalization logic — exported for unit testing without a DOM
// ---------------------------------------------------------------------------

/** Modifier key names as stored in the database. */
const MODIFIER_KEYS = new Set([
  'Control',
  'Shift',
  'Alt',
  'Meta',
  'Hyper',
  'Super',
  'AltGraph',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Fn',
]);

/**
 * Normalize a raw browser key name + modifier booleans into the database's
 * key combo format (e.g. "Ctrl+Shift+P").
 *
 * @param key - `KeyboardEvent.key` value
 * @param ctrl - `KeyboardEvent.ctrlKey`
 * @param meta - `KeyboardEvent.metaKey`
 * @param alt - `KeyboardEvent.altKey`
 * @param shift - `KeyboardEvent.shiftKey`
 * @param isMac - true when the user agent is macOS (affects Meta → Cmd vs Win)
 * @returns normalized record, or null if the key is a standalone modifier
 */
export function normalizeKeyCombo(
  key: string,
  ctrl: boolean,
  meta: boolean,
  alt: boolean,
  shift: boolean,
  isMac = false,
): { key: string; modifiers: string[]; combo: string } | null {
  // Ignore standalone modifier key presses
  if (MODIFIER_KEYS.has(key)) return null;

  const modifiers: string[] = [];
  if (ctrl) modifiers.push('Ctrl');
  if (meta) modifiers.push(isMac ? 'Cmd' : 'Win');
  if (alt) modifiers.push(isMac ? 'Option' : 'Alt');
  if (shift) modifiers.push('Shift');

  // Normalize the base key:
  //   - Single letters → uppercase (e.g. 'p' → 'P')
  //   - Function keys stay as-is (F1, F12, …)
  //   - Special keys: map common alternatives to clean display names
  const KEY_MAP: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Esc',
    Delete: 'Del',
    Backspace: 'Backspace',
    Enter: 'Enter',
    Tab: 'Tab',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Insert: 'Insert',
  };

  const normalizedKey = KEY_MAP[key] ?? (key.length === 1 ? key.toUpperCase() : key);

  const parts = [...modifiers, normalizedKey];
  return {
    key: key.length === 1 ? key.toLowerCase() : key,
    modifiers,
    combo: parts.join('+'),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  value: string;
  onChange: (combo: string, key: string, modifiers: string[]) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * KeyRecorder — captures keystrokes when focused and displays the normalized
 * key combo string. Emits changes via `onChange(combo, key, modifiers)`.
 *
 * The recorder calls event.preventDefault() only for known modifier+key combos
 * so it doesn't block single-key events outside the recorder or swallow
 * browser-level shortcuts (e.g. Ctrl+W).
 */
export default function KeyRecorder({ value, onChange, onClear, placeholder = 'Click and press keys…', disabled = false, id }: Props) {
  const [focused, setFocused] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  // Detect macOS once on mount so normalizeKeyCombo can map Meta correctly.
  const isMacRef = useRef(false);
  useEffect(() => {
    isMacRef.current =
      typeof navigator !== 'undefined' &&
      (navigator.platform?.toLowerCase().includes('mac') ||
        navigator.userAgent?.toLowerCase().includes('mac'));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      const result = normalizeKeyCombo(
        e.key,
        e.ctrlKey,
        e.metaKey,
        e.altKey,
        e.shiftKey,
        isMacRef.current,
      );
      if (!result) return; // standalone modifier — ignore

      // Prevent default only when at least one modifier is held to avoid
      // intercepting plain-key browser defaults (tab navigation, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
      }

      onChange(result.combo, result.key, result.modifiers);
    },
    [disabled, onChange],
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear?.();
    divRef.current?.focus();
  };

  return (
    <div className="relative flex items-center">
      <div
        ref={divRef}
        id={id}
        role="textbox"
        aria-label="Key combo recorder"
        aria-readonly={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={[
          'flex-1 px-3 py-1.5 text-sm rounded-lg border',
          'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100',
          'select-none cursor-text',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500',
          focused && !value
            ? 'border-indigo-400 dark:border-indigo-500'
            : 'border-gray-200 dark:border-gray-700',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value ? (
          <span className="font-mono">{value}</span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
        )}
      </div>

      {value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear key combo"
          className="ml-2 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}
    </div>
  );
}
