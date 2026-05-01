import { create } from 'zustand';
import {
  DEFAULT_FONT_SIZE_PX,
  MAX_FONT_SIZE_PX,
  MIN_FONT_SIZE_PX,
} from '@shared/constants';
import type { SessionInfo, TerminalEvent } from '@shared/types';
import { newTabId } from '@renderer/lib/ids';
import {
  collectLeafIds,
  collectSessionIds,
  createLeaf,
  findLeaf,
  focusNext,
  focusPrev,
  removeLeaf,
  splitLeaf,
  updateSplitRatio,
} from '@renderer/lib/splitTree';
import type {
  CloseResult,
  PaneNode,
  SessionView,
  SplitDirection,
  Tab,
  WorkspaceState,
  WorkspaceStore,
} from './types';

const INITIAL_COLS = 80;
const INITIAL_ROWS = 24;

function clampFontSize(n: number): number {
  if (Number.isNaN(n)) return DEFAULT_FONT_SIZE_PX;
  if (n < MIN_FONT_SIZE_PX) return MIN_FONT_SIZE_PX;
  if (n > MAX_FONT_SIZE_PX) return MAX_FONT_SIZE_PX;
  return Math.round(n);
}

function totalPaneCount(tabs: Tab[]): number {
  let n = 0;
  for (const tab of tabs) n += collectLeafIds(tab.rootPane).length;
  return n;
}

function findTabIndexContainingSession(tabs: Tab[], sessionId: string): number {
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    if (tab && collectSessionIds(tab.rootPane).includes(sessionId)) return i;
  }
  return -1;
}

function makeSessionView(info: SessionInfo): SessionView {
  return { info, hasUnreadActivity: false };
}

function makeTabFromSession(sessionId: string): Tab {
  const leaf = createLeaf(sessionId);
  return {
    id: newTabId(),
    rootPane: leaf,
    activePaneId: leaf.id,
    hasUnreadActivity: false,
    hasError: false,
  };
}

