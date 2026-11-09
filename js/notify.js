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
  // Loud, attention-grabbing pattern: two detuned oscillators per beep,
  // higher gain, 4 beeps.
  [0, 0.25, 0.5, 0.85].forEach((offset, i) => {
    const freq = i === 3 ? 880 : 660;
    for (const detune of [0, 8]) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.6, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + (i === 3 ? 0.35 : 0.2));
      osc.connect(gain).connect(c.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.4);
    }
  });
}

export function notifyRestFinished() {
  playFinishSound();
}

// Unlock audio on first user gesture (required by Android Chrome autoplay policy).
export function unlockAudio() {
  ctx();
}
