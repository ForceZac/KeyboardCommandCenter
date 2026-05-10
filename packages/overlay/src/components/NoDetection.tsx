import type { CSSProperties } from 'react';

const style: CSSProperties = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.4)',
  padding: '8px 0',
};

export function NoDetection() {
  return <div style={style}>No app detected</div>;
}
