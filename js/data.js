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
      'Scapular pull-ups',
      'Negative pull-ups',
      'Assisted pull-ups',
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
      'Assisted squats',
      'Bodyweight squats',
      'Bulgarian split squats',
      'Shrimp squats',
      'Pistol squats (assisted)',
    ],
  },
  dips: {
    id: 'dips',
    name: 'Dips',
    group: 'pair',
    repRange: [5, 8],
    defaultProgressions: [
      'Support holds',
      'Negative dips',
      'Assisted dips',
      'Full dips',
      'Weighted dips',
    ],
  },
  hinge: {
    id: 'hinge',
    name: 'Hinge',
    group: 'pair',
    repRange: [5, 8],
    defaultProgressions: [
      'Glute bridge',
      'Single-leg glute bridge',
      'Back extension (hold)',
      'Nordic curl (negative)',
      'Nordic hamstring curl',
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
      'Archer rows',
      'Front lever rows',
    ],
  },
  pushups: {
    id: 'pushups',
    name: 'Push-ups',
    group: 'pair',
    repRange: [5, 8],
    defaultProgressions: [
      'Wall push-ups',
      'Incline push-ups',
      'Knee push-ups',
      'Standard push-ups',
      'Diamond push-ups',
      'Archer push-ups',
    ],
  },
  antiExtension: {
    id: 'antiExtension',
    name: 'Anti-extension',
    group: 'core',
    repRange: [8, 12],
    defaultProgressions: [
      'Dead bug',
      'Plank',
      'Ab wheel rollout (knees)',
      'Ab wheel rollout (standing)',
    ],
  },
  antiRotation: {
    id: 'antiRotation',
    name: 'Anti-rotation',
    group: 'core',
    repRange: [8, 12],
    defaultProgressions: [
      'Bird dog',
      'Pallof press (kneeling)',
      'Pallof press (standing)',
      'Single-arm Pallof press',
    ],
  },
  extension: {
    id: 'extension',
    name: 'Extension',
    group: 'core',
    repRange: [8, 12],
    defaultProgressions: [
      'Reverse hyperextension',
      'Back extension (hold)',
      'Back extensions',
      'Weighted back extensions',
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
