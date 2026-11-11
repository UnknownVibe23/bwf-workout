import { PAIRS, CORE, SETS_PER_EXERCISE, restKindFor } from './data.js';

export const TOTAL_SETS = 9 * SETS_PER_EXERCISE;

export const MODE_STANDARD = 'standard';
export const MODE_TRIPLET = 'triplet';

// Standard: 3 pairs + core triplet (90s/60s rests).
// Triplet ("short") mode per the official guide's FAQ: the six pair exercises
// become two triplets (guide example: pull-ups, squats, dips) plus the core
// triplet — 3 triplets cycled 3x each, 50s rest between sets.
export function exerciseGroups(mode = MODE_STANDARD) {
  if (mode === MODE_TRIPLET) {
    const flat = PAIRS.map((p) => p.exercises).flat();
    return [flat.slice(0, 3), flat.slice(3, 6), [...CORE]];
  }
  return [...PAIRS.map((p) => p.exercises), [...CORE]];
}

function restKindForMode(mode, exerciseId) {
  if (mode === MODE_TRIPLET) return 'triplet';
  return restKindFor(exerciseId);
}

export function buildQueue(mode = MODE_STANDARD) {
  const groups = exerciseGroups(mode);
  const steps = [];
  const pushSet = (exerciseId, setNumber) =>
    steps.push({ type: 'set', exerciseId, setNumber });
  const pushRest = (exerciseId) =>
    steps.push({ type: 'rest', kind: restKindForMode(mode, exerciseId) });

  for (const group of groups) {
    for (let s = 1; s <= SETS_PER_EXERCISE; s++) {
      for (const id of group) {
        pushSet(id, s);
        pushRest(id);
      }
    }
  }
  // No rest timer after the final set of the entire workout.
  if (steps.length && steps[steps.length - 1].type === 'rest') steps.pop();
  return steps;
}

// Rough per-set seconds (reps at 10X0 tempo + moving to position / logging).
export const ASSUMED_SET_SECONDS = 40;

export function estimateMinutes(mode, { restPair = 90, restCore = 60, restTriplet = 50 } = {}) {
  const q = buildQueue(mode);
  const sets = q.filter((s) => s.type === 'set').length;
  const restSec = q.reduce((a, s) => {
    if (s.type !== 'rest') return a;
    return a + (s.kind === 'core' ? restCore : s.kind === 'triplet' ? restTriplet : restPair);
  }, 0);
  return Math.round((restSec + sets * ASSUMED_SET_SECONDS) / 60);
}

export function stepAfterSet(queue, index) {
  const next = index + 1;
  if (next < queue.length && queue[next].type === 'rest') {
    return { index: next, phase: 'rest' };
  }
  return { index: next, phase: 'done' };
}

export function stepAfterRest(queue, index) {
  const next = index + 1;
  if (next < queue.length && queue[next].type === 'set') {
    return { index: next, phase: 'exercise' };
  }
  return { index: next, phase: 'done' };
}

// Index of the first set step belonging to a different exercise, skipping all
// remaining sets of the current exercise and the rests between them.
export function skipExerciseIndex(queue, index) {
  const step = queue[index];
  if (!step || step.type !== 'set') return index;
  const id = step.exerciseId;
  let j = index;
  while (j < queue.length && (queue[j].type === 'rest' || queue[j].exerciseId === id)) {
    j++;
  }
  return j;
}

export function startRest(durationSec, now = Date.now()) {
  return { endsAt: now + durationSec * 1000, durationSec, pausedRemaining: null };
}

export function remainingMs(rest, now = Date.now()) {
  if (rest.pausedRemaining != null) return Math.max(0, rest.pausedRemaining * 1000);
  return Math.max(0, rest.endsAt - now);
}

export function isRestDone(rest, now = Date.now()) {
  return rest.pausedRemaining == null && rest.endsAt - now <= 0;
}

export function pauseRest(rest, now = Date.now()) {
  return { ...rest, pausedRemaining: remainingMs(rest, now) / 1000, endsAt: null };
}

export function resumeRest(rest, now = Date.now()) {
  const rem = rest.pausedRemaining != null ? rest.pausedRemaining : remainingMs(rest, now) / 1000;
  return { ...rest, endsAt: now + rem * 1000, pausedRemaining: null };
}

export function addRestTime(rest, seconds, now = Date.now()) {
  if (rest.pausedRemaining != null) {
    return { ...rest, pausedRemaining: rest.pausedRemaining + seconds };
  }
  return { ...rest, endsAt: rest.endsAt + seconds * 1000 };
}

export function resetRest(rest, now = Date.now()) {
  return { endsAt: now + rest.durationSec * 1000, durationSec: rest.durationSec, pausedRemaining: null };
}

export function isReadyToProgress(sets, repRange) {
  const nums = (sets || []).filter((r) => typeof r === 'number');
  return (sets || []).length === SETS_PER_EXERCISE && nums.length === SETS_PER_EXERCISE && nums.every((r) => r >= repRange[1]);
}

export function suggestedReps(lastSets, repRange) {
  const [low, high] = repRange;
  const nums = (lastSets || []).filter((r) => typeof r === 'number');
  if (!nums.length) return low;
  const min = Math.min(...nums);
  if (min >= high) return high;
  return Math.min(high, Math.max(low, min + 1));
}

// Static holds (arch hangs, support holds, planks) are timed in seconds:
// the guide says hold 10-30s per set and progress at 30s for all 3 sets.
export function isHoldProgression(progressionName) {
  // "arch hangs" is a timed hold, but "hanging leg raises" are reps — match precisely.
  return /hold|plank|arch hang/i.test(String(progressionName));
}

export function targetFor(exercise, progressionName) {
  if (isHoldProgression(progressionName)) {
    // Main RR page: holds progress at 3x30s. The dipping page specifies
    // 3x1min holds for the parallel bar support hold specifically.
    const high = /support hold/i.test(String(progressionName)) ? 60 : 30;
    return { range: [10, high], unit: 'seconds' };
  }
  return { range: exercise.repRange, unit: 'reps' };
}

function startOfDayTs(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// The routine is 3x/week with at least one full rest day between sessions:
// if the last workout was on day X, the next allowed workout day is X+2.
export function nextWorkoutDay(lastTs, now = Date.now()) {
  const lastDay = startOfDayTs(lastTs);
  const today = startOfDayTs(now);
  const nextDay = lastDay + 2 * 86400000;
  return { restToday: today < nextDay, trainedToday: today === lastDay, nextDay };
}

export function completedSetCount(entries) {
  let n = 0;
  for (const id of Object.keys(entries || {})) {
    for (const r of entries[id].sets) if (typeof r === 'number') n++;
  }
  return n;
}
