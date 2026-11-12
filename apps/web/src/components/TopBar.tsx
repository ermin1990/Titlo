import { useApp } from '../store.js';

const STEPS: Array<{ id: 'text' | 'edit'; label: string; number: string }> = [
  { id: 'text', label: 'Tekst', number: '1' },
  { id: 'edit', label: 'Uređivanje', number: '2' },
];

export default function TopBar() {
  const step = useApp((state) => state.step);
  const project = useApp((state) => state.project);
  const reset = useApp((state) => state.reset);
  const showToast = useApp((state) => state.showToast);

  const order = STEPS.findIndex((entry) => entry.id === step);

  const goBack = () => {
    reset();
    if (project) showToast('Projekat je sačuvan na uređaju.');
  };

  return (
    <header className="topbar">
      <button className="brand" type="button" onClick={goBack} title="Početak">
        <img className="brand-mark" src={`${import.meta.env.BASE_URL}icons/logo.svg`} alt="" />
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
