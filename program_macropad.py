#!/usr/bin/env python3
"""
Program the 12-key + 3-knob USB macro pad (USB VID:PID 1189:8840, WCH CH552G/CH57x, also supports 2-knob models).

Cross-platform support for Windows, macOS, and Linux.
Communicates natively via HIDAPI (driverless) with fallback to PyUSB.

Supports:
  - Standard keys, modifier combos ('ctrl+c', 'ctrl+alt+del')
  - Plain text strings and multi-key macros ('hello world', ['ctrl+a', 'del'])
  - Media controls (play_pause, next_track, prev_track, volume_up, volume_down, mute)
  - Mouse events (lclick, rclick, mclick, wheel_up, wheel_down)
  - Numeric keypad keys (kp_0 - kp_9, kp_enter, kp_plus, etc.)
  - 3 independent hardware layers with per-layer LED colors/effects and macro delays
  - Reading & exporting current hardware flash memory to JSON
  - Visual web UI (--gui)

Usage:
  python program_macropad.py                      # Program from macropad.json
  python program_macropad.py -c myconfig.json     # Use custom config
  python program_macropad.py --read               # Read & display current device bindings
  python program_macropad.py --export backup.json # Dump device memory to JSON file
  python program_macropad.py --led blue wave      # Quick LED change (all layers)
  python program_macropad.py --validate           # Validate JSON syntax offline
  python program_macropad.py --list-keys          # List all supported key names
  python program_macropad.py --gui                # Launch the graphical editor
"""

import argparse
import json
import os
import sys
import time

# Ensure safe UTF-8 stdout encoding on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# --- Hardware Constants ---
VENDOR_ID = 0x1189
PRODUCT_ID = 0x8840
REPORT_SIZE = 65  # 1 byte report ID (0x03) + 64 bytes payload

# Device action modes (Byte 4 of protocol)
MODE_KEYBOARD = 0x01
MODE_MEDIA = 0x02
MODE_MOUSE = 0x03

BUTTONS_PER_LAYER = 24
NUM_LAYERS = 3
MAX_MACRO_KEYS = 27  # (65 - 11 header bytes) // 2

# --- HID Modifiers ---
MODIFIER = {
    "none": 0x00,
    "ctrl": 0x01, "control": 0x01, "lctrl": 0x01,
    "shift": 0x02, "lshift": 0x02,
    "alt": 0x04, "option": 0x04, "lalt": 0x04,
    "meta": 0x08, "win": 0x08, "cmd": 0x08, "gui": 0x08, "lmeta": 0x08,
    "rctrl": 0x10,
    "rshift": 0x20,
    "ralt": 0x40, "altgr": 0x40,
    "rmeta": 0x80, "rwin": 0x80, "rcmd": 0x80, "rgui": 0x80,
}

# --- HID Keycodes (Usage Page 0x07) ---
KEY = {
    "none": 0x00,
    "a": 0x04, "b": 0x05, "c": 0x06, "d": 0x07, "e": 0x08, "f": 0x09,
    "g": 0x0A, "h": 0x0B, "i": 0x0C, "j": 0x0D, "k": 0x0E, "l": 0x0F,
    "m": 0x10, "n": 0x11, "o": 0x12, "p": 0x13, "q": 0x14, "r": 0x15,
    "s": 0x16, "t": 0x17, "u": 0x18, "v": 0x19, "w": 0x1A, "x": 0x1B,
    "y": 0x1C, "z": 0x1D,
    "1": 0x1E, "2": 0x1F, "3": 0x20, "4": 0x21, "5": 0x22,
    "6": 0x23, "7": 0x24, "8": 0x25, "9": 0x26, "0": 0x27,
    "enter": 0x28, "return": 0x28, "esc": 0x29, "escape": 0x29,
    "backspace": 0x2A, "tab": 0x2B, "space": 0x2C, " ": 0x2C,
    "minus": 0x2D, "-": 0x2D,
    "equal": 0x2E, "=": 0x2E,
    "lbracket": 0x2F, "[": 0x2F,
    "rbracket": 0x30, "]": 0x30,
    "backslash": 0x31, "\\": 0x31,
    "semicolon": 0x33, ";": 0x33,
    "quote": 0x34, "'": 0x34,
    "grave": 0x35, "`": 0x35,
    "comma": 0x36, ",": 0x36,
    "period": 0x37, ".": 0x37,
    "slash": 0x38, "/": 0x38,
    "capslock": 0x39,
    "f1": 0x3A, "f2": 0x3B, "f3": 0x3C, "f4": 0x3D, "f5": 0x3E,
    "f6": 0x3F, "f7": 0x40, "f8": 0x41, "f9": 0x42, "f10": 0x43,
    "f11": 0x44, "f12": 0x45,
    "printscreen": 0x46, "scrolllock": 0x47, "pause": 0x48,
    "insert": 0x49, "home": 0x4A, "pageup": 0x4B,
    "delete": 0x4C, "del": 0x4C, "end": 0x4D, "pagedown": 0x4E,
    "right": 0x4F, "left": 0x50, "down": 0x51, "up": 0x52,
    # Numpad
    "numlock": 0x53, "kp_numlock": 0x53,
    "kp_slash": 0x54, "kp_divide": 0x54,
    "kp_asterisk": 0x55, "kp_multiply": 0x55,
    "kp_minus": 0x56, "kp_plus": 0x57, "kp_enter": 0x58,
    "kp_1": 0x59, "kp_2": 0x5A, "kp_3": 0x5B, "kp_4": 0x5C, "kp_5": 0x5D,
    "kp_6": 0x5E, "kp_7": 0x5F, "kp_8": 0x60, "kp_9": 0x61, "kp_0": 0x62,
    "kp_dot": 0x63, "kp_decimal": 0x63, "kp_period": 0x63,
    # Extended F-keys
    "f13": 0x68, "f14": 0x69, "f15": 0x6A, "f16": 0x6B,
    "f17": 0x6C, "f18": 0x6D, "f19": 0x6E, "f20": 0x6F,
    "f21": 0x70, "f22": 0x71, "f23": 0x72, "f24": 0x73,
}

