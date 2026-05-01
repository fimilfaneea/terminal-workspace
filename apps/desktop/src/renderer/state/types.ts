import type { SessionInfo, TerminalEvent } from '@shared/types';

export type SplitDirection = 'horizontal' | 'vertical';

export type PaneNode =
  | { type: 'leaf'; id: string; sessionId: string }
  | {
      type: 'split';
      id: string;
      direction: SplitDirection;
      ratio: number;
      children: [PaneNode, PaneNode];
    };

export type SplitPaneNode = Extract<PaneNode, { type: 'split' }>;
export type LeafPaneNode = Extract<PaneNode, { type: 'leaf' }>;

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

  splitFocusedPane: (direction: SplitDirection, cwd?: string) => Promise<void>;
  closePane: (paneId: string) => Promise<CloseResult>;
  setActivePane: (tabId: string, paneId: string) => void;
  focusNextPane: () => void;
  focusPrevPane: () => void;
  setSplitRatio: (tabId: string, splitNodeId: string, ratio: number) => void;

  renameSession: (sessionId: string, title: string) => Promise<void>;
  restartSession: (sessionId: string) => Promise<void>;
  clearScrollback: (sessionId: string) => Promise<void>;

  applyTerminalEvent: (evt: TerminalEvent) => void;

  setFontSize: (px: number) => void;
  bumpFontSize: (delta: number) => void;
  resetFontSize: () => void;

  requestPasteConfirm: (req: PasteConfirmRequest) => void;
  dismissPasteConfirm: () => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;
