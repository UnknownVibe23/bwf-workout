import { h, fmtDate, fmtDateTime, fmtDuration, confirmModal, clamp } from '../util.js';
import { EXERCISES, EXERCISE_ORDER } from '../data.js';
import { isHoldProgression } from '../engine.js';
import { getAllWorkouts, getWorkout, updateWorkout, deleteWorkout } from '../store.js';

function totalReps(w) {
  return Object.values(w.exercises || {}).reduce(
    (sum, e) => sum + (e.sets || []).reduce((s, r) => s + (typeof r === 'number' ? r : 0), 0), 0);
}

export async function historyView(root) {
  const workouts = await getAllWorkouts();
  const total = workouts.length;

  if (!workouts.length) {
    root.append(
      h('section', { class: 'section' },
        h('h1', { class: 'screen-title' }, 'History'),
        h('p', { class: 'muted' }, 'No completed workouts yet. Finish a workout and it will show up here.'),
        h('a', { class: 'btn btn-primary btn-big btn-block', href: '#/workout' }, 'START WORKOUT'),
      ),
    );
    return;
  }

  root.append(
    h('section', { class: 'section' },
      h('h1', { class: 'screen-title' }, 'History'),
      h('p', { class: 'muted' }, `${total} completed workout${total === 1 ? '' : 's'}.`),
    ),
    h('section', { class: 'section' },
      workouts.map((w, i) => h('a', {
        class: 'card card-link history-item',
        href: `#/history/${w.id}`,
      },
        h('div', { class: 'history-item-main' },
          h('span', { class: 'history-item-title' }, `Workout #${total - i}`),
          h('span', { class: 'history-item-sub' }, `${fmtDate(w.date)} · ${fmtDuration(w.durationSec)} · ${totalReps(w)} reps${w.mode === 'triplet' ? ' · ⚡ triplet' : ''}`),
        ),
        h('span', { class: 'chevron' }, '›'),
      )),
    ),
  );
}

export async function historyDetailView(root, params) {
  const id = parseInt(params[0], 10);
  const workouts = await getAllWorkouts();
  const w = await getWorkout(id);
  if (!w) {
    root.append(h('section', { class: 'section' }, h('p', { class: 'muted' }, 'Workout not found.'),
      h('a', { class: 'btn btn-secondary', href: '#/history' }, 'Back to history')));
    return;
  }
  const total = workouts.length;
  const idx = workouts.findIndex((x) => x.id === id);
  const prev = idx >= 0 && idx + 1 < workouts.length ? workouts[idx + 1] : null;

  const rows = EXERCISE_ORDER.map((exId) => {
    const ex = EXERCISES[exId];
    const e = w.exercises && w.exercises[exId];
    if (!e) return null;
    const unit = isHoldProgression(e.progression) ? 's' : '';
    const sets = (e.sets || []).map((r, i) => {
      if (typeof r !== 'number') return h('span', { class: 'chip chip-skipped' }, `S${i + 1}: –`);
      return h('button', {
        class: 'chip',
        title: 'Tap to correct reps',
        onclick: (ev) => {
          const input = h('input', { class: 'chip-input', type: 'number', inputmode: 'numeric', min: '0', max: '99', value: String(r) });
          input.addEventListener('change', async () => {
            let v = parseInt(input.value, 10);
            if (isNaN(v)) v = 0;
            e.sets[i] = clamp(v, 0, 600);
            await updateWorkout(w);
            root.innerHTML = '';
            await historyDetailView(root, params);
          });
          const chip = ev.currentTarget;
          chip.innerHTML = '';
          chip.append(input);
          input.focus();
          input.select();
        },
      }, `S${i + 1}: ${r}${unit}`);
    });
    const mine = (e.sets || []).reduce((s, r) => s + (typeof r === 'number' ? r : 0), 0);
    let delta = null;
    if (prev && prev.exercises && prev.exercises[exId]) {
      const pe = prev.exercises[exId];
      const prevTotal = (pe.sets || []).reduce((s, r) => s + (typeof r === 'number' ? r : 0), 0);
      const d = mine - prevTotal;
      if (d > 0) delta = h('span', { class: 'delta delta-up' }, `+${d} vs prev`);
      else if (d < 0) delta = h('span', { class: 'delta delta-down' }, `${d} vs prev`);
      else delta = h('span', { class: 'delta' }, 'same as prev');
    }
    return h('div', { class: 'progress-item' },
      h('div', { class: 'progress-item-main' },
        h('span', { class: 'progress-item-name' }, ex.name),
        h('span', { class: 'progress-item-prog' }, e.progression),
      ),
      h('div', { class: 'progress-item-sets' }, h('span', { class: 'chips' }, sets), delta),
    );
  });

  root.append(
    h('section', { class: 'section' },
      h('a', { class: 'back-link', href: '#/history' }, '‹ History'),
      h('h1', { class: 'screen-title' }, `Workout #${total - idx}`),
      h('p', { class: 'muted' }, `${fmtDateTime(w.date)} · duration ${fmtDuration(w.durationSec)} · ${totalReps(w)} total reps · ${w.mode === 'triplet' ? '⚡ triplet mode' : 'standard mode'}`),
      h('div', { class: 'btn-row' },
        h('button', {
          class: 'btn btn-danger',
          onclick: () => confirmModal({
            title: 'Delete this workout?',
            message: 'This permanently removes the workout from your history.',
            actions: [
              { label: 'Cancel', class: 'btn-secondary' },
              { label: 'Delete', class: 'btn-danger', onClick: async () => { await deleteWorkout(id); location.hash = '#/history'; } },
            ],
          }),
        }, 'Delete workout'),
      ),
    ),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title' }, 'Exercises'),
      h('div', { class: 'card' }, rows),
    ),
  );
}
