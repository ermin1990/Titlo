import type { CaptionStyle, Project } from '@titlo/core';
import { exportPlan } from '@titlo/core';
import { DataStream, createFile } from 'mp4box';
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { renderSourceFrame } from './render.js';

export interface ExportProgress {
  phase: 'prepare' | 'audio' | 'video' | 'mux' | 'done';
  value: number;
  label: string;
}

export interface ExportOptions {
  project: Project;
  style: CaptionStyle;
  filterCss: string | null;
  filterIntensity: number;
  videoUrl: string;
  onProgress: (progress: ExportProgress) => void;
}

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  durationMs: number;
  hasAudio: boolean;
}

/** WebView mora imati WebCodecs. Android System WebView 113+ ga ima. */
export function canExportVideo(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined'
  );
}

interface DescriptorNode {
  tag?: number;
  data?: ArrayBuffer | Uint8Array;
  descs?: DescriptorNode[];
}

interface AudioSamples {
  chunks: Array<{ data: Uint8Array; timestamp: number; duration: number }>;
  description?: Uint8Array;
  sampleRate: number;
  channels: number;
}

interface VideoSamples {
  samples: Array<{
    data: Uint8Array;
    timestamp: number;
    duration: number;
    isKey: boolean;
  }>;
  codec: string;
  description?: Uint8Array;
  width: number;
  height: number;
  /** Rotacija iz MP4 matrice (0, 90, 180, 270). Telefoni snimaju položeno pa okrenu. */
  rotation: number;
}

/** Ugao rotacije iz MP4 matrice prikaza (16.16 fixed point). */
function matrixRotation(matrix: unknown): number {
  if (!matrix || typeof (matrix as ArrayLike<number>).length !== 'number') return 0;
  const values = matrix as ArrayLike<number>;
  const a = (values[0] ?? 65536) / 65536;
  const b = (values[1] ?? 0) / 65536;
  const degrees = Math.round((Math.atan2(b, a) * 180) / Math.PI);
  return ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
}

function readAudioConfig(track: unknown): Uint8Array | undefined {
  const entry = (
    track as {
      mdia?: { minf?: { stbl?: { stsd?: { entries?: Array<Record<string, unknown>> } } } };
    }
  )?.mdia?.minf?.stbl?.stsd?.entries?.[0];
  const esds = entry?.esds as { esd?: DescriptorNode } | undefined;

  const findAacConfig = (node: DescriptorNode | undefined): Uint8Array | undefined => {
    if (!node) return undefined;
    if (node.tag === 5 && node.data) {
      const value = new Uint8Array(node.data);
      if (value.length === 0) return undefined;
      // 0x13 0x88 = AAC-LC. Neki fajlovi dodaju još bajtova u isti
      // deskriptor; za LC su prva dva dovoljna.
      const objectType = value[0]! >> 3;
      return objectType === 2 && value.length > 2 ? value.slice(0, 2) : value;
    }
    for (const child of node.descs ?? []) {
      const found = findAacConfig(child);
      if (found) return found;
    }
    return undefined;
  };

  return findAacConfig(esds?.esd);
}

function buildAacConfig(sampleRate: number, channels: number): Uint8Array {
  const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  let index = rates.findIndex((rate) => rate === sampleRate);
  if (index < 0) index = 4;
  return new Uint8Array([(2 << 3) | (index >> 1), ((index & 1) << 7) | (channels << 3)]);
}

function readAvcDescription(track: unknown): Uint8Array | undefined {
  const entry = (
    track as { mdia?: { minf?: { stbl?: { stsd?: { entries?: Array<Record<string, unknown>> } } } } }
  )?.mdia?.minf?.stbl?.stsd?.entries?.[0];
  const avcC = entry?.avcC as { write?: (stream: DataStream) => void } | undefined;
  if (!avcC?.write) return undefined;
  const stream = new DataStream(undefined, 0);
  avcC.write(stream);
  // Prvih 8 bajtova je header boxa (size + 'avcC').
  return new Uint8Array(stream.buffer as ArrayBuffer, 8);
}

interface Demuxed {
  audio: AudioSamples | null;
  video: VideoSamples | null;
}

