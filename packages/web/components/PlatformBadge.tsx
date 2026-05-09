import { clsx } from 'clsx';

interface Props {
  platform: string;
}

const PLATFORM_STYLES: Record<string, string> = {
  windows: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
  macos: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  linux: 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200',
};

const PLATFORM_LABELS: Record<string, string> = {
  windows: 'Win',
  macos: 'Mac',
  linux: 'Linux',
};

export default function PlatformBadge({ platform }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
        PLATFORM_STYLES[platform] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
      )}
    >
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}
