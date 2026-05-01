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