async function demux(fileUrl: string): Promise<Demuxed> {
  const response = await fetch(fileUrl);
  const buffer = await response.arrayBuffer();

  const mp4 = createFile() as unknown as {
    onReady?: (info: unknown) => void;
    onError?: (error: unknown) => void;
    onSamples?: (id: number, user: unknown, samples: Array<Record<string, unknown>>) => void;
    appendBuffer: (buffer: ArrayBuffer) => void;
    setExtractionOptions: (id: number, user: unknown, options: { nbSamples: number }) => void;
    start: () => void;
    flush: () => void;
    getTrackById: (id: number) => unknown;
  };

  const audioSamples: Array<Record<string, unknown>> = [];
  const videoSamples: Array<Record<string, unknown>> = [];
  let audioTrack: Record<string, unknown> | null = null;
  let videoTrack: Record<string, unknown> | null = null;

  const ready = new Promise<void>((resolve, reject) => {
    mp4.onReady = (info) => {
      const data = info as {
        audioTracks?: Array<Record<string, unknown>>;
        videoTracks?: Array<Record<string, unknown>>;
      };
      audioTrack = data.audioTracks?.[0] ?? null;
      videoTrack = data.videoTracks?.[0] ?? null;
      if (audioTrack) {
        mp4.setExtractionOptions((audioTrack as { id: number }).id, null, { nbSamples: 2000 });
      }
      if (videoTrack) {
        mp4.setExtractionOptions((videoTrack as { id: number }).id, null, { nbSamples: 1000 });
      }
      mp4.start();
      resolve();
    };
    mp4.onError = (error) => reject(new Error(String(error)));
  });

  mp4.onSamples = (id, _user, list) => {
    const audioId = (audioTrack as { id?: number } | null)?.id;
    if (audioId !== undefined && id === audioId) {
      audioSamples.push(...list);
    } else {
      videoSamples.push(...list);
    }
  };

  const view = buffer as ArrayBuffer & { fileStart?: number };
  view.fileStart = 0;
  mp4.appendBuffer(view);

  try {
    await ready;
    mp4.flush();
  } catch (error) {
    throw new Error(
      error instanceof Error ? `MP4 nije pročitan: ${error.message}` : 'MP4 nije pročitan.',
    );
  }

  // mp4box emituje onSamples kroz mikro-zadatke.
  await new Promise((resolve) => setTimeout(resolve, 0));

  let audio: AudioSamples | null = null;
  if (audioTrack && audioSamples.length > 0) {
    const track = audioTrack as {
      id: number;
      timescale?: number;
      codec?: string;
      audio?: { sample_rate?: number; channel_count?: number };
    };
    const sampleRate = track.audio?.sample_rate ?? 48000;
    const channels = track.audio?.channel_count ?? 2;
    const description =
      readAudioConfig(mp4.getTrackById(track.id)) ?? buildAacConfig(sampleRate, channels);

    const chunks: Array<{ data: Uint8Array; timestamp: number; duration: number }> = [];
    for (const sample of audioSamples) {
      const raw = sample.data as Uint8Array | undefined;
      if (!raw || raw.byteLength === 0) continue;
      const timescale = (sample.timescale as number | undefined) ?? track.timescale ?? sampleRate;
      const cts = (sample.cts as number | undefined) ?? 0;
      const duration = (sample.duration as number | undefined) ?? 1024;
      chunks.push({
        data: new Uint8Array(raw),
        timestamp: Math.round((cts / timescale) * 1_000_000),
        duration: Math.round((duration / timescale) * 1_000_000),
      });
    }
    chunks.sort((a, b) => a.timestamp - b.timestamp);
    if (chunks.length > 0) audio = { chunks, description, sampleRate, channels };
  }

  let video: VideoSamples | null = null;
  if (videoTrack && videoSamples.length > 0) {
    const track = videoTrack as {
      id: number;
      codec?: string;
      timescale?: number;
      video?: { width?: number; height?: number };
      track_width?: number;
      track_height?: number;
      matrix?: ArrayLike<number>;
    };
    const codec = track.codec ?? 'avc1.64001f';
    if (!codec.startsWith('avc1') && !codec.startsWith('avc3')) {
      throw new Error('Izvoz za sada podržava H.264 video. Ovaj snimak koristi drugi kodek.');
    }

    const normalized: VideoSamples['samples'] = [];
    for (const sample of videoSamples) {
      const raw = sample.data as Uint8Array | undefined;
      if (!raw || raw.byteLength === 0) continue;
      const timescale = (sample.timescale as number | undefined) ?? track.timescale ?? 30;
      const cts = (sample.cts as number | undefined) ?? 0;
      const duration = (sample.duration as number | undefined) ?? Math.round(timescale / 30);
      normalized.push({
        data: new Uint8Array(raw),
        timestamp: Math.round((cts / timescale) * 1_000_000),
        duration: Math.round((duration / timescale) * 1_000_000),
        isKey: Boolean(sample.is_sync),
      });
    }
    // Uzorci ostaju u redoslijedu dekodiranja (kako su u fajlu). Sortiranje po
    // vremenu prikaza lomi video s B-kadrovima, koje snimaju skoro svi telefoni.

    if (normalized.length > 0) {
      video = {
        samples: normalized,
        codec,
        description: readAvcDescription(mp4.getTrackById(track.id)),
        width: track.video?.width ?? track.track_width ?? 1920,
        height: track.video?.height ?? track.track_height ?? 1080,
        rotation: matrixRotation(track.matrix),
      };
    }
  }

  return { audio, video };
}