# --- Media Keys (HID Consumer Usage Page 0x0C) ---
MEDIA_KEYS = {
    "play_pause": 0xCD, "play": 0xCD, "pause": 0xCD,
    "next_track": 0xB5, "next": 0xB5,
    "prev_track": 0xB6, "prev": 0xB6, "previous": 0xB6,
    "volume_up": 0xE9, "vol_up": 0xE9,
    "volume_down": 0xEA, "vol_down": 0xEA,
    "mute": 0xE2,
    "stop": 0xB7,
}

# --- Mouse Actions ---
# Maps to (button_mask, wheel_delta)
MOUSE_ACTIONS = {
    "lclick": (0x01, 0), "left_click": (0x01, 0),
    "rclick": (0x02, 0), "right_click": (0x02, 0),
    "mclick": (0x04, 0), "middle_click": (0x04, 0),
    "wheel_up": (0x00, 1), "wheelup": (0x00, 1),
    "wheel_down": (0x00, 255), "wheeldown": (0x00, 255),
}

# Shifted symbol translation for string macros
SHIFTED_SYMBOLS = {
    "!": ("1", 0x02), "@": ("2", 0x02), "#": ("3", 0x02), "$": ("4", 0x02),
    "%": ("5", 0x02), "^": ("6", 0x02), "&": ("7", 0x02), "*": ("8", 0x02),
    "(": ("9", 0x02), ")": ("0", 0x02), "_": ("minus", 0x02), "+": ("equal", 0x02),
    "{": ("lbracket", 0x02), "}": ("rbracket", 0x02), "|": ("backslash", 0x02),
    ":": ("semicolon", 0x02), "\"": ("quote", 0x02), "<": ("comma", 0x02),
    ">": ("period", 0x02), "?": ("slash", 0x02), "~": ("grave", 0x02),
}

# Reverse lookup tables for decoding
_KEY_NAME = {v: k for k, v in KEY.items() if v != 0 and len(k) > 1 or k.isalnum()}
# Add preferred names
_KEY_NAME.update({
    0x2C: "space", 0x2D: "minus", 0x2E: "equal", 0x2F: "lbracket",
    0x30: "rbracket", 0x31: "backslash", 0x33: "semicolon", 0x34: "quote",
    0x35: "grave", 0x36: "comma", 0x37: "period", 0x38: "slash",
    0x4C: "delete",
})
_MEDIA_NAME = {
    0xCD: "play_pause", 0xB5: "next_track", 0xB6: "prev_track",
    0xE9: "volume_up", 0xEA: "volume_down", 0xE2: "mute", 0xB7: "stop",
}

# --- Button Name to ID Mapping ---
# Maps physical 3x4 layout (Row 1-4, Col 1-3) to hardware PCB addresses:
# Row 1: key1(0x09), key2(0x05), key3(0x01)
# Row 2: key4(0x0A), key5(0x06), key6(0x02)
# Row 3: key7(0x0B), key8(0x07), key9(0x03)
# Row 4: key10(0x0C), key11(0x08), key12(0x04)
BUTTON_NAMES = {
    "key1": 0x09, "key2": 0x05, "key3": 0x01,
    "key4": 0x0A, "key5": 0x06, "key6": 0x02,
    "key7": 0x0B, "key8": 0x07, "key9": 0x03,
    "key10": 0x0C, "key11": 0x08, "key12": 0x04,
    "knob1_left": 0x15, "knob1_press": 0x14, "knob1_right": 0x13,
    "knob2_left": 0x10, "knob2_press": 0x11, "knob2_right": 0x12,
    "knob3_left": 0x16, "knob3_press": 0x17, "knob3_right": 0x18,
}
_BUTTON_ID_TO_NAME = {v: k for k, v in BUTTON_NAMES.items()}

# --- LED Presets ---
LED_COLORS = {
    "off": 0, "red": 1, "orange": 2, "yellow": 3,
    "green": 4, "cyan": 5, "blue": 6, "purple": 7,
}
LED_EFFECTS = {
    "off": 0, "0": 0,
    "static": 1, "1": 1,
    "sweep": 2, "2": 2, "ripple": 2,
    "cascade": 3, "3": 3, "wave": 3,
    "white_flash": 4, "4": 4, "reactive": 4, "white": 4,
}
_LED_COLOR_NAME = {v: k for k, v in LED_COLORS.items()}
_LED_EFFECT_NAME = {0: "off", 1: "static", 2: "sweep", 3: "cascade", 4: "white_flash"}


# --- Device Abstraction (Dual Backend: HIDAPI + PyUSB) ---

class MacroPadDevice:
    """Unified interface for communicating with the macro pad."""
    def write(self, data: bytes):
        raise NotImplementedError
    def read(self, size: int = REPORT_SIZE, timeout_ms: int = 1000) -> bytes:
        raise NotImplementedError
    def close(self):
        pass


