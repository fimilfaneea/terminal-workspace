import { ipcMain, shell } from 'electron';
import { IPC_SHELL_OPEN_EXTERNAL } from '@shared/constants';
import type { IpcResult, OpenExternalPayload } from '@shared/types';
import { isShuttingDown } from '../lifecycle';
import { log } from '../logger';

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

  return () => {
    ipcMain.removeHandler(IPC_SHELL_OPEN_EXTERNAL);
  };
}
