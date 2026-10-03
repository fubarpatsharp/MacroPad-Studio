/**
 * Keyboard modifiers.
 *
 * Bit values are the USB HID modifier byte (HID Usage Tables, keyboard page).
 * Config files and users spell modifiers in many ways (`win`, `cmd`, `gui`...);
 * `canonicalModifier` collapses every spelling to a single canonical name so
 * the rest of the app never has to care.
 */

export const MODIFIER_BITS = Object.freeze({
  ctrl: 0x01,
  shift: 0x02,
  alt: 0x04,
  meta: 0x08,
  rctrl: 0x10,
  rshift: 0x20,
  ralt: 0x40,
  rmeta: 0x80,
});

const ALIASES = Object.freeze({
  control: 'ctrl',
  win: 'meta',
  cmd: 'meta',
  gui: 'meta',
  lmeta: 'meta',
  altgr: 'ralt',
  rwin: 'rmeta',
  rcmd: 'rmeta',
  rgui: 'rmeta',
});

/**
 * Canonical display/serialisation order. Left-hand modifiers first, so
 * `ctrl+shift+alt+meta+<key>` is always written the same way.
 */
export const MODIFIER_ORDER = Object.freeze(Object.keys(MODIFIER_BITS));

/** The four modifiers exposed as toggle chips in the macro editor. */
export const EDITOR_MODIFIERS = Object.freeze([
  { id: 'ctrl', label: 'Ctrl' },
  { id: 'shift', label: 'Shift' },
  { id: 'alt', label: 'Alt' },
  { id: 'meta', label: 'Win' },
]);

/** `"Win"` -> `"meta"`, `"ctrl"` -> `"ctrl"`, unknown -> `null`. */
export function canonicalModifier(name) {
  const key = String(name).trim().toLowerCase();
  if (Object.hasOwn(MODIFIER_BITS, key)) return key;
  return Object.hasOwn(ALIASES, key) ? ALIASES[key] : null;
}

/** Combine modifier names into a HID modifier byte. Unknown names are ignored. */
export function modifiersToMask(names) {
  let mask = 0;
  for (const name of names) {
    const canonical = canonicalModifier(name);
    if (canonical) mask |= MODIFIER_BITS[canonical];
  }
  return mask;
}

/** Inverse of `modifiersToMask`; result is in `MODIFIER_ORDER`. */
export function maskToModifiers(mask) {
  return MODIFIER_ORDER.filter((name) => (mask & MODIFIER_BITS[name]) !== 0);
}
