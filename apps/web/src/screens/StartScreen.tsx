import { useRef, useState } from 'react';
import { countWords, textStats } from '@titlo/core';
import { useApp } from '../store.js';
import { probeVideo } from '../lib/video.js';
import { canExportVideo } from '../lib/export-video.js';

export default function StartScreen() {
  const setVideoFile = useApp((state) => state.setVideoFile);
  const setStep = useApp((state) => state.setStep);
  const showToast = useApp((state) => state.showToast);
  const savedText = useApp((state) => state.text);
  const savedProject = useApp((state) => state.savedProject);
  const resumeProject = useApp((state) => state.resumeProject);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [mismatch, setMismatch] = useState<{ file: File; loaded: Awaited<ReturnType<typeof probeVideo>> } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resumeInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) {
      showToast('Izaberi video fajl (MP4, MOV ili WebM).');
      return;
    }
    setBusy(true);
    try {
      const loaded = await probeVideo(file);
      setVideoFile(file, loaded.url, loaded.media);
      setStep('text');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Video ne može da se otvori.');
    } finally {
      setBusy(false);
    }
  }

  async function resume(file: File | undefined) {
    if (!file || !savedProject) return;
    setBusy(true);
    try {
      const loaded = await probeVideo(file);
      if (Math.abs(loaded.media.durationMs - savedProject.media.durationMs) > 1500) {
        setMismatch({ file, loaded });
        return;
      }
      resumeProject(file, loaded);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Video ne može da se otvori.');
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    setBusy(true);
    try {
      const response = await fetch('/sample-burek.mp4');
      if (!response.ok) throw new Error('Primjer nije dostupan.');
      const blob = await response.blob();
      const file = new File([blob], 'burek-od-nule.mp4', { type: 'video/mp4' });
      await handleFile(file);
      useApp
        .getState()
        .setText(
          'Dobro jutro, ljudi.\nDanas pravimo burek\nod nule, bez žurbe.\nPrvo zamijesimo tijesto, pa ga ostavimo da odmori.',
        );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Primjer nije dostupan.');
    } finally {
      setBusy(false);
    }
  }

  const stats = textStats(savedText);

  return (
    <main className="shell">
      <div className="start">
        <div className="hero">
          <span className="eyebrow">open source · bez servera</span>
          <h1>
            Titlovi u ritmu.
            <br />
            <em>Riječ po riječ.</em>
          </h1>
          <p>
            Ubaci video, prepoznaj govor i popravi riječ ako treba. Titlovi se tempiraju sami, a sve
            ostaje na uređaju.
          </p>
        </div>

        <div className="hero-grid">
          {savedProject && (
            <div className="resume-card" style={{ gridColumn: '1 / -1' }}>
              <div>
                <span className="eyebrow">sačuvano na uređaju</span>
                <strong>Nastavi: {savedProject.media.name}</strong>
                <span className="hint">
                  {savedProject.lines.length} redova · {countWords(savedProject)} riječi ·{' '}
                  {savedProject.style.id.split('/')[1]}
                </span>
              </div>
              <input
                ref={resumeInput}
                type="file"
                accept="video/*,.mp4,.mov,.webm"
                hidden
                onChange={(event) => void resume(event.target.files?.[0])}
              />
              <button
                className="btn"
                type="button"
                onClick={() => resumeInput.current?.click()}
              >
                Uvezi isti video
              </button>
            </div>
          )}

          {savedProject && mismatch && (
            <div className="confirm-row" style={{ gridColumn: '1 / -1' }}>
              <span>
                Trajanje videa se ne poklapa sa sačuvanim projektom. Vremena riječi možda neće
                odgovarati.
              </span>
              <div className="actions">
                <button className="btn" type="button" onClick={() => setMismatch(null)}>
                  Otkaži
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => {
                    resumeProject(mismatch.file, mismatch.loaded);
                    setMismatch(null);
                  }}
                >
                  Nastavi ipak
                </button>
              </div>
            </div>
          )}

          <div
            className={`dropzone ${over ? 'is-over' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(false);
              void handleFile(event.dataTransfer.files[0]);
            }}
          >
            <label className="dropzone-pick" htmlFor="video-input">
              <h2>{busy ? 'Otvaram video…' : 'Ubaci video'}</h2>
              <p>
                Prevuci fajl ovdje ili klikni. MP4 (H.264) radi svuda. Video se ne kopira i ne
                uploaduje nigdje.
              </p>
              <span className="btn btn-primary btn-lg" aria-hidden="true">
                Izaberi video
              </span>
              <div className="note-row">
                <span>9:16 · 1:1 · 4:5 · 16:9</span>
                <span>do 10 minuta</span>
              </div>
            </label>
            <input
              id="video-input"
              ref={inputRef}
              type="file"
              accept="video/*,.mp4,.mov,.webm"
              hidden
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <button className="btn btn-ghost" type="button" onClick={() => void loadSample()}>
              Isprobaj s primjerom ›
            </button>
            <span className="hint">
              Izvoz videa na ovom uređaju: {canExportVideo() ? 'podržan' : 'nije podržan'}
            </span>
          </div>

          <aside className="feature-list">
            <div className="feature">
              <span className="num">01</span>
              <div>
                <strong>Prepoznaj govor</strong>
                Model radi na uređaju i piše tekst s vremenom svake riječi. Bez naloga i servera.
              </div>
            </div>
            <div className="feature">
              <span className="num">02</span>
              <div>
                <strong>Popravi što ne valja</strong>
                Klikni riječ, ispravi je ili pomjeri vrijeme. Ostalo ostaje kako jest.
              </div>
            </div>
            <div className="feature">
              <span className="num">03</span>
              <div>
                <strong>Efekti su fajlovi</strong>
                Stilovi i filteri su mali JSON i shader fajlovi koje zajednica može dodati.
              </div>
            </div>
            {stats.words > 0 && (
              <div className="feature">
                <span className="num">↩</span>
                <div>
                  <strong>Sačuvan tekst</strong>
                  {stats.lines} {stats.lines === 1 ? 'red' : 'reda'} · {stats.words} riječi čeka
                  novi video.
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
