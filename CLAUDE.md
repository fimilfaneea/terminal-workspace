# Terminal Workspace — Claude working notes

## What this project is

A standalone Windows 11 Electron desktop terminal workspace. Real PTY-backed panes via `node-pty` (`cmd.exe` only, conpty backend), xterm 6 in the renderer, tabs and splits, runtime-only sessions (no cross-restart recovery). Not a chat app, not an agent UI.

The build follows a sequential 10-phase plan in [`plan.md`](./plan.md). Each phase leaves the app in a working, manually-verifiable state. **Phases 1 and 2 are complete**; Phase 3 (native terminal backend core) is next.

`plan.md` is the source of truth for *what* to build next. This file is for *how the project is wired* and constraints that aren't obvious from reading the code.

---

## Where the code lives

The actual app is at **`apps/desktop/`** (not the repo root). Every `npm` command runs from there:

```powershell
cd apps/desktop
npm run dev          # electron-vite dev with HMR + DevTools auto-open
npm run build        # production build → out/{main,preload,renderer}
npm run start        # electron-vite preview (prod smoke run)
npm run typecheck    # tsc on tsconfig.json + tsconfig.node.json
npm run rebuild:native   # manual node-pty rebuild (after Electron major bumps only)
npm run dist:win     # build + electron-builder --win --x64
```

There is **no `postinstall` hook** — see "Phase 1 deviations" below.

### Source layout

```
apps/desktop/src/
  main/            # Electron main process (Node)
    index.ts         lifecycle, single-instance lock, menu suppression
    window.ts        BrowserWindow factory, window-state, navigation guards
    logger.ts        electron-log → app.getPath('logs')/main.log
    constants.ts     terminal/IPC constants (filled in Phase 3)
    dialogs.ts       (Phase 5+)
    ipc/             terminalIpc.ts | shellIpc.ts | clipboardIpc.ts | windowIpc.ts
    terminal/        TerminalManager, TerminalSession, history, env, spawn, ids
  preload/         # contextBridge — three namespaces only (see below)
    index.ts
    terminalApi.ts | shellApi.ts | clipboardApi.ts | errors.ts
  renderer/        # React 18 + TypeScript
    main.tsx | App.tsx | index.html
    components/ hooks/ state/ lib/ styles/
  shared/          # types and constants shared across processes
    types.ts | constants.ts
```

### Path aliases (mirrored in both `tsconfig.json` and `electron.vite.config.ts`)

`@main/*` `@preload/*` `@renderer/*` `@shared/*`. Use these instead of relative paths across feature boundaries.

---

## Locked decisions (do not change without updating `plan.md`)

| Area | Decision |
|---|---|
| Target | Windows 11 x64 only. macOS/Linux/ARM64 are not supported. Dev shell may run elsewhere; sessions will fail. |
| Stack | electron-vite + React 18 + TypeScript 5 (strict) + npm. No yarn/pnpm. No workspaces — `apps/desktop` has its own `package-lock.json`. |
| Backend | `node-pty` in main only. `cmd.exe` only. conpty. |
| Frontend | xterm **6.x** with `addon-fit`, `addon-canvas`, `addon-web-links`, `addon-search`. Canvas renderer (not WebGL). |
| State | `zustand` for renderer workspace state. `electron-window-state` for window. `localStorage` for font size. **Nothing else persisted across launches** — no tabs/sessions/splits/cwd recovery. |
| Splits | `react-resizable-panels` for splitter UI; our own split tree state stays the source of truth. |
| Security | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, `will-navigate` blocked, `setWindowOpenHandler` deny. |
| Preload | **Three namespaces only** — `window.terminal`, `window.shell`, `window.clipboard`. No generic IPC bridge (no `ipcRenderer` exposed, no `invoke` passthrough). |
| IPC | `ipcRenderer.send` for `terminal:write` and `terminal:resize` (high-frequency, fire-and-forget). `ipcRenderer.invoke` for everything else. Internal `IpcResult<T>` envelope; preload unwraps and rejects with `TerminalApiError`. |
| Close confirm | Native `dialog.showMessageBox` owned by main, triggered through `window:requestClose`. |
| Theme | Dark only (One Dark palette). |
| Single instance | `app.requestSingleInstanceLock()` — second launch focuses existing window. |
| Versioning | **Exact pinned versions in `package.json`** — no caret/tilde ranges. `package-lock.json` is the reproducibility anchor and is committed. |
| Tests | None in v1. Each phase has manual acceptance criteria in `plan.md`. |

---

## Phase 1 deviations carried forward (READ THIS BEFORE TOUCHING DEPS OR CONFIG)

These are documented in `plan.md` §2.0 and must not be reverted:

1. **No `postinstall` hook** in `package.json`. The plan originally ran `electron-builder install-app-deps`, but `node-pty@1.1.0` ships N-API prebuilds that are ABI-stable across Electron versions, so the rebuild is redundant. Forcing it would require Visual Studio Build Tools at install time. `npm run rebuild:native` is retained for manual use after Electron major bumps. **Do not re-add the hook.** If a future native dep without prebuilds is added, that's the moment to revisit — and document the VS Build Tools prerequisite in the README.

2. **`@xterm/addon-canvas` pinned to `0.8.0-beta.48`** (not stable). xterm 6 is locked, but the canvas addon's `latest` (`0.7.0`) still declares peer `@xterm/xterm@^5.0.0`. The 0.8 line is xterm-6-compatible but only published as beta. Bump to stable when 0.8 ships, and drop the workaround in #3.

