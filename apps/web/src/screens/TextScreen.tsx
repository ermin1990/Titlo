import { useEffect, useMemo, useRef, useState } from 'react';
import {
  autoTimeWords,
  linesFromTranscriptText,
  parseCaptions,
  splitLines,
  splitWords,
  textStats,
  transcriptText,
} from '@titlo/core';
import { useApp } from '../store.js';
import { analyzeSpeech, type AnalyzeProgress } from '../lib/analyze.js';
import { extractAudio16k } from '../lib/audio.js';
import { ASR_MODELS, transcribeAudio, type AsrProgress } from '../asr/index.js';
import {
  isModelOnDevice,
  keepModelsOnDevice,
  markModelReady,
  removeOutdatedModels,
} from '../asr/cache.js';
import { formatTimecode } from '../lib/format.js';

const LANGUAGES = [
  { code: 'bs', label: 'Bosanski' },
  { code: 'hr', label: 'Hrvatski' },
  { code: 'sr', label: 'Srpski' },
  { code: 'en', label: 'Engleski' },
  { code: 'auto', label: 'Prepoznaj sam' },
];

export default function TextScreen() {
  const text = useApp((state) => state.text);
  const setText = useApp((state) => state.setText);
  const language = useApp((state) => state.language);
  const setLanguage = useApp((state) => state.setLanguage);
  const media = useApp((state) => state.media);
  const fileName = useApp((state) => state.fileName);
  const videoUrl = useApp((state) => state.videoUrl);
  const beginProject = useApp((state) => state.beginProject);
  const setProject = useApp((state) => state.setProject);
  const setStep = useApp((state) => state.setStep);
  const showToast = useApp((state) => state.showToast);

  const [progress, setProgress] = useState<AnalyzeProgress | null>(null);
  const [asr, setAsr] = useState<AsrProgress | null>(null);
  const [model, setModel] = useState(ASR_MODELS[2]!.id);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [onDevice, setOnDevice] = useState<Record<string, boolean>>({});
  const captionInput = useRef<HTMLInputElement>(null);

  const busy = progress !== null || asr !== null;
  const stats = useMemo(() => textStats(text), [text]);
  const lines = useMemo(() => splitLines(text), [text]);
  const selectedModel = ASR_MODELS.find((entry) => entry.id === model) ?? ASR_MODELS[2]!;
  const modelReady = onDevice[selectedModel.id] === true;

  // Model skinut jednom ostaje na uređaju; briše se samo kad aplikacija
  // donese novu verziju tog modela.
  useEffect(() => {
    let active = true;
    void (async () => {
      await removeOutdatedModels(ASR_MODELS).catch(() => undefined);
      const entries = await Promise.all(
        ASR_MODELS.map(async (entry) => [entry.id, await isModelOnDevice(entry)] as const),
      );
      if (active) setOnDevice(Object.fromEntries(entries));
      if (entries.some(([, ready]) => ready)) void keepModelsOnDevice();
    })();
    return () => {
      active = false;
    };
  }, []);

  async function recognizeSpeech() {
    if (!useApp.getState().videoFile) {
      showToast('Video nije učitan. Vrati se i izaberi fajl.');
      return;
    }
    if (useApp.getState().text.trim().length > 0 && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setConfirmReplace(false);

    setAsr({ phase: 'load', percent: 0, label: 'Pripremam zvuk…' });
    // Prije skidanja: zamoli browser da model ne briše kad mu treba prostor.
    await keepModelsOnDevice();
    try {
      const file = useApp.getState().videoFile;
      if (!file) return;
      const audio = await extractAudio16k(file);
      const result = await transcribeAudio(
        audio,
        { model, language: language === 'auto' ? undefined : language },
        setAsr,
      );
      if (import.meta.env.DEV) console.debug('whisper chunks', result.chunks);
      markModelReady(selectedModel);
      setOnDevice((current) => ({ ...current, [selectedModel.id]: true }));

      const recognized = linesFromTranscriptText(result.text, result.chunks);
      if (recognized.length === 0) {
        throw new Error('Nisam prepoznao govor. Probaj drugi model ili jezik.');
      }

      setText(transcriptText(recognized));
      beginProject();
      const project = useApp.getState().project;
      if (project) setProject({ ...project, lines: recognized });
      setStep('edit');
      showToast(
        `Prepoznato ${recognized.length} redova. Provjeri imena, sleng i dijakritike.`,
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Prepoznavanje nije uspjelo. Probaj drugi model.',
      );
    } finally {
      setAsr(null);
    }
  }

  async function startAuto() {
    if (stats.words === 0) return;
    const file = useApp.getState().videoFile;
    if (!file) {
      showToast('Video nije učitan. Vrati se i izaberi fajl.');
      return;
    }
    setProgress({ value: 0, label: 'Pripremam…' });
    try {
      const regions = await analyzeSpeech(file, setProgress);
      beginProject();
      const project = useApp.getState().project;
      if (!project) return;
      if (regions.length === 0) {
        showToast('Nisam našao govor u ovom snimku.');
        setProgress(null);
        return;
      }
      setProject({ ...project, lines: autoTimeWords(project.lines, regions) });
      setStep('edit');
      showToast(`Predlog spreman: ${regions.length} govornih dijelova. Provjeri i popravi.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Analiza nije uspjela.');
    } finally {
      setProgress(null);
    }
  }

  async function importCaptions(file: File | undefined) {
    if (!file) return;
    const raw = await file.text();
    const parsed = parseCaptions(raw, file.name);
    if (parsed.length === 0) {
      showToast('U fajlu nisam našao titlove.');
      return;
    }
    beginProject();
    const project = useApp.getState().project;
    if (!project) return;
    setProject({ ...project, lines: parsed });
    setStep('edit');
    showToast(`Uvezeno ${parsed.length} redova iz ${file.name}.`);
  }

  const ratio = media ? `${media.width}×${media.height}` : '';
  const orientation =
    media && media.width && media.height
      ? media.width > media.height
        ? 'položen'
        : 'uspravan'
      : '';

  return (
    <main className="shell shell-narrow">
      <div className="text-screen">
        <div className="video-card">
          <div className="video-thumb">
            {videoUrl ? <video src={videoUrl} muted playsInline preload="metadata" /> : 'video'}
          </div>
          <div className="video-meta">
            <strong>{fileName ?? 'video.mp4'}</strong>
            <span>
              {media ? formatTimecode(media.durationMs) : '0:00.0'} · {ratio} {orientation} ·{' '}
              {media?.hasAudio ? 'ima zvuk' : 'bez zvuka'}
            </span>
          </div>
        </div>

        <section className="recognize-card">
          <div className="recognize-head">
            <div>
              <strong>Prepoznaj govor</strong>
              <span className="hint">
                Whisper napiše tekst i vremena riječi na uređaju.{' '}
                {modelReady
                  ? 'Model je već na uređaju i radi bez interneta.'
                  : `Model (${selectedModel.size}) se skida samo jednom i ostaje na uređaju.`}
              </span>
            </div>
            <button
              className="btn btn-primary btn-lg"
              type="button"
              onClick={() => void recognizeSpeech()}
              disabled={busy}
            >
              {asr ? 'Radim…' : stats.words > 0 ? 'Prepoznaj i zamijeni tekst' : 'Prepoznaj govor'}
            </button>
          </div>

          {confirmReplace && (
            <div className="confirm-row">
              <span>
                Prepoznavanje će zamijeniti postojeći tekst. Vremena i stil ostaju u projektu.
              </span>
              <div className="actions">
                <button className="btn" type="button" onClick={() => setConfirmReplace(false)}>
                  Otkaži
                </button>
                <button className="btn btn-primary" type="button" onClick={() => void recognizeSpeech()}>
                  Zamijeni tekst
                </button>
              </div>
            </div>
          )}

          <details className="more">
            <summary>Napredno: jezik i model</summary>
            <div className="recognize-controls">
              <label className="field-inline">
                <span>Jezik govora</span>
                <select
                  className="select"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  disabled={busy}
                >
                  {LANGUAGES.map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-inline">
                <span>Model</span>
                <select
                  className="select"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  disabled={busy}
                >
                  {ASR_MODELS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label} ({onDevice[entry.id] ? 'na uređaju' : entry.size})
                    </option>
                  ))}
                </select>
              </label>

              <span className="hint recognize-note">
                {selectedModel.note}. Za bosanski probaj i Hrvatski, često bolje pogodi.
              </span>
            </div>
          </details>

          {asr && (
            <div className="field">
              <span className="label">
                {asr.label}
                <span className="value">{asr.phase === 'transcribe' ? '' : `${Math.round(asr.percent)} %`}</span>
              </span>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width:
                      asr.phase === 'transcribe' ? '100%' : `${Math.max(4, asr.percent)}%`,
                  }}
                />
              </div>
              <span className="hint">
                {modelReady
                  ? 'Model se učitava s uređaja. Zvuk i video ne napuštaju uređaj.'
                  : 'Model se skida samo ovaj put. Zvuk i video ne napuštaju uređaj.'}
              </span>
            </div>
          )}
        </section>

        <details className="more more-card" open={stats.words > 0}>
          <summary>Imam svoj tekst ili titlove</summary>

          <div className="field">
            <label className="label" htmlFor="caption-text">
              Tekst, svaki novi red je jedan red titla
              <span className="value">
                {stats.lines} {stats.lines === 1 ? 'red' : 'reda'} · {stats.words} riječi
              </span>
            </label>
            <textarea
              id="caption-text"
              className="textarea"
              value={text}
              spellCheck={false}
              placeholder={'Dobro jutro, ljudi.\nDanas pravimo burek\nod nule, bez žurbe.'}
              onChange={(event) => setText(event.target.value)}
            />
          </div>

          {lines.length > 0 && (
            <div className="line-preview">
              {lines.map((line, index) => (
                <div key={`${index}-${line}`}>
                  {index > 0 && <div className="line-divider" />}
                  <div className="line-row" style={{ marginTop: index > 0 ? 10 : 0 }}>
                    {splitWords(line).map((word, wordIndex) => (
                      <span className="word-chip" key={`${word}-${wordIndex}`}>
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {progress && (
            <div className="field">
              <span className="label">
                {progress.label}
                <span className="value">{Math.round(progress.value * 100)} %</span>
              </span>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress.value * 100}%` }} />
              </div>
              <span className="hint">Analiza radi u browseru. Video ne izlazi s uređaja.</span>
            </div>
          )}

          <div className="actions">
            <button
              className="btn btn-primary btn-lg"
              type="button"
              onClick={() => void startAuto()}
              disabled={busy || stats.words === 0}
            >
              Tempiraj moj tekst
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => captionInput.current?.click()}
              disabled={busy}
            >
              Uvezi SRT
            </button>
            <input
              ref={captionInput}
              type="file"
              accept=".srt,.vtt,text/plain"
              hidden
              onChange={(event) => void importCaptions(event.target.files?.[0])}
            />
            <div className="spacer" />
            {stats.words === 0 && <span className="hint">Upiši tekst ili uvezi SRT.</span>}
          </div>
        </details>
      </div>
    </main>
  );
}
