import { useEffect, useRef, useState } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { SearchAddon } from '@xterm/addon-search';
import type { SearchMatch, SearchOpts, SearchResults } from '@shared/types';

interface Props {
  term: Terminal;
  searchAddon: SearchAddon;
  sessionId: string;
  onClose: () => void;
}

type Mode = 'inView' | 'fullHistory';

const SEARCH_DECORATIONS = {
  matchBackground: '#3a3d41',
  matchBorder: '#7a7d81',
  matchOverviewRuler: '#e5e510',
  activeMatchBackground: '#5a3d20',
  activeMatchBorder: '#f5a623',
  activeMatchColorOverviewRuler: '#f5a623',
};

const FULL_HISTORY_DEBOUNCE_MS = 150;
const JUMP_SNIPPET_LEN = 32;

export function FindBar({ term, searchAddon, sessionId, onClose }: Props): JSX.Element {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [mode, setMode] = useState<Mode>('inView');
  const [count, setCount] = useState<{ index: number; total: number }>({ index: 0, total: 0 });
  const [fullResults, setFullResults] = useState<SearchResults | null>(null);
  const [dropdownIdx, setDropdownIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchSeqRef = useRef(0);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Subscribe to in-view result-count changes.
  useEffect(() => {
    const sub = searchAddon.onDidChangeResults(({ resultIndex, resultCount }) => {
      setCount({ index: resultIndex, total: resultCount });
    });
    return () => sub.dispose();
  }, [searchAddon]);

  // Clear decorations when leaving in-view mode or unmounting.
  useEffect(() => {
    return () => {
      searchAddon.clearDecorations();
    };
  }, [searchAddon]);

  const searchOpts: SearchOpts = { caseSensitive, regex };

  const inViewFindNext = (): void => {
    if (!query) return;
    searchAddon.findNext(query, {
      caseSensitive,
      regex,
      decorations: SEARCH_DECORATIONS,
    });
  };

  const inViewFindPrev = (): void => {
    if (!query) return;
    searchAddon.findPrevious(query, {
      caseSensitive,
      regex,
      decorations: SEARCH_DECORATIONS,
    });
  };

  // Debounced full-history search.
  useEffect(() => {
    if (mode !== 'fullHistory') {
      setFullResults(null);
      return;
    }
    if (!query) {
      setFullResults(null);
      return;
    }
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const seq = ++searchSeqRef.current;
      void (async () => {
        try {
          const res = await window.terminal.searchHistory(sessionId, query, searchOpts);
          if (seq !== searchSeqRef.current) return;
          setFullResults(res);
          setDropdownIdx(0);
        } catch {
          if (seq !== searchSeqRef.current) return;
          setFullResults({ matches: [], truncated: false });
        }
      })();
    }, FULL_HISTORY_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, query, caseSensitive, regex, sessionId]);

  const jumpToMatch = (m: SearchMatch): void => {
    const start = Math.max(0, m.hitCol);
    const snippet = m.lineText.slice(start, start + JUMP_SNIPPET_LEN).replace(/[…]/g, '');
    if (!snippet) return;
    // Use the in-view addon to jump xterm to the match if it's still in the
    // visible scrollback. If it isn't, the user at least sees the snippet text
    // in the dropdown.
    searchAddon.findNext(snippet, {
      caseSensitive: true,
      regex: false,
      decorations: SEARCH_DECORATIONS,
    });
  };

  const onInputKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (mode === 'fullHistory' && fullResults && fullResults.matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setDropdownIdx((i) => Math.min(fullResults.matches.length - 1, i + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setDropdownIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const m = fullResults.matches[dropdownIdx];
        if (m) jumpToMatch(m);
        return;
      }
    } else {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) inViewFindPrev();
        else inViewFindNext();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        inViewFindNext();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        inViewFindPrev();
        return;
      }
    }
    e.stopPropagation();
  };

  const showCounter = mode === 'inView' && query.length > 0;
  const counterText =
    count.total === 0
      ? '0 of 0'
      : `${count.index >= 0 ? count.index + 1 : '–'} of ${count.total}`;
  const counterClass = count.total === 0 ? 'pane__find-counter pane__find-counter--zero' : 'pane__find-counter';

  return (
    <div
      className="pane__find-bar"
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="pane__find-row">
        <button
          type="button"
          className={`pane__find-toggle${mode === 'inView' ? ' pane__find-toggle--active' : ''}`}
          title="Find in current view (xterm scrollback)"
          onClick={() => setMode('inView')}
        >
          View
        </button>
        <button
          type="button"
          className={`pane__find-toggle${mode === 'fullHistory' ? ' pane__find-toggle--active' : ''}`}
          title="Find in full session history (incl. content scrolled past xterm's buffer)"
          onClick={() => setMode('fullHistory')}
        >
          History
        </button>
        <input
          ref={inputRef}
          className="pane__find-input"
          type="text"
          placeholder={mode === 'inView' ? 'Find in view' : 'Find in history'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          spellCheck={false}
        />
        {showCounter && <span className={counterClass}>{counterText}</span>}
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
        {mode === 'inView' && (
          <>
            <button
              type="button"
              className="pane__find-btn"
              title="Previous match (Shift+Enter)"
              onClick={inViewFindPrev}
            >
              ↑
            </button>
            <button
              type="button"
              className="pane__find-btn"
              title="Next match (Enter)"
              onClick={inViewFindNext}
            >
              ↓
            </button>
          </>
        )}
        <button
          type="button"
          className="pane__find-btn"
          title="Close (Esc)"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {mode === 'fullHistory' && query.length > 0 && fullResults && (
        <FullHistoryDropdown
          results={fullResults}
          highlightIdx={dropdownIdx}
          onPick={(m, idx) => {
            setDropdownIdx(idx);
            jumpToMatch(m);
          }}
          onHover={setDropdownIdx}
        />
      )}
    </div>
  );
}

interface DropdownProps {
  results: SearchResults;
  highlightIdx: number;
  onPick: (m: SearchMatch, idx: number) => void;
  onHover: (idx: number) => void;
}

function FullHistoryDropdown({ results, highlightIdx, onPick, onHover }: DropdownProps): JSX.Element {
  if (results.error === 'bad-regex') {
    return <div className="pane__find-dropdown pane__find-dropdown--info">Invalid regex</div>;
  }
  if (results.matches.length === 0) {
    return <div className="pane__find-dropdown pane__find-dropdown--info">No matches</div>;
  }
  return (
    <div className="pane__find-dropdown">
      <ul className="pane__find-list">
        {results.matches.map((m, i) => {
          const before = m.lineText.slice(0, m.hitCol);
          const hit = m.lineText.slice(m.hitCol, m.hitCol + m.hitLength);
          const after = m.lineText.slice(m.hitCol + m.hitLength);
          const cls = `pane__find-item${i === highlightIdx ? ' pane__find-item--active' : ''}`;
          return (
            <li
              key={`${m.lineIdx}-${i}`}
              className={cls}
              onMouseEnter={() => onHover(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(m, i);
              }}
            >
              <span className="pane__find-line-no">{m.lineIdx + 1}</span>
              <span className="pane__find-snippet">
                {before}
                <mark className="pane__find-hit">{hit}</mark>
                {after}
              </span>
            </li>
          );
        })}
      </ul>
      {results.truncated && (
        <div className="pane__find-dropdown-footer">
          Showing first {results.matches.length} — refine your query for more
        </div>
      )}
    </div>
  );
}
