import type { CSSProperties } from 'react';
import { useOverlayData } from './hooks/useOverlayData';
import { useOverlayPrefs } from './hooks/useOverlayPrefs';
import { selectGroups, capGroup } from './utils/contentSelection';
import { getPlatform } from './utils/platform';
import { AppName } from './components/AppName';
import { ContextGroup } from './components/ContextGroup';
import { NoShortcuts } from './components/NoShortcuts';

// Resolved once at module load — stable across renders, avoids navigator reads in JSX.
const platform = getPlatform();

export function App() {
  const { status, appDetail, processName } = useOverlayData();
  const { opacity, size } = useOverlayPrefs();

  // Nothing to show until the first detection event arrives.
  if (status === 'idle') {
    return null;
  }

  const containerStyle: CSSProperties = {
    background: `rgba(0,0,0,${opacity})`,
    color: 'rgba(255,255,255,0.95)',
    padding: '12px 14px',
    borderRadius: '8px',
    minWidth: '220px',
    maxWidth: '320px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  if (status === 'unrecognized') {
    return (
      <div style={containerStyle}>
        <NoShortcuts processName={processName} />
      </div>
    );
  }

  // status === 'loaded' — appDetail is non-null here.
  const groupNames = selectGroups(appDetail!.contexts, size);

  return (
    <div style={containerStyle}>
      <AppName name={appDetail!.name} />
      {groupNames.map(groupName => {
        const shortcuts = appDetail!.contexts[groupName] ?? [];
        const { visible, overflowCount } = capGroup(shortcuts, size);
        return (
          <ContextGroup
            key={groupName}
            name={groupName}
            shortcuts={visible}
            overflowCount={overflowCount}
            platform={platform}
          />
        );
      })}
    </div>
  );
}
