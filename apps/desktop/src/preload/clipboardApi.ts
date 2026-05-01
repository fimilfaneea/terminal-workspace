import { IPC_CLIPBOARD_READ_TEXT, IPC_CLIPBOARD_WRITE_TEXT } from '@shared/constants';
import { callInvoke } from './invoke';

export const clipboardApi = {
  readText: (): Promise<string> => callInvoke<string>(IPC_CLIPBOARD_READ_TEXT, {}),
  writeText: (text: string): Promise<void> =>
    callInvoke<void>(IPC_CLIPBOARD_WRITE_TEXT, { text }),
};

export type ClipboardApi = typeof clipboardApi;
