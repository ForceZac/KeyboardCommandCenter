import type { CSSProperties } from 'react';

interface AppNameProps {
  name: string;
}

const style: CSSProperties = {
  fontSize: '11px',
  color: 'rgba(255,255,255,0.5)',
  fontWeight: 500,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom: '8px',
};

export function AppName({ name }: AppNameProps) {
  return <div style={style}>{name}</div>;
}
