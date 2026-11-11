import assert from 'node:assert/strict';
import {
  buildQueue, stepAfterSet, stepAfterRest, skipExerciseIndex,
  startRest, remainingMs, isRestDone, pauseRest, resumeRest, addRestTime, resetRest,
  isReadyToProgress, suggestedReps, completedSetCount, TOTAL_SETS,
  isHoldProgression, targetFor, nextWorkoutDay, exerciseGroups, estimateMinutes, MODE_TRIPLET,
} from '../js/engine.js';
import { EXERCISES, PAIRS, CORE } from '../js/data.js';

// --- Queue structure ---
const q = buildQueue();
const sets = q.filter((s) => s.type === 'set');
const rests = q.filter((s) => s.type === 'rest');
assert.equal(sets.length, 27, '27 set steps (9 exercises x 3 sets)');
assert.equal(TOTAL_SETS, 27);
assert.equal(rests.length, 26, 'rest after every set except the final one');
assert.equal(q[q.length - 1].type, 'set', 'last step is a set, not a rest');
assert.equal(q[q.length - 1].exerciseId, 'extension');
assert.equal(q[q.length - 1].setNumber, 3);

// Pair 1 order: pullups1, rest, squats1, rest, pullups2, rest, squats2, rest, pullups3, rest, squats3, rest
const expectedFirst12 = [
  ['set', 'pullups', 1], ['rest', null, null],
  ['set', 'squats', 1], ['rest', null, null],
  ['set', 'pullups', 2], ['rest', null, null],
  ['set', 'squats', 2], ['rest', null, null],
  ['set', 'pullups', 3], ['rest', null, null],
  ['set', 'squats', 3], ['rest', null, null],
];
q.slice(0, 12).forEach((s, i) => {
  const [t, id, n] = expectedFirst12[i];
  assert.equal(s.type, t, `step ${i} type`);
  if (t === 'set') { assert.equal(s.exerciseId, id, `step ${i} exercise`); assert.equal(s.setNumber, n, `step ${i} setNumber`); }
});

// Rest kinds: pair rests are 'pair', core rests are 'core'
for (const s of q) {
  if (s.type !== 'rest') continue;
  // find the preceding set to know its kind
  const idx = q.indexOf(s);
  const prev = q[idx - 1];
  assert.equal(s.kind, EXERCISES[prev.exerciseId].group === 'core' ? 'core' : 'pair');
}

// Pair 2 and 3 ordering
assert.deepEqual(
  sets.slice(6, 12).map((s) => `${s.exerciseId}:${s.setNumber}`),
  ['dips:1', 'hinge:1', 'dips:2', 'hinge:2', 'dips:3', 'hinge:3'],
);
assert.deepEqual(
  sets.slice(12, 18).map((s) => `${s.exerciseId}:${s.setNumber}`),
  ['rows:1', 'pushups:1', 'rows:2', 'pushups:2', 'rows:3', 'pushups:3'],
);
// Core triplet: antiExt1, antiRot1, ext1, antiExt2, ...
assert.deepEqual(
  sets.slice(18).map((s) => `${s.exerciseId}:${s.setNumber}`),
  ['antiExtension:1', 'antiRotation:1', 'extension:1',
   'antiExtension:2', 'antiRotation:2', 'extension:2',
   'antiExtension:3', 'antiRotation:3', 'extension:3'],
);

// --- Transitions ---
assert.deepEqual(stepAfterSet(q, 0), { index: 1, phase: 'rest' });
assert.deepEqual(stepAfterRest(q, 1), { index: 2, phase: 'exercise' });
const lastIdx = q.length - 1;
assert.deepEqual(stepAfterSet(q, lastIdx), { index: q.length, phase: 'done' });

// --- Skip exercise ---
// Skipping pullups at set 1 lands on squats set 1 (index 2)
assert.equal(skipExerciseIndex(q, 0), 2);
// Skipping squats at set 3 (index 10) lands on dips set 1
assert.equal(q[10].exerciseId, 'squats');
assert.equal(q[skipExerciseIndex(q, 10)].exerciseId, 'dips');
// Skipping extension at set 1 continues the triplet at anti-extension set 2
const ext1 = q.findIndex((s) => s.type === 'set' && s.exerciseId === 'extension' && s.setNumber === 1);
assert.equal(q[skipExerciseIndex(q, ext1)].exerciseId, 'antiExtension');
assert.equal(q[skipExerciseIndex(q, ext1)].setNumber, 2);
// Skipping the final exercise at its final set ends the workout
assert.equal(skipExerciseIndex(q, q.length - 1), q.length);

