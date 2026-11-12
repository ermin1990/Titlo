import type { Line } from './types.js';
import { wordWeight } from './text.js';
import { MIN_WORD_MS } from './timing.js';

export interface SpeechRegion {
  startMs: number;
  endMs: number;
}

export interface AutoTimingOptions {
  /** Najmanja pauza koja razdvaja dvije govorne cjeline. */
  mergeGapMs?: number;
  /** Ispod ovoga smatramo da je šum, ne govor. */
  minRegionMs?: number;
  /** Novi red na pauzi dužoj od ove. */
  lineBreakGapMs?: number;
  maxWordsPerLine?: number;
}

/**
 * Raspoređuje riječi po otkrivenim govornim dijelovima. Ovo je "auto"
 * prolaz bez modela: brz, na uređaju, i dovoljno dobar da korisnik popravi
 * samo pogrešne riječi umjesto da tapka sve.
 */
export function autoTimeWords(
  lines: Line[],
  regions: SpeechRegion[],
  options: AutoTimingOptions = {},
): Line[] {
  const minRegion = options.minRegionMs ?? 120;
  const mergeGap = options.mergeGapMs ?? 220;
  const usable = mergeRegions(regions.filter((region) => region.endMs - region.startMs >= minRegion), mergeGap);
  if (usable.length === 0) return lines;

  const flat = lines.flatMap((line, lineIndex) =>
    line.words.map((word, wordIndex) => ({ lineIndex, wordIndex, word })),
  );
  if (flat.length === 0) return lines;

  const totalSpeech = usable.reduce((sum, region) => sum + (region.endMs - region.startMs), 0);
  const weights = flat.map((entry) => wordWeight(entry.word.text));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || flat.length;
  const msPerWeight = totalSpeech / totalWeight;

  let regionIndex = 0;
  let regionCursor = usable[0]!.startMs;
  let regionRemaining = usable[0]!.endMs - usable[0]!.startMs;

  for (let index = 0; index < flat.length; index += 1) {
    const entry = flat[index]!;
    const duration = Math.max(MIN_WORD_MS, Math.round((weights[index] ?? 1) * msPerWeight));

    while (regionRemaining < Math.min(duration, MIN_WORD_MS) && regionIndex < usable.length - 1) {
      regionIndex += 1;
      regionCursor = usable[regionIndex]!.startMs;
      regionRemaining = usable[regionIndex]!.endMs - usable[regionIndex]!.startMs;
    }

    const start = regionCursor;
    const end = Math.min(regionCursor + duration, usable[regionIndex]!.endMs);
    entry.word.startMs = start;
    entry.word.endMs = Math.max(start + 1, end);
    entry.word.source = 'auto';

    regionCursor = entry.word.endMs;
    regionRemaining = usable[regionIndex]!.endMs - regionCursor;
  }

  return lines;
}

export function mergeRegions(regions: SpeechRegion[], gapMs: number): SpeechRegion[] {
  if (regions.length === 0) return [];
  const sorted = [...regions].sort((a, b) => a.startMs - b.startMs);
  const out: SpeechRegion[] = [{ ...sorted[0]! }];
  for (const region of sorted.slice(1)) {
    const last = out[out.length - 1]!;
    if (region.startMs - last.endMs <= gapMs) {
      last.endMs = Math.max(last.endMs, region.endMs);
    } else {
      out.push({ ...region });
    }
  }
  return out;
}

/**
 * Otkriva govorne dijelove iz nivoa glasnoće. Ulaz je niz RMS vrijednosti
 * po prozoru, pa ova funkcija radi isto u browseru i na telefonu.
 */
export function detectSpeechRegions(
  rms: Float32Array | number[],
  windowMs: number,
  options: { noiseFloor?: number; threshold?: number } = {},
): SpeechRegion[] {
  if (rms.length === 0) return [];
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const p20 = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const floor = options.noiseFloor ?? p20;
  const threshold = options.threshold ?? Math.max(floor + 0.008, floor + (p90 - floor) * 0.22);

  const regions: SpeechRegion[] = [];
  let start = -1;

  for (let index = 0; index < rms.length; index += 1) {
    const loud = (rms[index] ?? 0) > threshold;
    if (loud && start < 0) start = index;
    if (!loud && start >= 0) {
      regions.push({ startMs: start * windowMs, endMs: index * windowMs });
      start = -1;
    }
  }
  if (start >= 0) regions.push({ startMs: start * windowMs, endMs: rms.length * windowMs });
  return regions;
}

/** Vrijeme prvog govora, korisno za automatski trim početka. */
export function firstSpeechMs(regions: SpeechRegion[]): number {
  return regions.length > 0 ? regions[0]!.startMs : 0;
}
