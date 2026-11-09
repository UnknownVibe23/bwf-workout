import { h, confirmModal, downloadJson } from '../util.js';
import { EXERCISES, EXERCISE_ORDER } from '../data.js';
import {
  settings, setSetting, getAllProgressions, setProgressionList,
  exportData, importData, resetWorkoutData,
} from '../store.js';

function numberField(label, key, min, max) {
  const input = h('input', {
    class: 'input', type: 'number', inputmode: 'numeric', min: String(min), max: String(max),
    value: String(settings[key]),
  });
  input.addEventListener('change', async () => {
    let v = parseInt(input.value, 10);
    if (isNaN(v)) v = min;
    v = Math.min(max, Math.max(min, v));
    input.value = String(v);
    await setSetting(key, v);
  });
  return h('label', { class: 'setting-row' },
    h('span', { class: 'setting-label' }, label), input);
}

function toggleField(label, key) {
  const input = h('input', { type: 'checkbox' });
  if (settings[key]) input.checked = true;
  input.addEventListener('change', () => setSetting(key, input.checked));
  return h('label', { class: 'setting-row' },
    h('span', { class: 'setting-label' }, label),
    h('span', { class: 'switch' }, input));
}

export async function settingsView(root) {
  const progs = await getAllProgressions();

  const themeSel = h('select', { class: 'select' },
    h('option', { value: 'dark', selected: settings.theme === 'dark' ? true : null }, 'Dark'),
    h('option', { value: 'light', selected: settings.theme === 'light' ? true : null }, 'Light'),
  );
  themeSel.addEventListener('change', () => setSetting('theme', themeSel.value));

  const exportBtn = h('button', {
    class: 'btn btn-secondary btn-block',
    onclick: async () => {
      const data = await exportData();
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      downloadJson(`bwf-backup-${stamp}.json`, data);
    },
  }, '⬇ Export workout history (JSON)');

  const importInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'input-file' });
  importInput.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importData(JSON.parse(text));
      confirmModal({
        title: 'Import complete',
        message: 'Workout history, progressions and settings were restored from the backup file.',
        actions: [{ label: 'OK', class: 'btn-primary' }],
      });
    } catch (err) {
      confirmModal({
        title: 'Import failed',
        message: `The file could not be read as a valid backup: ${err.message}`,
        actions: [{ label: 'OK', class: 'btn-primary' }],
      });
    }
    importInput.value = '';
  });

  const resetBtn = h('button', {
    class: 'btn btn-danger btn-block',
    onclick: () => confirmModal({
      title: 'Reset all workout data?',
      message: 'Deletes all workout history, the in-progress workout and progression selections. Settings are kept. This cannot be undone — export a backup first if you want to keep your data.',
      actions: [
        { label: 'Cancel', class: 'btn-secondary' },
        {
          label: 'Reset everything', class: 'btn-danger',
          onClick: async () => {
            await resetWorkoutData();
            location.hash = '#/';
          },
        },
      ],
    }),
  }, '🗑 Reset workout data');

  const progEditors = EXERCISE_ORDER.map((id) => {
    const rec = progs[id];
    const input = h('input', { class: 'input input-list', type: 'text', value: rec.list.join(', ') });
    const save = h('button', {
      class: 'btn btn-secondary',
      onclick: async () => {
        await setProgressionList(id, input.value.split(','));
        input.value = (await getAllProgressions())[id].list.join(', ');
      },
    }, 'Save');
    return h('div', { class: 'prog-editor' },
      h('div', { class: 'setting-label' }, EXERCISES[id].name),
      h('div', { class: 'prog-editor-row' }, input, save));
  });

  root.append(
    h('section', { class: 'section' }, h('h1', { class: 'screen-title' }, 'Settings')),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title' }, 'Rest timers'),
      h('div', { class: 'card' },
        numberField('Rest between pair sets (seconds)', 'restPair', 10, 600),
        numberField('Rest between core sets (seconds)', 'restCore', 10, 600),
      ),
    ),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title' }, 'Notifications & display'),
      h('div', { class: 'card' },
        toggleField('Sound when rest timer ends', 'sound'),
        toggleField('Keep screen awake during workout', 'wakeLock'),
        h('label', { class: 'setting-row' },
          h('span', { class: 'setting-label' }, 'Theme'), themeSel),
      ),
    ),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title' }, 'Data'),
      h('div', { class: 'card stack' },
        exportBtn,
        h('label', { class: 'setting-row' },
          h('span', { class: 'setting-label' }, 'Import backup (JSON)'), importInput),
        resetBtn,
      ),
    ),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title' }, 'Progression lists (comma separated, easiest → hardest)'),
      h('div', { class: 'card stack' }, progEditors),
    ),
  );
}
