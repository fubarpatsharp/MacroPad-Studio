/**
 * WebHID driver compatibility bridge for the 12-key + 2-knob Macro Pad.
 * Re-exports clean modular definitions from `src/protocol/` and `src/config/`.
 */

export {
  DEVICE,
  DEVICE as DEVICE_ID,
} from './src/config/constants.js';

export {
  REPORT_ID,
  PAYLOAD_SIZE,
  Mode,
  Mode as MODES,
  BUTTON_IDS as BUTTON_NAMES,
  BUTTON_NAMES as BUTTON_ID_TO_NAME,
  MEDIA_CODES as MEDIA_KEYS,
  MEDIA_NAMES as MEDIA_CODE_TO_NAME,
  MOUSE_CODES as MOUSE_ACTIONS,
  KEY_CODES,
  KEY_NAMES as CODE_TO_KEY,
} from './src/protocol/usb-codes.js';

export {
  MODIFIER_BITS as MODIFIERS,
} from './src/config/modifiers.js';

export {
  LED_COLOR_NAMES as LED_COLORS,
  LED_EFFECTS,
} from './src/config/led.js';

export {
  MacroPadHid as MacroPadWebHID,
} from './src/protocol/hid-device.js';

export {
  bindingToWire,
  wireToBinding,
} from './src/protocol/codec.js';

export {
  flashDevice,
  readDevice,
} from './src/protocol/operations.js';
