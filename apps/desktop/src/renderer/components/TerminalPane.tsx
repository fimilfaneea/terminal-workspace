import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import type { TerminalEvent } from '@shared/types';
import { ONE_DARK_THEME } from '@renderer/lib/theme';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';
import { registerPaneHandle } from '@renderer/lib/paneHandles';
import { ContextMenu } from './ContextMenu';
import { FindBar } from './FindBar';
import {
  RenamableTitle,
  type RenamableTitleHandle,
} from './RenamableTitle';
import '@xterm/xterm/css/xterm.css';

const RESIZE_DEBOUNCE_MS = 50;

interface Props {
  sessionId: string;
  paneId: string;
  isFocused: boolean;
  isVisible: boolean;
}

interface ContextMenuState {
  position: { x: number; y: number };
  hasSelection: boolean;
}

export function TerminalPane({
  sessionId,
  paneId,
  isFocused,
  isVisible,
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const renameRef = useRef<RenamableTitleHandle | null>(null);
  const scrollbarRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  const status = useWorkspaceStore(
    (s) => s.sessionsById[sessionId]?.info.status ?? 'starting',
  );
  const exitCode = useWorkspaceStore(
    (s) => s.sessionsById[sessionId]?.info.exitCode ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const title = useWorkspaceStore(
    (s) => s.sessionsById[sessionId]?.info.title ?? '',
  );
  const fontSize = useWorkspaceStore((s) => s.fontSizePx);
  const renameSession = useWorkspaceStore((s) => s.renameSession);

  const [findBarOpen, setFindBarOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    setErrorMessage(null);
    const initialFontSize = useWorkspaceStore.getState().fontSizePx;
    const term = new Terminal({
      fontFamily: '"Cascadia Mono", Consolas, monospace',
      fontSize: initialFontSize,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 10_000,
      allowProposedApi: true,
      theme: ONE_DARK_THEME,
    });

    const fit = new FitAddon();
    const canvas = new CanvasAddon();
    const links = new WebLinksAddon((_event, uri) => {
      if (!/^https?:/i.test(uri)) return;
      void window.shell.openExternal(uri);
    });
    const search = new SearchAddon();

    term.loadAddon(fit);
    term.loadAddon(canvas);
    term.loadAddon(links);
    term.loadAddon(search);
    term.open(containerEl);
    // Initial fit. Guard against a 0×0 container (any future mount path that
    // lands in a display:none subtree) — runFit's ResizeObserver and the
    // isVisible effect will retry once dimensions are real.
    try {
      const rect = containerEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) fit.fit();
    } catch {
      /* container not measurable yet — retried by ResizeObserver / isVisible effect */
    }

    // Browser-style Ctrl+C/V: when there is a selection, suppress xterm's
    // SIGINT so useShortcuts can copy. Always suppress xterm's Ctrl+V handling
    // so useShortcuts owns paste (avoids double-paste).
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      const noMods = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
      if (noMods && e.key === 'PageUp') {
        term.scrollPages(-1);
        return false;
      }
      if (noMods && e.key === 'PageDown') {
        term.scrollPages(1);
        return false;
      }
      if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return true;
      const k = e.key;
      if (k === 'c' || k === 'C') {
        return term.getSelection().length === 0;
      }
      if (k === 'v' || k === 'V') {
        return false;
      }
      return true;
    });

    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    // Test hook: expose Terminal instance per sessionId so Playwright specs
    // (which run against the prod build via `test:e2e = build && playwright`)
    // can query xterm's logical scroll state. The matching cleanup below
    // deletes the entry on unmount, so this doesn't leak across pane lifetimes.
    const wForTest = window as unknown as { __terms?: Record<string, unknown> };
    if (!wForTest.__terms) wForTest.__terms = {};
    wForTest.__terms[sessionId] = term;

    // Per-session input-line buffer. Each newline-terminated chunk becomes one
    // command-history entry. In-memory only (CLAUDE.md: no new persistence).
    let inputLineBuf = '';
    const flushInputLine = (line: string): void => {
      // Strip backspace runs the user typed before the newline (don't keep
      // characters that were already erased visually). Naive O(n) pass.
      let out = '';
      for (let i = 0; i < line.length; i++) {
        const ch = line.charCodeAt(i);
        if (ch === 0x7f || ch === 0x08) {
          if (out.length > 0) out = out.slice(0, -1);
        } else {
          out += line[i];
        }
      }
      const store = useWorkspaceStore.getState();
      store.appendCommandHistory(sessionId, out);
    };
    const captureInputLines = (data: string): void => {
      for (let i = 0; i < data.length; i++) {
        const ch = data.charCodeAt(i);
        if (ch === 13 /* \r */ || ch === 10 /* \n */) {
          if (inputLineBuf.length > 0) flushInputLine(inputLineBuf);
          inputLineBuf = '';
        } else if (ch === 0x03 /* Ctrl+C */ || ch === 0x04 /* Ctrl+D */) {
          // Treat as line cancellation — drop the partial buffer rather than
          // capturing the half-typed text.
          inputLineBuf = '';
        } else if (ch >= 0x20 || ch === 0x09 || ch === 0x7f || ch === 0x08) {
          inputLineBuf += data[i];
        }
        // Everything else (ESC, arrow-key sequences, function keys) is ignored
        // for history purposes — we only want what the user literally typed.
      }
    };

    const onDataDisposable = term.onData((data) => {
      if (statusRef.current !== 'running') return;
      captureInputLines(data);
      window.terminal.write(sessionId, data);
    });

    // Always-visible custom scrollbar overlay. xterm's canvas renderer doesn't
    // keep real DOM overflow at rest, so Chromium hides the native scrollbar.
    // We drive our own thumb off xterm's buffer state.
    //
    // Hot-path notes:
    //  - `sb.clientHeight` is a layout-forcing read; cache it and refresh only
    //    on resize (not on every scroll/write).
    //  - Scroll/resize events can fire many times per frame under streaming
    //    output; coalesce through requestAnimationFrame.
    let sbHeight = 0;
    const refreshSbHeight = (): void => {
      const sb = scrollbarRef.current;
      sbHeight = sb ? sb.clientHeight : 0;
    };
    const updateScrollbar = (): void => {
      const th = thumbRef.current;
      if (!th) return;
      if (sbHeight === 0) return;
      const buffer = term.buffer.active;
      const total = buffer.length;
      const visible = term.rows;
      if (total <= visible) {
        // Buffer fits — render a faint full-height thumb so the user can still see the gutter.
        th.style.height = `${sbHeight - 4}px`;
        th.style.top = '2px';
        th.style.opacity = '0.4';
        return;
      }
      th.style.opacity = '1';
      const ratio = visible / total;
      const thumbHeight = Math.max(24, Math.floor(sbHeight * ratio));
      const maxScrollable = total - visible;
      const progress = maxScrollable === 0 ? 0 : buffer.viewportY / maxScrollable;
      const thumbTop = Math.floor((sbHeight - thumbHeight) * progress);
      th.style.height = `${thumbHeight}px`;
      th.style.top = `${thumbTop}px`;
    };

    let scrollbarRafId: number | null = null;
    const requestScrollbarUpdate = (): void => {
      if (scrollbarRafId !== null) return;
      scrollbarRafId = requestAnimationFrame(() => {
        scrollbarRafId = null;
        updateScrollbar();
      });
    };
    const requestScrollbarUpdateAfterResize = (): void => {
      refreshSbHeight();
      requestScrollbarUpdate();
    };

    const onScrollDisposable = term.onScroll(requestScrollbarUpdate);
    const onResizeDisposable = term.onResize(requestScrollbarUpdateAfterResize);
    // Initial render + a delayed pass after layout settles.
    refreshSbHeight();
    updateScrollbar();
    const initialKick = window.setTimeout(() => {
      refreshSbHeight();
      updateScrollbar();
    }, 100);

    const onThumbMouseDown = (e: MouseEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      const sb = scrollbarRef.current;
      const th = thumbRef.current;
      if (!sb || !th) return;
      const buffer = term.buffer.active;
      const total = buffer.length;
      const visible = term.rows;
      const maxScrollable = Math.max(1, total - visible);
      const sbHeight = sb.clientHeight;
      const thumbHeight = th.offsetHeight;
      const trackUsable = Math.max(1, sbHeight - thumbHeight);
      const startThumbTop = parseFloat(th.style.top || '0') || 0;
      const startMouseY = e.clientY;

      const onMove = (mv: MouseEvent): void => {
        const delta = mv.clientY - startMouseY;
        const newTop = Math.max(0, Math.min(trackUsable, startThumbTop + delta));
        const progress = newTop / trackUsable;
        const targetLine = Math.round(progress * maxScrollable);
        term.scrollToLine(targetLine);
      };
      const onUp = (): void => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    const onTrackMouseDown = (e: MouseEvent): void => {
      if (e.target === thumbRef.current) return;
      const sb = scrollbarRef.current;
      const th = thumbRef.current;
      if (!sb || !th) return;
      const rect = sb.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const thumbTop = parseFloat(th.style.top || '0') || 0;
      if (clickY < thumbTop) term.scrollPages(-1);
      else term.scrollPages(1);
    };

    thumbRef.current?.addEventListener('mousedown', onThumbMouseDown);
    scrollbarRef.current?.addEventListener('mousedown', onTrackMouseDown);

    let cancelled = false;
    let snapshotResolved = false;
    let lastAppliedSeq = -1;
    const preSnapshotBuffer: TerminalEvent[] = [];
    let lastSentCols = term.cols;
    let lastSentRows = term.rows;

    const applyOutput = (seq: number, data: string): void => {
      if (seq > lastAppliedSeq) {
        term.write(data);
        lastAppliedSeq = seq;
      }
    };

    const handleEvent = (evt: TerminalEvent): void => {
      if (evt.sessionId !== sessionId) return;
      if (!snapshotResolved) {
        preSnapshotBuffer.push(evt);
        return;
      }
      if (evt.kind === 'output') applyOutput(evt.seq, evt.data);
      else if (evt.kind === 'cleared') term.clear();
      else if (evt.kind === 'error') setErrorMessage(evt.message);
    };

    const eventUnsub = window.terminal.onEvent(handleEvent);

    void (async () => {
      try {
        const snap = await window.terminal.snapshot(sessionId);
        if (cancelled) return;
        if (snap.data.length > 0) term.write(snap.data);
        lastAppliedSeq = snap.toSeq;
        snapshotResolved = true;
        for (const evt of preSnapshotBuffer) {
          if (evt.kind === 'output') applyOutput(evt.seq, evt.data);
          else if (evt.kind === 'cleared') term.clear();
          else if (evt.kind === 'error') setErrorMessage(evt.message);
        }
        preSnapshotBuffer.length = 0;
      } catch {
        snapshotResolved = true;
      }
    })();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const runFit = (): void => {
      debounceTimer = null;
      if (!containerEl.isConnected) return;
      const rect = containerEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      try {
        fit.fit();
      } catch {
        return;
      }
      if (term.cols !== lastSentCols || term.rows !== lastSentRows) {
        lastSentCols = term.cols;
        lastSentRows = term.rows;
        window.terminal.resize(sessionId, term.cols, term.rows);
      }
    };
    const scheduleFit = (): void => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runFit, RESIZE_DEBOUNCE_MS);
      // Pane geometry is changing — refresh the cached scrollbar track height
      // and repaint the thumb on the next frame.
      refreshSbHeight();
      requestScrollbarUpdate();
    };

    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(containerEl);
    window.addEventListener('resize', scheduleFit);

    if (term.cols !== lastSentCols || term.rows !== lastSentRows) {
      lastSentCols = term.cols;
      lastSentRows = term.rows;
      window.terminal.resize(sessionId, term.cols, term.rows);
    }

    return () => {
      cancelled = true;
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      window.clearTimeout(initialKick);
      if (scrollbarRafId !== null) {
        cancelAnimationFrame(scrollbarRafId);
        scrollbarRafId = null;
      }
      window.removeEventListener('resize', scheduleFit);
      resizeObserver.disconnect();
      eventUnsub();
      onDataDisposable.dispose();
      onScrollDisposable.dispose();
      onResizeDisposable.dispose();
      thumbRef.current?.removeEventListener('mousedown', onThumbMouseDown);
      scrollbarRef.current?.removeEventListener('mousedown', onTrackMouseDown);
      links.dispose();
      search.dispose();
      fit.dispose?.();
      canvas.dispose?.();
      term.dispose();
      if (import.meta.env.DEV) {
        const wForTestCleanup = window as unknown as { __terms?: Record<string, unknown> };
        if (wForTestCleanup.__terms) delete wForTestCleanup.__terms[sessionId];
      }
      termRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    return registerPaneHandle({
      paneId,
      sessionId,
      getSelection: () => termRef.current?.getSelection() ?? '',
      clearSelection: () => termRef.current?.clearSelection(),
      paste: (text) => window.terminal.write(sessionId, text),
      openFindBar: () => setFindBarOpen(true),
      closeFindBar: () => setFindBarOpen(false),
      startRename: () => renameRef.current?.startEditing(),
      focus: () => termRef.current?.focus(),
      jumpToMatch: (snippet: string) => {
        const sa = searchRef.current;
        if (!sa || !snippet) return;
        sa.findNext(snippet, {
          caseSensitive: true,
          regex: false,
          decorations: {
            matchBackground: '#3a3d41',
            matchBorder: '#7a7d81',
            matchOverviewRuler: '#e5e510',
            activeMatchBackground: '#5a3d20',
            activeMatchBorder: '#f5a623',
            activeMatchColorOverviewRuler: '#f5a623',
          },
        });
      },
    });
  }, [paneId, sessionId]);

  useEffect(() => {
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;
    term.options.fontSize = fontSize;
    try {
      fit.fit();
    } catch {
      /* container not measurable yet */
    }
  }, [fontSize]);

  useEffect(() => {
    if (!isVisible) return;
    const id = requestAnimationFrame(() => {
      const fit = fitRef.current;
      if (!fit) return;
      try {
        fit.fit();
      } catch {
        /* container not measurable yet */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [isVisible]);

  useEffect(() => {
    if (!isFocused || !isVisible) return;
    termRef.current?.focus();
  }, [isFocused, isVisible]);

  const className = [
    'pane',
    isFocused ? 'pane--focused' : '',
    status === 'errored' ? 'pane--errored' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      data-pane-id={paneId}
      onMouseDown={() => termRef.current?.focus()}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({
          position: { x: e.clientX, y: e.clientY },
          hasSelection: Boolean(termRef.current?.getSelection()),
        });
      }}
    >
      <div className="pane__header">
        <RenamableTitle
          ref={renameRef}
          title={title}
          className="pane__title"
          inputClassName="pane__rename-input"
          onRename={(next) => {
            void renameSession(sessionId, next);
          }}
        />
        {status === 'exited' && (
          <span className="pane__badge pane__badge--exited">
            exited{exitCode !== null ? ` (${exitCode})` : ''}
          </span>
        )}
        {status === 'errored' && (
          <span className="pane__badge pane__badge--errored">errored</span>
        )}
      </div>
      {status === 'errored' && errorMessage && (
        <div className="pane__error">{errorMessage}</div>
      )}
      <div className="pane__xterm" ref={containerRef} />
      <div className="pane__scrollbar" ref={scrollbarRef}>
        <div className="pane__scrollbar-thumb" ref={thumbRef} />
      </div>
      {findBarOpen && searchRef.current && termRef.current && (
        <FindBar
          term={termRef.current}
          searchAddon={searchRef.current}
          sessionId={sessionId}
          onClose={() => setFindBarOpen(false)}
        />
      )}
      {contextMenu && (
        <ContextMenu
          paneId={paneId}
          sessionId={sessionId}
          hasSelection={contextMenu.hasSelection}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
