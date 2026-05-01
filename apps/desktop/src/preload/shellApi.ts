import { IPC_SHELL_OPEN_EXTERNAL } from '@shared/constants';
import { callInvoke } from './invoke';

export const shellApi = {
  openExternal: (url: string): Promise<void> =>
    callInvoke<void>(IPC_SHELL_OPEN_EXTERNAL, { url }),
};

export type ShellApi = typeof shellApi;
