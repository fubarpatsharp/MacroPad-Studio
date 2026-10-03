/**
 * WebHID transport for the macro pad.
 *
 * Knows how to frame reports, send commands and collect responses. It does
 * not know what a "binding" or a "layer config" means to the user; that is
 * `codec.js`. Everything here speaks bytes, ids and wire bindings.
 */

import { DEVICE } from '../config/constants.js';
import {
  COMMIT_PAYLOAD, COMMIT_SETTLE_MS, Command, LayerConfig, MACRO_DELAY_KIND, MACRO_DELAY_SLOT,
  MEDIA_MARKER, MOUSE_MARKER, Mode, Offset, PAYLOAD_SIZE, READ_ROW_COUNT,
  READ_ROW_MIN_LENGTH, READ_TIMEOUT_MS, REPORT_ID, SAVE_SETTLE_MS,
} from './usb-codes.js';

const VENDOR_USAGE_PAGE = 0xff00;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @returns {Uint8Array} a zero-filled 64-byte payload starting with `bytes` */
function payload(...bytes) {
  const buffer = new Uint8Array(PAYLOAD_SIZE);
  buffer.set(bytes);
  return buffer;
}

export class MacroPadHid {
  /** @type {HIDDevice | null} */
  #device = null;
  /** Reports received but not yet consumed. */
  #queue = [];
  /** Readers waiting for the next report. */
  #waiters = [];
  #onInputReport = (event) => this.#receive(event);

  static get isSupported() {
    return typeof navigator !== 'undefined' && 'hid' in navigator;
  }

  get device() {
    return this.#device;
  }

  get isConnected() {
    return this.#device?.opened === true;
  }

  /** True if `device` is the pad this app supports. */
  static matches(device) {
    return device.vendorId === DEVICE.vendorId && device.productId === DEVICE.productId;
  }

  // -------------------------------------------------------------- lifecycle --

  /** Ask the user to pick the pad (must run from a user gesture), then open it. */
  async requestAndConnect() {
    if (!MacroPadHid.isSupported) {
      throw new Error('WebHID is not supported in this browser. Please use Chrome, Edge, or Opera.');
    }
    const devices = await navigator.hid.requestDevice({
      filters: [{ vendorId: DEVICE.vendorId, productId: DEVICE.productId }],
    });
    if (devices.length === 0) throw new Error('No device selected.');

    // The pad exposes several HID interfaces; configuration lives on the
    // vendor-defined one.
    const vendorInterface = devices.find((d) =>
      d.collections.some((c) => c.usagePage === VENDOR_USAGE_PAGE),
    );
    await this.attach(vendorInterface ?? devices[0]);
  }

  /** Adopt an already-permitted device (e.g. from `navigator.hid.getDevices()`). */
  async attach(device) {
    this.#detachListener();
    this.#device = device;
    if (!device.opened) await device.open();
    device.addEventListener('inputreport', this.#onInputReport);
  }

  async disconnect() {
    const device = this.#device;
    this.#detachListener();
    this.#device = null;
    if (device?.opened) await device.close();
  }

  /** Forget the device without closing it (it was already unplugged). */
  forget() {
    this.#detachListener();
    this.#device = null;
  }

  #detachListener() {
    this.#device?.removeEventListener('inputreport', this.#onInputReport);
    this.#queue = [];
  }

  // ---------------------------------------------------------------- reading --

