/**
 * Turn typed text into a macro: one keystroke per character.
 *
 * Mirrors `_string_to_macro` in the Python CLI, so a phrase typed into the
 * studio behaves exactly like the same phrase in `macropad.json`.
 * US keyboard layout is assumed (that is what the pad's firmware emits).
 */

import { MAX_MACRO_STEPS } from '../config/constants.js';

/** Characters that need Shift, mapped to the base key they share. */
const SHIFTED_SYMBOLS = {
  '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8',
  '(': '9', ')': '0', _: 'minus', '+': 'equal', '{': 'lbracket', '}': 'rbracket',
  '|': 'backslash', ':': 'semicolon', '"': 'quote', '<': 'comma', '>': 'period',
  '?': 'slash', '~': 'grave',
};

/** Characters that map to a named key without Shift. */
const PLAIN_SYMBOLS = {
  ' ': 'space', '\n': 'enter', '\t': 'tab', '-': 'minus', '=': 'equal',
  '[': 'lbracket', ']': 'rbracket', '\\': 'backslash', ';': 'semicolon',
  "'": 'quote', '`': 'grave', ',': 'comma', '.': 'period', '/': 'slash',
};

/** @returns {string | null} combo string for one character, or `null` if untypeable */
function characterToStep(char) {
  if (Object.hasOwn(SHIFTED_SYMBOLS, char)) return `shift+${SHIFTED_SYMBOLS[char]}`;
  if (Object.hasOwn(PLAIN_SYMBOLS, char)) return PLAIN_SYMBOLS[char];
  if (/^[a-z0-9]$/.test(char)) return char;
  if (/^[A-Z]$/.test(char)) return `shift+${char.toLowerCase()}`;
  return null;
}

/**
 * @param {string} text
 * @param {number} [limit] stop after this many steps
 * @returns {{ steps: string[], skipped: string[], truncated: boolean }}
 *   `skipped` lists characters with no key on a US layout (e.g. emoji, `é`).
 */
export function textToSteps(text, limit = MAX_MACRO_STEPS) {
  const steps = [];
  const skipped = [];
  let truncated = false;

  for (const char of text) {
    const step = characterToStep(char);
    if (step === null) {
      if (!skipped.includes(char)) skipped.push(char);
    } else if (steps.length < limit) {
      steps.push(step);
    } else {
      truncated = true;
    }
  }
  return { steps, skipped, truncated };
}
