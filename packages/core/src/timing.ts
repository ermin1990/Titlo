import type { Line, TimeSource, Word } from './types.js';
import { wordWeight } from './text.js';

/** Najkraća riječ. Ispod ovoga titl ne stigne trepnuti. */
export const MIN_WORD_MS = 80;
/** Zadnja riječ u redu ne visi preko tišine duže od ovoga. */
export const MAX_TAIL_MS = 1500;
/** Tap bliži od ovoga prethodnom je slučajan dvostruki dodir. */
export const MIN_TAP_GAP_MS = 40;
/** Korak finog pomjeranja u editoru. */
export const NUDGE_STEP_MS = 10;
/** Koliko koraka historije pamtimo. */
export const HISTORY_LIMIT = 100;

export interface TimeRange {
  startMs: number;
  endMs: number;
}

export interface FlatWord {
  lineIndex: number;
  wordIndex: number;
  line: Line;
  word: Word;
}

export function flattenWords(lines: Line[]): FlatWord[] {
  const out: FlatWord[] = [];
  lines.forEach((line, lineIndex) => {
    line.words.forEach((word, wordIndex) => {
      out.push({ lineIndex, wordIndex, line, word });
    });
  });
  return out;
}

export function totalWordCount(lines: Line[]): number {
  return lines.reduce((sum, line) => sum + line.words.length, 0);
}

export function isTimed(word: Word): boolean {
  return word.source !== 'spread' && word.endMs > word.startMs;
}

export function cloneLines(lines: Line[]): Line[] {
  return lines.map((line) => ({
    ...line,
    words: line.words.map((word) => ({ ...word })),
  }));
}

/**
 * Riječima bez tapa dijeli vrijeme između dva poznata tapa, srazmjerno
 * broju slogova. Nikad ne pomjera riječi koje imaju stvarno vrijeme.
 */
export function spreadUntimed(lines: Line[], range: TimeRange): Line[] {
  const out = cloneLines(lines);
  const flat = flattenWords(out);

  let i = 0;
  while (i < flat.length) {
    if (isTimed(flat[i]!.word)) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < flat.length && !isTimed(flat[j]!.word)) j += 1;

    const prev = i > 0 ? flat[i - 1]!.word : null;
    const next = j < flat.length ? flat[j]!.word : null;
    const lower = prev ? Math.max(prev.endMs, prev.startMs) : range.startMs;
    const upper = next ? Math.max(next.startMs, lower) : Math.max(range.endMs, lower);

    const run = flat.slice(i, j);
    const weights = run.map((entry) => wordWeight(entry.word.text));
    const totalWeight = weights.reduce((a, b) => a + b, 0) || run.length;
    const span = Math.max(upper - lower, run.length * 16);

    let cursor = lower;
    run.forEach((entry, index) => {
      const slice = Math.max(16, Math.round((span * (weights[index] ?? 1)) / totalWeight));
      const start = cursor;
      const end = Math.min(upper, start + slice);
      entry.word.startMs = start;
      entry.word.endMs = Math.max(end, start + 16);
      cursor = entry.word.endMs;
    });

    i = j;
  }

  return out;
}

export type TapOutcome = 'ok' | 'done' | 'too-fast' | 'paused';

export interface TapResult {
  outcome: TapOutcome;
  /** Na koju riječ se tap odnosio, za animaciju i vibraciju. */
  wordId?: string;
  /** Novo stanje redova. */
  lines: Line[];
  cursor: number;
}

interface Snapshot {
  lines: Line[];
  cursor: number;
}

/**
 * Sesija tapkanja. Izvor vremena je uvijek pozicija videa koju pošalje
 * pozivalac, nikad sistemski sat.
 */
export class TapSession {
  private state: Line[];
  private cursorIndex = 0;
  private lastTapAt: number | null = null;
  private history: Snapshot[] = [];
  readonly range: TimeRange;

  constructor(lines: Line[], range: TimeRange, startIndex = 0) {
    this.range = range;
    this.state = spreadUntimed(cloneLines(lines), range);
    this.cursorIndex = Math.max(0, Math.min(startIndex, totalWordCount(this.state)));
  }

  get lines(): Line[] {
    return cloneLines(this.state);
  }

  get total(): number {
    return totalWordCount(this.state);
  }

  get cursor(): number {
    return this.cursorIndex;
  }

  get current(): FlatWord | null {
    return flattenWords(this.state)[this.cursorIndex] ?? null;
  }

  get next(): FlatWord | null {
    return flattenWords(this.state)[this.cursorIndex + 1] ?? null;
  }

  get progress(): number {
    return this.total === 0 ? 0 : this.cursorIndex / this.total;
  }

