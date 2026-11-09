import { settings } from './store.js';

// Silent 0.1s WAV used as a fallback loop when the Screen Wake Lock API is
// unavailable: a playing media element keeps Android Chrome from sleeping.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

let lock = null;
let fallbackAudio = null;
export let wakeLockSupported = 'wakeLock' in navigator;
export let wakeLockActive = false;

export async function acquireWakeLock() {
  if (!settings.wakeLock) return false;
  if (wakeLockSupported) {
    try {
      lock = await navigator.wakeLock.request('screen');
      wakeLockActive = true;
      lock.addEventListener('release', () => {
        wakeLockActive = false;
        lock = null;
      });
      stopFallback();
      return true;
    } catch {
      wakeLockActive = false;
    }
  }
  // Fallback: loop a silent audio element.
  startFallback();
  return false;
}

export async function releaseWakeLock() {
  if (lock) {
    try { await lock.release(); } catch { /* already released */ }
  }
  lock = null;
  wakeLockActive = false;
  stopFallback();
}

function startFallback() {
  if (fallbackAudio) return;
  try {
    fallbackAudio = new Audio(SILENT_WAV);
    fallbackAudio.loop = true;
    fallbackAudio.volume = 0;
    const p = fallbackAudio.play();
    if (p && p.catch) p.catch(() => { fallbackAudio = null; });
    wakeLockActive = true;
  } catch {
    fallbackAudio = null;
  }
}

function stopFallback() {
  if (fallbackAudio) {
    try { fallbackAudio.pause(); } catch { /* ignore */ }
    fallbackAudio = null;
  }
}

export function setupWakeLockReacquire() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') acquireWakeLock();
  });
}
