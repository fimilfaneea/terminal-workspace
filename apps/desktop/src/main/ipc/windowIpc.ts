import { ipcMain } from 'electron';
import { IPC_WINDOW_REQUEST_CLOSE } from '@shared/constants';
import type { IpcResult } from '@shared/types';
import { log } from '../logger';

export function registerWindowIpc(): () => void {
  ipcMain.handle(IPC_WINDOW_REQUEST_CLOSE, (): IpcResult<void> => {
    log.warn('window:requestClose stub — full flow lands in Phase 10');
    return { ok: true, value: undefined };
  });

  return () => {
    ipcMain.removeHandler(IPC_WINDOW_REQUEST_CLOSE);
  };
}
