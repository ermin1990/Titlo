/**
 * Plan izvoza videa: veličina kadra i bitrate. Čiste funkcije, bez browsera,
 * da se pravilo može testirati i podesiti na jednom mjestu.
 */

export interface MediaSize {
  width: number;
  height: number;
}

export interface ExportPlanInput extends MediaSize {
  /** Stvarna brzina kadrova izvora. */
  fps: number;
  /** Bitrate izvornog videa u bitima u sekundi. */
  sourceBitrate: number;
}

export interface ExportPlan {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
}

/** Najveća stranica izvoza: uspravni video izlazi kao 1080×1920. */
export const EXPORT_MAX_SIDE = 1920;

/**
 * Bitovi po pikselu za izvoz sa titlovima. Oštra slova na pokretnoj pozadini
 * traže mnogo bitova: na 1080×1920@30 izmjereno je da 0.15 bpp ostavlja
 * mutne ivice slova (greška na slovima 6.5/255, šum 3.7), 0.25 bpp ih vraća
 * (5.3 i 1.9), a iznad 0.30 nema vidljive razlike.
 */
export const EXPORT_BITS_PER_PIXEL = 0.25;

/** Izvor je već kompresovan, pa izvoz mora imati više bitova da ne izgubi detalje. */
export const EXPORT_SOURCE_FACTOR = 1.25;

export const EXPORT_MIN_BITRATE = 6_000_000;
export const EXPORT_MAX_BITRATE = 32_000_000;

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

/** Veličina izvoza: prati odnos strana izvora, najviše do 1080×1920. */
export function exportSize(media: MediaSize): { width: number; height: number } {
  const ratio = media.height ? media.width / media.height : 9 / 16;
  let height = media.height || 1280;
  let width = media.width || 720;

  if (height >= width) {
    height = Math.min(EXPORT_MAX_SIDE, height);
    width = Math.round(height * ratio);
  } else {
    width = Math.min(EXPORT_MAX_SIDE, width);
    height = Math.round(width / ratio);
  }
  return { width: even(width), height: even(height) };
}

/**
 * Bitrate izvoza: najviše od onoga što traže titlovi, onoga što traži izvor i
 * donje granice. Titlovi su najzahtjevniji dio kadra, pa se ne smije štedjeti.
 */
export function exportBitrate(input: ExportPlanInput): number {
  const pixels = Math.max(1, input.width) * Math.max(1, input.height);
  const fps = Math.min(60, Math.max(24, Math.round(input.fps) || 30));
  const captionRate = pixels * fps * EXPORT_BITS_PER_PIXEL;
  const sourceRate = Math.max(0, input.sourceBitrate) * EXPORT_SOURCE_FACTOR;
  return Math.round(
    Math.min(
      EXPORT_MAX_BITRATE,
      Math.max(captionRate, sourceRate, EXPORT_MIN_BITRATE),
    ),
  );
}

/** Sve što izvoz treba da zna prije prvog kadra. */
export function exportPlan(input: ExportPlanInput): ExportPlan {
  const size = exportSize(input);
  const fps = Math.min(60, Math.max(24, Math.round(input.fps) || 30));
  return {
    ...size,
    fps,
    bitrate: exportBitrate({ ...size, fps, sourceBitrate: input.sourceBitrate }),
  };
}
