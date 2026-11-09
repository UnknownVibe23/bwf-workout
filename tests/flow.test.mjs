import assert from 'node:assert/strict';
import {
  buildQueue, stepAfterSet, stepAfterRest, startRest, isRestDone, remainingMs,
} from '../js/engine.js';
import { PAIRS, CORE, SETS_PER_EXERCISE, EXERCISES } from '../js/data.js';

// Simulate a complete workout the same way the workout view drives the engine:
// complete set -> rest (timestamp based) -> time passes -> next step.
const DUR = { pair: 90, core: 60 };
const q = buildQueue();

// Expected event log straight from the spec.
const expected = [];
for (const pair of PAIRS) {
  const [a, b] = pair.exercises;
  for (let s = 1; s <= SETS_PER_EXERCISE; s++) {
    expected.push(`${a} set ${s}`, 'rest', `${b} set ${s}`, 'rest');
  }
}
for (let s = 1; s <= SETS_PER_EXERCISE; s++) {
  for (const c of CORE) expected.push(`${c} set ${s}`, 'rest');
}
expected.pop(); // no rest after the final set of the workout

let index = 0;
let phase = 'exercise';
let rest = null;
let now = 1_000_000;
const entries = {};
const log = [];

while (phase !== 'done') {
  const step = q[index];
  assert.ok(step, `step exists at index ${index}`);
  if (step.type === 'set') {
    entries[step.exerciseId] = entries[step.exerciseId] || [];
    entries[step.exerciseId][step.setNumber - 1] = 6;
    log.push(`${step.exerciseId} set ${step.setNumber}`);
    const n = stepAfterSet(q, index);
    if (n.phase === 'rest') {
      const rs = q[n.index];
      rest = startRest(DUR[rs.kind], now);
      assert.equal(rs.kind, EXERCISES[step.exerciseId].group, 'rest kind matches exercise group');
      log.push('rest');
      index = n.index;
      phase = 'rest';
    } else {
      index = n.index;
      phase = n.phase;
    }
  } else {
    // rest step: simulate the browser being suspended past the end of the rest
    now = rest.endsAt + 30_000;
    assert.ok(isRestDone(rest, now), 'rest done after suspension');
    assert.equal(remainingMs(rest, now), 0);
    const n = stepAfterRest(q, index);
    index = n.index;
    phase = n.phase;
    rest = null;
  }
}

assert.equal(index, q.length, 'consumed the whole queue');
assert.deepEqual(log, expected, 'full workout sequence matches the spec exactly');
assert.equal(Object.keys(entries).length, 9, 'all 9 exercises logged');
for (const id of Object.keys(entries)) {
  assert.deepEqual(entries[id], [6, 6, 6], `${id} has 3 sets`);
}
console.log(`Flow test passed: ${log.length} events, ${Object.keys(entries).length} exercises, 3 sets each, no rest after final set.`);
