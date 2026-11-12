import type { Line, Word } from './types.js';
import { normalizeForCompare, splitWords, wordWeight } from './text.js';
import { MIN_WORD_MS } from './timing.js';

export interface TranscriptChunk {
  /** Tekst komada, obično jedna riječ ili token iz Whispera. */
  text: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptOptions {
  /** Najviše riječi u jednom redu titla. */
  maxWords?: number;
  /** Najviše znakova u redu, prije lomljenja. */
  maxChars?: number;
  /** Pauza koja sigurno počinje novi red. */
  gapMs?: number;
}

const SENTENCE_END = /[.!?…:;]["'»”’)\]]*$/;

/**
 * Počisti tekst iz modela prije nego što postane titl. Whisper nekad
 * ubaci niz navodnika ili razmak prije zareza; to u titlu smeta.
 * Navodnici se uklanjaju jer se u titlovima ne koriste.
 */
export function cleanTranscriptText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\u2018\u2019\u201a\u201b\u201c\u201d\u201e\u00ab\u00bb"']/g, '')
    .replace(/[\u200b\u200c\u200d\u2060]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])\1+/g, '$1')
    .trim();
}

interface TimedWord {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * Poravnava riječi iz teksta s vremenima iz modela.
 *
 * Whisper vraća komade koji nekad sadrže cijelu riječ, a nekad samo zadnje
 * slovo ili interpunkciju. Zato se tekst (koji ima ispravne razmake) uzima
 * kao istina, a komadi samo daju vremena. Tako slovo ne prelazi u sljedeću
 * riječ i svaka riječ dobija svoje vrijeme.
 */
export function alignTranscriptWords(text: string, chunks: TranscriptChunk[]): TimedWord[] {
  const words = splitWords(text);
  if (words.length === 0 || chunks.length === 0) return [];

  const normalized: Array<{ char: string; chunk: number }> = [];
  chunks.forEach((chunk, index) => {
    const value = (chunk.text ?? '').normalize('NFC').toLocaleLowerCase();
    for (const char of value) {
      if (/[\p{L}\p{N}]/u.test(char)) normalized.push({ char, chunk: index });
    }
  });
  const joined = normalized.map((entry) => entry.char).join('');

  interface Aligned {
    text: string;
    firstChunk: number;
    lastChunk: number;
  }

  const aligned: Aligned[] = [];
  let cursor = 0;

  for (const word of words) {
    const key = normalizeForCompare(word);
    if (!key) continue;

    const found = joined.indexOf(key, cursor);
    if (found < 0) {
      // Model je preskočio ili pogrešno napisao riječ. Označava se za
      // raspoređivanje između susjeda.
      aligned.push({ text: word, firstChunk: -1, lastChunk: -1 });
      continue;
    }

    const first = normalized[found]!;
    const last = normalized[found + key.length - 1]!;
    aligned.push({ text: word, firstChunk: first.chunk, lastChunk: last.chunk });
    cursor = found + key.length;
  }

  const timed: TimedWord[] = [];
  let index = 0;

  while (index < aligned.length) {
    const entry = aligned[index]!;

    if (entry.firstChunk < 0) {
      const previous = timed[timed.length - 1];
      const start = previous ? previous.endMs : Math.round(chunks[0]!.startMs);
      timed.push({ text: entry.text, startMs: start, endMs: start + MIN_WORD_MS });
      index += 1;
      continue;
    }

    // Više riječi iz istog komada: dijeli trajanje komada po težini.
    if (entry.firstChunk === entry.lastChunk) {
      let end = index;
      while (
        end < aligned.length &&
        aligned[end]!.firstChunk === entry.firstChunk &&
        aligned[end]!.lastChunk === entry.firstChunk
      ) {
        end += 1;
      }

      if (end - index > 1) {
        const chunk = chunks[entry.firstChunk]!;
        const run = aligned.slice(index, end);
        const weights = run.map((item) => wordWeight(item.text));
        const total = weights.reduce((a, b) => a + b, 0) || run.length;
        const span = Math.max(MIN_WORD_MS * run.length, chunk.endMs - chunk.startMs);
        let pointer = Math.max(0, Math.round(chunk.startMs));
        run.forEach((item, position) => {
          const duration = Math.max(
            MIN_WORD_MS,
            Math.round((span * (weights[position] ?? 1)) / total),
          );
          timed.push({ text: item.text, startMs: pointer, endMs: pointer + duration });
          pointer += duration;
        });
        index = end;
        continue;
      }
    }

    const first = chunks[entry.firstChunk]!;
    const last = chunks[entry.lastChunk]!;
    const startMs = Math.max(0, Math.round(first.startMs));
    const endMs = Math.max(startMs + MIN_WORD_MS, Math.round(last.endMs));
    timed.push({ text: entry.text, startMs, endMs });
    index += 1;
  }

  // Vremena iz komada se mogu preklopiti. Titl ne smije imati dvije
  // aktivne riječi, pa se početak svake poravnava s krajem prethodne.
  for (let i = 1; i < timed.length; i += 1) {
    const previous = timed[i - 1]!;
    const word = timed[i]!;
    if (word.startMs < previous.endMs) word.startMs = previous.endMs;
    if (word.endMs <= word.startMs) word.endMs = word.startMs + MIN_WORD_MS;
  }

  return timed;
}

function groupIntoLines(
  words: TimedWord[],
  maxWords: number,
  maxChars: number,
  gapMs: number,
): Line[] {
  const lines: Line[] = [];
  let current: Word[] = [];
  let currentChars = 0;
  let lineIndex = 0;

  const flush = () => {
    if (current.length === 0) return;
    lineIndex += 1;
    lines.push({
      id: `a${lineIndex}`,
      speaker: null,
      words: current.map((word, index) => ({ ...word, id: `a${lineIndex}_w${index + 1}` })),
    });
    current = [];
    currentChars = 0;
  };

  words.forEach((word, index) => {
    const previous = words[index - 1];
    const gap = previous ? word.startMs - previous.endMs : 0;
    const nextChars = currentChars + (current.length > 0 ? 1 : 0) + word.text.length;
    const tooMany = current.length >= maxWords;
    const tooWide = nextChars > maxChars && current.length > 0;
    const pause = index > 0 && gap > gapMs;
    const sentenceEnd = previous ? SENTENCE_END.test(previous.text) : false;

    if (current.length > 0 && (tooMany || tooWide || pause || sentenceEnd)) flush();

    current.push({
      id: '',
      text: word.text,
      startMs: word.startMs,
      endMs: word.endMs,
      source: 'auto',
    });
    currentChars = currentChars + (current.length > 1 ? 1 : 0) + word.text.length;
  });

  flush();
  return lines;
}

/**
 * Glavni ulaz: tekst iz modela + vremena komada → redovi titla.
 */
export function linesFromTranscriptText(
  text: string,
  chunks: TranscriptChunk[],
  options: TranscriptOptions = {},
): Line[] {
  const words = alignTranscriptWords(cleanTranscriptText(text), chunks);
  if (words.length === 0) return [];
  return groupIntoLines(
    words,
    options.maxWords ?? 7,
    options.maxChars ?? 38,
    options.gapMs ?? 450,
  );
}

/**
 * Bez teksta: koristi ono što model vrati u komadima. Manje pouzdano,
 * ali radi kad pozivalac nema čist tekst.
 */
export function linesFromTranscript(
  chunks: TranscriptChunk[],
  options: TranscriptOptions = {},
): Line[] {
  const text = chunks.map((chunk) => chunk.text.trim()).join(' ');
  return linesFromTranscriptText(text, chunks, options);
}

/** Čist tekst iz redova, za polje u editoru. */
export function transcriptText(lines: Line[]): string {
  return lines.map((line) => line.words.map((word) => word.text).join(' ')).join('\n');
}
