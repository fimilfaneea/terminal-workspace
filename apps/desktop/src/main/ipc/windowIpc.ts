import { ipcMain, type BrowserWindow } from 'electron';
import { IPC_WINDOW_REQUEST_CLOSE } from '@shared/constants';
import type { IpcResult } from '@shared/types';
import { isShuttingDown } from '../lifecycle';

export interface WindowIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  confirmAndQuit: (win: BrowserWindow) => Promise<void>;
}

export function registerWindowIpc(deps: WindowIpcDeps): () => void {
  ipcMain.handle(IPC_WINDOW_REQUEST_CLOSE, async (): Promise<IpcResult<void>> => {
    if (isShuttingDown()) {
      return { ok: false, message: 'Application is shutting down', code: 'shutting_down' };
    }
    const win = deps.getMainWindow();
    if (!win || win.isDestroyed()) {
      return { ok: false, message: 'No window available', code: 'no_window' };
    }
    await deps.confirmAndQuit(win);
    return { ok: true, value: undefined };
  });

  return () => {
    ipcMain.removeHandler(IPC_WINDOW_REQUEST_CLOSE);
  };
}
