import { useEffect } from 'react';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';

export function useShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!e.ctrlKey) return;
      const key = e.key;
      const store = useWorkspaceStore.getState();

      if (e.ctrlKey && !e.shiftKey && !e.altKey && key === 'Tab') {
        e.preventDefault();
        cycleTab(1);
        return;
      }
      if (e.ctrlKey && e.shiftKey && !e.altKey && key === 'Tab') {
        e.preventDefault();
        cycleTab(-1);
        return;
      }

      if (!e.shiftKey || e.altKey) return;

      switch (key) {
        case 'T':
        case 't':
          e.preventDefault();
          void store.newTab();
          return;
        case 'W':
        case 'w':
          e.preventDefault();
          void store.closeTab(store.activeTabId);
          return;
        case 'E':
        case 'e':
          e.preventDefault();
          void store.splitFocusedPane('horizontal');
          return;
        case 'O':
        case 'o':
          e.preventDefault();
          void store.splitFocusedPane('vertical');
          return;
        case 'X':
        case 'x': {
          e.preventDefault();
          const tab = store.tabs.find((t) => t.id === store.activeTabId);
          if (!tab) return;
          void store.closePane(tab.activePaneId);
          return;
        }
        case ']':
          e.preventDefault();
          store.focusNextPane();
          return;
        case '[':
          e.preventDefault();
          store.focusPrevPane();
          return;
        default:
          return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}

function cycleTab(delta: number): void {
  const { tabs, activeTabId, setActiveTab } = useWorkspaceStore.getState();
  if (tabs.length === 0) return;
  const idx = tabs.findIndex((t) => t.id === activeTabId);
  if (idx === -1) return;
  const next = (idx + delta + tabs.length) % tabs.length;
  const target = tabs[next];
  if (target) setActiveTab(target.id);
}
