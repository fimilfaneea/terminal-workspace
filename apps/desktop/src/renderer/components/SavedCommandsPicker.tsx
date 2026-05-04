import { useEffect, useMemo, useRef, useState } from 'react';
import type { SavedCommand } from '@renderer/lib/savedCommands';

interface Props {
  commands: SavedCommand[];
  position: { x: number; y: number };
  onPick: (cmd: SavedCommand) => void;
  onManage: () => void;
  onClose: () => void;
}

const PICKER_WIDTH = 360;
const MAX_HEIGHT_VH = 50;

export function SavedCommandsPicker({
  commands,
  position,
  onPick,
  onManage,
  onClose,
}: Props): JSX.Element {
  const [filter, setFilter] = useState('');
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo<SavedCommand[]>(() => {
    const q = filter.trim().toLowerCase();
    if (q.length === 0) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.command.toLowerCase().includes(q),
    );
  }, [commands, filter]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [filter, commands.length]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent): void => {
      if (containerRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [onClose]);

  const move = (delta: number): void => {
    if (filtered.length === 0) return;
    setHighlight((prev) => {
      const next = (prev + delta + filtered.length) % filtered.length;
      return next;
    });
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
      move(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      move(-1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const item = filtered[highlight];
      if (item) {
        onClose();
        onPick(item);
      }
      return;
    }
    e.stopPropagation();
  };

  const maxX = window.innerWidth - PICKER_WIDTH - 4;
  const left = Math.max(4, Math.min(position.x, maxX));
  const top = Math.max(4, position.y);
  const maxHeight = `${MAX_HEIGHT_VH}vh`;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Saved commands"
      className="cmd-picker"
      style={{ left, top, width: PICKER_WIDTH, maxHeight }}
      onKeyDown={onKeyDown}
    >
      <input
        ref={inputRef}
        type="text"
        className="cmd-picker__filter"
        placeholder="Filter commands…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        spellCheck={false}
      />
      <ul className="cmd-picker__list" role="listbox">
        {filtered.length === 0 && (
          <li className="cmd-picker__empty">
            {commands.length === 0
              ? 'No saved commands yet'
              : 'No commands match the filter'}
          </li>
        )}
        {filtered.map((c, i) => {
          const className = [
            'cmd-picker__item',
            i === highlight ? 'cmd-picker__item--highlight' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const preview = c.command.split('\n')[0] ?? c.command;
          return (
            <li
              key={c.id}
              role="option"
              aria-selected={i === highlight || undefined}
              className={className}
              title={c.command}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onClose();
                onPick(c);
              }}
            >
              <span className="cmd-picker__label">{c.label}</span>
              <span className="cmd-picker__preview">{preview}</span>
            </li>
          );
        })}
      </ul>
      <div className="cmd-picker__footer">
        <button
          type="button"
          className="cmd-picker__footer-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            onClose();
            onManage();
          }}
        >
          Manage commands…
        </button>
      </div>
    </div>
  );
}