const initialState: WorkspaceState = {
  tabs: [],
  activeTabId: '',
  sessionsById: {},
  fontSizePx: DEFAULT_FONT_SIZE_PX,
  bootstrapping: false,
};

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  ...initialState,

  // --- bootstrap ---------------------------------------------------------

  initWorkspace: async () => {
    const state = get();
    if (state.bootstrapping || state.tabs.length > 0) return;
    set({ bootstrapping: true });
    try {
      const info = await window.terminal.create({
        cols: INITIAL_COLS,
        rows: INITIAL_ROWS,
      });
      const tab = makeTabFromSession(info.id);
      set((s) => ({
        tabs: [...s.tabs, tab],
        activeTabId: tab.id,
        sessionsById: { ...s.sessionsById, [info.id]: makeSessionView(info) },
        bootstrapping: false,
      }));
    } catch (err) {
      set({ bootstrapping: false });
      throw err;
    }
  },

  // --- tabs --------------------------------------------------------------

  newTab: async () => {
    const info = await window.terminal.create({
      cols: INITIAL_COLS,
      rows: INITIAL_ROWS,
    });
    const tab = makeTabFromSession(info.id);
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
      sessionsById: { ...s.sessionsById, [info.id]: makeSessionView(info) },
    }));
  },

  closeTab: async (tabId: string): Promise<CloseResult> => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return { wouldCloseWindow: false };
    const closingPaneCount = collectLeafIds(tab.rootPane).length;
    if (closingPaneCount >= totalPaneCount(state.tabs)) {
      return { wouldCloseWindow: true };
    }
    const sessionIds = collectSessionIds(tab.rootPane);
    const remaining = state.tabs.filter((t) => t.id !== tabId);
    const nextActiveTabId =
      state.activeTabId === tabId
        ? (remaining[0]?.id ?? '')
        : state.activeTabId;
    set({ tabs: remaining, activeTabId: nextActiveTabId });
    for (const sid of sessionIds) {
      void window.terminal.close(sid).catch(() => {
        // 'closed' event will reconcile sessionsById; failures here are non-fatal
      });
    }
    return { wouldCloseWindow: false };
  },

  setActiveTab: (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    set((s) => ({
      activeTabId: tabId,
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, hasUnreadActivity: false } : t,
      ),
    }));
  },

  reorderTabs: (fromIndex: number, toIndex: number) => {
    set((s) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= s.tabs.length ||
        toIndex >= s.tabs.length ||
        fromIndex === toIndex
      ) {
        return s;
      }
      const next = s.tabs.slice();
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return s;
      next.splice(toIndex, 0, moved);
      return { tabs: next };
    });
  },

  // --- panes -------------------------------------------------------------

  splitFocusedPane: async (direction: SplitDirection) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return;
    const focusedPaneId = tab.activePaneId;
    const info = await window.terminal.create({
      cols: INITIAL_COLS,
      rows: INITIAL_ROWS,
    });
    const newPane = createLeaf(info.id);
    const newRoot = splitLeaf(tab.rootPane, focusedPaneId, direction, newPane);
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tab.id
          ? { ...t, rootPane: newRoot, activePaneId: newPane.id }
          : t,
      ),
      sessionsById: { ...s.sessionsById, [info.id]: makeSessionView(info) },
    }));
  },

  closePane: async (paneId: string): Promise<CloseResult> => {
    const state = get();
    if (totalPaneCount(state.tabs) <= 1) {
      return { wouldCloseWindow: true };
    }
    const tabIndex = state.tabs.findIndex(
      (t) => findLeaf(t.rootPane, paneId) !== null,
    );
    if (tabIndex === -1) return { wouldCloseWindow: false };
    const tab = state.tabs[tabIndex];
    if (!tab) return { wouldCloseWindow: false };
    const { newRoot, orphanedSessionIds } = removeLeaf(tab.rootPane, paneId);

    let nextTabs: Tab[];
    let nextActiveTabId = state.activeTabId;
    if (newRoot === null) {
      nextTabs = state.tabs.filter((t) => t.id !== tab.id);
      if (state.activeTabId === tab.id) {
        nextActiveTabId = nextTabs[0]?.id ?? '';
      }
    } else {
      const remainingLeaves = collectLeafIds(newRoot);
      const nextActivePaneId =
        remainingLeaves.includes(tab.activePaneId)
          ? tab.activePaneId
          : (remainingLeaves[0] ?? tab.activePaneId);
      nextTabs = state.tabs.map((t) =>
        t.id === tab.id
          ? { ...t, rootPane: newRoot, activePaneId: nextActivePaneId }
          : t,
      );
    }
    set({ tabs: nextTabs, activeTabId: nextActiveTabId });
    for (const sid of orphanedSessionIds) {
      void window.terminal.close(sid).catch(() => {
        // 'closed' event will reconcile sessionsById
      });
    }
    return { wouldCloseWindow: false };
  },

  setActivePane: (tabId: string, paneId: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId && findLeaf(t.rootPane, paneId) !== null
          ? { ...t, activePaneId: paneId }
          : t,
      ),
    }));
  },

  focusNextPane: () => {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      if (!tab) return s;
      const next = focusNext(tab.rootPane, tab.activePaneId);
      if (next === tab.activePaneId) return s;
      return {
        tabs: s.tabs.map((t) =>
          t.id === tab.id ? { ...t, activePaneId: next } : t,
        ),
      };
    });
  },

  focusPrevPane: () => {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      if (!tab) return s;
      const prev = focusPrev(tab.rootPane, tab.activePaneId);
      if (prev === tab.activePaneId) return s;
      return {
        tabs: s.tabs.map((t) =>
          t.id === tab.id ? { ...t, activePaneId: prev } : t,
        ),
      };
    });
  },

  setSplitRatio: (tabId: string, splitNodeId: string, ratio: number) => {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === tabId);
      if (!tab) return s;
      const nextRoot = updateSplitRatio(tab.rootPane, splitNodeId, ratio);
      if (nextRoot === tab.rootPane) return s;
      return {
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, rootPane: nextRoot } : t)),
      };
    });
  },

  // --- session ops -------------------------------------------------------

  renameSession: async (sessionId: string, title: string) => {
    await window.terminal.rename(sessionId, title);
  },

  restartSession: async (sessionId: string) => {
    await window.terminal.restart(sessionId);
  },

  clearScrollback: async (sessionId: string) => {
    await window.terminal.clearScrollback(sessionId);
  },

  // --- events ------------------------------------------------------------

  applyTerminalEvent: (evt: TerminalEvent) => {
    set((s) => applyEvent(s, evt));
  },

  // --- font --------------------------------------------------------------

  setFontSize: (px: number) => {
    set({ fontSizePx: clampFontSize(px) });
  },

  bumpFontSize: (delta: number) => {
    set((s) => ({ fontSizePx: clampFontSize(s.fontSizePx + delta) }));
  },

  resetFontSize: () => {
    set({ fontSizePx: DEFAULT_FONT_SIZE_PX });
  },
}));

