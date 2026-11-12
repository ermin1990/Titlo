/**
 * Izvuče mono zvuk na 16 kHz iz video fajla. Whisper traži upravo to.
 * Radi u browseru, bez servera.
 */
export async function extractAudio16k(file: File): Promise<Float32Array> {
  const buffer = await file.arrayBuffer();

  const AudioCtor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) throw new Error('Browser ne podržava analizu zvuka.');

  const context = new AudioCtor();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(buffer.slice(0));
  } catch {
    await context.close();
    throw new Error('Zvuk iz ovog videa ne može se pročitati u browseru.');
  }
  await context.close();

  const sampleRate = 16_000;
  const length = Math.max(1, Math.ceil(decoded.duration * sampleRate));
  const offline = new OfflineAudioContext(1, length, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}
