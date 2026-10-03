/**
 * Key-combo strings: `"ctrl+shift+a"`, `"alt+f4"`, `"wheel_up"`...
 *
 * A combo is zero or more modifiers followed by one key name, joined by `+`.
 * This module is the only place that knows how to split and join them.
 *
 * Conventions (shared with the Python CLI so config files are portable):
 *  - modifier-only combos are allowed (`"ctrl"`); their key is `"none"`
 *  - a literal plus sign is written `"+"` / `"ctrl++"` and means Shift+`=`
 */

import { canonicalModifier, MODIFIER_ORDER } from '../config/modifiers.js';
import { UNBOUND } from '../config/constants.js';

/** @typedef {{ modifiers: string[], key: string }} Combo */

/**
 * Parse a combo string. Modifier spellings are canonicalised and ordered, so
 * `"Win+Ctrl+A"` and `"ctrl+meta+a"` parse identically.
 * @param {string} text
 * @returns {Combo}
 */
export function parseCombo(text) {
  const source = String(text ?? '').trim().toLowerCase();
  const modifiers = new Set();

  // The literal "+" key is typed as Shift+"=" on a US layout.
  let rest = source;
  if (rest === '+' || rest.endsWith('++')) {
    modifiers.add('shift');
    rest = rest === '+' ? '=' : `${rest.slice(0, -2)}+=`;
  }

  const parts = rest.split('+').map((p) => p.trim()).filter(Boolean);
  let key = UNBOUND;

  parts.forEach((part, index) => {
    const modifier = canonicalModifier(part);
    const isLast = index === parts.length - 1;
    if (modifier) modifiers.add(modifier);
    else if (isLast) key = part === '=' ? 'equal' : part;
    // A non-modifier word in the middle (e.g. "foo+a") is malformed; drop it.
  });

  return { modifiers: MODIFIER_ORDER.filter((m) => modifiers.has(m)), key };
}

/**
 * Serialise a combo back to its canonical string.
 * @param {Combo} combo
 */
export function formatCombo({ modifiers, key }) {
  const ordered = MODIFIER_ORDER.filter((m) => modifiers.includes(m));
  const parts = key === UNBOUND && ordered.length > 0 ? ordered : [...ordered, key];
  return parts.join('+');
}

/** Canonical spelling of a combo string (order- and alias-insensitive). */
export const normalizeCombo = (text) => formatCombo(parseCombo(text));

/** Return `combo` with `modifier` switched on/off (aliases accepted). */
export function toggleModifier(combo, modifier) {
  const canonical = canonicalModifier(modifier);
  if (!canonical) return combo;
  const modifiers = combo.modifiers.includes(canonical)
    ? combo.modifiers.filter((m) => m !== canonical)
    : [...combo.modifiers, canonical];
  return { ...combo, modifiers };
}
