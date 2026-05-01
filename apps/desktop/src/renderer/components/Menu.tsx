import { useEffect, useRef, useState } from 'react';

export type MenuEntry =
  | {
      kind: 'item';
      label: string;
      shortcut?: string;
      disabled?: boolean;
      onActivate: () => void;
    }
  | { kind: 'separator' };

interface Props {
  entries: MenuEntry[];
  position: { x: number; y: number };
  onClose: () => void;
  width?: number;
}

const DEFAULT_WIDTH = 220;
const ITEM_HEIGHT = 28;
const SEPARATOR_HEIGHT = 9;
const VERTICAL_PADDING = 8;

function entryHeight(entry: MenuEntry): number {
  return entry.kind === 'separator' ? SEPARATOR_HEIGHT : ITEM_HEIGHT;
}

export function Menu({ entries, position, onClose, width = DEFAULT_WIDTH }: Props): JSX.Element {
  const containerRef = useRef<HTMLUListElement | null>(null);

  const firstEnabledIndex = entries.findIndex(
    (e) => e.kind === 'item' && !e.disabled,
  );
  const [highlight, setHighlight] = useState<number>(
    firstEnabledIndex === -1 ? 0 : firstEnabledIndex,
  );

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
    const n = entries.length;
    if (n === 0) return;
    let next = highlight;
    for (let i = 0; i < n; i++) {
      next = (next + delta + n) % n;
      const entry = entries[next];
      if (entry && entry.kind === 'item' && !entry.disabled) {
        setHighlight(next);
        return;
      }
    }
  };

  const activate = (index: number): void => {
    const entry = entries[index];
    if (!entry || entry.kind !== 'item' || entry.disabled) return;
    onClose();
    entry.onActivate();
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
    entries.reduce((acc, e) => acc + entryHeight(e), 0) + VERTICAL_PADDING * 2;
  const maxX = window.innerWidth - width - 4;
  const maxY = window.innerHeight - menuHeight - 4;
  const left = Math.max(4, Math.min(position.x, maxX));
  const top = Math.max(4, Math.min(position.y, maxY));

  return (
    <ul
      ref={containerRef}
      role="menu"
      tabIndex={-1}
      className="pane__context-menu"
      style={{ left, top, width }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((entry, index) => {
        if (entry.kind === 'separator') {
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
          entry.disabled ? 'pane__context-menu-item--disabled' : '',
          index === highlight && !entry.disabled
            ? 'pane__context-menu-item--highlight'
            : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li
            key={`item-${index}-${entry.label}`}
            role="menuitem"
            aria-disabled={entry.disabled || undefined}
            className={className}
            onMouseEnter={() => {
              if (!entry.disabled) setHighlight(index);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              activate(index);
            }}
          >
            <span className="pane__context-menu-label">{entry.label}</span>
            {entry.shortcut && (
              <span className="pane__context-menu-shortcut">{entry.shortcut}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
