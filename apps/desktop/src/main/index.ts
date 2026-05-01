import { app, BrowserWindow, Menu } from 'electron';
import { IPC_TERMINAL_EVENT } from '@shared/constants';
import { showCloseConfirm } from './dialogs';
import { setShuttingDown } from './lifecycle';
import { createMainWindow } from './window';
import { installLogger, log } from './logger';
import { registerClipboardIpc } from './ipc/clipboardIpc';
import { registerShellIpc } from './ipc/shellIpc';
import { registerTerminalIpc } from './ipc/terminalIpc';
import { registerWindowIpc } from './ipc/windowIpc';
import { TerminalManager } from './terminal/TerminalManager';

const gotLock = app.requestSingleInstanceLock();

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

  let confirmedQuit = false;
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

  async function confirmAndQuit(win: BrowserWindow): Promise<void> {
    if (confirmedQuit) return;
    const count = terminalManager?.runningCount() ?? 0;
    const ok = await showCloseConfirm(win, count);
    if (!ok) return;
    confirmedQuit = true;
    await proceedToQuit();
    if (!win.isDestroyed()) win.destroy();
  }

  function attachWindow(win: BrowserWindow): void {
    let unsubscribeEvents: (() => void) | null = null;
    let firstLoad = true;

    win.webContents.once('did-finish-load', () => {
      if (!terminalManager || win.isDestroyed()) return;
      unsubscribeEvents = terminalManager.onEvent((evt) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_TERMINAL_EVENT, evt);
        }
      });
    });

    // Renderer reloads (HMR full-page or manual refresh) would otherwise leave
    // PTYs orphaned in main while renderer state resets. Close all sessions
    // synchronously before the new renderer mounts.
    win.webContents.on('did-start-loading', () => {
      if (firstLoad) {
        firstLoad = false;
        return;
      }
      if (!terminalManager || quitInProgress) return;
      void terminalManager.closeAll(500).catch((err) => {
        log.warn('dev-reload: closeAll failed', err);
      });
    });

    win.on('close', (e) => {
      if (confirmedQuit) return;
      e.preventDefault();
      void confirmAndQuit(win);
    });

    win.on('closed', () => {
      if (unsubscribeEvents) {
        unsubscribeEvents();
        unsubscribeEvents = null;
      }
      if (mainWindow === win) mainWindow = null;
    });
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    terminalManager = new TerminalManager();
    unregisterTerminalIpc = registerTerminalIpc(terminalManager);
    unregisterShellIpc = registerShellIpc();
    unregisterClipboardIpc = registerClipboardIpc();
    unregisterWindowIpc = registerWindowIpc({
      getMainWindow: () => mainWindow,
      confirmAndQuit,
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
