/**
 * High-level device workflows (flashing and reading).
 *
 * Orchestrates `MacroPadHid` (transport) and `codec.js` (data translation),
 * reporting progress so the UI can drive a progress bar.
 */

import { LAYER_COUNT } from '../config/constants.js';
import { BUTTON_IDS, BUTTON_NAMES } from './usb-codes.js';
import { bindingToWire, lightingToWire, wireToBinding } from './codec.js';
import { formatControlTitle, isControlName } from '../config/controls.js';
import { layerDelay } from '../core/config-model.js';

/**
 * Flash the entire configuration (all layers, delays, and lighting) to the pad
 * and commit to EEPROM.
 *
 * @param {import('./hid-device.js').MacroPadHid} transport
 * @param {object} config
 * @param {(progress: { current: number, total: number, percent: number, stage: string, detail?: string }) => void} [onProgress]
 */
export async function flashDevice(transport, config, onProgress = () => {}) {
  const totalControls = LAYER_COUNT * Object.keys(BUTTON_IDS).length;
  // totalSteps: writing each button across all layers + delay + leds + save
  const totalSteps = totalControls + LAYER_COUNT * 2 + 1;
  let currentStep = 0;

  const report = (stage, detail) => {
    currentStep += 1;
    const percent = Math.min(98, Math.round((currentStep / totalSteps) * 100));
    onProgress({ current: currentStep, total: totalSteps, percent, stage, detail });
  };

  for (let l = 1; l <= LAYER_COUNT; l += 1) {
    const layer = config.layers?.[l] || {};

    for (const [name, buttonId] of Object.entries(BUTTON_IDS)) {
      const binding = layer[name];
      const wire = bindingToWire(binding);
      await transport.writeButton(buttonId, l, wire);
      report(`Writing Layer ${l}`, `${formatControlTitle(name)}`);
    }

    const delay = layerDelay(layer);
    await transport.writeMacroDelay(l, delay);
    report(`Writing Layer ${l}`, 'Inter-key delay');

    const lightingWire = lightingToWire(layer);
    await transport.writeLayerLeds(l, lightingWire);
    report(`Writing Layer ${l}`, 'LED lighting & effect');
  }

  onProgress({
    current: currentStep,
    total: totalSteps,
    percent: 99,
    stage: 'Persisting to EEPROM...',
    detail: 'Writing onboard flash',
  });

  await transport.saveToFlash();

  onProgress({
    current: totalSteps,
    total: totalSteps,
    percent: 100,
    stage: 'Flash Complete!',
    detail: 'Hardware ready',
  });
}

/**
 * Read memory across all 3 layers from hardware.
 *
 * @param {import('./hid-device.js').MacroPadHid} transport
 * @param {(progress: { layer: number, totalLayers: number }) => void} [onProgress]
 * @returns {Promise<Record<number, Record<string, string | string[]>>>}
 */
export async function readDevice(transport, onProgress = () => {}) {
  const result = {};

  for (let l = 1; l <= LAYER_COUNT; l += 1) {
    onProgress({ layer: l, totalLayers: LAYER_COUNT });
    const rawButtons = await transport.readLayer(l);
    const layerBindings = {};

    for (const [btnIdStr, wire] of Object.entries(rawButtons)) {
      const buttonId = Number.parseInt(btnIdStr, 10);
      const controlName = BUTTON_NAMES[buttonId];
      if (!controlName || !isControlName(controlName)) continue;

      const binding = wireToBinding(wire);
      if (binding !== undefined) {
        layerBindings[controlName] = binding;
      }
    }

    result[l] = layerBindings;
  }

  return result;
}
