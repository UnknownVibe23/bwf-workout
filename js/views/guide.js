import { h } from '../util.js';

const WIKI = 'https://www.reddit.com/r/bodyweightfitness/wiki';

function link(label, url) {
  return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'guide-link' }, label);
}

export async function guideView(root) {
  root.append(
    h('section', { class: 'section' },
      h('h1', { class: 'screen-title' }, 'Guide'),
      h('p', { class: 'muted' },
        'Official instructions for the Reddit Bodyweight Fitness Recommended Routine. ',
        'This app follows the strength work only — the guide\'s warm-up section is skipped here; add your own if you like.'),
    ),

    h('section', { class: 'section card guide-section' },
      h('h2', { class: 'section-title' }, 'How the workout works'),
      h('p', {}, 'There are nine exercises, performed in pairs and triplets to save time.'),
      h('ul', { class: 'guide-list' },
        h('li', {}, 'Pair 1: Pull-ups + Squats · Pair 2: Dips + Hinge · Pair 3: Rows + Push-ups — 3 sets of 5–8 reps each.'),
        h('li', {}, 'Pairing: do a set of the first exercise, rest 90 seconds, do a set of the second exercise, rest 90 seconds, and repeat until you\'ve done 3 sets of the pair.'),
        h('li', {}, 'Core triplet: Anti-extension, Anti-rotation, Extension — 3 sets of 8–12 reps each. Do a set of the first, rest 60 seconds, a set of the second, rest 60 seconds, a set of the third, rest 60 seconds, and repeat until all 3 sets of the triplet are done. No rest after the final set of the workout.'),
      ),
    ),

    h('section', { class: 'section card guide-section' },
      h('h2', { class: 'section-title' }, 'Rest time'),
      h('p', {}, '90 seconds between pair sets, 60 seconds between core sets. If 90 seconds is not enough and your reps drop (e.g. 8 reps in the first set but only 5–6 in the next set of the same exercise), you can rest up to 3 minutes. Quality is more important than reducing time. Each exercise still gets a minimum of ~3 minutes between its own sets because of the pairing.'),
    ),

    h('section', { class: 'section card guide-section' },
      h('h2', { class: 'section-title' }, 'Tempo'),
      h('p', {}, 'Ideally every rep is "10X0": 1 second down (eccentric), no pause at the bottom, explode up (X), no pause at the top. If the movement is actually slow on the way up, that\'s okay — the intent matters.'),
    ),

    h('section', { class: 'section card guide-section' },
      h('h2', { class: 'section-title' }, 'Rep strategy'),
      h('p', {}, 'Don\'t work to failure in the first sets. If your max is 8 pull-ups, aim for something like 7-7-7 instead of 8-6-5 — one rep short of failure keeps later sets high quality and maximizes total volume.'),
    ),

    h('section', { class: 'section card guide-section' },
      h('h2', { class: 'section-title' }, 'Progressions'),
      h('p', {}, 'For each exercise, do the hardest progression level you can complete for 3 sets of 5–8 reps (8–12 for core). Try to beat your previous numbers every workout. When you hit 3 sets of 8 (or 12 for core) with good form, move to the next level and start the next workout with 3 sets of 5 again.'),
      h('p', {}, 'Static holds (e.g. arch hangs, support hold, plank) are timed: one set is holding the position for 10–30 seconds. Move on once you can hold 30 seconds for all 3 sets.'),
      h('p', {}, 'The core exercises have alternate progression paths in the official guide — you can pick a path per exercise in the app (workout setup or Progress screen).'),
    ),

    h('section', { class: 'section card guide-section' },
      h('h2', { class: 'section-title' }, 'Schedule'),
      h('p', {}, 'Do this 3 times a week, with at least one rest day (or skill day) between workout days — e.g. Monday / Wednesday / Friday. It\'s a full-body workout; don\'t split it across days.'),
    ),

    h('section', { class: 'section card guide-section' },
      h('h2', { class: 'section-title' }, 'Official sources'),
      h('ul', { class: 'guide-list' },
        h('li', {}, link('Recommended Routine (main page)', `${WIKI}/kb/recommended_routine/`)),
        h('li', {}, link('Pull-up progression', `${WIKI}/exercises/pullup/`)),
        h('li', {}, link('Squat progression', `${WIKI}/exercises/squat/`)),
        h('li', {}, link('Dipping progression', `${WIKI}/exercises/dip/`)),
        h('li', {}, link('Hinge progression', `${WIKI}/exercises/hinge/`)),
        h('li', {}, link('Row progression', `${WIKI}/exercises/row/`)),
        h('li', {}, link('Push-up progression', `${WIKI}/exercises/pushup/`)),
        h('li', {}, link('Core progressions (incl. alternate paths)', `${WIKI}/exercises/core/`)),
      ),
    ),
  );
}
