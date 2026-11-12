import type { Animation, CaptionStyle, Project } from '@titlo/core';

export interface AnimationPreset {
  id: string;
  label: string;
  animations: Animation[];
}

/**
 * Animacije su namjerno kratke i bez odskakanja, da se tekst odmah čita.
 * Jače varijante ostaju u listi, ali nisu zadane.
 */
export const WORD_PRESETS: AnimationPreset[] = [
  { id: 'none', label: 'Bez', animations: [] },
  {
    id: 'soft',
    label: 'Blago (pojavi se i podigne)',
    animations: [
      { type: 'fade', durationMs: 220, from: 0.3 },
      { type: 'slide', durationMs: 260, dy: 0.008, easing: 'easeOut' },
    ],
  },
  { id: 'fade', label: 'Pojavi se', animations: [{ type: 'fade', durationMs: 180 }] },
  {
    id: 'pop',
    label: 'Mekani pop',
    animations: [{ type: 'pop', durationMs: 180, from: 0.88, easing: 'easeOut' }],
  },
  {
    id: 'slideDown',
    label: 'Odozgo',
    animations: [{ type: 'slide', durationMs: 220, dy: -0.012, easing: 'easeOut' }],
  },
  {
    id: 'slideUp',
    label: 'Odozdo',
    animations: [{ type: 'slide', durationMs: 220, dy: 0.012, easing: 'easeOut' }],
  },
  { id: 'scale', label: 'Smanji se na mjesto', animations: [{ type: 'scale', durationMs: 220 }] },
  {
    id: 'typewriter',
    label: 'Kucanje',
    animations: [{ type: 'typewriter', durationMs: 260, easing: 'linear' }],
  },
  { id: 'blur', label: 'Izoštri se', animations: [{ type: 'blur', durationMs: 220 }] },
  { id: 'wiggle', label: 'Zatrese se', animations: [{ type: 'wiggle', durationMs: 360 }] },
];

export const LINE_PRESETS: AnimationPreset[] = [
  { id: 'none', label: 'Bez', animations: [] },
  {
    id: 'soft',
    label: 'Blago',
    animations: [
      { type: 'fade', durationMs: 260 },
      { type: 'slide', durationMs: 320, dy: 0.02, easing: 'easeOut' },
    ],
  },
  { id: 'fade', label: 'Pojavi se', animations: [{ type: 'fade', durationMs: 200 }] },
  {
    id: 'slideDown',
    label: 'Odozgo',
    animations: [{ type: 'slide', durationMs: 260, dy: -0.03, easing: 'easeOut' }],
  },
  {
    id: 'slideUp',
    label: 'Odozdo',
    animations: [{ type: 'slide', durationMs: 260, dy: 0.03, easing: 'easeOut' }],
  },
  { id: 'blur', label: 'Izoštri se', animations: [{ type: 'blur', durationMs: 260 }] },
  { id: 'scale', label: 'Smanji se na mjesto', animations: [{ type: 'scale', durationMs: 280 }] },
];

export const OUT_PRESETS: AnimationPreset[] = [
  { id: 'none', label: 'Bez', animations: [] },
  { id: 'fade', label: 'Nestane', animations: [{ type: 'fade', durationMs: 180 }] },
  { id: 'blur', label: 'Zamuti se', animations: [{ type: 'blur', durationMs: 200 }] },
  {
    id: 'slideUp',
    label: 'Ode gore',
    animations: [{ type: 'slide', durationMs: 200, dy: -0.03, easing: 'easeInOut' }],
  },
];

/** Brzina animacija: množi trajanje. Sporije = mekše. */
export const SPEED_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1.5, label: 'Sporo' },
  { value: 1, label: 'Normalno' },
  { value: 0.7, label: 'Brzo' },
];

/** Boje istaknute riječi koje dobro stoje na većini videa. */
export const ACCENT_COLORS = ['#FFE14A', '#7CB8FF', '#FF7AC6', '#7CF2A4', '#FF9F43', '#FFFFFF'];

function matchPreset(presets: AnimationPreset[], animations: Animation[] | undefined): string {
  if (!animations || animations.length === 0) return 'none';
  const key = (list: Animation[]) =>
    list.map((animation) => `${animation.type}:${Math.sign(animation.dy ?? animation.dx ?? 0)}`).join(',');
  const target = key(animations);
  return presets.find((preset) => key(preset.animations) === target)?.id ?? 'custom';
}

export function wordPresetId(animations: Animation[] | undefined): string {
  return matchPreset(WORD_PRESETS, animations);
}

export function linePresetId(animations: Animation[] | undefined): string {
  return matchPreset(LINE_PRESETS, animations);
}

export function outPresetId(animations: Animation[] | undefined): string {
  return matchPreset(OUT_PRESETS, animations);
}

function scaled(animations: Animation[] | undefined, factor: number): Animation[] | undefined {
  if (!animations || factor === 1) return animations;
  return animations.map((animation) => ({
    ...animation,
    durationMs: Math.round(animation.durationMs * factor),
  }));
}

/**
 * Spaja plugin stil s korisničkim izmjenama (veličina, velika slova, boja
 * istaknute riječi, brzina i vrsta animacija). Plugin ostaje nepromijenjen,
 * izmjene žive u projektu.
 */
export function resolveStyle(base: CaptionStyle, project: Project): CaptionStyle {
  const params = project.style.params;
  const size = typeof params.size === 'number' ? params.size : base.font.size;
  const uppercase =
    typeof params.uppercase === 'boolean' ? params.uppercase : base.text.uppercase ?? false;
  const speed = typeof params.animSpeed === 'number' ? params.animSpeed : 1;
  const accent = typeof params.accent === 'string' ? params.accent : null;

  const activeWord = { ...base.activeWord };
  if (accent) {
    if (activeWord.background) activeWord.background = { ...activeWord.background, color: accent };
    else activeWord.fill = accent;
  }

  return {
    ...base,
    font: { ...base.font, size },
    text: { ...base.text, uppercase },
    activeWord,
    animations: {
      lineIn: scaled(project.animationOverrides?.lineIn ?? base.animations.lineIn, speed),
      wordIn: scaled(project.animationOverrides?.wordIn ?? base.animations.wordIn, speed),
      lineOut: scaled(project.animationOverrides?.lineOut ?? base.animations.lineOut, speed),
    },
  };
}

/** Boja istaknute riječi kakvu korisnik vidi (pločica ili slova). */
export function accentOf(base: CaptionStyle): string {
  return base.activeWord.background?.color ?? base.activeWord.fill;
}
