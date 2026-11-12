import type { Animation, Project } from '@titlo/core';
import { STYLES, styleById } from '@titlo/plugins';
import {
  ACCENT_COLORS,
  LINE_PRESETS,
  OUT_PRESETS,
  SPEED_OPTIONS,
  WORD_PRESETS,
  accentOf,
  linePresetId,
  outPresetId,
  wordPresetId,
} from '../lib/animations.js';

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

function presetAnimations(presets: typeof WORD_PRESETS, id: string): Animation[] {
  return presets.find((preset) => preset.id === id)?.animations ?? [];
}

export default function StylePanel({ project, onChange }: Props) {
  const base = styleById(project.style.id);
  const resolvedSize =
    typeof project.style.params.size === 'number' ? project.style.params.size : base.font.size;
  const uppercase =
    typeof project.style.params.uppercase === 'boolean'
      ? project.style.params.uppercase
      : base.text.uppercase ?? false;

  const update = (patch: Partial<Project>) => onChange({ ...project, ...patch, updatedAt: Date.now() });

  const setParam = (key: string, value: number | boolean | string) =>
    update({ style: { ...project.style, params: { ...project.style.params, [key]: value } } });

  const accent =
    typeof project.style.params.accent === 'string' ? project.style.params.accent : accentOf(base);
  const speed =
    typeof project.style.params.animSpeed === 'number' ? project.style.params.animSpeed : 1;

  const chooseStyle = (id: string) => {
    // Boja istaknute riječi pripada stilu, pa je novi stil donosi svoju.
    const { accent: _accent, ...rest } = project.style.params;
    void _accent;
    update({ style: { id, params: rest } });
  };

  const setAnimation = (
    key: 'wordIn' | 'lineIn' | 'lineOut',
    presets: typeof WORD_PRESETS,
    id: string,
  ) => {
    update({
      animationOverrides: {
        ...project.animationOverrides,
        [key]: presetAnimations(presets, id),
      },
    });
  };

  const animations = {
    wordIn: project.animationOverrides?.wordIn ?? base.animations.wordIn,
    lineIn: project.animationOverrides?.lineIn ?? base.animations.lineIn,
    lineOut: project.animationOverrides?.lineOut ?? base.animations.lineOut,
  };

  return (
    <div className="tab-body">
      <div className="field">
        <span className="label">
          Stil
          <span className="value">{base.name.bs ?? base.id}</span>
        </span>
        <div className="style-grid">
          {STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              className={`style-card ${style.id === project.style.id ? 'is-active' : ''}`}
              onClick={() => chooseStyle(style.id)}
            >
              <span
                className="aa"
                style={{
                  fontFamily: `"${style.font.family}", sans-serif`,
                  fontWeight: style.font.weight,
                  textTransform: style.text.uppercase ? 'uppercase' : 'none',
                }}
              >
                A
                <span
                  style={
                    style.activeWord.background
                      ? {
                          background: style.activeWord.background.color,
                          color: style.activeWord.fill,
                          borderRadius: 4,
                          padding: '0 3px',
                        }
                      : { color: style.activeWord.fill }
                  }
                >
                  a
                </span>
              </span>
              {style.name.bs ?? style.id}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label">
          Boja istaknute riječi
          <span className="value">{accent.toUpperCase()}</span>
        </span>
        <div className="swatches" role="group" aria-label="Boja istaknute riječi">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`swatch ${accent.toUpperCase() === color ? 'is-active' : ''}`}
              style={{ background: color }}
              aria-label={color}
              onClick={() => setParam('accent', color)}
            />
          ))}
          <label className="swatch swatch-custom" title="Druga boja">
            +
            <input
              type="color"
              value={accent}
              onChange={(event) => setParam('accent', event.target.value.toUpperCase())}
            />
          </label>
        </div>
      </div>

      <div className="field">
        <span className="label">
          Brzina animacije
          <span className="value">sporije izgleda mekše</span>
        </span>
        <div className="segmented" role="group" aria-label="Brzina animacije">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segment ${speed === option.value ? 'is-active' : ''}`}
              onClick={() => setParam('animSpeed', option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label">
          Veličina
          <span className="value">{(resolvedSize * 100).toFixed(1)} % visine</span>
        </span>
        <input
          className="slider"
          type="range"
          min={0.025}
          max={0.12}
          step={0.001}
          value={resolvedSize}
          onChange={(event) => setParam('size', Number(event.target.value))}
        />
      </div>

      <div className="field">
        <span className="label">
          Visina titla
          <span className="value">{Math.round(project.captionBox.y * 100)} %</span>
        </span>
        <input
          className="slider"
          type="range"
          min={0.2}
          max={0.9}
          step={0.005}
          value={project.captionBox.y}
          onChange={(event) =>
            update({
              captionBox: { ...project.captionBox, y: Number(event.target.value) },
            })
          }
        />
      </div>

      <div className="field">
        <span className="label">
          Vodoravno
          <span className="value">{Math.round(project.captionBox.x * 100)} %</span>
        </span>
        <input
          className="slider"
          type="range"
          min={0.1}
          max={0.9}
          step={0.005}
          value={project.captionBox.x}
          onChange={(event) =>
            update({
              captionBox: { ...project.captionBox, x: Number(event.target.value) },
            })
          }
        />
      </div>

      <button
        className="btn btn-ghost"
        type="button"
        onClick={() =>
          update({ captionBox: { x: 0.5, y: 0.72, width: 0.84 } })
        }
      >
        Vrati titl na sredinu
      </button>

      <div className="field">
        <span className="label">
          Širina bloka
          <span className="value">{Math.round(project.captionBox.width * 100)} %</span>
        </span>
        <input
          className="slider"
          type="range"
          min={0.4}
          max={1}
          step={0.01}
          value={project.captionBox.width}
          onChange={(event) =>
            update({
              captionBox: { ...project.captionBox, width: Number(event.target.value) },
            })
          }
        />
      </div>

      <button
        className="btn btn-ghost"
        type="button"
        style={{ justifyContent: 'space-between' }}
        onClick={() => setParam('uppercase', !uppercase)}
      >
        Velika slova
        <span className="badge">{uppercase ? 'uključeno' : 'isključeno'}</span>
      </button>

      <div className="field">
        <span className="label">
          Riječ ulazi
          <span className="value">animacija</span>
        </span>
        <select
          className="select"
          value={wordPresetId(animations.wordIn)}
          onChange={(event) => setAnimation('wordIn', WORD_PRESETS, event.target.value)}
        >
          {WORD_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          <option value="custom">Po mjeri</option>
        </select>
      </div>

      <div className="split-2">
        <div className="field">
          <span className="label">Red ulazi</span>
          <select
            className="select"
            value={linePresetId(animations.lineIn)}
            onChange={(event) => setAnimation('lineIn', LINE_PRESETS, event.target.value)}
          >
            {LINE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Po mjeri</option>
          </select>
        </div>
        <div className="field">
          <span className="label">Red izlazi</span>
          <select
            className="select"
            value={outPresetId(animations.lineOut)}
            onChange={(event) => setAnimation('lineOut', OUT_PRESETS, event.target.value)}
          >
            {OUT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Po mjeri</option>
          </select>
        </div>
      </div>

      <button
        className="btn btn-ghost"
        type="button"
        onClick={() =>
          onChange({
            ...project,
            style: { id: project.style.id, params: {} },
            animationOverrides: undefined,
            updatedAt: Date.now(),
          })
        }
      >
        Vrati stil na zadano
      </button>
    </div>
  );
}
