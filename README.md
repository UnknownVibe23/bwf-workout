# BWF Workout — Bodyweight Fitness Workout Companion

A mobile-first Progressive Web App (PWA) that guides you through the
[Reddit r/bodyweightfitness Recommended Routine](https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine/)
(skill/warm-up section excluded): 3 alternating pairs + a core triplet,
3 sets each, with automatic rest timers, progress tracking, workout history,
JSON backup, and screen wake lock during workouts.

No build step, no dependencies, no backend, no accounts. All data lives in
your browser's IndexedDB.

## Tech stack

- Plain HTML/CSS/ES-module JavaScript (no framework, no build tooling)
- IndexedDB for all persistent data (settings, progressions, active workout, workout history)
- Service worker + web app manifest (installable, standalone, offline-capable)
- Screen Wake Lock API (with a silent-audio fallback where unsupported)
- Web Audio API beeps + Vibration API for rest-end notifications
- Rest timers are computed from absolute timestamps (`endsAt - Date.now()`), so they stay accurate even if Android suspends the browser tab

## Project structure

```
index.html               App shell + bottom navigation
manifest.webmanifest     PWA manifest (standalone, icons, theme)
sw.js                    Service worker (app-shell precache, cache-first)
css/styles.css           Dark/light themes, mobile-first layout
js/
  data.js                Routine definition: pairs, core triplet, exercises, default progressions
  engine.js              Pure workout logic: queue builder, timestamp timer math, skip, progression hints
  db.js                  Minimal IndexedDB promise wrapper
  store.js               Settings, progression selections, active session, workout records, export/import
  session.js             Shared UI flags
  notify.js              Sound + vibration on rest end
  wake.js                Screen Wake Lock (+ fallback), reacquire on visibilitychange
  main.js                Router, app init, service worker registration
  util.js                DOM helpers, formatting, modal, JSON download
  views/                 home, workout (setup + live), history (+detail), progress, settings
icons/                   Generated PWA icons (tools/make_icons.py)
tests/                   Node tests for the workout engine and full-flow simulation
tools/make_icons.py      Regenerates the PNG icons (pure Python, no deps)
```

## Run locally

Any static file server works (a service worker requires `localhost` or HTTPS):

```bash
cd bodyweight-fitness-app
python3 -m http.server 8000
# then open http://localhost:8000 in Chrome
```

or `npx serve .`, `npx http-server .`, etc.

## Run the tests

```bash
node tests/engine.test.mjs   # queue structure, timer math, skip, progression rules
node tests/flow.test.mjs     # simulates a complete workout end-to-end against the spec
```

## Deploy over HTTPS (required for installability)

The app is fully static — deploy the folder contents to any static host that
serves HTTPS:

- **GitHub Pages**: push to a repo, enable Pages (root or `/docs`), open the HTTPS URL.
- **Netlify**: drag-and-drop the folder or `netlify deploy --dir=.`.
- **Cloudflare Pages**: create a project, upload the folder / connect a repo.
- **Vercel**: `vercel --prod` from the project folder.

All asset paths are relative (`./`), so the app works from any base path.
After deploying, open the HTTPS URL once in Chrome so the service worker
registers, then install (below).

## Install on an Android phone

1. Open the deployed HTTPS URL in Chrome.
2. Tap the ⋮ menu → **"Add to Home screen"** (or "Install app").
3. Launch from the home-screen icon: it opens full-screen standalone, works
   offline, and during a workout the screen stays awake (Screen Wake Lock;
   reacquired automatically when you return to the app).

## Usage notes

- **Start a workout** from the home screen; pick your progression per exercise
  on the setup screen (selections persist).
- Press **Complete Set**, enter reps, and the rest timer starts automatically
  (90s pairs / 60s core by default; editable in Settings). The timer offers
  Pause / Resume / +15s / Skip / Reset, beeps and vibrates when it ends, then
  moves to the next set automatically. No rest timer after the final set.
- Progress is saved to IndexedDB after **every set**; closing the browser or
  rebooting the phone resumes the exact exercise, set and remaining rest time.
- The routine targets **3 workouts per week with at least one rest day
  between sessions** — shown as a hint on the home screen.
- Progression principle: start at 3× low end of the rep range, add reps, and
  once you hit 3× the top of the range with good form the app flags "ready to
  progress". Changing progression resets the suggested target to the low end.
  The app never changes your progression automatically.
- **Settings** → export/import your full history as JSON, reset data, change
  rest times, sound/vibration, theme, wake lock, and edit progression lists.

## Extending

- Add/reorder exercises or change rep ranges: edit `js/data.js`.
- Change workout flow logic: `js/engine.js` (pure functions, covered by tests in `tests/`).
- New screens: add a route in `js/main.js` and a view in `js/views/`.
