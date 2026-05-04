import { useEffect, useRef } from 'react';
import { LAST_CWD_STORAGE_KEY } from '@shared/constants';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';

/**
 * Bridges localStorage with the workspace store. The store hydrates `lastCwd`
 * synchronously at module load (see `readPersistedLastCwd` in `workspaceStore.ts`),
 * so this hook only needs to write changes back. Writes are immediate so
 * quitting right after picking a preset still persists the choice.
 */
export function usePersistedLastCwd(): void {
  const lastCwd = useWorkspaceStore((s) => s.lastCwd);
  const hadFirst = useRef(false);

  useEffect(() => {
    // Skip the initial write that mirrors the hydrated value back into storage.
    if (!hadFirst.current) {
      hadFirst.current = true;
      return;
    }
    try {
      if (lastCwd === null) {
        window.localStorage.removeItem(LAST_CWD_STORAGE_KEY);
      } else {
        window.localStorage.setItem(LAST_CWD_STORAGE_KEY, lastCwd);
      }
    } catch {
      // storage may be unavailable in non-browser test envs
    }
  }, [lastCwd]);
}
