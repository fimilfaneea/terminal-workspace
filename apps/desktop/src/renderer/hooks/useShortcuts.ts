import { useEffect } from 'react';
import {
  selectActivePane,
  selectActiveTab,
  useWorkspaceStore,
} from '@renderer/state/workspaceStore';
import { getPaneHandle } from '@renderer/lib/paneHandles';
import {
  copySelectionFromPane,
  pasteIntoPane,
} from '@renderer/lib/clipboard';

export function useShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!e.ctrlKey) return;
      const key = e.key;
      const store = useWorkspaceStore.getState();

      // --- Ctrl-only (no Shift, no Alt) shortcuts ---
      if (!e.shiftKey && !e.altKey) {
        if (key === 'Tab') {
          e.preventDefault();
          cycleTab(1);
          return;
        }
        if (key === '=' || key === '+') {
          e.preventDefault();
          store.bumpFontSize(1);
          return;
        }
        if (key === '-' || key === '_') {
          e.preventDefault();
          store.bumpFontSize(-1);
          return;
        }
        if (key === '0') {
          e.preventDefault();
          store.resetFontSize();
          return;
        }
      }

      // --- Ctrl+Shift+= (i.e. Ctrl+Plus on US keyboards) ---
      if (e.shiftKey && !e.altKey && (key === '+' || key === '=')) {
        e.preventDefault();
        store.bumpFontSize(1);
        return;
      }

      // --- Ctrl+Shift+Tab ---
      if (e.shiftKey && !e.altKey && key === 'Tab') {
        e.preventDefault();
        cycleTab(-1);
        return;
      }

      // From here: require Ctrl+Shift, no Alt.
      if (!e.shiftKey || e.altKey) return;

      const tab = selectActiveTab(store);
      const activePaneId = tab?.activePaneId ?? '';
      const focusedPane = selectActivePane(store);
      const focusedSessionId =
        focusedPane && focusedPane.type === 'leaf' ? focusedPane.sessionId : null;

      switch (key) {
        case 'T':
        case 't':
          e.preventDefault();
          void store.newTab();
          return;
        case 'W':
        case 'w':
          e.preventDefault();
          void (async () => {
            const result = await store.closeTab(store.activeTabId);
            if (result.wouldCloseWindow) {
              await window.shell.requestWindowClose();
            }
          })();
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
          if (!tab) return;
          const paneId = tab.activePaneId;
          void (async () => {
            const result = await store.closePane(paneId);
            if (result.wouldCloseWindow) {
              await window.shell.requestWindowClose();
            }
          })();
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
        case 'R':
        case 'r':
          e.preventDefault();
          getPaneHandle(activePaneId)?.startRename();
          return;
        case 'F':
        case 'f':
          e.preventDefault();
          getPaneHandle(activePaneId)?.openFindBar();
          return;
        case 'C':
        case 'c':
          e.preventDefault();
          void copySelectionFromPane(activePaneId);
          return;
        case 'V':
        case 'v':
          e.preventDefault();
          void pasteIntoPane(activePaneId);
          return;
        case 'Enter':
          e.preventDefault();
          if (focusedSessionId) void store.restartSession(focusedSessionId);
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
