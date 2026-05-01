import { dialog, type BrowserWindow } from 'electron';

export async function showCloseConfirm(
  win: BrowserWindow,
  runningCount: number,
): Promise<boolean> {
  if (runningCount === 0) return true;
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Close all', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: 'Terminal Workspace',
    message: `${runningCount} terminal${runningCount === 1 ? '' : 's'} still running. Close anyway?`,
  });
  return response === 0;
}