3. **`.npmrc` carries `legacy-peer-deps=true`** because the canvas beta still has a stale peer range upstream. Leave it until #2 ships stable *and* every other dep is peer-clean.

4. **`vite@7.3.2` and `@vitejs/plugin-react@5.2.0` are explicit devDeps.** `electron-vite@5` peer-caps `vite@^7`; `@vitejs/plugin-react@6` requires `vite@^8`. Both must stay on the 7.x / 5.x lines together. Treat them as part of the locked stack — do not bump independently. New Vite plugins should be **inline in `electron.vite.config.ts`** rather than new packages (see how the CSP plugin is done).

5. **`electron.vite.config.ts` does not set `build.outDir` or `rollupOptions.input`** per target. `electron-vite@5`'s typings reject those literals; v5 defaults already produce `out/main`, `out/preload`, `out/renderer` from `src/<target>/index.{ts,tsx,html}`. Do not paste back the original spec's `build:` block — it will not type-check.

---

## Security posture (Phase 2, locked)

- `BrowserWindow` always built via `createMainWindow()` in `src/main/window.ts`. Don't construct windows elsewhere.
- `webPreferences` is fixed: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `spellcheck: false`, `devTools: !app.isPackaged`. Don't relax any of these.
- `will-navigate` and `setWindowOpenHandler` deny everything. External-link opening will land in Phase 5 via `window.shell.openExternal` — not before.
- **CSP lives in one place**: `src/renderer/index.html` carries `<meta http-equiv="Content-Security-Policy" content="<!--CSP-->">` and `electron.vite.config.ts`'s inline `cspPlugin()` substitutes the placeholder at HTML-transform time. Prod gets `connect-src 'none'`; dev gets `'self' ws: wss: http: https:` so Vite HMR works. **Do not** add a `session.webRequest.onHeadersReceived` CSP path — that splits the source of truth and fights with the meta tag.
- `Menu.setApplicationMenu(null)` runs before any window is created. No app menu, no accelerators by default. Keyboard shortcuts will be wired in the renderer (Phase 8/9).
- Single-instance lock is set up in `src/main/index.ts`; the second-instance handler focuses the existing window.

---

## Persistence (Phase 2, locked)

Two things and only two things persist across launches:

1. **Window size + position** via `electron-window-state` (state file in `app.getPath('userData')`). Tabs/splits/sessions are explicitly NOT persisted.
2. **Global font size** via `localStorage[FONT_SIZE_STORAGE_KEY]` (= `'terminalWorkspace.fontSizePx.v1'`), clamped to `[MIN_FONT_SIZE_PX, MAX_FONT_SIZE_PX]` = `[8, 32]`, default `13`. Hook: `src/renderer/hooks/usePersistedFontSize.ts`. The `v1` suffix is the migration anchor — Phase 6 will move source-of-truth to a zustand persisted store.

When in doubt, *don't add new persistence*. Restart-clean is a feature, not a bug.

---

## TypeScript conventions

- Strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. Index access returns `T | undefined`; treat that seriously instead of `!`-asserting.
- `process.env.X` reads need bracket notation (`process.env['X']`) under `noUncheckedIndexedAccess`.
- `react-jsx` runtime — `JSX.Element` is the established return type in this repo (see existing `App.tsx`).
- Imports of CommonJS-only packages (e.g., `electron-log/main`) use default-import via `esModuleInterop`.
- Always run `npm run typecheck` before committing — it covers both `tsconfig.json` and `tsconfig.node.json`.

---

## Verification flow (no automated tests in v1)

For every phase:

1. `npm run typecheck` — must be clean.
2. `npm run build` — must produce `out/{main,preload,renderer}` without errors. Inspect `out/renderer/index.html` if you touched CSP (prod must have `connect-src 'none'`).
3. `npm run dev` — manually walk through that phase's acceptance criteria from `plan.md`.
4. For UI changes, also `npm run start` to smoke the prod bundle (no DevTools, no menu, CSP locked).

Logs land at `%APPDATA%\terminal-workspace\logs\main.log` (i.e. `app.getPath('logs')`).

---

## Things to push back on

- "Let's add `electron-store` / `keytar` / IndexedDB" → no, restart-clean is locked.
- "Let's expose `ipcRenderer` directly to the renderer" → no, three namespaces only.
- "Let's add Jest/Vitest/Playwright" → not in v1.
- "Let's bump `vite` / `@vitejs/plugin-react` / `electron-vite` independently" → no, they're peer-locked together.
- "Let's add macOS/Linux session support" → not in v1; main process and PTY paths are Windows-specific (cmd.exe, COMSPEC, SystemRoot).
- "Let's re-add the postinstall hook" → no, see deviation #1.

---

## Quick reference

- Plan and acceptance criteria → `plan.md` (Phase headings start at lines 31, 187, 311, 459, 568, 724, 902, 1060, 1168, 1302).
- BrowserWindow + security → `apps/desktop/src/main/window.ts`.
- App lifecycle → `apps/desktop/src/main/index.ts`.
- Logger → `apps/desktop/src/main/logger.ts`.
- CSP plugin → `apps/desktop/electron.vite.config.ts` (`cspPlugin`).
- Shared constants → `apps/desktop/src/shared/constants.ts`.
- Font-size hook → `apps/desktop/src/renderer/hooks/usePersistedFontSize.ts`.
