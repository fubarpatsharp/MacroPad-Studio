/**
 * MacroPad Studio Application Entry Point.
 */

import { AppController } from './ui/app-controller.js';

window.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.start();
  window.__macropadStudio = app;
});
