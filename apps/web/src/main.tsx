import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as NativeApp } from '@capacitor/app';
import { registerSW } from 'virtual:pwa-register';
import App from './App.js';
import { useApp } from './store.js';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Nema #root');

if (import.meta.env.DEV) {
  (window as unknown as { __titlo?: unknown }).__titlo = useApp;
}

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-platform');
  console.info(
    `titlo:capabilities ${JSON.stringify({
      videoEncoder: typeof VideoEncoder,
      videoFrame: typeof VideoFrame,
      audioEncoder: typeof AudioEncoder,
      webgpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
      offscreen: typeof OffscreenCanvas,
    })}`,
  );
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  void StatusBar.setBackgroundColor({ color: '#101012' }).catch(() => undefined);
  void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);

  void NativeApp.addListener('backButton', () => {
    const state = useApp.getState();
    if (state.step === 'start') {
      void NativeApp.minimizeApp().catch(() => undefined);
      return;
    }
    state.setStep('start');
  });
}

if (!Capacitor.isNativePlatform()) {
  registerSW({ immediate: true });
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
