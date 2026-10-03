/**
 * SVG icons used across the MacroPad Studio interface.
 * Clean, consistent vector shapes.
 */

export const ICONS = Object.freeze({
  'play-pause': `
    <svg class="w-6 h-6 text-current mb-2 transition" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 5h3v14H4zm13 0h3v14h-3zM9 5l10 7-10 7z"/>
    </svg>`,

  'next-track': `
    <svg class="w-6 h-6 text-current mb-2 transition" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 5l9 7-9 7V5zm10 0l9 7-9 7V5zm6 0h2v14h-2z"/>
    </svg>`,

  'prev-track': `
    <svg class="w-6 h-6 text-current mb-2 transition" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2 5h2v14H2zm4 7l9-7v14l-9-7zm10 0l9-7v14l-9-7z"/>
    </svg>`,

  'volume-up': `
    <svg class="w-6 h-6 text-current mb-2 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M11 5L6 9H2v6h4l5 4V5z"/>
    </svg>`,

  'volume-down': `
    <svg class="w-6 h-6 text-current mb-2 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M11 5L6 9H2v6h4l5 4V5z"/>
    </svg>`,

  mute: `
    <svg class="w-6 h-6 text-current mb-2 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l4-4m0 4l-4-4"/>
    </svg>`,

  'mouse-left': `
    <svg class="w-6 h-6 text-current mb-1.5 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="3" width="12" height="18" rx="6" stroke-width="2"/>
      <path d="M12 3v6M6 9h6" stroke-width="2"/>
      <path d="M6 9h6V3c-3.314 0-6 2.686-6 6z" fill="currentColor" fill-opacity="0.3"/>
    </svg>`,

  'mouse-right': `
    <svg class="w-6 h-6 text-current mb-1.5 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="3" width="12" height="18" rx="6" stroke-width="2"/>
      <path d="M12 3v6M12 9h6" stroke-width="2"/>
      <path d="M12 9h6V3c3.314 0 6 2.686 6 6z" fill="currentColor" fill-opacity="0.3"/>
    </svg>`,

  'mouse-middle': `
    <svg class="w-6 h-6 text-current mb-1.5 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="3" width="12" height="18" rx="6" stroke-width="2"/>
      <rect x="10.5" y="6" width="3" height="6" rx="1.5" fill="currentColor" stroke-width="1.5"/>
    </svg>`,

  'wheel-up': `
    <svg class="w-6 h-6 text-current mb-1.5 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="3" width="12" height="18" rx="6" stroke-width="2"/>
      <path d="M12 11V6m0 0l-2 2m2-2l2 2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

  'wheel-down': `
    <svg class="w-6 h-6 text-current mb-1.5 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="3" width="12" height="18" rx="6" stroke-width="2"/>
      <path d="M12 7v5m0 0l-2-2m2 2l2-2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

  trash: `
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>`,

  check: `
    <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
    </svg>`,
});
