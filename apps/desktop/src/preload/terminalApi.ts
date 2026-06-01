import { ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  IPC_TERMINAL_CLEAR_SCROLLBACK,
  IPC_TERMINAL_CLOSE,
  IPC_TERMINAL_CREATE,
  IPC_TERMINAL_EVENT,
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
  CreateSessionOpts,
  SearchOpts,
  SearchResults,
  SessionInfo,
  Snapshot,
  TerminalEvent,
} from '@shared/types';
import { callInvoke } from './invoke';

export const terminalApi = {
  create: (opts: CreateSessionOpts): Promise<SessionInfo> =>
    callInvoke<SessionInfo>(IPC_TERMINAL_CREATE, opts),
  write: (sessionId: string, data: string): void => {
    ipcRenderer.send(IPC_TERMINAL_WRITE, { sessionId, data });
  },
  resize: (sessionId: string, cols: number, rows: number): void => {
    ipcRenderer.send(IPC_TERMINAL_RESIZE, { sessionId, cols, rows });
  },
  close: (sessionId: string): Promise<void> =>
    callInvoke<void>(IPC_TERMINAL_CLOSE, { sessionId }),
  restart: (sessionId: string): Promise<SessionInfo> =>
    callInvoke<SessionInfo>(IPC_TERMINAL_RESTART, { sessionId }),
  rename: (sessionId: string, title: string): Promise<void> =>
    callInvoke<void>(IPC_TERMINAL_RENAME, { sessionId, title }),
  list: (): Promise<SessionInfo[]> => callInvoke<SessionInfo[]>(IPC_TERMINAL_LIST, {}),
  snapshot: (sessionId: string): Promise<Snapshot> =>
    callInvoke<Snapshot>(IPC_TERMINAL_SNAPSHOT, { sessionId }),
  clearScrollback: (sessionId: string): Promise<void> =>
    callInvoke<void>(IPC_TERMINAL_CLEAR_SCROLLBACK, { sessionId }),
  searchHistory: (sessionId: string, query: string, opts: SearchOpts): Promise<SearchResults> =>
    callInvoke<SearchResults>(IPC_TERMINAL_SEARCH_HISTORY, { sessionId, query, opts }),
  searchAllHistories: (query: string, opts: SearchOpts): Promise<AllSearchResults> =>
    callInvoke<AllSearchResults>(IPC_TERMINAL_SEARCH_ALL_HISTORIES, { query, opts }),
  onEvent: (listener: (evt: TerminalEvent) => void): (() => void) => {
    const handler = (_e: IpcRendererEvent, evt: TerminalEvent): void => listener(evt);
    ipcRenderer.on(IPC_TERMINAL_EVENT, handler);
    return () => {
      ipcRenderer.off(IPC_TERMINAL_EVENT, handler);
    };
  },
};

export type TerminalApi = typeof terminalApi;
