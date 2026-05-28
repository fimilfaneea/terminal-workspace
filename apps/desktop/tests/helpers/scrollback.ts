import type { Page } from '@playwright/test';

interface TerminalWindow extends Window {
  terminal?: {
    list: () => Promise<Array<{ id: string }>>;
    write: (sessionId: string, data: string) => void;
  };
  __terms?: Record<string, XtermLike>;
}

interface XtermLike {
  buffer: { active: { length: number; viewportY: number } };
  rows: number;
  scrollPages: (n: number) => void;
  scrollLines: (n: number) => void;
}

export async function getFirstSessionId(page: Page): Promise<string> {
  const sid = await page.evaluate(async () => {
    const w = window as unknown as TerminalWindow;
    if (!w.terminal) return null;
    const list = await w.terminal.list();
    return list[0]?.id ?? null;
  });
  if (!sid) throw new Error('No active session found in workspace');
  return sid;
}

export async function fillScrollback(page: Page, lineCount = 300): Promise<string> {
  const sessionId = await getFirstSessionId(page);
  // Wait for the Terminal instance to be registered on window.__terms and the
  // shell prompt to be ready (small settle).
  await page.waitForFunction(
    (sid) => {
      const w = window as unknown as TerminalWindow;
      return Boolean(w.__terms && w.__terms[sid]);
    },
    sessionId,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(500);

  await page.evaluate(
    ({ sid, n }) => {
      const w = window as unknown as TerminalWindow;
      w.terminal!.write(sid, `for /l %i in (1,1,${n}) do @echo line %i\r`);
    },
    { sid: sessionId, n: lineCount },
  );

  // Wait until xterm's buffer has enough rows to be scrollable (rows >> visible).
  await page.waitForFunction(
    (sid) => {
      const w = window as unknown as TerminalWindow;
      const t = w.__terms?.[sid];
      if (!t) return false;
      return t.buffer.active.length > t.rows + 50;
    },
    sessionId,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(150);
  return sessionId;
}

export async function getViewportY(page: Page, sessionId: string): Promise<number> {
  return await page.evaluate((sid) => {
    const w = window as unknown as TerminalWindow;
    const t = w.__terms?.[sid];
    return t ? t.buffer.active.viewportY : -1;
  }, sessionId);
}

export async function scrollToBottom(page: Page, sessionId: string): Promise<void> {
  await page.evaluate((sid) => {
    const w = window as unknown as TerminalWindow;
    const t = w.__terms?.[sid];
    if (!t) return;
    // scroll a huge number of lines down — clamps to bottom.
    t.scrollLines(100_000);
  }, sessionId);
}
