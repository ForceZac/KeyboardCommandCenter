'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import KeyRecorder from './KeyRecorder';
import { useSubmitShortcut } from '@/hooks/useSubmitShortcut';
import { useDuplicateCheck } from '@/hooks/useDuplicateCheck';
import { ApiError } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  appId: string;
  appName: string;
  open: boolean;
  onClose: () => void;
}

const PLATFORMS = [
  { value: 'windows', label: 'Windows' },
  { value: 'macos', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
  { value: 'all', label: 'All Platforms' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SubmitShortcutModal — modal form for submitting a new shortcut suggestion.
 *
 * - Uses a `KeyRecorder` component for keystroke capture.
 * - Checks for duplicates in real time via `useDuplicateCheck` (debounced, 200ms).
 * - Calls POST /api/submissions on submit.
 * - Shows sign-in prompt for unauthenticated users.
 * - Shows user-friendly messages for 429 rate limit and other errors.
 */
export default function SubmitShortcutModal({ appId, appName, open, onClose }: Props) {
  const { data: session } = useSession();
  const submitMutation = useSubmitShortcut();

  // Form state
  const [command, setCommand] = useState('');
  const [keyCombo, setKeyCombo] = useState('');
  const [keyRaw, setKeyRaw] = useState('');
  const [keyModifiers, setKeyModifiers] = useState<string[]>([]);
  const [platform, setPlatform] = useState<string>('windows');
  const [context, setContext] = useState('');
  const [notes, setNotes] = useState('');

  const { exact, fuzzy, isChecking } = useDuplicateCheck(appId, platform, keyCombo);

  const handleKeyChange = useCallback(
    (combo: string, key: string, modifiers: string[]) => {
      setKeyCombo(combo);
      setKeyRaw(key);
      setKeyModifiers(modifiers);
    },
    [],
  );

  const handleKeyClear = useCallback(() => {
    setKeyCombo('');
    setKeyRaw('');
    setKeyModifiers([]);
  }, []);

  const handleClose = () => {
    if (submitMutation.isPending) return;
    // Reset form
    setCommand('');
    setKeyCombo('');
    setKeyRaw('');
    setKeyModifiers([]);
    setPlatform('windows');
    setContext('');
    setNotes('');
    submitMutation.reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    await submitMutation.mutateAsync({
      type: 'NEW_SHORTCUT',
      appId,
      data: {
        command: command.trim(),
        context: context.trim() || null,
        platform,
        keyCombo,
        key: keyRaw,
        modifiers: keyModifiers,
        notes: notes.trim() || null,
      },
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Submit a shortcut — {appName}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* ── Unauthenticated state ── */}
          {!session ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Sign in to submit a shortcut suggestion.
              </p>
              <a
                href="/api/auth/signin"
                className="inline-block px-5 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Sign in
              </a>
            </div>
          ) : submitMutation.isSuccess ? (
            /* ── Success state ── */
            <div className="text-center py-4">
              <div className="text-3xl mb-3">✓</div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                Shortcut submitted!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                Thanks for contributing. An admin will review it soon.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Command name */}
              <div>
                <label
                  htmlFor="sc-command"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Command name <span className="text-red-500">*</span>
                </label>
                <input
                  id="sc-command"
                  type="text"
                  required
                  maxLength={100}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g. Save File"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 text-right">
                  {command.length}/100
                </p>
              </div>

              {/* Platform */}
              <div>
                <label
                  htmlFor="sc-platform"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Platform <span className="text-red-500">*</span>
                </label>
                <select
                  id="sc-platform"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Key combo */}
              <div>
                <label
                  htmlFor="sc-keycombo"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Key combination <span className="text-red-500">*</span>
                </label>
                <KeyRecorder
                  id="sc-keycombo"
                  value={keyCombo}
                  onChange={handleKeyChange}
                  onClear={handleKeyClear}
                />

                {/* Duplicate detection feedback */}
                {keyCombo && !isChecking && exact && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span>
                      This shortcut already exists as <strong>&ldquo;{exact.command}&rdquo;</strong>.{' '}
                      Did you mean to submit a correction?{' '}
                      <span className="opacity-70">(You can still submit — duplicates are reviewed.)</span>
                    </span>
                  </div>
                )}

                {keyCombo && !isChecking && !exact && fuzzy.length > 0 && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-md px-2.5 py-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                    </svg>
                    <span>
                      Similar shortcut{fuzzy.length > 1 ? 's' : ''} found:{' '}
                      {fuzzy.map((f) => <strong key={f.id}>&ldquo;{f.command}&rdquo;</strong>).reduce<React.ReactNode[]>(
                        (acc, el, i) => (i === 0 ? [el] : [...acc, ', ', el]),
                        [],
                      )}
                      .{' '}
                      <span className="opacity-70">Check if this already exists.</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Context/scope (optional) */}
              <div>
                <label
                  htmlFor="sc-context"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Context / scope
                  <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  id="sc-context"
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. Editor, Global, Normal Mode"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Notes (optional) */}
              <div>
                <label
                  htmlFor="sc-notes"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Notes
                  <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  id="sc-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional context for the reviewer…"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Error messages */}
              {submitMutation.isError && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
                  {submitMutation.error instanceof ApiError && submitMutation.error.status === 429
                    ? 'You\'ve reached the daily submission limit (20 per day). Try again tomorrow.'
                    : 'Something went wrong. Please try again.'}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitMutation.isPending || !command.trim() || !keyCombo}
                  className="flex-1 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {submitMutation.isPending ? 'Submitting…' : 'Submit shortcut'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitMutation.isPending}
                  className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
