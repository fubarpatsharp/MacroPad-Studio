/**
 * Catalog of the non-keyboard actions a control can be bound to.
 *
 * This is the single source for both the UI (labels, icons, keycap badges) and
 * classification (is this binding a media/mouse action?). The wire codes for
 * each id live in `protocol/usb-codes.js`; a unit test asserts the two stay in
 * sync.
 */

/** @typedef {{ id: string, label: string, badge: string, icon: string, hint?: string }} ActionOption */

/** @type {ReadonlyArray<ActionOption>} Consumer-control (media) actions shown in the UI. */
export const MEDIA_ACTIONS = Object.freeze([
  { id: 'play_pause', label: 'Play / Pause', badge: 'Play', icon: 'play-pause' },
  { id: 'next_track', label: 'Next Track', badge: 'Next', icon: 'next-track' },
  { id: 'prev_track', label: 'Prev Track', badge: 'Prev', icon: 'prev-track' },
  { id: 'volume_up', label: 'Volume Up', badge: 'Vol +', icon: 'volume-up' },
  { id: 'volume_down', label: 'Volume Down', badge: 'Vol −', icon: 'volume-down' },
  { id: 'mute', label: 'Mute', badge: 'Mute', icon: 'mute' },
]);

/** @type {ReadonlyArray<ActionOption>} Mouse actions shown in the UI. */
export const MOUSE_ACTIONS = Object.freeze([
  { id: 'lclick', label: 'Left Click', hint: 'Primary', badge: 'L-Click', icon: 'mouse-left' },
  { id: 'rclick', label: 'Right Click', hint: 'Secondary', badge: 'R-Click', icon: 'mouse-right' },
  { id: 'mclick', label: 'Mid Click', hint: 'Wheel Press', badge: 'M-Click', icon: 'mouse-middle' },
  { id: 'wheel_up', label: 'Wheel Up', badge: 'W-Up', icon: 'wheel-up' },
  { id: 'wheel_down', label: 'Wheel Down', badge: 'W-Down', icon: 'wheel-down' },
]);

/**
 * Ids recognised when *classifying* a binding. `stop` is supported by the
 * firmware (and by the CLI / imported configs) but has no tile in the UI.
 */
export const MEDIA_ACTION_IDS = new Set([...MEDIA_ACTIONS.map((a) => a.id), 'stop']);
export const MOUSE_ACTION_IDS = new Set(MOUSE_ACTIONS.map((a) => a.id));

const BADGES = new Map([...MEDIA_ACTIONS, ...MOUSE_ACTIONS].map((a) => [a.id, a.badge]));

/** Short keycap label for a media/mouse action id, or `undefined`. */
export const badgeForAction = (id) => BADGES.get(id);
