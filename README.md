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
  notify.js              Loud sound on rest end
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
  Pause / Resume / +15s / Skip / Reset, beeps loudly when it ends, then
  moves to the next set automatically. No rest timer after the final set.
- Progress is saved to IndexedDB after **every set**; closing the browser or
  rebooting the phone resumes the exact exercise, set and remaining rest time.
- The routine targets **3 workouts per week with at least one rest day
  between sessions** — shown as a hint on the home screen.
- Progression principle: start at 3× low end of the rep range, add reps, and
  once you hit 3× the top of the range with good form the app flags "ready to
  progress". Changing progression (or path) resets the suggested target to the
  low end. The app never changes your progression automatically.
- Core triplet exercises offer the official **alternate progression paths**
  (Main / Alternate 1–3) on the setup and Progress screens. Static holds
  (arch hangs, support hold, plank) are timed in **seconds** with the 3×30s
  ready-to-progress rule.
- **Guide** tab: official routine instructions (pairing, rest times, 10X0
  tempo, failure-1 rep strategy, 3×/week schedule) with links to the official
  wiki pages.
- **Settings** → export/import your full history as JSON, reset data, change
  rest times, sound, theme, wake lock.

## Versioning

SemVer in a single place: `version.js` at the repo root (`var APP_VERSION = '1.0.0'`).
The page loads it via `<script>` (shown in Settings, written into exports as
`appVersion`), and the service worker reads it via `importScripts` to build its
cache name (`bwf-workout-v1-0-0`), so cache busting can't drift from the version.

Bump **once per merge to `main`** (never per commit): PATCH for fixes, MINOR for
new features, MAJOR for breaking changes. Optionally tag the merge (`git tag v1.0.0`).
`version: 1` inside exported JSON files is the backup *format* version, separate
from the app version.

## Security & privacy

Threat model: single-user, local-only app. There is no backend, no account,
no analytics, and no network traffic at runtime — the only outbound links are
the fixed `reddit.com` wiki links on the Guide tab, which open in the browser
(`target="_blank"`).

- All data (workouts, settings, progressions, in-progress session) stays in
  IndexedDB, which is bound to the app's origin (`https://<host>/bwf-workout/`).
  It is never sent anywhere; backups are JSON files you export/import yourself.
- No secrets, tokens, or credentials exist in the code or repo.
- No `eval`, no inline scripts/styles, and no `innerHTML` with dynamic data
  (all rendering uses DOM text nodes). A strict Content-Security-Policy meta
  tag is set in `index.html` (`default-src 'self'`, plus `data:` only for
  images/media so the wake-lock fallback audio works).
- The service worker only handles same-origin GET requests and precaches the
  app shell; scope is `./`.
- Import validates backup files (structure + known exercise ids) before
  writing to the database. Only import backups you trust.
- Browser permissions used: Screen Wake Lock and Web Audio (
  benign, no camera/mic/location). The app must be served over HTTPS
  (GitHub Pages provides this) for the service worker and install to work.

## Extending

- Add/reorder exercises or change rep ranges: edit `js/data.js`.
- Change workout flow logic: `js/engine.js` (pure functions, covered by tests in `tests/`).
- New screens: add a route in `js/main.js` and a view in `js/views/`.
