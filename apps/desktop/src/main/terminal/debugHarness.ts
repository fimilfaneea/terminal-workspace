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