  tap(atMs: number): TapResult {
    const flat = flattenWords(this.state);
    const at = Math.max(0, Math.round(atMs));

    if (this.cursorIndex >= flat.length) {
      return { outcome: 'done', lines: this.lines, cursor: this.cursorIndex };
    }
    if (this.lastTapAt !== null && at - this.lastTapAt < MIN_TAP_GAP_MS) {
      return { outcome: 'too-fast', lines: this.lines, cursor: this.cursorIndex };
    }

    this.pushHistory();

    const target = flat[this.cursorIndex]!;
    const prev = this.cursorIndex > 0 ? flat[this.cursorIndex - 1]! : null;
    const start = prev ? Math.max(at, prev.word.startMs + MIN_WORD_MS) : at;

    if (prev) {
      const prevIsLineLast = prev.wordIndex === prev.line.words.length - 1;
      const maxEnd = prev.word.startMs + MAX_TAIL_MS;
      prev.word.endMs = prevIsLineLast
        ? Math.max(prev.word.startMs + MIN_WORD_MS, Math.min(start, maxEnd))
        : start;
      if (prev.word.source === 'spread') prev.word.source = 'tap';
    }

    target.word.startMs = start;
    target.word.endMs = start + MIN_WORD_MS;
    target.word.source = 'tap';

    this.lastTapAt = start;
    this.cursorIndex += 1;
    this.state = spreadUntimed(this.state, this.range);

    return { outcome: 'ok', wordId: target.word.id, lines: this.lines, cursor: this.cursorIndex };
  }

  /** Preskače riječ koja nije izgovorena. Nema vremena i ne prikazuje se. */
  skip(): Line[] {
    if (this.cursorIndex < this.total) this.cursorIndex += 1;
    return this.lines;
  }

  /** Vraća na prvu riječ trenutnog reda. */
  repeatLine(): { lines: Line[]; seekMs: number } | null {
    const flat = flattenWords(this.state);
    const current = flat[Math.min(this.cursorIndex, flat.length - 1)];
    if (!current) return null;
    const firstOfLine = flat.findIndex((entry) => entry.lineIndex === current.lineIndex);
    this.cursorIndex = firstOfLine;
    this.lastTapAt = null;
    return { lines: this.lines, seekMs: flat[firstOfLine]!.word.startMs };
  }

  private pushHistory(): void {
    this.history.push({ lines: cloneLines(this.state), cursor: this.cursorIndex });
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
  }

  undo(): { lines: Line[]; seekMs: number; cursor: number } | null {
    const snapshot = this.history.pop();
    if (!snapshot) return null;
    this.state = snapshot.lines;
    this.cursorIndex = snapshot.cursor;
    this.lastTapAt = null;
    const flat = flattenWords(this.state);
    const word = flat[Math.max(0, snapshot.cursor - 1)] ?? flat[0];
    return {
      lines: this.lines,
      seekMs: word ? word.word.startMs : this.range.startMs,
      cursor: this.cursorIndex,
    };
  }

  seekTo(index: number, atMs: number): Line[] {
    this.cursorIndex = Math.max(0, Math.min(index, this.total));
    this.lastTapAt = atMs;
    return this.lines;
  }

  finish(): Line[] {
    return spreadUntimed(this.state, this.range);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Ručna izmjena vremena riječi. Ivica se zaustavlja na susjednoj riječi,
 * pa preklapanje unutar reda nije moguće.
 */
export function setWordTimes(
  lines: Line[],
  wordId: string,
  next: { startMs?: number; endMs?: number },
  source: TimeSource = 'manual',
): Line[] {
  const out = cloneLines(lines);
  const flat = flattenWords(out);
  const index = flat.findIndex((entry) => entry.word.id === wordId);
  if (index < 0) return out;

  const entry = flat[index]!;
  const prev = index > 0 ? flat[index - 1]!.word : null;
  const after = index < flat.length - 1 ? flat[index + 1]!.word : null;

  const hardMinStart = prev ? prev.endMs : 0;
  const hardMaxEnd = after ? after.startMs : Number.POSITIVE_INFINITY;

  let start = Math.round(next.startMs ?? entry.word.startMs);
  let end = Math.round(next.endMs ?? entry.word.endMs);

  start = Math.max(start, hardMinStart);
  end = Math.min(end, hardMaxEnd);
  if (end < start + MIN_WORD_MS) {
    end = Math.min(hardMaxEnd, start + MIN_WORD_MS);
    if (end < start + MIN_WORD_MS) start = Math.max(hardMinStart, end - MIN_WORD_MS);
  }

  entry.word.startMs = start;
  entry.word.endMs = Math.max(start + 1, end);
  entry.word.source = source;
  return out;
}

/** Pomjeranje jedne ivice za jedan korak, uz iste granice kao setWordTimes. */
export function nudgeWord(
  lines: Line[],
  wordId: string,
  edge: 'start' | 'end',
  deltaMs: number,
): Line[] {
  const word = flattenWords(lines).find((entry) => entry.word.id === wordId)?.word;
  if (!word) return cloneLines(lines);
  return setWordTimes(
    lines,
    wordId,
    edge === 'start'
      ? { startMs: word.startMs + deltaMs }
      : { endMs: word.endMs + deltaMs },
  );
}

/** Globalni pomak se primjenjuje samo pri prikazu i izvozu. */
export function displayTimes(word: Word, offsetMs: number): { startMs: number; endMs: number } {
  return { startMs: word.startMs + offsetMs, endMs: word.endMs + offsetMs };
}

export function wordAtTime(lines: Line[], timeMs: number): Word | null {
  for (const line of lines) {
    for (const word of line.words) {
      if (timeMs >= word.startMs && timeMs < word.endMs) return word;
    }
  }
  return null;
}

export function lineAtTime(lines: Line[], timeMs: number): Line | null {
  for (const line of lines) {
    const first = line.words[0];
    const last = line.words[line.words.length - 1];
    if (!first || !last) continue;
    if (timeMs >= first.startMs - 200 && timeMs <= last.endMs + 200) return line;
  }
  return null;
}

export function clampZoom(value: number): number {
  return clamp(value, 0.1, 4);
}
