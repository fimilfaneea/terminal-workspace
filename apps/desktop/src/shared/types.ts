export type SessionStatus = 'starting' | 'running' | 'exited' | 'errored';

export interface SessionInfo {
  id: string;
  title: string;
  cwd: string;
  status: SessionStatus;
  pid: number | null;
  cols: number;
  rows: number;
  createdAt: number;
  updatedAt: number;
  exitCode: number | null;
  exitSignal: string | null;
}

export interface CreateSessionOpts {
  cols: number;
  rows: number;
  cwd?: string;
  title?: string;
}

export interface Snapshot {
  sessionId: string;
  fromSeq: number;
  toSeq: number;
  data: string;
  truncated: boolean;
}

export type TerminalEvent =
  | { kind: 'started'; sessionId: string; info: SessionInfo }
  | { kind: 'output'; sessionId: string; seq: number; data: string }
  | { kind: 'exited'; sessionId: string; exitCode: number | null; exitSignal: string | null }
  | { kind: 'error'; sessionId: string; message: string; code?: string }
  | { kind: 'closed'; sessionId: string }
  | { kind: 'renamed'; sessionId: string; title: string }
  | { kind: 'cleared'; sessionId: string };

export type IpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; code?: string };

export interface WritePayload {
  sessionId: string;
  data: string;
}

export interface ResizePayload {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface CloseSessionPayload {
  sessionId: string;
}

export interface RestartSessionPayload {
  sessionId: string;
}

export interface RenamePayload {
  sessionId: string;
  title: string;
}

export interface SnapshotPayload {
  sessionId: string;
}

export interface ClearScrollbackPayload {
  sessionId: string;
}

export interface OpenExternalPayload {
  url: string;
}

export interface WriteClipboardPayload {
  text: string;
}

export interface DefaultCwds {
  home: string;
  desktop: string | null;
  documents: string | null;
  downloads: string | null;
}

export interface SearchOpts {
  caseSensitive: boolean;
  regex: boolean;
}

export interface SearchMatch {
  lineIdx: number;
  lineText: string;
  hitCol: number;
  hitLength: number;
}

export interface SearchResults {
  matches: SearchMatch[];
  truncated: boolean;
  error?: 'bad-regex';
}

export interface SearchHistoryPayload {
  sessionId: string;
  query: string;
  opts: SearchOpts;
}

export interface SearchAllHistoriesPayload {
  query: string;
  opts: SearchOpts;
}

export interface SessionSearchResults {
  sessionId: string;
  title: string;
  results: SearchResults;
}

export interface AllSearchResults {
  perSession: SessionSearchResults[];
}

// --- pane tree / multi-window ---------------------------------------------
// These live in shared (not renderer-only) because the detach/adopt payload
// crosses the IPC boundary, so main and preload need the structural types too.

export type SplitDirection = 'horizontal' | 'vertical';

export type PaneNode =
  | { type: 'leaf'; id: string; sessionId: string }
  | {
      type: 'split';
      id: string;
      direction: SplitDirection;
      children: PaneNode[];
      ratios: number[];
      userResized: boolean;
    };

export type SplitPaneNode = Extract<PaneNode, { type: 'split' }>;
export type LeafPaneNode = Extract<PaneNode, { type: 'leaf' }>;

// Payload moved between windows when a tab is detached into a new window.
// The PTYs are untouched — this is a pure UI/display hand-off, so the tab's
// per-session command-recall history travels with it.
export interface SerializedTab {
  rootPane: PaneNode;
  activePaneId: string;
  nameOverride: string | null;
  sessions: SessionInfo[];
  commandHistory: Record<string, string[]>;
}

export interface OpenWithTabPayload {
  tab: SerializedTab;
}
