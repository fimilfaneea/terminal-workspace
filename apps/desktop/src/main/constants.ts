export const MAX_HISTORY_LINES = 10_000;
export const MAX_HISTORY_BYTES = 5 * 1024 * 1024;
export const FLUSH_INTERVAL_MS = 12;
export const FLUSH_MAX_BYTES = 64 * 1024;
export const TERMINAL_SHUTDOWN_TIMEOUT_MS = 1500;

export const ENV_DENYLIST_PATTERNS: RegExp[] = [
  /^ELECTRON_/i,
  /^VITE_/i,
  /^npm_/i,
  /^NODE_OPTIONS$/i,
  /^INIT_CWD$/i,
];
