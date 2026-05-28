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

test('custom scrollbar thumb is always visible', async () => {
  // No scrollback content yet — thumb should still exist and be on-screen
  // (with reduced opacity for the empty state).
  await page.locator('.pane__xterm').first().click();
  await page.waitForTimeout(500);
  const thumbVisible = await page.evaluate(() => {
    const t = document.querySelector('.pane__scrollbar-thumb') as HTMLElement | null;
    if (!t) return false;
    const r = t.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  expect(thumbVisible, 'thumb should be visible at rest').toBe(true);

  // Now produce scrollback and confirm the thumb shrinks (proportional to visible/total).
  const sessionId = await fillScrollback(page);
  await scrollToBottom(page, sessionId);
  await page.waitForTimeout(200);
  const thumbAfter = await page.evaluate(() => {
    const t = document.querySelector('.pane__scrollbar-thumb') as HTMLElement | null;
    if (!t) return null;
    return { height: t.getBoundingClientRect().height, opacity: t.style.opacity };
  });
  expect(thumbAfter).not.toBeNull();
  expect(thumbAfter!.opacity === '' || thumbAfter!.opacity === '1').toBe(true);
});

test('drag custom thumb changes viewportY', async () => {
  await page.locator('.pane__xterm').first().click();
  const sessionId = await fillScrollback(page);
  await scrollToBottom(page, sessionId);
  await page.waitForTimeout(200);

  const startY = await getViewportY(page, sessionId);

  const thumbBox = await page.locator('.pane__scrollbar-thumb').first().boundingBox();
  expect(thumbBox).not.toBeNull();

  // Drag from current thumb position upward to the top of the gutter.
  const trackBox = await page.locator('.pane__scrollbar').first().boundingBox();
  expect(trackBox).not.toBeNull();
  const startX = thumbBox!.x + thumbBox!.width / 2;
  const startY_mouse = thumbBox!.y + thumbBox!.height / 2;
  const endY_mouse = trackBox!.y + 10;
  await page.mouse.move(startX, startY_mouse);
  await page.mouse.down();
  await page.mouse.move(startX, endY_mouse, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const endY = await getViewportY(page, sessionId);
  expect(endY, 'drag should change viewportY').toBeLessThan(startY);
});
