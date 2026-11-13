import { describe, expect, it } from 'vitest';
import {
  EXPORT_BITS_PER_PIXEL,
  EXPORT_MAX_BITRATE,
  EXPORT_MAX_SIDE,
  EXPORT_MIN_BITRATE,
  EXPORT_SOURCE_FACTOR,
  exportBitrate,
  exportPlan,
  exportSize,
} from '../src/index.js';

describe('izvoz videa', () => {
  it('uspravni 4K svodi na 1080×1920', () => {
    expect(exportSize({ width: 2160, height: 3840 })).toEqual({ width: 1080, height: 1920 });
  });

  it('vodoravni 4K svodi na 1920×1080', () => {
    expect(exportSize({ width: 3840, height: 2160 })).toEqual({ width: 1920, height: 1080 });
  });

  it('manji video ostaje kakav jeste', () => {
    expect(exportSize({ width: 720, height: 1280 })).toEqual({ width: 720, height: 1280 });
  });

  it('neparne dimenzije zaokružuje na parne', () => {
    const size = exportSize({ width: 1081, height: 1921 });
    expect(size.width % 2).toBe(0);
    expect(size.height % 2).toBe(0);
  });

  it('bez podataka o veličini daje uspravni 720×1280', () => {
    expect(exportSize({ width: 0, height: 0 })).toEqual({ width: 720, height: 1280 });
  });

  it('bitrate nosi oštre titlove: 1080×1920@30 traži 0.25 bpp', () => {
    const bitrate = exportBitrate({
      width: 1080,
      height: 1920,
      fps: 30,
      sourceBitrate: 2_000_000,
    });
    expect(bitrate).toBe(Math.round(1080 * 1920 * 30 * EXPORT_BITS_PER_PIXEL));
    expect(bitrate).toBeGreaterThan(9_000_000);
  });

  it('izvor sa više bitova diže izvoz iznad 1:1', () => {
    const source = 20_000_000;
    const bitrate = exportBitrate({
      width: 720,
      height: 1280,
      fps: 30,
      sourceBitrate: source,
    });
    expect(bitrate).toBe(Math.round(source * EXPORT_SOURCE_FACTOR));
  });

  it('ne prelazi gornju granicu', () => {
    const bitrate = exportBitrate({
      width: 1080,
      height: 1920,
      fps: 60,
      sourceBitrate: 90_000_000,
    });
    expect(bitrate).toBe(EXPORT_MAX_BITRATE);
  });

  it('ne pada ispod donje granice', () => {
    const bitrate = exportBitrate({ width: 240, height: 426, fps: 24, sourceBitrate: 0 });
    expect(bitrate).toBe(EXPORT_MIN_BITRATE);
  });

  it('fps se drži u granicama 24..60', () => {
    expect(exportPlan({ width: 1080, height: 1920, fps: 12, sourceBitrate: 0 }).fps).toBe(24);
    expect(exportPlan({ width: 1080, height: 1920, fps: 240, sourceBitrate: 0 }).fps).toBe(60);
  });

  it('plan nosi i veličinu i bitrate', () => {
    const plan = exportPlan({ width: 2160, height: 3840, fps: 30, sourceBitrate: 5_000_000 });
    expect(plan.width).toBe(1080);
    expect(plan.height).toBe(1920);
    expect(plan.fps).toBe(30);
    expect(plan.bitrate).toBe(
      Math.round(Math.max(1080 * 1920 * 30 * EXPORT_BITS_PER_PIXEL, 5_000_000 * EXPORT_SOURCE_FACTOR)),
    );
  });

  it('nijedna strana ne prelazi najveću', () => {
    const plan = exportPlan({ width: 8000, height: 4000, fps: 30, sourceBitrate: 0 });
    expect(Math.max(plan.width, plan.height)).toBeLessThanOrEqual(EXPORT_MAX_SIDE);
  });
});
