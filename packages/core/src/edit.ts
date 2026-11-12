import type { Line, Word } from './types.js';
import {
  buildLines,
  nextId,
  normalizeForCompare,
  normalizeText,
  splitLines,
  splitWords,
  wordWeight,
} from './text.js';
import { MIN_WORD_MS, isTimed, spreadUntimed, type TimeRange } from './timing.js';

interface Token {
  lineIndex: number;
  wordIndex: number;
  text: string;
  key: string;
  word: Word;
}

function tokensOf(lines: Line[]): Token[] {
  const out: Token[] = [];
  lines.forEach((line, lineIndex) => {
    line.words.forEach((word, wordIndex) => {
      out.push({
        lineIndex,
        wordIndex,
        text: word.text,
        key: normalizeForCompare(word.text),
        word,
      });
    });
  });
  return out;
}

/**
 * Poravnanje starog i novog teksta riječ po riječ (LCS). Nepromijenjene
 * riječi zadržavaju vrijeme; nove dobijaju raspoređeno vrijeme između
 * susjeda. Tako izmjena teksta ne baca utrošeno tapkanje.
 */
export function retimeForNewText(oldLines: Line[], newText: string, range: TimeRange): Line[] {
  const fresh = buildLines(newText);
  const oldTokens = tokensOf(oldLines);
  const newTokens = tokensOf(fresh);

  const n = oldTokens.length;
  const m = newTokens.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const oldKey = oldTokens[i]!.key;
      const newKey = newTokens[j]!.key;
      const match = oldKey.length > 0 && oldKey === newKey;
      table[i]![j] = match
        ? table[i + 1]![j + 1]! + 1
        : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const oldKey = oldTokens[i]!.key;
    const newKey = newTokens[j]!.key;
    if (oldKey.length > 0 && oldKey === newKey) {
      const source = oldTokens[i]!.word;
      const target = newTokens[j]!.word;
      target.startMs = source.startMs;
      target.endMs = source.endMs;
      target.source = source.source;
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      i += 1;
    } else {
      j += 1;
    }
  }

  // Novi redovi iz teksta, ali riječi koje nisu nađene ostaju "spread".
  return spreadUntimed(fresh, range);
}

/**
 * Ispravka jedne riječi. Vrijeme ostaje isto; ako korisnik upiše više
 * riječi, one dijele postojeće trajanje po težini.
 */
export function setWordText(lines: Line[], wordId: string, text: string): Line[] {
  const clean = normalizeText(text).replace(/\n/g, ' ').trim();
  const parts = splitWords(clean);
  if (parts.length === 0) return lines;

  const out = lines.map((line) => ({ ...line, words: line.words.map((word) => ({ ...word })) }));
  const line = out.find((entry) => entry.words.some((word) => word.id === wordId));
  if (!line) return out;

  const index = line.words.findIndex((word) => word.id === wordId);
  const word = line.words[index]!;

  if (parts.length === 1) {
    word.text = parts[0]!;
    return out;
  }

  const span = Math.max(MIN_WORD_MS * parts.length, word.endMs - word.startMs);
  const weights = parts.map((part) => wordWeight(part));
  const total = weights.reduce((a, b) => a + b, 0) || parts.length;
  let cursor = word.startMs;

  const replacement: Word[] = parts.map((part, position) => {
    const duration = Math.max(MIN_WORD_MS, Math.round((span * (weights[position] ?? 1)) / total));
    const entry: Word = {
      id: nextId('w'),
      text: part,
      startMs: cursor,
      endMs: Math.min(word.startMs + span, cursor + duration),
      source: word.source,
    };
    cursor = entry.endMs;
    return entry;
  });

  line.words.splice(index, 1, ...replacement);
  return out;
}

/**
 * Briše jednu riječ. Ostale riječi zadržavaju svoja vremena; prazan red
 * nestaje.
 */
