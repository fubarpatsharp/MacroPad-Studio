/**
 * macOS Control Inspector component: manages tabs (Macro, Media, Mouse, Disabled),
 * the keystroke sequence builder, quick-text phrase expander, delay slider, and
 * layer lighting palette.
 */

import { MEDIA_ACTIONS, MOUSE_ACTIONS } from '../config/actions.js';
import { MAX_MACRO_STEPS } from '../config/constants.js';
import { formatControlTitle } from '../config/controls.js';
import { KEY_CATEGORIES } from '../config/key-catalog.js';
import { LED_COLOR_NAMES } from '../config/led.js';
import { EDITOR_MODIFIERS } from '../config/modifiers.js';
import { ActionKind, classifyBinding } from '../core/bindings.js';
import { parseCombo } from '../core/combo.js';
import { comboFromKeyEvent } from '../core/input-events.js';
import { selectBinding, selectDelay, selectLighting, selectSteps } from '../core/studio.js';
import { ICONS } from './icons.js';

export class InspectorView {
  #actions;
  #hud;

  // DOM Elements
  #controlNameEl;
  #controlSubEl;
  #resetBtn;
  #liveRecordInput;
  #keystrokesList;
  #quickTextInput;
  #quickTextApplyBtn;
  #addStepBtn;
  #delayInput;
  #keystrokeCountEl;
  #progressBar;
  #effectSelect;
  #layerLightLabel;
  #autoSelectToggle;

  constructor(actions, hud) {
    this.#actions = actions;
    this.#hud = hud;

    this.#cacheElements();
    this.#bindStaticEvents();
  }

