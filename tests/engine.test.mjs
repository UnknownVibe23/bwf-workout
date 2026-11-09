import assert from 'node:assert/strict';
import {
  buildQueue, stepAfterSet, stepAfterRest, skipExerciseIndex,
  startRest, remainingMs, isRestDone, pauseRest, resumeRest, addRestTime, resetRest,
  isReadyToProgress, suggestedReps, completedSetCount, TOTAL_SETS,
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

console.log('All engine tests passed.');
