import type { Animation, CaptionBox, CaptionStyle, Easing, Line } from './types.js';
import { graphemes, upperCase } from './text.js';

export interface CaptionFrameWord {
  wordId: string;
  text: string;
  row: number;
  /** Lijeva ivica riječi u pikselima prikaza. */
  x: number;
  /** Sredina riječi po uspravnoj osi. */
  y: number;
  width: number;
  fontSize: number;
  fill: string;
  stroke?: string;
  strokeWidth: number;
  alpha: number;
  scale: number;
  dx: number;
  dy: number;
  rotate: number;
  blur: number;
  /** 0..1, za typewriter. */
  reveal: number;
  isActive: boolean;
  isFuture: boolean;
}

export interface CaptionFrame {
  visible: boolean;
  lineId: string | null;
  words: CaptionFrameWord[];
  fontSize: number;
  box: { x: number; y: number; width: number };
}

export interface LayoutInput {
  lines: Line[];
  timeMs: number;
  offsetMs: number;
  style: CaptionStyle;
  box: CaptionBox;
  videoWidth: number;
  videoHeight: number;
  /** Mjeri širinu teksta; pozivalac postavlja font prije mjerenja. */
  measure: (text: string, fontSize: number) => number;
  locale?: string;
}

interface AnimationEffects {
  alpha: number;
  scale: number;
  dx: number;
  dy: number;
  rotate: number;
  blur: number;
  reveal: number;
}

const IDLE: AnimationEffects = { alpha: 1, scale: 1, dx: 0, dy: 0, rotate: 0, blur: 0, reveal: 1 };

export function ease(value: number, easing: Easing = 'easeOut'): number {
  const t = Math.min(1, Math.max(0, value));
  switch (easing) {
    case 'linear':
      return t;
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    case 'backOut': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
    }
    case 'easeOut':
    default:
      return 1 - (1 - t) ** 3;
  }
}

function applyAnimation(effects: AnimationEffects, animation: Animation, elapsedMs: number): void {
  const progress = ease(elapsedMs / Math.max(1, animation.durationMs), animation.easing);
  switch (animation.type) {
    case 'fade': {
      const from = animation.from ?? 0;
      effects.alpha *= from + (1 - from) * progress;
      break;
    }
    case 'pop': {
      const from = animation.from ?? 0.7;
      effects.scale *= from + (1 - from) * progress;
      break;
    }
    case 'scale': {
      const from = animation.from ?? 1.35;
      effects.scale *= from + (1 - from) * progress;
      break;
    }
    case 'slide': {
      const dy = animation.dy ?? -0.05;
      const dx = animation.dx ?? 0;
      effects.dy += dy * (1 - progress) * 1;
      effects.dx += dx * (1 - progress) * 1;
      break;
    }
    case 'typewriter': {
      effects.reveal = Math.min(effects.reveal, progress);
      break;
    }
    case 'blur': {
      effects.blur = Math.max(effects.blur, (1 - progress) * 10);
      break;
    }
    case 'wiggle': {
      effects.rotate += Math.sin(progress * Math.PI * 4) * 4 * (1 - progress);
      break;
    }
    case 'color':
      break;
  }
}

function evaluate(animations: Animation[] | undefined, elapsedMs: number): AnimationEffects {
  const effects: AnimationEffects = { ...IDLE };
  if (!animations || animations.length === 0) return effects;
  for (const animation of animations) applyAnimation(effects, animation, elapsedMs);
  return effects;
}

function mix(base: AnimationEffects, extra: AnimationEffects): AnimationEffects {
  return {
    alpha: base.alpha * extra.alpha,
    scale: base.scale * extra.scale,
    dx: base.dx + extra.dx,
    dy: base.dy + extra.dy,
    rotate: base.rotate + extra.rotate,
    blur: Math.max(base.blur, extra.blur),
    reveal: Math.min(base.reveal, extra.reveal),
  };
}

function animationDuration(animations: Animation[] | undefined): number {
  if (!animations) return 0;
  return animations.reduce((max, animation) => Math.max(max, animation.durationMs), 0);
}

/** Red koji je na ekranu u datom trenutku. */
export function activeLine(lines: Line[], timeMs: number): Line | null {
  let candidate: Line | null = null;
  for (const line of lines) {
    const first = line.words[0];
    const last = line.words[line.words.length - 1];
    if (!first || !last) continue;
    if (timeMs >= first.startMs - 60 && timeMs <= last.endMs + 260) candidate = line;
  }
  return candidate;
}

interface RowLayout {
  words: Array<{ wordIndex: number; text: string; width: number; spaceBefore: number }>;
  width: number;
}

function displayText(text: string, style: CaptionStyle, locale: string): string {
  return style.text.uppercase ? upperCase(text, locale) : text;
}

