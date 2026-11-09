import { h, fmtTime, fmtDuration, clamp, confirmModal } from '../util.js';
import { EXERCISES, EXERCISE_ORDER, PAIRS, CORE, SETS_PER_EXERCISE } from '../data.js';
import {
  buildQueue, stepAfterSet, stepAfterRest, skipExerciseIndex,
  startRest, remainingMs, isRestDone, pauseRest, resumeRest, addRestTime, resetRest,
  suggestedReps, isReadyToProgress, completedSetCount, TOTAL_SETS,
} from '../engine.js';
import {
  getActive, saveActive, clearActive, getAllProgressions, progressionName,
  setProgressionLevel, lastEntryFor, addWorkout, settings,
} from '../store.js';
import { acquireWakeLock, releaseWakeLock, wakeLockSupported } from '../wake.js';
import { notifyRestFinished, unlockAudio } from '../notify.js';
import { session } from '../session.js';

let activeCleanup = null;

export async function workoutView(root) {
  const active = await getActive();
  if (!active || !Array.isArray(active.queue) || !active.queue.length) {
    return setupView(root);
  }
  return runView(root, active);
}

function groupLabel(exerciseId) {
  const pair = PAIRS.find((p) => p.exercises.includes(exerciseId));
  if (pair) return pair.label;
  return 'Core triplet';
}

// ---------- Setup screen (choose progressions, then begin) ----------

async function setupView(root) {
  const progs = await getAllProgressions();

  const groups = [
    ...PAIRS.map((p) => ({ label: p.label, ids: p.exercises })),
    { label: 'Core triplet', ids: CORE },
  ];

  const selects = {};
  const groupEls = groups.map((g) => h('div', { class: 'setup-group' },
    h('div', { class: 'setup-group-label' }, g.label),
    g.ids.map((id) => {
      const rec = progs[id];
      const sel = h('select', { class: 'select', 'aria-label': `${EXERCISES[id].name} progression` },
        rec.list.map((name, i) => h('option', { value: String(i), selected: i === rec.level ? true : null }, name)),
      );
      sel.addEventListener('change', async () => {
        await setProgressionLevel(id, parseInt(sel.value, 10));
      });
      selects[id] = sel;
      return h('div', { class: 'setup-row' },
        h('span', { class: 'setup-exercise' }, EXERCISES[id].name),
        sel,
      );
    }),
  ));

  const beginBtn = h('button', {
    class: 'btn btn-primary btn-big btn-block',
    onclick: async () => {
      unlockAudio();
      const fresh = await getAllProgressions();
      const entries = {};
      for (const id of EXERCISE_ORDER) {
        entries[id] = { level: fresh[id].level, progression: progressionName(fresh[id]), sets: [] };
      }
      const active = {
        startedAt: Date.now(),
        queue: buildQueue(),
        index: 0,
        phase: 'exercise',
        rest: null,
        paused: false,
        entries,
      };
      await saveActive(active);
      session.hasActiveWorkout = true;
      await acquireWakeLock();
      root.innerHTML = '';
      activeCleanup = await runView(root, active);
    },
  }, 'BEGIN WORKOUT');

  root.append(
    h('section', { class: 'section' },
      h('h1', { class: 'screen-title' }, 'New workout'),
      h('p', { class: 'muted' },
        `9 exercises · 3 sets each · rest ${settings.restPair}s between pair sets, ${settings.restCore}s between core sets. ` +
        'Pick your current progression for each exercise:'),
    ),
    h('section', { class: 'section' }, groupEls),
    beginBtn,
  );
  return () => {
    if (activeCleanup) activeCleanup();
  };
}

// ---------- Active workout screen ----------

