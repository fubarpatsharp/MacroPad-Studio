/**
 * Pure helpers over the config object `{ layers: { "1": {...}, ... } }`.
 *
 * Every function returns a *new* object when it changes something, so the store
 * can detect changes by reference and components can skip needless renders.
 */

import { DEFAULT_DELAY_MS, UNBOUND } from '../config/constants.js';
import { isControlName } from '../config/controls.js';
import { layerLighting } from '../config/led.js';
import { formatCombo } from './combo.js';
import { stepsToBinding } from './bindings.js';
import { textToSteps } from './text-macro.js';

/** The layer object for `layerNumber` (an empty one if it does not exist). */
export const getLayer = (config, layerNumber) => config.layers?.[layerNumber] ?? {};

/** Apply `update(layer) -> layer` to one layer. */
export function updateLayer(config, layerNumber, update) {
  return {
    ...config,
    layers: { ...config.layers, [layerNumber]: update(getLayer(config, layerNumber)) },
  };
}

export const withBinding = (config, layerNumber, control, binding) =>
  updateLayer(config, layerNumber, (layer) => ({ ...layer, [control]: binding }));

export const withLedColor = (config, layerNumber, color) =>
  updateLayer(config, layerNumber, (layer) => ({
    ...layer,
    led: { ...layerLighting(layer), color },
  }));

export const withLedEffect = (config, layerNumber, effect) =>
  updateLayer(config, layerNumber, (layer) => ({
    ...layer,
    led: { ...layerLighting(layer), effect: String(effect) },
  }));

export const withDelay = (config, layerNumber, delay) =>
  updateLayer(config, layerNumber, (layer) => ({ ...layer, delay }));

/** Inter-step delay for a layer, with the product default. */
export const layerDelay = (layer) => layer?.delay ?? DEFAULT_DELAY_MS;

/** `[controlName, binding]` pairs of a layer, skipping `led`, `delay`, `_comment`. */
export const controlEntries = (layer) =>
  Object.entries(layer ?? {}).filter(([name]) => isControlName(name));

/**
 * Merge bindings read from the device into the existing config. Only controls
 * present in `readLayers` change; lighting and delay are kept.
 * @param {object} config
 * @param {Record<number, Record<string, unknown>>} readLayers
 */
export function mergeDeviceBindings(config, readLayers) {
  let next = config;
  for (const [layerNumber, bindings] of Object.entries(readLayers)) {
    next = updateLayer(next, layerNumber, (layer) => ({ ...layer, ...bindings }));
  }
  return next;
}

// ------------------------------------------------------------- import ------

/**
 * The CLI's JSON format also allows object-style bindings:
 * `{media: "mute"}`, `{mouse: "lclick"}`, `{text: "hi"}`, `{key: "c", mod: "ctrl"}`.
 * The studio edits plain strings/arrays, so convert on the way in.
 */
function coerceBinding(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  if (typeof value.media === 'string') return value.media.toLowerCase();
  if (typeof value.mouse === 'string') return value.mouse.toLowerCase();
  if (typeof value.text === 'string') return stepsToBinding(textToSteps(value.text).steps);
  if (typeof value.key === 'string') {
    const modifiers = String(value.mod ?? '').split('+').filter(Boolean);
    return formatCombo({ modifiers, key: value.key.toLowerCase() });
  }
  return UNBOUND;
}

function coerceLayer(layer) {
  return Object.fromEntries(
    Object.entries(layer).map(([name, value]) => [
      name,
      isControlName(name) ? coerceBinding(value) : value,
    ]),
  );
}

/**
 * Validate and normalise a parsed JSON document.
 * @param {unknown} raw
 * @returns {{ layers: Record<string, object> }}
 * @throws {Error} with a user-presentable message
 */
export function parseConfigDocument(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Expected a JSON object');
  }
  if (raw.layers === null || typeof raw.layers !== 'object' || Array.isArray(raw.layers)) {
    throw new Error("Missing 'layers' property");
  }
  const layers = Object.fromEntries(
    Object.entries(raw.layers)
      .filter(([, layer]) => layer !== null && typeof layer === 'object' && !Array.isArray(layer))
      .map(([number, layer]) => [number, coerceLayer(layer)]),
  );
  return { ...raw, layers };
}
