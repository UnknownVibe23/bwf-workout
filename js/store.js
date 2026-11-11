import { dbGet, dbPut, dbAdd, dbDel, dbAll, dbClear } from './db.js';
import { EXERCISES, EXERCISE_ORDER } from './data.js';
import { clamp } from './util.js';

export const DEFAULT_SETTINGS = {
  restPair: 90,
  restCore: 60,
  restTriplet: 50,
  defaultMode: 'standard',
  sound: true,
  theme: 'dark',
  wakeLock: true,
};

export let settings = { ...DEFAULT_SETTINGS };

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
}

export async function loadSettings() {
  const rows = await dbAll('settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  settings = s;
  applyTheme(s.theme);
  return settings;
}

export async function setSetting(key, value) {
  settings = { ...settings, [key]: value };
  await dbPut('settings', { key, value });
  if (key === 'theme') applyTheme(value);
}

// --- Progressions ---

export async function getProgressionRecord(exerciseId) {
  const ex = EXERCISES[exerciseId];
  const r = await dbGet('progressions', exerciseId);
  const pathCount = 1 + (Array.isArray(ex.altPaths) ? ex.altPaths.length : 0);
  const path = r ? clamp(r.path || 0, 0, pathCount - 1) : 0;
  let list;
  if (path === 0) {
    list = r && Array.isArray(r.customList) && r.customList.length ? r.customList : ex.defaultProgressions;
  } else {
    list = (ex.altPaths && ex.altPaths[path - 1]) || ex.defaultProgressions;
  }
  const level = r ? clamp(r.level || 0, 0, list.length - 1) : 0;
  return { exerciseId, level, path, pathCount, list, customList: r && r.customList ? r.customList : null };
}

export async function getAllProgressions() {
  const out = {};
  for (const id of EXERCISE_ORDER) out[id] = await getProgressionRecord(id);
  return out;
}

export function progressionName(rec) {
  return rec.list[rec.level] || rec.list[0];
}

export async function setProgressionLevel(exerciseId, level) {
  const prev = await dbGet('progressions', exerciseId);
  const rec = await getProgressionRecord(exerciseId);
  await dbPut('progressions', {
    exerciseId,
    level: clamp(level, 0, rec.list.length - 1),
    path: rec.path,
    customList: prev && prev.customList ? prev.customList : undefined,
  });
}

export async function setProgressionPath(exerciseId, path) {
  const prev = await dbGet('progressions', exerciseId);
  const rec = await getProgressionRecord(exerciseId);
  await dbPut('progressions', {
    exerciseId,
    level: 0,
    path: clamp(path, 0, rec.pathCount - 1),
    customList: prev && prev.customList ? prev.customList : undefined,
  });
}

// Most recent workout entry for an exercise at the given progression level and path.
export async function lastEntryFor(exerciseId, level, path = 0) {
  const workouts = await getAllWorkouts();
  for (const w of workouts) {
    const e = w.exercises && w.exercises[exerciseId];
    if (e && e.level === level && (e.path || 0) === path && Array.isArray(e.sets)) return e;
  }
  return null;
}

// --- Active (in-progress) workout ---

export function getActive() {
  return dbGet('active', 'current');
}

export function saveActive(active) {
  return dbPut('active', { ...active, id: 'current', updatedAt: Date.now() });
}

export function clearActive() {
  return dbDel('active', 'current');
}

// --- Completed workouts ---

export async function addWorkout(rec) {
  return dbAdd('workouts', rec);
}

export async function getAllWorkouts() {
  const all = await dbAll('workouts');
  return all.sort((a, b) => b.date - a.date);
}

export function getWorkout(id) {
  return dbGet('workouts', id);
}

export function updateWorkout(rec) {
  return dbPut('workouts', rec);
}

export function deleteWorkout(id) {
  return dbDel('workouts', id);
}

export async function workoutCount() {
  const all = await dbAll('workouts');
  return all.length;
}

// --- Export / import / reset ---

export async function exportData() {
  const [settingsRows, progressionRows, workouts] = await Promise.all([
    dbAll('settings'), dbAll('progressions'), dbAll('workouts'),
  ]);
  const settingsObj = { ...DEFAULT_SETTINGS };
  for (const r of settingsRows) settingsObj[r.key] = r.value;
  return {
    app: 'bwf-workout-companion',
    version: 1,
    appVersion: (typeof window !== 'undefined' && window.APP_VERSION) || 'unknown',
    exportedAt: new Date().toISOString(),
    settings: settingsObj,
    progressions: progressionRows,
    workouts,
  };
}

function sanitizeWorkout(w) {
  if (!w || typeof w !== 'object' || !Number.isFinite(w.date) || !w.exercises || typeof w.exercises !== 'object') return null;
  const exercises = {};
  for (const id of Object.keys(EXERCISES)) {
    const e = w.exercises[id];
    if (!e || typeof e !== 'object') continue;
    const sets = Array.isArray(e.sets)
      ? e.sets.slice(0, 3).map((r) => (Number.isFinite(r) ? Math.min(Math.max(Math.trunc(r), 0), 600) : null))
      : [null, null, null];
    exercises[id] = {
      level: Number.isInteger(e.level) ? e.level : 0,
      path: Number.isInteger(e.path) ? e.path : 0,
      progression: typeof e.progression === 'string' ? e.progression.slice(0, 200) : '',
      sets,
    };
  }
  return {
    date: w.date,
    durationSec: Number.isFinite(w.durationSec) && w.durationSec > 0 ? Math.trunc(w.durationSec) : 0,
    mode: w.mode === 'triplet' ? 'triplet' : 'standard',
    exercises,
  };
}

const THEMES = ['dark', 'light', 'system'];

export async function importData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.workouts)) {
    throw new Error('Invalid backup file: missing workouts array.');
  }
  await dbClear('workouts');
  await dbClear('progressions');
  await dbClear('settings');
  for (const w of data.workouts) {
    const clean = sanitizeWorkout(w);
    if (clean) await dbAdd('workouts', clean);
  }
  if (Array.isArray(data.progressions)) {
    for (const p of data.progressions) {
      if (p && p.exerciseId && EXERCISES[p.exerciseId]) {
        await dbPut('progressions', {
          exerciseId: p.exerciseId,
          level: Number.isInteger(p.level) ? p.level : 0,
          path: Number.isInteger(p.path) ? p.path : 0,
          customList: Array.isArray(p.customList)
            ? p.customList.filter((s) => typeof s === 'string').map((s) => s.slice(0, 120)).filter(Boolean)
            : undefined,
        });
      }
    }
  }
  if (data.settings && typeof data.settings === 'object') {
    for (const [key, value] of Object.entries(data.settings)) {
      // hasOwn: 'in' would also match inherited props like 'constructor'
      if (!Object.hasOwn(DEFAULT_SETTINGS, key)) continue;
      if (key === 'theme' && !THEMES.includes(value)) continue;
      if (typeof DEFAULT_SETTINGS[key] === 'number' && !Number.isFinite(value)) continue;
      if (typeof DEFAULT_SETTINGS[key] === 'boolean' && typeof value !== 'boolean') continue;
      if (typeof DEFAULT_SETTINGS[key] === 'string' && typeof value !== 'string') continue;
      await dbPut('settings', { key, value });
    }
  }
  await loadSettings();
}

export async function resetWorkoutData() {
  await dbClear('workouts');
  await dbClear('active');
  await dbClear('progressions');
}
