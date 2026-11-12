import type { CaptionStyle, Project } from '@titlo/core';
import { buildCaptionFrame, revealText } from '@titlo/core';

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  video: HTMLVideoElement | null;
  project: Project;
  style: CaptionStyle;
  filterCss: string | null;
  filterIntensity: number;
  timeMs: number;
  showSafeZones: boolean;
  showBox: boolean;
}

/** Kadar iz dekodera, kao zamjena za video element pri izvozu. */
export interface SourceRenderOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  source: CanvasImageSource;
  project: Project;
  style: CaptionStyle;
  filterCss: string | null;
  filterIntensity: number;
  timeMs: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function fitRect(containerW: number, containerH: number, ratio: number): Rect {
  let w = containerW;
  let h = containerW / ratio;
  if (h > containerH) {
    h = containerH;
    w = containerH * ratio;
  }
  return { x: (containerW - w) / 2, y: (containerH - h) / 2, w, h };
}

function fontString(style: CaptionStyle, size: number): string {
  return `${style.font.weight} ${Math.max(1, size)}px "${style.font.family}", Inter, system-ui, sans-serif`;
}

function applyLetterSpacing(ctx: CanvasRenderingContext2D, style: CaptionStyle): void {
  const spacing = style.font.letterSpacing;
  if (typeof spacing === 'number') {
    try {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}em`;
    } catch {
      /* stariji browseri ne podržavaju */
    }
  }
}

function resetLetterSpacing(ctx: CanvasRenderingContext2D): void {
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  } catch {
    /* ignore */
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paint(options: RenderOptions, source: CanvasImageSource | null): void {
  const { ctx, width, height, project, style, timeMs } = options;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const ratio = project.media.height ? project.media.width / project.media.height : 9 / 16;
  const rect = fitRect(width, height, ratio);

  if (source) {
    ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
    if (options.filterCss && options.filterIntensity > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      ctx.globalAlpha = Math.min(1, Math.max(0, options.filterIntensity));
      ctx.filter = options.filterCss;
      ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = '#17171b';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = '#3a3a42';
    ctx.font = `${Math.round(rect.h * 0.02)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('video', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  const measure = (text: string, fontSize: number): number => {
    ctx.font = fontString(style, fontSize);
    applyLetterSpacing(ctx, style);
    const width_ = ctx.measureText(text).width;
    resetLetterSpacing(ctx);
    return width_;
  };

  const frame = buildCaptionFrame({
    lines: project.lines,
    timeMs,
    offsetMs: project.offsetMs,
    style,
    box: project.captionBox,
    videoWidth: rect.w,
    videoHeight: rect.h,
    measure,
    locale: project.language,
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __frame?: unknown }).__frame = { frame, styleId: style.id, fontSize: style.font.size, rect };
  }

  if (frame.visible) {
    ctx.save();
    ctx.translate(rect.x, rect.y);

    const background = style.text.background;
    if (background) {
      const rows = new Map<number, { minX: number; maxX: number; y: number; size: number }>();
      for (const word of frame.words) {
        const current = rows.get(word.row);
        if (!current) {
          rows.set(word.row, {
            minX: word.x,
            maxX: word.x + word.width,
            y: word.y,
            size: word.fontSize,
          });
        } else {
          current.minX = Math.min(current.minX, word.x);
          current.maxX = Math.max(current.maxX, word.x + word.width);
        }
      }
      ctx.fillStyle = background.color;
      ctx.globalAlpha = background.opacity ?? 0.7;
      for (const row of rows.values()) {
        const padX = (background.paddingX ?? 0.5) * row.size;
        const padY = (background.paddingY ?? 0.2) * row.size;
        roundedRect(
          ctx,
          row.minX - padX,
          row.y - row.size * 0.62 - padY,
          row.maxX - row.minX + padX * 2,
          row.size * 1.24 + padY * 2,
          (background.radius ?? 0.3) * row.size,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    for (const word of frame.words) {
      if (word.alpha <= 0.01) continue;
      const text = revealText(word.text, word.reveal);
      if (!text) continue;

      const centerX = word.x + word.width / 2 + word.dx;
      const centerY = word.y + word.dy;

      ctx.save();
      ctx.globalAlpha = Math.min(1, word.alpha);
      ctx.translate(centerX, centerY);
      if (word.rotate) ctx.rotate((word.rotate * Math.PI) / 180);
      if (word.scale !== 1) ctx.scale(word.scale, word.scale);
      if (word.blur > 0.05) ctx.filter = `blur(${word.blur.toFixed(2)}px)`;

      ctx.font = fontString(style, word.fontSize);
      applyLetterSpacing(ctx, style);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (style.text.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = word.fontSize * 0.12;
        ctx.shadowOffsetY = word.fontSize * 0.04;
      }

      const drawX = (word.width - ctx.measureText(text).width) / 2;
      if (word.stroke && word.strokeWidth > 0) {
        ctx.lineWidth = word.strokeWidth;
        ctx.strokeStyle = word.stroke;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(text, drawX, 0);
      }
      ctx.fillStyle = word.fill;
      ctx.fillText(text, drawX, 0);

      resetLetterSpacing(ctx);
      ctx.restore();
    }

    ctx.restore();
  }

  if (options.showSafeZones) {
    ctx.save();
    ctx.strokeStyle = 'rgba(124, 184, 255, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 6]);
    const insetX = rect.w * 0.06;
    const insetTop = rect.h * 0.1;
    const insetBottom = rect.h * 0.17;
    ctx.strokeRect(
      rect.x + insetX,
      rect.y + insetTop,
      rect.w - insetX * 2,
      rect.h - insetTop - insetBottom,
    );
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(124, 184, 255, 0.75)';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('sigurna zona', rect.x + insetX + 8, rect.y + insetTop + 8);
    ctx.restore();
  }

  if (options.showBox) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 225, 74, 0.8)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const boxWidth = project.captionBox.width * rect.w;
    const boxX = rect.x + project.captionBox.x * rect.w - boxWidth / 2;
    const boxY = rect.y + project.captionBox.y * rect.h;
    ctx.strokeRect(boxX, boxY - rect.h * 0.09, boxWidth, rect.h * 0.18);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 225, 74, 0.95)';
    ctx.beginPath();
    ctx.arc(boxX + boxWidth / 2, boxY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/** Pregled: crta video element i titlove. */
export function renderFrame(options: RenderOptions): void {
  const video = options.video;
  paint(options, video && video.readyState >= 2 ? video : null);
}

/** Izvoz: crta dekodirani kadar (VideoFrame) i titlove. */
export function renderSourceFrame(options: SourceRenderOptions): void {
  paint(
    {
      ...options,
      video: null,
      showSafeZones: false,
      showBox: false,
    },
    options.source,
  );
}
