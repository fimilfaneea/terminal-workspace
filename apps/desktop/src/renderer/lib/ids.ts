export function newPaneId(): string {
  return crypto.randomUUID();
}

export function newTabId(): string {
  return crypto.randomUUID();
}
