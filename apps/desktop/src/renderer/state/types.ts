import type {
  PaneNode,
  SerializedTab,
  SessionInfo,
  SplitDirection,
  TerminalEvent,
} from '@shared/types';

// The pane-tree types now live in @shared/types (the detach/adopt payload
// crosses the IPC boundary). Re-exported here so renderer modules can keep
// importing them from '@renderer/state/types'.
export type {
  LeafPaneNode,
  PaneNode,
  SplitDirection,
  SplitPaneNode,
} from '@shared/types';

export interface SessionView {
  info: SessionInfo;
  hasUnreadActivity: boolean;
}

export interface Tab {
  id: string;
  rootPane: PaneNode;
  activePaneId: string;
  hasUnreadActivity: boolean;
  hasError: boolean;
  nameOverride: string | null;
}

export interface PasteConfirmRequest {
  sessionId: string;
  text: string;
  lines: number;
  bytes: number;
}

export interface WorkspaceState {
  tabs: Tab[];
  activeTabId: string;
  sessionsById: Record<string, SessionView>;
  fontSizePx: number;
  bootstrapping: boolean;
  pasteConfirmRequest: PasteConfirmRequest | null;
  lastCwd: string | null;
  // Per-session ring of newline-terminated input lines the user typed.
  // In-memory only — resets on app restart by design.
  commandHistoryBySession: Record<string, string[]>;
}

export interface CloseResult {
  wouldCloseWindow: boolean;
}

export interface WorkspaceActions {
  initWorkspace: () => Promise<void>;

  newTab: (cwd?: string) => Promise<void>;
  closeTab: (tabId: string) => Promise<CloseResult>;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  renameTab: (tabId: string, name: string) => void;

  // Multi-window: detach a tab into its own window (PTYs untouched).
  buildSerializedTab: (tabId: string) => SerializedTab | null;
  removeTabLocally: (tabId: string) => void;
  adoptTab: (tab: SerializedTab) => void;

  // Multi-window: detach a single pane into its own window (PTY untouched).
  buildSerializedPane: (paneId: string) => SerializedTab | null;
  removePaneLocally: (paneId: string) => void;

  splitFocusedPane: (direction: SplitDirection, cwd?: string) => Promise<void>;
  closePane: (paneId: string) => Promise<CloseResult>;
  setActivePane: (tabId: string, paneId: string) => void;
  focusNextPane: () => void;
  focusPrevPane: () => void;
  setSplitRatios: (tabId: string, splitNodeId: string, ratios: number[]) => void;
  equalizePanes: (tabId: string) => void;
  activateSession: (sessionId: string) => { tabId: string; paneId: string } | null;

  renameSession: (sessionId: string, title: string) => Promise<void>;
  restartSession: (sessionId: string) => Promise<void>;
  clearScrollback: (sessionId: string) => Promise<void>;

  applyTerminalEvent: (evt: TerminalEvent) => void;

  setFontSize: (px: number) => void;
  bumpFontSize: (delta: number) => void;
  resetFontSize: () => void;

  requestPasteConfirm: (req: PasteConfirmRequest) => void;
  dismissPasteConfirm: () => void;

  setLastCwd: (path: string | null) => void;

  appendCommandHistory: (sessionId: string, line: string) => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;
