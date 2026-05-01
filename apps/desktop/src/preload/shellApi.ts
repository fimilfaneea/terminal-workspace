import {
  IPC_SHELL_GET_DEFAULT_CWDS,
  IPC_SHELL_OPEN_EXTERNAL,
  IPC_SHELL_PICK_FOLDER,
  IPC_WINDOW_REQUEST_CLOSE,
} from '@shared/constants';
import type { DefaultCwds } from '@shared/types';
import { callInvoke } from './invoke';

export const shellApi = {
  openExternal: (url: string): Promise<void> =>
    callInvoke<void>(IPC_SHELL_OPEN_EXTERNAL, { url }),
  requestWindowClose: (): Promise<void> =>
    callInvoke<void>(IPC_WINDOW_REQUEST_CLOSE, {}),
  getDefaultCwds: (): Promise<DefaultCwds> =>
    callInvoke<DefaultCwds>(IPC_SHELL_GET_DEFAULT_CWDS, {}),
  pickFolder: (): Promise<string | null> =>
    callInvoke<string | null>(IPC_SHELL_PICK_FOLDER, {}),
};

export type ShellApi = typeof shellApi;
