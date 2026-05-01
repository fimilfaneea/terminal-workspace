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

interface Item {
  label: string;
  disabled?: boolean;
  onActivate: () => void;
}

const MENU_WIDTH = 200;
const ITEM_HEIGHT = 28;
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

  const items: Item[] = useMemo(
    () => [
      {
        label: 'Copy',
        disabled: !hasSelection,
        onActivate: () => {
          void copySelectionFromPane(paneId);
        },
      },
      {
        label: 'Paste',
        onActivate: () => {
          void pasteIntoPane(paneId);
        },
      },
      {
        label: 'Clear scrollback',
        onActivate: () => {
          void clearScrollback(sessionId);
        },
      },
      {
        label: 'Find',
        onActivate: () => {
          getPaneHandle(paneId)?.openFindBar();
        },
      },
      {
        label: 'Rename',
        onActivate: () => {
          getPaneHandle(paneId)?.startRename();
        },
      },
      {
        label: 'Restart',
        onActivate: () => {
          void restartSession(sessionId);
        },
      },
      {
        label: 'Close pane',
        onActivate: () => {
          void closePane(paneId);
        },
      },
    ],
    [paneId, sessionId, hasSelection, clearScrollback, restartSession, closePane],
  );

  const firstEnabledIndex = items.findIndex((i) => !i.disabled);
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
      if (item && !item.disabled) {
        setHighlight(next);
        return;
      }
    }
  };

  const activate = (index: number): void => {
    const item = items[index];
    if (!item || item.disabled) return;
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

  const menuHeight = items.length * ITEM_HEIGHT + VERTICAL_PADDING * 2;
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
            key={item.label}
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
            {item.label}
          </li>
        );
      })}
    </ul>
  );
}
