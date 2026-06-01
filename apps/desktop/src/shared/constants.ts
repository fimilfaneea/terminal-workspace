export const FONT_SIZE_STORAGE_KEY = 'terminalWorkspace.fontSizePx.v1';
export const CWD_PRESETS_STORAGE_KEY = 'terminalWorkspace.cwdPresets.v1';
export const LAST_CWD_STORAGE_KEY = 'terminalWorkspace.lastCwd.v1';
export const SAVED_COMMANDS_STORAGE_KEY = 'terminalWorkspace.savedCommands.v1';
export const DEFAULT_FONT_SIZE_PX = 13;
export const MIN_FONT_SIZE_PX = 8;
export const MAX_FONT_SIZE_PX = 32;

export const PASTE_CONFIRM_BYTE_THRESHOLD = 1024;

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
export const IPC_TERMINAL_SEARCH_HISTORY = 'terminal:searchHistory';
export const IPC_TERMINAL_SEARCH_ALL_HISTORIES = 'terminal:searchAllHistories';

export const MAX_SEARCH_MATCHES_PER_SESSION = 200;
export const MAX_SEARCH_LINE_LENGTH = 240;

export const IPC_SHELL_OPEN_EXTERNAL = 'shell:openExternal';
export const IPC_SHELL_GET_DEFAULT_CWDS = 'shell:getDefaultCwds';
export const IPC_SHELL_PICK_FOLDER = 'shell:pickFolder';

export const IPC_CLIPBOARD_READ_TEXT = 'clipboard:readText';
export const IPC_CLIPBOARD_WRITE_TEXT = 'clipboard:writeText';

export const IPC_WINDOW_REQUEST_CLOSE = 'window:requestClose';
