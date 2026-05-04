# Terminal Workspace

A no-frills Windows 11 terminal workspace for vibe coders — tabs, splits,
and real PTY-backed `cmd.exe` sessions. Run Claude Code, Codex, aider, or
plain `cmd` side by side without your terminal getting in the way.

Built on [Electron](https://www.electronjs.org/),
[`node-pty`](https://github.com/microsoft/node-pty) (conpty backend), and
[xterm.js 6](https://xtermjs.org/).

> **Status:** v0.2.0. Windows 11 x64 only. Unsigned installer (SmartScreen
> will warn on first run).

## Why this exists

- **Tabs and splits that actually work for AI coding loops.** N-ary equal
  splits, drag-to-resize, per-pane titles, restart in place.
- **Paste-no-autorun by default.** Multi-line paste lands as a buffered
  edit, not an immediate execute — so an agent's `rm -rf /` suggestion
  doesn't fire the moment you Ctrl+V.
- **Runtime-only sessions.** No half-restored tabs after a crash. Window
  size, font size, and your cwd presets persist; everything else is fresh.

## Install

### Download a release (recommended)

Grab the latest `Terminal Workspace Setup <version>.exe` from the
[Releases page](https://github.com/fimilfaneea/terminal-workspace/releases)
and run it. It is an unsigned per-user NSIS installer; SmartScreen will warn
— click **More info → Run anyway** the first time.

### Build from source

```powershell
git clone https://github.com/fimilfaneea/terminal-workspace.git
cd terminal-workspace/apps/desktop
npm install
npm run dev          # dev mode with HMR
# or
npm run dist:win     # build a local installer in dist/
```

Requires Node.js >= 20 and npm. See [`apps/desktop/README.md`](./apps/desktop/README.md)
for the full dev loop.

## Features

- Multi-tab, multi-pane workspace; n-ary equal splits (right or down).
- Real `cmd.exe` PTY (conpty), not a fake shell.
- Paste-no-autorun on multi-line paste; smart `Ctrl+C` / `Ctrl+V` that
  doesn't fight the running program.
- Saved-commands picker and cwd presets (Home / Desktop / Documents /
  Downloads + your own).
- Per-pane find, font scaling, tab rename.
- Auto-close on session exit; lifecycle-clean shutdown.
- Browser-style shortcuts.

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
`End`, `PageUp`, `PageDown`, `Alt+Enter`, and function keys always pass
through to the running program.

## Limitations

- Windows 11 x64 only. macOS, Linux, and ARM64 are out of scope for v1.
- Spawns `cmd.exe` only. No shell picker (no PowerShell, no WSL, no Git Bash).
- No auto-update, no code signing, no MSIX / Microsoft Store packaging.
- No settings UI, no theme picker (dark One Dark only).
- Tabs, splits, sessions, scrollback, cwd, and titles are runtime-only —
  not restored across launches.
- App icon is a placeholder.

## Contributing

Bug reports and PRs welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for
the dev loop and conventions, and [`CLAUDE.md`](./CLAUDE.md) for the
architectural notes contributors should know before touching code.

## License

MIT — see [LICENSE](./LICENSE).
