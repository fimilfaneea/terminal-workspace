import { existsSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import { spawn as ptySpawn, type IPty } from 'node-pty';

export type { IPty };

export class CmdExeNotFoundError extends Error {
  readonly code = 'CMDEXE_NOT_FOUND';
  constructor(triedPaths: string[]) {
    super(`Could not locate cmd.exe. Tried: ${triedPaths.join(', ')}`);
    this.name = 'CmdExeNotFoundError';
  }
}

function isValidCmdExe(p: string | undefined): p is string {
  if (!p) return false;
  if (!isAbsolute(p)) return false;
  if (basename(p).toLowerCase() !== 'cmd.exe') return false;
  if (!existsSync(p)) return false;
  return true;
}

export function resolveCmdExe(): string {
  const systemRoot = process.env['SystemRoot'] ?? 'C:\\Windows';
  const candidates: Array<string | undefined> = [
    process.env['COMSPEC'],
    join(systemRoot, 'System32', 'cmd.exe'),
    'C:\\Windows\\System32\\cmd.exe',
  ];

  for (const candidate of candidates) {
    if (isValidCmdExe(candidate)) return candidate;
  }

  throw new CmdExeNotFoundError(candidates.map((c) => c ?? '<unset>'));
}

export interface SpawnCmdOpts {
  cwd: string;
  cols: number;
  rows: number;
  env: Record<string, string>;
}

export function spawnCmd(opts: SpawnCmdOpts): IPty {
  const cmdExe = resolveCmdExe();
  return ptySpawn(cmdExe, [], {
    name: 'xterm-256color',
    cwd: opts.cwd,
    cols: opts.cols,
    rows: opts.rows,
    env: opts.env,
    useConpty: true,
  });
}
