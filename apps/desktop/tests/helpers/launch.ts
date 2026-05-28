import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '..', '..');

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ['.'],
    cwd: APP_ROOT,
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      TERMINAL_WORKSPACE_TEST: '1',
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  // Wait for at least one pane to mount (default bootstrap = 2 panes).
  await page.locator('.pane__xterm').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page
    .locator('.pane__xterm .xterm-viewport')
    .first()
    .waitFor({ state: 'attached', timeout: 15_000 });
  return { app, page };
}
