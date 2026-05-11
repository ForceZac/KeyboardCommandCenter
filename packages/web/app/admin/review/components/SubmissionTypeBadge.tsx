import { clsx } from 'clsx';
import type { SubmissionType } from '@kcc/core';

const TYPE_CONFIG: Record<SubmissionType, { label: string; style: string }> = {
  NEW_SHORTCUT: {
    label: 'New Shortcut',
    style: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
  },
  CORRECTION: {
    label: 'Correction',
    style: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-200',
  },
  APP_REQUEST: {
    label: 'App Request',
    style: 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200',
  },
};

export default function SubmissionTypeBadge({ type }: { type: SubmissionType }) {
  const config = TYPE_CONFIG[type];
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        config.style,
      )}
    >
      {config.label}
    </span>
  );
}
