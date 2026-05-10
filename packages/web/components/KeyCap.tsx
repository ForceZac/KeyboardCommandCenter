/**
 * KeyCap — renders a single key label with keyboard-key visual styling.
 * Used as the atom inside KeyCombo.
 */
interface Props {
  /** Key label to display, e.g. "Ctrl", "Shift", "P", "F5" */
  label: string;
}

export default function KeyCap({ label }: Props) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 text-xs font-mono font-medium leading-none text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 border-b-2 rounded shadow-sm select-none">
      {label}
    </kbd>
  );
}
