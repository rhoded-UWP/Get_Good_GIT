/* ==========================================================================
   terminal.js — the mock terminal: Git-Bash-style two-line prompt, upward
   scrolling history, hidden input with a rendered block cursor, and
   arrow-key command history.
   ========================================================================== */

window.GG = window.GG || {};

(function (GG) {
  'use strict';

  var CLS = {
    err: 'terminal__line--err',
    ok: 'terminal__line--ok',
    muted: 'terminal__line--muted',
    branch: 'terminal__line--branch',
    warn: 'terminal__line--warn',
    banner: 'terminal__line--banner',
    praise: 'terminal__line--praise'
  };

  /**
   * @param {HTMLElement} bodyEl  the .terminal__body scroll region
   * @param {object} opts { getPrompt(): {userHost, sys, path, branch, merging},
   *                        onCommand(line) }
   */
  function Terminal(bodyEl, opts) {
    this.body = bodyEl;
    this.getPrompt = opts.getPrompt;
    this.onCommand = opts.onCommand;
    this.history = [];
    this.historyIndex = -1;
    this.draft = '';
    this.inputEl = null;
    this.echoRow = null;
    this.active = false;

    var self = this;
    bodyEl.addEventListener('mouseup', function () {
      // don't steal focus if the user is selecting output text to copy
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) self.focus();
    });
  }

  var MAX_SCROLLBACK = 2500; // lines; marathon sessions must not bloat the DOM

  Terminal.prototype.print = function (lines) {
    var self = this;
    (lines || []).forEach(function (line) {
      var el = document.createElement('div');
      el.className = 'terminal__line' + (line.c && CLS[line.c] ? ' ' + CLS[line.c] : '');
      el.textContent = line.t;
      self.body.appendChild(el);
    });
    while (this.body.children.length > MAX_SCROLLBACK) {
      this.body.removeChild(this.body.firstChild);
    }
    this.scrollDown();
  };

  Terminal.prototype.printBanner = function (textLines) {
    var self = this;
    textLines.forEach(function (t, i) {
      var el = document.createElement('div');
      el.className = 'terminal__line ' + (i === 0 ? CLS.banner : CLS.muted);
      el.textContent = t;
      self.body.appendChild(el);
    });
    var spacer = document.createElement('div');
    spacer.className = 'terminal__line';
    spacer.textContent = '';
    this.body.appendChild(spacer);
    this.scrollDown();
  };

  Terminal.prototype.printPraise = function (text) {
    var el = document.createElement('div');
    el.className = 'terminal__line ' + CLS.praise;
    el.textContent = '✔ ' + text;
    this.body.appendChild(el);
    this.scrollDown();
  };

  Terminal.prototype.clear = function () {
    this.body.innerHTML = '';
  };

  /* ---- prompt + live input row ------------------------------------------ */

  Terminal.prototype.prompt = function () {
    var p = this.getPrompt();

    // VS Code Windows PowerShell prompt: PS C:\CS1430\cool-website> _
    var row = document.createElement('div');
    row.className = 'terminal__line terminal__input-row';
    row.appendChild(span('terminal__prompt-ps', 'PS ' + p.path + '> '));
    var echo = document.createElement('span');
    echo.className = 'terminal__input-echo';
    row.appendChild(echo);
    this.body.appendChild(row);

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'terminal__input';
    input.setAttribute('aria-label', 'Terminal command input');
    input.autocapitalize = 'off';
    input.autocomplete = 'off';
    input.spellcheck = false;
    this.body.appendChild(input);

    // typing is the point: block paste and drag-drop into the command line
    var self2 = this;
    input.addEventListener('paste', function (e) {
      e.preventDefault();
      self2.showPasteNotice();
    });
    input.addEventListener('drop', function (e) {
      e.preventDefault();
      self2.showPasteNotice();
    });
    input.addEventListener('beforeinput', function (e) {
      if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
        e.preventDefault();
        self2.showPasteNotice();
      }
    });

    this.echoRow = { row: row, echo: echo };
    this.inputEl = input;
    this.active = true;

    var self = this;
    input.addEventListener('keydown', function (e) { self.handleKey(e); });
    input.addEventListener('input', function () { self.renderEcho(); });
    input.addEventListener('focus', function () { self.setFocused(true); });
    input.addEventListener('blur', function () { self.setFocused(false); });
    // selection changes (arrow left/right) need re-render too
    input.addEventListener('keyup', function () { self.renderEcho(); });
    input.addEventListener('click', function () { self.renderEcho(); });

    this.renderEcho();
    this.scrollDown();
    this.focus();
  };

  Terminal.prototype.setFocused = function (isFocused) {
    var terminal = this.body.closest('.terminal');
    if (terminal) terminal.classList.toggle('terminal--unfocused', !isFocused);
  };

  Terminal.prototype.renderEcho = function () {
    if (!this.echoRow || !this.inputEl) return;
    var value = this.inputEl.value;
    var pos = this.inputEl.selectionStart != null ? this.inputEl.selectionStart : value.length;
    var echo = this.echoRow.echo;
    echo.innerHTML = '';
    echo.appendChild(document.createTextNode(value.slice(0, pos)));
    var caret = document.createElement('span');
    caret.className = 'terminal__caret';
    caret.textContent = pos < value.length ? value[pos] : ' ';
    echo.appendChild(caret);
    if (pos < value.length) {
      echo.appendChild(document.createTextNode(value.slice(pos + 1)));
    }
    // long lines wrap; keep the caret in view while typing
    this.scrollDown();
  };

  Terminal.prototype.handleKey = function (e) {
    var input = this.inputEl;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.submit(input.value);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.history.length) return;
      if (this.historyIndex === -1) {
        this.draft = input.value;
        this.historyIndex = this.history.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
      input.value = this.history[this.historyIndex];
      input.setSelectionRange(input.value.length, input.value.length);
      this.renderEcho();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.historyIndex === -1) return;
      this.historyIndex++;
      if (this.historyIndex >= this.history.length) {
        this.historyIndex = -1;
        input.value = this.draft;
      } else {
        input.value = this.history[this.historyIndex];
      }
      input.setSelectionRange(input.value.length, input.value.length);
      this.renderEcho();
      return;
    }
    if (e.key === 'c' && e.ctrlKey) {
      // Ctrl+C cancels the current line, like a real shell
      e.preventDefault();
      this.freezeInput(input.value + '^C');
      this.historyIndex = -1;
      this.prompt();
    }
  };

  Terminal.prototype.submit = function (value) {
    this.freezeInput(value);
    if (value.trim()) {
      this.history.push(value);
    }
    this.historyIndex = -1;
    this.draft = '';
    this.onCommand(value);
  };

  /** turn the live input row into a static printed line */
  Terminal.prototype.freezeInput = function (finalText) {
    if (this.echoRow) {
      this.echoRow.echo.textContent = finalText;
      this.echoRow.echo.classList.remove('terminal__input-echo');
      this.echoRow.row.classList.remove('terminal__input-row');
    }
    if (this.inputEl) {
      this.inputEl.remove();
      this.inputEl = null;
    }
    this.echoRow = null;
    this.active = false;
  };

  /** transient in-terminal banner explaining why paste is blocked */
  Terminal.prototype.showPasteNotice = function () {
    var terminal = this.body.closest('.terminal');
    if (!terminal) return;
    var existing = terminal.querySelector('.terminal__notice');
    if (existing) existing.remove();
    var notice = document.createElement('div');
    notice.className = 'terminal__notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>' +
      '<span>Pasting is disabled on purpose — these commands need to live in your fingers, not your clipboard. Type it out!</span>';
    terminal.appendChild(notice);
    setTimeout(function () {
      notice.classList.add('terminal__notice--fading');
      setTimeout(function () { notice.remove(); }, 400);
    }, 3200);
  };

  Terminal.prototype.focus = function () {
    if (this.inputEl) this.inputEl.focus({ preventScroll: true });
  };

  Terminal.prototype.scrollDown = function () {
    this.body.scrollTop = this.body.scrollHeight;
  };

  function span(cls, text) {
    var s = document.createElement('span');
    if (cls) s.className = cls;
    s.textContent = text;
    return s;
  }

  GG.Terminal = Terminal;
})(window.GG);
