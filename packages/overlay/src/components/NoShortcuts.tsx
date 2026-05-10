import type { CSSProperties } from 'react';

interface NoShortcutsProps {
  processName: string;
}

const style: CSSProperties = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.4)',
  padding: '8px 0',
};

export function NoShortcuts({ processName }: NoShortcutsProps) {
  return <div style={style}>No shortcuts for {processName}</div>;
}
