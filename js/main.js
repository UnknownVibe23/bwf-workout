import { loadSettings, getActive } from './store.js';
import { setupWakeLockReacquire } from './wake.js';
import { unlockAudio } from './notify.js';
import { session } from './session.js';
import { homeView } from './views/home.js';
import { workoutView } from './views/workout.js';
import { historyView, historyDetailView } from './views/history.js';
import { progressView } from './views/progress.js';
import { settingsView } from './views/settings.js';

const app = document.getElementById('app');

const routes = [
  { re: /^#?\/?$/, view: homeView },
  { re: /^#\/workout$/, view: workoutView },
  { re: /^#\/history$/, view: historyView },
  { re: /^#\/history\/(\d+)$/, view: historyDetailView },
  { re: /^#\/progress$/, view: progressView },
  { re: /^#\/settings$/, view: settingsView },
];

let cleanup = null;

async function render() {
  const hash = location.hash || '#/';
  const route = routes.find((r) => r.re.test(hash));
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  app.innerHTML = '';
  document.body.classList.toggle('in-workout', hash === '#/workout');
  if (!route) { location.hash = '#/'; return; }
  document.querySelectorAll('.nav-item').forEach((a) => {
    const r = a.dataset.route;
    const active = (hash === '#/' && r === 'home') || hash === `#/${r}` || (r === 'history' && hash.startsWith('#/history/'));
    a.classList.toggle('active', active);
  });
  const params = hash.match(route.re).slice(1);
  const result = await route.view(app, params);
  if (typeof result === 'function') cleanup = result;
  window.scrollTo(0, 0);
}

async function init() {
  await loadSettings();
  const active = await getActive();
  session.hasActiveWorkout = !!active;
  setupWakeLockReacquire();

  window.addEventListener('hashchange', render);
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('beforeunload', (e) => {
    if (session.hasActiveWorkout) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support unavailable */ });
    });
  }

  await render();
}

init();
