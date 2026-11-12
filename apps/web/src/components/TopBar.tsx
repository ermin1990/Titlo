import { useApp } from '../store.js';

const STEPS: Array<{ id: 'text' | 'tap' | 'edit'; label: string; number: string }> = [
  { id: 'text', label: 'Tekst', number: '1' },
  { id: 'tap', label: 'Tapkanje', number: '2' },
  { id: 'edit', label: 'Uređivanje', number: '3' },
];

export default function TopBar() {
  const step = useApp((state) => state.step);
  const project = useApp((state) => state.project);
  const reset = useApp((state) => state.reset);

  const order = STEPS.findIndex((entry) => entry.id === step);

  const goBack = () => {
    if (project && step !== 'edit') {
      const ok = window.confirm('Napustiti projekat? Tekst ostaje sačuvan.');
      if (!ok) return;
    }
    reset();
  };

  return (
    <header className="topbar">
      <button className="brand" type="button" onClick={goBack} title="Početak">
        <span className="brand-mark" />
        Titlo
        <small>na uređaju</small>
      </button>

      <nav className="steps" aria-label="Koraci">
        {STEPS.map((entry, index) => (
          <span
            key={entry.id}
            className={`step ${step === entry.id ? 'is-active' : ''} ${order > index ? 'is-done' : ''}`}
          >
            <b>{entry.number}</b>
            {entry.label}
          </span>
        ))}
      </nav>

      <div className="topbar-right">
        {project ? (
          <span>
            <span className="dot-ok" />
            tekst i projekat sačuvani
          </span>
        ) : (
          <span>ništa ne napušta uređaj</span>
        )}
      </div>
    </header>
  );
}
