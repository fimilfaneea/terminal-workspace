import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_FONT_SIZE_PX,
  FONT_SIZE_STORAGE_KEY,
  MAX_FONT_SIZE_PX,
  MIN_FONT_SIZE_PX,
} from '@shared/constants';

const WRITE_DEBOUNCE_MS = 250;

function clamp(n: number): number {
  if (Number.isNaN(n)) return DEFAULT_FONT_SIZE_PX;
  if (n < MIN_FONT_SIZE_PX) return MIN_FONT_SIZE_PX;
  if (n > MAX_FONT_SIZE_PX) return MAX_FONT_SIZE_PX;
  return n;
}

function readInitial(): number {
  try {
    const raw = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (raw === null) return DEFAULT_FONT_SIZE_PX;
    const parsed = Number.parseInt(raw, 10);
    return clamp(parsed);
  } catch {
    return DEFAULT_FONT_SIZE_PX;
  }
}

export function usePersistedFontSize(): readonly [number, (next: number) => void] {
  const [fontSize, setFontSizeState] = useState<number>(readInitial);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFontSize = useCallback((next: number) => {
    setFontSizeState(clamp(Math.round(next)));
  }, []);

  useEffect(() => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(fontSize));
      } catch {
        // ignore — storage may be unavailable in non-browser test envs
      }
    }, WRITE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [fontSize]);

  return [fontSize, setFontSize] as const;
}
