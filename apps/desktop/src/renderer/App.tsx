import { useEffect } from 'react';
import { usePersistedFontSize } from './hooks/usePersistedFontSize';
import { useTerminalEvents } from './hooks/useTerminalEvents';
import {
  selectActivePane,
  selectTabTitle,
  useWorkspaceStore,
} from './state/workspaceStore';

export function App(): JSX.Element {
  usePersistedFontSize();
  useTerminalEvents();

  const initWorkspace = useWorkspaceStore((s) => s.initWorkspace);
  const fontSize = useWorkspaceStore((s) => s.fontSizePx);
  const tabCount = useWorkspaceStore((s) => s.tabs.length);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const activePane = useWorkspaceStore(selectActivePane);
  const activeTitle = useWorkspaceStore((s) => selectTabTitle(s, s.activeTabId));

  useEffect(() => {
    void initWorkspace();
  }, [initWorkspace]);

  return (
    <div className="app-shell" style={{ fontSize }}>
      <div>Terminal Workspace</div>
      <div>tabs: {tabCount}</div>
      <div>activeTab: {activeTabId || '(none)'}</div>
      <div>activePane: {activePane?.id ?? '(none)'}</div>
      <div>title: {activeTitle || '(none)'}</div>
      <div>fontSize: {fontSize}px</div>
    </div>
  );
}
