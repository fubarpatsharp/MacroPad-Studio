/**
 * The physical controls of the pad and helpers to name them.
 *
 * Control names are the keys used in the config JSON (and match the Python
 * CLI's `macropad.json` format): `key1`..`key12`, and
 * `knob{1..3}_{left|press|right}`.
 */

export const KEY_COUNT = 12;
export const KNOB_COUNT = 3;

export const KEY_CONTROLS = Object.freeze(
  Array.from({ length: KEY_COUNT }, (_, i) => `key${i + 1}`),
);

export const KNOB_NUMBERS = Object.freeze(
  Array.from({ length: KNOB_COUNT }, (_, i) => i + 1),
);

export const KNOB_GESTURES = Object.freeze(['left', 'press', 'right']);

const GESTURE_LABELS = { left: 'Turn Left', press: 'Press', right: 'Turn Right' };

export const knobControl = (knob, gesture) => `knob${knob}_${gesture}`;

/** Every valid control name, in display order. */
export const CONTROL_NAMES = Object.freeze([
  ...KEY_CONTROLS,
  ...KNOB_NUMBERS.flatMap((n) => KNOB_GESTURES.map((g) => knobControl(n, g))),
]);

const CONTROL_SET = new Set(CONTROL_NAMES);

/** True for names of physical controls (as opposed to `led`, `delay`, `_comment`). */
export const isControlName = (name) => CONTROL_SET.has(name);

export const isKeyControl = (name) => /^key\d+$/.test(name);

/** `"knob2_left"` -> `{ knob: 2, gesture: "left" }`; `null` for anything else. */
export function parseKnobControl(name) {
  const match = /^knob(\d+)_(left|press|right)$/.exec(name);
  return match ? { knob: Number(match[1]), gesture: match[2] } : null;
}

/** `"key3"` -> `"Key 3"`, `"knob1_left"` -> `"Knob 1 · Turn Left"`. */
export function formatControlTitle(name) {
  if (isKeyControl(name)) return `Key ${name.slice(3)}`;
  const knob = parseKnobControl(name);
  if (knob) return `Knob ${knob.knob} · ${GESTURE_LABELS[knob.gesture]}`;
  return name;
}
