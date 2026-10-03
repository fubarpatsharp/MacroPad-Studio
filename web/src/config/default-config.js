/**
 * Layout the studio starts with before the user imports a file or reads the
 * device. Same JSON shape as the CLI's `macropad.json`.
 *
 * Treated as immutable: all edits go through `state/actions.js`, which copies.
 */
export const DEFAULT_CONFIG = Object.freeze({
  layers: {
    1: {
      led: { color: 'red', effect: '1' },
      delay: 40,
      key1: 'alt+v', key2: 'alt+w', key3: 'ctrl+alt+o',
      key4: 'alt+h', key5: 'alt+s', key6: 'shift+r',
      key7: 'shift+v', key8: 'alt+a', key9: 'ctrl+shift+alt+t',
      key10: 'shift+h', key11: 'alt+d', key12: 'shift+alt+h',
      knob1_left: 'wheel_up', knob1_press: 'n', knob1_right: 'wheel_down',
      knob2_left: 'wheel_down', knob2_press: 'shift+n', knob2_right: 'wheel_up',
      knob3_left: 'wheel_down', knob3_press: 'ctrl+0', knob3_right: 'wheel_up',
    },
    2: {
      led: { color: 'blue', effect: '2' },
      delay: 40,
      key1: 'shift+f5', key2: 'shift+f6', key3: 'ctrl+shift+o',
      key4: 'ctrl+f2', key5: 'shift+f4', key6: 'ctrl+lbracket',
      key7: 'ctrl+y', key8: 'ctrl+f1', key9: 'ctrl+rbracket',
      key10: 'shift+h', key11: 'ctrl+f3', key12: 'ctrl+alt+e',
      knob1_left: 'down', knob1_press: 'ctrl+1', knob1_right: 'up',
      knob2_left: 'left', knob2_press: 'ctrl+alt+r', knob2_right: 'right',
      knob3_left: 'wheel_down', knob3_press: 'ctrl+0', knob3_right: 'wheel_up',
    },
    3: {
      led: { color: 'green', effect: '3' },
      delay: 40,
      key1: 'f21', key2: 'f17', key3: 'f13',
      key4: 'f22', key5: 'f18', key6: 'f14',
      key7: 'f23', key8: 'f19', key9: 'f15',
      key10: 'f24', key11: 'f20', key12: 'f16',
      knob1_left: '4', knob1_press: '5', knob1_right: '6',
      knob2_left: 'volume_up', knob2_press: 'mute', knob2_right: 'volume_down',
      knob3_left: 'f19', knob3_press: 'f20', knob3_right: 'f21',
    },
  },
});
