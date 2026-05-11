'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import KeyRecorder from './KeyRecorder';
import { useSubmitShortcut } from '@/hooks/useSubmitShortcut';
import { ApiError } from '@/lib/api';
import type { ShortcutEntry, PlatformSlug } from '@kcc/core';

interface Props {
  shortcut: ShortcutEntry;
  context: string;
  appId: string;
  appName: string;
  platform: PlatformSlug;
  open: boolean;
  onClose: () => void;
}

const PLATFORMS = [
  { value: 'windows', label: 'Windows' },
  { value: 'macos', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
] as const;

export default function CorrectionModal({
  shortcut,
  context: initialContext,
  appId,
  appName,
  platform: initialPlatform,
  open,
  onClose,
}: Props) {
  const { data: session } = useSession();
  const submitMutation = useSubmitShortcut();

  const binding =
    shortcut.platforms.find((p) => p.platformSlug === initialPlatform) ??
    shortcut.platforms[0];
  const step = binding?.steps[0];

  const [command, setCommand] = useState(shortcut.command);
  const [keyCombo, setKeyCombo] = useState(binding?.keyCombo ?? '');
  const [keyRaw, setKeyRaw] = useState(step?.key ?? '');
  const [keyModifiers, setKeyModifiers] = useState<string[]>(step?.modifiers ?? []);
  const [platform, setPlatform] = useState<string>(binding?.platformSlug ?? initialPlatform);
  const [context, setContext] = useState(initialContext);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    const b =
      shortcut.platforms.find((p) => p.platformSlug === initialPlatform) ??
      shortcut.platforms[0];
    const s = b?.steps[0];
    setCommand(shortcut.command);
    setKeyCombo(b?.keyCombo ?? '');
    setKeyRaw(s?.key ?? '');
    setKeyModifiers(s?.modifiers ?? []);
    setPlatform(b?.platformSlug ?? initialPlatform);
    setContext(initialContext);
    setReason('');
    submitMutation.reset();
  }, [open, shortcut, initialPlatform, initialContext]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleClose = useCallback(() => {
    if (submitMutation.isPending) return;
    onClose();
  }, [onClose, submitMutation]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    await submitMutation.mutateAsync({
      type: 'CORRECTION',
      appId,
      shortcutId: shortcut.id,
      data: {
        command: command.trim(),
        context: context.trim() || null,
        platform,
        keyCombo,
        key: keyRaw,
        modifiers: keyModifiers,
        notes: reason.trim() || null,
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
            Suggest a correction — {appName}
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
          {!session ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Sign in to suggest a correction.
              </p>
              <a
                href="/api/auth/signin"
                className="inline-block px-5 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Sign in
              </a>
            </div>
          ) : submitMutation.isSuccess ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">✓</div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                Correction submitted!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                Thanks for helping keep shortcuts accurate. An admin will review it soon.
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
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Current shortcut info */}
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2">
                Editing: <strong className="text-gray-700 dark:text-gray-300">{shortcut.command}</strong>
                {binding && (
                  <> — <code className="font-mono text-gray-600 dark:text-gray-400">{binding.keyCombo}</code></>
                )}
              </div>

              {/* Command name */}
              <div>
                <label
                  htmlFor="corr-command"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Command name <span className="text-red-500">*</span>
                </label>
                <input
                  id="corr-command"
                  type="text"
                  required
                  maxLength={100}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Platform */}
              <div>
                <label
                  htmlFor="corr-platform"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Platform <span className="text-red-500">*</span>
                </label>
                <select
                  id="corr-platform"
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
                  htmlFor="corr-keycombo"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Key combination <span className="text-red-500">*</span>
                </label>
                <KeyRecorder
                  id="corr-keycombo"
                  value={keyCombo}
                  onChange={handleKeyChange}
                  onClear={handleKeyClear}
                />
              </div>

              {/* Context/scope */}
              <div>
                <label
                  htmlFor="corr-context"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Context / scope
                  <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  id="corr-context"
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. Editor, Global, Normal Mode"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Reason for correction */}
              <div>
                <label
                  htmlFor="corr-reason"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Reason for correction
                  <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  id="corr-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Changed in VS Code 1.96"
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
                  {submitMutation.isPending ? 'Submitting…' : 'Submit correction'}
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
