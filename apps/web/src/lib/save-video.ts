import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** Native dodatak iz android/app/src/main/java/app/titlo/MediaSaverPlugin.java. */
interface MediaSaverPlugin {
  saveVideo(options: { path: string; name: string }): Promise<{ location: string }>;
}
const MediaSaver = registerPlugin<MediaSaverPlugin>('MediaSaver');

export type SaveMethod = 'gallery' | 'download' | 'share';

export interface SaveResult {
  method: SaveMethod;
  location?: string;
}

/** Komadi od 3 MB, da veliki video ne pređe most kao jedan ogroman string. */
const CHUNK_BYTES = 3 * 1024 * 1024;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Video nije pročitan.'));
    reader.readAsDataURL(blob);
  });
}

async function writeTempFile(blob: Blob, name: string): Promise<{ path: string; uri: string }> {
  const path = `export/${name}`;
  for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
    const data = await blobToBase64(blob.slice(offset, offset + CHUNK_BYTES));
    if (offset === 0) {
      await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
    } else {
      await Filesystem.appendFile({ path, data, directory: Directory.Cache });
    }
  }
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  return { path, uri };
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function shareFile(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: 'video/mp4' });
  if (!navigator.canShare?.({ files: [file] })) {
    throw new Error('Ovaj browser ne može dijeliti video. Otvori aplikaciju u Safariju.');
  }
  await navigator.share({ files: [file], title: name });
}

/**
 * Da li čuvanje treba dodir korisnika. iPhone sprema u Fotografije samo kroz
 * sistemski meni, a on se otvara isključivo na dodir.
 */
export function saveNeedsTap(): boolean {
  return !isAndroidApp() && isIosDevice();
}

/**
 * Sprema video na uređaj:
 * - Android aplikacija: direktno u Galeriju (Movies/Titlo)
 * - iPhone: sistemski meni u kojem je "Sačuvaj video" (Fotografije)
 * - računar i Android browser: preuzimanje fajla
 */
export async function saveVideoToDevice(blob: Blob, name: string): Promise<SaveResult> {
  if (isAndroidApp()) {
    const temp = await writeTempFile(blob, name);
    try {
      const { location } = await MediaSaver.saveVideo({ path: temp.uri, name });
      return { method: 'gallery', location };
    } finally {
      await Filesystem.deleteFile({ path: temp.path, directory: Directory.Cache }).catch(() => undefined);
    }
  }
  if (Capacitor.isNativePlatform()) {
    const temp = await writeTempFile(blob, name);
    await Share.share({ title: name, url: temp.uri, dialogTitle: 'Sačuvaj video' });
    return { method: 'share' };
  }
  if (isIosDevice()) {
    await shareFile(blob, name);
    return { method: 'share' };
  }
  download(blob, name);
  return { method: 'download' };
}

/** Dijeljenje na druge aplikacije i mreže (Instagram, WhatsApp…). */
export async function shareVideo(blob: Blob, name: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const temp = await writeTempFile(blob, name);
    await Share.share({ title: name, url: temp.uri, dialogTitle: 'Podijeli video' });
    return;
  }
  await shareFile(blob, name);
}

export function canShareVideo(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  try {
    const probe = new File([new Blob()], 'titlo.mp4', { type: 'video/mp4' });
    return navigator.canShare?.({ files: [probe] }) === true;
  } catch {
    return false;
  }
}
