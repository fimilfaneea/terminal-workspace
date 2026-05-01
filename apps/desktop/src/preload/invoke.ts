import { ipcRenderer } from 'electron';
import type { IpcResult } from '@shared/types';
import { TerminalApiError } from './errors';

export async function callInvoke<T>(channel: string, payload: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>;
  if (result.ok) return result.value;
  throw new TerminalApiError(result.message, result.code);
}