// --- Timer math (timestamp based) ---
const now = 1_000_000;
let r = startRest(90, now);
assert.equal(r.endsAt, now + 90_000);
assert.equal(remainingMs(r, now + 30_000), 60_000);
assert.equal(remainingMs(r, now + 90_000), 0);
assert.equal(remainingMs(r, now + 120_000), 0, 'never negative');
assert.ok(isRestDone(r, now + 91_000));
assert.ok(!isRestDone(r, now + 89_000));

// Pause freezes remaining time regardless of clock drift
r = pauseRest(startRest(90, now), now + 40_000);
assert.equal(remainingMs(r, now + 40_000), 50_000);
assert.equal(remainingMs(r, now + 999_999_999), 50_000, 'paused timer immune to elapsed wall time');
assert.ok(!isRestDone(r, now + 999_999_999), 'paused timer never auto-completes');
r = resumeRest(r, now + 500_000);
assert.equal(remainingMs(r, now + 500_000), 50_000);
assert.equal(remainingMs(r, now + 549_999), 1);
assert.ok(isRestDone(r, now + 550_000));

// +15s and reset
r = addRestTime(startRest(90, now), 15, now);
assert.equal(remainingMs(r, now), 105_000);
r = resetRest(r, now + 10_000);
assert.equal(remainingMs(r, now + 10_000), 90_000);
r = addRestTime(pauseRest(startRest(60, now), now), 15, now + 1);
assert.equal(r.pausedRemaining, 75);

// --- Progression logic ---
assert.ok(!isReadyToProgress([5, 5, 5], [5, 8]));
assert.ok(!isReadyToProgress([8, 8, 7], [5, 8]));
assert.ok(isReadyToProgress([8, 8, 8], [5, 8]));
assert.ok(!isReadyToProgress([12, 10, 12], [8, 12]));
assert.ok(isReadyToProgress([12, 12, 12], [8, 12]));
assert.ok(!isReadyToProgress([8, 8], [5, 8]), 'needs all 3 sets');
assert.equal(suggestedReps(null, [5, 8]), 5);
assert.equal(suggestedReps([5, 5, 5], [5, 8]), 6);
assert.equal(suggestedReps([6, 5, 7], [5, 8]), 6);
assert.equal(suggestedReps([8, 8, 8], [5, 8]), 8);
assert.equal(suggestedReps([8, 8, 8], [8, 12]), 9, 'min+1 within range; caller resets to range low on progression change');
assert.equal(suggestedReps([], [8, 12]), 8);

// --- Completed count ---
assert.equal(completedSetCount({ a: { sets: [5, 6, null] }, b: { sets: [8, 8, 8] } }), 5);
assert.equal(completedSetCount({}), 0);

// --- Hold-type progressions (timed in seconds, progress at 3x30s) ---
assert.ok(isHoldProgression('Arch hangs'));
assert.ok(isHoldProgression('Parallel bar support hold'));
assert.ok(isHoldProgression('Plank'));
assert.ok(isHoldProgression('Arch body hold'));
assert.ok(!isHoldProgression('Pull-ups'));
assert.ok(!isHoldProgression('Ring ab rollouts'));
assert.ok(!isHoldProgression('Tucked hanging leg raises'), 'hanging leg raises are reps, not holds');
assert.ok(!isHoldProgression('Straight hanging leg raises'));
assert.deepEqual(targetFor(EXERCISES.pullups, 'Arch hangs'), { range: [10, 30], unit: 'seconds' });
assert.deepEqual(targetFor(EXERCISES.dips, 'Parallel bar support hold'), { range: [10, 60], unit: 'seconds' }, 'support hold targets 3x60s per the dips page');
assert.deepEqual(targetFor(EXERCISES.antiExtension, 'Plank'), { range: [10, 30], unit: 'seconds' });
assert.deepEqual(targetFor(EXERCISES.pullups, 'Pull-ups'), { range: [5, 8], unit: 'reps' });
assert.deepEqual(targetFor(EXERCISES.antiExtension, 'Ring ab rollouts'), { range: [8, 12], unit: 'reps' });
assert.ok(isReadyToProgress([30, 30, 30], [10, 30]), '3x30s hold ready');
assert.ok(!isReadyToProgress([30, 30, 29], [10, 30]), 'not ready below 30s');
assert.ok(isReadyToProgress([60, 60, 60], [10, 60]), '3x60s support hold ready');
assert.ok(!isReadyToProgress([60, 60, 45], [10, 60]), 'support hold not ready below 60s');
assert.equal(suggestedReps([20, 20, 20], [10, 30]), 21);
assert.equal(suggestedReps(null, [10, 30]), 10);
// exact set of hold-type levels across all default + alternate paths:
// arch hangs, support hold, plank, copenhagen planks (alt path), arch body hold (alt path)
const foundHolds = [];
for (const id of Object.keys(EXERCISES)) {
  const lists = [EXERCISES[id].defaultProgressions, ...(EXERCISES[id].altPaths || [])];
  for (const list of lists) {
    for (const name of list) {
      if (isHoldProgression(name)) foundHolds.push(name);
      assert.equal(targetFor(EXERCISES[id], name).unit, isHoldProgression(name) ? 'seconds' : 'reps', `${id}: ${name} unit`);
    }
  }
}
assert.deepEqual(foundHolds.sort(), [
  'Arch body hold',
  'Arch hangs',
  'Assisted Copenhagen plank',
  'Assisted knee Copenhagen plank',
  'Copenhagen plank',
  'Copenhagen plank with movement',
  'Knee Copenhagen plank',
  'Parallel bar support hold',
  'Plank',
].sort(), 'hold set matches the guide');

