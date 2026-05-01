import { clipboard, ipcMain } from 'electron';
import { IPC_CLIPBOARD_READ_TEXT, IPC_CLIPBOARD_WRITE_TEXT } from '@shared/constants';
import type { IpcResult, WriteClipboardPayload } from '@shared/types';
import { isShuttingDown } from '../lifecycle';
import { log } from '../logger';

const SHUTTING_DOWN_RESULT: IpcResult<never> = {
  ok: false,
  message: 'Application is shutting down',
  code: 'shutting_down',
};

export function registerClipboardIpc(): () => void {
  ipcMain.handle(IPC_CLIPBOARD_READ_TEXT, (): IpcResult<string> => {
    if (isShuttingDown()) return SHUTTING_DOWN_RESULT;
    try {
      return { ok: true, value: clipboard.readText() };
    } catch (err) {
      log.error(`${IPC_CLIPBOARD_READ_TEXT} failed`, err);
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message, code: 'clipboard_read_failed' };
    }
  });

  ipcMain.handle(
    IPC_CLIPBOARD_WRITE_TEXT,
    (_e, payload: WriteClipboardPayload): IpcResult<void> => {
      if (isShuttingDown()) return SHUTTING_DOWN_RESULT;
      if (typeof payload?.text !== 'string') {
        return {
          ok: false,
          message: 'text must be a string',
          code: 'clipboard_write_failed',
        };
      }
      try {
        clipboard.writeText(payload.text);
        return { ok: true, value: undefined };
      } catch (err) {
        log.error(`${IPC_CLIPBOARD_WRITE_TEXT} failed`, err);
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, message, code: 'clipboard_write_failed' };
      }
    },
  );

  return () => {
    ipcMain.removeHandler(IPC_CLIPBOARD_READ_TEXT);
    ipcMain.removeHandler(IPC_CLIPBOARD_WRITE_TEXT);
  };
}
