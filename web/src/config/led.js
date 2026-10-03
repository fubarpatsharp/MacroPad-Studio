/**
 * LED model: colours, effects, and the animation choreography used by the
 * on-screen simulation. Everything about "how a layer's lighting is described"
 * is in this file.
 */

// ---------------------------------------------------------------- colours --

/** Order matters: it is the on-screen swatch order and the firmware colour id. */
export const LED_COLOR_NAMES = Object.freeze([
  'off', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple',
]);

/** CSS colour used for the swatch / glow, plus the readable-checkmark tone. */
const COLOR_RGB = {
  off: [142, 142, 147],
  red: [255, 59, 48],
  orange: [255, 149, 0],
  yellow: [255, 214, 10],
  green: [48, 209, 88],
  cyan: [100, 210, 255],
  blue: [0, 113, 227],
  purple: [191, 90, 242],
};

const DARK_CHECK_COLORS = new Set(['off', 'yellow']);

const GLOW_ALPHA = 0.95;
const DIM_ALPHA = 0.38;

const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;
const hex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export const DEFAULT_LED_COLOR = 'red';

/** `true` if `name` is a colour the firmware understands. */
export const isLedColor = (name) => Object.hasOwn(COLOR_RGB, name);

/**
 * Visual spec for a colour name (falls back to red for unknown names, matching
 * the firmware default).
 * @returns {{ name: string, color: string, glow: string, dim: string, darkCheck: boolean }}
 */
export function ledColorSpec(name) {
  const safe = isLedColor(name) ? name : DEFAULT_LED_COLOR;
  const rgb = COLOR_RGB[safe];
  return {
    name: safe,
    color: hex(rgb),
    glow: safe === 'off' ? rgba(rgb, 0) : rgba(rgb, GLOW_ALPHA),
    dim: safe === 'off' ? rgba(rgb, 0) : rgba(rgb, DIM_ALPHA),
    darkCheck: DARK_CHECK_COLORS.has(safe),
  };
}

/** Firmware id (0-7) for a colour name. */
export const ledColorId = (name) => LED_COLOR_NAMES.indexOf(isLedColor(name) ? name : DEFAULT_LED_COLOR);

// ---------------------------------------------------------------- effects --

/**
 * Effects as numbered by the firmware. Configs may refer to them by number or
 * by any of the aliases (the CLI uses `ripple`, `wave`, `reactive`, ...).
 */
export const LED_EFFECTS = Object.freeze([
  { id: 0, label: 'Mode 0 • LEDs Off', aliases: ['off'] },
  { id: 1, label: 'Mode 1 • Static Color (Always)', aliases: ['static'] },
  { id: 2, label: 'Mode 2 • Column Sweep (3➔6➔9➔12...)', aliases: ['sweep', 'ripple'] },
  { id: 3, label: 'Mode 3 • Upward Cascade (10➔7➔4➔1...)', aliases: ['cascade', 'wave'] },
  { id: 4, label: 'Mode 4 • White Flash Under Button', aliases: ['white_flash', 'reactive', 'white'] },
]);

export const DEFAULT_LED_EFFECT = 1;

const EFFECT_BY_ALIAS = new Map(
  LED_EFFECTS.flatMap(({ id, aliases }) => [[String(id), id], ...aliases.map((a) => [a, id])]),
);

/**
 * Resolve any accepted spelling (`3`, `"3"`, `"wave"`, ...) to a firmware
 * effect id, or the default (static) when it is not recognised.
 */
export function resolveLedEffect(value) {
  if (value === undefined || value === null) return DEFAULT_LED_EFFECT;
  return EFFECT_BY_ALIAS.get(String(value).toLowerCase()) ?? DEFAULT_LED_EFFECT;
}

/** Normalised `{ color, effect }` for a layer (missing/odd values get defaults). */
export function layerLighting(layer) {
  return {
    color: isLedColor(layer?.led?.color) ? layer.led.color : DEFAULT_LED_COLOR,
    effect: resolveLedEffect(layer?.led?.effect),
  };
}

// ------------------------------------------------------------ choreography --

/** Gap between consecutive keys in a sweep/cascade animation. */
export const SWEEP_STEP_MS = 28;
/** How long one key's flash lasts (must match `--flash-ms` in `leds.css`). */
export const FLASH_MS = 230;
export const WHITE_FLASH_MS = 290;

const keysOf = (...numbers) => numbers.map((n) => `key${n}`);

/**
 * Order in which keys light up for the multi-key effects. The pad is a
 * 3-column x 4-row grid numbered row-major (key1 top-left, key12 bottom-right).
 */
export const EFFECT_SEQUENCES = Object.freeze({
  // Down each column, right-to-left: 3,6,9,12 then 2,5,8,11 then 1,4,7,10.
  2: keysOf(3, 6, 9, 12, 2, 5, 8, 11, 1, 4, 7, 10),
  // Up each column, left-to-right: 10,7,4,1 then 11,8,5,2 then 12,9,6,3.
  3: keysOf(10, 7, 4, 1, 11, 8, 5, 2, 12, 9, 6, 3),
});
