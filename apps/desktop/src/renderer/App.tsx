import { useEffect } from 'react';
import { TerminalPane } from './components/TerminalPane';
import { usePersistedFontSize } from './hooks/usePersistedFontSize';
import { useTerminalEvents } from './hooks/useTerminalEvents';
import { selectActivePane, useWorkspaceStore } from './state/workspaceStore';

export function App(): JSX.Element {
  usePersistedFontSize();
  useTerminalEvents();

  const initWorkspace = useWorkspaceStore((s) => s.initWorkspace);
  const fontSize = useWorkspaceStore((s) => s.fontSizePx);
  const activePane = useWorkspaceStore(selectActivePane);
  const sessionExists = useWorkspaceStore((s) =>
    activePane?.type === 'leaf' ? s.sessionsById[activePane.sessionId] != null : false,
  );

  useEffect(() => {
    void initWorkspace();
  }, [initWorkspace]);

  return (
    <div className="app-shell" style={{ fontSize }}>
      {activePane?.type === 'leaf' && sessionExists ? (
        <TerminalPane
          sessionId={activePane.sessionId}
          paneId={activePane.id}
          isFocused
        />
      ) : (
        <div className="app-shell__placeholder">Starting…</div>
      )}
    </div>
  );
}
