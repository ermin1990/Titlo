import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  flattenWords,
  lineAtTime,
  wordAtTime,
  type Project,
  type TimeSource,
} from '@titlo/core';
import { filterById, styleById } from '@titlo/plugins';
import { useApp } from '../store.js';
import { resolveStyle } from '../lib/animations.js';
import { fitRect, renderFrame } from '../lib/render.js';
import { formatTimecode } from '../lib/format.js';
import TimingPanel from '../components/TimingPanel.js';
import StylePanel from '../components/StylePanel.js';
import FilterPanel from '../components/FilterPanel.js';
import TextPanel from '../components/TextPanel.js';
import ExportPanel from '../components/ExportPanel.js';
import WordEditor from '../components/WordEditor.js';

type Tab = 'time' | 'style' | 'filter' | 'text' | 'export';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'time', label: 'Vrijeme' },
  { id: 'style', label: 'Stil' },
  { id: 'filter', label: 'Filter' },
  { id: 'text', label: 'Tekst' },
  { id: 'export', label: 'Izvoz' },
];

const SPEEDS = [0.5, 0.75, 1, 1.5];

const SOURCE_TITLE: Record<TimeSource, string> = {
  tap: 'tapnuto',
  auto: 'automatika',
  spread: 'raspoređeno',
  aligned: 'poravnato',
  manual: 'ručno',
};

export default function EditScreen() {
  const project = useApp((state) => state.project);
  if (!project) return null;
  return <Editor project={project} />;
}