  #receive(event) {
    if (event.reportId !== REPORT_ID) return;
    const { buffer, byteOffset, byteLength } = event.data;
    const data = new Uint8Array(buffer, byteOffset, byteLength);
    const waiter = this.#waiters.shift();
    if (waiter) waiter(data);
    else this.#queue.push(data);
  }

  /** Next incoming report, or `null` after `timeoutMs`. */
  #nextReport(timeoutMs) {
    if (this.#queue.length > 0) return Promise.resolve(this.#queue.shift());
    return new Promise((resolve) => {
      const waiter = (data) => {
        clearTimeout(timer);
        resolve(data);
      };
      const timer = setTimeout(() => {
        this.#waiters = this.#waiters.filter((w) => w !== waiter);
        resolve(null);
      }, timeoutMs);
      this.#waiters.push(waiter);
    });
  }

  /**
   * Read every binding stored for `layer`.
   * @returns {Promise<Record<number, object>>} wire bindings keyed by button id
   */
  async readLayer(layer) {
    this.#assertConnected();
    this.#queue = [];
    await this.#send(payload(Command.READ, 0x0f, 0x03, layer, 0x05));

    const bindings = {};
    for (let row = 0; row < READ_ROW_COUNT; row += 1) {
      const report = await this.#nextReport(READ_TIMEOUT_MS);
      if (!report || report.length < READ_ROW_MIN_LENGTH) break;
      if (report[0] !== Command.READ || report[Offset.LAYER] !== layer) continue;

      const buttonId = report[Offset.BUTTON];
      const wire = this.#parseRow(report);
      if (wire) bindings[buttonId] = wire;
    }
    return bindings;
  }

  #parseRow(report) {
    const mode = report[Offset.MODE];
    switch (mode) {
      case Mode.KEYBOARD: {
        const keys = [];
        for (let i = 0; i < report[Offset.COUNT]; i += 1) {
          const at = Offset.DATA + i * 2;
          if (at + 1 < report.length) keys.push([report[at], report[at + 1]]);
        }
        return { mode, keys };
      }
      case Mode.MEDIA:
        return { mode, consumerCode: report[Offset.DATA] };
      case Mode.MOUSE:
        return { mode, buttonMask: report[Offset.DATA], wheel: report[Offset.MOUSE_WHEEL] || 0 };
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------- writing --

  /** Write one control's binding and commit it. */
  async writeButton(buttonId, layer, wire) {
    const data = payload(Command.WRITE, buttonId, layer, wire.mode);

    switch (wire.mode) {
      case Mode.KEYBOARD:
        data[Offset.COUNT] = wire.keys.length;
        wire.keys.forEach(([modifiers, code], i) => {
          const at = Offset.DATA + i * 2;
          if (at + 1 < PAYLOAD_SIZE) {
            data[at] = modifiers;
            data[at + 1] = code;
          }
        });
        break;
      case Mode.MEDIA:
        data[Offset.COUNT] = MEDIA_MARKER;
        data[Offset.DATA] = wire.consumerCode;
        break;
      case Mode.MOUSE:
        data[Offset.COUNT] = MOUSE_MARKER;
        data[Offset.DATA] = wire.buttonMask;
        data[Offset.MOUSE_WHEEL] = wire.wheel;
        break;
      default:
        throw new Error(`Unsupported binding mode ${wire.mode}`);
    }
    await this.#sendAndCommit(data);
  }

  /** Write the delay between macro steps for `layer` (16-bit little endian). */
  async writeMacroDelay(layer, delayMs) {
    await this.#sendAndCommit(
      payload(
        Command.WRITE, MACRO_DELAY_SLOT, layer, MACRO_DELAY_KIND,
        delayMs & 0xff, (delayMs >> 8) & 0xff,
      ),
    );
  }

  /**
   * Write a layer's LED colour and effect. The firmware wants two layer-config
   * records: the LED byte, then a fixed footer record.
   */
  async writeLayerLeds(layer, { colorId, effectId }) {
    const ledByte = ((colorId & 0x0f) << 4) | (effectId & 0x0f);

    const leds = new Uint8Array(60);
    leds[5] = 0x01;
    leds[7] = ledByte;
    await this.#writeLayerConfig(layer, LayerConfig.LEDS, leds);

    const footer = new Uint8Array(60);
    footer[0] = 0xd0;
    footer[5] = 0x01;
    footer[7] = 0x10;
    await this.#writeLayerConfig(layer, LayerConfig.LEDS_FOOTER, footer);
  }

  /** Persist everything written so far to the pad's flash memory. */
  async saveToFlash() {
    await this.#send(payload(Command.SAVE, 0x03));
    await sleep(SAVE_SETTLE_MS);
  }

  // ---------------------------------------------------------------- private --

  async #writeLayerConfig(layer, kind, data) {
    const record = payload(Command.LAYER_CONFIG, LayerConfig.SUB_COMMAND, layer, kind);
    record.set(data.subarray(0, 60), 4);
    await this.#sendAndCommit(record);
  }

  #assertConnected() {
    if (!this.isConnected) throw new Error('Device not connected');
  }

  async #send(data) {
    this.#assertConnected();
    await this.#device.sendReport(REPORT_ID, data);
  }

  async #sendAndCommit(data) {
    await this.#send(data);
    await this.#send(payload(...COMMIT_PAYLOAD));
    await sleep(COMMIT_SETTLE_MS);
  }
}
