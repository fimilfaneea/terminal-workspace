import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import {
  IPC_SHELL_GET_DEFAULT_CWDS,
  IPC_SHELL_OPEN_EXTERNAL,
  IPC_SHELL_PICK_FOLDER,
} from '@shared/constants';
import type {
  DefaultCwds,
  IpcResult,
  OpenExternalPayload,
} from '@shared/types';
import { isShuttingDown } from '../lifecycle';
import { log } from '../logger';

function safeGetPath(name: 'home' | 'desktop' | 'documents' | 'downloads'): string | null {
  try {
    const p = app.getPath(name);
    return typeof p === 'string' && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

export function registerShellIpc(): () => void {
  ipcMain.handle(
    IPC_SHELL_OPEN_EXTERNAL,
    async (_e, payload: OpenExternalPayload): Promise<IpcResult<void>> => {
      if (isShuttingDown()) {
        return { ok: false, message: 'Application is shutting down', code: 'shutting_down' };
      }
      const url = typeof payload?.url === 'string' ? parseHttpUrl(payload.url) : null;
      if (!url) {
        return { ok: false, message: 'URL must be http(s)', code: 'invalid_url' };
      }
      try {
        await shell.openExternal(url.toString());
        return { ok: true, value: undefined };
      } catch (err) {
        log.error(`${IPC_SHELL_OPEN_EXTERNAL} failed`, err);
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, message, code: 'open_external_failed' };
      }
    },
  );

  ipcMain.handle(
    IPC_SHELL_GET_DEFAULT_CWDS,
    async (): Promise<IpcResult<DefaultCwds>> => {
      if (isShuttingDown()) {
        return { ok: false, message: 'Application is shutting down', code: 'shutting_down' };
      }
      const home = safeGetPath('home') ?? '';
      return {
        ok: true,
        value: {
          home,
          desktop: safeGetPath('desktop'),
          documents: safeGetPath('documents'),
          downloads: safeGetPath('downloads'),
        },
      };
    },
  );

  ipcMain.handle(
    IPC_SHELL_PICK_FOLDER,
    async (e): Promise<IpcResult<string | null>> => {
      if (isShuttingDown()) {
        return { ok: false, message: 'Application is shutting down', code: 'shutting_down' };
      }
      const win = BrowserWindow.fromWebContents(e.sender);
      try {
        const result = win
          ? await dialog.showOpenDialog(win, {
              properties: ['openDirectory'],
              title: 'Choose folder',
            })
          : await dialog.showOpenDialog({
              properties: ['openDirectory'],
              title: 'Choose folder',
            });
        if (result.canceled || result.filePaths.length === 0) {
          return { ok: true, value: null };
        }
        return { ok: true, value: result.filePaths[0] ?? null };
      } catch (err) {
        log.error(`${IPC_SHELL_PICK_FOLDER} failed`, err);
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, message, code: 'pick_folder_failed' };
      }
    },
  );

  return () => {
    ipcMain.removeHandler(IPC_SHELL_OPEN_EXTERNAL);
    ipcMain.removeHandler(IPC_SHELL_GET_DEFAULT_CWDS);
    ipcMain.removeHandler(IPC_SHELL_PICK_FOLDER);
  };
}
