import { useEffect } from 'react';
import { PasteConfirmDialog } from './components/PasteConfirmDialog';
import { SplitTree } from './components/SplitTree';
import { TabBar } from './components/TabBar';
import { usePersistedFontSize } from './hooks/usePersistedFontSize';
import { useShortcuts } from './hooks/useShortcuts';
import { useTerminalEvents } from './hooks/useTerminalEvents';
import { useWorkspaceStore } from './state/workspaceStore';

export function App(): JSX.Element {
  usePersistedFontSize();
  useTerminalEvents();
  useShortcuts();

  const initWorkspace = useWorkspaceStore((s) => s.initWorkspace);
  const fontSize = useWorkspaceStore((s) => s.fontSizePx);
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);

  useEffect(() => {
    void initWorkspace();
  }, [initWorkspace]);

  return (
    <div className="app-shell" style={{ fontSize }}>
      <TabBar />
      <div className="app-shell__panes">
        {tabs.length === 0 ? (
          <div className="app-shell__placeholder">Starting…</div>
        ) : (
          tabs.map((tab) => {
            const isVisible = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className="app-shell__tab"
                style={{ display: isVisible ? 'flex' : 'none' }}
              >
                <SplitTree tab={tab} isVisible={isVisible} />
              </div>
            );
          })
        )}
      </div>
      <PasteConfirmDialog />
    </div>
  );
}
