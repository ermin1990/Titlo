import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function formatTimecode(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const minutes = Math.floor(clamped / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const tenths = Math.floor((clamped % 1000) / 100);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
}

export function formatSeconds(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const seconds = Math.floor(clamped / 1000);
  const rest = clamped % 1000;
  return `${seconds},${rest.toString().padStart(3, '0')} s`;
}

export function formatMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

async function shareNative(filename: string, data: string, base64: boolean): Promise<void> {
  const written = await Filesystem.writeFile({
    path: filename,
    data,
    directory: Directory.Cache,
    ...(base64 ? {} : { encoding: Encoding.UTF8 }),
  });
  await Share.share({
    title: filename,
    url: written.uri,
    dialogTitle: 'Sačuvaj ili podijeli',
  });
}

export async function downloadText(
  filename: string,
  text: string,
  mime = 'text/plain',
): Promise<void> {
  if (isNative()) {
    await shareNative(filename, text, false);
    return;
  }
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Fajl nije pročitan.'));
    reader.readAsDataURL(blob);
  });
}

export async function saveBlob(filename: string, blob: Blob): Promise<void> {
  if (isNative()) {
    const base64 = await blobToBase64(blob);
    await shareNative(filename, base64, true);
    return;
  }
  downloadBlob(filename, blob);
}

export function safeBaseName(name: string | null | undefined): string {
  const base = (name ?? 'titlo').replace(/\.[^.]+$/, '');
  return base.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/-+/g, '-').slice(0, 60) || 'titlo';
}
