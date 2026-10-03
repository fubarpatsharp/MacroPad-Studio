/**
 * Virtual hardware chassis component: L-shaped unibody aluminum chassis,
 * 12 mechanical keycaps, 3 rotary encoder knobs, and live LED lighting simulation.
 */

import { KEY_COUNT, KNOB_COUNT } from '../config/controls.js';
import { EFFECT_SEQUENCES, FLASH_MS, SWEEP_STEP_MS, WHITE_FLASH_MS, ledColorSpec } from '../config/led.js';
import { describeBinding } from '../core/bindings.js';
import { selectBinding, selectLayerData, selectLighting } from '../core/studio.js';

export class ChassisView {
  #container;
  #keysGrid;
  #scanBeam;
  #sensorNotch;
  #layerSegs = [];
  #onSelectControl;
  #animTimers = [];

  constructor({ onSelectControl = () => {} } = {}) {
    this.#onSelectControl = onSelectControl;
    this.#keysGrid = document.getElementById('keys-grid');
    this.#scanBeam = document.getElementById('scan-beam');
    this.#sensorNotch = document.getElementById('sensor-notch');

    for (let l = 1; l <= 3; l += 1) {
      this.#layerSegs[l] = document.getElementById(`layer-seg-${l}`);
    }

    this.#renderKeycaps();
    this.#bindKnobEvents();
  }

  #renderKeycaps() {
    if (!this.#keysGrid) return;
    this.#keysGrid.innerHTML = '';

    for (let i = 1; i <= KEY_COUNT; i += 1) {
      const keyId = `key${i}`;
      const cell = document.createElement('div');
      cell.id = `cell-${keyId}`;
      cell.className = 'keycap-cell';

      cell.innerHTML = `
        <div id="glow-${keyId}" class="key-led-glow"></div>
        <button type="button" id="btn-${keyId}" aria-label="Key ${i}" class="keycap-item group">
          <span class="text-[8px] font-medium text-zinc-500 group-hover:text-zinc-400 absolute top-1.5 left-2 z-10 leading-none select-none">${i}</span>
          <span id="badge-${keyId}" class="text-[9.5px] font-semibold tracking-tight truncate px-1 max-w-[62px] text-zinc-300 z-10 select-none">Key ${i}</span>
        </button>
      `;

      const btn = cell.querySelector('button');
      btn.onclick = () => {
        this.triggerReaction(keyId);
        this.#onSelectControl(keyId);
      };

      this.#keysGrid.appendChild(cell);
    }
  }

