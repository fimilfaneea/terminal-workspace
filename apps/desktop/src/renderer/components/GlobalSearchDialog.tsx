import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AllSearchResults,
  SearchMatch,
  SearchOpts,
} from '@shared/types';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';
import { getPaneHandle } from '@renderer/lib/paneHandles';

export const GLOBAL_SEARCH_OPEN_EVENT = 'globalSearch:open';

const DEBOUNCE_MS = 200;
const JUMP_SNIPPET_LEN = 32;

interface FlatItem {
  sessionId: string;
  title: string;
  match: SearchMatch;
}

export function GlobalSearchDialog(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [results, setResults] = useState<AllSearchResults | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [error, setError] = useState<'bad-regex' | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const searchSeqRef = useRef(0);
  const activateSession = useWorkspaceStore((s) => s.activateSession);

  useEffect(() => {
    const handler = (): void => {
      setOpen(true);
      setQuery('');
      setResults(null);
      setError(null);
      setHighlightIdx(0);
    };
    window.addEventListener(GLOBAL_SEARCH_OPEN_EVENT, handler);
    return () => window.removeEventListener(GLOBAL_SEARCH_OPEN_EVENT, handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!query) {
      setResults(null);
      setError(null);
      return;
    }
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const seq = ++searchSeqRef.current;
      const opts: SearchOpts = { caseSensitive, regex };
      void (async () => {
        try {
          const res = await window.terminal.searchAllHistories(query, opts);
          if (seq !== searchSeqRef.current) return;
          // If any session reported bad-regex, surface it.
          const anyBad = res.perSession.some((s) => s.results.error === 'bad-regex');
          setError(anyBad ? 'bad-regex' : null);
          setResults(res);
          setHighlightIdx(0);
        } catch {
          if (seq !== searchSeqRef.current) return;
          setResults({ perSession: [] });
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [open, query, caseSensitive, regex]);

  const flat = useMemo<FlatItem[]>(() => {
    if (!results) return [];
    const out: FlatItem[] = [];
    for (const s of results.perSession) {
      for (const m of s.results.matches) {
        out.push({ sessionId: s.sessionId, title: s.title, match: m });
      }
    }
    return out;
  }, [results]);

  const close = (): void => {
    setOpen(false);
    setResults(null);
    setError(null);
  };

  const jumpTo = (item: FlatItem): void => {
    const activated = activateSession(item.sessionId);
    if (!activated) {
      close();
      return;
    }
    const snippet = item.match.lineText
      .slice(item.match.hitCol, item.match.hitCol + JUMP_SNIPPET_LEN)
      .replace(/[…]/g, '');
    // Defer to next frame so React commits the tab/pane activation first.
    requestAnimationFrame(() => {
      const handle = getPaneHandle(activated.paneId);
      if (handle) {
        handle.focus();
        if (snippet) handle.jumpToMatch(snippet);
      }
      close();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (flat.length === 0) {
      e.stopPropagation();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightIdx((i) => Math.min(flat.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const item = flat[highlightIdx];
      if (item) jumpTo(item);
      return;
    }
    e.stopPropagation();
  };

  if (!open) return null;

  return (
    <>
      <div className="global-search-overlay" onMouseDown={close} />
      <div
        className="global-search-dialog"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="global-search-row">
          <input
            ref={inputRef}
            className="global-search-input"
            type="text"
            placeholder="Search all terminals' history"
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
            title="Close (Esc)"
            onClick={close}
          >
            ×
          </button>
        </div>
        <GlobalResults
          results={results}
          flat={flat}
          highlightIdx={highlightIdx}
          query={query}
          error={error}
          onPick={(idx) => {
            setHighlightIdx(idx);
            const item = flat[idx];
            if (item) jumpTo(item);
          }}
          onHover={setHighlightIdx}
        />
      </div>
    </>
  );
}

interface GlobalResultsProps {
  results: AllSearchResults | null;
  flat: FlatItem[];
  highlightIdx: number;
  query: string;
  error: 'bad-regex' | null;
  onPick: (idx: number) => void;
  onHover: (idx: number) => void;
}

function GlobalResults({
  results,
  flat,
  highlightIdx,
  query,
  error,
  onPick,
  onHover,
}: GlobalResultsProps): JSX.Element {
  if (query.length === 0) {
    return (
      <div className="global-search-results global-search-results--info">
        Type to search across every open terminal.
      </div>
    );
  }
  if (error === 'bad-regex') {
    return <div className="global-search-results global-search-results--info">Invalid regex</div>;
  }
  if (!results) {
    return <div className="global-search-results global-search-results--info">Searching…</div>;
  }
  if (flat.length === 0) {
    return <div className="global-search-results global-search-results--info">No matches</div>;
  }

  // Group consecutive items by session for display, while preserving global indices for keyboard nav.
  const groups: { sessionId: string; title: string; rows: { item: FlatItem; idx: number }[] }[] = [];
  flat.forEach((item, idx) => {
    const last = groups[groups.length - 1];
    if (last && last.sessionId === item.sessionId) {
      last.rows.push({ item, idx });
    } else {
      groups.push({ sessionId: item.sessionId, title: item.title, rows: [{ item, idx }] });
    }
  });

  return (
    <div className="global-search-results">
      {groups.map((g) => (
        <div key={g.sessionId} className="global-search-group">
          <div className="global-search-group-header">{g.title}</div>
          <ul className="global-search-list">
            {g.rows.map(({ item, idx }) => {
              const before = item.match.lineText.slice(0, item.match.hitCol);
              const hit = item.match.lineText.slice(
                item.match.hitCol,
                item.match.hitCol + item.match.hitLength,
              );
              const after = item.match.lineText.slice(
                item.match.hitCol + item.match.hitLength,
              );
              const cls = `pane__find-item${idx === highlightIdx ? ' pane__find-item--active' : ''}`;
              return (
                <li
                  key={`${item.sessionId}-${item.match.lineIdx}-${idx}`}
                  className={cls}
                  onMouseEnter={() => onHover(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(idx);
                  }}
                >
                  <span className="pane__find-line-no">{item.match.lineIdx + 1}</span>
                  <span className="pane__find-snippet">
                    {before}
                    <mark className="pane__find-hit">{hit}</mark>
                    {after}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {results.perSession.some((s) => s.results.truncated) && (
        <div className="pane__find-dropdown-footer">
          Some sessions have more matches — refine your query.
        </div>
      )}
    </div>
  );
}
