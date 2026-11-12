import type { CaptionStyle, FilterPlugin } from '@titlo/core';

import popKaraoke from '../styles/pop-karaoke.json';
import plocaMasna from '../styles/ploca-masna.json';
import cistaTraka from '../styles/cista-traka.json';
import neonNoc from '../styles/neon-noc.json';
import pisac from '../styles/pisac.json';
import kinematograf from '../styles/kinematograf.json';
import meki from '../styles/meki.json';
import istaknuto from '../styles/istaknuto.json';
import podcast from '../styles/podcast.json';
import bombona from '../styles/bombona.json';

import topliFilm from '../filters/topli-film.json';
import hladniFilm from '../filters/hladni-film.json';
import noir from '../filters/noir.json';
import vhs from '../filters/vhs.json';
import zivopis from '../filters/zivopis.json';
import san from '../filters/san.json';

export const STYLES = [
  popKaraoke,
  meki,
  istaknuto,
  podcast,
  bombona,
  plocaMasna,
  cistaTraka,
  neonNoc,
  pisac,
  kinematograf,
] as unknown as CaptionStyle[];

export interface WebFilter extends FilterPlugin {
  webPreview: { css: string };
}

export const FILTERS = [
  topliFilm,
  hladniFilm,
  noir,
  vhs,
  zivopis,
  san,
] as unknown as WebFilter[];

export function styleById(id: string): CaptionStyle {
  return STYLES.find((style) => style.id === id) ?? STYLES[0]!;
}

export function filterById(id: string | null | undefined): WebFilter | null {
  if (!id) return null;
  return FILTERS.find((filter) => filter.id === id) ?? null;
}

export type { CaptionStyle, FilterPlugin };
