import type { TranscriptChunk } from '@titlo/core';

export interface AsrModel {
  id: string;
  label: string;
  size: string;
  note: string;
  /**
   * Verzija modela u aplikaciji. Skinuti model ostaje na uređaju kroz sva
   * ažuriranja aplikacije; povećaj ovaj broj samo kad model treba ponovo
   * skinuti (npr. novi kvantizirani fajlovi), pa se stari obriše.
   */
  version: number;
}

export const ASR_MODELS: AsrModel[] = [
  {
    id: 'onnx-community/whisper-tiny_timestamped',
    label: 'Najbrži',
    size: '~40 MB',
    note: 'Najmanja tačnost, dobar samo za brzi test',
    version: 1,
  },
  {
    id: 'onnx-community/whisper-base_timestamped',
    label: 'Brži',
    size: '~80–150 MB',
    note: 'Ravnoteža brzine i tačnosti',
    version: 1,
  },
  {
    id: 'onnx-community/whisper-small_timestamped',
    label: 'Preporučeno',
    size: '~250–500 MB',
    note: 'Najbolje za imena, sleng i naše dijalekte',
    version: 1,
  },
];

export interface AsrProgress {
  phase: 'load' | 'fallback' | 'transcribe';
  percent: number;
  label: string;
}

export interface AsrResult {
  text: string;
  chunks: TranscriptChunk[];
}

interface IncomingProgress {
  file?: string;
  name?: string;
  progress?: number;
  status?: string;
}

function device(): 'webgpu' | 'wasm' {
  return typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm';
}

function fileLabel(info: IncomingProgress): string {
  const name = info.file ?? info.name ?? '';
  if (name.includes('encoder')) return 'encoder';
  if (name.includes('decoder')) return 'decoder';
  if (name.includes('tokenizer')) return 'tokenizer';
  return name.replace(/\.onnx$/i, '') || 'model';
}

export function transcribeAudio(
  audio: Float32Array,
  options: { model: string; language?: string },
  onProgress: (progress: AsrProgress) => void,
): Promise<AsrResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    worker.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as {
        type: string;
        phase?: 'load' | 'fallback' | 'transcribe';
        info?: IncomingProgress;
        text?: string;
        chunks?: Array<{ text?: string; timestamp?: [number, number | null] }>;
        message?: string;
      };

      if (data.type === 'progress') {
        const info = data.info ?? {};
        const percent = typeof info.progress === 'number' ? info.progress : 0;
        onProgress({
          phase: 'load',
          percent,
          label: `Skidam model · ${fileLabel(info)} ${Math.round(percent)} %`,
        });
        return;
      }

      if (data.type === 'phase') {
        if (data.phase === 'load') {
          onProgress({ phase: 'load', percent: 0, label: 'Pripremam model…' });
        } else if (data.phase === 'fallback') {
          onProgress({ phase: 'fallback', percent: 0, label: 'GPU nije dostupan, prelazim na CPU…' });
        } else {
          onProgress({ phase: 'transcribe', percent: 100, label: 'Prepoznajem govor…' });
        }
        return;
      }

      if (data.type === 'result') {
        const chunks: TranscriptChunk[] = [];
        for (const chunk of data.chunks ?? []) {
          const timestamp = chunk.timestamp;
          if (!timestamp || timestamp[0] === null || timestamp[0] === undefined) continue;
          const text = (chunk.text ?? '').trim();
          if (!text) continue;
          const start = Number(timestamp[0]);
          const end = timestamp[1] === null || timestamp[1] === undefined ? start + 0.2 : Number(timestamp[1]);
          chunks.push({
            text,
            startMs: Math.round(start * 1000),
            endMs: Math.round((end > start ? end : start + 0.2) * 1000),
          });
        }

        worker.terminate();
        resolve({ text: data.text ?? '', chunks });
        return;
      }

      if (data.type === 'error') {
        worker.terminate();
        reject(new Error(data.message ?? 'Prepoznavanje nije uspjelo.'));
      }
    });

    worker.addEventListener('error', (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Worker za prepoznavanje nije pokrenut.'));
    });

    worker.postMessage(
      {
        audio,
        model: options.model,
        language: options.language,
        device: device(),
      },
      [audio.buffer],
    );
  });
}