export function deleteWord(lines: Line[], wordId: string): Line[] {
  return lines
    .map((line) => ({
      ...line,
      words: line.words.filter((word) => word.id !== wordId).map((word) => ({ ...word })),
    }))
    .filter((line) => line.words.length > 0);
}

/**
 * Spaja riječ sa sljedećom bez razmaka ("N" + "amjenjena" = "Namjenjena").
 * Nova riječ traje od početka prve do kraja druge; ostale se ne pomjeraju.
 * Ako je sljedeća riječ u novom redu, prelazi u ovaj red.
 */
export function mergeWithNext(lines: Line[], wordId: string): Line[] {
  const out = lines.map((line) => ({ ...line, words: line.words.map((word) => ({ ...word })) }));
  const lineIndex = out.findIndex((line) => line.words.some((word) => word.id === wordId));
  if (lineIndex < 0) return out;
  const line = out[lineIndex]!;
  const index = line.words.findIndex((word) => word.id === wordId);
  const word = line.words[index]!;

  const sameLine = index < line.words.length - 1;
  const nextLine = out[lineIndex + 1];
  const next = sameLine ? line.words[index + 1] : nextLine?.words[0];
  if (!next) return out;

  word.text = `${word.text}${next.text}`;
  word.endMs = Math.max(word.endMs, next.endMs);
  word.source = 'manual';

  if (sameLine) line.words.splice(index + 1, 1);
  else nextLine!.words.splice(0, 1);
  return out.filter((entry) => entry.words.length > 0);
}

/** Spaja dva susjedna reda u jedan, zadržavajući riječi i njihova vremena. */
export function mergeLines(lines: Line[], lineIndex: number): Line[] {
  if (lineIndex < 0 || lineIndex >= lines.length - 1) return lines;
  const out = lines.map((line) => ({ ...line, words: line.words.map((word) => ({ ...word })) }));
  const first = out[lineIndex]!;
  const second = out[lineIndex + 1]!;
  first.words = [...first.words, ...second.words];
  out.splice(lineIndex + 1, 1);
  return out;
}

/** Dijeli red na dvije riječi po indeksu; indeks označava prvu riječ novog reda. */
export function splitLineAt(lines: Line[], lineIndex: number, wordIndex: number): Line[] {
  const line = lines[lineIndex];
  if (!line || wordIndex <= 0 || wordIndex >= line.words.length) return lines;
  const out = lines.map((entry) => ({ ...entry, words: entry.words.map((word) => ({ ...word })) }));
  const target = out[lineIndex]!;
  const tail = target.words.splice(wordIndex);
  out.splice(lineIndex + 1, 0, {
    id: `${target.id}_b`,
    speaker: target.speaker,
    words: tail,
  });
  return out;
}

/**
 * Riječi koje nemaju stvarno vrijeme ne prikazuju se u videu, ali ostaju
 * u projektu da se vrate kad se tempiranje nastavi.
 */
export function visibleLines(lines: Line[]): Line[] {
  return lines
    .map((line) => ({ ...line, words: line.words.filter(isTimed) }))
    .filter((line) => line.words.length > 0);
}

export interface TextStats {
  lines: number;
  words: number;
  characters: number;
}

export function textStats(text: string): TextStats {
  const lines = splitLines(text);
  const words = lines.reduce((sum, line) => sum + splitWords(line).length, 0);
  return { lines: lines.length, words, characters: text.length };
}

const MAX_WORDS_PER_LINE = 12;

/** Predlaže lomljenje dugačkih redova na mjesta gdje se titl ne bi prelio. */
export function reflowLongLines(lines: Line[], maxWords = MAX_WORDS_PER_LINE): Line[] {
  const out: Line[] = [];
  for (const line of lines) {
    if (line.words.length <= maxWords) {
      out.push(line);
      continue;
    }
    for (let start = 0; start < line.words.length; start += maxWords) {
      out.push({
        id: `${line.id}_${Math.floor(start / maxWords) + 1}`,
        speaker: line.speaker,
        words: line.words.slice(start, start + maxWords),
      });
    }
  }
  return out;
}
