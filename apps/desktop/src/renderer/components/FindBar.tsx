import { useEffect, useRef, useState } from 'react';
import type { SearchAddon } from '@xterm/addon-search';

interface Props {
  searchAddon: SearchAddon;
  onClose: () => void;
}

export function FindBar({ searchAddon, onClose }: Props): JSX.Element {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const findNext = (): void => {
    if (!query) return;
    searchAddon.findNext(query, { caseSensitive, regex });
  };

  const findPrev = (): void => {
    if (!query) return;
    searchAddon.findPrevious(query, { caseSensitive, regex });
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) findPrev();
      else findNext();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      findNext();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      findPrev();
      return;
    }
    e.stopPropagation();
  };

  return (
    <div
      className="pane__find-bar"
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        className="pane__find-input"
        type="text"
        placeholder="Find"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
      />
      <button
        type="button"
        className={`pane__find-toggle${caseSensitive ? ' pane__find-toggle--active' : ''}`}
        title="Match case"
        onClick={() => setCaseSensitive((v) => !v)}
      >
        Aa
      </button>
      <button
        type="button"
        className={`pane__find-toggle${regex ? ' pane__find-toggle--active' : ''}`}
        title="Regex"
        onClick={() => setRegex((v) => !v)}
      >
        .*
      </button>
      <button
        type="button"
        className="pane__find-btn"
        title="Previous match (Shift+Enter)"
        onClick={findPrev}
      >
        ↑
      </button>
      <button
        type="button"
        className="pane__find-btn"
        title="Next match (Enter)"
        onClick={findNext}
      >
        ↓
      </button>
      <button
        type="button"
        className="pane__find-btn"
        title="Close (Esc)"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}
