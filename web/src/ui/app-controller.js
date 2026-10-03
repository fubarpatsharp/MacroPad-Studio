/**
 * Main application coordinator: orchestrates state, UI views, physical input
 * listeners, and WebHID hardware workflows.
 */

import { DEVICE } from '../config/constants.js';
import { formatControlTitle } from '../config/controls.js';
import { findControlForInput } from '../core/control-matcher.js';
import { comboFromKeyEvent, mouseActionFromButton, wheelActionFromEvent } from '../core/input-events.js';
import { createStudio, selectLayerData } from '../core/studio.js';
import { flashDevice, MacroPadHid, readDevice } from '../protocol/index.js';
import { ChassisView } from './chassis.js';
import { FlashOverlay } from './flash-overlay.js';
import { FloatingBarView } from './floating-bar.js';
import { HeaderView } from './header.js';
import { StudioHud } from './hud.js';
import { InspectorView } from './inspector.js';

export class AppController {
  #store;
  #actions;
  #transport;
  #hud;
  #chassis;
  #inspector;
  #floatingBar;
  #header;
  #flashOverlay;

  constructor() {
    const studio = createStudio();
    this.#store = studio.store;
    this.#actions = studio.actions;
    this.#actions.getConfig = () => this.#store.getState().config;

    this.#transport = new MacroPadHid();
    this.#hud = new StudioHud();
    this.#flashOverlay = new FlashOverlay();

    this.#chassis = new ChassisView({
      onSelectControl: (control) => this.#actions.selectControl(control),
    });

    this.#inspector = new InspectorView(this.#actions, this.#hud);

    this.#floatingBar = new FloatingBarView({
      actions: this.#actions,
      onRead: () => this.handleReadDevice(),
      onFlash: () => this.handleFlashDevice(),
    });

    this.#header = new HeaderView({
      actions: this.#actions,
      hud: this.#hud,
      onConnect: () => this.handleConnect(),
    });

    this.#setupStoreSubscription();
    this.#setupPhysicalTracking();
    this.#setupDeviceLifecycle();
  }

  start() {
    this.#renderAll();
    this.#checkWebHidSupport();
    this.#autoDiscoverDevice();
  }

  #setupStoreSubscription() {
    this.#store.subscribe((state) => {
      this.#chassis.render(state);
      this.#inspector.render(state);
      this.#floatingBar.render(state);
      this.#header.render(state);
    });
  }

  #renderAll() {
    const state = this.#store.getState();
    this.#chassis.render(state);
    this.#inspector.render(state);
    this.#floatingBar.render(state);
    this.#header.render(state);
  }

  // ------------------------------------------------------------- hardware ---

  async handleConnect() {
    this.#header.setConnectBusy(true);
    try {
      await this.#transport.requestAndConnect();
      this.#actions.setDevice(true, `Connected (${DEVICE.id})`);
      this.#hud.showToast('Connected to Macro Pad via WebHID!');
    } catch (err) {
      this.#actions.setDevice(false, null);
      this.#hud.showToast(`Connection note: ${err.message}`, true);
    } finally {
      this.#header.setConnectBusy(false);
    }
  }

  async handleReadDevice() {
    this.#floatingBar.setReadBusy(true);
    this.#chassis.setScanBeam(true);

    try {
      if (!this.#transport.isConnected) {
        await this.#transport.requestAndConnect();
      }

      this.#actions.setDevice(true, 'Reading memory...');
      const readLayers = await readDevice(this.#transport);
      this.#actions.mergeDeviceBindings(readLayers);
      this.#actions.setDevice(true, `Connected (${DEVICE.id})`);
      this.#hud.showToast('Memory read successfully across all 3 layers!');
    } catch (err) {
      this.#hud.showToast(`Read failed: ${err.message}`, true);
    } finally {
      this.#floatingBar.setReadBusy(false);
      this.#chassis.setScanBeam(false);
    }
  }

  async handleFlashDevice() {
    this.#floatingBar.setFlashBusy(true);
    this.#flashOverlay.show();

    try {
      if (!this.#transport.isConnected) {
        await this.#transport.requestAndConnect();
      }

      this.#actions.setDevice(true, 'Writing flash...');
      const config = this.#store.getState().config;

      await flashDevice(this.#transport, config, (progress) => {
        this.#flashOverlay.update(progress);
      });

      this.#flashOverlay.setSuccess();
      this.#actions.setDevice(true, 'Flashed OK!');
      this.#hud.showToast('Success! Memory saved permanently to hardware flash.');

      await new Promise((resolve) => setTimeout(resolve, 600));
    } catch (err) {
      this.#flashOverlay.setError(err.message);
      this.#hud.showToast(`Flashing error: ${err.message}`, true);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    } finally {
      this.#flashOverlay.hide();
      this.#floatingBar.setFlashBusy(false);
      const isConnected = this.#transport.isConnected;
      this.#actions.setDevice(isConnected, isConnected ? `Connected (${DEVICE.id})` : null);
    }
  }

  // ---------------------------------------------------- physical tracking ---

  #setupPhysicalTracking() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
      }
      const combo = comboFromKeyEvent(e);
      if (!combo) return;
      this.#onHardwareInput(combo, `[${combo.toUpperCase()}]`);
    });

    window.addEventListener('wheel', (e) => {
      if (e.target.closest('#keystrokes-list, main, input, select, textarea')) {
        return;
      }
      const action = wheelActionFromEvent(e);
      this.#onHardwareInput(action, action === 'wheel_up' ? 'Scroll Up' : 'Scroll Down');
    }, { passive: true });

    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, input, select, textarea, .keycap-item, .knob-container')) {
        return;
      }
      const action = mouseActionFromButton(e.button);
      this.#onHardwareInput(action, action.toUpperCase());
    });
  }

  #onHardwareInput(signature, displayLabel) {
    const state = this.#store.getState();
    const layer = selectLayerData(state);
    const matchedControl = findControlForInput(layer, signature);

    const title = matchedControl ? formatControlTitle(matchedControl) : '';
    this.#hud.showEventDetected(displayLabel, title);

    if (matchedControl) {
      this.#chassis.triggerPhysicalHit(matchedControl);
      if (state.autoSelect) {
        this.#actions.selectControl(matchedControl);
      }
    }
  }

  // ----------------------------------------------------- device lifecycle ---

  #checkWebHidSupport() {
    if (!MacroPadHid.isSupported) {
      document.getElementById('webhid-warning')?.classList.remove('hidden');
    }
  }

  #setupDeviceLifecycle() {
    if (!MacroPadHid.isSupported) return;

    navigator.hid.addEventListener('disconnect', (event) => {
      if (this.#transport.device === event.device) {
        this.#transport.forget();
        this.#actions.setDevice(false, null);
        this.#hud.showToast('Device disconnected', true);
      }
    });

    navigator.hid.addEventListener('connect', async (event) => {
      if (MacroPadHid.matches(event.device)) {
        try {
          await this.#transport.attach(event.device);
          this.#actions.setDevice(true, `Connected (${DEVICE.id})`);
          this.#hud.showToast('Macro Pad reconnected!');
        } catch {
          this.#actions.setDevice(true, `Connected (${DEVICE.id})`);
        }
      }
    });
  }

  async #autoDiscoverDevice() {
    if (!MacroPadHid.isSupported) return;
    try {
      const devices = await navigator.hid.getDevices();
      const pad = devices.find((d) => MacroPadHid.matches(d));
      if (pad) {
        try {
          await this.#transport.attach(pad);
          this.#actions.setDevice(true, `Connected (${DEVICE.id})`);
        } catch {
          this.#actions.setDevice(false, null);
        }
      }
    } catch {
      // Ignored
    }
  }
}
