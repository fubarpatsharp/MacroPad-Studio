# macropad

Program the cheap **[12-key + 2-knob USB macro pad](https://www.amazon.com/dp/B0DCP4CVNL?th=1)** (VID:PID `1189:8840`, WCH CH552G/CH57x) from **Windows, macOS, or Linux** with Python.

Supports single keys, modifier combos (`ctrl+c`), plain text strings (`"hello world"`), multi-key macros (`["ctrl+a", "backspace"]`), media controls (`play_pause`, `volume_up`), mouse actions (`lclick`, `wheel_up`), per-layer LED colors/effects, and 3 independent hardware layers.

Includes a **cutting-edge visual web editor** (`--gui`) inspired by native macOS/Linear designs.

---

## Setup

```bash
pip install -r requirements.txt
```

* **Windows:** Zero driver setup needed! Uses native `hidapi` without Zadig or admin privileges.
* **macOS:** Works driverless out of the box via `hidapi`.
* **Linux:** Uses `hidraw`. Add a one-time udev rule for non-root access:
  ```bash
  echo 'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="1189", ATTRS{idProduct}=="8840", MODE="0666"' \
    | sudo tee /etc/udev/rules.d/99-macropad.rules
  sudo udevadm control --reload-rules && sudo udevadm trigger
  ```

*(Note: PyUSB is also supported as an automatic fallback).*

---

## Visual Studio UI

Launch the cutting-edge visual editor in your browser or desktop app mode:

```bash
python program_macropad.py --gui
```

Features:
* Interactive visual layout of the 12 keycaps and 2 rotary encoders.
* Live read from hardware memory and instant 1-click flashing to flash.
* Action Type switch: Macro, Media, Mouse, or Disabled.
* Macro sequence builder with modifier badges and quick text phrase input.
* Interactive LED palette and effect picker.

---

## CLI Usage

```bash
python program_macropad.py                      # Program pad from macropad.json
python program_macropad.py -c myconfig.json     # Use a custom config
python program_macropad.py --read               # Read & display current device bindings
python program_macropad.py --export backup.json # Dump hardware memory to a clean JSON file
python program_macropad.py --gui                # Launch the visual web UI
python program_macropad.py --led blue wave      # Quick LED change (all layers)
python program_macropad.py --validate           # Validate JSON syntax offline
python program_macropad.py --dry-run            # Inspect planned actions without writing
python program_macropad.py --list-keys          # List all supported key names & actions
```

---

## Config File (`macropad.json`)

Each layer maps control names to key combos, text strings, media actions, or mouse events:

```json
{
  "layers": {
    "1": {
      "led": {"color": "blue", "effect": "static"},
      "delay": 40,
      "key1": "a",
      "key2": "ctrl+c",
      "key3": "git status",
      "key4": ["ctrl+a", "backspace"],
      "knob1_left": "wheel_down",
      "knob1_right": "wheel_up",
      "knob1_press": "mclick",
      "knob2_left": "volume_down",
      "knob2_right": "volume_up",
      "knob2_press": "mute"
    }
  }
}
```

### Controls

| Control Name | Hardware Target |
|:---|:---|
| `key1` &ndash; `key12` | The 12 main keys (3 rows &times; 4 columns) |
| `knob1_left`, `knob1_press`, `knob1_right` | First rotary encoder (Top) |
| `knob2_left`, `knob2_press`, `knob2_right` | Second rotary encoder (Bottom) |

### Action Types

| Format | Example | Description |
|:---|:---|:---|
| Single key | `"a"`, `"."`, `"enter"` | Types key |
| Modifier combo | `"ctrl+c"`, `"ctrl+alt+del"` | Keyboard combination |
| Plain text string | `"hello world"` | Automatically expands to typed keystrokes |
| Multi-key macro | `["ctrl+c", "ctrl+v"]` | Sequential keystrokes |
| Media action | `"play_pause"`, `"volume_up"` | USB HID Consumer Control |
| Mouse action | `"lclick"`, `"wheel_up"` | Mouse clicks and scroll wheel |
| Unbind / Disable | `"none"` or `"disabled"` | Clears the hardware flash slot |

**Modifiers:** `ctrl`, `shift`, `alt`, `meta` (`win`/`cmd`/`gui`), `rctrl`, `rshift`, `ralt` (`altgr`), `rmeta`.

**Media controls:** `play_pause`, `next_track`, `prev_track`, `volume_up`, `volume_down`, `mute`, `stop`.

**Mouse actions:** `lclick`, `rclick`, `mclick`, `wheel_up`, `wheel_down`.

**Numpad keys:** `kp_0`&ndash;`kp_9`, `kp_enter`, `kp_plus`, `kp_minus`, `kp_multiply`, `kp_divide`, `kp_decimal`, `numlock`.

---

## LEDs

Each layer independently configures its LED color and animation:

```json
"led": {"color": "cyan", "effect": "wave"}
```

* **Colors:** `off`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`
* **Effects:** `off`, `static`, `ripple`, `wave`, `reactive`, `white`

---

## Protocol Specification

Reverse-engineered from USB HID reports. All reports are 65 bytes (`0x03` Report ID + 64 bytes data).

* **Write Button (Mode 0x01 Keyboard):**
  `03 fd <btn> <layer> 01 00 00 00 00 00 <count> <mod1> <key1> ...` then `03 fd fe ff` (commit).
* **Write Button (Mode 0x02 Media):**
  `03 fd <btn> <layer> 02 00 00 00 00 00 01 <consumer_code> 00 ...` then commit.
* **Write Button (Mode 0x03 Mouse):**
  `03 fd <btn> <layer> 03 00 00 00 00 00 04 <btn_mask> 00 00 00 <wheel> ...` then commit.
* **Layer Config (LEDs):**
  `03 fe b0 <layer> 08 <60 bytes>` then commit. Byte 12 = `(color << 4) | effect`.
* **Macro Delay:**
  `03 fd 00 <layer> 05 <delay_lo> <delay_hi>` then commit. 16-bit LE milliseconds.
* **Save to Flash:**
  `03 ef 03`
* **Read Buttons:**
  `03 fa 0f 03 <layer> 05` on OUT, 24 report responses on IN.

---

## Credits & Attribution

* **Web Studio Refactoring & UI/UX Architecture**: [fubarpatsharp](https://github.com/fubarpatsharp) (Ruslan Parkhomenko)
* **Original Protocol Reverse Engineering & Python Core**: [mikhailvs/macropad](https://github.com/mikhailvs/macropad) (Mikhail Slyusarev)

