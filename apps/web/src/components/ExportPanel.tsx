import { useState } from 'react';
import { toLrc, toPortableProject, toSrt, toVtt, type Project } from '@titlo/core';
import { filterById, styleById } from '@titlo/plugins';
import { downloadText, safeBaseName, saveBlob } from '../lib/format.js';
import { resolveStyle } from '../lib/animations.js';
import {
  canExportVideo,
  exportVideo,
  type ExportProgress,
} from '../lib/export-video.js';

interface Props {
  project: Project;
  videoUrl: string | null;
  getCanvas: () => HTMLCanvasElement | null;
  onToast: (message: string) => void;
}

export default function ExportPanel({ project, videoUrl, getCanvas, onToast }: Props) {
  const [exporting, setExporting] = useState<ExportProgress | null>(null);
  const [lastMessage, setLastMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(
    null,
  );
  const base = safeBaseName(project.media.name);
  const supported = canExportVideo();

  const save = async (action: () => Promise<void>, success: string) => {
    try {
      await action();
      onToast(success);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Izvoz nije uspio.');
    }
  };

  const saveProject = () =>
    save(
      () =>
        downloadText(
          `${base}.titlo.json`,
          JSON.stringify(toPortableProject(project), null, 2),
          'application/json',
        ),
      'Projekat sačuvan. Video se ne kopira.',
    );

  const saveFrame = () =>
    save(async () => {
      const canvas = getCanvas();
      if (!canvas) throw new Error('Pregled nije spreman.');
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((value) => resolve(value), 'image/png'),
      );
      if (!blob) throw new Error('Kadar nije sačuvan.');
      await saveBlob(`${base}-kadar.png`, blob);
    }, 'Kadar sačuvan kao PNG.');

  const copySrt = async () => {
    try {
      await navigator.clipboard.writeText(toSrt(project.lines, project.offsetMs));
      onToast('SRT kopiran u clipboard.');
    } catch {
      onToast('Clipboard nije dozvoljen. Preuzmi fajl.');
    }
  };

  const saveCaptions = (format: 'srt' | 'vtt' | 'lrc') =>
    save(
      () =>
        downloadText(
          `${base}.${format}`,
          format === 'srt'
            ? toSrt(project.lines, project.offsetMs)
            : format === 'vtt'
              ? toVtt(project.lines, project.offsetMs)
              : toLrc(project.lines, project.offsetMs),
          format === 'vtt' ? 'text/vtt' : 'text/plain',
        ),
      `${format.toUpperCase()} sačuvan.`,
    );

  const exportMp4 = async () => {
    if (!videoUrl) {
      const message = 'Video nije dostupan. Ponovo uvezi fajl.';
      setLastMessage({ type: 'error', text: message });
      onToast(message);
      return;
    }
    setLastMessage(null);
    setExporting({ phase: 'prepare', value: 0, label: 'Pripremam izvoz…' });
    try {
      const style = resolveStyle(styleById(project.style.id), project);
      const filter = project.filter ? filterById(project.filter.id) : null;
      const intensity =
        typeof project.filter?.params.intensity === 'number' ? project.filter.params.intensity : 0.7;

      const result = await exportVideo({
        project,
        style,
        filterCss: filter?.webPreview.css ?? null,
        filterIntensity: intensity,
        videoUrl,
        onProgress: setExporting,
      });

      await saveBlob(`${base}.mp4`, result.blob);
      const summary = `Video sačuvan: ${result.width}×${result.height}, ${(
        result.blob.size /
        1024 /
        1024
      ).toFixed(1)} MB${result.hasAudio ? '' : ' (bez zvuka)'}.`;
      setLastMessage({ type: 'ok', text: summary });
      onToast(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Izvoz videa nije uspio.';
      setLastMessage({ type: 'error', text: message });
      onToast(message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="tab-body">
      <div className="field">
        <span className="label">
          Video
          <span className="value">
            {project.media.width}×{project.media.height}
          </span>
        </span>

        {supported ? (
          <>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void exportMp4()}
              disabled={exporting !== null}
            >
              {exporting ? 'Izvozim…' : 'Izvezi MP4 sa titlovima'}
            </button>
            {exporting ? (
              <div className="field" style={{ gap: 6 }}>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.max(2, Math.min(100, exporting.value))}%` }}
                  />
                </div>
                <span className="hint">{exporting.label}</span>
                <span className="hint">
                  Izvoz ide u realnom vremenu: koliko traje video, toliko traje kodiranje. Ne
                  zatvaraj aplikaciju.
                </span>
              </div>
            ) : (
              <span className="hint">
                1080p H.264 sa zvukom, titlovima i filterom. Isti renderer kao pregled.
              </span>
            )}
          </>
        ) : (
          <div className="disabled-note">
            Ovaj WebView nema WebCodecs, pa ne može da kodira video. Ažuriraj Android System
            WebView ili otvori aplikaciju u Chromeu. SRT/VTT izvoz i PNG kadar rade i dalje.
          </div>
        )}

        <button className="btn btn-ghost" type="button" onClick={() => void saveFrame()}>
          Snimi kadar kao PNG
        </button>

        {lastMessage && (
          <div className={lastMessage.type === 'error' ? 'disabled-note' : 'hint'}>
            {lastMessage.text}
          </div>
        )}
      </div>

      <div className="field">
        <span className="label">
          Titlovi
          <span className="value">{project.lines.length} redova</span>
        </span>
        <div className="export-row">
          <button className="btn" type="button" onClick={() => void saveCaptions('srt')}>
            SRT
          </button>
          <button className="btn" type="button" onClick={() => void saveCaptions('vtt')}>
            VTT
          </button>
          <button className="btn" type="button" onClick={() => void saveCaptions('lrc')}>
            LRC
          </button>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => void copySrt()}>
          Kopiraj SRT
        </button>
      </div>

      <div className="field">
        <span className="label">Projekat</span>
        <button className="btn" type="button" onClick={() => void saveProject()}>
          Sačuvaj .titlo.json
        </button>
        <span className="hint">
          Fajl je čitljiv JSON. Ne sadrži video, samo tekst, vremena, stil i filter.
        </span>
      </div>

      <div className="field">
        <span className="label">
          Sažetak
          <span className="value mono">
            {project.offsetMs > 0 ? '+' : ''}
            {project.offsetMs} ms
          </span>
        </span>
        <span className="hint">
          {project.lines.reduce((sum, line) => sum + line.words.length, 0)} riječi · stil{' '}
          {project.style.id.split('/')[1]} ·{' '}
          {project.filter ? project.filter.id.split('/')[1] : 'bez filtera'}
        </span>
      </div>
    </div>
  );
}
