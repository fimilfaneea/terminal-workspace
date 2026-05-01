import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';

export function PasteConfirmDialog(): JSX.Element | null {
  const request = useWorkspaceStore((s) => s.pasteConfirmRequest);
  const dismiss = useWorkspaceStore((s) => s.dismissPasteConfirm);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!request) return;
    cancelRef.current?.focus();
  }, [request]);

  if (!request) return null;

  const onCancel = (): void => {
    dismiss();
  };

  const onConfirm = (): void => {
    window.terminal.write(request.sessionId, request.text);
    dismiss();
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const active = document.activeElement;
      if (active === confirmRef.current) onConfirm();
      else onCancel();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      const active = document.activeElement;
      if (active === confirmRef.current) cancelRef.current?.focus();
      else confirmRef.current?.focus();
      return;
    }
    e.stopPropagation();
  };

  const onBackdropMouseDown = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="paste-confirm-backdrop"
      onMouseDown={onBackdropMouseDown}
      onKeyDown={onKeyDown}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-confirm-title"
        className="paste-confirm"
      >
        <div className="paste-confirm__title" id="paste-confirm-title">
          Confirm paste
        </div>
        <div className="paste-confirm__body">
          Paste <strong>{request.lines} line{request.lines === 1 ? '' : 's'}</strong>{' '}
          ({request.bytes} bytes) into terminal?
        </div>
        <div className="paste-confirm__actions">
          <button
            ref={cancelRef}
            type="button"
            className="paste-confirm__btn"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="paste-confirm__btn paste-confirm__btn--primary"
            onClick={onConfirm}
          >
            Paste
          </button>
        </div>
      </div>
    </div>
  );
}
