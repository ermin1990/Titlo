import { nudgeWord, setWordTimes, type Line, type Project, type TimeSource } from '@titlo/core';
import { formatMs } from '../lib/format.js';

interface Props {
  project: Project;
  onChange: (project: Project) => void;
  selectedWordId: string | null;
  onSelectWord: (id: string) => void;
  onSeek: (ms: number) => void;
  onRetapLine: (lineIndex: number) => void;
}

const SOURCE_LABEL: Record<TimeSource, string> = {
  tap: 'Tapnuto',
  auto: 'Automatika',
  spread: 'Raspoređeno',
  aligned: 'Poravnato',
  manual: 'Ručno',
};

export default function TimingPanel({ project, onChange, selectedWordId, onSelectWord, onSeek, onRetapLine }: Props) {
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
      <button
        className="btn"
        type="button"
        onClick={() => onRetapLine(project.lines.indexOf(line))}
      >
        ↺ Tapkaj samo ovaj red
      </button>

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
                <span className="value">{formatMs(start)}</span>
              </label>
              <input
                className="slider"
                type="range"
                min={0}
                max={duration}
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
                <span className="value">{formatMs(end)}</span>
              </label>
              <input
                className="slider"
                type="range"
                min={0}
                max={duration}
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
                    update(nudgeWord(project.lines, word.id, 'start', -10));
                  }}
                >
                  ◀ 10
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    update(nudgeWord(project.lines, word.id, 'start', 10));
                  }}
                >
                  10 ▶
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    update(nudgeWord(project.lines, word.id, 'end', -10));
                  }}
                >
                  ◀ 10
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    update(nudgeWord(project.lines, word.id, 'end', 10));
                  }}
                >
                  10 ▶
                </button>
                <span className="time-read">{formatMs(end - start)}</span>
              </div>
            </div>
          );
        })}
        <span className="hint">Ivice se zaustavljaju na susjednoj riječi, pa preklapanje nije moguće.</span>
      </div>
    </div>
  );
}
