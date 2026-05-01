import { PASTE_CONFIRM_BYTE_THRESHOLD } from '@shared/constants';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';
import { getPaneHandle } from './paneHandles';

function countLines(text: string): number {
  return text.split('\n').length;
}

export async function copySelectionFromPane(paneId: string): Promise<void> {
  const handle = getPaneHandle(paneId);
  if (!handle) return;
  const sel = handle.getSelection();
  if (!sel) return;
  await window.clipboard.writeText(sel);
}

export async function pasteIntoPane(paneId: string): Promise<void> {
  const handle = getPaneHandle(paneId);
  if (!handle) return;
  const text = await window.clipboard.readText();
  if (text.length === 0) return;
  const bytes = new TextEncoder().encode(text).length;
  if (text.includes('\n') && bytes > PASTE_CONFIRM_BYTE_THRESHOLD) {
    useWorkspaceStore.getState().requestPasteConfirm({
      sessionId: handle.sessionId,
      text,
      lines: countLines(text),
      bytes,
    });
    return;
  }
  handle.paste(text);
}
