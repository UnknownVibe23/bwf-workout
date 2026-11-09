import { h, fmtDate, daysSince } from '../util.js';
import {
  getAllWorkouts, workoutCount, getActive, getAllProgressions,
  progressionName, lastEntryFor, settings,
} from '../store.js';
import { EXERCISES, EXERCISE_ORDER, PAIRS, CORE } from '../data.js';
import { isReadyToProgress } from '../engine.js';

export async function homeView(root) {
  const [workouts, count, active, progs] = await Promise.all([
    getAllWorkouts(), workoutCount(), getActive(), getAllProgressions(),
  ]);
  const last = workouts[0] || null;

  let nextSuggestion;
  if (!last) {
    nextSuggestion = 'Start your first workout — aim for 3 sessions per week with at least one rest day between.';
  } else {
    const d = daysSince(last.date);
    nextSuggestion = d >= 1
      ? 'Today is a good training day (3 workouts per week, at least one rest day between sessions).'
      : 'Rest day today — your next session can be tomorrow. The routine is designed for 3 workouts per week.';
  }

  const startBtn = h('a', {
    class: 'btn btn-primary btn-big btn-block',
    href: '#/workout',
  }, active ? '▶ RESUME WORKOUT' : '▶ START WORKOUT');

  const stats = h('div', { class: 'stat-row' },
    h('div', { class: 'stat' },
      h('div', { class: 'stat-value' }, String(count)),
      h('div', { class: 'stat-label' }, 'Workouts done')),
    h('div', { class: 'stat' },
      h('div', { class: 'stat-value' }, last ? fmtDate(last.date) : '—'),
      h('div', { class: 'stat-label' }, 'Last workout')),
  );

  const progressItems = [];
  for (const id of EXERCISE_ORDER) {
    const ex = EXERCISES[id];
    const rec = progs[id];
    const lastEntry = await lastEntryFor(id, rec.level);
    const setsTxt = lastEntry && lastEntry.sets.some((r) => typeof r === 'number')
      ? lastEntry.sets.map((r) => (typeof r === 'number' ? r : '–')).join(' · ')
      : '—';
    const ready = lastEntry && isReadyToProgress(lastEntry.sets, ex.repRange);
    progressItems.push(h('div', { class: 'progress-item' },
      h('div', { class: 'progress-item-main' },
        h('span', { class: 'progress-item-name' }, ex.name),
        h('span', { class: 'progress-item-prog' }, progressionName(rec)),
      ),
      h('div', { class: 'progress-item-sets' },
        h('span', {}, setsTxt),
        ready ? h('span', { class: 'badge badge-accent', title: '3 sets at the top of the rep range — you may be ready for the next progression' }, 'ready ↑') : null,
      ),
    ));
  }

  root.append(
    h('section', { class: 'home-hero' },
      h('h1', { class: 'app-title' }, 'BWF Workout'),
      h('p', { class: 'app-subtitle' }, 'Reddit Bodyweight Fitness — Recommended Routine'),
    ),
    startBtn,
    stats,
    h('p', { class: 'schedule-note' }, nextSuggestion),
    h('div', { class: 'card-grid' },
      h('a', { class: 'card card-link', href: '#/progress' },
        h('div', { class: 'card-title' }, 'Progress'),
        h('div', { class: 'card-sub' }, 'Charts & progression status')),
      h('a', { class: 'card card-link', href: '#/history' },
        h('div', { class: 'card-title' }, 'History'),
        h('div', { class: 'card-sub' }, count ? `${count} workout${count === 1 ? '' : 's'} logged` : 'No workouts yet')),
      h('a', { class: 'card card-link', href: '#/settings' },
        h('div', { class: 'card-title' }, 'Settings'),
        h('div', { class: 'card-sub' }, `Rest ${settings.restPair}s / ${settings.restCore}s · theme ${settings.theme}`)),
    ),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title' }, 'Current progressions'),
      h('div', { class: 'card' }, progressItems),
    ),
  );
}
