import { useEffect } from 'react';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';

export function useTerminalEvents(): void {
  useEffect(() => {
    const unsubscribe = window.terminal.onEvent((evt) => {
      useWorkspaceStore.getState().applyTerminalEvent(evt);
    });
    return unsubscribe;
  }, []);
}
