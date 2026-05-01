import { app, BrowserWindow, Menu } from 'electron';
import { IPC_TERMINAL_EVENT } from '@shared/constants';
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
  let isQuitting = false;

  function attachWindow(win: BrowserWindow): void {
    let unsubscribeEvents: (() => void) | null = null;

    win.webContents.once('did-finish-load', () => {
      if (!terminalManager || win.isDestroyed()) return;
      unsubscribeEvents = terminalManager.onEvent((evt) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_TERMINAL_EVENT, evt);
        }
      });
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
    unregisterWindowIpc = registerWindowIpc();

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

  app.on('before-quit', (event) => {
    if (isQuitting || !terminalManager) return;
    isQuitting = true;
    event.preventDefault();
    void (async () => {
      try {
        await terminalManager!.closeAll();
      } catch (err) {
        log.warn('before-quit: closeAll failed', err);
      } finally {
        unregisterTerminalIpc?.();
        unregisterShellIpc?.();
        unregisterClipboardIpc?.();
        unregisterWindowIpc?.();
        unregisterTerminalIpc = null;
        unregisterShellIpc = null;
        unregisterClipboardIpc = null;
        unregisterWindowIpc = null;
        app.quit();
      }
    })();
  });
}