async function runView(root, active) {
  session.hasActiveWorkout = true;
  await acquireWakeLock();

  let iv = null;
  await catchUpRests();
  if (active.phase === 'done') { await finishWorkout(); return; }

  const els = {};
  root.append(
    h('div', { class: 'workout-top' },
      h('div', { class: 'workout-title-row' },
        h('span', { class: 'workout-title' }, 'Workout in progress'),
        h('span', { class: 'wake-indicator', title: wakeLockSupported ? 'Screen wake lock active' : 'Wake Lock API unsupported — silent-audio fallback active' },
          settings.wakeLock ? '🔒 screen on' : '🔓 screen lock off'),
        h('button', { class: 'icon-btn', title: 'Pause workout', onclick: () => pauseWorkout() }, '⏸'),
        h('button', { class: 'icon-btn', title: 'End workout', onclick: () => endWorkoutConfirm() }, '✕'),
      ),
      h('div', { class: 'progress-track' },
        els.progressFill = h('div', { class: 'progress-fill' })),
      els.progressText = h('div', { class: 'progress-text' }),
    ),
    els.panel = h('main', { class: 'workout-panel' }),
    els.overlay = h('div', { class: 'pause-overlay', hidden: true }),
  );

  function updateChrome() {
    const done = completedSetCount(active.entries);
    els.progressFill.style.width = `${(done / TOTAL_SETS) * 100}%`;
    els.progressText.textContent = `${done} / ${TOTAL_SETS} sets completed`;
  }

  async function renderPanel() {
    els.panel.innerHTML = '';
    updateChrome();
    if (active.phase === 'rest' && active.rest) return renderRestPanel();
    const step = active.queue[active.index];
    if (!step || step.type !== 'set') return;
    await renderExercisePanel(step);
  }

  async function renderExercisePanel(step) {
    const ex = EXERCISES[step.exerciseId];
    const entry = active.entries[step.exerciseId];
    const lastEntry = await lastEntryFor(step.exerciseId, entry.level);
    const suggestion = suggestedReps(lastEntry ? lastEntry.sets : null, ex.repRange);
    const ready = lastEntry && isReadyToProgress(lastEntry.sets, ex.repRange);

    const nextRest = active.queue[active.index + 1];
    const afterRest = active.queue[active.index + 2];
    let nextTxt;
    if (nextRest && nextRest.type === 'rest' && afterRest && afterRest.type === 'set') {
      const dur = nextRest.kind === 'core' ? settings.restCore : settings.restPair;
      nextTxt = `Next: rest ${dur}s → ${EXERCISES[afterRest.exerciseId].name} — set ${afterRest.setNumber}`;
    } else {
      nextTxt = 'This is the final set of the workout 🎉';
    }

    const repsInput = h('input', {
      class: 'reps-input', type: 'number', inputmode: 'numeric', min: '0', max: '99',
      value: String(suggestion), 'aria-label': 'Reps completed',
    });
    els.repsInput = repsInput;

    const chips = entry.sets.map((r, i) => {
      if (typeof r !== 'number') return null;
      return h('button', {
        class: 'chip',
        title: 'Tap to edit',
        onclick: (ev) => {
          const input = h('input', { class: 'chip-input', type: 'number', inputmode: 'numeric', min: '0', max: '99', value: String(r) });
          input.addEventListener('change', async () => {
            let v = parseInt(input.value, 10);
            if (isNaN(v)) v = 0;
            entry.sets[i] = clamp(v, 0, 99);
            await saveActive(active);
            renderPanel();
          });
          input.addEventListener('blur', () => renderPanel());
          const chip = ev.currentTarget;
          chip.innerHTML = '';
          chip.append(input);
          input.focus();
          input.select();
        },
      }, `Set ${i + 1}: ${r}`);
    });

    els.panel.append(
      h('div', { class: 'exercise-group-label' }, groupLabel(step.exerciseId)),
      h('h2', { class: 'exercise-name' }, ex.name),
      h('div', { class: 'progression-line' },
        h('span', { class: 'badge' }, entry.progression),
        ready ? h('span', { class: 'badge badge-accent', title: 'You hit the top of the rep range for all 3 sets — consider the next progression at your next workout' }, 'ready to progress ↑') : null,
      ),
      h('div', { class: 'set-indicator' }, `Set ${step.setNumber} of ${SETS_PER_EXERCISE}`),
      h('div', { class: 'target-line' }, `Target: ${ex.repRange[0]}–${ex.repRange[1]} reps`,
        h('span', { class: 'muted' }, ` · suggested ${suggestion}`)),
      h('div', { class: 'reps-row' },
        h('button', { class: 'btn btn-secondary btn-step', onclick: () => { repsInput.value = String(clamp((parseInt(repsInput.value, 10) || 0) - 1, 0, 99)); } }, '−'),
        repsInput,
        h('button', { class: 'btn btn-secondary btn-step', onclick: () => { repsInput.value = String(clamp((parseInt(repsInput.value, 10) || 0) + 1, 0, 99)); } }, '+'),
      ),
      h('div', { class: 'chips' }, chips),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: completeSet }, '✔ COMPLETE SET'),
      h('div', { class: 'next-preview' }, nextTxt),
      h('button', { class: 'btn btn-ghost btn-block', onclick: skipExercise }, 'Skip this exercise'),
    );
  }

  function renderRestPanel() {
    const rest = active.rest;
    const after = stepAfterRest(active.queue, active.index);
    const nextStep = active.queue[after.index];
    const nextEx = nextStep && nextStep.type === 'set' ? EXERCISES[nextStep.exerciseId] : null;

    els.countdown = h('div', { class: 'countdown' }, fmtTime(remainingMs(rest) / 1000));

    els.panel.append(
      h('div', { class: 'rest-label' }, 'REST'),
      els.countdown,
      h('div', { class: 'next-preview' },
        nextEx ? `Next: ${nextEx.name} — set ${nextStep.setNumber} (${active.entries[nextStep.exerciseId].progression})` : 'Next: finish workout'),
      h('div', { class: 'timer-controls' },
        h('button', {
          class: 'btn btn-secondary',
          onclick: async () => {
            active.rest = rest.pausedRemaining == null ? pauseRest(rest) : resumeRest(rest);
            await saveActive(active);
            renderPanel();
          },
        }, rest.pausedRemaining == null ? '⏸ Pause' : '▶ Resume'),
        h('button', { class: 'btn btn-secondary', onclick: add15 }, '+15s'),
        h('button', { class: 'btn btn-secondary', onclick: skipRest }, '⏭ Skip rest'),
        h('button', { class: 'btn btn-secondary', onclick: resetTimer }, '↺ Reset'),
      ),
    );
  }

  async function add15() {
    active.rest = addRestTime(active.rest, 15);
    await saveActive(active);
    tick();
  }

  async function resetTimer() {
    active.rest = resetRest(active.rest);
    await saveActive(active);
    tick();
  }

  async function skipRest() {
    const n = stepAfterRest(active.queue, active.index);
    active.index = n.index;
    active.phase = n.phase;
    active.rest = null;
    await saveActive(active);
    if (n.phase === 'done') return finishWorkout();
    renderPanel();
  }

  async function completeSet() {
    const step = active.queue[active.index];
    if (!step || step.type !== 'set') return;
    let reps = parseInt(els.repsInput.value, 10);
    if (isNaN(reps)) reps = 0;
    const entry = active.entries[step.exerciseId];
    entry.sets[step.setNumber - 1] = clamp(reps, 0, 99);
    const n = stepAfterSet(active.queue, active.index);
    if (n.phase === 'rest') {
      const restStep = active.queue[n.index];
      const dur = restStep.kind === 'core' ? settings.restCore : settings.restPair;
      active.rest = startRest(dur);
    } else {
      active.rest = null;
    }
    active.index = n.index;
    active.phase = n.phase;
    await saveActive(active);
    if (n.phase === 'done') return finishWorkout();
    renderPanel();
  }

  async function skipExercise() {
    const step = active.queue[active.index];
    if (!step || step.type !== 'set') return;
    confirmModal({
      title: `Skip ${EXERCISES[step.exerciseId].name}?`,
      message: 'All remaining sets of this exercise will be marked as skipped.',
      actions: [
        { label: 'Cancel', class: 'btn-secondary' },
        {
          label: 'Skip exercise', class: 'btn-danger',
          onClick: async () => {
            const entry = active.entries[step.exerciseId];
            for (let s = step.setNumber; s <= SETS_PER_EXERCISE; s++) {
              if (entry.sets[s - 1] === undefined) entry.sets[s - 1] = null;
            }
            const j = skipExerciseIndex(active.queue, active.index);
            active.rest = null;
            if (j >= active.queue.length) {
              active.index = j;
              active.phase = 'done';
              await saveActive(active);
              return finishWorkout();
            }
            active.index = j;
            active.phase = 'exercise';
            await saveActive(active);
            renderPanel();
          },
        },
      ],
    });
  }

  function pauseWorkout() {
    active.paused = true;
    if (active.phase === 'rest' && active.rest && active.rest.pausedRemaining == null) {
      active.rest = pauseRest(active.rest);
    }
    saveActive(active);
    els.overlay.hidden = false;
    els.overlay.innerHTML = '';
    els.overlay.append(
      h('div', { class: 'pause-card' },
        h('h2', {}, 'Workout paused'),
        h('button', {
          class: 'btn btn-primary btn-big btn-block',
          onclick: async () => {
            active.paused = false;
            if (active.rest && active.rest.pausedRemaining != null) {
              active.rest = resumeRest(active.rest);
            }
            await saveActive(active);
            els.overlay.hidden = true;
            renderPanel();
          },
        }, '▶ RESUME'),
        h('button', { class: 'btn btn-ghost btn-block', onclick: endWorkoutConfirm }, 'End workout'),
      ),
    );
  }

  function endWorkoutConfirm() {
    confirmModal({
      title: 'End workout?',
      message: 'The current in-progress workout will be discarded and not saved to your history.',
      actions: [
        { label: 'Keep workout', class: 'btn-primary' },
        {
          label: 'Discard workout', class: 'btn-danger',
          onClick: async () => {
            await clearActive();
            session.hasActiveWorkout = false;
            await releaseWakeLock();
            location.hash = '#/';
          },
        },
      ],
    });
  }

  async function catchUpRests() {
    let notified = false;
    while (active.phase === 'rest' && active.rest && isRestDone(active.rest)) {
      const n = stepAfterRest(active.queue, active.index);
      active.index = n.index;
      if (n.phase === 'done') {
        active.phase = 'done';
        active.rest = null;
        return true;
      }
      active.phase = 'exercise';
      active.rest = null;
      notified = true;
    }
    if (notified) {
      await saveActive(active);
      notifyRestFinished();
    }
    return false;
  }

  async function finishWorkout() {
    const now = Date.now();
    const rec = {
      date: active.startedAt,
      durationSec: Math.max(1, Math.round((now - active.startedAt) / 1000)),
      exercises: active.entries,
    };
    await addWorkout(rec);
    await clearActive();
    session.hasActiveWorkout = false;
    await releaseWakeLock();
    if (iv) clearInterval(iv);
    renderDone(rec);
  }

  function renderDone(rec) {
    root.innerHTML = '';
    const totalReps = Object.values(rec.exercises).reduce(
      (sum, e) => sum + e.sets.reduce((s, r) => s + (typeof r === 'number' ? r : 0), 0), 0);
    root.append(
      h('section', { class: 'section done-screen' },
        h('div', { class: 'done-emoji' }, '🎉'),
        h('h1', { class: 'screen-title' }, 'Workout complete!'),
        h('div', { class: 'stat-row' },
          h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, fmtDuration(rec.durationSec)), h('div', { class: 'stat-label' }, 'Duration')),
          h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, String(totalReps)), h('div', { class: 'stat-label' }, 'Total reps')),
        ),
        h('div', { class: 'card' },
          EXERCISE_ORDER.map((id) => {
            const e = rec.exercises[id];
            const ex = EXERCISES[id];
            return h('div', { class: 'progress-item' },
              h('div', { class: 'progress-item-main' },
                h('span', { class: 'progress-item-name' }, ex.name),
                h('span', { class: 'progress-item-prog' }, e.progression)),
              h('span', { class: 'progress-item-sets' }, e.sets.map((r) => (typeof r === 'number' ? r : '–')).join(' · ')),
            );
          }),
        ),
        h('a', { class: 'btn btn-primary btn-big btn-block', href: '#/' }, 'BACK TO HOME'),
      ),
    );
  }

  function tick() {
    if (active.paused) return;
    if (active.phase === 'rest' && active.rest && els.countdown) {
      els.countdown.textContent = fmtTime(remainingMs(active.rest) / 1000);
      if (isRestDone(active.rest)) {
        catchUpRests().then((finished) => {
          if (finished) { finishWorkout(); return; }
          renderPanel();
        });
      }
    }
  }

  iv = setInterval(tick, 250);
  document.addEventListener('visibilitychange', onVis);
  function onVis() {
    if (document.visibilityState === 'visible') {
      acquireWakeLock();
      if (!active.paused && active.phase === 'rest') {
        catchUpRests().then((finished) => {
          if (finished) { finishWorkout(); return; }
          renderPanel();
        });
      }
    }
  }

  await renderPanel();

  return () => {
    if (iv) clearInterval(iv);
    document.removeEventListener('visibilitychange', onVis);
  };
}
