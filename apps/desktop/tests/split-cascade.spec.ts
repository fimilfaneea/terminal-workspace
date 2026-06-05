import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './helpers/launch';

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
});

test.afterEach(async () => {
  if (app) await app.close();
});

// Regression for the v0.3.1 bug: splitting a non-rightmost pane in a row of
// 3+ panes caused every pane to its right to be torn down and recreated,
// blanking the viewport for several frames. The fix in v0.3.2 keys <Panel>
// children by stable pane id (not by position), so mid-array inserts no
// longer cascade.
test('splitting a non-rightmost pane keeps every existing terminal mounted', async () => {
  // Bootstrap = 1 tab, 2 panes split horizontally.
  await page.waitForFunction(() => {
    const t = (window as unknown as { __terms?: Record<string, unknown> }).__terms;
    return t && Object.keys(t).length === 2;
  }, undefined, { timeout: 15_000 });

  const initialIds = await page.evaluate(() => {
    const t = (window as unknown as { __terms?: Record<string, unknown> }).__terms;
    return t ? Object.keys(t).sort() : [];
  });
  expect(initialIds).toHaveLength(2);

  // Focus the LEFTMOST pane — splitting from here is what previously caused
  // every rightward sibling to remount.
  await page.locator('.split-leaf').first().click();
  await page.waitForTimeout(100);

  // Add three more horizontal splits at the leftmost focus → 5 panes total.
  // (Each Ctrl+Shift+E split puts focus on the new pane, which lands one slot
  // to the right of the previously-leftmost pane.)
  for (let i = 0; i < 3; i++) {
    // Re-focus leftmost so each new split inserts mid-array, not at the end.
    await page.locator('.split-leaf').first().click();
    await page.keyboard.press('Control+Shift+E');
    await page.waitForTimeout(150);
  }

  // All 5 sessions must have live Terminal instances in the registry.
  await page.waitForFunction(() => {
    const t = (window as unknown as { __terms?: Record<string, unknown> }).__terms;
    return t && Object.keys(t).length === 5;
  }, undefined, { timeout: 10_000 });

  const finalIds = await page.evaluate(() => {
    const t = (window as unknown as { __terms?: Record<string, unknown> }).__terms;
    return t ? Object.keys(t).sort() : [];
  });
  expect(finalIds).toHaveLength(5);

  // Every original session id must still be present. If the cascade had
  // recreated terminals, the original entries would have been deleted by
  // their cleanup and the registry would contain a different set of ids.
  for (const id of initialIds) {
    expect(finalIds, `original session ${id} should survive splits`).toContain(id);
  }

  // Every pane must have rendered xterm canvases. A blank pane would have
  // its container but no <canvas> children.
  const panesWithCanvas = await page.evaluate(() => {
    const panes = Array.from(document.querySelectorAll<HTMLElement>('.pane__xterm'));
    return panes.map((p) => p.querySelectorAll('canvas').length);
  });
  expect(panesWithCanvas).toHaveLength(5);
  for (const n of panesWithCanvas) expect(n).toBeGreaterThan(0);
});
