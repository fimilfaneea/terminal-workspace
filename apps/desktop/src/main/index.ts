import { app, BrowserWindow, Menu } from 'electron';
import { createMainWindow } from './window';
import { installLogger, log } from './logger';
import { TerminalManager } from './terminal/TerminalManager';

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  installLogger();
  Menu.setApplicationMenu(null);

  let mainWindow: BrowserWindow | null = null;
  let terminalManager: TerminalManager | null = null;
  let isQuitting = false;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    terminalManager = new TerminalManager();
    mainWindow = createMainWindow();
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
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
        mainWindow.on('closed', () => {
          mainWindow = null;
        });
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
        app.quit();
      }
    })();
  });
}
