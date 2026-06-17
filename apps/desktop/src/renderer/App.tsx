import { useEffect } from 'react';
import { CommandHistoryPicker } from './components/CommandHistoryPicker';
import { GlobalSearchDialog } from './components/GlobalSearchDialog';
import { PaneErrorBoundary } from './components/PaneErrorBoundary';
import { PasteConfirmDialog } from './components/PasteConfirmDialog';
import { SplitTree } from './components/SplitTree';
import { TabBar } from './components/TabBar';
import { usePersistedFontSize } from './hooks/usePersistedFontSize';
import { usePersistedLastCwd } from './hooks/usePersistedLastCwd';
import { useShortcuts } from './hooks/useShortcuts';
import { useTerminalEvents } from './hooks/useTerminalEvents';
import { useWorkspaceStore } from './state/workspaceStore';

export function App(): JSX.Element {
  usePersistedFontSize();
  usePersistedLastCwd();
  useTerminalEvents();
  useShortcuts();

  const initWorkspace = useWorkspaceStore((s) => s.initWorkspace);
  const fontSize = useWorkspaceStore((s) => s.fontSizePx);
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);

  useEffect(() => {
    // Adopt windows (spawned by "Move tab to new window") skip the default
    // bootstrap and pull their detached tab from main instead.
    if (window.location.hash === '#adopt') {
      void (async () => {
        const tab = await window.shell.claimAdoptedTab();
        if (tab) useWorkspaceStore.getState().adoptTab(tab);
        else void initWorkspace();
      })();
      return;
    }
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
                <PaneErrorBoundary paneId={tab.id}>
                  <SplitTree tab={tab} isVisible={isVisible} />
                </PaneErrorBoundary>
              </div>
            );
          })
        )}
      </div>
      <PasteConfirmDialog />
      <GlobalSearchDialog />
      <CommandHistoryPicker />
    </div>
  );
}
