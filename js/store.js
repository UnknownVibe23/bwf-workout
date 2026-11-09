import { dbGet, dbPut, dbAdd, dbDel, dbAll, dbClear } from './db.js';
import { EXERCISES, EXERCISE_ORDER } from './data.js';
import { clamp } from './util.js';

export const DEFAULT_SETTINGS = {
  restPair: 90,
  restCore: 60,
  sound: true,
  vibration: true,
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
  const r = await dbGet('progressions', exerciseId);
  const def = EXERCISES[exerciseId].defaultProgressions;
  const list = r && Array.isArray(r.customList) && r.customList.length ? r.customList : def;
  const level = r ? clamp(r.level || 0, 0, list.length - 1) : 0;
  return { exerciseId, level, list, customList: r && r.customList ? r.customList : null };
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
  await dbPut('progressions', {
    exerciseId,
    level: clamp(level, 0, (prev && prev.customList && prev.customList.length ? prev.customList : EXERCISES[exerciseId].defaultProgressions).length - 1),
    customList: prev && prev.customList ? prev.customList : undefined,
  });
}

export async function setProgressionList(exerciseId, list) {
  const prev = await dbGet('progressions', exerciseId);
  const clean = list.map((s) => String(s).trim()).filter(Boolean);
  await dbPut('progressions', {
    exerciseId,
    level: clamp(prev ? prev.level || 0 : 0, 0, Math.max(0, clean.length - 1)),
    customList: clean.length ? clean : undefined,
  });
}

// Most recent workout entry for an exercise at the given progression level.
export async function lastEntryFor(exerciseId, level) {
  const workouts = await getAllWorkouts();
  for (const w of workouts) {
    const e = w.exercises && w.exercises[exerciseId];
    if (e && e.level === level && Array.isArray(e.sets)) return e;
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
    exportedAt: new Date().toISOString(),
    settings: settingsObj,
    progressions: progressionRows,
    workouts,
  };
}

export async function importData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.workouts)) {
    throw new Error('Invalid backup file: missing workouts array.');
  }
  await dbClear('workouts');
  await dbClear('progressions');
  await dbClear('settings');
  for (const w of data.workouts) {
    if (!w || typeof w.date !== 'number' || !w.exercises) continue;
    const { id, ...rest } = w;
    await dbAdd('workouts', rest);
  }
  if (Array.isArray(data.progressions)) {
    for (const p of data.progressions) {
      if (p && p.exerciseId && EXERCISES[p.exerciseId]) {
        await dbPut('progressions', { exerciseId: p.exerciseId, level: p.level || 0, customList: p.customList });
      }
    }
  }
  if (data.settings && typeof data.settings === 'object') {
    for (const [key, value] of Object.entries(data.settings)) {
      if (key in DEFAULT_SETTINGS) await dbPut('settings', { key, value });
    }
  }
  await loadSettings();
}

export async function resetWorkoutData() {
  await dbClear('workouts');
  await dbClear('active');
  await dbClear('progressions');
}
