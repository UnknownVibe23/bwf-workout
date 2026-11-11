import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- 1. Static attack surface scans ----------
const html = readFileSync(join(root, 'index.html'), 'utf8');

// CSP must be strict
assert.ok(/http-equiv="Content-Security-Policy"/.test(html), 'CSP meta present');
assert.ok(/default-src 'self'/.test(html), "CSP default-src 'self'");
assert.ok(/script-src 'self'/.test(html), "CSP script-src 'self' (no inline/unsafe-inline)");

// No inline scripts or inline event handlers in the HTML
for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
  assert.equal(m[1].trim(), '', 'no inline <script> bodies');
}
assert.ok(!/\son\w+\s*=/i.test(html), 'no inline on* event handler attributes in HTML');

// No dangerous sinks in app JS
const jsFiles = ['sw.js', ...readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
  ...readdirSync(join(root, 'js/views')).map((f) => `js/views/${f}`)];
for (const f of jsFiles) {
  const src = readFileSync(join(root, f), 'utf8');
  assert.ok(!/\beval\s*\(/.test(src), `${f}: no eval`);
  assert.ok(!/new Function/.test(src), `${f}: no new Function`);
  assert.ok(!/document\.write/.test(src), `${f}: no document.write`);
  // innerHTML may only be assigned the empty string (clearing), never data
  for (const m of src.matchAll(/innerHTML\s*=\s*([^;]+);/g)) {
    assert.equal(m[1].trim(), "''", `${f}: innerHTML only cleared, never set with data`);
  }
  assert.ok(!/src\s*=\s*['"]https?:/.test(src) && !/href\s*=\s*['"]javascript:/.test(src), `${f}: no remote script src / javascript: URLs`);
}

// ---------- 2. Prototype pollution via normalizeActive ----------
const { normalizeActive } = await import('../js/engine.js');
const evil = JSON.parse('{"mode":"triplet","entries":{"__proto__":{"polluted":true}}}');
const na = normalizeActive(evil);
assert.equal({}.polluted, undefined, 'no prototype pollution');
assert.equal(na.mode, 'triplet');

// ---------- 3. Malicious backup imports (stubbed IndexedDB) ----------
global.document = { documentElement: { dataset: {} } };
global.window = {};

const stores = { settings: new Map(), progressions: new Map(), active: new Map(), workouts: [] };
function makeReq(result) {
  const req = { result, error: null };
  queueMicrotask(() => req.onsuccess && req.onsuccess());
  return req;
}
global.indexedDB = {
  open() {
    const req = { result: null, error: null };
    queueMicrotask(() => {
      req.result = {
        objectStoreNames: { contains: (s) => s in stores },
        createObjectStore() {},
        transaction: (store) => ({
          objectStore: () => ({
            get: (k) => makeReq(stores[store].get(k)),
            put: (v) => makeReq(stores[store].set(v.key ?? v.exerciseId, v)),
            add: (v) => makeReq(stores[store].push ? (stores[store].push(v), stores[store].length - 1) : v),
            delete: (k) => makeReq(stores[store].delete(k)),
            clear: () => makeReq((stores[store].clear ? stores[store].clear() : (stores[store] = [])), undefined),
            getAll: () => makeReq([...(stores[store].values ? stores[store].values() : stores[store])]),
            createIndex() {},
          }),
        }),
      };
      req.onupgradeneeded && req.onupgradeneeded();
      req.onsuccess && req.onsuccess();
    });
    return req;
  },
};

const { importData, getAllWorkouts, settings } = await import('../js/store.js');

// 3a. garbage inputs must throw cleanly, not crash
for (const bad of [null, 42, 'x', {}, { workouts: 'nope' }, { workouts: [null, 42, 'x', { date: 'not-a-number' }] }]) {
  if (bad && typeof bad === 'object' && Array.isArray(bad.workouts) && typeof bad.workouts !== 'string') {
    await importData(bad); // should sanitize, not throw
  } else {
    await assert.rejects(() => importData(bad), /Invalid backup/, `rejects ${JSON.stringify(bad)}`);
  }
}

// 3b. malicious payload: pollution keys, bad theme, junk workouts
const attack = {
  workouts: [
    { date: 1, durationSec: -5, mode: 'hax', exercises: 'garbage' }, // invalid -> dropped
    { date: 2, durationSec: 100, mode: 'triplet', exercises: { pullups: { level: 1, path: 0, progression: '<img src=x onerror=alert(1)>', sets: [8, 999, -3] }, bogus: { sets: [1] } } },
    { __proto__: { polluted: true }, date: 3, exercises: {} },
  ],
  progressions: [
    { exerciseId: 'pullups', level: 99, path: -1, customList: ['ok', 42, '<script>alert(1)</script>'] },
    { exerciseId: 'nope', level: 1 },
    { exerciseId: 'constructor', level: 1 },
  ],
  settings: { theme: '<script>alert(1)</script>', restPair: 'lots', sound: 'yes', constructor: 'x', __proto__: 'y', wakeLock: true },
};
await importData(attack);
assert.equal({}.polluted, undefined, 'no prototype pollution from import');
const ws = await getAllWorkouts();
assert.equal(ws.length, 2, 'junk workout dropped');
const w2 = ws.find((w) => w.date === 2);
assert.equal(w2.mode, 'triplet');
assert.deepEqual(w2.exercises.pullups.sets, [8, 600, 0], 'sets clamped to 0..600, non-numbers -> null skipped');
assert.ok(!('bogus' in w2.exercises), 'unknown exercise ids dropped');
assert.equal(settings.theme, 'dark', 'invalid theme rejected, default kept');
assert.equal(settings.restPair, 90, 'non-numeric setting rejected');
assert.equal(settings.wakeLock, true, 'valid boolean setting accepted');
assert.equal(settings.sound, true, 'non-boolean sound rejected -> default true');

console.log('All security tests passed.');
