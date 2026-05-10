import type { CSSProperties } from 'react';
import type { ShortcutEntry } from '../types';
import { ShortcutRow } from './ShortcutRow';

interface ContextGroupProps {
  name: string;
  shortcuts: ShortcutEntry[];
  overflowCount: number;
  platform: 'macos' | 'windows';
}

const groupStyle: CSSProperties = {
  marginBottom: '10px',
};

const headingStyle: CSSProperties = {
  fontSize: '10px',
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '4px',
  fontWeight: 600,
};

const overflowStyle: CSSProperties = {
  fontSize: '11px',
  color: 'rgba(255,255,255,0.35)',
  marginTop: '4px',
};

export function ContextGroup({ name, shortcuts, overflowCount, platform }: ContextGroupProps) {
  return (
    <div style={groupStyle}>
      <div style={headingStyle}>{name}</div>
      {shortcuts.map(s => (
        <ShortcutRow
          key={s.id}
          command={s.command}
          platforms={s.platforms}
          platform={platform}
        />
      ))}
      {overflowCount > 0 && (
        <div style={overflowStyle}>+ {overflowCount} more in panel</div>
      )}
    </div>
  );
}
