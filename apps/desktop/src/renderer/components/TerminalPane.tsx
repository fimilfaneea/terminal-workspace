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
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    const onDataDisposable = term.onData((data) => {
      if (statusRef.current !== 'running') return;
      window.terminal.write(sessionId, data);
    });

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
      window.removeEventListener('resize', scheduleFit);
      resizeObserver.disconnect();
      eventUnsub();
      onDataDisposable.dispose();
      links.dispose();
      search.dispose();
      fit.dispose?.();
      canvas.dispose?.();
      term.dispose();
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
      {findBarOpen && searchRef.current && (
        <FindBar
          searchAddon={searchRef.current}
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
