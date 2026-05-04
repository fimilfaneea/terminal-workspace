export interface SavedCommand {
  id: string;
  label: string;
  command: string;
}

export function newSavedCommandId(): string {
  return `cmd:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
