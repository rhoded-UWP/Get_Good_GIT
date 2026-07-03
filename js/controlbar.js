/* ==========================================================================
   controlbar.js — score display, font-size controls, light/dark toggle.

   Loaded FIRST so the theme applies before the page paints.

   Storage note: the spec requires surviving sandboxed Canvas iframes, where
   touching window.localStorage THROWS. Every access goes through safeStore,
   which falls back to in-memory (session-only) values when storage is
   unavailable. In a normal browser tab, choices survive reload as requested.
   ========================================================================== */

window.GG = window.GG || {};

(function (GG) {
  'use strict';

  /* ---- storage that can't crash the app ---------------------------------- */

  var memory = {};
  var safeStore = {
    get: function (key) {
      try { return window.localStorage.getItem(key); }
      catch (e) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, value); }
      catch (e) { memory[key] = value; }
    }
  };

  /* ---- theme: apply immediately so there's no flash of wrong theme ------- */

  var THEME_KEY = 'gg-theme';

  function systemTheme() {
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch (e) { return 'dark'; }
  }

  var theme = safeStore.get(THEME_KEY);
  if (theme !== 'light' && theme !== 'dark') theme = systemTheme();
  document.documentElement.setAttribute('data-theme', theme);

  function applyTheme(next) {
    theme = next;
    document.documentElement.setAttribute('data-theme', theme);
    safeStore.set(THEME_KEY, theme);
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  /* ---- font size: scales the whole page via the root element ------------- */

  var FONT_KEY = 'gg-font-size';
  var FONT_MIN = 12;
  var FONT_MAX = 22;
  var FONT_DEFAULT = 16;
  var FONT_STEP = 1;

  var fontSize = parseInt(safeStore.get(FONT_KEY), 10);
  if (isNaN(fontSize)) fontSize = FONT_DEFAULT;
  fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, fontSize));
  document.documentElement.style.fontSize = fontSize + 'px';

  function applyFontSize(next) {
    fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, next));
    document.documentElement.style.fontSize = fontSize + 'px';
    safeStore.set(FONT_KEY, String(fontSize));
    var readout = document.getElementById('font-value');
    if (readout) readout.textContent = fontSize + 'px';
    var minus = document.getElementById('font-minus');
    var plus = document.getElementById('font-plus');
    if (minus) minus.disabled = fontSize <= FONT_MIN;
    if (plus) plus.disabled = fontSize >= FONT_MAX;
  }

  /* ---- score: programmatic API, nothing awards points yet ---------------- */

  var score = 0;

  function renderScore() {
    var el = document.getElementById('controlbar-score');
    if (el) el.textContent = String(score);
  }

  GG.score = {
    get: function () { return score; },
    set: function (n) { score = Number(n) || 0; renderScore(); return score; },
    add: function (n) { score += Number(n) || 0; renderScore(); return score; }
  };

  /* ---- wire up the bar ---------------------------------------------------- */

  document.addEventListener('DOMContentLoaded', function () {
    renderScore();
    applyFontSize(fontSize);
    applyTheme(theme);

    document.getElementById('font-minus').addEventListener('click', function () {
      applyFontSize(fontSize - FONT_STEP);
    });
    document.getElementById('font-plus').addEventListener('click', function () {
      applyFontSize(fontSize + FONT_STEP);
    });
    document.getElementById('theme-toggle').addEventListener('click', function () {
      applyTheme(theme === 'dark' ? 'light' : 'dark');
    });
  });
})(window.GG);