function layoutRows(
  line: Line,
  fontSize: number,
  maxWidth: number,
  style: CaptionStyle,
  locale: string,
  measure: (text: string, fontSize: number) => number,
): RowLayout[] | null {
  const rows: RowLayout[] = [];
  let current: RowLayout = { words: [], width: 0 };
  let index = 0;
  /** Malo zraka između riječi, da animacija isticanja ne spoji susjede. */
  const gapFactor = 1.12;

  for (const word of line.words) {
    if (word.source === 'spread' && word.endMs <= word.startMs) continue;
    const text = displayText(word.text, style, locale);
    const width = measure(text, fontSize);
    const space = current.words.length > 0 ? measure(' ', fontSize) * gapFactor : 0;

    if (width > maxWidth) return null;

    if (current.width + space + width > maxWidth && current.words.length > 0) {
      rows.push(current);
      current = { words: [], width: 0 };
    }
    current.words.push({ wordIndex: index, text, width, spaceBefore: current.words.length > 0 ? space : 0 });
    current.width += (current.words.length > 1 ? space : 0) + width;
    index += 1;
  }
  if (current.words.length > 0) rows.push(current);
  return rows;
}

/**
 * Cijeli kadar titla u datom trenutku. Isti ulazi daju isti kadar na svim
 * platformama, jer nema sistemskog sata — samo vremena riječi.
 */
export function buildCaptionFrame(input: LayoutInput): CaptionFrame {
  const { lines, offsetMs, style, box, videoWidth, videoHeight, measure } = input;
  const locale = input.locale ?? 'bs';
  const time = input.timeMs - offsetMs;
  const line = activeLine(lines, time);

  const empty: CaptionFrame = {
    visible: false,
    lineId: null,
    words: [],
    fontSize: 0,
    box: { x: box.x * videoWidth, y: box.y * videoHeight, width: box.width * videoWidth },
  };

  if (!line) return empty;

  const first = line.words[0]!;
  const last = line.words[line.words.length - 1]!;
  const maxWidth = box.width * videoWidth * 0.97;
  const baseSize = style.font.size * videoHeight;

  let fontSize = baseSize;
  let rows: RowLayout[] | null = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    rows = layoutRows(line, fontSize, maxWidth, style, locale, measure);
    if (rows && rows.length <= style.layout.maxLines) break;
    fontSize *= 0.88;
  }
  if (!rows || rows.length === 0) return empty;
  if (rows.length > style.layout.maxLines) rows = rows.slice(-style.layout.maxLines);

  const lineIn = animationDuration(style.animations.lineIn);
  const lineOut = animationDuration(style.animations.lineOut);
  const lineElapsed = time - first.startMs;
  const lineRemaining = last.endMs - time;

  const lineEffects = mix(
    lineElapsed < lineIn ? evaluate(style.animations.lineIn, lineElapsed) : { ...IDLE },
    lineRemaining < lineOut && lineOut > 0 ? evaluate(style.animations.lineOut, lineOut - lineRemaining) : { ...IDLE },
  );

  const lineHeightFactor = style.layout.lineHeight ?? 1.18;
  const rowHeight = fontSize * lineHeightFactor;
  const centerY = box.y * videoHeight;
  const strokeWidth = (style.text.strokeWidth ?? 0) * fontSize;
  const activeIndex = line.words.findIndex((word) => time >= word.startMs && time < word.endMs);
  const activeWordId = activeIndex >= 0 ? line.words[activeIndex]!.id : null;

  const words: CaptionFrameWord[] = [];
  const startY = centerY - ((rows.length - 1) * rowHeight) / 2;

  rows.forEach((row, rowIndex) => {
    let x =
      style.layout.align === 'center'
        ? box.x * videoWidth - row.width / 2
        : style.layout.align === 'right'
          ? box.x * videoWidth + maxWidth / 2 - row.width
          : box.x * videoWidth - maxWidth / 2;

    for (const item of row.words) {
      const word = line.words[item.wordIndex]!;
      x += item.spaceBefore;
      const wordElapsed = time - word.startMs;
      const wordImpact = wordElapsed > 0 ? evaluate(style.animations.wordIn, wordElapsed) : { ...IDLE };
      const effects = mix(lineEffects, wordImpact);
      const isActive = word.id === activeWordId;
      const isFuture = time < word.startMs;
      const futureOpacity = style.futureWord?.opacity ?? 0.55;

      words.push({
        wordId: word.id,
        text: item.text,
        row: rowIndex,
        x,
        y: startY + rowIndex * rowHeight,
        width: item.width,
        fontSize,
        fill: isActive ? style.activeWord.fill : style.text.fill,
        stroke: isActive && style.activeWord.stroke ? style.activeWord.stroke : style.text.stroke,
        strokeWidth,
        alpha: effects.alpha * (isFuture && activeIndex >= 0 ? futureOpacity : 1),
        scale: effects.scale * (isActive ? (style.activeWord.scale ?? 1) : 1),
        dx: effects.dx * videoWidth,
        dy: effects.dy * videoHeight,
        rotate: effects.rotate,
        blur: effects.blur,
        reveal: effects.reveal,
        isActive,
        isFuture,
      });

      x += item.width;
    }
  });

  return {
    visible: words.length > 0,
    lineId: line.id,
    words,
    fontSize,
    box: { x: box.x * videoWidth, y: centerY, width: maxWidth },
  };
}

/** Tekst riječi skraćen po grafemima, za typewriter animaciju. */
export function revealText(text: string, reveal: number): string {
  if (reveal >= 1) return text;
  if (reveal <= 0) return '';
  const parts = graphemes(text);
  const count = Math.ceil(parts.length * reveal);
  return parts.slice(0, count).join('');
}
