# Contributing

Thanks for your interest. This is a small Windows-only Electron app; the
contribution surface is intentionally narrow.

## Before you start

- Read [`CLAUDE.md`](./CLAUDE.md). It documents locked architectural
  decisions (no extra persistence, three-namespace preload, exact pinned
  versions, etc.) — PRs that violate these will need a strong justification.
- Read [`plan.md`](./plan.md) if you want context on how the v1 build was
  structured.

## Dev loop

```powershell
cd apps/desktop
npm install
npm run dev        # electron-vite dev with HMR + DevTools
npm run typecheck  # must be clean before pushing
npm run build      # smoke-test the prod bundle
```

Requires Windows 11 x64, Node.js >= 20, and npm. The app may launch on
other OSes during development, but session creation will fail.

## PR expectations

- Keep changes scoped. One feature or fix per PR.
- Run `npm run typecheck` and `npm run build` before pushing.
- Manually exercise the change — there are no automated tests in v1; each
  phase in `plan.md` has manual acceptance criteria, follow that style.
- Don't bump `electron`, `vite`, `electron-vite`, or
  `@vitejs/plugin-react` independently — they are peer-locked together.
- Don't add new persistence (window size, font size, and cwd presets are
  the only sanctioned exceptions).

## Reporting bugs

Open an issue using the bug report template. Include your Windows build,
the app version (Help → About once it lands, or the installer filename),
and a minimal repro.
