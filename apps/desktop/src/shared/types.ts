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
