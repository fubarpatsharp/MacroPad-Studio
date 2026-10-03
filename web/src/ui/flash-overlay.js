/**
 * Fullscreen modal overlay during hardware flashing.
 */

export class FlashOverlay {
  #overlayEl;
  #spinnerSvg;
  #successIcon;
  #titleEl;
  #subtitleEl;
  #progressBar;
  #stageEl;
  #percentEl;

  constructor(elements = {}) {
    this.#overlayEl = elements.overlayEl || document.getElementById('flash-loader-overlay');
    this.#spinnerSvg = elements.spinnerSvg || document.getElementById('flash-spinner-svg');
    this.#successIcon = elements.successIcon || document.getElementById('flash-success-icon');
    this.#titleEl = elements.titleEl || document.getElementById('flash-loader-title');
    this.#subtitleEl = elements.subtitleEl || document.getElementById('flash-loader-subtitle');
    this.#progressBar = elements.progressBar || document.getElementById('flash-progress-bar');
    this.#stageEl = elements.stageEl || document.getElementById('flash-stage-text');
    this.#percentEl = elements.percentEl || document.getElementById('flash-percent-text');
  }

  show() {
    if (!this.#overlayEl) return;
    this.#overlayEl.classList.add('active');
    this.#spinnerSvg?.classList.remove('hidden');
    this.#successIcon?.classList.add('hidden');
    if (this.#titleEl) this.#titleEl.textContent = 'Flashing to MacroPad...';
    if (this.#subtitleEl) this.#subtitleEl.textContent = 'Writing configuration to onboard memory';
    if (this.#progressBar) this.#progressBar.style.width = '0%';
    if (this.#percentEl) this.#percentEl.textContent = '0%';
    if (this.#stageEl) this.#stageEl.textContent = 'Connecting to hardware...';
  }

  update({ percent, stage, detail }) {
    if (this.#progressBar) this.#progressBar.style.width = `${percent}%`;
    if (this.#percentEl) this.#percentEl.textContent = `${percent}%`;
    if (this.#stageEl && stage) this.#stageEl.textContent = stage;
    if (this.#subtitleEl && detail) this.#subtitleEl.textContent = detail;
  }

  setSuccess(title = 'Flash Complete!', subtitle = 'Macro pad updated successfully') {
    if (this.#progressBar) this.#progressBar.style.width = '100%';
    if (this.#percentEl) this.#percentEl.textContent = '100%';
    if (this.#titleEl) this.#titleEl.textContent = title;
    if (this.#subtitleEl) this.#subtitleEl.textContent = subtitle;
    if (this.#stageEl) this.#stageEl.textContent = 'Hardware ready';
    this.#spinnerSvg?.classList.add('hidden');
    this.#successIcon?.classList.remove('hidden');
  }

  setError(errorMessage) {
    if (this.#titleEl) this.#titleEl.textContent = 'Flashing Interrupted';
    if (this.#subtitleEl) this.#subtitleEl.textContent = errorMessage;
  }

  hide() {
    this.#overlayEl?.classList.remove('active');
  }
}
