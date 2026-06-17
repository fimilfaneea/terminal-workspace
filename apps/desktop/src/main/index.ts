import { app, BrowserWindow, Menu } from 'electron';
import { IPC_TERMINAL_EVENT } from '@shared/constants';
import type { OpenWithTabPayload, SerializedTab } from '@shared/types';
import { showCloseConfirm } from './dialogs';
import { setShuttingDown } from './lifecycle';
import { createMainWindow } from './window';
import { installLogger, log } from './logger';
import { registerClipboardIpc } from './ipc/clipboardIpc';
import { registerShellIpc } from './ipc/shellIpc';
import { registerTerminalIpc } from './ipc/terminalIpc';
import { registerWindowIpc } from './ipc/windowIpc';
import { TerminalManager } from './terminal/TerminalManager';

// Tests opt out of the single-instance lock so they can launch the app while
// a real install is also running on the same machine.
const TEST_MODE = process.env['TERMINAL_WORKSPACE_TEST'] === '1';
const gotLock = TEST_MODE ? true : app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  installLogger();
  Menu.setApplicationMenu(null);

  let mainWindow: BrowserWindow | null = null;
  let terminalManager: TerminalManager | null = null;
  let unregisterTerminalIpc: (() => void) | null = null;
  let unregisterShellIpc: (() => void) | null = null;
  let unregisterClipboardIpc: (() => void) | null = null;
  let unregisterWindowIpc: (() => void) | null = null;

  // Windows whose close has been confirmed — guards win.on('close') against a
  // re-prompt when confirmAndCloseWindow destroys them.
  const closing = new WeakSet<BrowserWindow>();
  // Tabs waiting to be claimed by a freshly-spawned adopt window, keyed by the
  // new window's webContents.id. Pull model avoids a push/listener race.
  const pendingAdopt = new Map<number, SerializedTab>();
  let quitInProgress: Promise<void> | null = null;

  function proceedToQuit(): Promise<void> {
    if (quitInProgress) return quitInProgress;
    quitInProgress = (async () => {
      setShuttingDown(true);
      try {
        if (terminalManager) await terminalManager.closeAll();
      } catch (err) {
        log.warn('proceedToQuit: closeAll failed', err);
      }
      unregisterTerminalIpc?.();
      unregisterShellIpc?.();
      unregisterClipboardIpc?.();
      unregisterWindowIpc?.();
      unregisterTerminalIpc = null;
      unregisterShellIpc = null;
      unregisterClipboardIpc = null;
      unregisterWindowIpc = null;
    })();
    return quitInProgress;
  }

  // Closing a window closes only the PTYs it owns and destroys that window.
  // The app quits naturally when the last window closes (window-all-closed →
  // app.quit → before-quit → proceedToQuit for global teardown).
  async function confirmAndCloseWindow(win: BrowserWindow): Promise<void> {
    if (closing.has(win) || win.isDestroyed()) return;
    const winId = win.webContents.id;
    if (TEST_MODE) {
      closing.add(win);
      if (terminalManager) await terminalManager.closeForWindow(winId);
      if (!win.isDestroyed()) win.destroy();
      return;
    }
    const count = terminalManager?.runningCountForWindow(winId) ?? 0;
    const ok = await showCloseConfirm(win, count);
    if (!ok) return;
    closing.add(win);
    if (terminalManager) await terminalManager.closeForWindow(winId);
    if (!win.isDestroyed()) win.destroy();
  }

  function attachWindow(win: BrowserWindow): void {
    let unsubscribeEvents: (() => void) | null = null;
    let firstLoad = true;
    const winId = win.webContents.id;

    win.webContents.once('did-finish-load', () => {
      if (!terminalManager || win.isDestroyed()) return;
      unsubscribeEvents = terminalManager.onEvent((evt) => {
        if (win.isDestroyed()) return;
        // Route only events for sessions this window owns.
        if (terminalManager?.ownerOf(evt.sessionId) !== winId) return;
        win.webContents.send(IPC_TERMINAL_EVENT, evt);
      });
    });

    // Renderer reloads (HMR full-page or manual refresh) would otherwise leave
    // this window's PTYs orphaned in main while its renderer state resets.
    // Close only this window's sessions before the new renderer mounts.
    win.webContents.on('did-start-loading', () => {
      if (firstLoad) {
        firstLoad = false;
        return;
      }
      if (!terminalManager || quitInProgress) return;
      void terminalManager.closeForWindow(winId, 500).catch((err) => {
        log.warn('dev-reload: closeForWindow failed', err);
      });
    });

    win.on('close', (e) => {
      if (closing.has(win)) return;
      e.preventDefault();
      void confirmAndCloseWindow(win);
    });

    win.on('closed', () => {
      if (unsubscribeEvents) {
        unsubscribeEvents();
        unsubscribeEvents = null;
      }
      if (mainWindow === win) mainWindow = null;
    });
  }

  function openWindow(): void {
    const win = createMainWindow({ primary: false });
    attachWindow(win);
  }

  function openWindowWithTab(payload: OpenWithTabPayload, _senderId: number): void {
    if (!terminalManager) return;
    const win = createMainWindow({ primary: false, adopt: true });
    const winId = win.webContents.id;
    // Reassign ownership synchronously (before load) so the source window stops
    // receiving these sessions immediately; the new panes snapshot full history.
    terminalManager.reassignOwner(
      payload.tab.sessions.map((s) => s.id),
      winId,
    );
    // Stash for the new renderer to pull once it's ready (see claimAdoptedTab).
    pendingAdopt.set(winId, payload.tab);
    win.on('closed', () => pendingAdopt.delete(winId));
    attachWindow(win);
  }

  function claimAdoptedTab(senderId: number): SerializedTab | null {
    const tab = pendingAdopt.get(senderId) ?? null;
    pendingAdopt.delete(senderId);
    return tab;
  }

  app.on('second-instance', () => {
    const win =
      BrowserWindow.getFocusedWindow() ??
      BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ??
      null;
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    terminalManager = new TerminalManager();
    unregisterTerminalIpc = registerTerminalIpc(terminalManager);
    unregisterShellIpc = registerShellIpc();
    unregisterClipboardIpc = registerClipboardIpc();
    unregisterWindowIpc = registerWindowIpc({
      openWindow,
      openWindowWithTab,
      claimAdoptedTab,
      confirmAndCloseWindow,
    });

    mainWindow = createMainWindow();
    attachWindow(mainWindow);
    log.info('app:ready');

    if (process.env['DEBUG_TERMINAL'] === '1') {
      void import('./terminal/debugHarness').then((m) => m.runDebugHarness());
    }
    if (process.env['DEBUG_TERMINAL_HISTORY'] === '1') {
      void import('./terminal/debugHarness').then((m) => m.runHistoryCapHarness());
    }
    if (process.env['DEBUG_TERMINAL_PHASE4'] === '1') {
      void import('./terminal/debugHarness').then((m) => m.runPhase4Harness());
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
        attachWindow(mainWindow);
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Fallback for programmatic quit / signals not coming through the window
  // close button. proceedToQuit is idempotent, so the window-close path's
  // earlier call is a no-op here.
  app.on('before-quit', (event) => {
    if (quitInProgress) return;
    event.preventDefault();
    void proceedToQuit().then(() => app.quit());
  });
}