class HidApiDevice(MacroPadDevice):
    def __init__(self, handle):
        self._dev = handle

    def write(self, data: bytes):
        return self._dev.write(data)

    def read(self, size: int = REPORT_SIZE, timeout_ms: int = 1000) -> bytes:
        data = self._dev.read(size, timeout_ms=timeout_ms)
        return bytes(data) if data else b""

    def close(self):
        try:
            self._dev.close()
        except Exception:
            pass


class PyUsbDevice(MacroPadDevice):
    def __init__(self, dev, ep_out, ep_in):
        self._dev = dev
        self._ep_out = ep_out
        self._ep_in = ep_in

    def write(self, data: bytes):
        return self._ep_out.write(data, timeout=2000)

    def read(self, size: int = REPORT_SIZE, timeout_ms: int = 1000) -> bytes:
        if self._ep_in is None:
            return b""
        try:
            return bytes(self._ep_in.read(size, timeout=timeout_ms))
        except Exception:
            return b""

    def close(self):
        try:
            import usb.util
            usb.util.dispose_resources(self._dev)
        except Exception:
            pass


def open_device() -> MacroPadDevice:
    """
    Find and open the macro pad.
    Tries HIDAPI first (native & driverless on Windows/macOS/Linux),
    then falls back to PyUSB.
    """
    # 1. Try HIDAPI (driverless)
    try:
        import hid
        for d in hid.enumerate(VENDOR_ID, PRODUCT_ID):
            # Target vendor-defined interface (interface 0 or usage_page 0xFF00)
            if d.get("interface_number") == 0 or d.get("usage_page") == 0xFF00:
                h = hid.device()
                h.open_path(d["path"])
                print(f"  Connected via HIDAPI ({d.get('product_string', 'MacroPad')})")
                return HidApiDevice(h)
    except (ImportError, Exception):
        pass

    # 2. Try PyUSB as fallback
    try:
        import usb.core
        import usb.util

        dev = usb.core.find(idVendor=VENDOR_ID, idProduct=PRODUCT_ID)
        if dev is not None:
            try:
                dev.set_configuration()
            except usb.core.USBError as e:
                if e.errno == 16:  # Resource busy
                    for i in range(4):
                        try:
                            if dev.is_kernel_driver_active(i):
                                dev.detach_kernel_driver(i)
                        except (NotImplementedError, usb.core.USBError):
                            pass
                    dev.set_configuration()

            # Find interrupt OUT and IN endpoints
            cfg = dev.get_active_configuration()
            ep_out = None
            ep_in = None
            for intf in cfg:
                for ep in intf:
                    if usb.util.endpoint_type(ep.bmAttributes) == usb.util.ENDPOINT_TYPE_INTR:
                        if usb.util.endpoint_direction(ep.bEndpointAddress) == usb.util.ENDPOINT_OUT and not ep_out:
                            ep_out = ep
                        elif usb.util.endpoint_direction(ep.bEndpointAddress) == usb.util.ENDPOINT_IN and not ep_in:
                            ep_in = ep

            if ep_out:
                print(f"  Connected via PyUSB (OUT: 0x{ep_out.bEndpointAddress:02x})")
                return PyUsbDevice(dev, ep_out, ep_in)
    except (ImportError, Exception):
        pass

    # Failure guidance
    print(f"\nError: Device {VENDOR_ID:04x}:{PRODUCT_ID:04x} not found or accessible.", file=sys.stderr)
    if sys.platform == "win32":
        print("  Windows setup: Run 'pip install hidapi' (no extra drivers needed).", file=sys.stderr)
    elif sys.platform == "darwin":
        print("  macOS setup: Run 'pip install hidapi'.", file=sys.stderr)
    else:
        print("  Linux setup: Run 'pip install hidapi' and set udev rule:", file=sys.stderr)
        print("    echo 'SUBSYSTEM==\"hidraw\", ATTRS{idVendor}==\"1189\", ATTRS{idProduct}==\"8840\", MODE=\"0666\"' | sudo tee /etc/udev/rules.d/99-macropad.rules", file=sys.stderr)
        print("    sudo udevadm control --reload-rules && sudo udevadm trigger", file=sys.stderr)
    sys.exit(1)


# --- Configuration Parsing ---

def _resolve_led_color(val):
    if isinstance(val, int):
        return val & 0x0F
    val = str(val).lower().strip()
    if val in LED_COLORS:
        return LED_COLORS[val]
    if val.isdigit():
        return int(val) & 0x0F
    raise ValueError(f"Unknown LED color {val!r}. Known: {', '.join(LED_COLORS.keys())}")


def _resolve_led_effect(val):
    if isinstance(val, int):
        return val & 0x0F
    val = str(val).lower().strip()
    if val in LED_EFFECTS:
        return LED_EFFECTS[val]
    if val.isdigit():
        return int(val) & 0x0F
    raise ValueError(f"Unknown LED effect {val!r}. Known: {', '.join(LED_EFFECTS.keys())}")


def make_led_byte(effect, color):
    return ((color & 0x0F) << 4) | (effect & 0x0F)


def parse_led_config(layer_dict):
    led = layer_dict.get("led")
    if led is None:
        return None
    if isinstance(led, str):
        return (1, _resolve_led_color(led))
    if isinstance(led, dict):
        color = _resolve_led_color(led.get("color", "red"))
        effect = _resolve_led_effect(led.get("effect", "static"))
        return (effect, color)
    raise ValueError(f"Invalid led config: {led!r}")