// --- Alternate paths exist only for the core triplet ---
for (const id of ['pullups', 'squats', 'dips', 'hinge', 'rows', 'pushups']) {
  assert.equal(EXERCISES[id].altPaths, undefined, `${id} has a single main path`);
}
assert.equal(EXERCISES.antiExtension.altPaths.length, 3);
assert.equal(EXERCISES.antiRotation.altPaths.length, 2);
assert.equal(EXERCISES.extension.altPaths.length, 2);
assert.deepEqual(EXERCISES.antiExtension.altPaths[0], ['Kneeling ab wheel rollouts', 'Standing ab wheel rollouts']);

// --- Rest-day schedule: 3x/week, at least one full rest day between ---
const day = 86400000;
const mondayNoon = new Date(2026, 10, 9, 12, 0, 0).getTime(); // a Monday
let r2 = nextWorkoutDay(mondayNoon, mondayNoon + 3 * 3600000); // trained Monday, still Monday evening
assert.ok(r2.restToday && r2.trainedToday, 'same day as workout: rest, trained today');
assert.equal(r2.nextDay, mondayNoon - (mondayNoon % day) + 2 * day, 'next allowed day is Wednesday');
r2 = nextWorkoutDay(mondayNoon, mondayNoon + 1 * day + 3600000); // Tuesday
assert.ok(r2.restToday && !r2.trainedToday, 'day after workout: still rest day');
r2 = nextWorkoutDay(mondayNoon, mondayNoon + 2 * day + 3600000); // Wednesday
assert.ok(!r2.restToday && !r2.trainedToday, 'two days later: training day again');

// --- Triplet ("short") mode: guide's exact variant ---
const groupsT = exerciseGroups(MODE_TRIPLET);
assert.deepEqual(groupsT[0], ['pullups', 'squats', 'dips'], 'first triplet is pull-ups, squats, dips per the guide example');
assert.deepEqual(groupsT[1], ['hinge', 'rows', 'pushups']);
assert.deepEqual(groupsT[2], ['antiExtension', 'antiRotation', 'extension']);
assert.deepEqual(exerciseGroups('standard').length, 4, 'standard = 3 pairs + core triplet');

const qt = buildQueue(MODE_TRIPLET);
assert.equal(qt.filter((s) => s.type === 'set').length, 27, 'triplet: 27 sets');
assert.equal(qt.filter((s) => s.type === 'rest').length, 26, 'triplet: rest after every set except the last');
assert.ok(qt.filter((s) => s.type === 'rest').every((s) => s.kind === 'triplet'), 'all triplet rests use the triplet rest setting');
assert.equal(qt[qt.length - 1].type, 'set', 'no rest after final set');
// first cycle order: P,S,D
assert.deepEqual(qt.slice(0, 5).map((s) => s.type === 'set' ? s.exerciseId : 'rest'), ['pullups', 'rest', 'squats', 'rest', 'dips']);
// walk the triplet queue like the flow test: ends in done after last set
const lastSet = qt.length - 1;
assert.equal(stepAfterSet(qt, lastSet).phase, 'done');

// estimates: defaults -> standard ~53 min, triplet ~40 min, triplet always shorter
const estS = estimateMinutes('standard');
const estT = estimateMinutes(MODE_TRIPLET);
assert.equal(estS, Math.round((2100 + 27 * 40) / 60), `standard estimate ${estS}`);
assert.equal(estT, Math.round((26 * 50 + 27 * 40) / 60), `triplet estimate ${estT}`);
assert.ok(estT < estS);

console.log('All engine tests passed.');
