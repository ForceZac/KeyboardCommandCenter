import { Fragment } from 'react';
import { clsx } from 'clsx';

interface OriginalShortcut {
  command: string;
  keyCombo: string;
  context: string | null;
  platform: string;
}

interface Props {
  original: OriginalShortcut;
  proposed: Record<string, unknown>;
}

interface DiffField {
  label: string;
  originalValue: string;
  proposedValue: string;
  changed: boolean;
}

function getDiffFields(original: OriginalShortcut, proposed: Record<string, unknown>): DiffField[] {
  const fields: DiffField[] = [];

  const pairs: Array<{ label: string; key: string; origVal: string }> = [
    { label: 'Command', key: 'command', origVal: original.command },
    { label: 'Key Combo', key: 'keyCombo', origVal: original.keyCombo },
    { label: 'Context', key: 'context', origVal: original.context ?? '—' },
    { label: 'Platform', key: 'platformId', origVal: original.platform },
  ];

  for (const { label, key, origVal } of pairs) {
    const proposedVal = proposed[key] != null ? String(proposed[key]) : origVal;
    fields.push({
      label,
      originalValue: origVal,
      proposedValue: proposedVal,
      changed: proposedVal !== origVal,
    });
  }

  return fields;
}

export default function CorrectionDiffView({ original, proposed }: Props) {
  const fields = getDiffFields(original, proposed);

  return (
    <div className="mt-3 rounded border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
      <div className="grid grid-cols-3 gap-0">
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 font-medium text-gray-500 dark:text-gray-400 text-xs">
          Field
        </div>
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 font-medium text-gray-500 dark:text-gray-400 text-xs">
          Original
        </div>
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 font-medium text-gray-500 dark:text-gray-400 text-xs">
          Proposed
        </div>
        {fields.map((field) => (
          <Fragment key={field.label}>
            <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium">
              {field.label}
            </div>
            <div
              className={clsx(
                'px-3 py-2 border-t border-gray-100 dark:border-gray-700',
                field.changed
                  ? 'text-red-600 dark:text-red-400 line-through'
                  : 'text-gray-500 dark:text-gray-400',
              )}
            >
              {field.originalValue}
            </div>
            <div
              className={clsx(
                'px-3 py-2 border-t border-gray-100 dark:border-gray-700',
                field.changed
                  ? 'text-green-600 dark:text-green-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400',
              )}
            >
              {field.proposedValue}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