def _keycode(k):
    """Resolve key name or integer to HID usage code."""
    if isinstance(k, int):
        return k
    k = k.lower().strip()
    if k in KEY:
        return KEY[k]
    raise KeyError(f"Unknown key {k!r}. Run --list-keys to see available keys.")


def _modifier(m):
    """Resolve modifier name or integer to modifier bitmask."""
    if isinstance(m, int):
        return m
    if isinstance(m, str):
        val = 0
        for part in m.lower().split("+"):
            part = part.strip()
            if part in MODIFIER:
                val |= MODIFIER[part]
            elif part:
                raise ValueError(f"Unknown modifier {part!r}")
        return val
    return 0


def _parse_single_key(value):
    """Parse one keystroke definition: 'a', 'ctrl+c', or {'key': 'c', 'mod': 'ctrl'}."""
    if isinstance(value, dict):
        return (value.get("key", "none"), _modifier(value.get("mod", 0)))

    if not isinstance(value, str):
        raise ValueError(f"Invalid keystroke: {value!r}")

    # Handle special case: literal '+' or 'ctrl++'
    if value.endswith("++"):
        prefix = value[:-2]
        return ("equal", _modifier(prefix) | 0x02)  # Shift + '=' is '+'
    if value == "+":
        return ("equal", 0x02)

    if "+" in value:
        parts = value.lower().split("+")
        mod_val = 0
        for p in parts[:-1]:
            p = p.strip()
            if p not in MODIFIER:
                raise ValueError(f"Unknown modifier {p!r}. Known: {', '.join(MODIFIER.keys())}")
            mod_val |= MODIFIER[p]
        last = parts[-1].strip()
        if last in MODIFIER:
            mod_val |= MODIFIER[last]
            return ("none", mod_val)
        return (last, mod_val)

    val_lower = value.lower().strip()
    if val_lower in MODIFIER:
        return ("none", MODIFIER[val_lower])

    return (val_lower, 0)


def _string_to_macro(text: str):
    """Convert a plain text string into a list of (key, mod) tuples."""
    keystrokes = []
    for ch in text:
        if ch in SHIFTED_SYMBOLS:
            keystrokes.append(SHIFTED_SYMBOLS[ch])
        elif ch.isupper():
            keystrokes.append((ch.lower(), 0x02))
        elif ch == " ":
            keystrokes.append(("space", 0))
        elif ch in KEY:
            keystrokes.append((ch, 0))
        else:
            keystrokes.append((ch, 0))
    return keystrokes


def parse_binding(value):
    """
    Parse a button binding from JSON.
    Returns: (mode, payload)
      Mode 1 (Keyboard): (MODE_KEYBOARD, [(key, mod), ...])
      Mode 2 (Media):    (MODE_MEDIA, consumer_keycode)
      Mode 3 (Mouse):    (MODE_MOUSE, (button_mask, wheel_delta))
      Mode 0 (Unbound):  (MODE_KEYBOARD, [('none', 0)])
    """
    if value is None or value == "" or value == "none" or value == "disabled":
        return (MODE_KEYBOARD, [("none", 0)])

    # Check for Media Key string
    if isinstance(value, str):
        val_lower = value.lower().strip()
        if val_lower in MEDIA_KEYS:
            return (MODE_MEDIA, MEDIA_KEYS[val_lower])
        if val_lower in MOUSE_ACTIONS:
            return (MODE_MOUSE, MOUSE_ACTIONS[val_lower])

    # Check for dict binding
    if isinstance(value, dict):
        if "media" in value:
            m = value["media"].lower().strip()
            return (MODE_MEDIA, MEDIA_KEYS[m])
        if "mouse" in value:
            m = value["mouse"].lower().strip()
            return (MODE_MOUSE, MOUSE_ACTIONS[m])
        if "text" in value:
            return (MODE_KEYBOARD, _string_to_macro(value["text"]))
        # Single key/mod dict
        return (MODE_KEYBOARD, [_parse_single_key(value)])

    # List of items (macro)
    if isinstance(value, list):
        keys = []
        for item in value:
            if isinstance(item, str) and len(item) > 1 and "+" not in item and item.lower() not in KEY and item.lower() not in MODIFIER:
                # String phrase inside list
                keys.extend(_string_to_macro(item))
            else:
                keys.append(_parse_single_key(item))
        return (MODE_KEYBOARD, keys)

    # String: either single key combo ('ctrl+c') or text string if length > 1 and not recognized key
    if isinstance(value, str):
        val_lower = value.lower().strip()
        if "+" in value or val_lower in KEY or val_lower in MODIFIER:
            return (MODE_KEYBOARD, [_parse_single_key(value)])
        # Plain text phrase (e.g. "hello world")
        return (MODE_KEYBOARD, _string_to_macro(value))

    raise ValueError(f"Invalid binding value: {value!r}")


