import type { MediaRef } from '@titlo/core';

export interface LoadedVideo {
  url: string;
  media: MediaRef;
}

function hasAudio(video: HTMLVideoElement): boolean {
  const media = video as HTMLVideoElement & {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: { length: number };
  };
  if (media.audioTracks && media.audioTracks.length > 0) return true;
  if (typeof media.mozHasAudio === 'boolean') return media.mozHasAudio;
  // Chrome/WebKit pune ovaj brojač tek nakon dekodiranja, pa ga ne koristimo
  // kao dokaz da zvuka nema. Bolje je pretpostaviti da zvuk postoji.
  return true;
}

export function probeVideo(file: File): Promise<LoadedVideo> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;
      if (durationMs < 500) {
        cleanup();
        reject(new Error('Video je prekratak ili ne postoji.'));
        return;
      }
      const media: MediaRef = {
        uri: url,
        name: file.name,
        durationMs,
        width: video.videoWidth,
        height: video.videoHeight,
        rotation: 0,
        fps: 30,
        hasAudio: hasAudio(video),
      };
      cleanup();
      resolve({ url, media });
    };

    video.onerror = () => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error('Browser ne može otvoriti ovaj video. Probaj MP4 (H.264).'));
    };

    video.src = url;
  });
}

export function videoRatio(media: MediaRef): number {
  if (!media.height) return 9 / 16;
  return media.width / media.height;
}
