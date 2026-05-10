import type { CSSProperties } from 'react';
import type { PlatformBinding } from '../types';

interface ShortcutRowProps {
  command: string;
  platforms: PlatformBinding[];
  platform: 'macos' | 'windows';
}

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '2px 0',
};

const commandStyle: CSSProperties = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.85)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginRight: '8px',
  flex: 1,
};

const keyComboStyle: CSSProperties = {
  fontSize: '11px',
  color: 'rgba(255,255,255,0.95)',
  fontFamily: 'monospace',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

export function ShortcutRow({ command, platforms, platform }: ShortcutRowProps) {
  const binding: PlatformBinding | undefined =
    platforms.find(p => p.platformSlug === platform) ?? platforms[0];

  return (
    <div style={rowStyle}>
      <span style={commandStyle}>{command}</span>
      <span style={keyComboStyle}>{binding?.keyCombo ?? '—'}</span>
    </div>
  );
}
