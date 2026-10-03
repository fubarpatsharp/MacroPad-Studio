/**
 * Bindings: what a control does.
 *
 * In config JSON a binding is one of
 *   - `"none"` / missing                    -> disabled
 *   - `"play_pause"`, `"lclick"`, ...       -> media / mouse action
 *   - `"ctrl+c"`                            -> one keystroke
 *   - `["ctrl+a", "backspace"]`             -> macro (several keystrokes)
 *   - `"git status"`                        -> a typed phrase (expanded to a macro)
 *
 * The functions here are pure: they classify bindings and convert between a
 * binding and the editable list of macro "steps". No DOM, no device.
 */

import { MAX_MACRO_STEPS, UNBOUND } from '../config/constants.js';
import { badgeForAction, MEDIA_ACTION_IDS, MOUSE_ACTION_IDS } from '../config/actions.js';
import { KNOWN_KEY_IDS } from '../config/key-catalog.js';
import { canonicalModifier } from '../config/modifiers.js';
import { textToSteps } from './text-macro.js';

/** The four editor tabs. */
export const ActionKind = Object.freeze({
  MACRO: 'macro',
  MEDIA: 'media',
  MOUSE: 'mouse',
  DISABLED: 'disabled',
});

/** Is this value "nothing bound"? */
export function isUnbound(binding) {
  if (binding === undefined || binding === null || binding === '') return true;
  if (Array.isArray(binding)) return binding.length === 0;
  const text = String(binding).trim().toLowerCase();
  return text === UNBOUND || text === 'disabled';
}

/** Which editor tab does this binding belong to? */
export function classifyBinding(binding) {
  if (isUnbound(binding)) return ActionKind.DISABLED;
  if (typeof binding === 'string') {
    const id = binding.trim().toLowerCase();
    if (MEDIA_ACTION_IDS.has(id)) return ActionKind.MEDIA;
    if (MOUSE_ACTION_IDS.has(id)) return ActionKind.MOUSE;
  }
  return ActionKind.MACRO;
}

/** Raw HID usage id (e.g. `0x64`) for keys the app has no name for. */
const RAW_KEY_CODE = /^0x[0-9a-f]{1,2}$/;

/**
 * A single string is a keystroke if it contains `+`, or is a known key or
 * modifier name. Anything else (e.g. `"hello world"`) is a typed phrase.
 * (Same rule as the Python CLI.)
 */
export function isKeystroke(text) {
  const lower = String(text).trim().toLowerCase();
  return (
    lower.includes('+') ||
    KNOWN_KEY_IDS.has(lower) ||
    RAW_KEY_CODE.test(lower) ||
    canonicalModifier(lower) !== null
  );
}

/**
 * The editable list of keystrokes behind a macro binding. Phrases are expanded
 * to one step per character. Media, mouse and disabled bindings have no
 * keystrokes, so they yield an empty list.
 * @returns {string[]}
 */
export function bindingToSteps(binding) {
  if (classifyBinding(binding) !== ActionKind.MACRO) return [];

  const items = Array.isArray(binding) ? binding : [binding];
  const steps = [];

  for (const item of items) {
    if (isUnbound(item)) continue;
    const text = String(item);
    if (isKeystroke(text)) steps.push(text.trim().toLowerCase());
    else steps.push(...textToSteps(text).steps);
  }
  return steps.slice(0, MAX_MACRO_STEPS);
}

/** Inverse of `bindingToSteps` for storage: 0 steps -> none, 1 -> string, n -> array. */
export function stepsToBinding(steps) {
  if (steps.length === 0) return UNBOUND;
  return steps.length === 1 ? steps[0] : [...steps];
}

/** Short label for the keycap / knob display. */
export function describeBinding(binding) {
  switch (classifyBinding(binding)) {
    case ActionKind.DISABLED:
      return '-';
    case ActionKind.MEDIA:
    case ActionKind.MOUSE:
      return badgeForAction(String(binding).trim().toLowerCase()) ?? String(binding);
    default:
      break;
  }
  if (Array.isArray(binding)) return `[${binding.length}]`;
  const text = String(binding);
  return text.length > 7 ? `${text.slice(0, 6)}..` : text;
}