function applyEvent(s: WorkspaceState, evt: TerminalEvent): Partial<WorkspaceState> {
  switch (evt.kind) {
    case 'started': {
      return {
        sessionsById: {
          ...s.sessionsById,
          [evt.sessionId]: { info: evt.info, hasUnreadActivity: false },
        },
      };
    }
    case 'output': {
      const tabIdx = findTabIndexContainingSession(s.tabs, evt.sessionId);
      if (tabIdx === -1) return {};
      const tab = s.tabs[tabIdx];
      if (!tab) return {};
      const isBackgroundTab = tab.id !== s.activeTabId;
      if (!isBackgroundTab) return {};
      const existing = s.sessionsById[evt.sessionId];
      const sessionsById: Record<string, SessionView> = existing
        ? { ...s.sessionsById, [evt.sessionId]: { ...existing, hasUnreadActivity: true } }
        : s.sessionsById;
      const tabs = s.tabs.map((t, i) =>
        i === tabIdx ? { ...t, hasUnreadActivity: true } : t,
      );
      return { tabs, sessionsById };
    }
    case 'exited': {
      const existing = s.sessionsById[evt.sessionId];
      if (!existing) return {};
      return {
        sessionsById: {
          ...s.sessionsById,
          [evt.sessionId]: {
            ...existing,
            info: {
              ...existing.info,
              status: 'exited',
              exitCode: evt.exitCode,
              exitSignal: evt.exitSignal,
              updatedAt: Date.now(),
            },
          },
        },
      };
    }
    case 'error': {
      const existing = s.sessionsById[evt.sessionId];
      const tabIdx = findTabIndexContainingSession(s.tabs, evt.sessionId);
      const sessionsById: Record<string, SessionView> = existing
        ? {
            ...s.sessionsById,
            [evt.sessionId]: {
              ...existing,
              info: { ...existing.info, status: 'errored', updatedAt: Date.now() },
            },
          }
        : s.sessionsById;
      const tabs =
        tabIdx === -1
          ? s.tabs
          : s.tabs.map((t, i) => (i === tabIdx ? { ...t, hasError: true } : t));
      return { tabs, sessionsById };
    }
    case 'renamed': {
      const existing = s.sessionsById[evt.sessionId];
      if (!existing) return {};
      return {
        sessionsById: {
          ...s.sessionsById,
          [evt.sessionId]: {
            ...existing,
            info: { ...existing.info, title: evt.title, updatedAt: Date.now() },
          },
        },
      };
    }
    case 'cleared': {
      return {};
    }
    case 'closed': {
      if (!s.sessionsById[evt.sessionId]) return {};
      const next: Record<string, SessionView> = { ...s.sessionsById };
      delete next[evt.sessionId];
      return { sessionsById: next };
    }
  }
}

// --- selectors -----------------------------------------------------------

export function selectActiveTab(s: WorkspaceState): Tab | null {
  return s.tabs.find((t) => t.id === s.activeTabId) ?? null;
}

export function selectActivePane(s: WorkspaceState): PaneNode | null {
  const tab = selectActiveTab(s);
  if (!tab) return null;
  return findLeaf(tab.rootPane, tab.activePaneId);
}

export function selectTabTitle(s: WorkspaceState, tabId: string): string {
  const tab = s.tabs.find((t) => t.id === tabId);
  if (!tab) return '';
  const focused = findLeaf(tab.rootPane, tab.activePaneId);
  if (!focused) return '';
  return s.sessionsById[focused.sessionId]?.info.title ?? '';
}

// --- dev-only inspection -------------------------------------------------

if (import.meta.env.DEV) {
  (window as unknown as { __workspaceStore?: typeof useWorkspaceStore }).__workspaceStore =
    useWorkspaceStore;
}
