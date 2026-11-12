import type { Project } from '@titlo/core';
import { FILTERS } from '@titlo/plugins';

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

const SWATCH = 'linear-gradient(140deg, #ffd9a0 0%, #e78f7a 40%, #6c7cc8 100%)';

export default function FilterPanel({ project, onChange }: Props) {
  const selected = project.filter;
  const intensity =
    typeof selected?.params.intensity === 'number' ? selected.params.intensity : 0.7;

  return (
    <div className="tab-body">
      <button
        type="button"
        className={`filter-card ${!selected ? 'is-active' : ''}`}
        onClick={() => onChange({ ...project, filter: null, updatedAt: Date.now() })}
      >
        <span className="swatch" style={{ background: SWATCH }} />
        Bez filtera
      </button>

      {FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          className={`filter-card ${selected?.id === filter.id ? 'is-active' : ''}`}
          onClick={() =>
            onChange({
              ...project,
              filter: { id: filter.id, params: { intensity } },
              updatedAt: Date.now(),
            })
          }
        >
          <span className="swatch" style={{ background: SWATCH, filter: filter.webPreview.css }} />
          {filter.name.bs ?? filter.id}
          {selected?.id === filter.id && (
            <span className="badge" style={{ marginLeft: 'auto' }}>
              {Math.round(intensity * 100)} %
            </span>
          )}
        </button>
      ))}

      {selected && (
        <div className="field">
          <span className="label">
            Jačina
            <span className="value">{Math.round(intensity * 100)} %</span>
          </span>
          <input
            className="slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intensity}
            onChange={(event) =>
              onChange({
                ...project,
                filter: { id: selected.id, params: { ...selected.params, intensity: Number(event.target.value) } },
                updatedAt: Date.now(),
              })
            }
          />
        </div>
      )}

      <p className="hint">
        U prototipu filter radi kroz canvas. U aplikaciji je isti plugin SkSL shader, pa izvoz
        izgleda isto kao pregled.
      </p>
    </div>
  );
}
