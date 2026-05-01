import { useEffect, useRef } from 'react';
import {
  DEFAULT_FONT_SIZE_PX,
  FONT_SIZE_STORAGE_KEY,
  MAX_FONT_SIZE_PX,
  MIN_FONT_SIZE_PX,
} from '@shared/constants';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';

const WRITE_DEBOUNCE_MS = 250;

function clamp(n: number): number {
  if (Number.isNaN(n)) return DEFAULT_FONT_SIZE_PX;
  if (n < MIN_FONT_SIZE_PX) return MIN_FONT_SIZE_PX;
  if (n > MAX_FONT_SIZE_PX) return MAX_FONT_SIZE_PX;
  return n;
}

function readPersisted(): number | null {
  try {
    const raw = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return null;
    return clamp(parsed);
  } catch {
    return null;
  }
}

/**
 * Bridges localStorage with the workspace store: hydrates the store on mount
 * and debounces store changes back to localStorage. Components that only need
 * to read or write the value should use `useWorkspaceStore` directly.
 */
export function usePersistedFontSize(): void {
  const fontSizePx = useWorkspaceStore((s) => s.fontSizePx);
  const setFontSize = useWorkspaceStore((s) => s.setFontSize);
  const hydrated = useRef(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const persisted = readPersisted();
    if (persisted !== null && persisted !== fontSizePx) {
      setFontSize(persisted);
    }
  }, [fontSizePx, setFontSize]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (writeTimer.current !== null) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(fontSizePx));
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
  }, [fontSizePx]);
}
