import { useEffect, useRef, useState } from 'react';
import {
  selectActivePane,
  useWorkspaceStore,
} from '@renderer/state/workspaceStore';
import { usePersistedSavedCommands } from '@renderer/hooks/usePersistedSavedCommands';
import { stripTrailingNewline } from '@renderer/lib/clipboard';
import { getPaneHandle } from '@renderer/lib/paneHandles';
import type { SavedCommand } from '@renderer/lib/savedCommands';
import { SavedCommandsPicker } from './SavedCommandsPicker';
import { ManageCommandsDialog } from './ManageCommandsDialog';

export const SAVED_COMMANDS_OPEN_EVENT = 'commandsPicker:open';

export function SavedCommandsButton(): JSX.Element {
  const persisted = usePersistedSavedCommands();
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [showManage, setShowManage] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const openFromButton = (): void => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPickerPos({ x: rect.left, y: rect.bottom + 2 });
  };

  useEffect(() => {
    const handler = (): void => openFromButton();
    window.addEventListener(SAVED_COMMANDS_OPEN_EVENT, handler);
    return () => window.removeEventListener(SAVED_COMMANDS_OPEN_EVENT, handler);
  }, []);

  const activate = (cmd: SavedCommand): void => {
    const body = stripTrailingNewline(cmd.command);
    void window.clipboard.writeText(body).catch(() => {
      // best-effort clipboard copy
    });
    const state = useWorkspaceStore.getState();
    const pane = selectActivePane(state);
    if (pane && pane.type === 'leaf') {
      window.terminal.write(pane.sessionId, body);
      getPaneHandle(pane.id)?.focus();
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="tab-bar__commands"
        title="Saved commands (Ctrl+Shift+K)"
        onClick={openFromButton}
      >
        <span className="tab-bar__commands-icon" aria-hidden="true">
          ⌘
        </span>
        <span className="tab-bar__commands-arrow" aria-hidden="true">
          ▾
        </span>
      </button>
      {pickerPos && (
        <SavedCommandsPicker
          commands={persisted.commands}
          position={pickerPos}
          onPick={(cmd) => {
            activate(cmd);
          }}
          onManage={() => {
            setShowManage(true);
          }}
          onClose={() => setPickerPos(null)}
        />
      )}
      {showManage && (
        <ManageCommandsDialog
          commands={persisted.commands}
          onAdd={persisted.addCommand}
          onRemove={persisted.removeCommand}
          onRename={persisted.renameCommand}
          onUpdate={persisted.updateCommand}
          onClose={() => setShowManage(false)}
        />
      )}
    </>
  );
}
