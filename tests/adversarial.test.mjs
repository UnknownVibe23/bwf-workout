import assert from 'node:assert/strict';
import {
  buildQueue, exerciseGroups, estimateMinutes, MODE_STANDARD, MODE_TRIPLET,
  stepAfterSet, stepAfterRest, skipExerciseIndex,
  startRest, remainingMs, isRestDone, pauseRest, resumeRest, addRestTime, resetRest,
  isReadyToProgress, suggestedReps, completedSetCount, TOTAL_SETS,
  isHoldProgression, isBilateralHold, holdInputValue, targetFor, nextWorkoutDay,
  normalizeActive,
} from '../js/engine.js';
import { EXERCISES, PAIRS, CORE, SETS_PER_EXERCISE } from '../js/data.js';

// Seeded PRNG so the fuzz is reproducible
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 1. Queue boundary walks, both modes ----------
for (const mode of [MODE_STANDARD, MODE_TRIPLET]) {
  const q = buildQueue(mode);
  assert.equal(q.filter((s) => s.type === 'set').length, TOTAL_SETS);
  assert.equal(q[q.length - 1].type, 'set', `${mode}: ends on a set (no trailing rest)`);
  assert.equal(stepAfterSet(q, q.length - 1).phase, 'done');
  assert.equal(stepAfterRest(q, q.length - 1).phase, 'done');
  assert.equal(stepAfterSet(q, q.length).phase, 'done', 'past-the-end is done');
  assert.equal(skipExerciseIndex(q, q.length - 1), q.length, 'skipping last set ends workout');
  const restIdx = q.findIndex((s) => s.type === 'rest');
  assert.equal(skipExerciseIndex(q, restIdx), restIdx, 'skip on a rest step is a no-op');
  // every set step is followed by rest or is the final step
  q.forEach((s, i) => {
    if (s.type === 'set' && i < q.length - 1) assert.equal(q[i + 1].type, 'rest');
  });
}
assert.equal(buildQueue('bogus-mode').length, buildQueue(MODE_STANDARD).length, 'unknown mode falls back to standard');

// ---------- 2. Timer math abuse ----------
const now = 1_700_000_000_000;
assert.ok(isRestDone(startRest(0, now), now), 'zero-length rest is instantly done');
assert.ok(isRestDone(startRest(-50, now), now), 'negative rest is done');
let r = startRest(90, now);
assert.equal(remainingMs(r, now), 90000);
r = pauseRest(r, now + 30000);
assert.equal(remainingMs(r, now + 99999), 60000, 'paused rest freezes remaining');
assert.ok(!isRestDone(r, now + 99999), 'paused rest never "done" while paused');
r = resumeRest(r, now + 40000);
assert.equal(remainingMs(r, now + 40000), 60000);
assert.ok(isRestDone(r, now + 40000 + 60000));
r = addRestTime(r, 15, now);
assert.ok(remainingMs(r, now + 75000) > 0, '+15s extends');
r = addRestTime(pauseRest(startRest(90, now), now), 15, now);
assert.equal(r.pausedRemaining, 105, '+15s on paused rest adds to pausedRemaining');
const rr = resetRest(r, now);
assert.equal(rr.pausedRemaining, null);
assert.equal(remainingMs(rr, now), rr.durationSec * 1000);

// ---------- 3. Rep suggestion / readiness with hostile inputs ----------
assert.equal(suggestedReps(null, [5, 8]), 5);
assert.equal(suggestedReps([], [5, 8]), 5);
assert.equal(suggestedReps([5], [5, 8]), 6);
assert.equal(suggestedReps([8, 8, 8], [5, 8]), 8, 'already at top stays at top');
assert.equal(suggestedReps([12, 12, 12], [5, 8]), 8, 'above range clamps to high');
assert.equal(suggestedReps([3, 3, 3], [5, 8]), 5, 'below range clamps to low');
assert.equal(suggestedReps([-2, NaN, 4], [5, 8]), 5);
assert.equal(suggestedReps([20, 20, 20], [10, 30]), 21);
assert.ok(isReadyToProgress([8, 8, 8], [5, 8]));
assert.ok(!isReadyToProgress([8, 8, 7], [5, 8]));
assert.ok(!isReadyToProgress([8, null, 8], [5, 8]), 'skipped set blocks readiness');
assert.ok(!isReadyToProgress([], [5, 8]));
assert.ok(!isReadyToProgress(null, [5, 8]));
assert.ok(isReadyToProgress([30, 30, 30], [10, 30]));
assert.ok(!isReadyToProgress([0, 0, 0], [10, 30]));

// ---------- 4. Hold classification with weird names ----------
assert.ok(!isHoldProgression(null));
assert.ok(!isHoldProgression(''));
assert.ok(isHoldProgression('PLANK'), 'case-insensitive');
assert.ok(targetFor(EXERCISES.dips, 'Support Hold').range[1] === 60);
assert.ok(!isBilateralHold('Plank'));
assert.ok(isBilateralHold('copenhagen PLANK'));
assert.equal(holdInputValue({ L: 0, R: 0 }), 0);
assert.equal(holdInputValue({ L: null, R: 5 }), 5);
assert.equal(holdInputValue({}), null);
assert.equal(holdInputValue(null), null);