def load_config(path):
    """
    Load and validate a JSON config file.
    Returns: (bindings, leds, delays)
    """
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, dict):
        raise ValueError("Root JSON object must be a dictionary")

    layers_data = raw.get("layers", {})
    bindings = {}
    leds = {}
    delays = {}

    for layer_str, layer_dict in layers_data.items():
        try:
            layer_num = int(layer_str)
        except ValueError:
            print(f"  Warning: skipping invalid layer key '{layer_str}'", file=sys.stderr)
            continue

        if layer_num < 1 or layer_num > NUM_LAYERS:
            print(f"  Warning: ignoring layer {layer_num} (supported: 1-{NUM_LAYERS})", file=sys.stderr)
            continue

        if not isinstance(layer_dict, dict):
            continue

        # LED config
        led_cfg = parse_led_config(layer_dict)
        if led_cfg is not None:
            leds[layer_num] = led_cfg

        # Macro delay
        delay = layer_dict.get("delay")
        if delay is not None:
            delays[layer_num] = max(0, min(0xFFFF, int(delay)))

        # Buttons
        layer_bindings = []
        for btn_name, val in layer_dict.items():
            btn_lower = btn_name.lower().strip()
            if btn_lower in ("led", "delay", "description", "_comment"):
                continue
            if btn_lower not in BUTTON_NAMES:
                print(f"  Warning: unknown button name '{btn_name}' on Layer {layer_num} (ignored)", file=sys.stderr)
                continue

            btn_id = BUTTON_NAMES[btn_lower]
            parsed = parse_binding(val)
            layer_bindings.append((btn_id, parsed))

        bindings[layer_num] = layer_bindings

    return bindings, leds, delays


# --- Packet Serialization & USB Protocols ---

DUMP_SENT_PACKETS = None

def make_report(*first_bytes) -> bytes:
    """Pad bytes up to 65-byte USB report size."""
    data = list(first_bytes) + [0] * (REPORT_SIZE - len(first_bytes))
    return bytes(data[:REPORT_SIZE])


def send_report(dev: MacroPadDevice, data: bytes):
    """Write one 65-byte report to the device."""
    assert len(data) == REPORT_SIZE
    if DUMP_SENT_PACKETS:
        with open(DUMP_SENT_PACKETS, "a", encoding="utf-8") as f:
            f.write(data.hex() + "\n")
    dev.write(data)


def commit_write(dev: MacroPadDevice):
    """Send commit packet: 03 fd fe ff."""
    send_report(dev, make_report(0x03, 0xFD, 0xFE, 0xFF))
    time.sleep(0.025)  # Fast hardware flash write delay (25ms verified)


def write_button(dev: MacroPadDevice, button_id: int, layer: int, parsed_binding):
    """
    Write one button binding:
      Mode 1: Keyboard (single key or macro)
      Mode 2: Media Key (Consumer report)
      Mode 3: Mouse (Clicks & Wheel)
    """
    mode, payload_data = parsed_binding

    payload = [
        0x03, 0xFD,
        button_id & 0xFF,
        layer & 0xFF,
        mode & 0xFF,                      # Byte 4: Mode selector
        0x00, 0x00, 0x00, 0x00,          # Bytes 5-8
        0x00,                            # Byte 9: Padding
    ]

    if mode == MODE_KEYBOARD:
        keys = payload_data
        if not keys:
            keys = [("none", 0)]

        resolved = [(_modifier(m), _keycode(k)) for k, m in keys]
        if len(resolved) > MAX_MACRO_KEYS:
            btn_name = _BUTTON_ID_TO_NAME.get(button_id, f"0x{button_id:02x}")
            raise ValueError(f"Button '{btn_name}' macro length ({len(resolved)}) exceeds max limit of {MAX_MACRO_KEYS} keys.")

        payload.append(len(resolved) & 0xFF)  # Byte 10: Key count
        for mod_byte, kc in resolved:
            payload.append(mod_byte & 0xFF)
            payload.append(kc & 0xFF)

    elif mode == MODE_MEDIA:
        consumer_code = payload_data
        payload.append(0x01)                  # Byte 10: count = 1
        payload.append(consumer_code & 0xFF)  # Byte 11: consumer keycode
        payload.append(0x00)                  # Byte 12: 0

    elif mode == MODE_MOUSE:
        button_mask, wheel_delta = payload_data
        payload.append(0x04)                  # Byte 10: Mouse type marker
        payload.append(button_mask & 0xFF)    # Byte 11: Button mask (1=L, 2=R, 4=M)
        payload.extend([0x00, 0x00, 0x00])    # Bytes 12-14: Reserved
        payload.append(wheel_delta & 0xFF)    # Byte 15: Wheel delta (+1 or 255/-1)

    send_report(dev, make_report(*payload))
    commit_write(dev)


def write_layer_config(dev: MacroPadDevice, layer: int, config_byte: int, config_data=None):
    """Send 03 fe b0 <layer> <config_byte> + 60 bytes, then commit."""
    if config_data is None:
        config_data = bytes(60)
    else:
        config_data = bytes(config_data[:60])
        config_data += bytes(60 - len(config_data))

    payload = [0x03, 0xFE, 0xB0, layer & 0xFF, config_byte & 0xFF] + list(config_data)
    send_report(dev, make_report(*payload))
    commit_write(dev)


def write_macro_delay(dev: MacroPadDevice, layer: int, delay_ms: int):
    """Set the macro keystroke delay for a layer (in ms, 0 to disable)."""
    delay_ms = max(0, min(0xFFFF, int(delay_ms)))
    payload = [
        0x03, 0xFD, 0x00, layer & 0xFF,
        0x05, delay_ms & 0xFF, (delay_ms >> 8) & 0xFF,
    ]
    send_report(dev, make_report(*payload))
    commit_write(dev)


