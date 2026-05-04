import { useEffect, useRef, useState } from 'react';
import type { SavedCommand } from '@renderer/lib/savedCommands';

interface Props {
  commands: SavedCommand[];
  onAdd: (label: string, command: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onUpdate: (id: string, command: string) => void;
  onClose: () => void;
}

export function ManageCommandsDialog({
  commands,
  onAdd,
  onRemove,
  onRename,
  onUpdate,
  onClose,
}: Props): JSX.Element {
  const [newLabel, setNewLabel] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [editLabelId, setEditLabelId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCommandId, setEditCommandId] = useState<string | null>(null);
  const [editCommand, setEditCommand] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const onAddClick = (): void => {
    const cmd = newCommand.replace(/\s+$/u, '');
    if (!cmd) return;
    onAdd(newLabel.trim() || (cmd.split('\n')[0] ?? cmd), cmd);
    setNewLabel('');
    setNewCommand('');
  };

  const onBackdropMouseDown = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  const startEditLabel = (c: SavedCommand): void => {
    setEditLabelId(c.id);
    setEditLabel(c.label);
  };

  const commitEditLabel = (): void => {
    if (editLabelId !== null) {
      const trimmed = editLabel.trim();
      if (trimmed.length > 0) onRename(editLabelId, trimmed);
    }
    setEditLabelId(null);
    setEditLabel('');
  };

  const startEditCommand = (c: SavedCommand): void => {
    setEditCommandId(c.id);
    setEditCommand(c.command);
  };

  const commitEditCommand = (): void => {
    if (editCommandId !== null) {
      const trimmed = editCommand.replace(/\s+$/u, '');
      if (trimmed.length > 0) onUpdate(editCommandId, trimmed);
    }
    setEditCommandId(null);
    setEditCommand('');
  };

  return (
    <div
      className="paste-confirm-backdrop"
      onMouseDown={onBackdropMouseDown}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-commands-title"
        className="manage-presets manage-commands"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="manage-presets__title" id="manage-commands-title">
          Manage saved commands
        </div>

        <div className="manage-presets__list">
          {commands.length === 0 && (
            <div className="manage-presets__empty">
              No saved commands yet.
            </div>
          )}
          {commands.map((c) => (
            <div key={c.id} className="manage-commands__row">
              <div className="manage-commands__row-head">
                {editLabelId === c.id ? (
                  <input
                    className="manage-presets__edit-input"
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={commitEditLabel}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitEditLabel();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditLabelId(null);
                        setEditLabel('');
                      }
                      e.stopPropagation();
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="manage-presets__label"
                    onClick={() => startEditLabel(c)}
                    title="Click to rename"
                  >
                    {c.label}
                  </button>
                )}
                <button
                  type="button"
                  className="manage-presets__remove"
                  title="Remove command"
                  onClick={() => onRemove(c.id)}
                >
                  ×
                </button>
              </div>
              {editCommandId === c.id ? (
                <textarea
                  className="manage-commands__edit-textarea"
                  autoFocus
                  rows={Math.min(8, Math.max(2, c.command.split('\n').length + 1))}
                  value={editCommand}
                  onChange={(e) => setEditCommand(e.target.value)}
                  onBlur={commitEditCommand}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditCommandId(null);
                      setEditCommand('');
                    }
                    e.stopPropagation();
                  }}
                  spellCheck={false}
                />
              ) : (
                <button
                  type="button"
                  className="manage-commands__command"
                  onClick={() => startEditCommand(c)}
                  title="Click to edit command"
                >
                  <pre className="manage-commands__command-pre">{c.command}</pre>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="manage-commands__add">
          <input
            className="manage-presets__input"
            placeholder="Label (optional)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            spellCheck={false}
          />
          <textarea
            className="manage-commands__add-textarea"
            placeholder="Command (multi-line OK)"
            rows={3}
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            spellCheck={false}
          />
          <button
            type="button"
            className="manage-presets__btn manage-presets__btn--primary"
            onClick={onAddClick}
            disabled={newCommand.trim().length === 0}
          >
            Add
          </button>
        </div>

        <div className="manage-presets__actions">
          <button
            type="button"
            className="paste-confirm__btn"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
