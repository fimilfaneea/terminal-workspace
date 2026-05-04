import { PASTE_CONFIRM_BYTE_THRESHOLD } from '@shared/constants';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';
import { getPaneHandle } from './paneHandles';

function countLines(text: string): number {
  return text.split('\n').length;
}

/**
 * Strip the *trailing* line terminator(s) so the last line of a paste sits at
 * the prompt awaiting Enter. Internal newlines are preserved so multi-line
 * pastes still execute their first N-1 lines as a normal terminal would.
 * Matches Windows Terminal / iTerm2 default paste behaviour.
 */
export function stripTrailingNewline(text: string): string {
  return text.replace(/(\r\n|\r|\n)+$/u, '');
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
  handle.paste(stripTrailingNewline(text));
}