def write_all_layer_configs(dev: MacroPadDevice, layers, leds=None, led_only=False):
    """Send layer LED configs and base parameters for each layer."""
    if leds is None:
        leds = {}

    for layer in sorted(layers):
        config_data_08 = bytearray(60)
        config_data_08[5] = 0x01
        led_cfg = leds.get(layer)
        if led_cfg:
            effect, color = led_cfg
            config_data_08[7] = make_led_byte(effect, color)
            led_desc = f"{_LED_EFFECT_NAME.get(effect, str(effect))} {_LED_COLOR_NAME.get(color, str(color))}"
        else:
            config_data_08[7] = 0x11  # static red default
            led_desc = "static red (default)"

        write_layer_config(dev, layer, 0x08, config_data_08)

        if not led_only:
            config_data_05 = bytearray(60)
            config_data_05[0] = 0xD0
            config_data_05[5] = 0x01
            config_data_05[7] = 0x10
            write_layer_config(dev, layer, 0x05, config_data_05)

        print(f"    Layer {layer}: LED = {led_desc}")


def save_to_board(dev: MacroPadDevice):
    """Persist all changes permanently to onboard flash: 03 ef 03."""
    send_report(dev, make_report(0x03, 0xEF, 0x03))
    time.sleep(0.05)
    print("  Saved to flash memory (03 ef 03)")


# --- Reading & Decoding ---

def read_all_buttons(dev: MacroPadDevice, layer: int):
    """
    Read all button bindings for a given layer.
    Returns: dict {button_id: (mode, payload)}
    """
    # Drain any lingering packets in queue
    while dev.read(REPORT_SIZE, timeout_ms=20):
        pass

    # Query command
    query = make_report(0x03, 0xFA, 0x0F, 0x03, layer & 0xFF, 0x05)
    send_report(dev, query)

    results = {}
    for _ in range(BUTTONS_PER_LAYER):
        pkt = dev.read(REPORT_SIZE, timeout_ms=500)
        if not pkt or len(pkt) < 13:
            break
        if pkt[0] != 0x03 or pkt[1] != 0xFA or pkt[3] != layer:
            continue

        btn_id = pkt[2]
        mode = pkt[4]
        btype = pkt[10]

        if mode == MODE_KEYBOARD:
            keys = []
            for i in range(btype):
                off = 11 + i * 2
                if off + 1 < len(pkt):
                    keys.append((pkt[off], pkt[off + 1]))
            results[btn_id] = (MODE_KEYBOARD, keys)

        elif mode == MODE_MEDIA:
            consumer_code = pkt[11]
            results[btn_id] = (MODE_MEDIA, consumer_code)

        elif mode == MODE_MOUSE:
            button_mask = pkt[11]
            wheel_delta = pkt[15] if len(pkt) > 15 else 0
            results[btn_id] = (MODE_MOUSE, (button_mask, wheel_delta))

        else:
            results[btn_id] = (mode, list(pkt[10:16]))

    return results


def format_binding_desc(parsed):
    """Convert parsed binding to human-readable string."""
    mode, payload = parsed

    if mode == MODE_KEYBOARD:
        keys = payload
        if not keys or (len(keys) == 1 and keys[0] in ((0, 0), ("none", 0))):
            return "(unbound)"
        parts = []
        for item in keys:
            if isinstance(item[0], str):
                k, m = item
                mod = _modifier(m)
                name = str(k)
            else:
                mod, kc = item
                name = _KEY_NAME.get(kc, f"0x{kc:02x}" if kc else "")
            prefix = ""
            if mod & 0x01: prefix += "ctrl+"
            if mod & 0x02: prefix += "shift+"
            if mod & 0x04: prefix += "alt+"
            if mod & 0x08: prefix += "meta+"
            if mod & 0x10: prefix += "rctrl+"
            if mod & 0x20: prefix += "rshift+"
            if mod & 0x40: prefix += "altgr+"
            if mod & 0x80: prefix += "rmeta+"
            parts.append(f"{prefix}{name}" if (prefix or name) else "(none)")
        return ", ".join(parts)

    if mode == MODE_MEDIA:
        return _MEDIA_NAME.get(payload, f"media_0x{payload:02x}")

    if mode == MODE_MOUSE:
        btn_mask, wheel = payload
        actions = []
        if btn_mask & 0x01: actions.append("left_click")
        if btn_mask & 0x02: actions.append("right_click")
        if btn_mask & 0x04: actions.append("middle_click")
        if wheel == 1: actions.append("wheel_up")
        elif wheel == 255: actions.append("wheel_down")
        return "+".join(actions) if actions else "(mouse_none)"

    return str(payload)


def print_device_config(dev: MacroPadDevice):
    """Read and display current device configuration to stdout."""
    for layer in range(1, NUM_LAYERS + 1):
        print(f"\n  Layer {layer}:")
        buttons = read_all_buttons(dev, layer)
        if not buttons:
            print("    (no response)")
            continue

        count = 0
        for btn_id in sorted(buttons.keys()):
            desc = format_binding_desc(buttons[btn_id])
            if desc == "(unbound)":
                continue
            btn_name = _BUTTON_ID_TO_NAME.get(btn_id, f"button 0x{btn_id:02x}")
            print(f"    {btn_name:12}: {desc}")
            count += 1
        if count == 0:
            print("    (all buttons unbound)")


