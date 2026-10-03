# MacroPad Studio (Web Application)

A cutting-edge, driverless browser configuration studio for the **12-key + 2-knob / 3-knob USB macro pad** (`VID:1189 PID:8840`, WCH CH552G/CH57x).

Powered by the **WebHID API** (`navigator.hid`), allowing 100% driverless, client-side configuration directly inside Google Chrome, Microsoft Edge, Opera, or Brave. **Zero installation or Python required.**

---

## ✨ Features

* **macOS Pro Light Studio Workspace**: Elegant light aesthetics designed with frosted glassmorphism, Finlandica typography, and tactile keycaps.
* **Live Animation Preview on Keyboard**:
  * Real-time LED lighting effects rendered directly on the physical keyboard graphic under each keycap.
  * **Modes Supported**: LEDs Off (0), Static Color (1), Column Sweep (2), Upward Cascade (3), Reactive White Flash (4).
  * **8 Color Swatches**: Off, Red, Orange, Yellow, Green, Cyan, Blue, Purple.
* **Physical Keypress Tracking & Auto-Selection**:
  * Intercepts physical key strokes and encoder rotations in real time while the browser window is focused.
  * **Auto-Select on Press**: Hitting any key or rotating a knob on your physical desk pad instantly selects and opens its configuration panel in the inspector.
  * **Live Event HUD**: Real-time detection badge displaying the intercepted key combo (e.g. `[CTRL+ALT+O] ➔ Key 1`) and knob rotation (`Scroll Up ➔ Knob 1 Turn Left`).
  * **Tactile Press Animation**: Visual keycaps depress and illuminate upon physical impact.
* **Direct WebHID USB Connection**: Click "Connect" in your browser, pick your pad, and configure it directly.
* **3 Hardware Layers**: Full independent control of key mappings, knob actions, LED color/effects, and macro delays.
* **4 Action Types**:
  * **Macro / Keyboard**: Keystroke sequence builder with interactive modifier pills (`Ctrl`, `Shift`, `Alt`, `Win`), quick text phrase shorthand, and delay control.
  * **Media**: Play/Pause, Next Track, Prev Track, Volume Up, Volume Down, Mute.
  * **Mouse**: Left Click, Right Click, Middle Click, Scroll Wheel Up/Down.
  * **Disabled**: Clears the onboard flash memory slot (`0x00, 0x00`).
* **1-Click Flash**: Flashes all 3 layers and permanently saves to device flash (`03 ef 03`).
* **Hardware Read**: Reads existing device memory directly into the web UI with a futuristic scan-beam effect.
* **JSON Import / Export**: Save, backup, and share custom layouts as `.json` files.

---

## 🏗 Codebase Architecture

The web application is structured with clean separation of concerns and pure domain models:

* **`src/config/`**: Domain constants, control definitions, action options, key catalog, and LED palette specs.
* **`src/core/`**: State management store, combo parsing, text phrase expansion, and control matching engine.
* **`src/protocol/`**: USB HID report framing, bidirectional wire codecs, WebHID transport, and multi-layer read/flash workflows.
* **`src/ui/`**: View components (Chassis, Inspector, Floating Bar, Header, HUD, and Flash Overlay) managed by `AppController`.
* **`tests/`**: Automated test suite verifying business logic and codecs offline in Node.js.

For detailed design rationale, see [REFACTORING.md](REFACTORING.md).

---

## 🧪 Automated Testing

Run the automated test suite in Node.js:

```bash
node web/tests/studio.test.js
```

---

## 🚀 How to Run Locally

You can run the web app in any static web server:

### Option 1: Via Python
```bash
# From the macropad root folder:
python -m http.server 8000 --directory web
```
Then open `http://localhost:8000` in Chrome, Edge, or Brave.

### Option 2: Via Desktop Studio
```bash
python program_macropad.py --gui
```

---

## 🌐 Deploying to GitHub Pages (Free, 1-Click)

1. In your GitHub repository settings, go to **Pages**.
2. Under **Build and deployment > Source**, select **Deploy from a branch**.
3. Choose branch `main` and folder `/web` (or `/docs`).
4. Click **Save**.
5. Your studio is now live on `https://<your-username>.github.io/<repo>/`!