  #bindKnobEvents() {
    for (let n = 1; n <= KNOB_COUNT; n += 1) {
      const dialWrap = document.getElementById(`knob${n}-dial-wrap`);
      if (dialWrap) {
        dialWrap.onclick = () => this.#onSelectControl(`knob${n}_press`);
      }
      const leftBtn = document.getElementById(`btn-knob${n}_left`);
      if (leftBtn) {
        leftBtn.onclick = () => this.#onSelectControl(`knob${n}_left`);
      }
      const rightBtn = document.getElementById(`btn-knob${n}_right`);
      if (rightBtn) {
        rightBtn.onclick = () => this.#onSelectControl(`knob${n}_right`);
      }
    }
  }

  /**
   * Sync visual representation with current state.
   */
  render(state) {
    const layer = selectLayerData(state);
    const lighting = selectLighting(state);
    const spec = ledColorSpec(lighting.color);

    // Update CSS variables for LED simulation
    document.documentElement.style.setProperty('--led-color', spec.color);
    document.documentElement.style.setProperty('--led-glow', spec.glow);
    document.documentElement.style.setProperty('--led-dim', spec.dim);

    if (this.#keysGrid) {
      this.#keysGrid.className = `grid grid-cols-3 gap-3 effect-${lighting.effect}`;
    }

    // Update Keycap badges
    for (let i = 1; i <= KEY_COUNT; i += 1) {
      const badge = document.getElementById(`badge-key${i}`);
      if (badge) {
        badge.textContent = describeBinding(layer[`key${i}`]);
      }
    }

    // Update Knobs center text
    for (let n = 1; n <= KNOB_COUNT; n += 1) {
      const textEl = document.getElementById(`knob${n}-dial-text`);
      if (textEl) {
        const val = layer[`knob${n}_press`];
        textEl.textContent = val ? describeBinding(val) : 'Push';
      }
    }

    // Update active selection highlight
    this.#updateSelectionVisuals(state.selected);

    // Update layer segment notches
    for (let l = 1; l <= 3; l += 1) {
      const seg = this.#layerSegs[l];
      if (seg) {
        if (l === state.layer) seg.classList.add('active');
        else seg.classList.remove('active');
      }
    }

    // Update sensor notch based on device connection
    if (this.#sensorNotch) {
      if (state.device.connected) {
        this.#sensorNotch.classList.add('sensor-connected');
      } else {
        this.#sensorNotch.classList.remove('sensor-connected');
      }
    }
  }

  #updateSelectionVisuals(selectedName) {
    document.querySelectorAll('.keycap-item').forEach((el) => el.classList.remove('key-selected'));
    for (let n = 1; n <= KNOB_COUNT; n += 1) {
      document.getElementById(`knob${n}-dial-wrap`)?.classList.remove('knob-selected');
    }
    document.querySelectorAll('[id^="btn-knob"]').forEach((el) => el.classList.remove('bg-[#0071e3]', 'text-white'));

    if (selectedName.startsWith('key')) {
      document.getElementById(`btn-${selectedName}`)?.classList.add('key-selected');
    } else if (selectedName.endsWith('_press')) {
      const knobMatch = /^knob(\d+)_press$/.exec(selectedName);
      if (knobMatch) {
        document.getElementById(`knob${knobMatch[1]}-dial-wrap`)?.classList.add('knob-selected');
      }
    } else {
      document.getElementById(`btn-${selectedName}`)?.classList.add('bg-[#0071e3]', 'text-white');
    }
  }

  /**
   * Visual key depression and LED reaction animation upon clicking or pressing a key.
   */
  triggerReaction(keyId, effectId = null) {
    const el = document.getElementById(`btn-${keyId}`);
    const cell = document.getElementById(`cell-${keyId}`);
    if (!el) return;

    el.classList.add('key-reacted');
    cell?.classList.add('key-cell-reacted');
    setTimeout(() => {
      el.classList.remove('key-reacted');
      cell?.classList.remove('key-cell-reacted');
    }, 350);

    const activeEffect = effectId ?? this.#getCurrentEffect();
    if (activeEffect === 0 || activeEffect === 1) return;

    this.#clearAnimTimers();

    const flashKey = (k) => {
      const g = document.getElementById(`glow-${k}`);
      if (g) {
        g.classList.remove('glow-flash-active', 'glow-white-active');
        void g.offsetWidth;
        g.classList.add('glow-flash-active');
        const cleanup = setTimeout(() => g.classList.remove('glow-flash-active'), FLASH_MS);
        this.#animTimers.push(cleanup);
      }
    };

    if (activeEffect === 2 || activeEffect === 3) {
      const sequence = EFFECT_SEQUENCES[activeEffect] || [];
      sequence.forEach((k, idx) => {
        const timer = setTimeout(() => flashKey(k), idx * SWEEP_STEP_MS);
        this.#animTimers.push(timer);
      });
      return;
    }

    if (activeEffect === 4) {
      const glow = document.getElementById(`glow-${keyId}`);
      if (glow) {
        glow.classList.remove('glow-flash-active', 'glow-white-active');
        void glow.offsetWidth;
        glow.classList.add('glow-white-active');
        const cleanup = setTimeout(() => glow.classList.remove('glow-white-active'), WHITE_FLASH_MS);
        this.#animTimers.push(cleanup);
      }
    }
  }

  /**
   * Tactile physical hit animation triggered when the physical device sends a keypress or knob event.
   */
  triggerPhysicalHit(controlName) {
    if (controlName.startsWith('key')) {
      const el = document.getElementById(`btn-${controlName}`);
      if (el) {
        el.classList.add('key-physically-pressed');
        this.triggerReaction(controlName);
        setTimeout(() => el.classList.remove('key-physically-pressed'), 200);
      }
    } else {
      const knobMatch = /^knob(\d+)_(left|press|right)$/.exec(controlName);
      if (knobMatch) {
        const [, num, gesture] = knobMatch;
        const dial = document.getElementById(`knob${num}-dial-wrap`);
        if (gesture === 'left') dial?.classList.add('knob-rotated-left');
        else if (gesture === 'right') dial?.classList.add('knob-rotated-right');
        else dial?.classList.add('knob-pressed');

        setTimeout(() => dial?.classList.remove('knob-rotated-left', 'knob-rotated-right', 'knob-pressed'), 220);
      }
    }
  }

  setScanBeam(visible) {
    if (visible) this.#scanBeam?.classList.remove('hidden');
    else this.#scanBeam?.classList.add('hidden');
  }

  #getCurrentEffect() {
    const classList = this.#keysGrid?.className || '';
    const match = /effect-(\d+)/.exec(classList);
    return match ? Number.parseInt(match[1], 10) : 1;
  }

  #clearAnimTimers() {
    this.#animTimers.forEach((t) => clearTimeout(t));
    this.#animTimers = [];
  }
}