def export_config_to_json(dev: MacroPadDevice, output_path: str):
    """Export current hardware flash memory to a clean macropad.json file."""
    config_dict = {
        "_comment": "Exported from physical device",
        "layers": {}
    }

    for layer in range(1, NUM_LAYERS + 1):
        buttons = read_all_buttons(dev, layer)
        layer_map = {}
        for btn_id, (mode, payload) in buttons.items():
            btn_name = _BUTTON_ID_TO_NAME.get(btn_id)
            if not btn_name:
                continue
            if mode == MODE_KEYBOARD:
                if not payload or payload == [(0, 0)]:
                    continue
                if len(payload) == 1:
                    m, k = payload[0]
                    mod_str = ""
                    if m & 0x01: mod_str += "ctrl+"
                    if m & 0x02: mod_str += "shift+"
                    if m & 0x04: mod_str += "alt+"
                    if m & 0x08: mod_str += "meta+"
                    layer_map[btn_name] = f"{mod_str}{_KEY_NAME.get(k, str(k))}"
                else:
                    seq = []
                    for m, k in payload:
                        mod_str = ""
                        if m & 0x01: mod_str += "ctrl+"
                        if m & 0x02: mod_str += "shift+"
                        if m & 0x04: mod_str += "alt+"
                        if m & 0x08: mod_str += "meta+"
                        seq.append(f"{mod_str}{_KEY_NAME.get(k, str(k))}")
                    layer_map[btn_name] = seq
            elif mode == MODE_MEDIA:
                layer_map[btn_name] = _MEDIA_NAME.get(payload, f"media_{payload}")
            elif mode == MODE_MOUSE:
                btn_mask, wheel = payload
                if wheel == 1: layer_map[btn_name] = "wheel_up"
                elif wheel == 255: layer_map[btn_name] = "wheel_down"
                elif btn_mask == 1: layer_map[btn_name] = "lclick"
                elif btn_mask == 2: layer_map[btn_name] = "rclick"
                elif btn_mask == 4: layer_map[btn_name] = "mclick"

        config_dict["layers"][str(layer)] = layer_map

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(config_dict, f, indent=2)
    print(f"  Configuration successfully exported to {output_path}")


# --- Programming & Verification ---

def program_from_config(dev: MacroPadDevice, config, leds=None, delays=None):
    """Write all configured buttons, delays, and layer settings to the pad."""
    if delays is None:
        delays = {}

    total_written = 0
    for layer_num in sorted(config.keys()):
        bindings = config[layer_num]
        print(f"  Programming Layer {layer_num} ({len(bindings)} controls)...")
        for btn_id, parsed in bindings:
            write_button(dev, btn_id, layer_num, parsed)
            total_written += 1
            btn_name = _BUTTON_ID_TO_NAME.get(btn_id, f"0x{btn_id:02x}")
            print(f"    {btn_name} -> {format_binding_desc(parsed)}")

        if layer_num in delays:
            delay_ms = delays[layer_num]
            write_macro_delay(dev, layer_num, delay_ms)
            print(f"    Macro delay: {delay_ms}ms")

    print(f"  Wrote {total_written} control bindings.")
    print("  Applying layer & LED configurations...")
    write_all_layer_configs(dev, sorted(config.keys()), leds=leds)


def verify_config(dev: MacroPadDevice, config):
    """Read back and verify all programmed layers."""
    print("\n  Verifying hardware flash memory across layers...")
    all_ok = True

    for layer_num in sorted(config.keys()):
        readback = read_all_buttons(dev, layer_num)
        for btn_id, expected_parsed in config[layer_num]:
            if btn_id not in readback:
                continue
            actual_parsed = readback[btn_id]
            btn_name = _BUTTON_ID_TO_NAME.get(btn_id, f"0x{btn_id:02x}")
            exp_desc = format_binding_desc(expected_parsed)
            act_desc = format_binding_desc(actual_parsed)
            if exp_desc != act_desc:
                print(f"    WARNING: Layer {layer_num} {btn_name}: expected '{exp_desc}', got '{act_desc}'")
                all_ok = False

    if all_ok:
        print("  ✓ All layers verified successfully!")


# --- Default Config Template ---

DEFAULT_CONFIG = {
    "_comment": "12-key + 2-knob configuration file. Supports keys, combos, strings, media, and mouse actions.",
    "layers": {
        "1": {
            "led": {"color": "red", "effect": "static"},
            "delay": 40,
            "key1": "a", "key2": "b", "key3": "c",
            "key4": "d", "key5": "e", "key6": "f",
            "key7": "g", "key8": "h", "key9": "i",
            "key10": "j", "key11": "k", "key12": "l",
            "knob1_left": "pagedown", "knob1_press": "space", "knob1_right": "pageup",
            "knob2_left": "left", "knob2_press": "enter", "knob2_right": "right"
        },
        "2": {
            "led": {"color": "blue", "effect": "wave"},
            "key1": "f1", "key2": "f2", "key3": "f3",
            "key4": "f4", "key5": "f5", "key6": "f6",
            "key7": "f7", "key8": "f8", "key9": "f9",
            "key10": "f10", "key11": "f11", "key12": "f12",
            "knob1_left": "volume_down", "knob1_press": "mute", "knob1_right": "volume_up",
            "knob2_left": "wheel_down", "knob2_press": "mclick", "knob2_right": "wheel_up"
        },
        "3": {
            "led": {"color": "green", "effect": "static"},
            "key1": "play_pause", "key2": "next_track", "key3": "prev_track",
            "key4": "f16", "key5": "f17", "key6": "f18",
            "key7": "f19", "key8": "f20", "key9": "f21",
            "key10": "f22", "key11": "f23", "key12": "f24",
            "knob1_left": "volume_down", "knob1_press": "mute", "knob1_right": "volume_up",
            "knob2_left": "left", "knob2_press": "enter", "knob2_right": "right"
        }
    }
}


