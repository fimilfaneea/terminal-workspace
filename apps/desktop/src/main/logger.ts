import { app } from 'electron';
import log from 'electron-log/main';
import { join } from 'node:path';

let installed = false;

export function installLogger(): void {
  if (installed) return;
  installed = true;

  log.transports.file.level = 'info';
  log.transports.file.resolvePathFn = () => join(app.getPath('logs'), 'main.log');

  if (app.isPackaged) {
    log.transports.console.level = false;
  } else {
    log.transports.console.level = 'info';
  }

  process.on('uncaughtException', (err) => {
    log.error('uncaughtException', err);
  });
  process.on('unhandledRejection', (reason) => {
    log.error('unhandledRejection', reason);
  });
}

export { log };
