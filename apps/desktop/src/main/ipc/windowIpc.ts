import { BrowserWindow, ipcMain } from 'electron';
import {
  IPC_WINDOW_CLAIM_ADOPTED_TAB,
  IPC_WINDOW_OPEN,
  IPC_WINDOW_OPEN_WITH_TAB,
  IPC_WINDOW_REQUEST_CLOSE,
} from '@shared/constants';
import type { IpcResult, OpenWithTabPayload, SerializedTab } from '@shared/types';
import { isShuttingDown } from '../lifecycle';

export interface WindowIpcDeps {
  openWindow: () => void;
  openWindowWithTab: (payload: OpenWithTabPayload, senderId: number) => void;
  claimAdoptedTab: (senderId: number) => SerializedTab | null;
  confirmAndCloseWindow: (win: BrowserWindow) => Promise<void>;
}

export function registerWindowIpc(deps: WindowIpcDeps): () => void {
  ipcMain.handle(IPC_WINDOW_REQUEST_CLOSE, async (e): Promise<IpcResult<void>> => {
    if (isShuttingDown()) {
      return { ok: false, message: 'Application is shutting down', code: 'shutting_down' };
    }
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win || win.isDestroyed()) {
      return { ok: false, message: 'No window available', code: 'no_window' };
    }
    await deps.confirmAndCloseWindow(win);
    return { ok: true, value: undefined };
  });

  ipcMain.handle(IPC_WINDOW_OPEN, (): IpcResult<void> => {
    if (isShuttingDown()) {
      return { ok: false, message: 'Application is shutting down', code: 'shutting_down' };
    }
    deps.openWindow();
    return { ok: true, value: undefined };
  });

  ipcMain.handle(
    IPC_WINDOW_OPEN_WITH_TAB,
    (e, payload: OpenWithTabPayload): IpcResult<void> => {
      if (isShuttingDown()) {
        return { ok: false, message: 'Application is shutting down', code: 'shutting_down' };
      }
      deps.openWindowWithTab(payload, e.sender.id);
      return { ok: true, value: undefined };
    },
  );

  ipcMain.handle(IPC_WINDOW_CLAIM_ADOPTED_TAB, (e): IpcResult<SerializedTab | null> => {
    return { ok: true, value: deps.claimAdoptedTab(e.sender.id) };
  });

  return () => {
    ipcMain.removeHandler(IPC_WINDOW_REQUEST_CLOSE);
    ipcMain.removeHandler(IPC_WINDOW_OPEN);
    ipcMain.removeHandler(IPC_WINDOW_OPEN_WITH_TAB);
    ipcMain.removeHandler(IPC_WINDOW_CLAIM_ADOPTED_TAB);
  };
}
