import type { Line, Word } from './types.js';

/**
 * Normalizacija teksta pri unosu.
 * - NFC, da "i" + kvačica postane jedno slovo
 * - jedinstveni prelom reda
 * - NBSP i kontrolni znakovi u obične razmake
 * - bez višestrukih razmaka i praznih redova na krajevima
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u200b\u200c\u200d\u2060]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitLines(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

let cachedSegmenter: Intl.Segmenter | null | undefined;

function wordSegmenter(): Intl.Segmenter | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter;
  cachedSegmenter =
    typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter(undefined, { granularity: 'word' })
      : null;
  return cachedSegmenter;
}

const WS = /^\s+$/;
const QUOTE = /^["'«»„“”‘’‚`]+$/;
const BRACKET = /^[([{)\]}]+$/;
const DASH = /^[-–—]+$/;
const CLOSING = /^[.,!?;:%…]+$/;
const EMOJI = /\p{Extended_Pictographic}/u;

/**
 * Dijeli jedan red na riječi. Interpunkcija ostaje uz riječ, samostalna
 * crtica nije riječ i pripada sljedećoj, emoji ostaje uz riječ.
 * Radi za jezike bez razmaka jer ide kroz Intl.Segmenter.
 */
export function splitWords(lineText: string): string[] {
  const text = normalizeText(lineText).replace(/\n/g, ' ');
  if (!text) return [];

  const segmenter = wordSegmenter();
  if (!segmenter) return text.split(' ').filter(Boolean);

  const words: string[] = [];
  let pending = '';

  for (const part of segmenter.segment(text)) {
    const chunk = part.segment;
    if (WS.test(chunk)) continue;

    if (part.isWordLike) {
      words.push(pending + chunk);
      pending = '';
      continue;
    }

    const index = 'index' in part ? part.index : 0;
    const before = text[index - 1] ?? ' ';
    const after = text[index + chunk.length] ?? ' ';
    const spaceBefore = /\s/.test(before);
    const spaceAfter = /\s/.test(after);

    if (DASH.test(chunk)) {
      // Crtica nije riječ. Ide uz sljedeću.
      pending += chunk;
      continue;
    }

    if (EMOJI.test(chunk)) {
      // Emoji je dio riječi uz koju stoji.
      if (words.length > 0) words[words.length - 1] += chunk;
      else pending += chunk;
      continue;
    }

    if (QUOTE.test(chunk) || BRACKET.test(chunk)) {
      if (!spaceBefore && spaceAfter) {
        if (words.length > 0) words[words.length - 1] += chunk;
        else pending += chunk;
      } else if (spaceBefore && !spaceAfter) {
        pending += chunk;
      } else if (words.length > 0) {
        words[words.length - 1] += chunk;
      } else {
        pending += chunk;
      }
      continue;
    }

    if (words.length > 0 && (CLOSING.test(chunk) || !spaceBefore)) {
      words[words.length - 1] += chunk;
    } else {
      pending += chunk;
    }
  }

  if (pending && words.length > 0) words[words.length - 1] += pending;
  return words.filter(Boolean);
}

/** Grafemi, da animacija slovo po slovo ne raspadne emoji. */
export function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

export function upperCase(text: string, locale: string): string {
  try {
    return text.toLocaleUpperCase(locale);
  } catch {
    return text.toUpperCase();
  }
}

/** Težina riječi za raspoređivanje vremena: približan broj slogova. */
export function wordWeight(text: string): number {
  const letters = graphemes(text).filter((g) => /\p{L}/u.test(g));
  const vowels = letters.filter((g) => /[aeiouyàáâäãåèéêëìíîïòóôöõùúûüýæøœаеиоуыэюя]/iu.test(g));
  return Math.max(1, vowels.length > 0 ? vowels.length : letters.length * 0.4);
}

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${idCounter.toString(36)}${rand}`;
}

export interface BuildLinesOptions {
  idPrefix?: string;
  speaker?: string | null;
}

export function buildLines(text: string, options: BuildLinesOptions = {}): Line[] {
  const prefix = options.idPrefix ?? 'l';
  return splitLines(text).map((lineText, lineIndex) => {
    const words: Word[] = splitWords(lineText).map((wordText, wordIndex) => ({
      id: `${prefix}${lineIndex + 1}_w${wordIndex + 1}`,
      text: wordText,
      startMs: 0,
      endMs: 0,
      source: 'spread' as const,
    }));
    return {
      id: `${prefix}${lineIndex + 1}`,
      speaker: options.speaker ?? null,
      words,
    };
  });
}

export function wordCount(lines: Line[]): number {
  return lines.reduce((sum, line) => sum + line.words.length, 0);
}

export function plainText(lines: Line[]): string {
  return lines.map((line) => line.words.map((word) => word.text).join(' ')).join('\n');
}

export function normalizeForCompare(text: string): string {
  return text
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}
