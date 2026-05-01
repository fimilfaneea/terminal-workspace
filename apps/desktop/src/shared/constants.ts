export const FONT_SIZE_STORAGE_KEY = 'terminalWorkspace.fontSizePx.v1';
export const DEFAULT_FONT_SIZE_PX = 13;
export const MIN_FONT_SIZE_PX = 8;
export const MAX_FONT_SIZE_PX = 32;

export const IPC_TERMINAL_CREATE = 'terminal:create';
export const IPC_TERMINAL_WRITE = 'terminal:write';
export const IPC_TERMINAL_RESIZE = 'terminal:resize';
export const IPC_TERMINAL_CLOSE = 'terminal:close';
export const IPC_TERMINAL_RESTART = 'terminal:restart';
export const IPC_TERMINAL_RENAME = 'terminal:rename';
export const IPC_TERMINAL_LIST = 'terminal:list';
export const IPC_TERMINAL_SNAPSHOT = 'terminal:snapshot';
export const IPC_TERMINAL_CLEAR_SCROLLBACK = 'terminal:clearScrollback';
export const IPC_TERMINAL_EVENT = 'terminal:event';

export const IPC_SHELL_OPEN_EXTERNAL = 'shell:openExternal';

export const IPC_CLIPBOARD_READ_TEXT = 'clipboard:readText';
export const IPC_CLIPBOARD_WRITE_TEXT = 'clipboard:writeText';

export const IPC_WINDOW_REQUEST_CLOSE = 'window:requestClose';
