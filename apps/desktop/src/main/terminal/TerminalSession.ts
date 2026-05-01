import type { SessionInfo, SessionStatus } from '@shared/types';
import { TERMINAL_SHUTDOWN_TIMEOUT_MS } from '../constants';
import { log } from '../logger';
import { filterEnv } from './env';
import { History } from './history';
import { spawnCmd, type IPty } from './spawn';

export interface TerminalSessionOpts {
  id: string;
  title: string;
  cwd: string;
  cols: number;
  rows: number;
}

export class TerminalSession {
  private readonly id: string;
  private title: string;
  private readonly cwd: string;
  private status: SessionStatus = 'starting';
  private pid: number | null = null;
  private cols: number;
  private rows: number;
  private readonly createdAt: number;
  private updatedAt: number;
  private exitCode: number | null = null;
  private exitSignal: string | null = null;

  private pty: IPty | null = null;
  // Phase 4: batched output pipeline. Declared here so the field shape is stable
  // when Phase 4 swaps in the flush path.
  private pendingOutput: string[] = [];
  private pendingBytes = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly history = new History();
  private outputSeq = 0;
  private readonly disposables: Array<() => void> = [];

  private exitWaiters: Array<() => void> = [];

  constructor(opts: TerminalSessionOpts) {
    this.id = opts.id;
    this.title = opts.title;
    this.cwd = opts.cwd;
    this.cols = opts.cols;
    this.rows = opts.rows;
    const now = Date.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  start(): void {
    try {
      const env = filterEnv(process.env);
      const pty = spawnCmd({ cwd: this.cwd, cols: this.cols, rows: this.rows, env });
      this.pty = pty;
      this.pid = pty.pid;
      this.status = 'running';
      this.updatedAt = Date.now();

      const dataSub = pty.onData((chunk) => this.handleData(chunk));
      const exitSub = pty.onExit((e) => this.handleExit(e));
      this.disposables.push(() => dataSub.dispose());
      this.disposables.push(() => exitSub.dispose());
    } catch (err) {
      this.status = 'errored';
      this.updatedAt = Date.now();
      log.error('terminal:start failed', { id: this.id, err });
      throw err;
    }
  }

  private handleData(chunk: string): void {
    // Phase 3: append directly to history. Phase 4 replaces this with the
    // batched flush pipeline (pendingOutput / FLUSH_* constants).
    this.outputSeq += 1;
    this.history.append({ seq: this.outputSeq, data: chunk, createdAt: Date.now() });
    this.updatedAt = Date.now();
  }

  private handleExit(e: { exitCode: number; signal?: number }): void {
    this.exitCode = e.exitCode ?? null;
    this.exitSignal = e.signal != null ? String(e.signal) : null;
    this.status = 'exited';
    this.pty = null;
    this.updatedAt = Date.now();
    const waiters = this.exitWaiters;
    this.exitWaiters = [];
    for (const w of waiters) w();
  }

  getInfo(): SessionInfo {
    return {
      id: this.id,
      title: this.title,
      cwd: this.cwd,
      status: this.status,
      pid: this.pid,
      cols: this.cols,
      rows: this.rows,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      exitCode: this.exitCode,
      exitSignal: this.exitSignal,
    };
  }

  getHistorySize(): { bytes: number; lines: number } {
    return { bytes: this.history.sizeBytes, lines: this.history.sizeLines };
  }

  // Debug-only accessor used by the DEBUG_TERMINAL_HISTORY harness to exercise
  // the ring-buffer caps without spawning a real PTY. Phase 4 will gate this
  // behind a proper test path.
  debugHistory(): History {
    return this.history;
  }

  async close(): Promise<void> {
    const pty = this.pty;
    if (!pty) {
      this.status = 'exited';
      this.updatedAt = Date.now();
      return;
    }

    const exited = new Promise<void>((resolve) => {
      this.exitWaiters.push(resolve);
    });

    try {
      pty.kill();
    } catch (err) {
      log.warn('terminal:kill threw', { id: this.id, err });
    }

    let timedOut = false;
    await Promise.race([
      exited,
      new Promise<void>((resolve) =>
        setTimeout(() => {
          timedOut = true;
          resolve();
        }, TERMINAL_SHUTDOWN_TIMEOUT_MS),
      ),
    ]);

    if (timedOut) {
      log.warn('terminal:close timed out', { id: this.id });
    }

    for (const dispose of this.disposables) {
      try {
        dispose();
      } catch {
        // ignore — we're tearing down anyway
      }
    }
    this.disposables.length = 0;
    this.pty = null;
    if (this.status !== 'errored') this.status = 'exited';
    this.updatedAt = Date.now();
  }
}
