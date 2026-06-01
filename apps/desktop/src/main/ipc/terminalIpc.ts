import { ipcMain } from 'electron';
import {
  IPC_TERMINAL_CLEAR_SCROLLBACK,
  IPC_TERMINAL_CLOSE,
  IPC_TERMINAL_CREATE,
  IPC_TERMINAL_LIST,
  IPC_TERMINAL_RENAME,
  IPC_TERMINAL_RESIZE,
  IPC_TERMINAL_RESTART,
  IPC_TERMINAL_SEARCH_ALL_HISTORIES,
  IPC_TERMINAL_SEARCH_HISTORY,
  IPC_TERMINAL_SNAPSHOT,
  IPC_TERMINAL_WRITE,
} from '@shared/constants';
import type {
  AllSearchResults,
  ClearScrollbackPayload,
  CloseSessionPayload,
  CreateSessionOpts,
  IpcResult,
  RenamePayload,
  ResizePayload,
  RestartSessionPayload,
  SearchAllHistoriesPayload,
  SearchHistoryPayload,
  SearchResults,
  SessionInfo,
  Snapshot,
  SnapshotPayload,
  WritePayload,
} from '@shared/types';
import { isShuttingDown } from '../lifecycle';
import { log } from '../logger';
import type { TerminalManager } from '../terminal/TerminalManager';

const SHUTTING_DOWN_RESULT: IpcResult<never> = {
  ok: false,
  message: 'Application is shutting down',
  code: 'shutting_down',
};

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function errorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

async function wrap<T>(channel: string, fn: () => T | Promise<T>): Promise<IpcResult<T>> {
  if (isShuttingDown()) return SHUTTING_DOWN_RESULT;
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err) {
    log.error(`${channel} failed`, err);
    const code = errorCode(err);
    return code !== undefined
      ? { ok: false, message: errorMessage(err), code }
      : { ok: false, message: errorMessage(err) };
  }
}

export function registerTerminalIpc(manager: TerminalManager): () => void {
  ipcMain.handle(IPC_TERMINAL_CREATE, (_e, payload: CreateSessionOpts) =>
    wrap<SessionInfo>(IPC_TERMINAL_CREATE, () => manager.create(payload)),
  );

  ipcMain.handle(IPC_TERMINAL_CLOSE, (_e, payload: CloseSessionPayload) =>
    wrap<void>(IPC_TERMINAL_CLOSE, () => manager.close(payload.sessionId)),
  );

  ipcMain.handle(IPC_TERMINAL_RESTART, (_e, payload: RestartSessionPayload) =>
    wrap<SessionInfo>(IPC_TERMINAL_RESTART, () => manager.restart(payload.sessionId)),
  );

  ipcMain.handle(IPC_TERMINAL_RENAME, (_e, payload: RenamePayload) =>
    wrap<void>(IPC_TERMINAL_RENAME, () => manager.rename(payload.sessionId, payload.title)),
  );

  ipcMain.handle(IPC_TERMINAL_LIST, () =>
    wrap<SessionInfo[]>(IPC_TERMINAL_LIST, () => manager.list()),
  );

  ipcMain.handle(IPC_TERMINAL_SNAPSHOT, (_e, payload: SnapshotPayload) =>
    wrap<Snapshot>(IPC_TERMINAL_SNAPSHOT, () => manager.snapshot(payload.sessionId)),
  );

  ipcMain.handle(IPC_TERMINAL_CLEAR_SCROLLBACK, (_e, payload: ClearScrollbackPayload) =>
    wrap<void>(IPC_TERMINAL_CLEAR_SCROLLBACK, () => manager.clearScrollback(payload.sessionId)),
  );

  ipcMain.handle(IPC_TERMINAL_SEARCH_HISTORY, (_e, payload: SearchHistoryPayload) =>
    wrap<SearchResults>(IPC_TERMINAL_SEARCH_HISTORY, () =>
      manager.searchHistory(payload.sessionId, payload.query, payload.opts),
    ),
  );

  ipcMain.handle(IPC_TERMINAL_SEARCH_ALL_HISTORIES, (_e, payload: SearchAllHistoriesPayload) =>
    wrap<AllSearchResults>(IPC_TERMINAL_SEARCH_ALL_HISTORIES, () =>
      manager.searchAllHistories(payload.query, payload.opts),
    ),
  );

  const onWrite = (_e: Electron.IpcMainEvent, payload: WritePayload): void => {
    if (isShuttingDown()) return;
    try {
      manager.write(payload.sessionId, payload.data);
    } catch (err) {
      log.warn(`${IPC_TERMINAL_WRITE} failed`, err);
    }
  };
  ipcMain.on(IPC_TERMINAL_WRITE, onWrite);

  const onResize = (_e: Electron.IpcMainEvent, payload: ResizePayload): void => {
    if (isShuttingDown()) return;
    try {
      manager.resize(payload.sessionId, payload.cols, payload.rows);
    } catch (err) {
      log.warn(`${IPC_TERMINAL_RESIZE} failed`, err);
    }
  };
  ipcMain.on(IPC_TERMINAL_RESIZE, onResize);

  return () => {
    ipcMain.removeHandler(IPC_TERMINAL_CREATE);
    ipcMain.removeHandler(IPC_TERMINAL_CLOSE);
    ipcMain.removeHandler(IPC_TERMINAL_RESTART);
    ipcMain.removeHandler(IPC_TERMINAL_RENAME);
    ipcMain.removeHandler(IPC_TERMINAL_LIST);
    ipcMain.removeHandler(IPC_TERMINAL_SNAPSHOT);
    ipcMain.removeHandler(IPC_TERMINAL_CLEAR_SCROLLBACK);
    ipcMain.removeHandler(IPC_TERMINAL_SEARCH_HISTORY);
    ipcMain.removeHandler(IPC_TERMINAL_SEARCH_ALL_HISTORIES);
    ipcMain.removeListener(IPC_TERMINAL_WRITE, onWrite);
    ipcMain.removeListener(IPC_TERMINAL_RESIZE, onResize);
  };
}
