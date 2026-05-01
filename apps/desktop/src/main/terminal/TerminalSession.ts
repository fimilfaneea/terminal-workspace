import type { SessionInfo, SessionStatus, Snapshot, TerminalEvent } from '@shared/types';
import { FLUSH_INTERVAL_MS, FLUSH_MAX_BYTES, TERMINAL_SHUTDOWN_TIMEOUT_MS } from '../constants';
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
  emit: (event: TerminalEvent) => void;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function errorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

export class TerminalSession {
  private readonly id: string;
  private title: string;
  private readonly cwd: string;
  private status: SessionStatus = 'starting';
  private pid: number | null = null;
  private cols: number;
  private rows: number;
  // createdAt is reset by restart() per plan §4.1, so it cannot be readonly.
  private createdAt: number;
  private updatedAt: number;
  private exitCode: number | null = null;
  private exitSignal: string | null = null;

  private pty: IPty | null = null;
  private pendingOutput: string[] = [];
  private pendingBytes = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly history = new History();
  private outputSeq = 0;
  private readonly disposables: Array<() => void> = [];

  private exitWaiters: Array<() => void> = [];

  // True between start() and close()-emit, so close() can be idempotent.
  private closedPending = false;

  private readonly emit: (event: TerminalEvent) => void;

  constructor(opts: TerminalSessionOpts) {
    this.id = opts.id;
    this.title = opts.title;
    this.cwd = opts.cwd;
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.emit = opts.emit;
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

      this.closedPending = true;
      this.emit({ kind: 'started', sessionId: this.id, info: this.getInfo() });
    } catch (err) {
      this.status = 'errored';
      this.updatedAt = Date.now();
      log.error('terminal:start failed', { id: this.id, err });
      throw err;
    }
  }

  private handleData(chunk: string): void {
    this.pendingOutput.push(chunk);
    this.pendingBytes += Buffer.byteLength(chunk, 'utf8');
    if (this.pendingBytes >= FLUSH_MAX_BYTES) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
    }
  }

  private flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pendingOutput.length === 0) return;
    const data = this.pendingOutput.join('');
    this.pendingOutput = [];
    this.pendingBytes = 0;
    this.outputSeq += 1;
    const seq = this.outputSeq;
    this.history.append({ seq, data, createdAt: Date.now() });
    this.updatedAt = Date.now();
    this.emit({ kind: 'output', sessionId: this.id, seq, data });
  }

  private handleExit(e: { exitCode: number; signal?: number }): void {
    // (a) drain any real buffered output first so its seq < the synthetic chunk's seq
    this.flush();

    const exitCode = e.exitCode ?? null;
    const exitSignal = e.signal != null ? String(e.signal) : null;

    // (b) inject the synthetic exit chunk through the same flush path so it
    // gets a real seq, joins history, and is replayed by snapshot().
    const reason = exitCode != null ? `code ${exitCode}` : `signal ${exitSignal ?? 'unknown'}`;
    const synthetic = `\r\n[Process exited with ${reason}]\r\n`;
    this.pendingOutput.push(synthetic);
    this.pendingBytes += Buffer.byteLength(synthetic, 'utf8');
    this.flush();

    // (c) update status
    this.exitCode = exitCode;
    this.exitSignal = exitSignal;
    this.status = 'exited';
    this.pty = null;
    this.updatedAt = Date.now();

    // (d) emit 'exited' AFTER the synthetic 'output' event
    this.emit({ kind: 'exited', sessionId: this.id, exitCode, exitSignal });

    // resolve waiters last (close() awaits these)
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

  getStatus(): SessionStatus {
    return this.status;
  }

  getHistorySize(): { bytes: number; lines: number } {
    return { bytes: this.history.sizeBytes, lines: this.history.sizeLines };
  }

  // Debug-only accessor used by the DEBUG_TERMINAL_HISTORY harness to exercise
  // the ring-buffer caps without spawning a real PTY.
  debugHistory(): History {
    return this.history;
  }

  write(data: string): void {
    if (!this.pty) return;
    this.pty.write(data);
    this.updatedAt = Date.now();
  }

  resize(cols: number, rows: number): void {
    if (cols === this.cols && rows === this.rows) return;
    this.cols = cols;
    this.rows = rows;
    try {
      this.pty?.resize(cols, rows);
    } catch (err) {
      log.warn('terminal:resize threw', { id: this.id, err });
    }
    this.updatedAt = Date.now();
  }

  rename(title: string): void {
    this.title = title;
    this.updatedAt = Date.now();
    this.emit({ kind: 'renamed', sessionId: this.id, title });
  }

  // Per plan §4.6: outputSeq is intentionally NOT reset here. The next 'output'
  // event will have seq strictly greater than any prior seq, even though
  // history is now empty. Renderer must treat 'cleared' as a separate signal
  // distinct from snapshot replay.
  clearScrollback(): void {
    this.history.clear();
    this.updatedAt = Date.now();
    this.emit({ kind: 'cleared', sessionId: this.id });
  }

  snapshot(): Snapshot {
    const s = this.history.snapshotString();
    return {
      sessionId: this.id,
      fromSeq: s.fromSeq,
      toSeq: s.toSeq,
      data: s.data,
      truncated: s.truncated,
    };
  }

  // Called only from TerminalManager.closeAll after the graceful timeout.
  // node-pty on Windows ignores the signal arg; pty.kill() is the hard kill
  // path through conpty. handleExit cleans up.
  forceKill(): void {
    if (!this.pty) return;
    try {
      this.pty.kill();
    } catch (err) {
      log.warn('terminal:forceKill threw', { id: this.id, err });
    }
  }

  async close(): Promise<void> {
    // Flush any pending real output before pty.kill() triggers handleExit.
    this.flush();

    const pty = this.pty;
    if (!pty) {
      if (this.status !== 'errored') this.status = 'exited';
      this.updatedAt = Date.now();
      if (this.closedPending) {
        this.closedPending = false;
        this.emit({ kind: 'closed', sessionId: this.id });
      }
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
    if (this.closedPending) {
      this.closedPending = false;
      this.emit({ kind: 'closed', sessionId: this.id });
    }
  }

  async restart(): Promise<void> {
    // Preserve any pending real output across the restart boundary; the old
    // pty's exit will then run handleExit's flush path for any final chunks
    // and the synthetic exit line.
    this.flush();

    if (this.pty) {
      await this.close();
    }

    // Reset state per plan §4.1
    this.history.clear();
    this.outputSeq = 0;
    this.pid = null;
    this.exitCode = null;
    this.exitSignal = null;
    const now = Date.now();
    this.createdAt = now;
    this.updatedAt = now;
    this.status = 'starting';

    try {
      this.start();
    } catch (err) {
      this.status = 'errored';
      this.updatedAt = Date.now();
      this.emit({
        kind: 'error',
        sessionId: this.id,
        message: errorMessage(err),
        ...(errorCode(err) !== undefined ? { code: errorCode(err)! } : {}),
      });
      throw err;
    }
  }
}
