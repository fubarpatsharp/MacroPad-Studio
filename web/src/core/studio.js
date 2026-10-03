/**
 * Studio state: the shape of the data, how to read it, and every way to change it.
 *
 * UI components never build state updates themselves. They call these actions,
 * which keeps all rules in one testable place (see `tests/studio.test.js`):
 *
 *   component --calls--> actions --update--> store --notifies--> components
 */

import { MAX_DELAY_MS, MAX_MACRO_STEPS, UNBOUND } from '../config/constants.js';
import { DEFAULT_CONFIG } from '../config/default-config.js';
import { layerLighting } from '../config/led.js';
import { ActionKind, bindingToSteps, classifyBinding, stepsToBinding } from './bindings.js';
import { formatCombo, parseCombo, toggleModifier } from './combo.js';
import * as model from './config-model.js';
import { createStore } from './store.js';
import { textToSteps } from './text-macro.js';

/** @typedef {ReturnType<typeof createInitialState>} StudioState */

export function createInitialState(config = DEFAULT_CONFIG) {
  return {
    config,
    /** Active hardware layer, 1-based. */
    layer: 1,
    /** Name of the control being edited, e.g. `"key3"` or `"knob1_press"`. */
    selected: 'key1',
    /** Which inspector tab is showing (an `ActionKind`). */
    tab: classifyBinding(model.getLayer(config, 1).key1),
    /** Follow physical key presses with the selection. */
    autoSelect: true,
    device: { connected: false, label: null },
  };
}

// ---------------------------------------------------------------- selectors --

export const selectLayerData = (state) => model.getLayer(state.config, state.layer);
export const selectBinding = (state) => selectLayerData(state)[state.selected];
export const selectSteps = (state) => bindingToSteps(selectBinding(state));
export const selectLighting = (state) => layerLighting(selectLayerData(state));
export const selectDelay = (state) => model.layerDelay(selectLayerData(state));

// ------------------------------------------------------------------ actions --

/**
 * @param {{ getState: () => StudioState, setState: Function }} store
 */
export function createStudioActions(store) {
  const { getState, setState } = store;

  /** Tab that best represents the binding of `control` on `layer`. */
  const tabFor = (config, layer, control) =>
    classifyBinding(model.getLayer(config, layer)[control]);

  /** Replace the binding of the selected control. */
  const writeBinding = (binding) =>
    setState((s) => ({ config: model.withBinding(s.config, s.layer, s.selected, binding) }));

  /** Replace the macro steps of the selected control. */
  const writeSteps = (steps) => writeBinding(stepsToBinding(steps));

  /** Apply `edit(combo) -> combo` to step `index` of the selected macro. */
  function editStep(index, edit) {
    const steps = selectSteps(getState());
    if (index < 0 || index >= steps.length) return;
    steps[index] = formatCombo(edit(parseCombo(steps[index])));
    writeSteps(steps);
  }

  return {
    // -- navigation ---------------------------------------------------------
    selectLayer(layer) {
      setState((s) => ({ layer, tab: tabFor(s.config, layer, s.selected) }));
    },

    selectControl(control) {
      setState((s) => ({ selected: control, tab: tabFor(s.config, s.layer, control) }));
    },

    /** Switch the inspector tab. This is a view change; the binding is untouched. */
    setTab(tab) {
      setState({ tab });
    },

    setAutoSelect(autoSelect) {
      setState({ autoSelect });
    },

    // -- binding edits ------------------------------------------------------
    setBinding: writeBinding,

    /** Unbind the selected control. */
    resetControl() {
      setState((s) => ({
        config: model.withBinding(s.config, s.layer, s.selected, UNBOUND),
        tab: ActionKind.DISABLED,
      }));
    },

    /** Replace the binding with one captured keystroke (the "press to record" box). */
    recordCombo(combo) {
      writeBinding(formatCombo(parseCombo(combo)));
    },

    /** Replace the binding with a typed phrase. @returns the expansion report */
    applyPhrase(text) {
      const result = textToSteps(text);
      if (result.steps.length > 0) writeSteps(result.steps);
      return result;
    },

    // -- macro step edits ---------------------------------------------------
    /** @returns {boolean} false when the macro is already full */
    addStep() {
      const steps = selectSteps(getState());
      if (steps.length >= MAX_MACRO_STEPS) return false;
      writeSteps([...steps, 'a']);
      return true;
    },

    removeStep(index) {
      writeSteps(selectSteps(getState()).filter((_, i) => i !== index));
    },

    toggleStepModifier(index, modifier) {
      editStep(index, (combo) => toggleModifier(combo, modifier));
    },

    setStepKey(index, key) {
      editStep(index, (combo) => ({ ...combo, key }));
    },

    // -- lighting & timing --------------------------------------------------
    setLedColor(color) {
      setState((s) => ({ config: model.withLedColor(s.config, s.layer, color) }));
    },

    setLedEffect(effect) {
      setState((s) => ({ config: model.withLedEffect(s.config, s.layer, effect) }));
    },

    setDelay(ms) {
      const value = Math.min(MAX_DELAY_MS, Math.max(0, Number.parseInt(ms, 10) || 0));
      setState((s) => ({ config: model.withDelay(s.config, s.layer, value) }));
    },

    // -- whole-config operations -------------------------------------------
    replaceConfig(config) {
      setState((s) => ({ config, tab: tabFor(config, s.layer, s.selected) }));
    },

    mergeDeviceBindings(readLayers) {
      setState((s) => {
        const config = model.mergeDeviceBindings(s.config, readLayers);
        return { config, tab: tabFor(config, s.layer, s.selected) };
      });
    },

    // -- device -------------------------------------------------------------
    setDevice(connected, label = null) {
      setState({ device: { connected, label } });
    },
  };
}

/** Create a store and its actions in one go. */
export function createStudio(initialConfig) {
  const store = createStore(createInitialState(initialConfig));
  return { store, actions: createStudioActions(store) };
}
