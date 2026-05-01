# Terminal Workspace

Standalone Electron desktop terminal workspace. Windows 11 x64 only. `cmd.exe` only.

## Scripts

- `npm run dev` — start electron-vite dev server.
- `npm run build` — build main, preload, renderer to `out/`.
- `npm start` — preview the production build.
- `npm run typecheck` — type-check all TypeScript projects.
- `npm run rebuild:native` — manually rebuild `node-pty` against the installed Electron's Node ABI. Run after bumping the Electron version.
- `npm run dist:win` — build Windows installer (Phase 10).

## Native dependencies

`node-pty` is the only native module. It ships N-API prebuilds for `win32-x64` that are ABI-stable across Electron versions, so no rebuild is required at install time and there is no `postinstall` hook.

If you bump Electron to a major where the prebuilds are missing or incompatible, run `npm run rebuild:native` (requires Visual Studio Build Tools with the C++ workload installed). The plan originally called for `electron-builder install-app-deps` in `postinstall`; it was removed because the prebuilds make it redundant on supported targets and it forced a hard dependency on VS Build Tools at install time.

## Targets

Windows 11 x64 only. The app may launch on other OSes during development, but session creation will fail.
