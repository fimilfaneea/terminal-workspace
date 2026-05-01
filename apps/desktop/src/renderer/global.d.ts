/// <reference types="vite/client" />

import type { ClipboardApi } from '@preload/clipboardApi';
import type { ShellApi } from '@preload/shellApi';
import type { TerminalApi } from '@preload/terminalApi';

declare global {
  interface Window {
    terminal: TerminalApi;
    shell: ShellApi;
    clipboard: ClipboardApi;
  }
}

export {};
