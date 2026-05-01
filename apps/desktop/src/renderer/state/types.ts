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
}

export interface WorkspaceState {
  tabs: Tab[];
  activeTabId: string;
  sessionsById: Record<string, SessionView>;
  fontSizePx: number;
  bootstrapping: boolean;
}

export interface CloseResult {
  wouldCloseWindow: boolean;
}

export interface WorkspaceActions {
  initWorkspace: () => Promise<void>;

  newTab: () => Promise<void>;
  closeTab: (tabId: string) => Promise<CloseResult>;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  splitFocusedPane: (direction: SplitDirection) => Promise<void>;
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
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;
