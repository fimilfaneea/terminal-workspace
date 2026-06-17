import { app, BrowserWindow } from 'electron';
import windowStateKeeper from 'electron-window-state';
import { join } from 'node:path';

export interface CreateWindowOpts {
  // The first/primary window persists its size+position via electron-window-state.
  // Secondary windows open at default size with a cascade offset (a single state
  // file can't sanely back multiple windows).
  primary?: boolean;
  // Adopt windows skip the default bootstrap and wait for a detached tab. Signalled
  // to the renderer via a '#adopt' URL hash.
  adopt?: boolean;
}

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const CASCADE_STEP = 32;

// How many secondary windows have been opened this run — drives the cascade
// offset so stacked windows don't perfectly overlap.
let secondaryCount = 0;

export function createMainWindow(opts: CreateWindowOpts = {}): BrowserWindow {
  const { primary = true, adopt = false } = opts;

  const winState = primary
    ? windowStateKeeper({ defaultWidth: DEFAULT_WIDTH, defaultHeight: DEFAULT_HEIGHT })
    : null;

  let bounds: { x?: number; y?: number; width: number; height: number };
  if (winState) {
    bounds = {
      width: winState.width,
      height: winState.height,
      ...(winState.x !== undefined ? { x: winState.x } : {}),
      ...(winState.y !== undefined ? { y: winState.y } : {}),
    };
  } else {
    secondaryCount += 1;
    const offset = CASCADE_STEP * secondaryCount;
    bounds = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, x: offset, y: offset };
  }

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#1e1e1e',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  winState?.manage(win);

  win.once('ready-to-show', () => {
    win.show();
    if (!app.isPackaged) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const hash = adopt ? 'adopt' : undefined;
  if (process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL'];
    win.loadURL(hash ? `${base}#${hash}` : base);
  } else {
    const file = join(__dirname, '../renderer/index.html');
    win.loadFile(file, hash ? { hash } : {});
  }

  return win;
}
