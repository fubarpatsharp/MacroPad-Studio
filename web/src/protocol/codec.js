/**
 * Codec between config bindings (`"ctrl+c"`, `["a","b"]`, `"mute"`...) and the
 * binary-oriented "wire bindings" the transport sends and receives:
 *
 *   { mode: Mode.KEYBOARD, keys: [[modifierMask, keyCode], ...] }
 *   { mode: Mode.MEDIA,    consumerCode }
 *   { mode: Mode.MOUSE,    buttonMask, wheel }
 *
 * Pure functions, no I/O, so the whole encode/decode surface is unit-tested.
 */

import { MAX_MACRO_STEPS } from '../config/constants.js';
import { maskToModifiers, modifiersToMask } from '../config/modifiers.js';
import { ledColorId, layerLighting } from '../config/led.js';
import { ActionKind, bindingToSteps, classifyBinding } from '../core/bindings.js';
import { formatCombo, parseCombo } from '../core/combo.js';
import {
  KEY_CODES, KEY_NAMES, MEDIA_CODES, MEDIA_NAMES, MOUSE_CODES, Mode,
} from './usb-codes.js';

/** Thrown when a binding cannot be represented on the device. */
export class EncodeError extends Error {
  name = 'EncodeError';
}

const HEX_KEY = /^0x[0-9a-f]{1,2}$/i;

/** Key name -> HID usage id. Raw hex (`0x64`) is accepted for codes without a name. */
function keyCode(name) {
  if (Object.hasOwn(KEY_CODES, name)) return KEY_CODES[name];
  if (HEX_KEY.test(name)) return Number.parseInt(name, 16);
  throw new EncodeError(`Unknown key "${name}"`);
}

// ----------------------------------------------------------------- encoding --

/**
 * @param {unknown} binding a value from the config
 * @returns {object} wire binding
 * @throws {EncodeError} if a key is unknown or the macro is too long
 */
export function bindingToWire(binding) {
  switch (classifyBinding(binding)) {
    case ActionKind.DISABLED:
      return { mode: Mode.KEYBOARD, keys: [[0, 0]] };

    case ActionKind.MEDIA:
      return { mode: Mode.MEDIA, consumerCode: MEDIA_CODES[String(binding).trim().toLowerCase()] };

    case ActionKind.MOUSE: {
      const [buttonMask, wheel] = MOUSE_CODES[String(binding).trim().toLowerCase()];
      return { mode: Mode.MOUSE, buttonMask, wheel };
    }

    default: {
      const steps = bindingToSteps(binding);
      if (steps.length > MAX_MACRO_STEPS) {
        throw new EncodeError(`Macro has ${steps.length} steps; the limit is ${MAX_MACRO_STEPS}`);
      }
      const keys = steps.map((step) => {
        const { modifiers, key } = parseCombo(step);
        return [modifiersToMask(modifiers), keyCode(key)];
      });
      return { mode: Mode.KEYBOARD, keys: keys.length > 0 ? keys : [[0, 0]] };
    }
  }
}

/**
 * LED settings of a layer as firmware ids.
 * @returns {{ colorId: number, effectId: number }}
 */
export function lightingToWire(layer) {
  const { color, effect } = layerLighting(layer);
  return { colorId: ledColorId(color), effectId: effect };
}

// ----------------------------------------------------------------- decoding --

const isEmptyKeyboard = (keys) =>
  keys.length === 0 || (keys.length === 1 && keys[0][0] === 0 && keys[0][1] === 0);

function decodeKeystroke([mask, code]) {
  return formatCombo({
    modifiers: maskToModifiers(mask),
    key: KEY_NAMES[code] ?? `0x${code.toString(16)}`,
  });
}

/**
 * Convert a wire binding read from the device into a config binding.
 * @returns {string | string[] | undefined} `undefined` when the device holds
 *   something this app has no name for; callers should keep the existing value.
 */
export function wireToBinding(wire) {
  switch (wire.mode) {
    case Mode.KEYBOARD: {
      if (isEmptyKeyboard(wire.keys)) return 'none';
      const steps = wire.keys.map(decodeKeystroke);
      return steps.length === 1 ? steps[0] : steps;
    }

    case Mode.MEDIA:
      return MEDIA_NAMES[wire.consumerCode];

    case Mode.MOUSE:
      if (wire.wheel === MOUSE_CODES.wheel_up[1]) return 'wheel_up';
      if (wire.wheel === MOUSE_CODES.wheel_down[1]) return 'wheel_down';
      return { 1: 'lclick', 2: 'rclick', 4: 'mclick' }[wire.buttonMask];

    default:
      return undefined;
  }
}
