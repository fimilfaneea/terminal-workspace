import type { DefaultCwds } from '@shared/types';

export interface CwdPreset {
  id: string;
  label: string;
  path: string;
}

export interface UserCwdPreset {
  id: string;
  label: string;
  path: string;
}

export function builtInPresets(defaults: DefaultCwds | null): CwdPreset[] {
  if (!defaults) return [];
  const out: CwdPreset[] = [];
  if (defaults.home) out.push({ id: 'builtin:home', label: 'Home', path: defaults.home });
  if (defaults.desktop)
    out.push({ id: 'builtin:desktop', label: 'Desktop', path: defaults.desktop });
  if (defaults.documents)
    out.push({ id: 'builtin:documents', label: 'Documents', path: defaults.documents });
  if (defaults.downloads)
    out.push({ id: 'builtin:downloads', label: 'Downloads', path: defaults.downloads });
  return out;
}

export function newUserPresetId(): string {
  return `user:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
