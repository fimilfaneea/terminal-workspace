import { app, BrowserWindow, Menu } from 'electron';
import { createMainWindow } from './window';
import { installLogger, log } from './logger';

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  installLogger();
  Menu.setApplicationMenu(null);

  let mainWindow: BrowserWindow | null = null;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
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

  app.on('before-quit', () => {
    // Reserved for Phase 4/10 cleanup (terminal sessions, etc.).
  });
}