function Editor({ project }: { project: Project }) {
  const setProject = useApp((state) => state.setProject);
  const setStep = useApp((state) => state.setStep);
  const showToast = useApp((state) => state.showToast);
  const videoUrl = useApp((state) => state.videoUrl);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const lastUiTick = useRef(0);

  const [tab, setTab] = useState<Tab>('time');
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(project.trim.startMs);
  const [speed, setSpeed] = useState(1);
  const [safeZones, setSafeZones] = useState(true);
  const [showBox, setShowBox] = useState(true);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const style = useMemo(() => resolveStyle(styleById(project.style.id), project), [project]);
  const filter = useMemo(
    () => (project.filter ? filterById(project.filter.id) : null),
    [project.filter],
  );
  const filterIntensity =
    typeof project.filter?.params.intensity === 'number' ? project.filter.params.intensity : 0.7;

  const activeWord = useMemo(() => wordAtTime(project.lines, timeMs), [project.lines, timeMs]);
  const activeLine = useMemo(() => lineAtTime(project.lines, timeMs), [project.lines, timeMs]);
  const flat = useMemo(() => flattenWords(project.lines), [project.lines]);
  const wordCount = flat.length;
  const selectedWord = useMemo(
    () => flat.find((entry) => entry.word.id === selectedWordId)?.word ?? null,
    [flat, selectedWordId],
  );

  const dataRef = useRef({
    project,
    style,
    filterCss: filter?.webPreview.css ?? null,
    intensity: filterIntensity,
    safeZones,
    showBox,
    fallbackTime: timeMs,
  });

  useEffect(() => {
    dataRef.current = {
      project,
      style,
      filterCss: filter?.webPreview.css ?? null,
      intensity: filterIntensity,
      safeZones,
      showBox,
      fallbackTime: timeMs,
    };
  });

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const container = frameRef.current;
      const video = videoRef.current;
      if (canvas && container) {
        const ctx = canvas.getContext('2d');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);
        if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
          canvas.width = Math.round(width * dpr);
          canvas.height = Math.round(height * dpr);
        }
        if (ctx) {
          const data = dataRef.current;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const current =
            video && video.readyState >= 1 ? Math.round(video.currentTime * 1000) : data.fallbackTime;
          renderFrame({
            ctx,
            width,
            height,
            video,
            project: data.project,
            style: data.style,
            filterCss: data.filterCss,
            filterIntensity: data.intensity,
            timeMs: current,
            showSafeZones: data.safeZones,
            showBox: data.showBox,
          });
          const now = Date.now();
          if (now - lastUiTick.current > 90) {
            lastUiTick.current = now;
            setTimeMs(current);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const id = activeWord?.id;
    if (!id || !stripRef.current) return;
    const element = stripRef.current.querySelector<HTMLElement>(`[data-word="${id}"]`);
    element?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [activeWord?.id]);

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const container = frameRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const ratio = project.media.height ? project.media.width / project.media.height : 9 / 16;
    const video = fitRect(bounds.width, bounds.height, ratio);
    const px = event.clientX - bounds.left;
    const py = event.clientY - bounds.top;
    const centerX = video.x + project.captionBox.x * video.w;
    const centerY = video.y + project.captionBox.y * video.h;
    const halfWidth = (project.captionBox.width * video.w) / 2;
    const halfHeight = Math.max(28, video.h * 0.09);
    if (Math.abs(px - centerX) > halfWidth || Math.abs(py - centerY) > halfHeight) return;

    dragRef.current = { dx: px - centerX, dy: py - centerY };
    setDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* sintetički događaji nemaju pravi pointer */
    }
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const container = frameRef.current;
    if (!drag || !container) return;
    const bounds = container.getBoundingClientRect();
    const ratio = project.media.height ? project.media.width / project.media.height : 9 / 16;
    const video = fitRect(bounds.width, bounds.height, ratio);
    const px = event.clientX - bounds.left - drag.dx;
    const py = event.clientY - bounds.top - drag.dy;
    const x = Math.min(0.95, Math.max(0.05, (px - video.x) / video.w));
    const y = Math.min(0.95, Math.max(0.05, (py - video.y) / video.h));
    setProject({
      ...project,
      captionBox: { ...project.captionBox, x, y },
      updatedAt: Date.now(),
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    setDragging(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* ignore */
    }
  };

  const seek = useCallback((ms: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.max(0, ms) / 1000;
    setTimeMs(Math.max(0, Math.round(ms)));
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const onLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = project.trim.startMs / 1000;
    setTimeMs(project.trim.startMs);
  };

  const duration = project.media.durationMs;

  return (
    <main className="shell">
      <div className="editor">
        <div className="editor-top">
          <button
            className="btn btn-icon btn-ghost"
            type="button"
            title="Nazad na početak"
            onClick={() => {
              setStep('start');
              showToast('Projekat je sačuvan na uređaju.');
            }}
          >
            ←
          </button>
          <div className="editor-title">
            <strong>{project.media.name}</strong>
            <span>
              {formatTimecode(duration)} · {project.lines.length} redova · {wordCount} riječi
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" type="button" onClick={() => setTab('export')}>
            Izvezi
          </button>
        </div>

        <div className="editor-grid">
          <aside className="panel text-panel">
            <div className="panel-title">
              Tekst
              <span className="mono">{project.lines.length}</span>
            </div>
            <div className="text-list">
              {project.lines.map((line) => {
                const first = line.words[0];
                return (
                  <button
                    key={line.id}
                    type="button"
                    className={`text-line ${activeLine?.id === line.id ? 'is-active' : ''}`}
                    onClick={() => {
                      if (!first) return;
                      seek(first.startMs);
                      setSelectedWordId(first.id);
                    }}
                  >
                    <span className="t">{first ? formatTimecode(first.startMs) : '—'}</span>
                    <span>{line.words.map((word) => word.text).join(' ')}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="preview-panel">
            <div className={`canvas-frame ${dragging ? 'is-dragging' : ''}`} ref={frameRef}>
              <canvas
                ref={canvasRef}
                aria-label="Pregled videa sa titlovima"
                onPointerDown={onCanvasPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
              <video
                ref={videoRef}
                src={videoUrl ?? project.media.uri ?? undefined}
                playsInline
                preload="auto"
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                onLoadedMetadata={onLoaded}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              />
            </div>

            <div className="transport">
              <button className="play-btn" type="button" onClick={togglePlay} aria-label={playing ? 'Pauza' : 'Pusti'}>
                {playing ? '❚❚' : '▶'}
              </button>
              <span className="timecode">
                {formatTimecode(timeMs)} / {formatTimecode(duration)}
              </span>
              <input
                className="scrub"
                type="range"
                min={0}
                max={duration}
                step={10}
                value={Math.min(timeMs, duration)}
                onChange={(event) => seek(Number(event.target.value))}
                aria-label="Pozicija videa"
              />
              <div className="mini-pills">
                {SPEEDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`mini-pill ${speed === value ? 'is-active' : ''}`}
                    onClick={() => setSpeed(value)}
                  >
                    {value}×
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`mini-pill ${safeZones ? 'is-active' : ''}`}
                title="Prikaži dio ekrana koji aplikacije poput TikToka i Instagrama prekrivaju"
                onClick={() => setSafeZones((value) => !value)}
                style={{ border: '1px solid var(--line-soft)' }}
              >
                sigurna zona
              </button>
              <button
                type="button"
                className={`mini-pill ${showBox ? 'is-active' : ''}`}
                title="Prikaži okvir u kojem stoji titl"
                onClick={() => setShowBox((value) => !value)}
                style={{ border: '1px solid var(--line-soft)' }}
              >
                okvir titla
              </button>
            </div>

            <div className="wordstrip" ref={stripRef}>
              {flat.map(({ word }) => (
                <button
                  key={word.id}
                  type="button"
                  data-word={word.id}
                  className={`strip-word src-${word.source} ${activeWord?.id === word.id ? 'is-active' : ''}`}
                  title={`${SOURCE_TITLE[word.source]} · ${Math.round(word.startMs)}–${Math.round(word.endMs)} ms`}
                  onClick={() => {
                    seek(word.startMs);
                    setSelectedWordId(word.id);
                  }}
                >
                  {word.text}
                </button>
              ))}
            </div>

            {selectedWord ? (
              <WordEditor
                project={project}
                word={selectedWord}
                timeMs={timeMs}
                onChange={setProject}
                onSeek={seek}
                onSelectWord={setSelectedWordId}
              />
            ) : (
              <p className="hint">
                Dodirni riječ iznad da je ispraviš ili pomjeriš. Prevuci titl u pregledu da
                promijeniš poziciju.
              </p>
            )}

            <div className="legend">
              <span>
                <i style={{ background: '#7cb8ff' }} /> automatski
              </span>
              <span>
                <i style={{ border: '1px dashed #7d7c76', background: 'transparent' }} /> raspoređeno
              </span>
              <span>
                <i style={{ background: '#c4a7ff' }} /> ručno
              </span>
            </div>
          </section>

          <aside className="inspector">
            <div className="tabs" role="tablist">
              {TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === entry.id}
                  className={`tab ${tab === entry.id ? 'is-active' : ''}`}
                  onClick={() => setTab(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="panel" style={{ padding: 12 }}>
              {tab === 'time' && (
                <TimingPanel
                  project={project}
                  onChange={setProject}
                  selectedWordId={selectedWordId ?? activeWord?.id ?? null}
                  onSelectWord={setSelectedWordId}
                  onSeek={seek}
                />
              )}
              {tab === 'style' && <StylePanel project={project} onChange={setProject} />}
              {tab === 'filter' && <FilterPanel project={project} onChange={setProject} />}
              {tab === 'text' && (
                <TextPanel project={project} onChange={setProject} onToast={showToast} />
              )}
              {tab === 'export' && (
                <ExportPanel
                  project={project}
                  videoUrl={videoUrl ?? project.media.uri ?? null}
                  getCanvas={() => canvasRef.current}
                  onToast={showToast}
                />
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
