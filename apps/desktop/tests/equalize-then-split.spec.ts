import { test, expect, type ConsoleMessage, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './helpers/launch';

let app: ElectronApplication;
let page: Page;
const logs: string[] = [];

test.beforeEach(async () => {
  ({ app, page } = await launchApp());
  logs.length = 0;
  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text();
    if (
      text.includes('[split-debug]') ||
      text.includes('[pane-debug]') ||
      msg.type() === 'error' ||
      msg.type() === 'warning'
    ) {
      logs.push(`[${msg.type()}] ${text}`);
    }
  });
  page.on('pageerror', (err) => {
    logs.push(`[pageerror] ${err.message}\n${err.stack ?? ''}`);
  });
});

test.afterEach(async () => {
  if (app) await app.close();
});

async function paneCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('.split-leaf').length);
}

async function canvasCounts(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.pane__xterm')).map(
      (el) => el.querySelectorAll('canvas').length,
    ),
  );
}

async function termCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const t = (window as unknown as { __terms?: Record<string, unknown> }).__terms;
    return t ? Object.keys(t).length : 0;
  });
}

async function dumpState(page: Page, label: string): Promise<void> {
  const state = await page.evaluate(() => {
    const store = (window as unknown as {
      __workspaceStore?: { getState: () => unknown };
    }).__workspaceStore;
    if (!store) return null;
    const s = store.getState() as {
      tabs: Array<{ id: string; activePaneId: string; rootPane: unknown }>;
      activeTabId: string;
    };
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return {
      activeTabId: s.activeTabId,
      activePaneId: tab?.activePaneId,
      rootPane: tab?.rootPane,
    };
  });
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(state, null, 2));
}

test('reproduce: drag → equalize → focus leftmost → split right', async () => {
  // Bootstrap: 2 panes [L1, L2], userResized=false.
  await page.waitForFunction(() => {
    const t = (window as unknown as { __terms?: Record<string, unknown> }).__terms;
    return t && Object.keys(t).length === 2;
  });
  expect(await paneCount(page)).toBe(2);

  await dumpState(page, 'AFTER BOOTSTRAP');

  // Step 1: drag the separator → userResized becomes true.
  const sep = page.locator('.split-separator').first();
  const sepBox = await sep.boundingBox();
  expect(sepBox).not.toBeNull();
  await page.mouse.move(sepBox!.x + sepBox!.width / 2, sepBox!.y + sepBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(sepBox!.x + 200, sepBox!.y + sepBox!.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  await dumpState(page, 'AFTER DRAG (userResized should be true)');

  // Step 2: click the equalize button (⫴ in tab bar).
  const eqBtn = page.locator('.tab-bar__equalize');
  expect(await eqBtn.count()).toBe(1);
  await eqBtn.click();
  await page.waitForTimeout(300);

  await dumpState(page, 'AFTER EQUALIZE (userResized should be false, ratios equal)');

  // Step 3: focus the leftmost pane (so the next split inserts mid-array).
  await page.locator('.split-leaf').first().click();
  await page.waitForTimeout(100);

  const termsBeforeSplit = await termCount(page);
  const canvasesBeforeSplit = await canvasCounts(page);
  console.log('Terms before split:', termsBeforeSplit);
  console.log('Canvases per pane before split:', canvasesBeforeSplit);

  // Snapshot logs so we can see what the split itself triggers.
  const logsBeforeSplit = logs.length;

  // Step 4: split right (Ctrl+Shift+E).
  await page.keyboard.press('Control+Shift+E');
  await page.waitForTimeout(500);

  await dumpState(page, 'AFTER SPLIT (should be 3 panes, no terminals destroyed)');

  const termsAfterSplit = await termCount(page);
  const canvasesAfterSplit = await canvasCounts(page);
  console.log('Terms after split:', termsAfterSplit);
  console.log('Canvases per pane after split:', canvasesAfterSplit);

  console.log('\n=== LOGS DURING SPLIT ===');
  for (let i = logsBeforeSplit; i < logs.length; i++) console.log(logs[i]);

  // Strong assertions for the bug:
  expect(await paneCount(page), 'should have 3 panes').toBe(3);
  expect(termsAfterSplit, 'should have 3 live Terminal instances').toBe(3);

  // Every pane must have rendered xterm <canvas> children. A blank pane has none.
  for (let i = 0; i < canvasesAfterSplit.length; i++) {
    expect(
      canvasesAfterSplit[i],
      `pane ${i} has ${canvasesAfterSplit[i]} canvas children (blank if 0)`,
    ).toBeGreaterThan(0);
  }

  // No TerminalPane should have been torn down during the split (canvases for
  // existing sessions should not have been removed and recreated).
  const cleanupsDuringSplit = logs
    .slice(logsBeforeSplit)
    .filter((l) => l.includes('[pane-debug] CLEANUP'));
  console.log(`Cleanup count during split: ${cleanupsDuringSplit.length}`);
  for (const c of cleanupsDuringSplit) console.log('  ', c);
  expect(cleanupsDuringSplit.length, 'no existing panes should be torn down on split').toBe(0);
});
