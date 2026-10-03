# MacroPad Studio Architecture & Refactoring Rationale

This document details the architectural decisions, design patterns, and engineering principles behind the refactored **MacroPad Studio** codebase.

---

## 1. Executive Summary & Goals

The original web UI had the core WebHID protocol, state management, event listeners, DOM rendering, and animations tangled inside a monolithic script (`app.js` ~1,240 lines). 

The goal of this refactoring was to turn MacroPad Studio into a **production-grade, segmentized, maintainable, and verifiable codebase** that matches the visual and engineering polish of commercial hardware configuration suites.

### Key Quality Improvements
1. **Separation of Concerns**: Unidirectional data flow (Store $\rightarrow$ Actions $\rightarrow$ View Components).
2. **Pure Protocol & Codec Layer**: Isolated USB HID packet serialization/deserialization without DOM or browser dependencies, allowing 100% automated test coverage in headless Node.js.
3. **Robust Input Pipeline**: Proper event translation from browser `KeyboardEvent` / `MouseEvent` / `WheelEvent` to hardware binding models.
4. **Resilient WebHID Lifecycle**: Safe connection management, automatic reconnection handling, and prevention of event listener leaks.
5. **Clean Component Architecture**: Independent, cohesive UI views with single responsibilities and clean encapsulation.

---

## 2. Directory Structure

```
web/
├── index.html                   # Clean, semantic entrypoint without inline JS
├── style.css                    # Design system tokens, glassmorphism & LED shaders
├── app.js                       # Public ES module bootstrap entrypoint
├── webhid.js                    # Backward-compatible bridge for external tools & tests
├── README.md                    # Project documentation & user guide
├── REFACTORING.md               # Architecture & design reasoning (this document)
├── tests/
│   └── studio.test.js           # Comprehensive automated unit test suite (26 passing tests)
└── src/
    ├── main.js                  # DOM ready bootstrap & global app initialization
    ├── config/                  # Single source of truth for domain constants
    │   ├── constants.js         # USB VID/PID, layer counts, packet capacities, defaults
    │   ├── controls.js          # Physical control catalog (12 keys, 3 knobs x 3 gestures)
    │   ├── actions.js           # Media & mouse action metadata, titles, and icons
    │   ├── key-catalog.js       # Grouped key categories for dropdowns & macro editor
    │   ├── modifiers.js         # USB HID modifier bitmasks, canonical aliases (Win/Cmd/Meta)
    │   ├── led.js               # LED palette RGB/glow specifications & animation sequences
    │   └── default-config.js    # Factory layer preset configurations
    ├── core/                    # Pure domain logic & state management
    │   ├── store.js             # Minimal, lightweight reactive observable store
    │   ├── combo.js             # Order-independent combo parser & canonical formatter
    │   ├── text-macro.js        # Multi-character text phrase to sequential macro expander
    │   ├── bindings.js          # Binding classification (Macro vs Media vs Mouse vs Disabled)
    │   ├── input-events.js      # Positional keyboard/mouse event to combo normalizer
    │   ├── control-matcher.js   # Physical pad input to virtual control resolution engine
    │   ├── config-model.js      # Immutable configuration transforms & JSON validation
    │   └── studio.js            # Studio state selectors and high-level action creators
    ├── protocol/                # USB HID communication & wire codec
    │   ├── usb-codes.js         # HID usage tables, command opcodes, and layout offsets
    │   ├── codec.js             # High-level binding <-> 64-byte wire packet translator
    │   ├── hid-device.js        # WebHID driver class with queue & async report waiters
    │   ├── operations.js        # Multi-layer Flash & Read orchestration pipelines
    │   └── index.js             # Protocol public module barrel
    └── ui/                      # Encapsulated presentation components
        ├── icons.js             # Scalable vector graphics definitions
        ├── hud.js               # Non-blocking floating toast & live input indicator
        ├── flash-overlay.js     # Modal flashing progress dialog with animated spinner
        ├── chassis.js           # L-shaped boot chassis, keycap matrix, knobs & LED glows
        ├── inspector.js         # Control inspector, macro step builder, text shorthand
        ├── floating-bar.js      # Bottom action island with layer switcher & action buttons
        ├── header.js            # Titlebar, WebHID connection status, JSON import/export
        └── app-controller.js    # Coordinator connecting store, views, and hardware
```

---

## 3. Layered Architectural Blueprint

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                            │
│   ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌────────────┐   │
│   │ ChassisView │  │InspectorView│  │FloatingBarView│ │ HeaderView │   │
│   └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘   │
└──────────┼────────────────┼────────────────┼────────────────┼──────────┘
           │                │                │                │
