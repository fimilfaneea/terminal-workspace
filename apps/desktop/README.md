# Terminal Workspace — `apps/desktop`

The Electron app source. See the [root README](../../README.md) for what this
is, install instructions, and feature overview. See [`CLAUDE.md`](../../CLAUDE.md)
for architecture and locked decisions before contributing.

## Scripts

- `npm run dev` — start electron-vite dev server (HMR + DevTools).
- `npm run build` — build main, preload, renderer to `out/`.
- `npm start` — preview the production build.
- `npm run typecheck` — type-check both `tsconfig.json` and `tsconfig.node.json`.
- `npm run rebuild:native` — manually rebuild `node-pty` against the installed
  Electron's Node ABI. Only needed after major Electron bumps where the
  bundled prebuild stops working.
- `npm run dist:win` — build a Windows NSIS installer in `dist/`.

## Native dependencies

`node-pty` is the only native module. It ships N-API prebuilds for `win32-x64`
that are ABI-stable across Electron versions, so no rebuild is required at
install time and there is no `postinstall` hook.

If you bump Electron to a major where the prebuilds are missing or
incompatible, run `npm run rebuild:native` (requires Visual Studio Build
Tools with the C++ workload installed).

## Targets

Windows 11 x64 only. The app may launch on other OSes during development,
but session creation will fail.

## Logs

`%APPDATA%\Terminal Workspace\logs\main.log` (i.e. `app.getPath('logs')`).
