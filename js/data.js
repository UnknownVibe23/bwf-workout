export const PAIRS = [
  { label: 'Pair 1', exercises: ['pullups', 'squats'] },
  { label: 'Pair 2', exercises: ['dips', 'hinge'] },
  { label: 'Pair 3', exercises: ['rows', 'pushups'] },
];

export const CORE = ['antiExtension', 'antiRotation', 'extension'];

export const EXERCISES = {
  pullups: {
    id: 'pullups',
    name: 'Pull-ups',
    group: 'pair',
    repRange: [5, 8],
    defaultProgressions: [
      'Scapular pulls',
      'Arch hangs',
      'Pull-up negatives',
      'Pull-ups',
      'Weighted pull-ups',
    ],
  },
  squats: {
    id: 'squats',
    name: 'Squats',
    group: 'pair',
    repRange: [5, 8],
    defaultProgressions: [
      'Assisted squat',
      'Squat',
      'Split squat',
      'Bulgarian split squat',
      'Beginner shrimp squat',
      'Intermediate shrimp squat',
      'Advanced shrimp squat',
      'Weighted shrimp squats',
    ],
  },
  dips: {
    id: 'dips',
    name: 'Dips',
    group: 'pair',
    repRange: [5, 8],
    defaultProgressions: [
      'Parallel bar support hold',
      'Negative dips',
      'Parallel bar dips',
      'Weighted dips',
    ],
  },
  hinge: {
    id: 'hinge',
    name: 'Hinge',
    group: 'pair',
    repRange: [5, 8],
    defaultProgressions: [
      'Romanian deadlift',
      'Single-legged deadlift',
      'Banded Nordic curl negatives',
      'Banded Nordic curl',
      'Nordic curls',
    ],
  },
  rows: {
    id: 'rows',
    name: 'Rows',
    group: 'pair',
    repRange: [5, 8],
    defaultProgressions: [
      'Vertical rows',
      'Incline rows',
      'Horizontal rows',
      'Wide rows',
      'Weighted inverted rows',
    ],
  },
  pushups: {
    id: 'pushups',
    name: 'Push-ups',
    group: 'pair',
    repRange: [5, 8],
    defaultProgressions: [
      'Vertical push-up',
      'Incline push-up',
      'Full push-up',
      'Diamond push-up',
      'Pseudo planche push-up',
    ],
  },
  antiExtension: {
    id: 'antiExtension',
    name: 'Anti-extension',
    group: 'core',
    repRange: [8, 12],
    defaultProgressions: [
      'Plank',
      'Ring ab rollouts',
    ],
    // Alternate progression paths from the official wiki (path 0 = main).
    altPaths: [
      ['Kneeling ab wheel rollouts', 'Standing ab wheel rollouts'],
      ['Tucked hanging leg raises', 'Pike hanging leg raises negative', 'Straight hanging leg raises'],
      ['Pike compressions'],
    ],
  },
  antiRotation: {
    id: 'antiRotation',
    name: 'Anti-rotation',
    group: 'core',
    repRange: [8, 12],
    defaultProgressions: [
      'Banded Pallof press',
    ],
    altPaths: [
      ['Assisted knee Copenhagen plank', 'Knee Copenhagen plank', 'Assisted Copenhagen plank', 'Copenhagen plank', 'Copenhagen plank with movement'],
      ['Ring Pallof press'],
    ],
  },
  extension: {
    id: 'extension',
    name: 'Extension',
    group: 'core',
    repRange: [8, 12],
    defaultProgressions: [
      'Reverse hyperextension',
    ],
    altPaths: [
      ['Arch raises', 'Arch body hold', 'Arch body rocks'],
      ['Hyper extension'],
    ],
  },
};

export const EXERCISE_ORDER = [
  ...PAIRS.flatMap((p) => p.exercises),
  ...CORE,
];

export const SETS_PER_EXERCISE = 3;

export function exerciseById(id) {
  return EXERCISES[id];
}

export function restKindFor(exerciseId) {
  return EXERCISES[exerciseId].group === 'core' ? 'core' : 'pair';
}
