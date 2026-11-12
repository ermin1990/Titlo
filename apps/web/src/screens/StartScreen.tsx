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
        const ok = window.confirm(
          'Trajanje izabranog videa se ne poklapa sa sačuvanim projektom. Nastaviti ipak?',
        );
        if (!ok) return;
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
            Zalijepi tekst, pusti video i tapni. Ako pogriješiš, automatika predloži vrijeme, a ti
            popraviš samo ono što ne valja. Sve ostaje na uređaju.
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
                <strong>Tapkanje uvijek radi</strong>
                Bez interneta, bez naloga, bez modela. Radi za svaki jezik i svaki sadržaj.
              </div>
            </div>
            <div className="feature">
              <span className="num">02</span>
              <div>
                <strong>Automatika predloži</strong>
                Analiza govora na uređaju popuni vremena, a ti popraviš samo pogrešne riječi.
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
