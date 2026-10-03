#!/usr/bin/env python3
"""
Web GUI for the 12-key + 2-knob USB Macro Pad (VID:PID 1189:8840).

Provides a modern, cutting-edge visual editor inspired by native design:
  - Visual 12-key + 2-knob interactive physical layout
  - Live device read & flash over USB via HIDAPI/PyUSB
  - Layer tabs (1, 2, 3) with independent key, knob, delay, and LED control
  - Action editors: Keyboard macros, Media controls, Mouse events, Disabled
  - Native desktop window launcher (Edge/Chrome app mode or default browser)
"""

import json
import os
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import program_macropad as pm

PORT = 8840
CONFIG_PATH = "macropad.json"

UI_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MacroPad Studio (1189:8840)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Finlandica+Text:ital,wght@0,400..700;1,400..700&family=Finlandica:ital,wght@0,400..700;1,400..700&display=swap');
    body { font-family: 'Finlandica Text', 'Finlandica', -apple-system, BlinkMacSystemFont, sans-serif; }
    .keycap-selected {
      box-shadow: 0 0 0 2px #10b981, 0 0 18px rgba(16, 185, 129, 0.45);
      border-color: #10b981 !important;
    }
    .knob-selected {
      box-shadow: 0 0 0 2px #10b981, 0 0 20px rgba(16, 185, 129, 0.45);
    }
    /* Custom scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  </style>
</head>
<body class="bg-slate-100 min-h-screen text-slate-800 antialiased p-4 md:p-8 flex items-center justify-center">

  <!-- Main Window Container -->
  <div class="w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col transition-all">

    <!-- Window Titlebar -->
    <header class="bg-slate-50/90 border-b border-slate-200 px-6 py-4 flex items-center justify-between select-none">
      <div class="flex items-center space-x-5">
        <!-- macOS Traffic Lights -->
        <div class="flex items-center space-x-2">
          <span class="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-sm"></span>
          <span class="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-sm"></span>
          <span class="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-sm"></span>
        </div>

        <!-- Device Selector Pill -->
        <div class="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-medium text-slate-700">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
          </svg>
          <span id="device-selector-text">USB Composite Device</span>
          <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </div>
      </div>

      <!-- Action Buttons (Read & Flash) -->
      <div class="flex items-center space-x-3">
        <!-- Read from Device -->
        <button id="btn-read" title="Read current hardware memory" class="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition active:scale-95">
          <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          <span>Read from Pad</span>
        </button>

        <!-- Save JSON File -->
        <button id="btn-save-json" title="Save config to macropad.json" class="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition active:scale-95">
          <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
          </svg>
          <span>Save File</span>
        </button>

        <!-- Flash to Device (Prominent Circular Upload Button) -->
        <button id="btn-flash" title="Flash and write permanently to pad" class="flex items-center space-x-2 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition active:scale-95">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
          </svg>
          <span>Flash to Pad</span>
        </button>
      </div>
    </header>

    <!-- App Body (2-Column Layout) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">

      <!-- Left Column: Visual Hardware & Layer Controls -->
      <section class="lg:col-span-5 bg-slate-50/60 p-6 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between space-y-6">
        <div>
          <!-- Device Header & Layer Selector -->
          <div class="flex items-center justify-between mb-5">
            <div>
              <div class="flex items-center space-x-2">
                <h2 class="font-bold text-slate-900 text-sm tracking-wide">MINI_KEYBOARD</h2>
                <span id="conn-indicator" class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <p class="text-xs text-slate-500">12 keys &bull; 2 knobs &bull; CH552G</p>
            </div>

            <!-- Segmented Layer Tabs -->
            <div class="flex items-center space-x-1 bg-slate-200/80 p-1 rounded-xl">
              <button onclick="setLayer(1)" id="layer-btn-1" class="px-3.5 py-1 text-xs font-bold rounded-lg transition bg-blue-600 text-white shadow-sm">1</button>
              <button onclick="setLayer(2)" id="layer-btn-2" class="px-3.5 py-1 text-xs font-bold rounded-lg transition text-slate-600 hover:text-slate-900">2</button>
              <button onclick="setLayer(3)" id="layer-btn-3" class="px-3.5 py-1 text-xs font-bold rounded-lg transition text-slate-600 hover:text-slate-900">3</button>
            </div>
          </div>

          <!-- Physical Device Enclosure Graphic -->
          <div class="relative bg-zinc-900 rounded-[28px] p-5 shadow-2xl border border-zinc-800 flex items-center justify-between">
            
            <!-- 12 Keys Grid (3 rows x 4 cols) -->
            <div class="grid grid-cols-4 gap-2.5 flex-1 pr-4">
              <!-- Keys 1-12 rendered dynamically -->
              <template id="key-template">
                <button class="keycap relative flex flex-col items-center justify-center h-14 rounded-xl bg-zinc-800 hover:bg-zinc-700/90 text-white border border-zinc-700/60 shadow-md transition active:scale-95 group">
                  <span class="key-id text-[10px] font-bold text-zinc-400 group-hover:text-zinc-200 absolute top-1 left-2">1</span>
                  <span class="key-binding text-xs font-semibold truncate px-1 max-w-[58px] text-zinc-100">A</span>
                </button>
              </template>
              <div id="keys-grid" class="contents"></div>
            </div>

            <!-- 2 Rotary Encoders (Knob 1 & Knob 2) -->
            <div class="flex flex-col justify-around space-y-4 pl-3 border-l border-zinc-800">
              
              <!-- Knob 1 -->
              <div class="flex flex-col items-center">
                <span class="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Knob 1</span>
                <div class="relative w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 shadow-lg flex items-center justify-center group cursor-pointer" onclick="selectControl('knob1_press')">
                  <!-- Indicator Notch -->
                  <div class="absolute top-1.5 w-1 h-3 bg-zinc-400 rounded-full"></div>
                  <!-- Center button -->
                  <div id="knob1-dial" class="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 font-bold hover:text-white transition">
                    Push
                  </div>
                </div>
                <!-- Knob 1 Left/Right actions -->
                <div class="flex items-center space-x-1.5 mt-1.5">
                  <button onclick="selectControl('knob1_left')" id="btn-knob1_left" class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700" title="Knob 1 Rotate Left">&#8630; Left</button>
                  <button onclick="selectControl('knob1_right')" id="btn-knob1_right" class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700" title="Knob 1 Rotate Right">Right &#8631;</button>
                </div>
              </div>

              <!-- Knob 2 -->
              <div class="flex flex-col items-center">
                <span class="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Knob 2</span>
                <div class="relative w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 shadow-lg flex items-center justify-center group cursor-pointer" onclick="selectControl('knob2_press')">
                  <!-- Indicator Notch -->
                  <div class="absolute top-1.5 w-1 h-3 bg-zinc-400 rounded-full"></div>
                  <!-- Center button -->
                  <div id="knob2-dial" class="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 font-bold hover:text-white transition">
                    Push
                  </div>
                </div>
                <!-- Knob 2 Left/Right actions -->
                <div class="flex items-center space-x-1.5 mt-1.5">
                  <button onclick="selectControl('knob2_left')" id="btn-knob2_left" class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700" title="Knob 2 Rotate Left">&#8630; Left</button>
                  <button onclick="selectControl('knob2_right')" id="btn-knob2_right" class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700" title="Knob 2 Rotate Right">Right &#8631;</button>
                </div>
              </div>

            </div>

          </div>

          <p class="text-xs text-slate-400 mt-2.5 flex items-center space-x-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/></svg>
            <span>Click any key or knob to inspect and customize it.</span>
          </p>
        </div>

        <!-- Layer Lighting Card -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              <h3 class="text-xs font-bold text-slate-800"><span id="layer-light-label">Layer 1</span> Lighting</h3>
            </div>
            <select id="led-effect-select" onchange="updateLedEffect(this.value)" class="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-700 outline-none">
              <option value="static">Static Color</option>
              <option value="wave">Color Wave</option>
              <option value="ripple">Ripple on Press</option>
              <option value="reactive">Reactive Key</option>
              <option value="white">Static White</option>
              <option value="off">LEDs Off</option>
            </select>
          </div>

          <!-- Color Swatches Grid -->
          <div class="grid grid-cols-4 gap-2">
            <button onclick="setLedColor('off')" data-color="off" class="color-swatch h-7 rounded-lg bg-slate-300 flex items-center justify-center text-xs font-semibold text-slate-600 transition border border-slate-300">Off</button>
            <button onclick="setLedColor('red')" data-color="red" class="color-swatch h-7 rounded-lg bg-red-500 text-white flex items-center justify-center transition shadow-sm"></button>
            <button onclick="setLedColor('orange')" data-color="orange" class="color-swatch h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center transition shadow-sm"></button>
            <button onclick="setLedColor('yellow')" data-color="yellow" class="color-swatch h-7 rounded-lg bg-yellow-400 text-slate-800 flex items-center justify-center transition shadow-sm"></button>
            <button onclick="setLedColor('green')" data-color="green" class="color-swatch h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center transition shadow-sm"></button>
            <button onclick="setLedColor('cyan')" data-color="cyan" class="color-swatch h-7 rounded-lg bg-cyan-400 text-white flex items-center justify-center transition shadow-sm"></button>
            <button onclick="setLedColor('blue')" data-color="blue" class="color-swatch h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center transition shadow-sm"></button>
            <button onclick="setLedColor('purple')" data-color="purple" class="color-swatch h-7 rounded-lg bg-purple-500 text-white flex items-center justify-center transition shadow-sm"></button>
          </div>
        </div>
      </section>

      <!-- Right Column: Control Inspector & Action Editor -->
      <main class="lg:col-span-7 p-8 flex flex-col justify-between space-y-6">
        <div>
          <!-- Selected Control Title & Reset -->
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h1 id="selected-control-name" class="text-2xl font-bold text-slate-900">Key 1</h1>
              <p id="selected-control-sub" class="text-xs text-slate-400 font-medium mt-0.5">Base Layer &bull; Single action</p>
            </div>
            <button onclick="resetCurrentControl()" class="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold shadow-sm transition active:scale-95">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span>Reset Control</span>
            </button>
          </div>

          <!-- Behavior Note -->
          <div class="mt-4 mb-6">
            <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">Behavior</span>
            <div class="flex items-center space-x-2 mt-1 text-xs text-slate-600 font-medium">
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <span>Runs once when the control is activated</span>
            </div>
          </div>

          <!-- Action Type Selector (4 Segmented Cards) -->
          <div class="mb-6">
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Action Type</label>
            <div class="grid grid-cols-4 gap-2.5">
              <button onclick="setActionType('macro')" id="tab-macro" class="action-tab flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-blue-500 bg-blue-50/50 text-blue-700 transition">
                <svg class="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                <span class="text-xs font-bold">Key / Macro</span>
              </button>
              <button onclick="setActionType('media')" id="tab-media" class="action-tab flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-slate-200 hover:border-slate-300 text-slate-600 transition">
                <svg class="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span class="text-xs font-bold">Media</span>
              </button>
              <button onclick="setActionType('mouse')" id="tab-mouse" class="action-tab flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-slate-200 hover:border-slate-300 text-slate-600 transition">
                <svg class="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/></svg>
                <span class="text-xs font-bold">Mouse</span>
              </button>
              <button onclick="setActionType('disabled')" id="tab-disabled" class="action-tab flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-slate-200 hover:border-slate-300 text-slate-600 transition">
                <svg class="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                <span class="text-xs font-bold">Disabled</span>
              </button>
            </div>
          </div>

          <!-- Section: Macro Editor Panel -->
          <div id="panel-macro" class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">Macro Keystroke Sequence</span>
              <button onclick="addKeystroke()" class="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition active:scale-95">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                <span>Add Keystroke</span>
              </button>
            </div>

            <!-- Keystrokes List -->
            <div id="keystrokes-list" class="space-y-2 max-h-56 overflow-y-auto pr-1"></div>

            <!-- Quick Text Phrase Input -->
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <span class="text-[11px] font-bold text-slate-600">Quick Text Shorthand</span>
              <div class="flex items-center space-x-2">
                <input type="text" id="quick-text-input" placeholder="Type a text phrase (e.g. hello world)..." class="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 bg-white">
                <button onclick="applyQuickText()" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition">Apply Text</button>
              </div>
            </div>

            <!-- Inter-Key Delay & Counter -->
            <div class="flex items-center justify-between pt-2">
              <div class="flex items-center space-x-2">
                <span class="text-xs font-medium text-slate-600">Inter-key delay:</span>
                <input type="number" id="inter-key-delay" min="0" max="1000" step="10" value="40" onchange="updateMacroDelay(this.value)" class="w-20 text-xs font-mono px-2 py-1 border border-slate-200 rounded-lg text-center font-bold">
                <span class="text-xs text-slate-400">ms</span>
              </div>
              <span id="keystroke-count" class="text-xs text-slate-400">1 of 27 keystrokes</span>
            </div>
          </div>

          <!-- Section: Media Controls Panel -->
          <div id="panel-media" class="hidden space-y-4">
            <span class="text-xs font-bold text-slate-700 uppercase tracking-wider block">Select Media Action</span>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button onclick="setMediaAction('play_pause')" class="media-btn p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center transition">
                <span class="text-lg mb-1">&#9654;&#10074;&#10074;</span>
                <span class="text-xs font-bold text-slate-800">Play / Pause</span>
              </button>
              <button onclick="setMediaAction('next_track')" class="media-btn p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center transition">
                <span class="text-lg mb-1">&#9197;</span>
                <span class="text-xs font-bold text-slate-800">Next Track</span>
              </button>
              <button onclick="setMediaAction('prev_track')" class="media-btn p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center transition">
                <span class="text-lg mb-1">&#9198;</span>
                <span class="text-xs font-bold text-slate-800">Previous Track</span>
              </button>
              <button onclick="setMediaAction('volume_up')" class="media-btn p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center transition">
                <span class="text-lg mb-1">&#128266;</span>
                <span class="text-xs font-bold text-slate-800">Volume Up</span>
              </button>
              <button onclick="setMediaAction('volume_down')" class="media-btn p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center transition">
                <span class="text-lg mb-1">&#128265;</span>
                <span class="text-xs font-bold text-slate-800">Volume Down</span>
              </button>
              <button onclick="setMediaAction('mute')" class="media-btn p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center transition">
                <span class="text-lg mb-1">&#128263;</span>
                <span class="text-xs font-bold text-slate-800">Mute</span>
              </button>
            </div>
          </div>

          <!-- Section: Mouse Actions Panel -->
          <div id="panel-mouse" class="hidden space-y-4">
            <span class="text-xs font-bold text-slate-700 uppercase tracking-wider block">Select Mouse Event</span>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button onclick="setMouseAction('lclick')" class="mouse-btn p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center transition">
                <span class="text-base font-mono mb-1">&#128430; Left</span>
                <span class="text-xs font-bold text-slate-800">Left Click</span>
              </button>
              <button onclick="setMouseAction('rclick')" class="mouse-btn p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center transition">
                <span class="text-base font-mono mb-1">&#128430; Right</span>
                <span class="text-xs font-bold text-slate-800">Right Click</span>
              </button>
              <button onclick="setMouseAction('mclick')" class="mouse-btn p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center transition">
                <span class="text-base font-mono mb-1">&#128430; Mid</span>
                <span class="text-xs font-bold text-slate-800">Middle Click</span>
              </button>
              <button onclick="setMouseAction('wheel_up')" class="mouse-btn p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center transition">
                <span class="text-lg mb-1">&#8679;</span>
                <span class="text-xs font-bold text-slate-800">Scroll Up</span>
              </button>
              <button onclick="setMouseAction('wheel_down')" class="mouse-btn p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex flex-col items-center justify-center text-center transition">
                <span class="text-lg mb-1">&#8681;</span>
                <span class="text-xs font-bold text-slate-800">Scroll Down</span>
              </button>
            </div>
          </div>

          <!-- Section: Disabled Panel -->
          <div id="panel-disabled" class="hidden p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
            <div class="w-10 h-10 mx-auto rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">&#8856;</div>
            <h4 class="text-xs font-bold text-slate-700">Control is Disabled</h4>
            <p class="text-xs text-slate-500 max-w-sm mx-auto">This button or knob action is unbound. When flashed to the pad, its flash memory will be cleared to empty (0, 0).</p>
          </div>

        </div>

        <!-- Global Status Bar -->
        <footer class="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div class="flex items-center space-x-2">
            <span id="footer-status-dot" class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span id="footer-status-text">USB configuration ready &bull; 1189:8840</span>
          </div>
          <div id="footer-save-state" class="flex items-center space-x-1.5 text-emerald-600 font-semibold">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            <span>Up to date</span>
          </div>
        </footer>
      </main>

    </div>

  </div>

  <script>
    // State
    let currentLayer = 1;
    let selectedControl = 'key1';
    let configData = {
      layers: {
        "1": { led: { color: "red", effect: "static" }, delay: 40 },
        "2": { led: { color: "blue", effect: "wave" }, delay: 40 },
        "3": { led: { color: "green", effect: "static" }, delay: 40 }
      }
    };

    const KNOWN_KEYS = [
      'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
      '0','1','2','3','4','5','6','7','8','9','enter','esc','backspace','tab','space','delete',
      'left','right','up','down','pageup','pagedown','home','end','insert',
      'f1','f2','f3','f4','f5','f6','f7','f8','f9','f10','f11','f12',
      'f13','f14','f15','f16','f17','f18','f19','f20','f21','f22','f23','f24',
      'minus','equal','lbracket','rbracket','backslash','semicolon','quote','grave','comma','period','slash',
      'kp_0','kp_1','kp_2','kp_3','kp_4','kp_5','kp_6','kp_7','kp_8','kp_9','kp_enter','kp_plus','kp_minus','kp_multiply','kp_divide'
    ];

    // Initialize
    window.addEventListener('DOMContentLoaded', () => {
      buildKeysGrid();
      fetchConfig();
      checkDevice();
    });

    function buildKeysGrid() {
      const grid = document.getElementById('keys-grid');
      grid.innerHTML = '';
      for (let i = 1; i <= 12; i++) {
        const btn = document.createElement('button');
        btn.id = `key-${i}`;
        btn.className = `keycap relative flex flex-col items-center justify-center h-14 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700/60 shadow-md transition active:scale-95 group ${selectedControl === `key${i}` ? 'keycap-selected' : ''}`;
        btn.onclick = () => selectControl(`key${i}`);
        btn.innerHTML = `
          <span class="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-200 absolute top-1 left-2">${i}</span>
          <span id="label-key${i}" class="text-xs font-semibold truncate px-1 max-w-[56px] text-zinc-100">Key ${i}</span>
        `;
        grid.appendChild(btn);
      }
    }

    function setLayer(layer) {
      currentLayer = layer;
      for (let l = 1; l <= 3; l++) {
        const btn = document.getElementById(`layer-btn-${l}`);
        if (l === layer) {
          btn.className = 'px-3.5 py-1 text-xs font-bold rounded-lg transition bg-blue-600 text-white shadow-sm';
        } else {
          btn.className = 'px-3.5 py-1 text-xs font-bold rounded-lg transition text-slate-600 hover:text-slate-900';
        }
      }
      document.getElementById('layer-light-label').innerText = `Layer ${layer}`;
      updateVisuals();
      inspectControl(selectedControl);
    }

    function selectControl(name) {
      selectedControl = name;
      // Update keycap styling
      document.querySelectorAll('.keycap').forEach(el => el.classList.remove('keycap-selected'));
      document.querySelectorAll('[id^="btn-knob"]').forEach(el => el.classList.remove('text-emerald-400', 'border-emerald-500'));
      document.getElementById('knob1-dial').classList.remove('knob-selected');
      document.getElementById('knob2-dial').classList.remove('knob-selected');

      if (name.startsWith('key')) {
        const idx = name.replace('key', '');
        const el = document.getElementById(`key-${idx}`);
        if (el) el.classList.add('keycap-selected');
      } else if (name === 'knob1_press') {
        document.getElementById('knob1-dial').classList.add('knob-selected');
      } else if (name === 'knob2_press') {
        document.getElementById('knob2-dial').classList.add('knob-selected');
      } else {
        const el = document.getElementById(`btn-${name}`);
        if (el) el.classList.add('text-emerald-400', 'border-emerald-500');
      }

      inspectControl(name);
    }

    function inspectControl(name) {
      const cleanName = formatControlTitle(name);
      document.getElementById('selected-control-name').innerText = cleanName;
      document.getElementById('selected-control-sub').innerText = `Layer ${currentLayer} • Action`;

      const layerData = configData.layers[String(currentLayer)] || {};
      const val = layerData[name];

      // Detect type
      if (!val || val === 'none' || val === 'disabled') {
        setActionType('disabled');
      } else if (typeof val === 'string' && ['play_pause','next_track','prev_track','volume_up','volume_down','mute','stop'].includes(val)) {
        setActionType('media');
        highlightActiveMedia(val);
      } else if (typeof val === 'string' && ['lclick','rclick','mclick','wheel_up','wheel_down'].includes(val)) {
        setActionType('mouse');
        highlightActiveMouse(val);
      } else {
        setActionType('macro');
        renderMacroEditor(val);
      }
    }

    function formatControlTitle(name) {
      if (name.startsWith('key')) return `Key ${name.replace('key', '')}`;
      return name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    function setActionType(type) {
      // Toggle tabs
      ['macro', 'media', 'mouse', 'disabled'].forEach(t => {
        const tab = document.getElementById(`tab-${t}`);
        const panel = document.getElementById(`panel-${t}`);
        if (t === type) {
          tab.className = 'action-tab flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-blue-500 bg-blue-50/50 text-blue-700 transition shadow-sm';
          panel.classList.remove('hidden');
        } else {
          tab.className = 'action-tab flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-slate-200 hover:border-slate-300 text-slate-600 transition';
          panel.classList.add('hidden');
        }
      });
    }

    // --- Macro Editor ---
    function renderMacroEditor(val) {
      const list = document.getElementById('keystrokes-list');
      list.innerHTML = '';

      let items = [];
      if (Array.isArray(val)) items = val;
      else if (typeof val === 'string') items = [val];
      else if (val) items = [val];

      if (items.length === 0) items = ['a'];

      items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'flex items-center space-x-2 p-2 bg-slate-50 border border-slate-200 rounded-xl';

        // Parse modifiers & base key
        let modCtrl = false, modShift = false, modAlt = false, modMeta = false;
        let baseKey = 'a';

        if (typeof item === 'string') {
          const parts = item.toLowerCase().split('+');
          baseKey = parts[parts.length - 1] || 'a';
          parts.slice(0, -1).forEach(p => {
            if (p.includes('ctrl')) modCtrl = true;
            if (p.includes('shift')) modShift = true;
            if (p.includes('alt')) modAlt = true;
            if (p.includes('meta') || p.includes('win') || p.includes('cmd')) modMeta = true;
          });
        }

        row.innerHTML = `
          <span class="text-xs font-mono font-bold text-slate-400 w-4">${index + 1}</span>
          <!-- Modifier Toggles -->
          <div class="flex items-center space-x-1">
            <button onclick="toggleMod(${index}, 'ctrl')" class="px-2 py-1 text-[10px] font-bold rounded-md ${modCtrl ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}">Ctrl</button>
            <button onclick="toggleMod(${index}, 'shift')" class="px-2 py-1 text-[10px] font-bold rounded-md ${modShift ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}">Shift</button>
            <button onclick="toggleMod(${index}, 'alt')" class="px-2 py-1 text-[10px] font-bold rounded-md ${modAlt ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}">Alt</button>
            <button onclick="toggleMod(${index}, 'win')" class="px-2 py-1 text-[10px] font-bold rounded-md ${modMeta ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}">Win</button>
          </div>
          <!-- Key Dropdown -->
          <select onchange="updateMacroKey(${index}, this.value)" class="flex-1 text-xs bg-white border border-slate-200 rounded-md px-2 py-1 font-mono outline-none">
            ${KNOWN_KEYS.map(k => `<option value="${k}" ${k === baseKey ? 'selected' : ''}>${k}</option>`).join('')}
          </select>
          <!-- Delete -->
          <button onclick="deleteKeystroke(${index})" class="text-slate-400 hover:text-red-500 p-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        `;
        list.appendChild(row);
      });

      document.getElementById('keystroke-count').innerText = `${items.length} of 27 keystrokes`;
    }

    function addKeystroke() {
      const layer = configData.layers[String(currentLayer)] = configData.layers[String(currentLayer)] || {};
      let val = layer[selectedControl];
      if (!Array.isArray(val)) val = val ? [val] : [];
      if (val.length >= 27) return alert('Maximum 27 keystrokes limit reached.');
      val.push('a');
      layer[selectedControl] = val;
      renderMacroEditor(val);
      updateVisuals();
    }

    function deleteKeystroke(idx) {
      const layer = configData.layers[String(currentLayer)] || {};
      let val = layer[selectedControl];
      if (!Array.isArray(val)) val = [val];
      val.splice(idx, 1);
      if (val.length === 0) val = 'none';
      else if (val.length === 1) val = val[0];
      layer[selectedControl] = val;
      renderMacroEditor(val);
      updateVisuals();
    }

    function toggleMod(idx, mod) {
      const layer = configData.layers[String(currentLayer)] || {};
      let val = layer[selectedControl];
      let item = Array.isArray(val) ? val[idx] : val;
      let parts = (item || 'a').split('+');
      let baseKey = parts[parts.length - 1];
      let mods = new Set(parts.slice(0, -1));

      if (mods.has(mod)) mods.delete(mod);
      else mods.add(mod);

      const newItem = [...mods, baseKey].join('+');
      if (Array.isArray(val)) val[idx] = newItem;
      else layer[selectedControl] = newItem;

      renderMacroEditor(val);
      updateVisuals();
    }

    function updateMacroKey(idx, key) {
      const layer = configData.layers[String(currentLayer)] || {};
      let val = layer[selectedControl];
      let item = Array.isArray(val) ? val[idx] : val;
      let parts = (item || 'a').split('+');
      parts[parts.length - 1] = key;

      const newItem = parts.join('+');
      if (Array.isArray(val)) val[idx] = newItem;
      else layer[selectedControl] = newItem;

      updateVisuals();
    }

    function applyQuickText() {
      const txt = document.getElementById('quick-text-input').value;
      if (!txt) return;
      const layer = configData.layers[String(currentLayer)] = configData.layers[String(currentLayer)] || {};
      layer[selectedControl] = txt;
      document.getElementById('quick-text-input').value = '';
      inspectControl(selectedControl);
      updateVisuals();
    }

    // --- Media & Mouse Actions ---
    function setMediaAction(act) {
      const layer = configData.layers[String(currentLayer)] = configData.layers[String(currentLayer)] || {};
      layer[selectedControl] = act;
      highlightActiveMedia(act);
      updateVisuals();
    }

    function highlightActiveMedia(act) {
      document.querySelectorAll('.media-btn').forEach(btn => {
        if (btn.innerText.toLowerCase().includes(act.replace('_', ' '))) {
          btn.classList.add('border-blue-500', 'bg-blue-50/50');
        } else {
          btn.classList.remove('border-blue-500', 'bg-blue-50/50');
        }
      });
    }

    function setMouseAction(act) {
      const layer = configData.layers[String(currentLayer)] = configData.layers[String(currentLayer)] || {};
      layer[selectedControl] = act;
      highlightActiveMouse(act);
      updateVisuals();
    }

    function highlightActiveMouse(act) {
      document.querySelectorAll('.mouse-btn').forEach(btn => {
        if (btn.innerText.toLowerCase().includes(act.replace('_', ' '))) {
          btn.classList.add('border-blue-500', 'bg-blue-50/50');
        } else {
          btn.classList.remove('border-blue-500', 'bg-blue-50/50');
        }
      });
    }

    function resetCurrentControl() {
      const layer = configData.layers[String(currentLayer)] || {};
      layer[selectedControl] = 'none';
      setActionType('disabled');
      updateVisuals();
    }

    // --- LEDs & Delays ---
    function setLedColor(col) {
      const layer = configData.layers[String(currentLayer)] = configData.layers[String(currentLayer)] || {};
      layer.led = layer.led || { color: 'red', effect: 'static' };
      layer.led.color = col;
      updateVisuals();
    }

    function updateLedEffect(eff) {
      const layer = configData.layers[String(currentLayer)] = configData.layers[String(currentLayer)] || {};
      layer.led = layer.led || { color: 'red', effect: 'static' };
      layer.led.effect = eff;
      updateVisuals();
    }

    function updateMacroDelay(ms) {
      const layer = configData.layers[String(currentLayer)] = configData.layers[String(currentLayer)] || {};
      layer.delay = parseInt(ms) || 0;
    }

    // --- UI Visual Synchronization ---
    function updateVisuals() {
      const layer = configData.layers[String(currentLayer)] || {};

      // Update Keycaps text
      for (let i = 1; i <= 12; i++) {
        const el = document.getElementById(`label-key${i}`);
        if (!el) continue;
        const val = layer[`key${i}`];
        el.innerText = formatBadgeText(val);
      }

      // Update Knob dial text
      document.getElementById('knob1-dial').innerText = formatBadgeText(layer.knob1_press) || 'Push';
      document.getElementById('knob2-dial').innerText = formatBadgeText(layer.knob2_press) || 'Push';

      // Update LED Swatch Active Outline
      const ledColor = (layer.led && layer.led.color) || 'red';
      const ledEffect = (layer.led && layer.led.effect) || 'static';
      document.getElementById('led-effect-select').value = ledEffect;

      document.querySelectorAll('.color-swatch').forEach(btn => {
        if (btn.getAttribute('data-color') === ledColor) {
          btn.innerHTML = '&#10003;';
          btn.classList.add('ring-2', 'ring-offset-2', 'ring-blue-600');
        } else {
          btn.innerHTML = btn.getAttribute('data-color') === 'off' ? 'Off' : '';
          btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-600');
        }
      });

      // Update Delay
      document.getElementById('inter-key-delay').value = layer.delay !== undefined ? layer.delay : 40;

      // Mark Unsaved
      markUnsaved();
    }

    function formatBadgeText(val) {
      if (!val || val === 'none' || val === 'disabled') return '-';
      if (Array.isArray(val)) return `[${val.length}]`;
      if (typeof val === 'string') {
        if (val.length > 8) return val.slice(0, 7) + '..';
        return val.replace('wheel_', 'W-').replace('volume_', 'V-').replace('track', '');
      }
      return String(val);
    }

    function markUnsaved() {
      document.getElementById('footer-save-state').innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        <span class="text-amber-600">Unsaved changes</span>
      `;
    }

    function markSaved() {
      document.getElementById('footer-save-state').innerHTML = `
        <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
        <span class="text-emerald-600">Up to date</span>
      `;
    }

    // --- Backend API Calls ---
    async function fetchConfig() {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          configData = await res.json();
          setLayer(1);
          markSaved();
        }
      } catch (e) {
        console.warn('Running offline or mock mode', e);
      }
    }

    async function checkDevice() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const indicator = document.getElementById('conn-indicator');
        const statusText = document.getElementById('footer-status-text');
        if (data.connected) {
          indicator.className = 'w-2 h-2 rounded-full bg-emerald-500';
          statusText.innerText = `USB configuration ready • ${data.device || '1189:8840'}`;
        } else {
          indicator.className = 'w-2 h-2 rounded-full bg-red-400';
          statusText.innerText = `Device disconnected • Offline mode`;
        }
      } catch (e) {}
    }

    // Buttons Actions
    document.getElementById('btn-save-json').onclick = async () => {
      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData)
        });
        if (res.ok) {
          markSaved();
          alert('Config saved to macropad.json');
        }
      } catch (e) {
        alert('Failed to save config: ' + e);
      }
    };

    document.getElementById('btn-read').onclick = async () => {
      const btn = document.getElementById('btn-read');
      btn.disabled = true;
      btn.innerText = 'Reading...';
      try {
        const res = await fetch('/api/read', { method: 'POST' });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        configData = data;
        setLayer(currentLayer);
        markSaved();
        alert('Live configuration read from macro pad!');
      } catch (e) {
        alert('Read failed: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `
          <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          <span>Read from Pad</span>
        `;
      }
    };

    document.getElementById('btn-flash').onclick = async () => {
      const btn = document.getElementById('btn-flash');
      btn.disabled = true;
      btn.innerText = 'Flashing...';
      try {
        const res = await fetch('/api/flash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        markSaved();
        alert('Success! All layers flashed and saved permanently to pad flash memory.');
      } catch (e) {
        alert('Flashing error: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
          </svg>
          <span>Flash to Pad</span>
        `;
      }
    };
  </script>
</body>
</html>
"""


class StudioHTTPHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress routine request logging to keep console clean
        pass

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)

        # Serve static assets from web/ directory if available
        web_dir = os.path.join(os.path.dirname(__file__), "web")
        req_path = parsed.path.lstrip("/")
        if not req_path:
            req_path = "index.html"
        static_file = os.path.join(web_dir, req_path)

        if os.path.isfile(static_file):
            ext = os.path.splitext(static_file)[1].lower()
            mime = "text/plain"
            if ext == ".html": mime = "text/html; charset=utf-8"
            elif ext == ".css": mime = "text/css; charset=utf-8"
            elif ext == ".js": mime = "application/javascript; charset=utf-8"
            elif ext == ".json": mime = "application/json; charset=utf-8"
            with open(static_file, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/" or parsed.path == "/index.html":
            body = UI_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/api/status":
            try:
                dev = pm.open_device()
                dev.close()
                self.send_json({"connected": True, "device": "1189:8840 (WCH CH552G)"})
            except Exception:
                self.send_json({"connected": False, "device": None})
            return

        if parsed.path == "/api/config":
            if os.path.exists(CONFIG_PATH):
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
            else:
                data = pm.DEFAULT_CONFIG
            self.send_json(data)
            return

        self.send_error(404, "Not Found")

    def do_POST(self):
        parsed = urlparse(self.path)
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len > 0 else b""

        if parsed.path == "/api/save":
            try:
                data = json.loads(body.decode("utf-8"))
                with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                self.send_json({"success": True})
            except Exception as e:
                self.send_json({"error": str(e)}, status=500)
            return

        if parsed.path == "/api/read":
            try:
                dev = pm.open_device()
                try:
                    exported = {}
                    for layer in range(1, pm.NUM_LAYERS + 1):
                        btns = pm.read_all_buttons(dev, layer)
                        layer_dict = {}
                        for btn_id, (mode, payload) in btns.items():
                            name = pm._BUTTON_ID_TO_NAME.get(btn_id)
                            if not name:
                                continue
                            if mode == pm.MODE_KEYBOARD:
                                if not payload or payload == [(0, 0)]:
                                    continue
                                if len(payload) == 1:
                                    m, k = payload[0]
                                    pfx = ""
                                    if m & 0x01: pfx += "ctrl+"
                                    if m & 0x02: pfx += "shift+"
                                    if m & 0x04: pfx += "alt+"
                                    if m & 0x08: pfx += "meta+"
                                    layer_dict[name] = f"{pfx}{pm._KEY_NAME.get(k, str(k))}"
                                else:
                                    seq = []
                                    for m, k in payload:
                                        pfx = ""
                                        if m & 0x01: pfx += "ctrl+"
                                        if m & 0x02: pfx += "shift+"
                                        if m & 0x04: pfx += "alt+"
                                        if m & 0x08: pfx += "meta+"
                                        seq.append(f"{pfx}{pm._KEY_NAME.get(k, str(k))}")
                                    layer_dict[name] = seq
                            elif mode == pm.MODE_MEDIA:
                                layer_dict[name] = pm._MEDIA_NAME.get(payload, f"media_{payload}")
                            elif mode == pm.MODE_MOUSE:
                                btn_mask, wheel = payload
                                if wheel == 1: layer_dict[name] = "wheel_up"
                                elif wheel == 255: layer_dict[name] = "wheel_down"
                                elif btn_mask == 1: layer_dict[name] = "lclick"
                                elif btn_mask == 2: layer_dict[name] = "rclick"
                                elif btn_mask == 4: layer_dict[name] = "mclick"
                        exported[str(layer)] = layer_dict
                    self.send_json({"layers": exported})
                finally:
                    dev.close()
            except Exception as e:
                self.send_json({"error": str(e)}, status=500)
            return

        if parsed.path == "/api/flash":
            try:
                data = json.loads(body.decode("utf-8"))
                # Save to macropad.json first
                with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)

                config, leds, delays = pm.load_config(CONFIG_PATH)
                dev = pm.open_device()
                try:
                    pm.program_from_config(dev, config, leds=leds, delays=delays)
                    pm.save_to_board(dev)
                    pm.verify_config(dev, config)
                finally:
                    dev.close()
                self.send_json({"success": True})
            except Exception as e:
                self.send_json({"error": str(e)}, status=500)
            return

        self.send_error(404, "Not Found")


def launch_browser_app(url: str):
    """
    Launch Edge or Chrome in standalone borderless desktop app mode if on Windows,
    otherwise open default browser.
    """
    if sys.platform == "win32":
        # Try launching Microsoft Edge in --app mode (looks like a native window)
        edge_paths = [
            os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        ]
        for ep in edge_paths:
            if os.path.exists(ep):
                try:
                    subprocess.Popen([ep, f"--app={url}"])
                    return
                except Exception:
                    pass

    webbrowser.open(url)


def start_server(port=PORT, config_path=CONFIG_PATH):
    global CONFIG_PATH
    CONFIG_PATH = config_path

    server = HTTPServer(("127.0.0.1", port), StudioHTTPHandler)
    url = f"http://127.0.0.1:{port}"
    print(f"\n  Starting MacroPad Studio UI at {url}")
    print("  Press Ctrl+C in this terminal to stop the server.\n")

    threading.Timer(0.6, lambda: launch_browser_app(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopping UI server...")
        server.server_close()


if __name__ == "__main__":
    start_server()
