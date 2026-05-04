import { useCallback, useEffect, useRef, useState } from 'react';
import { SAVED_COMMANDS_STORAGE_KEY } from '@shared/constants';
import {
  newSavedCommandId,
  type SavedCommand,
} from '@renderer/lib/savedCommands';

const WRITE_DEBOUNCE_MS = 250;

function readPersisted(): SavedCommand[] {
  try {
    const raw = window.localStorage.getItem(SAVED_COMMANDS_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: SavedCommand[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const id = typeof e['id'] === 'string' && e['id'].length > 0 ? (e['id'] as string) : null;
      const label =
        typeof e['label'] === 'string' && (e['label'] as string).length > 0
          ? (e['label'] as string)
          : null;
      const command =
        typeof e['command'] === 'string' && (e['command'] as string).length > 0
          ? (e['command'] as string)
          : null;
      if (!command) continue;
      out.push({
        id: id ?? newSavedCommandId(),
        label: label ?? command.split('\n')[0] ?? command,
        command,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export interface UsePersistedSavedCommands {
  commands: SavedCommand[];
  addCommand: (label: string, command: string) => void;
  removeCommand: (id: string) => void;
  renameCommand: (id: string, label: string) => void;
  updateCommand: (id: string, command: string) => void;
}

export function usePersistedSavedCommands(): UsePersistedSavedCommands {
  const [commands, setCommands] = useState<SavedCommand[]>(() => readPersisted());
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(true);

  useEffect(() => {
    if (!hydrated.current) return;
    if (writeTimer.current !== null) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(
          SAVED_COMMANDS_STORAGE_KEY,
          JSON.stringify(commands),
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
  }, [commands]);

  const addCommand = useCallback((label: string, command: string) => {
    const trimmedLabel = label.trim();
    const trimmedCommand = command.replace(/\s+$/u, '');
    if (!trimmedCommand) return;
    setCommands((prev) => [
      ...prev,
      {
        id: newSavedCommandId(),
        label:
          trimmedLabel.length > 0
            ? trimmedLabel
            : (trimmedCommand.split('\n')[0] ?? trimmedCommand),
        command: trimmedCommand,
      },
    ]);
  }, []);

  const removeCommand = useCallback((id: string) => {
    setCommands((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const renameCommand = useCallback((id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setCommands((prev) =>
      prev.map((c) => (c.id === id ? { ...c, label: trimmed } : c)),
    );
  }, []);

  const updateCommand = useCallback((id: string, command: string) => {
    const trimmed = command.replace(/\s+$/u, '');
    if (!trimmed) return;
    setCommands((prev) =>
      prev.map((c) => (c.id === id ? { ...c, command: trimmed } : c)),
    );
  }, []);

  return { commands, addCommand, removeCommand, renameCommand, updateCommand };
}
