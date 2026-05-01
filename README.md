# Terminal Workspace

A Windows 11 desktop terminal workspace built on Electron. Real PTY-backed
panes via [`node-pty`](https://github.com/microsoft/node-pty) (`cmd.exe`,
conpty backend), [xterm.js 6](https://xtermjs.org/) in the renderer, tabs and
splits, runtime-only sessions (no cross-restart recovery).

The app source lives in `apps/desktop/`.

## Requirements

- Windows 11 x64 (the only supported platform for v1)
- Node.js >= 20
- npm (yarn / pnpm are not supported)

## Install

```powershell
cd apps/desktop
npm install
```

`node-pty@1.1.0` ships N-API prebuilds, so no Visual Studio Build Tools are
required for the default install. If a future native dependency without
prebuilds is added, install Visual Studio Build Tools and run
`npm run rebuild:native`.

## Develop

```powershell
npm run dev
```

Runs `electron-vite dev` with renderer HMR. DevTools open detached
automatically. Logs land at `%APPDATA%\Terminal Workspace\logs\main.log`.

## Typecheck

```powershell
npm run typecheck
```

Runs `tsc --noEmit` over both `tsconfig.json` (app) and `tsconfig.node.json`
(build config).

## Build

```powershell
npm run build
```

Produces `out/{main,preload,renderer}` for use by `electron-vite preview`
(`npm run start`) and by `electron-builder`.

## Package a Windows installer

```powershell
npm run dist:win
```

Runs the production build then `electron-builder --win --x64`. Outputs:

- `dist/Terminal Workspace Setup <version>.exe` — unsigned NSIS installer
  (per-user, lets the user pick the install directory).
- `dist/win-unpacked/` — unpacked app directory for direct launch.

The installer is unsigned; SmartScreen will warn on first run.

## After Electron major-version bumps

`node-pty` prebuilds are ABI-stable across Electron majors today, so
no rebuild is normally needed. If a future Electron version drops support for
the bundled prebuild, run:

```powershell
npm run rebuild:native
```

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| New tab | `Ctrl+Shift+T` |
| Close tab | `Ctrl+Shift+W` |
| Next tab | `Ctrl+Tab` |
| Prev tab | `Ctrl+Shift+Tab` |
| Split right | `Ctrl+Shift+E` |
| Split down | `Ctrl+Shift+O` |
| Close pane | `Ctrl+Shift+X` |
| Focus next pane | `Ctrl+Shift+]` |
| Focus prev pane | `Ctrl+Shift+[` |
| Rename pane | `Ctrl+Shift+R` |
| Restart session | `Ctrl+Shift+Enter` |
| Copy | `Ctrl+Shift+C` |
| Paste | `Ctrl+Shift+V` |
| Find in pane | `Ctrl+Shift+F` |
| Font size + | `Ctrl+=` |
| Font size − | `Ctrl+-` |
| Font size reset | `Ctrl+0` |

`Ctrl+C`, `Ctrl+V`, `Ctrl+Z`, `Ctrl+A`, `Ctrl+L`, `Tab`, arrows, `Home`,
`End`, `PageUp`, `PageDown`, `Alt+Enter`, and function keys are never
intercepted — they pass through to the running shell program.

## Known limitations (v1)

- Windows 11 x64 only. macOS, Linux, and ARM64 are out of scope.
- Spawns `cmd.exe` only. No shell picker.
- No cross-restart recovery: tabs, splits, sessions, cwd, titles, and
  scrollback are runtime-only. Window size and global font size do persist.
- No settings UI; no theme picker.
- No auto-update; no code signing; no MSIX / Store packaging.
- No automated tests in v1; each phase has manual acceptance criteria in
  `plan.md`.
- App icon is a placeholder; not wired into `electron-builder`. See
  `apps/desktop/resources/icons/README.md`.
