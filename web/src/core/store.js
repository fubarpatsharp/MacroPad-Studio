/**
 * Tiny observable store.
 *
 * Deliberately minimal (about 40 lines instead of a framework):
 *  - state is a plain object that is never mutated, only replaced
 *  - `subscribe` is called after every change
 *  - `watch` calls back only when a selected slice actually changed, which is
 *    how UI components avoid re-rendering for unrelated updates
 */

/**
 * @template S
 * @param {S} initialState
 */
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  const getState = () => state;

  /** Merge `patch` (or the result of `patch(state)`) into the state. */
  function setState(patch) {
    const next = typeof patch === 'function' ? patch(state) : patch;
    if (!next || Object.keys(next).every((key) => Object.is(state[key], next[key]))) return;
    const previous = state;
    state = { ...state, ...next };
    for (const listener of [...listeners]) listener(state, previous);
  }

  /** @returns {() => void} unsubscribe */
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * Call `callback(value)` now and whenever `selector(state)` changes.
   * @returns {() => void} unsubscribe
   */
  function watch(selector, callback) {
    let current = selector(state);
    callback(current, undefined);
    return subscribe((nextState) => {
      const next = selector(nextState);
      if (Object.is(next, current)) return;
      const previous = current;
      current = next;
      callback(next, previous);
    });
  }

  return { getState, setState, subscribe, watch };
}
