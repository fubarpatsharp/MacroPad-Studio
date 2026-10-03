/**
 * Bottom floating macOS action island: layer switcher, Read from Device, Flash to Pad.
 */

import { LAYER_COUNT } from '../config/constants.js';

export class FloatingBarView {
  #actions;
  #onRead;
  #onFlash;
  #layerButtons = [];
  #btnRead;
  #btnFlash;

  constructor({ actions, onRead = () => {}, onFlash = () => {} }) {
    this.#actions = actions;
    this.#onRead = onRead;
    this.#onFlash = onFlash;

    for (let l = 1; l <= LAYER_COUNT; l += 1) {
      const btn = document.getElementById(`layer-btn-${l}`);
      if (btn) {
        btn.onclick = () => this.#actions.selectLayer(l);
        this.#layerButtons[l] = btn;
      }
    }

    this.#btnRead = document.getElementById('btn-read');
    if (this.#btnRead) {
      this.#btnRead.onclick = () => this.#onRead();
    }

    this.#btnFlash = document.getElementById('btn-flash');
    if (this.#btnFlash) {
      this.#btnFlash.onclick = () => this.#onFlash();
    }
  }

  setReadBusy(busy) {
    if (this.#btnRead) {
      this.#btnRead.disabled = busy;
    }
  }

  setFlashBusy(busy) {
    if (this.#btnFlash) {
      this.#btnFlash.disabled = busy;
    }
  }

  render(state) {
    // Update layer buttons active appearance
    for (let l = 1; l <= LAYER_COUNT; l += 1) {
      const btn = this.#layerButtons[l];
      if (btn) {
        btn.className = l === state.layer
          ? 'px-4 py-1.5 text-xs font-bold rounded-full transition bg-white text-[#0071e3] shadow-sm'
          : 'px-4 py-1.5 text-xs font-bold rounded-full transition text-[#515154] hover:text-[#1d1d1f]';
      }
    }

    // Flash button state based on connection
    if (this.#btnFlash) {
      const connected = state.device.connected;
      if (connected) {
        this.#btnFlash.disabled = false;
        this.#btnFlash.className = 'flex items-center space-x-2 px-6 py-2 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold shadow-sm hover:shadow transition active:scale-95 cursor-pointer';
        this.#btnFlash.title = 'Write memory permanently to pad flash';
        const svg = this.#btnFlash.querySelector('svg');
        if (svg) svg.setAttribute('class', 'w-4 h-4 text-white');
      } else {
        this.#btnFlash.disabled = true;
        this.#btnFlash.className = 'flex items-center space-x-2 px-6 py-2 rounded-full bg-black/[0.08] text-[#86868b] opacity-60 cursor-not-allowed text-xs font-bold shadow-none transition';
        this.#btnFlash.title = 'Connect USB device to flash';
        const svg = this.#btnFlash.querySelector('svg');
        if (svg) svg.setAttribute('class', 'w-4 h-4 text-[#86868b]');
      }
    }
  }
}
