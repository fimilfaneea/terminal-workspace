import {
  IPC_SHELL_GET_DEFAULT_CWDS,
  IPC_SHELL_OPEN_EXTERNAL,
  IPC_SHELL_PICK_FOLDER,
  IPC_WINDOW_CLAIM_ADOPTED_TAB,
  IPC_WINDOW_OPEN,
  IPC_WINDOW_OPEN_WITH_TAB,
  IPC_WINDOW_REQUEST_CLOSE,
} from '@shared/constants';
import type { DefaultCwds, SerializedTab } from '@shared/types';
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
  // Multi-window
  openWindow: (): Promise<void> => callInvoke<void>(IPC_WINDOW_OPEN, {}),
  openWindowWithTab: (tab: SerializedTab): Promise<void> =>
    callInvoke<void>(IPC_WINDOW_OPEN_WITH_TAB, { tab }),
  // An adopt window calls this once its renderer is ready to receive the
  // detached tab. Returns null for ordinary (non-adopt) windows.
  claimAdoptedTab: (): Promise<SerializedTab | null> =>
    callInvoke<SerializedTab | null>(IPC_WINDOW_CLAIM_ADOPTED_TAB, {}),
};

export type ShellApi = typeof shellApi;
