/**
 * "Which control does this input belong to?"
 *
 * The physical pad presents itself to the OS as an ordinary keyboard/mouse, so
 * when the user presses a pad key while the studio is focused, the browser sees
 * e.g. `ctrl+alt+o`. We find the control whose binding produces that input and
 * select it, so the editor follows the user's hand.
 */

import { isControlName } from '../config/controls.js';
import { normalizeCombo } from './combo.js';

/** Every keystroke/action string a binding can produce, normalised. */
function bindingSignatures(binding) {
  return (Array.isArray(binding) ? binding : [binding]).map((item) =>
    normalizeCombo(String(item)),
  );
}

/**
 * Find the control in `layer` that emits `input`.
 *
 * Two passes, most specific first:
 *  1. exact match (order- and alias-insensitive: `win+a` == `meta+a`)
 *  2. loose match, when one side is a `+suffix` of the other. This catches the
 *     OS swallowing a modifier (e.g. a pad key bound to `shift+n` arriving as
 *     plain `n`) and only runs when nothing matched exactly.
 *
 * @param {Record<string, unknown>} layer a layer object from the config
 * @param {string} input combo or mouse action, e.g. `"ctrl+o"`, `"wheel_up"`
 * @returns {string | null} control name, or `null`
 */
export function findControlForInput(layer, input) {
  const target = normalizeCombo(input);
  const entries = Object.entries(layer ?? {})
    .filter(([name]) => isControlName(name))
    .map(([name, binding]) => ({ name, signatures: bindingSignatures(binding) }));

  const exact = entries.find(({ signatures }) => signatures.includes(target));
  if (exact) return exact.name;

  const loose = entries.find(({ signatures }) =>
    signatures.some((sig) => sig.endsWith(`+${target}`) || target.endsWith(`+${sig}`)),
  );
  return loose ? loose.name : null;
}
