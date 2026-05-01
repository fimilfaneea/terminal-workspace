import { IPC_SHELL_OPEN_EXTERNAL, IPC_WINDOW_REQUEST_CLOSE } from '@shared/constants';
import { callInvoke } from './invoke';

export const shellApi = {
  openExternal: (url: string): Promise<void> =>
    callInvoke<void>(IPC_SHELL_OPEN_EXTERNAL, { url }),
  requestWindowClose: (): Promise<void> =>
    callInvoke<void>(IPC_WINDOW_REQUEST_CLOSE, {}),
};

export type ShellApi = typeof shellApi;
