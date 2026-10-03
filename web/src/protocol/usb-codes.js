/**
 * Wire-level constants of the macro pad's USB HID protocol.
 *
 * The protocol is reverse-engineered; see "Protocol Specification" in the
 * repository README. All reports are Report ID 0x03 followed by 64 bytes.
 * This file is data only. Nothing here performs I/O.
 */

// ------------------------------------------------------------------ framing --

export const REPORT_ID = 0x03;
export const PAYLOAD_SIZE = 64;

/** First payload byte: what kind of command this is. */
export const Command = Object.freeze({
  WRITE: 0xfd, // button binding, macro delay, and the commit marker
  LAYER_CONFIG: 0xfe, // LED / layer settings (sub-command 0xB0)
  READ: 0xfa, // read bindings (request and each response row)
  SAVE: 0xef, // persist RAM -> flash
});

/** Payload that tells the pad to apply the preceding write (`fd fe ff`). */
export const COMMIT_PAYLOAD = Object.freeze([Command.WRITE, 0xfe, 0xff]);

/** Layer-config sub-commands. */
export const LayerConfig = Object.freeze({
  SUB_COMMAND: 0xb0,
  LEDS: 0x08,
  LEDS_FOOTER: 0x05,
});

/** Slot that selects "macro delay" instead of a button in a WRITE command. */
export const MACRO_DELAY_SLOT = 0x00;
export const MACRO_DELAY_KIND = 0x05;

/** Value of byte 3 in a binding: how the pad should interpret the rest. */
export const Mode = Object.freeze({ KEYBOARD: 0x01, MEDIA: 0x02, MOUSE: 0x03 });

/** Offsets inside a binding payload (write) / response row (read). */
export const Offset = Object.freeze({
  BUTTON: 1,
  LAYER: 2,
  MODE: 3,
  COUNT: 9, // number of key pairs (keyboard) or a fixed marker (media/mouse)
  DATA: 10, // first data byte
  MOUSE_WHEEL: 14,
});

/** Mouse bindings always carry this marker in the COUNT byte; media carries 1. */
export const MOUSE_MARKER = 0x04;
export const MEDIA_MARKER = 0x01;

/** Milliseconds the firmware needs after a commit / save before the next command. */
export const COMMIT_SETTLE_MS = 25;
export const SAVE_SETTLE_MS = 50;

/** Number of response rows when reading a layer (12 keys + 3 knobs x 3). */
export const READ_ROW_COUNT = 24;
export const READ_ROW_MIN_LENGTH = 12;
export const READ_TIMEOUT_MS = 500;

// ----------------------------------------------------------------- controls --

/**
 * Control name -> button id on the pad's PCB. Keys are listed in on-screen
 * (row-major) order, which is *not* the wiring order.
 */
export const BUTTON_IDS = Object.freeze({
  key1: 0x09, key2: 0x05, key3: 0x01,
  key4: 0x0a, key5: 0x06, key6: 0x02,
  key7: 0x0b, key8: 0x07, key9: 0x03,
  key10: 0x0c, key11: 0x08, key12: 0x04,
  knob1_left: 0x15, knob1_press: 0x14, knob1_right: 0x13,
  knob2_left: 0x10, knob2_press: 0x11, knob2_right: 0x12,
  knob3_left: 0x16, knob3_press: 0x17, knob3_right: 0x18,
});

export const BUTTON_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(BUTTON_IDS).map(([name, id]) => [id, name])),
);

// ------------------------------------------------------------------ actions --

/** Consumer-control usage ids (HID Usage Tables, consumer page). */
export const MEDIA_CODES = Object.freeze({
  play_pause: 0xcd, next_track: 0xb5, prev_track: 0xb6,
  volume_up: 0xe9, volume_down: 0xea, mute: 0xe2, stop: 0xb7,
});

export const MEDIA_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(MEDIA_CODES).map(([name, code]) => [code, name])),
);

/** `[button mask, wheel delta]`; the wheel is a signed byte, so -1 is 0xFF. */
export const MOUSE_CODES = Object.freeze({
  lclick: [0x01, 0],
  rclick: [0x02, 0],
  mclick: [0x04, 0],
  wheel_up: [0x00, 0x01],
  wheel_down: [0x00, 0xff],
});

// ----------------------------------------------------------------- keyboard --

/** USB HID keyboard usage ids (keyboard page 0x07). */
export const KEY_CODES = Object.freeze({
  none: 0x00,
  a: 0x04, b: 0x05, c: 0x06, d: 0x07, e: 0x08, f: 0x09, g: 0x0a, h: 0x0b, i: 0x0c,
  j: 0x0d, k: 0x0e, l: 0x0f, m: 0x10, n: 0x11, o: 0x12, p: 0x13, q: 0x14, r: 0x15,
  s: 0x16, t: 0x17, u: 0x18, v: 0x19, w: 0x1a, x: 0x1b, y: 0x1c, z: 0x1d,
  1: 0x1e, 2: 0x1f, 3: 0x20, 4: 0x21, 5: 0x22, 6: 0x23, 7: 0x24, 8: 0x25, 9: 0x26, 0: 0x27,
  enter: 0x28, esc: 0x29, backspace: 0x2a, tab: 0x2b, space: 0x2c,
  minus: 0x2d, equal: 0x2e, lbracket: 0x2f, rbracket: 0x30, backslash: 0x31,
  semicolon: 0x33, quote: 0x34, grave: 0x35, comma: 0x36, period: 0x37, slash: 0x38,
  capslock: 0x39,
  f1: 0x3a, f2: 0x3b, f3: 0x3c, f4: 0x3d, f5: 0x3e, f6: 0x3f,
  f7: 0x40, f8: 0x41, f9: 0x42, f10: 0x43, f11: 0x44, f12: 0x45,
  printscreen: 0x46, scrolllock: 0x47, pause: 0x48,
  insert: 0x49, home: 0x4a, pageup: 0x4b, delete: 0x4c, end: 0x4d, pagedown: 0x4e,
  right: 0x4f, left: 0x50, down: 0x51, up: 0x52,
  kp_numlock: 0x53, kp_slash: 0x54, kp_asterisk: 0x55, kp_minus: 0x56, kp_plus: 0x57,
  kp_enter: 0x58,
  kp_1: 0x59, kp_2: 0x5a, kp_3: 0x5b, kp_4: 0x5c, kp_5: 0x5d,
  kp_6: 0x5e, kp_7: 0x5f, kp_8: 0x60, kp_9: 0x61, kp_0: 0x62, kp_dot: 0x63,
  f13: 0x68, f14: 0x69, f15: 0x6a, f16: 0x6b, f17: 0x6c, f18: 0x6d,
  f19: 0x6e, f20: 0x6f, f21: 0x70, f22: 0x71, f23: 0x72, f24: 0x73,
});

/** Reverse lookup for decoding. `none` (0) is excluded: it means "no key". */
export const KEY_NAMES = Object.freeze(
  Object.fromEntries(
    Object.entries(KEY_CODES)
      .filter(([, code]) => code !== 0)
      .map(([name, code]) => [code, name]),
  ),
);
