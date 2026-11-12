import type { Line } from './types.js';
import { buildLines, splitWords, wordWeight } from './text.js';
import { MIN_WORD_MS } from './timing.js';

function pad(value: number, size = 2): string {
  return Math.floor(value).toString().padStart(size, '0');
}

export function formatTimestamp(ms: number, comma = true): string {
  const clamped = Math.max(0, Math.round(ms));
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const millis = clamped % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${comma ? ',' : '.'}${pad(millis, 3)}`;
}

export function parseTimestamp(value: string): number {
  const match = value.trim().match(/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!match) return 0;
  const h = match[1] ?? '0';
  const m = match[2] ?? '0';
  const s = match[3] ?? '0';
  const ms = match[4] ?? '0';
  return (
    Number(h) * 3_600_000 +
    Number(m) * 60_000 +
    Number(s) * 1000 +
    Number(ms.padEnd(3, '0'))
  );
}

function cueText(line: Line, offsetMs: number): string {
  const text = line.words.map((word) => word.text).join(' ');
  return line.speaker ? `${line.speaker}: ${text}` : text;
}

function lineTimes(line: Line, offsetMs: number): { start: number; end: number } {
  const first = line.words[0];
  const last = line.words[line.words.length - 1];
  if (!first || !last) return { start: offsetMs, end: offsetMs };
  return {
    start: Math.max(0, first.startMs + offsetMs),
    end: Math.max(first.startMs + offsetMs + 1, last.endMs + offsetMs),
  };
}

export function toSrt(lines: Line[], offsetMs = 0): string {
  const blocks = lines
    .filter((line) => line.words.length > 0)
    .map((line, index) => {
      const { start, end } = lineTimes(line, offsetMs);
      return `${index + 1}\n${formatTimestamp(start)} --> ${formatTimestamp(end)}\n${cueText(line, offsetMs)}`;
    });
  return blocks.join('\n\n') + (blocks.length > 0 ? '\n' : '');
}

export function toVtt(lines: Line[], offsetMs = 0): string {
  const blocks = lines
    .filter((line) => line.words.length > 0)
    .map((line) => {
      const { start, end } = lineTimes(line, offsetMs);
      return `${formatTimestamp(start, false)} --> ${formatTimestamp(end, false)}\n${cueText(line, offsetMs)}`;
    });
  return `WEBVTT\n\n${blocks.join('\n\n')}${blocks.length > 0 ? '\n' : ''}`;
}

export function toLrc(lines: Line[], offsetMs = 0): string {
  const blocks = lines
    .filter((line) => line.words.length > 0)
    .map((line) => {
      const { start } = lineTimes(line, offsetMs);
      const minutes = Math.floor(start / 60_000);
      const seconds = (start % 60_000) / 1000;
      return `[${pad(minutes)}:${seconds.toFixed(2).padStart(5, '0')}]${line.words.map((w) => w.text).join(' ')}`;
    });
  return blocks.join('\n') + (blocks.length > 0 ? '\n' : '');
}

function distributeCue(text: string, startMs: number, endMs: number): Line {
  const words = splitWords(text);
  const span = Math.max(MIN_WORD_MS * words.length, endMs - startMs);
  const weights = words.map((word) => wordWeight(word));
  const total = weights.reduce((a, b) => a + b, 0) || words.length;
  let cursor = startMs;

  const built = words.map((word, index) => {
    const duration = Math.max(MIN_WORD_MS, Math.round((span * (weights[index] ?? 1)) / total));
    const entry = {
      id: `srt_${index}`,
      text: word,
      startMs: cursor,
      endMs: Math.min(endMs, cursor + duration),
      source: 'aligned' as const,
    };
    cursor = entry.endMs;
    return entry;
  });

  return { id: 'srt_line', speaker: null, words: built };
}

export function parseSrt(input: string): Line[] {
  const normalized = input.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  const blocks = normalized.split(/\n{2,}/);
  const lines: Line[] = [];

  for (const block of blocks) {
    const rows = block.split('\n').filter((row) => row.trim().length > 0);
    const timeRowIndex = rows.findIndex((row) => row.includes('-->'));
    if (timeRowIndex < 0) continue;
    const timeRow = rows[timeRowIndex]!;
    const [from, to] = timeRow.split('-->');
    if (!from || !to) continue;
    const text = rows
      .slice(timeRowIndex + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (!text) continue;
    const line = distributeCue(text, parseTimestamp(from), parseTimestamp(to));
    lines.push({ ...line, id: `srt_${lines.length + 1}`, words: line.words.map((word, index) => ({ ...word, id: `srt_${lines.length + 1}_w${index + 1}` })) });
  }

  return lines;
}

export function parseVtt(input: string): Line[] {
  const withoutHeader = input.replace(/^WEBVTT[^\n]*\n/i, '');
  return parseSrt(withoutHeader);
}

export function parseCaptions(input: string, filename = ''): Line[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.vtt')) return parseVtt(input);
  return parseSrt(input);
}

/** Tekst bez vremena, za lijepljenje u editor. */
export function importPlainText(text: string): Line[] {
  return buildLines(text);
}
