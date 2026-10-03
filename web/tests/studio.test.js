/**
 * Automated test suite for MacroPad Studio's core logic and protocol codec.
 * Executable via `node web/tests/studio.test.js`.
 */

import assert from 'node:assert/strict';
import { MAX_MACRO_STEPS, UNBOUND } from '../src/config/constants.js';
import { CONTROL_NAMES, formatControlTitle, isControlName, isKeyControl, parseKnobControl } from '../src/config/controls.js';
import { MEDIA_ACTIONS, MOUSE_ACTIONS } from '../src/config/actions.js';
import { KEY_CATEGORIES, KNOWN_KEY_IDS } from '../src/config/key-catalog.js';
import { LED_COLOR_NAMES, LED_EFFECTS, ledColorId, ledColorSpec, resolveLedEffect } from '../src/config/led.js';
import { canonicalModifier, maskToModifiers, modifiersToMask } from '../src/config/modifiers.js';
import { formatCombo, normalizeCombo, parseCombo, toggleModifier } from '../src/core/combo.js';
import { textToSteps } from '../src/core/text-macro.js';
import { ActionKind, bindingToSteps, classifyBinding, describeBinding, isKeystroke, stepsToBinding } from '../src/core/bindings.js';
import { findControlForInput } from '../src/core/control-matcher.js';
import { createStore } from '../src/core/store.js';
import { getLayer, mergeDeviceBindings, parseConfigDocument, updateLayer, withBinding } from '../src/core/config-model.js';
import { createStudio, selectBinding, selectDelay, selectLighting, selectSteps } from '../src/core/studio.js';
import { BUTTON_IDS, KEY_CODES, MEDIA_CODES, MOUSE_CODES, Mode } from '../src/protocol/usb-codes.js';
import { bindingToWire, lightingToWire, wireToBinding } from '../src/protocol/codec.js';

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests += 1;
  try {
    fn();
    passedTests += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n--- MacroPad Studio Test Suite ---');

// 1. Controls & Catalog
console.log('\n[1. Controls & Catalog]');
test('CONTROL_NAMES has 12 keys and 9 knob gestures (21 total)', () => {
  assert.equal(CONTROL_NAMES.length, 21);
  assert.equal(isKeyControl('key1'), true);
  assert.equal(isKeyControl('key12'), true);
  assert.equal(isKeyControl('knob1_left'), false);
  assert.equal(isControlName('key5'), true);
  assert.equal(isControlName('knob2_press'), true);
  assert.equal(isControlName('led'), false);
});

test('parseKnobControl extracts knob index and gesture', () => {
  assert.deepEqual(parseKnobControl('knob1_left'), { knob: 1, gesture: 'left' });
  assert.deepEqual(parseKnobControl('knob3_press'), { knob: 3, gesture: 'press' });
  assert.equal(parseKnobControl('key1'), null);
});

test('formatControlTitle renders human readable names', () => {
  assert.equal(formatControlTitle('key1'), 'Key 1');
  assert.equal(formatControlTitle('knob1_left'), 'Knob 1 · Turn Left');
  assert.equal(formatControlTitle('knob2_press'), 'Knob 2 · Press');
});

// 2. Modifiers
console.log('\n[2. Modifiers]');
test('canonicalModifier handles aliases', () => {
  assert.equal(canonicalModifier('win'), 'meta');
  assert.equal(canonicalModifier('cmd'), 'meta');
  assert.equal(canonicalModifier('gui'), 'meta');
  assert.equal(canonicalModifier('control'), 'ctrl');
  assert.equal(canonicalModifier('altgr'), 'ralt');
  assert.equal(canonicalModifier('unknown'), null);
});

test('modifiersToMask & maskToModifiers round-trip', () => {
  const mask = modifiersToMask(['ctrl', 'shift', 'alt']);
  assert.equal(mask, 0x01 | 0x02 | 0x04);
  assert.deepEqual(maskToModifiers(mask), ['ctrl', 'shift', 'alt']);
});

// 3. Combo Parsing & Formatting
console.log('\n[3. Combo Parsing & Formatting]');
test('parseCombo parses modifiers and key in canonical order', () => {
  const combo = parseCombo('Alt+Ctrl+V');
  assert.deepEqual(combo, { modifiers: ['ctrl', 'alt'], key: 'v' });
  assert.equal(formatCombo(combo), 'ctrl+alt+v');
});

test('parseCombo handles literal + syntax', () => {
  const comboPlus = parseCombo('ctrl++');
  assert.deepEqual(comboPlus, { modifiers: ['ctrl', 'shift'], key: 'equal' });

  const comboBare = parseCombo('+');
  assert.deepEqual(comboBare, { modifiers: ['shift'], key: 'equal' });
});

test('toggleModifier adds or removes modifier from combo', () => {
  const combo = parseCombo('ctrl+c');
  const withShift = toggleModifier(combo, 'shift');
  assert.equal(formatCombo(withShift), 'ctrl+shift+c');
  const withoutCtrl = toggleModifier(withShift, 'ctrl');
  assert.equal(formatCombo(withoutCtrl), 'shift+c');
});

test('normalizeCombo normalizes spelling and ordering', () => {
  assert.equal(normalizeCombo('Win+Alt+Ctrl+P'), 'ctrl+alt+meta+p');
});

// 4. Text to Macro Expansion
console.log('\n[4. Text to Macro Expansion]');
test('textToSteps converts phrase to individual keystrokes', () => {
  const res = textToSteps('git status');
  assert.deepEqual(res.steps, [
    'g', 'i', 't', 'space', 's', 't', 'a', 't', 'u', 's',
  ]);
  assert.equal(res.truncated, false);
});

test('textToSteps handles upper case and shifted symbols', () => {
  const res = textToSteps('Hi! 123');
  assert.deepEqual(res.steps, [
    'shift+h', 'i', 'shift+1', 'space', '1', '2', '3',
  ]);
});

test('textToSteps respects maximum step limit', () => {
  const longText = 'a'.repeat(35);
  const res = textToSteps(longText, MAX_MACRO_STEPS);
  assert.equal(res.steps.length, MAX_MACRO_STEPS);
  assert.equal(res.truncated, true);
});

// 5. Bindings & Classifications
console.log('\n[5. Bindings & Classifications]');
test('classifyBinding accurately separates action types', () => {
  assert.equal(classifyBinding('ctrl+c'), ActionKind.MACRO);
  assert.equal(classifyBinding(['ctrl+c', 'ctrl+v']), ActionKind.MACRO);
  assert.equal(classifyBinding('play_pause'), ActionKind.MEDIA);
  assert.equal(classifyBinding('volume_up'), ActionKind.MEDIA);
  assert.equal(classifyBinding('lclick'), ActionKind.MOUSE);
  assert.equal(classifyBinding('wheel_down'), ActionKind.MOUSE);
  assert.equal(classifyBinding('none'), ActionKind.DISABLED);
  assert.equal(classifyBinding('disabled'), ActionKind.DISABLED);
});

test('isKeystroke distinguishes keystrokes from text phrases', () => {
  assert.equal(isKeystroke('ctrl+c'), true);
  assert.equal(isKeystroke('enter'), true);
  assert.equal(isKeystroke('hello world'), false);
  assert.equal(isKeystroke('git status'), false);
});

test('bindingToSteps and stepsToBinding work seamlessly', () => {
  assert.deepEqual(bindingToSteps('ctrl+c'), ['ctrl+c']);
  assert.deepEqual(bindingToSteps(['a', 'b']), ['a', 'b']);
  assert.deepEqual(bindingToSteps('hi'), ['h', 'i']);
  assert.equal(stepsToBinding(['ctrl+c']), 'ctrl+c');
  assert.deepEqual(stepsToBinding(['a', 'b']), ['a', 'b']);
  assert.equal(stepsToBinding([]), UNBOUND);
});

test('describeBinding generates concise keycap badges', () => {
  assert.equal(describeBinding('ctrl+alt+del'), 'ctrl+a..');
  assert.equal(describeBinding('lclick'), 'L-Click');
  assert.equal(describeBinding('volume_up'), 'Vol +');
  assert.equal(describeBinding(['ctrl+c', 'ctrl+v']), '[2]');
  assert.equal(describeBinding('none'), '-');
});

// 6. Control Matcher for Live Physical Input
console.log('\n[6. Control Matcher]');
test('findControlForInput finds exact matches regardless of modifier order', () => {
  const layer = {
    key1: 'ctrl+alt+o',
    key2: 'shift+v',
    knob1_left: 'wheel_up',
  };
  assert.equal(findControlForInput(layer, 'alt+ctrl+o'), 'key1');
  assert.equal(findControlForInput(layer, 'shift+v'), 'key2');
  assert.equal(findControlForInput(layer, 'wheel_up'), 'knob1_left');
});

test('findControlForInput falls back to loose match when modifiers stripped', () => {
  const layer = {
    key1: 'ctrl+shift+a',
    key2: 'b',
  };
  assert.equal(findControlForInput(layer, 'shift+a'), 'key1');
});

// 7. LED Configuration & Effects
console.log('\n[7. LED Configuration]');
test('ledColorId and ledColorSpec return valid color tokens', () => {
  assert.equal(ledColorId('red'), 1);
  assert.equal(ledColorId('blue'), 6);
  const spec = ledColorSpec('cyan');
  assert.equal(spec.name, 'cyan');
  assert.equal(typeof spec.color, 'string');
  assert.equal(typeof spec.glow, 'string');
});

test('resolveLedEffect resolves numbers and alias strings', () => {
  assert.equal(resolveLedEffect(2), 2);
  assert.equal(resolveLedEffect('sweep'), 2);
  assert.equal(resolveLedEffect('wave'), 3);
  assert.equal(resolveLedEffect('reactive'), 4);
});

// 8. Protocol Codec
console.log('\n[8. Protocol Codec]');
test('bindingToWire converts keyboard, media, mouse, disabled to USB wire packets', () => {
  // Keyboard
  const wireKb = bindingToWire('ctrl+c');
  assert.equal(wireKb.mode, Mode.KEYBOARD);
  assert.deepEqual(wireKb.keys, [[0x01, KEY_CODES.c]]);

  // Media
  const wireMedia = bindingToWire('volume_up');
  assert.equal(wireMedia.mode, Mode.MEDIA);
  assert.equal(wireMedia.consumerCode, MEDIA_CODES.volume_up);

  // Mouse
  const wireMouse = bindingToWire('wheel_up');
  assert.equal(wireMouse.mode, Mode.MOUSE);
  assert.equal(wireMouse.wheel, MOUSE_CODES.wheel_up[1]);

  // Disabled
  const wireDisabled = bindingToWire('none');
  assert.equal(wireDisabled.mode, Mode.KEYBOARD);
  assert.deepEqual(wireDisabled.keys, [[0, 0]]);
});

test('wireToBinding decodes packets back to config bindings', () => {
  assert.equal(wireToBinding({ mode: Mode.KEYBOARD, keys: [[0x01, KEY_CODES.c]] }), 'ctrl+c');
  assert.equal(wireToBinding({ mode: Mode.MEDIA, consumerCode: MEDIA_CODES.mute }), 'mute');
  assert.equal(wireToBinding({ mode: Mode.MOUSE, buttonMask: 1, wheel: 0 }), 'lclick');
  assert.equal(wireToBinding({ mode: Mode.MOUSE, buttonMask: 0, wheel: 255 }), 'wheel_down');
  assert.equal(wireToBinding({ mode: Mode.KEYBOARD, keys: [[0, 0]] }), 'none');
});

test('lightingToWire converts layer lighting to wire format', () => {
  const wireLight = lightingToWire({ led: { color: 'blue', effect: 'sweep' } });
  assert.deepEqual(wireLight, { colorId: 6, effectId: 2 });
});

// 9. Store & Studio Actions
console.log('\n[9. Store & Studio Actions]');
test('createStudio allows navigating layers and modifying bindings', () => {
  const { store, actions } = createStudio();
  assert.equal(store.getState().layer, 1);
  assert.equal(store.getState().selected, 'key1');

  actions.selectLayer(2);
  assert.equal(store.getState().layer, 2);

  actions.selectControl('key5');
  assert.equal(store.getState().selected, 'key5');

  actions.setBinding('ctrl+shift+p');
  assert.equal(selectBinding(store.getState()), 'ctrl+shift+p');

  actions.addStep();
  assert.deepEqual(selectSteps(store.getState()), ['ctrl+shift+p', 'a']);

  actions.setStepKey(1, 'z');
  actions.toggleStepModifier(1, 'alt');
  assert.deepEqual(selectSteps(store.getState()), ['ctrl+shift+p', 'alt+z']);

  actions.removeStep(0);
  assert.deepEqual(selectSteps(store.getState()), ['alt+z']);

  actions.resetControl();
  assert.equal(selectBinding(store.getState()), UNBOUND);
});

test('applyPhrase in studio expands text to macro sequence', () => {
  const { store, actions } = createStudio();
  actions.selectControl('key4');
  const res = actions.applyPhrase('git');
  assert.deepEqual(selectSteps(store.getState()), ['g', 'i', 't']);
  assert.equal(res.truncated, false);
});

// 10. Config Document Parsing
console.log('\n[10. Config Document Parsing]');
test('parseConfigDocument validates and normalizes imported configs', () => {
  const raw = {
    layers: {
      1: {
        key1: { key: 'c', mod: 'ctrl' },
        key2: { media: 'mute' },
        key3: { text: 'hi' },
      },
    },
  };
  const parsed = parseConfigDocument(raw);
  assert.equal(parsed.layers['1'].key1, 'ctrl+c');
  assert.equal(parsed.layers['1'].key2, 'mute');
  assert.deepEqual(parsed.layers['1'].key3, ['h', 'i']);
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
