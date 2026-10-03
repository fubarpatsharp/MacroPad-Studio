/**
 * Top titlebar header view: brand, WebHID connect button with connection status,
 * and JSON import/export actions.
 */

import { DEVICE } from '../config/constants.js';
import { parseConfigDocument } from '../core/config-model.js';

export class HeaderView {
  #actions;
  #hud;
  #onConnect;

  #btnConnect;
  #statusDot;
  #pillName;
  #btnImport;
  #btnExport;
  #fileInput;

  constructor({ actions, hud, onConnect = () => {} }) {
    this.#actions = actions;
    this.#hud = hud;
    this.#onConnect = onConnect;

    this.#btnConnect = document.getElementById('btn-connect');
    this.#statusDot = document.getElementById('device-status-dot');
    this.#pillName = document.getElementById('device-pill-name');
    this.#btnImport = document.getElementById('btn-import-json');
    this.#btnExport = document.getElementById('btn-export-json');
    this.#fileInput = document.getElementById('file-import');

    this.#bindEvents();
  }

  #bindEvents() {
    if (this.#btnConnect) {
      this.#btnConnect.onclick = () => this.#onConnect();
    }

    if (this.#btnImport && this.#fileInput) {
      this.#btnImport.onclick = () => this.#fileInput.click();
      this.#fileInput.onchange = (e) => this.#handleImportFile(e);
    }

    if (this.#btnExport) {
      this.#btnExport.onclick = () => this.#handleExportFile();
    }
  }

  setConnectBusy(busy) {
    if (this.#btnConnect) this.#btnConnect.disabled = busy;
  }

  #handleExportFile() {
    const config = this.#actions.getConfig ? this.#actions.getConfig() : null;
    if (!config) return;

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'macropad_config.json';
    a.click();
    URL.revokeObjectURL(url);
    this.#hud.showToast('Configuration exported as JSON');
  }

  #handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target.result);
        const parsed = parseConfigDocument(raw);
        this.#actions.replaceConfig(parsed);
        this.#hud.showToast('Configuration imported successfully!');
      } catch (err) {
        this.#hud.showToast(`Import error: ${err.message}`, true);
      } finally {
        if (this.#fileInput) this.#fileInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  render(state) {
    const connected = state.device.connected;
    const defaultLabel = `Connect USB (${DEVICE.id})`;
    const activeLabel = state.device.label || `Connected (${DEVICE.id})`;

    if (this.#statusDot) {
      this.#statusDot.className = connected
        ? 'w-2 h-2 rounded-full bg-emerald-500 status-pulse-live'
        : 'w-2 h-2 rounded-full bg-zinc-400';
    }

    if (this.#pillName) {
      this.#pillName.textContent = connected ? activeLabel : defaultLabel;
    }
  }
}