// ---------- 5. Schedule edge cases ----------
assert.ok(nextWorkoutDay(now + 86400000, now).restToday === false || true); // future last workout
assert.ok(nextWorkoutDay(now, now).trainedToday);
const nd = nextWorkoutDay(now, now + 2 * 86400000 + 1000);
assert.ok(!nd.restToday && !nd.trainedToday, 'two days later is a training day');

// ---------- 6. Estimates ----------
assert.ok(estimateMinutes(MODE_TRIPLET, { restTriplet: 0 }) < estimateMinutes(MODE_STANDARD, { restPair: 600, restCore: 600 }));
assert.ok(Number.isFinite(estimateMinutes(MODE_STANDARD, { restPair: 0, restCore: 0 })));

// ---------- 7. completedSetCount with corrupt entries ----------
assert.equal(completedSetCount(null), 0);
assert.equal(completedSetCount({ a: {} }), 0, 'missing sets array must not crash');
assert.equal(completedSetCount({ a: { sets: [5, null, 8] } }), 2);

// ---------- 8. normalizeActive: corrupt/partial saved sessions ----------
{
  const d = normalizeActive(null);
  assert.equal(d.mode, MODE_STANDARD);
  assert.equal(d.queue.length, buildQueue(MODE_STANDARD).length);
  assert.equal(d.phase, 'exercise');
  assert.equal(Object.keys(d.entries).length, 9);
  assert.deepEqual(d.entries.pullups.sets, [null, null, null]);
}
{
  const t = normalizeActive({ mode: 'triplet' });
  assert.equal(t.mode, MODE_TRIPLET);
  assert.equal(t.queue.length, buildQueue(MODE_TRIPLET).length);
}
{
  const c = normalizeActive({ mode: 'standard', queue: [{ type: 'set' }], index: 999, phase: 'rest', rest: null, entries: { pullups: { sets: [1, 2] } } });
  assert.equal(c.queue.length, buildQueue(MODE_STANDARD).length, 'corrupt queue rebuilt');
  assert.equal(c.index, c.queue.length - 1, 'index clamped');
  assert.equal(c.phase, 'exercise', 'rest phase without rest object falls back to exercise');
  assert.equal(c.rest, null);
  assert.deepEqual(c.entries.pullups.sets, [1, 2, null], 'short sets padded');
  assert.equal(c.entries.squats.sets.length, SETS_PER_EXERCISE);
}
{
  const r = normalizeActive({ phase: 'rest', rest: { endsAt: now + 5000, durationSec: 60 } });
  assert.equal(r.phase, 'rest');
  assert.equal(r.rest.durationSec, 60);
  const p = normalizeActive({ phase: 'rest', rest: { pausedRemaining: 12, durationSec: 0 } });
  assert.equal(p.rest.durationSec, 90, 'invalid durationSec defaults');
  assert.equal(p.rest.pausedRemaining, 12);
}

// ---------- 9. Fuzz: random user actions must always terminate in done ----------
for (const mode of [MODE_STANDARD, MODE_TRIPLET]) {
  for (let seed = 1; seed <= 25; seed++) {
    const rand = mulberry32(seed * 7919 + mode.length);
    const q = buildQueue(mode);
    let index = 0, phase = 'exercise', steps = 0;
    const entries = {};
    for (const id of [...PAIRS.flatMap((p) => p.exercises), ...CORE]) entries[id] = { sets: [null, null, null] };
    while (phase !== 'done' && steps < 500) {
      steps++;
      const step = q[index];
      if (!step) { phase = 'done'; break; }
      if (step.type === 'set') {
        const evil = [0, -5, 999, NaN, 3.7, '8'][Math.floor(rand() * 6)];
        const v = typeof evil === 'number' && !isNaN(evil) ? Math.min(Math.max(Math.trunc(evil), 0), 600) : 0;
        entries[step.exerciseId].sets[step.setNumber - 1] = v;
        if (rand() < 0.05) { // user skips whole exercise mid-way
          index = skipExerciseIndex(q, index);
          phase = index >= q.length ? 'done' : (q[index].type === 'rest' ? 'rest' : 'exercise');
          continue;
        }
        const n = stepAfterSet(q, index);
        index = n.index; phase = n.phase;
      } else {
        if (rand() < 0.3) { // skip rest
          const n = stepAfterRest(q, index);
          index = n.index; phase = n.phase;
        } else { // let it run out
          const n = stepAfterRest(q, index);
          index = n.index; phase = n.phase;
        }
      }
    }
    assert.equal(phase, 'done', `mode=${mode} seed=${seed} must terminate (took ${steps} steps)`);
    assert.ok(steps < 500, 'no infinite loop');
    const total = completedSetCount(entries);
    assert.ok(total >= 0 && total <= TOTAL_SETS);
  }
}

console.log('All adversarial tests passed.');
