import { useEffect, useMemo, useRef, useState } from 'react';
import {
  selectActivePane,
  useWorkspaceStore,
} from '@renderer/state/workspaceStore';
import { getPaneHandle } from '@renderer/lib/paneHandles';

export const COMMAND_HISTORY_OPEN_EVENT = 'commandHistory:open';

const PICKER_WIDTH = 480;
const MAX_HEIGHT_VH = 50;

export function CommandHistoryPicker(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const history = useWorkspaceStore(
    (s) => (sessionId ? s.commandHistoryBySession[sessionId] : undefined) ?? [],
  );

  useEffect(() => {
    const handler = (): void => {
      const state = useWorkspaceStore.getState();
      const pane = selectActivePane(state);
      if (!pane || pane.type !== 'leaf') return;
      setSessionId(pane.sessionId);
      // Anchor in the middle-upper region of the viewport, similar to the
      // global search dialog but smaller.
      setPosition({ x: Math.max(0, (window.innerWidth - PICKER_WIDTH) / 2), y: 100 });
      setFilter('');
      setHighlight(0);
      setOpen(true);
    };
    window.addEventListener(COMMAND_HISTORY_OPEN_EVENT, handler);
    return () => window.removeEventListener(COMMAND_HISTORY_OPEN_EVENT, handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [filter, history.length]);

  // Reversed so the most recent commands appear first — typical Ctrl+R UX.
  const ordered = useMemo(() => history.slice().reverse(), [history]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (q.length === 0) return ordered;
    return ordered.filter((c) => c.toLowerCase().includes(q));
  }, [ordered, filter]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent): void => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [open]);

  const move = (delta: number): void => {
    if (filtered.length === 0) return;
    setHighlight((prev) => {
      const next = (prev + delta + filtered.length) % filtered.length;
      return next;
    });
  };

  const pick = (cmd: string): void => {
    if (!sessionId) return;
    const paneState = useWorkspaceStore.getState();
    const pane = selectActivePane(paneState);
    if (pane && pane.type === 'leaf') {
      window.terminal.write(sessionId, cmd);
      getPaneHandle(pane.id)?.focus();
    }
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
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
      if (item) pick(item);
      return;
    }
    e.stopPropagation();
  };

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Command history"
      className="cmd-picker"
      style={{ left: position.x, top: position.y, width: PICKER_WIDTH, maxHeight: `${MAX_HEIGHT_VH}vh` }}
      onKeyDown={onKeyDown}
    >
      <input
        ref={inputRef}
        type="text"
        className="cmd-picker__filter"
        placeholder="Filter commands you typed in this session…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        spellCheck={false}
      />
      <ul className="cmd-picker__list" role="listbox">
        {filtered.length === 0 && (
          <li className="cmd-picker__empty">
            {history.length === 0
              ? 'No commands typed in this session yet'
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
          return (
            <li
              key={`${i}-${c}`}
              role="option"
              aria-selected={i === highlight || undefined}
              className={className}
              title={c}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
            >
              <span className="cmd-picker__preview cmd-picker__preview--full">{c}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
