import { h, fmtDate } from '../util.js';
import { EXERCISES, EXERCISE_ORDER } from '../data.js';
import { isReadyToProgress, targetFor } from '../engine.js';
import { getAllWorkouts, getAllProgressions, progressionName, setProgressionLevel, setProgressionPath, lastEntryFor } from '../store.js';

function svgEl(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children.flat()) if (c) el.append(c);
  return el;
}

function barChart(values, labels, unit) {
  const max = Math.max(1, ...values.map((v) => v.value));
  const W = 260;
  const H = 72;
  const bw = W / values.length;
  const bars = values.map((v, i) => {
    const bh = Math.max(3, (v.value / max) * (H - 16));
    const rect = svgEl('rect', {
      x: String(i * bw + 2),
      y: String(H - 12 - bh),
      width: String(Math.max(1, bw - 4)),
      height: String(bh),
      rx: '2',
      class: 'chart-bar',
    });
    const title = svgEl('title');
    title.textContent = `${labels[i]}: ${v.value}${unit}`;
    rect.append(title);
    return rect;
  });
  return svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' },
    svgEl('line', { x1: '0', y1: String(H - 12), x2: String(W), y2: String(H - 12), class: 'chart-axis' }),
    bars,
  );
}

export async function progressView(root) {
  const [workouts, progs] = await Promise.all([getAllWorkouts(), getAllProgressions()]);

  const cards = [];
  for (const id of EXERCISE_ORDER) {
    const ex = EXERCISES[id];
    const rec = progs[id];
    const lastEntry = await lastEntryFor(id, rec.level, rec.path);
    const target = targetFor(ex, progressionName(rec));
    const unit = target.unit === 'seconds' ? 's' : '';
    const ready = lastEntry && isReadyToProgress(lastEntry.sets, target.range);

    const history = workouts
      .filter((w) => w.exercises && w.exercises[id])
      .slice(0, 12)
      .reverse();
    const values = history.map((w) => ({
      value: (w.exercises[id].sets || []).reduce((s, r) => s + (typeof r === 'number' ? r : 0), 0),
    }));
    const labels = history.map((w) => fmtDate(w.date));
    const best = values.length ? Math.max(...values.map((v) => v.value)) : 0;

    const sel = h('select', { class: 'select select-inline', 'aria-label': `${ex.name} progression` },
      rec.list.map((name, i) => h('option', { value: String(i), selected: i === rec.level ? true : null }, name)),
    );
    sel.addEventListener('change', async () => {
      await setProgressionLevel(id, parseInt(sel.value, 10));
      root.innerHTML = '';
      await progressView(root);
    });

    const headControls = [sel];
    if (rec.pathCount > 1) {
      const pathSel = h('select', { class: 'select select-inline', 'aria-label': `${ex.name} progression path` },
        Array.from({ length: rec.pathCount }, (_, i) =>
          h('option', { value: String(i), selected: i === rec.path ? true : null }, i === 0 ? 'Main path' : `Alt path ${i}`)),
      );
      pathSel.addEventListener('change', async () => {
        await setProgressionPath(id, parseInt(pathSel.value, 10));
        root.innerHTML = '';
        await progressView(root);
      });
      headControls.unshift(pathSel);
    }

    cards.push(h('div', { class: 'card progress-card' },
      h('div', { class: 'progress-card-head' },
        h('div', {},
          h('div', { class: 'progress-item-name' }, ex.name),
          h('div', { class: 'progress-item-prog' },
            (target.unit === 'seconds'
              ? `Hold ${target.range[0]}–${target.range[1]}s · best ${best}s`
              : `Rep range ${target.range[0]}–${target.range[1]} · best ${best} reps`) +
            (ready ? ' · 3× top of range — ready to progress ↑' : '')),
        ),
        h('div', { class: 'progress-card-controls' }, headControls),
      ),
      lastEntry && lastEntry.sets.some((r) => typeof r === 'number')
        ? h('div', { class: 'chips' }, lastEntry.sets.map((r, i) => h('span', { class: r == null ? 'chip chip-skipped' : 'chip' }, `S${i + 1}: ${typeof r === 'number' ? `${r}${unit}` : '–'}`)))
        : h('p', { class: 'muted' }, 'No sets logged yet at this progression.'),
      values.length ? barChart(values, labels, unit) : null,
      ready ? h('p', { class: 'badge badge-accent badge-block' }, target.unit === 'seconds'
        ? `You held ${target.range[1]}s for all 3 sets — you may move to the next progression when ready.`
        : 'You reached 3 sets at the top of the rep range — you may move to the next progression when ready.') : null,
    ));
  }

  root.append(
    h('section', { class: 'section' },
      h('h1', { class: 'screen-title' }, 'Progress'),
      h('p', { class: 'muted' },
        'Start at 3 sets of the low end of the range, add reps each session, and move to the next progression once you can do 3 sets at the top of the range with good form. Changing progression resets the suggested target to the low end.'),
    ),
    h('section', { class: 'section stack' }, cards),
  );
}