  #cacheElements() {
    this.#controlNameEl = document.getElementById('selected-control-name');
    this.#controlSubEl = document.getElementById('selected-control-sub');
    this.#resetBtn = document.querySelector('button[onclick*="resetControl"]');
    this.#liveRecordInput = document.getElementById('live-record-input');
    this.#keystrokesList = document.getElementById('keystrokes-list');
    this.#quickTextInput = document.getElementById('quick-text-input');
    this.#quickTextApplyBtn = this.#quickTextInput?.nextElementSibling;
    this.#addStepBtn = document.querySelector('button[onclick*="addKeystroke"]');
    this.#delayInput = document.getElementById('inter-key-delay');
    this.#keystrokeCountEl = document.getElementById('keystroke-count');
    this.#progressBar = document.getElementById('macro-progress-bar');
    this.#effectSelect = document.getElementById('led-effect-select');
    this.#layerLightLabel = document.getElementById('layer-light-label');
    this.#autoSelectToggle = document.getElementById('toggle-autoselect');
  }

  #bindStaticEvents() {
    // Reset button
    if (this.#resetBtn) {
      this.#resetBtn.onclick = () => {
        this.#actions.resetControl();
        this.#hud.showToast('Control disabled / cleared');
      };
    }

    // Tab buttons
    ['macro', 'media', 'mouse', 'disabled'].forEach((tab) => {
      const tabBtn = document.getElementById(`tab-${tab}`);
      if (tabBtn) {
        tabBtn.onclick = () => this.#actions.setTab(tab);
      }
    });

    // Add Step button
    if (this.#addStepBtn) {
      this.#addStepBtn.onclick = () => {
        const added = this.#actions.addStep();
        if (!added) {
          this.#hud.showToast(`Maximum macro steps reached (${MAX_MACRO_STEPS}).`, true);
        }
      };
    }

    // Live Recording input
    if (this.#liveRecordInput) {
      this.#liveRecordInput.addEventListener('keydown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const combo = comboFromKeyEvent(e);
        if (!combo) return;

        this.#actions.recordCombo(combo);
        this.#liveRecordInput.value = `Mapped: ${combo.toUpperCase()}`;
        setTimeout(() => {
          if (this.#liveRecordInput) this.#liveRecordInput.value = '';
        }, 1600);
        this.#hud.showToast(`Mapped shortcut to ${combo.toUpperCase()}`);
      });
    }

    // Quick Text input & apply
    if (this.#quickTextApplyBtn) {
      this.#quickTextApplyBtn.onclick = () => this.#applyQuickText();
    }
    if (this.#quickTextInput) {
      this.#quickTextInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.#applyQuickText();
        }
      });
    }

    // Inter-key delay input
    if (this.#delayInput) {
      this.#delayInput.addEventListener('change', (e) => {
        this.#actions.setDelay(e.target.value);
      });
    }

    // LED Effect select
    if (this.#effectSelect) {
      this.#effectSelect.addEventListener('change', (e) => {
        this.#actions.setLedEffect(e.target.value);
      });
    }

    // Media action buttons
    MEDIA_ACTIONS.forEach(({ id }) => {
      const btn = document.querySelector(`[data-action="${id}"]`);
      if (btn) {
        btn.onclick = () => {
          this.#actions.setBinding(id);
          this.#actions.setTab(ActionKind.MEDIA);
        };
      }
    });

    // Mouse action buttons
    MOUSE_ACTIONS.forEach(({ id }) => {
      const btn = document.querySelector(`[data-action="${id}"]`);
      if (btn) {
        btn.onclick = () => {
          this.#actions.setBinding(id);
          this.#actions.setTab(ActionKind.MOUSE);
        };
      }
    });

    // LED Color Swatches
    LED_COLOR_NAMES.forEach((colorName) => {
      const swatch = document.querySelector(`.color-swatch[data-color="${colorName}"]`);
      if (swatch) {
        swatch.onclick = () => this.#actions.setLedColor(colorName);
      }
    });

    // Auto-select toggle
    if (this.#autoSelectToggle) {
      this.#autoSelectToggle.addEventListener('change', (e) => {
        this.#actions.setAutoSelect(e.target.checked);
      });
    }
  }

  #applyQuickText() {
    if (!this.#quickTextInput || !this.#quickTextInput.value) return;
    const text = this.#quickTextInput.value;
    const report = this.#actions.applyPhrase(text);
    this.#quickTextInput.value = '';

    if (report.truncated) {
      this.#hud.showToast(`Phrase shortened to fit ${MAX_MACRO_STEPS} steps.`, true);
    } else if (report.skipped.length > 0) {
      this.#hud.showToast(`Some characters were skipped: ${report.skipped.join(' ')}`, true);
    } else {
      this.#hud.showToast('Text phrase applied as keystroke sequence!');
    }
  }

  /**
   * Sync Inspector view with state.
   */
  render(state) {
    const title = formatControlTitle(state.selected);
    if (this.#controlNameEl) this.#controlNameEl.textContent = title;
    if (this.#controlSubEl) this.#controlSubEl.textContent = `Layer ${state.layer} • Action Mapping`;
    if (this.#layerLightLabel) this.#layerLightLabel.textContent = `Layer ${state.layer}`;

    // Update active tab buttons and panels
    ['macro', 'media', 'mouse', 'disabled'].forEach((tab) => {
      const tabBtn = document.getElementById(`tab-${tab}`);
      const panel = document.getElementById(`panel-${tab}`);
      const isActive = state.tab === tab;

      if (tabBtn) {
        tabBtn.className = isActive
          ? 'action-tab flex items-center justify-center space-x-1.5 py-2 rounded-full text-xs font-bold transition bg-white text-[#0071e3] shadow-sm'
          : 'action-tab flex items-center justify-center space-x-1.5 py-2 rounded-full text-xs font-bold transition text-[#6e6e73] hover:text-[#1d1d1f]';
      }
      if (panel) {
        if (isActive) panel.classList.remove('hidden');
        else panel.classList.add('hidden');
      }
    });

    // Render Tab 1: Macro editor
    this.#renderMacroSteps(selectSteps(state));

    // Render Delay & Progress
    const delay = selectDelay(state);
    if (this.#delayInput && document.activeElement !== this.#delayInput) {
      this.#delayInput.value = delay;
    }

    // Highlight active Media button
    const currentBinding = selectBinding(state);
    const bindingStr = typeof currentBinding === 'string' ? currentBinding.toLowerCase() : '';

    document.querySelectorAll('.media-btn').forEach((btn) => {
      const act = btn.getAttribute('data-action');
      const isSelected = bindingStr === act && state.tab === ActionKind.MEDIA;
      btn.className = isSelected
        ? 'media-btn p-4 rounded-2xl border-2 border-[#0071e3] bg-blue-50/50 flex flex-col items-center justify-center transition shadow-sm text-[#0071e3]'
        : 'media-btn p-4 rounded-2xl border border-black/[0.08] hover:border-[#0071e3] flex flex-col items-center justify-center transition bg-white text-[#1d1d1f] shadow-sm';
    });

    // Highlight active Mouse button
    document.querySelectorAll('.mouse-btn').forEach((btn) => {
      const act = btn.getAttribute('data-action');
      const isSelected = bindingStr === act && state.tab === ActionKind.MOUSE;
      btn.className = isSelected
        ? 'mouse-btn p-4 rounded-2xl border-2 border-[#0071e3] bg-blue-50/50 flex flex-col items-center justify-center transition shadow-sm text-[#0071e3]'
        : 'mouse-btn p-4 rounded-2xl border border-black/[0.08] hover:border-[#0071e3] flex flex-col items-center justify-center transition bg-white text-[#1d1d1f] shadow-sm';
    });

    // Update Lighting Effects and Swatches
    const lighting = selectLighting(state);
    if (this.#effectSelect) {
      this.#effectSelect.value = String(lighting.effect);
    }

    document.querySelectorAll('.color-swatch').forEach((btn) => {
      const col = btn.getAttribute('data-color');
      if (col === lighting.color) {
        btn.innerHTML = ICONS.check;
        btn.classList.add('ring-2', 'ring-offset-2', 'ring-[#0071e3]');
      } else {
        btn.textContent = col === 'off' ? 'Off' : '';
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-[#0071e3]');
      }
    });

    // Sync auto-select checkbox
    if (this.#autoSelectToggle) {
      this.#autoSelectToggle.checked = state.autoSelect;
    }
  }

  #renderMacroSteps(steps) {
    if (!this.#keystrokesList) return;
    this.#keystrokesList.innerHTML = '';

    steps.forEach((stepStr, index) => {
      const row = document.createElement('div');
      row.className = 'flex items-center space-x-2 p-2 bg-black/[0.02] border border-black/[0.06] rounded-2xl';

      const parsed = parseCombo(stepStr);
      const activeMods = new Set(parsed.modifiers);

      // Modifier pills
      const modButtons = EDITOR_MODIFIERS.map(({ id, label }) => {
        const isActive = activeMods.has(id);
        const activeClass = isActive
          ? 'bg-[#0071e3] text-white shadow-sm'
          : 'bg-black/[0.06] text-[#515154] hover:bg-black/[0.1]';
        return `
          <button type="button" data-step="${index}" data-mod="${id}" class="step-mod-btn px-2.5 py-1 text-xs font-bold rounded-full transition ${activeClass}">
            ${label}
          </button>
        `;
      }).join('');

      // Dropdown categories
      const optionsHtml = KEY_CATEGORIES.map((cat) => `
        <optgroup label="${cat.name}">
          ${cat.keys.map((k) => `<option value="${k.code}" ${k.code === parsed.key ? 'selected' : ''}>${k.label}</option>`).join('')}
        </optgroup>
      `).join('');

      row.innerHTML = `
        <span class="text-xs font-bold text-[#86868b] w-5 text-center">${index + 1}</span>
        <div class="flex items-center space-x-1">
          ${modButtons}
        </div>
        <select data-step="${index}" aria-label="Key for step ${index + 1}" class="step-key-select macos-select flex-1 text-xs py-1.5 font-semibold text-[#1d1d1f] outline-none cursor-pointer">
          ${optionsHtml}
        </select>
        <button type="button" data-step="${index}" title="Delete step" aria-label="Delete step ${index + 1}" class="step-del-btn text-[#86868b] hover:text-red-500 p-1.5 rounded-full hover:bg-black/[0.04] transition">
          ${ICONS.trash}
        </button>
      `;

      // Bind dynamic row events
      row.querySelectorAll('.step-mod-btn').forEach((btn) => {
        btn.onclick = () => {
          const mod = btn.getAttribute('data-mod');
          this.#actions.toggleStepModifier(index, mod);
        };
      });

      const select = row.querySelector('.step-key-select');
      if (select) {
        select.onchange = (e) => {
          this.#actions.setStepKey(index, e.target.value);
        };
      }

      const delBtn = row.querySelector('.step-del-btn');
      if (delBtn) {
        delBtn.onclick = () => {
          this.#actions.removeStep(index);
        };
      }

      this.#keystrokesList.appendChild(row);
    });

    // Update step count and progress bar
    if (this.#keystrokeCountEl) {
      this.#keystrokeCountEl.textContent = `${steps.length} of ${MAX_MACRO_STEPS} keystrokes`;
    }
    if (this.#progressBar) {
      const pct = Math.min(100, Math.round((steps.length / MAX_MACRO_STEPS) * 100));
      this.#progressBar.style.width = `${pct}%`;
    }
  }
}
