/**
 * Model projekta. Sve u milisekundama od početka originalnog videa.
 * Vremena su cijeli brojevi. Pozicije su udjeli 0..1, nikad pikseli.
 */

export const SCHEMA_VERSION = 1 as const;

/** Odakle dolazi vrijeme za riječ. Editor boji riječi po ovome. */
export type TimeSource = 'tap' | 'auto' | 'aligned' | 'spread' | 'manual';

export interface Word {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  source: TimeSource;
}

export interface Line {
  id: string;
  speaker: string | null;
  words: Word[];
}

export interface MediaRef {
  /** Prikazni URI (blob:, file:, https:). Ne čuva se u izvozu projekta. */
  uri: string;
  name: string;
  durationMs: number;
  width: number;
  height: number;
  rotation: number;
  fps: number;
  hasAudio: boolean;
  /** Otisak prvih i zadnjih 1 MB, za ponovno povezivanje fajla. */
  hash?: string;
}

export interface CaptionBox {
  /** Centar titla po vodoravnoj osi, 0..1. */
  x: number;
  /** Centar bloka titla po uspravnoj osi, 0..1. */
  y: number;
  width: number;
}

export interface StyleRef {
  id: string;
  params: Record<string, number | string | boolean>;
}

export interface AnimationOverrides {
  lineIn?: Animation[];
  wordIn?: Animation[];
  lineOut?: Animation[];
}

export interface Project {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  language: string;
  media: MediaRef;
  trim: { startMs: number; endMs: number };
  /** Globalni pomak titlova. Ne mijenja vremena riječi. */
  offsetMs: number;
  lines: Line[];
  style: StyleRef;
  filter: StyleRef | null;
  captionBox: CaptionBox;
  /** Korisničke izmjene animacija; prazno znači "kako kaže stil". */
  animationOverrides?: AnimationOverrides;
  updatedAt: number;
}

export type Easing = 'linear' | 'easeOut' | 'easeInOut' | 'backOut';

export type AnimationType =
  | 'fade'
  | 'pop'
  | 'slide'
  | 'scale'
  | 'color'
  | 'typewriter'
  | 'wiggle'
  | 'blur';

export interface Animation {
  type: AnimationType;
  durationMs: number;
  easing?: Easing;
  /** Početna vrijednost za scale/fade; završna je uvijek ciljna. */
  from?: number;
  /** Pomak u udjelima visine videa, za slide. */
  dy?: number;
  /** Pomak po vodoravnoj osi, za slide. */
  dx?: number;
}

export interface CaptionStyle {
  schemaVersion: 1;
  id: string;
  name: Record<string, string>;
  author?: string;
  license?: string;
  font: {
    family: string;
    weight: number;
    /** Udio visine videa, npr. 0.062 = 6.2 %. */
    size: number;
    letterSpacing?: number;
  };
  layout: {
    maxLines: number;
    maxWordsOnScreen: number;
    align: 'left' | 'center' | 'right';
    lineHeight?: number;
  };
  text: {
    fill: string;
    stroke?: string;
    strokeWidth?: number;
    uppercase?: boolean;
    shadow?: boolean;
    /** Obrub iza cijelog reda, za stilove tipa "čista traka". */
    background?: {
      color: string;
      opacity?: number;
      paddingX?: number;
      paddingY?: number;
      radius?: number;
    };
  };
  activeWord: {
    fill: string;
    scale?: number;
    stroke?: string;
  };
  /** Riječi koje još nisu izgovorene. */
  futureWord?: { opacity?: number };
  animations: {
    lineIn?: Animation[];
    wordIn?: Animation[];
    lineOut?: Animation[];
  };
}

export interface FilterPlugin {
  schemaVersion: 1;
  id: string;
  name: Record<string, string>;
  author?: string;
  license?: string;
  flashing: boolean;
  params: Array<{
    key: string;
    type: 'float' | 'int' | 'bool' | 'color';
    min?: number;
    max?: number;
    default: number | boolean | string;
  }>;
}
