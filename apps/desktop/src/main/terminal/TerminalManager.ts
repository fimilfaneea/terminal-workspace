import { existsSync, statSync } from 'node:fs';
import type { CreateSessionOpts, SessionInfo } from '@shared/types';
import { log } from '../logger';
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

export class TerminalManager {
  private readonly sessions = new Map<string, TerminalSession>();
  private titleCounter = 0;

  create(opts: CreateSessionOpts): SessionInfo {
    const cwd = resolveCwd(opts.cwd);
    const title = opts.title ?? `Terminal ${++this.titleCounter}`;
    const id = newSessionId();
    const session = new TerminalSession({ id, title, cwd, cols: opts.cols, rows: opts.rows });
    this.sessions.set(id, session);
    try {
      session.start();
    } catch (err) {
      log.error('terminal:create start failed', { id, err });
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

  async close(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    await session.close();
  }

  // Phase 3: simple Promise.all of close(). Phase 4 adds the graceful/force race.
  async closeAll(_timeoutMs?: number): Promise<void> {
    const all = [...this.sessions.values()];
    await Promise.all(all.map((s) => s.close().catch((err) => log.warn('closeAll: session close failed', err))));
    this.sessions.clear();
  }
}
