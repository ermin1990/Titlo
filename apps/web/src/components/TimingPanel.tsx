import {
  flattenWords,
  MIN_WORD_MS,
  nudgeWord,
  setWordTimes,
  type Line,
  type Project,
  type TimeSource,
} from '@titlo/core';
import { formatSeconds } from '../lib/format.js';

const NUDGE_MS = 100;

interface Props {
  project: Project;
  onChange: (project: Project) => void;
  selectedWordId: string | null;
  onSelectWord: (id: string) => void;
  onSeek: (ms: number) => void;
}

const SOURCE_LABEL: Record<TimeSource, string> = {
  tap: 'Tapnuto',
  auto: 'Automatika',
  spread: 'Raspoređeno',
  aligned: 'Poravnato',
  manual: 'Ručno',
};

export default function TimingPanel({ project, onChange, selectedWordId, onSelectWord, onSeek }: Props) {
  const line: Line | undefined =
    project.lines.find((entry) => entry.words.some((word) => word.id === selectedWordId)) ??
    project.lines[0];

  if (!line) {
    return <p className="hint">Nema riječi. Vrati se na tekst i zalijepi govor.</p>;
  }

  const duration = project.media.durationMs;
  const update = (lines: Line[]) => onChange({ ...project, lines, updatedAt: Date.now() });

  return (
    <div className="tab-body">
      <div className="field">
        <span className="label">
          Globalni pomak
          <span className="value">{project.offsetMs > 0 ? '+' : ''}{project.offsetMs} ms</span>
        </span>
        <input
          className="slider"
          type="range"
          min={-500}
          max={500}
          step={10}
          value={project.offsetMs}
          onChange={(event) =>
            onChange({ ...project, offsetMs: Number(event.target.value), updatedAt: Date.now() })
          }
        />
        <span className="hint">
          Pomjera sve titlove, bez mijenjanja vremena riječi. Za Bluetooth slušalice koje kasne.
        </span>
      </div>

      <div className="field">
        <span className="label">
          Red {project.lines.indexOf(line) + 1} / {project.lines.length}
          <span className="value">{line.words.length} riječi</span>
        </span>
        {line.words.map((word) => {
          const start = Math.max(0, Math.min(word.startMs, duration));
          const end = Math.max(start + 1, Math.min(word.endMs, duration));
          // Klizač pokriva samo prostor do susjednih riječi, pa je precizan i na telefonu.
          const flat = flattenWords(project.lines);
          const at = flat.findIndex((entry) => entry.word.id === word.id);
          const prevEnd = at > 0 ? flat[at - 1]!.word.endMs : Math.max(0, start - 2000);
          const nextStart = at < flat.length - 1 ? flat[at + 1]!.word.startMs : Math.min(duration, end + 2000);
          const startMin = Math.min(prevEnd, start);
          const startMax = Math.max(start, end - MIN_WORD_MS);
          const endMin = Math.min(end, start + MIN_WORD_MS);
          const endMax = Math.max(end, nextStart);
          return (
            <div
              key={word.id}
              className={`word-timing ${selectedWordId === word.id ? 'is-selected' : ''}`}
              onClick={() => {
                onSelectWord(word.id);
                onSeek(word.startMs);
              }}
            >
              <div className="word-timing-head">
                <strong>{word.text}</strong>
                <span className={`badge b-${word.source}`}>{SOURCE_LABEL[word.source]}</span>
              </div>

              <label className="label">
                početak
                <span className="value">{formatSeconds(start)}</span>
              </label>
              <input
                className="slider"
                type="range"
                min={startMin}
                max={startMax}
                step={10}
                value={start}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  onSelectWord(word.id);
                  update(setWordTimes(project.lines, word.id, { startMs: Number(event.target.value) }));
                }}
              />

              <label className="label">
                kraj
                <span className="value">{formatSeconds(end)}</span>
              </label>
              <input
                className="slider"
                type="range"
                min={endMin}
                max={endMax}
                step={10}
                value={end}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  onSelectWord(word.id);
                  update(setWordTimes(project.lines, word.id, { endMs: Number(event.target.value) }));
                }}
              />

              <div className="nudge-row">
                <button
                  className="btn"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    update(nudgeWord(project.lines, word.id, 'start', -NUDGE_MS));
                  }}
                >
                  ◀ 0,1 s
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    update(nudgeWord(project.lines, word.id, 'start', NUDGE_MS));
                  }}
                >
                  0,1 s ▶
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    update(nudgeWord(project.lines, word.id, 'end', -NUDGE_MS));
                  }}
                >
                  ◀ 0,1 s
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    update(nudgeWord(project.lines, word.id, 'end', NUDGE_MS));
                  }}
                >
                  0,1 s ▶
                </button>
                <span className="time-read">{formatSeconds(end - start)}</span>
              </div>
            </div>
          );
        })}
        <span className="hint">Ivice se zaustavljaju na susjednoj riječi, pa preklapanje nije moguće.</span>
      </div>
    </div>
  );
}
