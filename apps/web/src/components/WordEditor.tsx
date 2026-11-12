import { useEffect, useRef, useState } from 'react';
import {
  flattenWords,
  deleteWord,
  mergeWithNext,
  setWordText,
  setWordTimes,
  shiftLine,
  shiftWord,
  type Line,
  type Project,
  type Word,
} from '@titlo/core';
import { formatSeconds } from '../lib/format.js';

interface Props {
  project: Project;
  word: Word;
  /** Trenutna pozicija videa, za "postavi ovdje". */
  timeMs: number;
  onChange: (project: Project) => void;
  onSeek: (ms: number) => void;
  onSelectWord: (id: string | null) => void;
}

const STEPS = [
  { ms: 50, label: '0,05 s' },
  { ms: 100, label: '0,1 s' },
  { ms: 250, label: '0,25 s' },
  { ms: 500, label: '0,5 s' },
  { ms: 1000, label: '1 s' },
];

function wordsOf(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

/**
 * Sve za jednu riječ na jednom mjestu: tekst se čuva dok kucaš, a vrijeme
 * se pomjera dugmadima u sekundama, bez preciznog povlačenja klizača.
 */
export default function WordEditor({ project, word, timeMs, onChange, onSeek, onSelectWord }: Props) {
  const [draft, setDraft] = useState(word.text);
  const [step, setStep] = useState(100);
  const original = useRef(word.text);

  // Nacrt se puni samo kad se izabere druga riječ, da kucanje ne preskače.
  useEffect(() => {
    setDraft(word.text);
    original.current = word.text;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id]);

  const lineIndex = project.lines.findIndex((line) => line.words.some((entry) => entry.id === word.id));

  const commitLines = (lines: Line[]) => onChange({ ...project, lines, updatedAt: Date.now() });

  const saveText = (value: string, allowSplit: boolean) => {
    const parts = wordsOf(value);
    if (parts.length === 0) return;
    if (parts.length === 1) {
      if (parts[0] !== word.text) commitLines(setWordText(project.lines, word.id, parts[0]!));
      return;
    }
    if (!allowSplit) return;
    // Više riječi: dijele vrijeme ove riječi. Izbor ostaje na prvoj od njih.
    const index = flattenWords(project.lines).findIndex((entry) => entry.word.id === word.id);
    const next = setWordText(project.lines, word.id, value);
    commitLines(next);
    onSelectWord(flattenWords(next)[index]?.word.id ?? null);
  };

  const move = (lines: Line[], seekTo?: 'start') => {
    commitLines(lines);
    if (seekTo) {
      const moved = flattenWords(lines).find((entry) => entry.word.id === word.id)?.word;
      if (moved) onSeek(moved.startMs);
    }
  };

  const duration = word.endMs - word.startMs;
  const multiple = wordsOf(draft).length > 1;

  const flat = flattenWords(project.lines);
  const flatIndex = flat.findIndex((entry) => entry.word.id === word.id);
  const nextWord = flat[flatIndex + 1]?.word ?? null;

  /** Ostale riječi ostaju gdje jesu; izbor prelazi na susjednu riječ. */
  const remove = () => {
    const neighbour = flat[flatIndex + 1]?.word ?? flat[flatIndex - 1]?.word ?? null;
    commitLines(deleteWord(project.lines, word.id));
    onSelectWord(neighbour?.id ?? null);
  };

  /** "N" + "amjenjena" = "Namjenjena", bez pomjeranja ostalih riječi. */
  const mergeNext = () => {
    if (!nextWord) return;
    const merged = `${word.text}${nextWord.text}`;
    commitLines(mergeWithNext(project.lines, word.id));
    setDraft(merged);
    original.current = merged;
  };

  return (
    <div className="word-editor">
      <div className="word-editor-text">
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            saveText(event.target.value, false);
          }}
          onBlur={() => saveText(draft, true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              saveText(draft, true);
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setDraft(original.current);
              saveText(original.current, true);
              event.currentTarget.blur();
            }
          }}
          aria-label="Tekst odabrane riječi"
          spellCheck={false}
        />
        {draft !== original.current && (
          <button
            className="btn btn-ghost"
            type="button"
            // Bez ovoga bi blur prvo spremio nacrt pa tek onda vratio.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setDraft(original.current);
              saveText(original.current, true);
            }}
          >
            Vrati
          </button>
        )}
      </div>
      <span className="hint">
        {multiple
          ? 'Više riječi: podijelit će vrijeme kad završiš kucanje.'
          : 'Čuva se dok kucaš.'}
      </span>

      <div className="word-actions">
        <button
          className="btn"
          type="button"
          disabled={!nextWord}
          onClick={mergeNext}
          title="Spoji ovu riječ sa sljedećom, bez razmaka"
        >
          Spoji sa „{nextWord ? nextWord.text : '…'}”
        </button>
        <button className="btn btn-danger" type="button" onClick={remove}>
          Obriši riječ
        </button>
      </div>

      <div className="word-times">
        <span>
          {formatSeconds(word.startMs)} – {formatSeconds(word.endMs)}
        </span>
        <span className="muted">traje {formatSeconds(duration)}</span>
      </div>

      <div className="segmented" role="group" aria-label="Korak pomjeranja">
        {STEPS.map((entry) => (
          <button
            key={entry.ms}
            type="button"
            className={`segment ${step === entry.ms ? 'is-active' : ''}`}
            onClick={() => setStep(entry.ms)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="nudge-grid">
        <span className="nudge-label">Riječ</span>
        <button className="btn" type="button" onClick={() => move(shiftWord(project.lines, word.id, -step), 'start')}>
          ◀ ranije
        </button>
        <button className="btn" type="button" onClick={() => move(shiftWord(project.lines, word.id, step), 'start')}>
          kasnije ▶
        </button>
        <span />

        <span className="nudge-label">Početak</span>
        <button
          className="btn"
          type="button"
          onClick={() => move(setWordTimes(project.lines, word.id, { startMs: word.startMs - step }), 'start')}
        >
          ◀
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => move(setWordTimes(project.lines, word.id, { startMs: word.startMs + step }), 'start')}
        >
          ▶
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          title="Postavi početak na trenutnu poziciju videa"
          onClick={() => move(setWordTimes(project.lines, word.id, { startMs: timeMs }))}
        >
          ovdje
        </button>

        <span className="nudge-label">Kraj</span>
        <button
          className="btn"
          type="button"
          onClick={() => move(setWordTimes(project.lines, word.id, { endMs: word.endMs - step }))}
        >
          ◀
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => move(setWordTimes(project.lines, word.id, { endMs: word.endMs + step }))}
        >
          ▶
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          title="Postavi kraj na trenutnu poziciju videa"
          onClick={() => move(setWordTimes(project.lines, word.id, { endMs: timeMs }))}
        >
          ovdje
        </button>

        {lineIndex >= 0 && (
          <>
            <span className="nudge-label">Cijeli red</span>
            <button
              className="btn"
              type="button"
              onClick={() => move(shiftLine(project.lines, lineIndex, -step), 'start')}
            >
              ◀ ranije
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => move(shiftLine(project.lines, lineIndex, step), 'start')}
            >
              kasnije ▶
            </button>
            <span />
          </>
        )}
      </div>
    </div>
  );
}
