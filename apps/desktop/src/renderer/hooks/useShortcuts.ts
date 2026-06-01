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

      // --- Ctrl+Alt shortcuts (deliberately distinct from plain Ctrl so we
      // don't steal shell semantics like Ctrl+R = reverse-i-search). ---
      if (e.altKey && !e.shiftKey) {
        if (key === 'r' || key === 'R') {
          e.preventDefault();
          window.dispatchEvent(new Event('commandHistory:open'));
          return;
        }
        return;
      }

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

        // Browser-style shortcuts (additive aliases for the Ctrl+Shift+ ones).
        // Skip when the user is typing in an input/textarea (find bar, rename).
        if (!isEditableTarget(e.target)) {
          if (key === 't' || key === 'T') {
            e.preventDefault();
            void store.newTab();
            return;
          }
          if (key === 'w' || key === 'W') {
            e.preventDefault();
            void (async () => {
              const result = await store.closeTab(store.activeTabId);
              if (result.wouldCloseWindow) {
                await window.shell.requestWindowClose();
              }
            })();
            return;
          }
          if (key === 'f' || key === 'F') {
            const t = selectActiveTab(store);
            const paneId = t?.activePaneId ?? '';
            if (paneId) {
              e.preventDefault();
              getPaneHandle(paneId)?.openFindBar();
              return;
            }
          }
          if (key >= '1' && key <= '9') {
            const tabs = store.tabs;
            if (tabs.length > 0) {
              const idx = key === '9' ? tabs.length - 1 : Number.parseInt(key, 10) - 1;
              const target = tabs[idx];
              if (target) {
                e.preventDefault();
                store.setActiveTab(target.id);
              }
              return;
            }
          }

          // Smart Ctrl+C / Ctrl+V (browser-style copy/paste).
          // Ctrl+C copies if selection exists; otherwise falls through to xterm
          // so the shell receives SIGINT.
          if (key === 'c' || key === 'C') {
            const t = selectActiveTab(store);
            const paneId = t?.activePaneId ?? '';
            const handle = paneId ? getPaneHandle(paneId) : undefined;
            const sel = handle?.getSelection() ?? '';
            if (sel.length > 0) {
              e.preventDefault();
              void (async () => {
                await copySelectionFromPane(paneId);
                handle?.clearSelection();
              })();
              return;
            }
            // No selection: do not preventDefault, let SIGINT through.
          }
          if (key === 'v' || key === 'V') {
            const t = selectActiveTab(store);
            const paneId = t?.activePaneId ?? '';
            if (paneId) {
              e.preventDefault();
              void pasteIntoPane(paneId);
              return;
            }
          }
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
          window.dispatchEvent(new Event('globalSearch:open'));
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
        case 'K':
        case 'k':
          e.preventDefault();
          window.dispatchEvent(new Event('commandsPicker:open'));
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}
