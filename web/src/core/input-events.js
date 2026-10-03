/**
 * Translate browser input events into the pad's vocabulary (combo strings
 * such as `"ctrl+shift+a"`, `"wheel_up"`, `"lclick"`).
 *
 * Keys are identified by `KeyboardEvent.code` (physical position) rather than
 * `.key` (layout-dependent character), because USB HID usage ids are also
 * positional: Shift+1 is `shift+1` on every layout, never `!`.
 */

import { formatCombo } from './combo.js';

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'OS', 'AltGraph']);

/** `KeyboardEvent.code` values whose pad name is not just the lowercased code. */
const CODE_NAMES = Object.freeze({
  Space: 'space', Escape: 'esc', Enter: 'enter', Tab: 'tab', Backspace: 'backspace',
  Delete: 'delete', Insert: 'insert', Home: 'home', End: 'end',
  PageUp: 'pageup', PageDown: 'pagedown',
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Minus: 'minus', Equal: 'equal', BracketLeft: 'lbracket', BracketRight: 'rbracket',
  Backslash: 'backslash', Semicolon: 'semicolon', Quote: 'quote', Backquote: 'grave',
  Comma: 'comma', Period: 'period', Slash: 'slash',
  CapsLock: 'capslock', PrintScreen: 'printscreen', ScrollLock: 'scrolllock', Pause: 'pause',
  NumLock: 'kp_numlock', NumpadDivide: 'kp_slash', NumpadMultiply: 'kp_asterisk',
  NumpadSubtract: 'kp_minus', NumpadAdd: 'kp_plus', NumpadEnter: 'kp_enter',
  NumpadDecimal: 'kp_dot',
});

/** Dedicated media keys are only reported through `.key`. */
const MEDIA_KEY_NAMES = Object.freeze({
  MediaPlayPause: 'play_pause', MediaPlay: 'play_pause',
  MediaTrackNext: 'next_track', MediaTrackPrevious: 'prev_track',
  AudioVolumeUp: 'volume_up', AudioVolumeDown: 'volume_down', AudioVolumeMute: 'mute',
});

/** True for events from a bare modifier key (Ctrl, Shift, ...). */
export const isModifierKey = (event) => MODIFIER_KEYS.has(event.key);

/** Pad key name for the non-modifier key in `event`, or `''` if there is none. */
export function keyNameFromEvent(event) {
  if (isModifierKey(event)) return '';
  if (Object.hasOwn(MEDIA_KEY_NAMES, event.key)) return MEDIA_KEY_NAMES[event.key];

  const { code = '' } = event;
  if (Object.hasOwn(CODE_NAMES, code)) return CODE_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `kp_${code.slice(6).toLowerCase()}`;
  if (/^F\d{1,2}$/.test(code)) return code.toLowerCase();

  return String(event.key ?? '').toLowerCase();
}

/**
 * Full combo for a keydown event (e.g. `"ctrl+shift+a"`), or `''` for a bare
 * modifier press.
 */
export function comboFromKeyEvent(event) {
  const key = keyNameFromEvent(event);
  if (!key) return '';

  const modifiers = [];
  if (event.ctrlKey) modifiers.push('ctrl');
  if (event.shiftKey) modifiers.push('shift');
  if (event.altKey) modifiers.push('alt');
  if (event.metaKey) modifiers.push('meta');
  return formatCombo({ modifiers, key });
}

/** Mouse button index (`MouseEvent.button`) -> pad mouse action. */
export const mouseActionFromButton = (button) =>
  ({ 0: 'lclick', 1: 'mclick', 2: 'rclick' })[button] ?? 'lclick';

/** Wheel event -> pad mouse action. */
export const wheelActionFromEvent = (event) => (event.deltaY < 0 ? 'wheel_up' : 'wheel_down');