/**
 * Bira kodek koji WebView stvarno podržava. Provjerava tačno onu konfiguraciju
 * koju ćemo koristiti (avc format, VBR, quality), jer podrška za goli kodek ne
 * garantuje da će isto podešavanje proći kroz `configure`. Ako uređaj ne zna
 * VBR ili `quality`, spušta se na jednostavniju konfiguraciju istog kodeka
 * umjesto da prijavi da H.264 uopšte nema.
 */
async function pickEncoderConfig(
  width: number,
  height: number,
  bitrate: number,
  fps: number,
): Promise<VideoEncoderConfig> {
  const candidates = ['avc1.64002a', 'avc1.640028', 'avc1.4d002a', 'avc1.4d0028', 'avc1.42001f'];
  for (const codec of candidates) {
    const base: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
      avc: { format: 'avc' },
    };
    // Titlovi su oštri i mijenjaju se iz riječi u riječ; VBR im daje više
    // bitova u kadrovima sa novim slovima, a manje u mirnima.
    const full: VideoEncoderConfig = { ...base, bitrateMode: 'variable', latencyMode: 'quality' };
    const withoutBitrateMode: VideoEncoderConfig = { ...base, latencyMode: 'quality' };

    for (const config of [full, withoutBitrateMode, base]) {
      try {
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) return config;
      } catch {
        /* probaj sljedeću varijantu */
      }
    }
  }
  throw new Error(
    'Ovaj WebView ne podržava H.264 kodiranje. Ažuriraj Android System WebView ili Chrome.',
  );
}

function waitDequeue(target: VideoDecoder | VideoEncoder): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      target.removeEventListener('dequeue', done as EventListener);
      resolve();
    };
    target.addEventListener('dequeue', done as EventListener, { once: true });
  });
}

