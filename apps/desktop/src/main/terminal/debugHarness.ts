import type { TerminalEvent } from '@shared/types';
import { log } from '../logger';
import { TerminalManager } from './TerminalManager';

export async function runDebugHarness(): Promise<void> {
  const mgr = new TerminalManager();
  try {
    const info = mgr.create({ cols: 80, rows: 24 });
    log.info('debug:session created', info);

    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    await mgr.close(info.id);
    const after = mgr.get(info.id)?.getInfo();
    log.info('debug:session closed', after ?? { id: info.id, removed: true });
  } catch (err) {
    log.error('debug:harness failed', err);
  }
}

export async function runHistoryCapHarness(): Promise<void> {
  const mgr = new TerminalManager();
  try {
    const info = mgr.create({ cols: 80, rows: 24 });
    const session = mgr.get(info.id);
    if (!session) {
      log.error('debug:history session missing');
      return;
    }
    const history = session.debugHistory();

    // Push ~6 MB of fake chunks (60 chunks × 100 KB), each with embedded newlines
    // so we exercise both the byte cap and line cap at once.
    const linesPerChunk = 200;
    const lineLen = 500; // 500 bytes per line × 200 lines = 100 000 bytes
    const filler = 'x'.repeat(lineLen - 1) + '\n';
    const chunkData = filler.repeat(linesPerChunk);
    const totalChunks = 60;

    for (let i = 1; i <= totalChunks; i++) {
      history.append({ seq: i, data: chunkData, createdAt: Date.now() });
    }

    const { bytes, lines } = session.getHistorySize();
    log.info('debug:history caps', {
      bytes,
      lines,
      maxBytes: 5 * 1024 * 1024,
      maxLines: 10_000,
      bytesOk: bytes <= 5 * 1024 * 1024,
      linesOk: lines <= 10_000,
    });

    await mgr.closeAll();
  } catch (err) {
    log.error('debug:history harness failed', err);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function runPhase4Harness(): Promise<void> {
  const mgr = new TerminalManager();
  const events: TerminalEvent[] = [];
  const unsubscribe = mgr.onEvent((e) => {
    events.push(e);
    if (e.kind === 'output') {
      log.info('phase4:event output', { sessionId: e.sessionId, seq: e.seq, bytes: e.data.length });
    } else {
      log.info('phase4:event', e);
    }
  });

  try {
    // Step 1–3: create, write, verify monotonic seq
    const info = mgr.create({ cols: 80, rows: 24 });
    log.info('phase4:created', info);
    mgr.write(info.id, 'dir\r\n');
    await sleep(400);

    const outputsAfterDir = events.filter((e) => e.kind === 'output' && e.sessionId === info.id);
    const seqs = outputsAfterDir.map((e) => (e.kind === 'output' ? e.seq : -1));
    const monotonic = seqs.every((v, i) => i === 0 || v > seqs[i - 1]!);
    log.info('phase4:dir output', { count: outputsAfterDir.length, seqs, monotonic });

    const preClearSnapshot = mgr.snapshot(info.id);
    log.info('phase4:snapshot pre-clear', {
      fromSeq: preClearSnapshot.fromSeq,
      toSeq: preClearSnapshot.toSeq,
      bytes: preClearSnapshot.data.length,
    });

    // Step 4: clearScrollback
    const eventsBeforeClear = events.length;
    mgr.clearScrollback(info.id);
    const clearedEvent = events
      .slice(eventsBeforeClear)
      .find((e) => e.kind === 'cleared' && e.sessionId === info.id);
    const postClearSnapshot = mgr.snapshot(info.id);
    log.info('phase4:after clearScrollback', {
      clearedFired: !!clearedEvent,
      snapshotEmpty: postClearSnapshot.data === '',
      snapshotFromSeq: postClearSnapshot.fromSeq,
      snapshotToSeq: postClearSnapshot.toSeq,
      previousToSeq: preClearSnapshot.toSeq,
    });

    // Trigger one more output so we can verify the seq did NOT reset
    const eventsBeforePostClearWrite = events.length;
    mgr.write(info.id, 'echo post-clear\r\n');
    await sleep(400);
    const postClearOutputs = events
      .slice(eventsBeforePostClearWrite)
      .filter((e) => e.kind === 'output' && e.sessionId === info.id);
    const firstPostClear = postClearOutputs[0];
    const nextSeq = firstPostClear && firstPostClear.kind === 'output' ? firstPostClear.seq : null;
    log.info('phase4:post-clear seq monotonic', {
      nextSeq,
      previousToSeq: preClearSnapshot.toSeq,
      isStrictlyGreater: nextSeq !== null && nextSeq > preClearSnapshot.toSeq,
    });

    // Step 5: restart
    const restartedInfo = await mgr.restart(info.id);
    log.info('phase4:restarted', {
      sameId: restartedInfo.id === info.id,
      sameTitle: restartedInfo.title === info.title,
      sameCwd: restartedInfo.cwd === info.cwd,
      newPid: restartedInfo.pid !== info.pid,
      pid: restartedInfo.pid,
    });

    const postRestartSnapshot = mgr.snapshot(info.id);
    log.info('phase4:post-restart snapshot', {
      empty: postRestartSnapshot.data === '',
      fromSeq: postRestartSnapshot.fromSeq,
      toSeq: postRestartSnapshot.toSeq,
    });

    // Confirm next output's seq starts at 1
    const eventsBeforeWrite = events.length;
    mgr.write(info.id, 'echo after-restart\r\n');
    await sleep(400);
    const firstPostRestartOutput = events
      .slice(eventsBeforeWrite)
      .find((e) => e.kind === 'output' && e.sessionId === info.id);
    const firstPostRestartSeq =
      firstPostRestartOutput && firstPostRestartOutput.kind === 'output'
        ? firstPostRestartOutput.seq
        : null;
    log.info('phase4:post-restart first output seq', {
      seq: firstPostRestartSeq,
      expected: 1,
    });

    // Step 6: close — verify exited precedes closed
    const eventsBeforeClose = events.length;
    await mgr.close(info.id);
    const closeEvents = events.slice(eventsBeforeClose).filter((e) => e.sessionId === info.id);
    const exitedIdx = closeEvents.findIndex((e) => e.kind === 'exited');
    const closedIdx = closeEvents.findIndex((e) => e.kind === 'closed');
    log.info('phase4:close ordering', {
      exitedIdx,
      closedIdx,
      orderedCorrectly: exitedIdx >= 0 && closedIdx >= 0 && exitedIdx < closedIdx,
    });

    // Step 7: closeAll force-kill timing
    const a = mgr.create({ cols: 80, rows: 24 });
    const b = mgr.create({ cols: 80, rows: 24 });
    // `type CON` reads from the console indefinitely → child won't exit on Ctrl-Break.
    mgr.write(b.id, 'type CON\r\n');
    await sleep(200);
    const t0 = Date.now();
    await mgr.closeAll();
    const elapsed = Date.now() - t0;
    log.info('phase4:closeAll timing', {
      elapsed,
      withinBudget: elapsed <= 1800,
      sessionsAfter: mgr.list().length,
      sessionAId: a.id,
      sessionBId: b.id,
    });
  } catch (err) {
    log.error('phase4:harness failed', err);
  } finally {
    unsubscribe();
  }
}
