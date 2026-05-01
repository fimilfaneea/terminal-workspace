import { useEffect, useRef, useState } from 'react';
import type { UserCwdPreset } from '@renderer/lib/cwdPresets';

interface Props {
  presets: UserCwdPreset[];
  onAdd: (label: string, path: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onPickFolder: () => Promise<string | null>;
  onClose: () => void;
}

export function ManagePresetsDialog({
  presets,
  onAdd,
  onRemove,
  onRename,
  onPickFolder,
  onClose,
}: Props): JSX.Element {
  const [newLabel, setNewLabel] = useState('');
  const [newPath, setNewPath] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const onPick = async (): Promise<void> => {
    const path = await onPickFolder();
    if (path) setNewPath(path);
  };

  const onAddClick = (): void => {
    const path = newPath.trim();
    if (!path) return;
    onAdd(newLabel.trim() || path, path);
    setNewLabel('');
    setNewPath('');
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

  const startEdit = (preset: UserCwdPreset): void => {
    setEditingId(preset.id);
    setEditingLabel(preset.label);
  };

  const commitEdit = (): void => {
    if (editingId !== null) {
      const trimmed = editingLabel.trim();
      if (trimmed.length > 0) onRename(editingId, trimmed);
    }
    setEditingId(null);
    setEditingLabel('');
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
        aria-labelledby="manage-presets-title"
        className="manage-presets"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="manage-presets__title" id="manage-presets-title">
          Manage cwd presets
        </div>

        <div className="manage-presets__list">
          {presets.length === 0 && (
            <div className="manage-presets__empty">No custom presets yet.</div>
          )}
          {presets.map((p) => (
            <div key={p.id} className="manage-presets__row">
              {editingId === p.id ? (
                <input
                  className="manage-presets__edit-input"
                  autoFocus
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitEdit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditingId(null);
                      setEditingLabel('');
                    }
                    e.stopPropagation();
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="manage-presets__label"
                  onClick={() => startEdit(p)}
                  title="Click to rename"
                >
                  {p.label}
                </button>
              )}
              <span className="manage-presets__path" title={p.path}>
                {p.path}
              </span>
              <button
                type="button"
                className="manage-presets__remove"
                title="Remove preset"
                onClick={() => onRemove(p.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="manage-presets__add">
          <input
            className="manage-presets__input"
            placeholder="Label (optional)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            spellCheck={false}
          />
          <input
            className="manage-presets__input manage-presets__input--path"
            placeholder="Path"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            spellCheck={false}
          />
          <button
            type="button"
            className="manage-presets__btn"
            onClick={() => {
              void onPick();
            }}
          >
            Browse…
          </button>
          <button
            type="button"
            className="manage-presets__btn manage-presets__btn--primary"
            onClick={onAddClick}
            disabled={newPath.trim().length === 0}
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
