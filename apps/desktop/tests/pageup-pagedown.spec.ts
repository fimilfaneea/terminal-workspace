import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './helpers/launch';
import { fillScrollback, getViewportY, scrollToBottom } from './helpers/scrollback';

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
});

test.afterEach(async () => {
  if (app) await app.close();
});

async function focusXterm(page: Page): Promise<void> {
  // Clicking .pane__xterm fires the React onMouseDown which calls term.focus(),
  // but Playwright moves on before the textarea actually receives focus. Force
  // it by focusing the xterm helper textarea directly.
  await page.locator('.pane__xterm').first().click();
  await page.evaluate(() => {
    const ta = document.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null;
    ta?.focus();
  });
}

test('PageUp scrolls back, PageDown returns', async () => {
  const sessionId = await fillScrollback(page);
  await scrollToBottom(page, sessionId);
  await focusXterm(page);

  const initial = await getViewportY(page, sessionId);
  expect(initial, 'should be scrolled to bottom').toBeGreaterThan(0);

  await page.keyboard.press('PageUp');
  await page.waitForTimeout(150);
  const afterUp = await getViewportY(page, sessionId);
  expect(afterUp, 'PageUp should decrease viewportY').toBeLessThan(initial);

  await page.keyboard.press('PageDown');
  await page.waitForTimeout(150);
  const afterDown = await getViewportY(page, sessionId);
  expect(afterDown, 'PageDown should increase viewportY back').toBeGreaterThan(afterUp);
});

test('Shift+PageUp does not crash and behaves benignly', async () => {
  const sessionId = await fillScrollback(page);
  await scrollToBottom(page, sessionId);
  await focusXterm(page);

  await page.keyboard.press('Shift+PageUp');
  await page.waitForTimeout(150);

  // App still alive — viewportY readable.
  const y = await getViewportY(page, sessionId);
  expect(typeof y).toBe('number');
});
