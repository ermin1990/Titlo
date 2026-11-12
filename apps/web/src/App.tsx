import { useEffect } from 'react';
import { useApp } from './store.js';
import TopBar from './components/TopBar.js';
import StartScreen from './screens/StartScreen.js';
import TextScreen from './screens/TextScreen.js';
import TapScreen from './screens/TapScreen.js';
import EditScreen from './screens/EditScreen.js';

export default function App() {
  const step = useApp((state) => state.step);
  const toast = useApp((state) => state.toast);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => useApp.getState().showToast(null), 3600);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [step]);

  return (
    <div className="app">
      <TopBar />
      {step === 'start' && <StartScreen />}
      {step === 'text' && <TextScreen />}
      {step === 'tap' && <TapScreen />}
      {step === 'edit' && <EditScreen />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
