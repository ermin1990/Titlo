import { detectSpeechRegions, mergeRegions, type SpeechRegion } from '@titlo/core';

export interface AnalyzeProgress {
  value: number;
  label: string;
}

type AudioContextCtor = typeof AudioContext;

function audioContext(): AudioContext {
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) throw new Error('Browser ne podržava analizu zvuka.');
  return new Ctor();
}

/**
 * Gruba analiza govora bez modela: nivo glasnoće po prozorima od 20 ms.
 * Dovoljno da automatika predloži vremena, a korisnik popravi samo pogrešno.
 */
export async function analyzeSpeech(
  file: File,
  onProgress?: (progress: AnalyzeProgress) => void,
): Promise<SpeechRegion[]> {
  onProgress?.({ value: 0.05, label: 'Čitam video…' });
  const buffer = await file.arrayBuffer();

  onProgress?.({ value: 0.2, label: 'Otvaram zvuk…' });
  const context = audioContext();
  let audio: AudioBuffer;
  try {
    audio = await context.decodeAudioData(buffer.slice(0));
  } catch {
    await context.close();
    throw new Error('Zvuk iz ovog videa ne može se pročitati u browseru.');
  }

  onProgress?.({ value: 0.45, label: 'Tražim govor…' });
  const channel = audio.getChannelData(0);
  const windowMs = 20;
  const windowSamples = Math.max(1, Math.round((audio.sampleRate * windowMs) / 1000));
  const windows = Math.floor(channel.length / windowSamples);
  const rms = new Float32Array(windows);

  for (let index = 0; index < windows; index += 1) {
    let sum = 0;
    const offset = index * windowSamples;
    for (let sample = 0; sample < windowSamples; sample += 1) {
      const value = channel[offset + sample] ?? 0;
      sum += value * value;
    }
    rms[index] = Math.sqrt(sum / windowSamples);
    if (index % 4000 === 0) {
      onProgress?.({ value: 0.45 + (index / Math.max(1, windows)) * 0.45, label: 'Tražim govor…' });
    }
  }

  onProgress?.({ value: 0.95, label: 'Sređujem predlog…' });
  await context.close();

  const regions = detectSpeechRegions(rms, windowMs);
  const merged = mergeRegions(regions, 200);
  onProgress?.({ value: 1, label: 'Gotovo' });
  return merged.filter((region) => region.endMs - region.startMs >= 90);
}
