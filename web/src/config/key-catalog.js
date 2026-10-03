/**
 * Keyboard keys offered in the macro editor, grouped for the <select> menu.
 *
 * `code` is the canonical key name used in config files; `protocol/usb-codes.js`
 * maps each to a USB HID usage id (a unit test asserts full coverage).
 */

const key = (code, label = code.toUpperCase()) => ({ code, label });
const range = (prefix, from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => key(`${prefix}${from + i}`));

const LETTERS = [...'abcdefghijklmnopqrstuvwxyz'].map((c) => key(c));
const DIGITS = [...'1234567890'].map((c) => key(c, c));

export const KEY_CATEGORIES = Object.freeze([
  { name: 'Alphanumeric', keys: [...LETTERS, ...DIGITS] },
  {
    name: 'Navigation & Editing',
    keys: [
      key('enter', 'Enter ↵'), key('space', 'Space ␣'), key('backspace', 'Backspace ⌫'),
      key('tab', 'Tab ⇥'), key('esc', 'Escape ⎋'), key('delete', 'Delete ⌦'),
      key('insert', 'Insert'), key('home', 'Home ↖'), key('end', 'End ↘'),
      key('pageup', 'Page Up ⇞'), key('pagedown', 'Page Down ⇟'),
      key('up', 'Arrow Up ↑'), key('down', 'Arrow Down ↓'),
      key('left', 'Arrow Left ←'), key('right', 'Arrow Right →'),
    ],
  },
  { name: 'Function Keys', keys: range('f', 1, 12) },
  { name: 'Extended Function (F13–F24)', keys: range('f', 13, 24) },
  {
    name: 'Symbols & Punctuation',
    keys: [
      key('minus', 'Minus (-)'), key('equal', 'Equal (=)'),
      key('lbracket', 'Left Bracket ([)'), key('rbracket', 'Right Bracket (])'),
      key('backslash', 'Backslash (\\)'), key('semicolon', 'Semicolon (;)'),
      key('quote', "Quote (')"), key('grave', 'Grave Accent (`)'),
      key('comma', 'Comma (,)'), key('period', 'Period (.)'), key('slash', 'Slash (/)'),
      key('capslock', 'Caps Lock ⇪'), key('printscreen', 'Print Screen'),
      key('scrolllock', 'Scroll Lock'), key('pause', 'Pause'),
    ],
  },
  {
    name: 'Numpad',
    keys: [
      key('kp_numlock', 'Num Lock'), key('kp_slash', 'Numpad /'),
      key('kp_asterisk', 'Numpad *'), key('kp_minus', 'Numpad -'),
      key('kp_plus', 'Numpad +'), key('kp_enter', 'Numpad Enter'),
      key('kp_dot', 'Numpad .'),
      ...Array.from({ length: 10 }, (_, i) => key(`kp_${i}`, `Numpad ${i}`)),
    ],
  },
  {
    // A step that only presses modifiers (e.g. a bare Ctrl) has no base key.
    name: 'Other',
    keys: [key('none', '— (modifiers only)')],
  },
]);

/** Every key id the editor knows about (used to tell key names from typed text). */
export const KNOWN_KEY_IDS = new Set(
  KEY_CATEGORIES.flatMap((category) => category.keys.map((k) => k.code)),
);
