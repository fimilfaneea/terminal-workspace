export interface PaneHandle {
  paneId: string;
  sessionId: string;
  getSelection: () => string;
  clearSelection: () => void;
  paste: (text: string) => void;
  openFindBar: () => void;
  closeFindBar: () => void;
  startRename: () => void;
  focus: () => void;
}

const handles = new Map<string, PaneHandle>();

export function registerPaneHandle(handle: PaneHandle): () => void {
  handles.set(handle.paneId, handle);
  return () => {
    if (handles.get(handle.paneId) === handle) handles.delete(handle.paneId);
  };
}

export function getPaneHandle(paneId: string): PaneHandle | undefined {
  return handles.get(paneId);
}
