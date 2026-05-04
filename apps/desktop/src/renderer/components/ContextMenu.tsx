import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';
import { getPaneHandle } from '@renderer/lib/paneHandles';
import {
  copySelectionFromPane,
  pasteIntoPane,
} from '@renderer/lib/clipboard';

interface Props {
  paneId: string;
  sessionId: string;
  hasSelection: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

type Item =
  | {
      kind: 'item';
      label: string;
      shortcut?: string;
      disabled?: boolean;
      onActivate: () => void;
    }
  | { kind: 'separator' };

const MENU_WIDTH = 220;
const ITEM_HEIGHT = 28;
const SEPARATOR_HEIGHT = 9;
const VERTICAL_PADDING = 8;

export function ContextMenu({
  paneId,
  sessionId,
  hasSelection,
  position,
  onClose,
}: Props): JSX.Element {
  const clearScrollback = useWorkspaceStore((s) => s.clearScrollback);
  const restartSession = useWorkspaceStore((s) => s.restartSession);
  const closePane = useWorkspaceStore((s) => s.closePane);
  const splitFocusedPane = useWorkspaceStore((s) => s.splitFocusedPane);
  const bumpFontSize = useWorkspaceStore((s) => s.bumpFontSize);
  const resetFontSize = useWorkspaceStore((s) => s.resetFontSize);
  const requestWindowClose = (): Promise<void> => window.shell.requestWindowClose();

  const items: Item[] = useMemo(
    () => [
      {
        kind: 'item',
        label: 'Copy',
        shortcut: 'Ctrl+C',
        disabled: !hasSelection,
        onActivate: () => {
          void copySelectionFromPane(paneId);
        },
      },
      {
        kind: 'item',
        label: 'Paste',
        shortcut: 'Ctrl+V',
        onActivate: () => {
          void pasteIntoPane(paneId);
        },
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Split right',
        shortcut: 'Ctrl+Shift+E',
        onActivate: () => {
          void splitFocusedPane('horizontal');
        },
      },
      {
        kind: 'item',
        label: 'Split down',
        shortcut: 'Ctrl+Shift+O',
        onActivate: () => {
          void splitFocusedPane('vertical');
        },
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Find',
        shortcut: 'Ctrl+F',
        onActivate: () => {
          getPaneHandle(paneId)?.openFindBar();
        },
      },
      {
        kind: 'item',
        label: 'Clear scrollback',
        onActivate: () => {
          void clearScrollback(sessionId);
        },
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Increase font size',
        shortcut: 'Ctrl+=',
        onActivate: () => {
          bumpFontSize(1);
        },
      },
      {
        kind: 'item',
        label: 'Decrease font size',
        shortcut: 'Ctrl+-',
        onActivate: () => {
          bumpFontSize(-1);
        },
      },
      {
        kind: 'item',
        label: 'Reset font size',
        shortcut: 'Ctrl+0',
        onActivate: () => {
          resetFontSize();
        },
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Rename pane',
        shortcut: 'Ctrl+Shift+R',
        onActivate: () => {
          getPaneHandle(paneId)?.startRename();
        },
      },
      {
        kind: 'item',
        label: 'Restart',
        shortcut: 'Ctrl+Shift+Enter',
        onActivate: () => {
          void restartSession(sessionId);
        },
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Close pane',
        shortcut: 'Ctrl+Shift+X',
        onActivate: () => {
          void (async () => {
            const result = await closePane(paneId);
            if (result.wouldCloseWindow) await requestWindowClose();
          })();
        },
      },
    ],
    [paneId, sessionId, hasSelection, clearScrollback, restartSession, closePane, splitFocusedPane, bumpFontSize, resetFontSize],
  );

  const firstEnabledIndex = items.findIndex(
    (i) => i.kind === 'item' && !i.disabled,
  );
  const [highlight, setHighlight] = useState<number>(
    firstEnabledIndex === -1 ? 0 : firstEnabledIndex,
  );
  const containerRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent): void => {
      if (containerRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [onClose]);

  const moveHighlight = (delta: number): void => {
    const n = items.length;
    let next = highlight;
    for (let i = 0; i < n; i++) {
      next = (next + delta + n) % n;
      const item = items[next];
      if (item && item.kind === 'item' && !item.disabled) {
        setHighlight(next);
        return;
      }
    }
  };

  const activate = (index: number): void => {
    const item = items[index];
    if (!item || item.kind !== 'item' || item.disabled) return;
    onClose();
    item.onActivate();
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      moveHighlight(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      moveHighlight(-1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      activate(highlight);
      return;
    }
    e.stopPropagation();
  };

  const menuHeight =
    items.reduce(
      (acc, i) => acc + (i.kind === 'separator' ? SEPARATOR_HEIGHT : ITEM_HEIGHT),
      0,
    ) + VERTICAL_PADDING * 2;
  const maxX = window.innerWidth - MENU_WIDTH - 4;
  const maxY = window.innerHeight - menuHeight - 4;
  const left = Math.max(4, Math.min(position.x, maxX));
  const top = Math.max(4, Math.min(position.y, maxY));

  return (
    <ul
      ref={containerRef}
      role="menu"
      tabIndex={-1}
      className="pane__context-menu"
      style={{ left, top, width: MENU_WIDTH }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => {
        if (item.kind === 'separator') {
          return (
            <li
              key={`sep-${index}`}
              role="separator"
              className="pane__context-menu-sep"
              aria-hidden="true"
            />
          );
        }
        const className = [
          'pane__context-menu-item',
          item.disabled ? 'pane__context-menu-item--disabled' : '',
          index === highlight && !item.disabled
            ? 'pane__context-menu-item--highlight'
            : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li
            key={`item-${index}-${item.label}`}
            role="menuitem"
            aria-disabled={item.disabled || undefined}
            className={className}
            onMouseEnter={() => {
              if (!item.disabled) setHighlight(index);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              activate(index);
            }}
          >
            <span className="pane__context-menu-label">{item.label}</span>
            {item.shortcut && (
              <span className="pane__context-menu-shortcut">{item.shortcut}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
