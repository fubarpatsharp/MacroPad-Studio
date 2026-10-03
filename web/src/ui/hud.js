/**
 * Non-blocking floating toast HUD notification and live physical event indicator.
 */

export class StudioHud {
  #toastEl;
  #toastTextEl;
  #toastTimer = null;
  #badgeEl;
  #textEl;
  #eventTimer = null;

  constructor(elements = {}) {
    this.#toastEl = elements.toastEl || document.getElementById('macos-toast');
    this.#toastTextEl = elements.toastTextEl || document.getElementById('macos-toast-text');
    this.#badgeEl = elements.badgeEl || document.getElementById('live-event-badge');
    this.#textEl = elements.textEl || document.getElementById('live-event-text');
  }

  /**
   * Display a top floating toast notification.
   * @param {string} message
   * @param {boolean} [isError=false]
   * @param {number} [duration=2800]
   */
  showToast(message, isError = false, duration = 2800) {
    if (!this.#toastEl || !this.#toastTextEl) return;
    this.#toastTextEl.textContent = message;
    this.#toastEl.className = `macos-hud-toast toast-visible ${isError ? 'bg-red-900/90 text-white' : ''}`;

    if (this.#toastTimer) clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => {
      this.#toastEl?.classList.remove('toast-visible');
    }, duration);
  }

  /**
   * Trigger live hardware event feedback in the main inspector card.
   * @param {string} displayLabel e.g. "[CTRL+ALT+O]" or "Scroll Up"
   * @param {string} [matchedTitle] e.g. "Key 1"
   */
  showEventDetected(displayLabel, matchedTitle = '') {
    if (!this.#badgeEl || !this.#textEl) return;

    this.#badgeEl.className = 'w-2.5 h-2.5 rounded-full bg-[#0071e3] status-pulse-live';
    const targetDesc = matchedTitle ? ` ➔ ${matchedTitle}` : '';
    this.#textEl.textContent = `Detected: ${displayLabel}${targetDesc}`;

    if (this.#eventTimer) clearTimeout(this.#eventTimer);
    this.#eventTimer = setTimeout(() => {
      if (this.#badgeEl) this.#badgeEl.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
      if (this.#textEl) this.#textEl.textContent = 'Tracking active • Tap key or turn knob';
    }, 2400);
  }
}
