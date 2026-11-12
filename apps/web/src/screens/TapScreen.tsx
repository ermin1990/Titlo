import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flattenWords, projectRange, TapSession, type Line } from '@titlo/core';
import { useApp } from '../store.js';
import { formatTimecode } from '../lib/format.js';

const SPEEDS = [0.5, 0.75, 1];

export default function TapScreen() {
  const project = useApp((state) => state.project);
  const videoUrl = useApp((state) => state.videoUrl);
  const setProject = useApp((state) => state.setProject);
  const setStep = useApp((state) => state.setStep);
  const showToast = useApp((state) => state.showToast);
  const tapStart = useApp((state) => state.tapStart);
  const tapReturnTo = useApp((state) => state.tapReturnTo);

  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<TapSession | null>(null);
  const finishedRef = useRef(false);
  const finishTimer = useRef<number | null>(null);
  const frameRef = useRef<number>(0);

  const [lines, setLines] = useState<Line[]>(project?.lines ?? []);
  const [cursor, setCursor] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [playing, setPlaying] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [timeMs, setTimeMs] = useState(0);
  const [hitKey, setHitKey] = useState(0);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.words.length, 0),
    [lines],
  );

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    const session = sessionRef.current;
    const current = useApp.getState().project;
    if (!session || !current) return;
    finishedRef.current = true;
    const finalLines = session.finish();
    setProject({ ...current, lines: finalLines });
    setStep(tapReturnTo);
  }, [setProject, setStep, tapReturnTo]);

  useEffect(() => {
    if (!project) {
      setStep('start');
      return;
    }
    const session = new TapSession(project.lines, projectRange(project), tapStart);
    sessionRef.current = session;
    setLines(session.lines);
    setCursor(session.cursor);
    const video = videoRef.current;
    if (video) {
      const startMs = session.current?.word.startMs ?? project.trim.startMs;
      video.currentTime = Math.max(project.trim.startMs, startMs) / 1000;
    }
    return () => {
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
      cancelAnimationFrame(frameRef.current);
      const element = videoRef.current;
      if (element) element.pause();
    };
  }, [project, setStep, tapStart]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    void video
      .play()
      .then(() => {
        setPlaying(true);
        setNeedsGesture(false);
      })
      .catch(() => {
        setNeedsGesture(true);
        setPlaying(false);
      });
  }, [speed]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = window.setTimeout(() => setCountdown((value) => value - 1), 900);
    return () => window.clearTimeout(id);
  }, [countdown]);

  useEffect(() => {
    if (countdown > 0) return;
    play();
  }, [countdown, play]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tick = () => {
      setTimeMs(Math.round(video.currentTime * 1000));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = speed;
  }, [speed]);

  const stopIndex = useMemo(() => {
    if (tapReturnTo !== 'edit') return total;
    const entries = flattenWords(lines);
    const start = entries[Math.min(tapStart, Math.max(0, entries.length - 1))];
    if (!start) return total;
    const nextLine = entries.find((entry) => entry.lineIndex === start.lineIndex + 1);
    return nextLine ? entries.indexOf(nextLine) : total;
  }, [lines, tapStart, tapReturnTo, total]);

  const onTap = useCallback(() => {
    const session = sessionRef.current;
    const video = videoRef.current;
    if (!session || !video || countdown > 0 || !playing) return;
    const result = session.tap(video.currentTime * 1000);
    if (result.outcome === 'ok') {
      setLines(result.lines);
      setCursor(result.cursor);
      setHitKey((value) => value + 1);
      navigator.vibrate?.(12);
      if (result.cursor >= stopIndex) {
        finishTimer.current = window.setTimeout(finish, 520);
      }
    } else if (result.outcome === 'done') {
      finish();
    }
  }, [countdown, playing, finish, stopIndex]);

  const undo = useCallback(() => {
    const session = sessionRef.current;
    const video = videoRef.current;
    if (!session) return;
    const result = session.undo();
    if (!result) return;
    setLines(result.lines);
    setCursor(result.cursor);
    if (video) video.currentTime = result.seekMs / 1000;
  }, []);

  const repeatLine = useCallback(() => {
    const session = sessionRef.current;
    const video = videoRef.current;
    if (!session) return;
    const result = session.repeatLine();
    if (!result) return;
    setLines(result.lines);
    setCursor(session.cursor);
    if (video) video.currentTime = result.seekMs / 1000;
  }, []);

  const skip = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    setLines(session.skip());
    setCursor(session.cursor);
  }, []);

  const togglePause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) play();
    else {
      video.pause();
      setPlaying(false);
    }
  }, [play]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
      if (event.code === 'Space') {
        event.preventDefault();
        onTap();
      } else if (event.key === 'k' || event.key === 'K') {
        togglePause();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        undo();
      } else if (event.key === 'ArrowLeft') {
        repeatLine();
      } else if (event.key === 'ArrowRight') {
        skip();
      } else if (event.key === '1') setSpeed(0.5);
      else if (event.key === '2') setSpeed(0.75);
      else if (event.key === '3') setSpeed(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onTap, togglePause, undo, repeatLine, skip]);

  if (!project) return null;

  const flat = flattenWords(lines);
  const index = Math.min(cursor, Math.max(0, flat.length - 1));
  const current = flat[index];
  const lineIndex = current?.lineIndex ?? 0;
  const currentLine = lines[lineIndex];
  const nextLine = lines[lineIndex + 1];
  const lineStartGlobal = flat.findIndex((entry) => entry.lineIndex === lineIndex);
  const panning = videoRef.current?.paused ? 'Pauza' : 'Pauza';

  void panning;

  return (
    <main className="shell shell-narrow">
      <div className="tap-screen">
        <div className="tap-top">
          <button
            className="btn btn-icon btn-ghost"
            type="button"
            title="Natrag na tekst"
            onClick={() => {
              if (window.confirm('Prekinuti tapkanje? Vremena iz ove sesije se ne čuvaju.')) {
                setStep('text');
              }
            }}
          >
            ✕
          </button>
          <div className="speed-pills" role="group" aria-label="Brzina puštanja">
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                className={`speed-pill ${speed === value ? 'is-active' : ''}`}
                onClick={() => setSpeed(value)}
              >
                {value}×
              </button>
            ))}
          </div>
        </div>

        <div className="tap-progress">
          <span>
            {Math.min(cursor + 1, total)} / {total}
          </span>
          <div className="progress-track" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${(cursor / Math.max(1, total)) * 100}%` }} />
          </div>
          <span>{formatTimecode(timeMs)}</span>
        </div>

        <div className="tap-video">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            src={videoUrl ?? undefined}
            playsInline
            preload="auto"
            onEnded={finish}
            onClick={togglePause}
          />
          {countdown > 0 && <div className="countdown">{countdown}</div>}
          {needsGesture && (
            <button className="countdown" type="button" onClick={play} style={{ border: 0 }}>
              ▶
            </button>
          )}
        </div>

        <div className="tap-lines">
          <div className="tap-line" aria-live="polite">
            {currentLine?.words.map((word, wordIndex) => {
              const global = lineStartGlobal + wordIndex;
              const state = global < cursor ? 'is-done' : global === cursor ? 'is-next' : 'is-future';
              return (
                <span className={`w ${state}`} key={word.id}>
                  {word.text}
                </span>
              );
            })}
          </div>
          {nextLine && (
            <div className="tap-next-line">
              {nextLine.words.map((word) => word.text).join(' ')}
            </div>
          )}
        </div>

        <button
          className="tap-zone"
          type="button"
          onClick={onTap}
          aria-label="Tapni za sljedeću riječ"
          style={{ borderColor: hitKey % 2 === 0 ? undefined : 'rgba(255,225,74,0.85)' }}
        >
          <span className="tap-zone-title" key={hitKey} style={{ animation: 'pulse 0.22s ease' }}>
            TAPNI
          </span>
          <span className="tap-zone-sub">kad čuješ sljedeću riječ</span>
        </button>

        <div className="tap-controls">
          <button className="btn" type="button" onClick={undo}>
            ⟲ Poništi
          </button>
          <button className="btn" type="button" onClick={skip}>
            ⇥ Preskoči
          </button>
          <button className="btn" type="button" onClick={togglePause}>
            {playing ? '❚❚ Pauza' : '▶ Pusti'}
          </button>
          <button className="btn" type="button" onClick={repeatLine}>
            ↺ Ponovi red
          </button>
        </div>

        <p className="kbd-hint">
          <kbd>Space</kbd> tap · <kbd>K</kbd> pauza · <kbd>⌫</kbd> poništi · <kbd>←</kbd> ponovi red ·{' '}
          <kbd>→</kbd> preskoči · <kbd>1</kbd>
          <kbd>2</kbd>
          <kbd>3</kbd> brzina
        </p>
      </div>
    </main>
  );
}
