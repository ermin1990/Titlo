import { useState } from 'react';
import { Capacitor } from '@capacitor/core';

const DISMISS_KEY = 'titlo:install-hint:dismissed';

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS se predstavlja kao Mac, ali ima ekran na dodir.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isInstalled(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * iPhone ne instalira aplikacije s linka, ali Safari može dodati web
 * aplikaciju na početni ekran. Tada ima ikonu, otvara se preko cijelog
 * ekrana i radi bez interneta.
 */
export default function InstallHint() {
  const [hidden, setHidden] = useState(
    () => Capacitor.isNativePlatform() || !isIos() || isInstalled() || wasDismissed(),
  );
  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div className="install-hint" role="note">
      <div>
        <span className="eyebrow">instaliraj na iPhone</span>
        <strong>Dodaj Titlo na početni ekran</strong>
        <ol>
          <li>
            U Safariju dodirni <b>Podijeli</b> <span aria-hidden="true">(kvadrat sa strelicom)</span>.
          </li>
          <li>
            Izaberi <b>Dodaj na početni ekran</b>, pa <b>Dodaj</b>.
          </li>
          <li>Otvaraj Titlo s ikone: radi preko cijelog ekrana i bez interneta.</li>
        </ol>
      </div>
      <button className="btn btn-ghost" type="button" onClick={dismiss}>
        U redu
      </button>
    </div>
  );
}
