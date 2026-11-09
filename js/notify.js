import { settings } from './store.js';

let audioCtx = null;

function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

export function playFinishSound() {
  if (!settings.sound) return;
  const c = ctx();
  if (!c) return;
  const now = c.currentTime;
  [0, 0.22, 0.44].forEach((offset, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 2 ? 880 : 660;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
    osc.connect(gain).connect(c.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.2);
  });
}

export function vibrateFinish() {
  if (!settings.vibration) return;
  if (navigator.vibrate) {
    try { navigator.vibrate([200, 100, 200, 100, 200]); } catch { /* unsupported */ }
  }
}

export function notifyRestFinished() {
  playFinishSound();
  vibrateFinish();
}

// Unlock audio on first user gesture (required by Android Chrome autoplay policy).
export function unlockAudio() {
  ctx();
}