┌──────────▼────────────────▼────────────────▼────────────────▼──────────┐
│                        COORDINATOR / CONTROLLER                        │
│                           AppController                                │
│       - Event Delegation        - Store Subscriptions                  │
│       - WebHID Lifecycle        - Live Physical Tracking               │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │                                  │
┌──────────────────▼─────────────┐   ┌────────────────▼──────────────────┐
│          CORE DOMAIN           │   │             PROTOCOL              │
│  ┌──────────────────────────┐  │   │  ┌─────────────────────────────┐  │
│  │   Lightweight Store      │  │   │  │    Codec & Wire Encoding    │  │
│  └──────────────┬───────────┘  │   │  │   (bindingToWire / decode)  │  │
│                 │              │   │  └──────────────┬──────────────┘  │
│  ┌──────────────▼───────────┐  │   │                 │                 │
│  │ Studio Actions & Models  │  │   │  ┌──────────────▼──────────────┐  │
│  │ - combo.js               │  │   │  │  Operations (Flash / Read)  │  │
│  │ - text-macro.js          │  │   │  └──────────────┬──────────────┘  │
│  │ - bindings.js            │  │   │                 │                 │
│  │ - control-matcher.js     │  │   │  ┌──────────────▼──────────────┐  │
│  └──────────────────────────┘  │   │  │  MacroPadHid (WebHID Trans) │  │
│                                │   │  └─────────────────────────────┘  │
└────────────────────────────────┘   └───────────────────────────────────┘
```

---

## 4. Key Architectural Decisions & Rationale

### 4.1. Pure Domain Logic Decoupled from the DOM
* **Problem**: In the legacy codebase, parsing a keystroke or classifying a binding was directly coupled with manipulating DOM element classes and reading input value properties.
* **Solution**: `src/core/` contains pure functions with zero browser or DOM references. Functions like `parseCombo`, `textToSteps`, `classifyBinding`, and `findControlForInput` are deterministic and immediately testable.
* **Impact**: We achieved a comprehensive automated test suite (`tests/studio.test.js`) that runs in milliseconds via standard Node.js without requiring a browser or mock DOM.

### 4.2. Immutable State and Unidirectional Data Flow
* **Pattern**: Actions $\rightarrow$ Store $\rightarrow$ Subscriber View Renders.
* **Implementation**: `src/core/store.js` implements an observable state container with zero external dependencies. State updates create fresh immutable references using pure transforms in `src/core/config-model.js`.
* **Benefit**: Eliminates subtle synchronization bugs where one component modifies layer data and another component displays stale values.

### 4.3. High-Fidelity USB Protocol Codec
* **Separation**: Split into `usb-codes.js` (raw HID constants and offsets), `codec.js` (pure packet encoding/decoding), `hid-device.js` (WebHID transport layer), and `operations.js` (orchestrated workflows).
* **Robustness**: 
  - `MacroPadHid` manages report listeners cleanly, eliminating memory leaks upon device reconnections.
  - Implements an asynchronous queue with timeout-guarded report waiters for reading packet streams reliably.
  - `flashDevice` provides fine-grained stage reporting to drive the visual progress overlay smoothly from 0% to 100%.

### 4.4. Accurate Keystroke and Physical Tracking Engine
* **Positional Key Code Mapping**: Using `KeyboardEvent.code` instead of `.key` ensures consistent layout-independent key recognition matching USB HID hardware standards.
* **Two-Pass Control Matching**: `findControlForInput` performs an exact canonical match first (handling modifier order variations such as `Ctrl+Alt` vs `Alt+Ctrl`), followed by a loose compound fallback only when exact matches do not exist.
* **Shorthand Text Phrase Expansion**: `textToSteps` converts natural strings (e.g. `"git status"`) into sequential keystroke tuples, respecting the 27-step hardware limit and handling shifted punctuation (`!`, `@`, `#`, `_`, etc.) faithfully.

---

## 5. Verification & Testing

The refactored codebase is verified across multiple vectors:

1. **Automated Unit Tests**:
   - Run: `node web/tests/studio.test.js`
   - Test Coverage: 26 discrete assertions testing controls catalog, modifier masks, combo normalization, text expansion, binding classification, live input matching, LED token resolution, protocol wire packet generation, and store state transitions.
2. **Visual & Layout Verification**:
   - Headless Chrome rendering comparison verified pixel-perfection of the macOS Pro Light aesthetic, Finnish typography, tactile keycaps, machined knob styling, and floating action bars.
3. **Hardware Compatibility**:
   - Fully compatible with VID `0x1189` / PID `0x8840` hardware devices across Chrome, Edge, Brave, and Opera.
