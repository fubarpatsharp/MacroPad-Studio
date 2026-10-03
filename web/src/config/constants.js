/**
 * Product-wide constants.
 *
 * Anything that is a "number the hardware or the product dictates" lives here
 * so it has exactly one definition and one explanation.
 */

/** USB identity of the supported macro pad (WCH CH552G / CH57x based). */
export const DEVICE = Object.freeze({
  vendorId: 0x1189,
  productId: 0x8840,
  /** Human-readable `VID:PID`, used in UI copy. */
  id: '1189:8840',
});

/** Number of independent hardware layers (the pad has a layer-switch button). */
export const LAYER_COUNT = 3;
export const LAYERS = Object.freeze(Array.from({ length: LAYER_COUNT }, (_, i) => i + 1));

/**
 * Maximum steps in one macro.
 * A report payload is 64 bytes: a 10-byte header followed by 2 bytes per step,
 * so (64 - 10) / 2 = 27 steps fit.
 */
export const MAX_MACRO_STEPS = 27;

/** Delay inserted between macro steps, in milliseconds. */
export const DEFAULT_DELAY_MS = 40;
export const MAX_DELAY_MS = 1000;

/** Sentinel binding values that mean "this control does nothing". */
export const UNBOUND = 'none';
