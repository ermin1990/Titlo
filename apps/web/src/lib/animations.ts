import type { Animation, CaptionStyle, Project } from '@titlo/core';

export interface AnimationPreset {
  id: string;
  label: string;
  animations: Animation[];
}

export const WORD_PRESETS: AnimationPreset[] = [
  { id: 'none', label: 'Bez', animations: [] },
  { id: 'fade', label: 'Fade in', animations: [{ type: 'fade', durationMs: 160 }] },
  { id: 'pop', label: 'Pop', animations: [{ type: 'pop', durationMs: 140, easing: 'backOut' }] },
  {
    id: 'slideDown',
    label: 'Odozgo',
    animations: [{ type: 'slide', durationMs: 200, dy: -0.025, easing: 'backOut' }],
  },
  {
    id: 'slideUp',
    label: 'Odozdo',
    animations: [{ type: 'slide', durationMs: 200, dy: 0.025, easing: 'backOut' }],
  },
  { id: 'scale', label: 'Uvećaj', animations: [{ type: 'scale', durationMs: 200 }] },
  {
    id: 'typewriter',
    label: 'Kucanje',
    animations: [{ type: 'typewriter', durationMs: 260, easing: 'linear' }],
  },
  { id: 'blur', label: 'Blur', animations: [{ type: 'blur', durationMs: 200 }] },
  { id: 'wiggle', label: 'Wiggle', animations: [{ type: 'wiggle', durationMs: 400 }] },
];

export const LINE_PRESETS: AnimationPreset[] = [
  { id: 'none', label: 'Bez', animations: [] },
  { id: 'fade', label: 'Fade in', animations: [{ type: 'fade', durationMs: 160 }] },
  {
    id: 'slideDown',
    label: 'Odozgo',
    animations: [{ type: 'slide', durationMs: 240, dy: -0.07, easing: 'backOut' }],
  },
  {
    id: 'slideUp',
    label: 'Odozdo',
    animations: [{ type: 'slide', durationMs: 240, dy: 0.07, easing: 'backOut' }],
  },
  { id: 'blur', label: 'Blur', animations: [{ type: 'blur', durationMs: 240 }] },
  { id: 'scale', label: 'Uvećaj', animations: [{ type: 'scale', durationMs: 260 }] },
];

export const OUT_PRESETS: AnimationPreset[] = [
  { id: 'none', label: 'Bez', animations: [] },
  { id: 'fade', label: 'Fade out', animations: [{ type: 'fade', durationMs: 140 }] },
  { id: 'blur', label: 'Blur', animations: [{ type: 'blur', durationMs: 180 }] },
  {
    id: 'slideUp',
    label: 'Gore',
    animations: [{ type: 'slide', durationMs: 180, dy: -0.05, easing: 'easeInOut' }],
  },
];

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

/**
 * Spaja plugin stil s korisničkim izmjenama (veličina, velika slova,
 * animacije). Plugin ostaje nepromijenjen, izmjene žive u projektu.
 */
export function resolveStyle(base: CaptionStyle, project: Project): CaptionStyle {
  const params = project.style.params;
  const size = typeof params.size === 'number' ? params.size : base.font.size;
  const uppercase =
    typeof params.uppercase === 'boolean' ? params.uppercase : base.text.uppercase ?? false;

  return {
    ...base,
    font: { ...base.font, size },
    text: { ...base.text, uppercase },
    animations: {
      lineIn: project.animationOverrides?.lineIn ?? base.animations.lineIn,
      wordIn: project.animationOverrides?.wordIn ?? base.animations.wordIn,
      lineOut: project.animationOverrides?.lineOut ?? base.animations.lineOut,
    },
  };
}