export async function exportVideo(options: ExportOptions): Promise<ExportResult> {
  if (!canExportVideo()) {
    throw new Error(
      'Izvoz videa traži WebCodecs. Ažuriraj Android System WebView ili koristi Chrome.',
    );
  }

  const { project, style, filterCss, filterIntensity, videoUrl, onProgress } = options;
  const startMs = Math.max(0, project.trim.startMs);
  const endMs = Math.min(project.media.durationMs, project.trim.endMs);
  const durationMs = Math.max(500, endMs - startMs);

  if (durationMs > 5 * 60_000) {
    throw new Error('Izvoz je za sada ograničen na 5 minuta. Skrati video pa pokušaj.');
  }

  onProgress({ phase: 'prepare', value: 2, label: 'Čitam video…' });
  const { audio, video } = await demux(videoUrl);
  if (!video) {
    throw new Error('U videu nema H.264 slike koju mogu izvesti.');
  }

  // Brzina kadrova i bitrate prate izvor, plus ono što traže oštri titlovi.
  const first = video.samples.reduce((min, sample) => Math.min(min, sample.timestamp), Infinity);
  const last = video.samples.reduce((max, sample) => Math.max(max, sample.timestamp + sample.duration), 0);
  const spanSeconds = Math.max(0.5, (last - first) / 1_000_000);
  const sourceFps = video.samples.length / spanSeconds;
  const sourceBytes = video.samples.reduce((sum, sample) => sum + sample.data.byteLength, 0);
  const sourceBitrate = (sourceBytes * 8) / spanSeconds;
  const plan = exportPlan({
    width: project.media.width || video.width,
    height: project.media.height || video.height,
    fps: sourceFps,
    sourceBitrate,
  });
  const { width, height, fps, bitrate } = plan;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height },
    audio: audio
      ? { codec: 'aac', numberOfChannels: audio.channels, sampleRate: audio.sampleRate }
      : undefined,
    fastStart: false,
    firstTimestampBehavior: 'offset',
  });

  if (audio) {
    onProgress({ phase: 'audio', value: 4, label: 'Dodajem zvuk…' });
    for (const chunk of audio.chunks) {
      if (chunk.timestamp + chunk.duration <= startMs * 1000) continue;
      if (chunk.timestamp >= endMs * 1000) break;
      muxer.addAudioChunkRaw(chunk.data, 'key', Math.max(0, chunk.timestamp - startMs * 1000), chunk.duration, {
        decoderConfig: {
          codec: 'mp4a.40.2',
          sampleRate: audio.sampleRate,
          numberOfChannels: audio.channels,
          description: audio.description,
        },
      });
    }
  }

  const canvas = new OffscreenCanvas(width, height);
  // Bez alfa kanala: izvoz nije providan, a premnoženi alfa samo kvari boje.
  const ctx = canvas.getContext('2d', { alpha: false }) as unknown as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Canvas za izvoz nije dostupan.');

  const config = await pickEncoderConfig(width, height, bitrate, fps);
  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderError = error instanceof Error ? error : new Error(String(error));
    },
  });
  encoder.configure(config);

  let decoderError: Error | null = null;
  let frameIndex = 0;
  let lastTimestamp = -1;
  let encoded = 0;

  const decoder = new VideoDecoder({
    output: (frame) => {
      try {
        const timeMs = frame.timestamp / 1000;
        if (encoderError) return;
        if (timeMs + 1 < startMs || timeMs > endMs) return;

        renderSourceFrame({
          ctx,
          width,
          height,
          source: frame,
          project,
          style,
          filterCss,
          filterIntensity,
          timeMs,
          rotation: video.rotation,
        });

        const timestamp = Math.max(0, Math.round((timeMs - startMs) * 1000));
        if (timestamp > lastTimestamp) {
          lastTimestamp = timestamp;
          const out = new VideoFrame(canvas, {
            timestamp,
            duration: Math.max(1, Math.round(frame.duration ?? 1_000_000 / 30)),
          });
          encoder.encode(out, { keyFrame: frameIndex % (fps * 2) === 0 });
          out.close();
          frameIndex += 1;
          encoded += 1;
        }

        onProgress({
          phase: 'video',
          value: 6 + (timeMs - startMs) / durationMs * 82,
          label: `Kodiram kadar ${frameIndex}…`,
        });
      } finally {
        frame.close();
      }
    },
    error: (error) => {
      decoderError = error instanceof Error ? error : new Error(String(error));
    },
  });

  onProgress({ phase: 'video', value: 6, label: 'Dekodiram kadar…' });
  decoder.configure({
    codec: video.codec,
    description: video.description,
    codedWidth: video.width,
    codedHeight: video.height,
  });

  for (const sample of video.samples) {
    if (decoderError) break;
    if (encoderError) break;

    const chunk = new EncodedVideoChunk({
      type: sample.isKey ? 'key' : 'delta',
      timestamp: sample.timestamp,
      duration: sample.duration,
      data: sample.data,
    });
    decoder.decode(chunk);

    if (decoder.decodeQueueSize > 12) {
      await waitDequeue(decoder);
    }
    if (encoder.encodeQueueSize > 12) {
      await waitDequeue(encoder);
    }
  }

  // Dekoder se sam zatvori kad javi grešku; tada je ta greška pravi uzrok.
  if (decoderError || decoder.state === 'closed') {
    if (encoder.state !== 'closed') encoder.close();
    throw decoderError ?? new Error('Dekoder videa je zatvoren prije kraja.');
  }
  await decoder.flush();
  decoder.close();

  if (decoderError) throw decoderError;
  if (encoderError) throw encoderError;
  if (encoded === 0) throw new Error('Nijedan kadar nije izvezen. Provjeri video.');

  onProgress({ phase: 'mux', value: 90, label: 'Pakujem MP4…' });
  await encoder.flush();
  encoder.close();

  muxer.finalize();
  const blob = new Blob([target.buffer], { type: 'video/mp4' });

  onProgress({ phase: 'done', value: 100, label: 'Gotovo' });

  return {
    blob,
    width,
    height,
    durationMs,
    hasAudio: audio !== null && audio.chunks.length > 0,
  };
}