def generate_config(path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(DEFAULT_CONFIG, f, indent=2)
    print(f"  Created default config at '{path}'")


def list_available_keys():
    print("\n--- Available Keyboard Keys ---")
    keys_sorted = sorted(set(k for k in KEY.keys() if len(k) > 1 or k.isalnum()))
    # Print in neat columns
    for i in range(0, len(keys_sorted), 6):
        print("  " + "  ".join(f"{k:12}" for k in keys_sorted[i:i+6]))

    print("\n--- Modifiers ---")
    print("  ctrl, shift, alt, meta (win/cmd/gui), rctrl, rshift, ralt (altgr), rmeta")

    print("\n--- Media Controls ---")
    print("  " + ", ".join(sorted(set(MEDIA_KEYS.keys()))))

    print("\n--- Mouse Actions ---")
    print("  " + ", ".join(sorted(set(MOUSE_ACTIONS.keys()))))

    print("\n--- LED Colors & Effects ---")
    print("  Colors : " + ", ".join(LED_COLORS.keys()))
    print("  Effects: " + ", ".join(LED_EFFECTS.keys()))
    print()


# --- CLI Main ---

def main():
    global DUMP_SENT_PACKETS

    parser = argparse.ArgumentParser(
        description="Program 12-key + 2-knob USB Macro Pad (VID:PID 1189:8840)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python program_macropad.py                      # Program device from macropad.json
  python program_macropad.py --read               # Inspect current device settings
  python program_macropad.py --export backup.json # Dump device memory to backup.json
  python program_macropad.py --led blue wave      # Set all layer LEDs
  python program_macropad.py --gui                # Launch visual editor
        """
    )
    parser.add_argument("-c", "--config", default="macropad.json", help="Path to config JSON (default: macropad.json)")
    parser.add_argument("--generate-config", action="store_true", help="Generate default macropad.json template")
    parser.add_argument("--read", action="store_true", help="Read & display current bindings from device")
    parser.add_argument("--export", metavar="FILE", help="Dump current hardware flash memory into a JSON file")
    parser.add_argument("--led", nargs="+", metavar=("COLOR", "EFFECT"), help="Set LED color [and effect] for all layers")
    parser.add_argument("--validate", action="store_true", help="Validate config syntax without touching hardware")
    parser.add_argument("--dry-run", action="store_true", help="Parse config and show actions without writing")
    parser.add_argument("--list-keys", action="store_true", help="List all supported key names and media actions")
    parser.add_argument("--gui", action="store_true", help="Launch cutting-edge visual web editor")
    parser.add_argument("--dump", metavar="FILE", nargs="?", const="macropad_sent_packets.hex", help="Log sent USB packets to hex file")

    args = parser.parse_args()

    if args.dump:
        DUMP_SENT_PACKETS = args.dump
        open(DUMP_SENT_PACKETS, "w", encoding="utf-8").close()
        print(f"  Dumping USB packets to {DUMP_SENT_PACKETS}")

    if args.list_keys:
        list_available_keys()
        return

    if args.generate_config:
        generate_config(args.config)
        return

    if args.gui:
        import web_ui
        web_ui.start_server(config_path=args.config)
        return

    if args.validate:
        print(f"  Validating config '{args.config}'...")
        config, leds, delays = load_config(args.config)
        total = sum(len(b) for b in config.values())
        print(f"  ✓ Syntax valid! Found {len(config)} layer(s) with {total} total control bindings.")
        return

    if args.dry_run:
        print(f"  [Dry Run] Parsing '{args.config}'...")
        config, leds, delays = load_config(args.config)
        for layer, bindings in config.items():
            print(f"  Layer {layer} ({len(bindings)} bindings):")
            for b_id, parsed in bindings:
                b_name = _BUTTON_ID_TO_NAME.get(b_id, f"0x{b_id:02x}")
                print(f"    {b_name} -> {format_binding_desc(parsed)}")
        return

    # Actions that require physical device connection
    dev = open_device()
    try:
        if args.read:
            print_device_config(dev)
            return

        if args.export:
            export_config_to_json(dev, args.export)
            return

        if args.led:
            color = _resolve_led_color(args.led[0])
            effect = _resolve_led_effect(args.led[1]) if len(args.led) > 1 else 1
            leds = {layer: (effect, color) for layer in range(1, NUM_LAYERS + 1)}
            print("  Updating LEDs across all layers...")
            write_all_layer_configs(dev, list(range(1, NUM_LAYERS + 1)), leds=leds, led_only=True)
            save_to_board(dev)
            print("  Done.")
            return

        # Default action: Program from config
        if not os.path.exists(args.config):
            print(f"  Config '{args.config}' not found. Generating default...")
            generate_config(args.config)
            print(f"  Edit '{args.config}' and run again.")
            return

        print(f"  Loading config from '{args.config}'...")
        config, leds, delays = load_config(args.config)
        if not config:
            print("  No valid layer bindings found.", file=sys.stderr)
            sys.exit(1)

        program_from_config(dev, config, leds=leds, delays=delays)
        save_to_board(dev)
        verify_config(dev, config)
        print("\n  All done! Hardware successfully programmed.")

    finally:
        dev.close()


if __name__ == "__main__":
    main()
