import { useEffect, useState } from 'react';
import {
  projectRange,
  projectText,
  retimeForNewText,
  textStats,
  type Project,
} from '@titlo/core';

interface Props {
  project: Project;
  onChange: (project: Project) => void;
  onToast: (message: string) => void;
}

export default function TextPanel({ project, onChange, onToast }: Props) {
  const [value, setValue] = useState(() => projectText(project));

  useEffect(() => {
    setValue(projectText(project));
  }, [project.id]);

  const stats = textStats(value);
  const dirty = value !== projectText(project);

  const apply = () => {
    if (!dirty) return;
    const lines = retimeForNewText(project.lines, value, projectRange(project));
    onChange({ ...project, lines, updatedAt: Date.now() });
    onToast('Tekst izmijenjen. Nepromijenjene riječi zadržale su vrijeme.');
  };

  return (
    <div className="tab-body">
      <div className="field">
        <span className="label">
          Tekst projekta
          <span className="value">
            {stats.lines} {stats.lines === 1 ? 'red' : 'reda'} · {stats.words} riječi
          </span>
        </span>
        <textarea
          className="textarea"
          style={{ minHeight: 200, fontSize: 14 }}
          value={value}
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>

      <div className="actions">
        <button className="btn btn-primary" type="button" onClick={apply} disabled={!dirty}>
          Primijeni izmjenu
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => setValue(projectText(project))} disabled={!dirty}>
          Vrati
        </button>
      </div>

      <p className="hint">
        Izmjena čuva vrijeme riječi koje su ostale iste. Nove riječi dobijaju raspoređeno vrijeme
        između susjeda.
      </p>
    </div>
  );
}
