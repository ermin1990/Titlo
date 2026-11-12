import { env, pipeline } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

/** Bez reference na webworker lib, da se ne sudari s DOM tipovima. */
const scope = self as unknown as {
  postMessage: (message: unknown) => void;
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
};

interface Incoming {
  audio: Float32Array;
  model: string;
  language?: string;
  device: 'webgpu' | 'wasm';
}

interface TranscriptChunk {
  text: string;
  timestamp: [number, number] | [number, null];
}

type Transcriber = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text?: string; chunks?: TranscriptChunk[] }>;

let cached: { key: string; transcriber: Transcriber } | null = null;

function send(payload: unknown): void {
  scope.postMessage(payload);
}

async function load(model: string, device: 'webgpu' | 'wasm'): Promise<Transcriber> {
  const key = `${model}|${device}`;
  if (cached?.key === key) return cached.transcriber;

  const progress_callback = (info: unknown) => send({ type: 'progress', info });

  const options =
    device === 'webgpu'
      ? ({
          device: 'webgpu',
          dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
          progress_callback,
        } as const)
      : ({ device: 'wasm', dtype: 'q8', progress_callback } as const);

  const transcriber = (await pipeline(
    'automatic-speech-recognition',
    model,
    options,
  )) as unknown as Transcriber;

  cached = { key, transcriber };
  return transcriber;
}

scope.addEventListener('message', async (event: MessageEvent<Incoming>) => {
  const { audio, model, language, device } = event.data;
  try {
    send({ type: 'phase', phase: 'load', device });
    let transcriber: Transcriber;
    try {
      transcriber = await load(model, device);
    } catch (error) {
      if (device !== 'webgpu') throw error;
      send({ type: 'phase', phase: 'fallback' });
      transcriber = await load(model, 'wasm');
    }

    send({ type: 'phase', phase: 'transcribe' });
    const result = await transcriber(audio, {
      language: language || undefined,
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    send({
      type: 'result',
      text: result.text ?? '',
      chunks: result.chunks ?? [],
    });
  } catch (error) {
    send({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
