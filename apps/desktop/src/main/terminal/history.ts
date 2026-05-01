import { MAX_HISTORY_BYTES, MAX_HISTORY_LINES } from '../constants';

export interface HistoryChunk {
  seq: number;
  data: string;
  createdAt: number;
}

export interface HistorySnapshot {
  data: string;
  fromSeq: number;
  toSeq: number;
  truncated: boolean;
}

function countNewlines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) n++;
  }
  return n;
}

export class History {
  private chunks: HistoryChunk[] = [];
  private bytes = 0;
  private lines = 0;
  private truncatedSinceClear = false;

  append(chunk: HistoryChunk): void {
    this.chunks.push(chunk);
    this.bytes += Buffer.byteLength(chunk.data, 'utf8');
    this.lines += countNewlines(chunk.data);
    this.evict();
  }

  evict(): void {
    while (this.chunks.length > 0 && (this.bytes > MAX_HISTORY_BYTES || this.lines > MAX_HISTORY_LINES)) {
      const oldest = this.chunks.shift();
      if (!oldest) break;
      this.bytes -= Buffer.byteLength(oldest.data, 'utf8');
      this.lines -= countNewlines(oldest.data);
      this.truncatedSinceClear = true;
    }
    if (this.bytes < 0) this.bytes = 0;
    if (this.lines < 0) this.lines = 0;
  }

  clear(): void {
    this.chunks = [];
    this.bytes = 0;
    this.lines = 0;
    this.truncatedSinceClear = false;
  }

  snapshotString(): HistorySnapshot {
    if (this.chunks.length === 0) {
      return { data: '', fromSeq: 0, toSeq: 0, truncated: this.truncatedSinceClear };
    }
    const first = this.chunks[0]!;
    const last = this.chunks[this.chunks.length - 1]!;
    let data = '';
    for (const c of this.chunks) data += c.data;
    return {
      data,
      fromSeq: first.seq,
      toSeq: last.seq,
      truncated: this.truncatedSinceClear,
    };
  }

  get sizeBytes(): number {
    return this.bytes;
  }

  get sizeLines(): number {
    return this.lines;
  }
}
