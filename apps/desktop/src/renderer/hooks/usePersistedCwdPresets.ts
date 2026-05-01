import { useCallback, useEffect, useRef, useState } from 'react';
import { CWD_PRESETS_STORAGE_KEY } from '@shared/constants';
import {
  newUserPresetId,
  type UserCwdPreset,
} from '@renderer/lib/cwdPresets';

const WRITE_DEBOUNCE_MS = 250;

function readPersisted(): UserCwdPreset[] {
  try {
    const raw = window.localStorage.getItem(CWD_PRESETS_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: UserCwdPreset[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const id = typeof e['id'] === 'string' && e['id'].length > 0 ? (e['id'] as string) : null;
      const label =
        typeof e['label'] === 'string' && (e['label'] as string).length > 0
          ? (e['label'] as string)
          : null;
      const path =
        typeof e['path'] === 'string' && (e['path'] as string).length > 0
          ? (e['path'] as string)
          : null;
      if (!path) continue;
      out.push({
        id: id ?? newUserPresetId(),
        label: label ?? path,
        path,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export interface UsePersistedCwdPresets {
  presets: UserCwdPreset[];
  addPreset: (label: string, path: string) => void;
  removePreset: (id: string) => void;
  renamePreset: (id: string, label: string) => void;
}

export function usePersistedCwdPresets(): UsePersistedCwdPresets {
  const [presets, setPresets] = useState<UserCwdPreset[]>(() => readPersisted());
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(true);

  useEffect(() => {
    if (!hydrated.current) return;
    if (writeTimer.current !== null) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(
          CWD_PRESETS_STORAGE_KEY,
          JSON.stringify(presets),
        );
      } catch {
        // storage may be unavailable in non-browser test envs
      }
    }, WRITE_DEBOUNCE_MS);
    return () => {
      if (writeTimer.current !== null) {
        clearTimeout(writeTimer.current);
        writeTimer.current = null;
      }
    };
  }, [presets]);

  const addPreset = useCallback((label: string, path: string) => {
    const trimmedLabel = label.trim();
    const trimmedPath = path.trim();
    if (!trimmedPath) return;
    setPresets((prev) => [
      ...prev,
      {
        id: newUserPresetId(),
        label: trimmedLabel.length > 0 ? trimmedLabel : trimmedPath,
        path: trimmedPath,
      },
    ]);
  }, []);

  const removePreset = useCallback((id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const renamePreset = useCallback((id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, label: trimmed } : p)),
    );
  }, []);

  return { presets, addPreset, removePreset, renamePreset };
}
