import type { AsrModel } from './index.js';

/** Isti naziv koji koristi @huggingface/transformers (env.cacheKey). */
const MODEL_CACHE = 'transformers-cache';
const MARKER_PREFIX = 'titlo:model:';

function cachesAvailable(): boolean {
  return typeof caches !== 'undefined';
}

function readMarker(model: AsrModel): number | null {
  try {
    const raw = localStorage.getItem(MARKER_PREFIX + model.id);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function writeMarker(model: AsrModel): void {
  try {
    localStorage.setItem(MARKER_PREFIX + model.id, String(model.version));
  } catch {
    /* privatni način rada: model je i dalje u kešu */
  }
}

function clearMarker(model: AsrModel): void {
  try {
    localStorage.removeItem(MARKER_PREFIX + model.id);
  } catch {
    /* ignore */
  }
}

async function modelKeys(model: AsrModel): Promise<Request[]> {
  if (!cachesAvailable()) return [];
  const cache = await caches.open(MODEL_CACHE);
  const keys = await cache.keys();
  return keys.filter((request) => request.url.includes(`/${model.id}/`));
}

/**
 * Traži od browsera da keš s modelom ne briše kad mu zatreba prostor.
 * Bez ovoga browser (naročito Safari i telefoni) smije obrisati model.
 */
export async function keepModelsOnDevice(): Promise<boolean> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage?.persist) return false;
  try {
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

/**
 * Briše samo modele čija je verzija u aplikaciji promijenjena. Model bez
 * oznake (skinut prije ove verzije aplikacije) se zadržava.
 */
export async function removeOutdatedModels(models: AsrModel[]): Promise<void> {
  if (!cachesAvailable()) return;
  const cache = await caches.open(MODEL_CACHE);
  for (const model of models) {
    const stored = readMarker(model);
    if (stored === null || stored === model.version) continue;
    const keys = await modelKeys(model);
    await Promise.all(keys.map((key) => cache.delete(key)));
    clearMarker(model);
  }
}

/** Model je na uređaju ako su encoder i decoder u kešu. */
export async function isModelOnDevice(model: AsrModel): Promise<boolean> {
  try {
    const keys = await modelKeys(model);
    const onnx = keys.filter((request) => /\.onnx(\?|$)/.test(request.url));
    const ready =
      onnx.some((request) => request.url.includes('encoder')) &&
      onnx.some((request) => request.url.includes('decoder'));
    if (ready && readMarker(model) === null) writeMarker(model);
    return ready;
  } catch {
    return false;
  }
}

/** Poziva se nakon uspješnog prepoznavanja: model je cijeli u kešu. */
export function markModelReady(model: AsrModel): void {
  writeMarker(model);
}
