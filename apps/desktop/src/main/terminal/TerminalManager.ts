import { existsSync, statSync } from 'node:fs';
import type {
  AllSearchResults,
  CreateSessionOpts,
  SearchOpts,
  SearchResults,
  SessionInfo,
  SessionSearchResults,
  Snapshot,
  TerminalEvent,
} from '@shared/types';
import { TERMINAL_SHUTDOWN_TIMEOUT_MS } from '../constants';
import { log } from '../logger';
import { Emitter } from './events';
import { newSessionId } from './ids';
import { TerminalSession } from './TerminalSession';

function isUsableDir(p: string | undefined): p is string {
  if (!p) return false;
  try {
    return existsSync(p) && statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function resolveCwd(explicit?: string): string {
  if (isUsableDir(explicit)) return explicit;
  const userProfile = process.env['USERPROFILE'];
  if (isUsableDir(userProfile)) return userProfile;
  return process.cwd();
}

export class UnknownSessionError extends Error {
  readonly code = 'unknown_session';
  constructor(sessionId: string) {
    super(`Unknown session: ${sessionId}`);
    this.name = 'UnknownSessionError';
  }
}

export class InvalidTitleError extends Error {
  readonly code = 'invalid_title';
  constructor() {
    super('Title must be a non-empty string');
    this.name = 'InvalidTitleError';
  }
}

export class TerminalManager {
  private readonly sessions = new Map<string, TerminalSession>();
  private titleCounter = 0;
  private readonly events = new Emitter<TerminalEvent>();
  private readonly emit = (event: TerminalEvent): void => this.events.emit(event);

  onEvent(listener: (event: TerminalEvent) => void): () => void {
    return this.events.on(listener);
  }

  create(opts: CreateSessionOpts): SessionInfo {
    const cwd = resolveCwd(opts.cwd);
    const title = opts.title ?? `Terminal ${++this.titleCounter}`;
    const id = newSessionId();
    const session = new TerminalSession({
      id,
      title,
      cwd,
      cols: opts.cols,
      rows: opts.rows,
      emit: this.emit,
    });
    this.sessions.set(id, session);
    try {
      session.start();
    } catch (err) {
      log.error('terminal:create start failed', { id, err });
      this.sessions.delete(id);
      throw err;
    }
    return session.getInfo();
  }

  get(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  list(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => s.getInfo());
  }

  runningCount(): number {
    let n = 0;
    for (const s of this.sessions.values()) {
      if (s.getStatus() === 'running') n++;
    }
    return n;
  }

  private require(sessionId: string): TerminalSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new UnknownSessionError(sessionId);
    return session;
  }

  write(sessionId: string, data: string): void {
    this.require(sessionId).write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.require(sessionId).resize(cols, rows);
  }

  rename(sessionId: string, title: string): void {
    if (typeof title !== 'string' || title.trim() === '') throw new InvalidTitleError();
    this.require(sessionId).rename(title);
  }

  clearScrollback(sessionId: string): void {
    this.require(sessionId).clearScrollback();
  }

  snapshot(sessionId: string): Snapshot {
    return this.require(sessionId).snapshot();
  }

  searchHistory(sessionId: string, query: string, opts: SearchOpts): SearchResults {
    return this.require(sessionId).searchHistory(query, opts);
  }

  searchAllHistories(query: string, opts: SearchOpts): AllSearchResults {
    const perSession: SessionSearchResults[] = [];
    for (const [id, s] of this.sessions) {
      const results = s.searchHistory(query, opts);
      perSession.push({ sessionId: id, title: s.getTitle(), results });
    }
    return { perSession };
  }

  async restart(sessionId: string): Promise<SessionInfo> {
    const session = this.require(sessionId);
    await session.restart();
    return session.getInfo();
  }

  async close(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    await session.close();
  }

  async closeAll(timeoutMs: number = TERMINAL_SHUTDOWN_TIMEOUT_MS): Promise<void> {
    const all = [...this.sessions.values()];
    if (all.length === 0) {
      this.sessions.clear();
      return;
    }

    const closes = all.map((s) =>
      s.close().catch((err) => log.warn('closeAll: graceful close failed', err)),
    );

    let timedOut = false;
    await Promise.race([
      Promise.allSettled(closes),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          timedOut = true;
          resolve();
        }, timeoutMs),
      ),
    ]);

    if (timedOut) {
      for (const s of all) {
        const status = s.getStatus();
        if (status === 'running' || status === 'starting') {
          try {
            s.forceKill();
          } catch (err) {
            log.warn('closeAll: forceKill threw', err);
          }
        }
      }
      // Short tail wait so process handles can finalize.
      await Promise.race([
        Promise.allSettled(closes),
        new Promise<void>((resolve) => setTimeout(resolve, 250)),
      ]);
    }

    this.sessions.clear();
  }
}
