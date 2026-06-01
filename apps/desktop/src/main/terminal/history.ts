import { MAX_HISTORY_BYTES, MAX_HISTORY_LINES } from '../constants';
import {
  MAX_SEARCH_LINE_LENGTH,
  MAX_SEARCH_MATCHES_PER_SESSION,
} from '@shared/constants';
import type { SearchMatch, SearchOpts, SearchResults } from '@shared/types';

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

// CSI / OSC and 2-byte ESC sequences. OSC terminates on BEL (\x07) or ST (\x1b\\).
const ANSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

// Collapse `\r`-driven in-place rewrites within a single line (Claude's spinner
// and progress bars). Walks each line with a virtual column; \r resets col to 0
// and subsequent chars overwrite. Without this, every superseded spinner state
// stays in the searchable text as a false-positive ghost.
function collapseCarriageReturns(line: string): string {
  if (line.indexOf('\r') === -1) return line;
  const buf: string[] = [];
  let col = 0;
  let maxLen = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charCodeAt(i);
    if (ch === 13 /* \r */) {
      col = 0;
      continue;
    }
    buf[col] = line[i]!;
    col++;
    if (col > maxLen) maxLen = col;
  }
  let out = '';
  for (let i = 0; i < maxLen; i++) out += buf[i] ?? ' ';
  return out;
}

function normalizeForSearch(raw: string): string {
  const stripped = stripAnsi(raw);
  if (stripped.indexOf('\r') === -1) return stripped;
  return stripped.split('\n').map(collapseCarriageReturns).join('\n');
}

function clipLine(line: string, hitCol: number, hitLen: number): { text: string; offset: number } {
  if (line.length <= MAX_SEARCH_LINE_LENGTH) return { text: line, offset: 0 };
  // Center the hit in the displayed window.
  const half = Math.floor(MAX_SEARCH_LINE_LENGTH / 2);
  let start = Math.max(0, hitCol - half);
  const end = Math.min(line.length, start + MAX_SEARCH_LINE_LENGTH);
  start = Math.max(0, end - MAX_SEARCH_LINE_LENGTH);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < line.length ? '…' : '';
  return {
    text: prefix + line.slice(start, end) + suffix,
    offset: start - (prefix ? -1 : 0),
  };
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

  searchPlain(query: string, opts: SearchOpts): SearchResults {
    if (query.length === 0) return { matches: [], truncated: false };
    if (this.chunks.length === 0) return { matches: [], truncated: false };

    let pattern: RegExp;
    try {
      const flags = opts.caseSensitive ? 'g' : 'gi';
      const source = opts.regex ? query : escapeRegExp(query);
      pattern = new RegExp(source, flags);
    } catch {
      return { matches: [], truncated: false, error: 'bad-regex' };
    }

    let joined = '';
    for (const c of this.chunks) joined += c.data;
    const plain = normalizeForSearch(joined);
    const lines = plain.split('\n');

    const matches: SearchMatch[] = [];
    let truncated = false;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]!;
      if (line.length === 0) continue;
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(line)) !== null) {
        const hitCol = m.index;
        const hitLength = Math.max(1, m[0].length);
        const clip = clipLine(line, hitCol, hitLength);
        matches.push({
          lineIdx,
          lineText: clip.text,
          hitCol: hitCol - clip.offset + (clip.text.startsWith('…') ? 1 : 0),
          hitLength,
        });
        if (matches.length >= MAX_SEARCH_MATCHES_PER_SESSION) {
          truncated = true;
          break;
        }
        // Avoid infinite loop on zero-length matches in regex mode.
        if (m[0].length === 0) pattern.lastIndex = m.index + 1;
      }
      if (truncated) break;
    }
    return { matches, truncated };
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
