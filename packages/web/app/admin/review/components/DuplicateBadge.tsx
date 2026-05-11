interface Props {
  shortcutId: string;
  appSlug: string | null;
}

export default function DuplicateBadge({ shortcutId, appSlug }: Props) {
  const href = appSlug ? `/apps/${appSlug}#${shortcutId}` : '#';

  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 hover:underline"
    >
      ⚠ Possible duplicate
    </a>
  );
}
