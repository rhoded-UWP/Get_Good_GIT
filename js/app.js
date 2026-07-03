/* ==========================================================================
   app.js — tab shell, per-phase wiring (terminal + mission + panel),
   checkpoint detection loop, and per-phase reset.
   ========================================================================== */

window.GG = window.GG || {};

(function (GG) {
  'use strict';

  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var RESET_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
  var TROPHY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M17 5h3a1 1 0 0 1 1 1c0 2-1.5 4-4 4M7 5H4a1 1 0 0 0-1 1c0 2 1.5 4 4 4"/></svg>';

  var phases = []; // runtime objects
  var activeId = null;

  function init() {
    GG.editor.init();
    var tabsEl = document.getElementById('tabs');
    var phasesEl = document.getElementById('phases');

    GG.curriculum.phases.forEach(function (def) {
      var phase = buildPhase(def);
      phases.push(phase);
      tabsEl.appendChild(phase.tabEl);
      phasesEl.appendChild(phase.rootEl);
    });

    // arrow-key navigation between tabs
    tabsEl.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var idx = phases.findIndex(function (p) { return p.def.id === activeId; });
      var next = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
      if (next < 0) next = phases.length - 1;
      if (next >= phases.length) next = 0;
      activate(phases[next].def.id);
      phases[next].tabEl.focus();
    });

    activate(phases[0].def.id);
    setInterval(watchdogTick, 2000);
  }

  /* ---- build one phase's DOM + runtime ----------------------------------- */

  function buildPhase(def) {
    var phase = {
      def: def,
      scenario: null,
      rt: {},
      skills: def.skills.map(function (s) { return { def: s, done: false }; }),
      booted: false,
      complete: false
    };

    // tab button
    var tab = document.createElement('button');
    tab.className = 'tab';
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.innerHTML = '<span class="tab__phase">' + def.id + '</span>' +
      '<span class="tab__label">' + def.tabLabel + '</span>' +
      '<span class="tab__progress">0/' + def.skills.length + '</span>';
    tab.addEventListener('click', function () { activate(def.id); });
    phase.tabEl = tab;
    phase.progressEl = tab.querySelector('.tab__progress');

    // phase section
    var root = document.createElement('section');
    root.className = 'phase';
    root.id = 'phase-' + def.id;

    // mission (left)
    var mission = document.createElement('aside');
    mission.className = 'mission phase__mission';
    mission.innerHTML =
      '<div class="mission__header"><h2 class="mission__title">' + def.title + '</h2></div>' +
      '<p class="mission__brief">' + def.brief + '</p>' +
      '<ul class="mission__skills"></ul>' +
      '<div class="mission__footer">' +
      '  <div class="mission__done-banner">' + TROPHY_SVG + '<span>Phase complete!</span></div>' +
      '  <button class="btn btn--ghost btn--reset" type="button">' + RESET_SVG + 'Reset phase</button>' +
      '</div>';
    phase.missionEl = mission;
    phase.skillsEl = mission.querySelector('.mission__skills');
    mission.querySelector('.btn--reset').addEventListener('click', function () { reset(phase); });

    // terminal (center)
    var termWrap = document.createElement('div');
    termWrap.className = 'terminal phase__terminal';
    termWrap.innerHTML =
      '<div class="terminal__titlebar">' +
      '  <span class="terminal__vstab">Problems</span>' +
      '  <span class="terminal__vstab">Output</span>' +
      '  <span class="terminal__vstab">Debug Console</span>' +
      '  <span class="terminal__vstab terminal__vstab--active">Terminal</span>' +
      '  <span class="terminal__shell">' +
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 17 6-5-6-5M12 19h8"/></svg>' +
      '    powershell (simulated)</span>' +
      '</div>' +
      '<div class="terminal__body"></div>';
    phase.terminal = new GG.Terminal(termWrap.querySelector('.terminal__body'), {
      getPrompt: function () { return GG.git.promptParts(phase.scenario); },
      onCommand: function (line) { handleCommand(phase, line); }
    });

    // state panel (right)
    var panel = document.createElement('aside');
    panel.className = 'panel phase__panel';
    phase.panelEl = panel;

    root.appendChild(mission);
    root.appendChild(termWrap);
    root.appendChild(panel);
    phase.rootEl = root;

    return phase;
  }

  /* ---- tab switching ------------------------------------------------------ */

  function activate(id) {
    activeId = id;
    phases.forEach(function (p) {
      var isActive = p.def.id === id;
      p.rootEl.classList.toggle('phase--active', isActive);
      p.tabEl.classList.toggle('tab--active', isActive);
      p.tabEl.setAttribute('aria-selected', String(isActive));
      if (isActive) {
        if (!p.booted) boot(p);
        p.terminal.focus();
      }
    });
  }

  function boot(phase) {
    phase.booted = true;
    phase.scenario = GG.state.seeds[phase.def.seedId]();
    phase.terminal.printBanner(phase.def.welcome);
    renderMission(phase);
    GG.panel.render(phase.panelEl, phase.scenario);
    phase.terminal.prompt();
  }

  function reset(phase, noticeLines) {
    phase.scenario = GG.state.seeds[phase.def.seedId]();
    phase.rt = {};
    phase.complete = false;
    phase.skills.forEach(function (s) { s.done = false; });
    phase.missionEl.classList.remove('mission--complete');
    phase.terminal.clear();
    phase.terminal.history = [];
    phase.terminal.printBanner(phase.def.welcome);
    phase.terminal.print(noticeLines || [{ t: '(phase reset — fresh start, same mission)', c: 'muted' }, { t: '', c: '' }]);
    renderMission(phase);
    updateTabProgress(phase);
    GG.panel.render(phase.panelEl, phase.scenario);
    phase.terminal.prompt();
  }

  var RECOVERY_NOTICE = [
    { t: '(simulator) The terminal display had a problem, so this phase was reset to a clean start — same as pressing "Reset phase".', c: 'warn' },
    { t: '(simulator) Your progress in the other tabs is untouched.', c: 'muted' },
    { t: '', c: '' }
  ];

  /** last-resort recovery: if anything throws while handling a command, the
      terminal must never be left dead/blank — reset the phase instead,
      exactly like pressing the Reset button */
  function runSafely(phase, fn) {
    try {
      fn();
      // belt-and-braces: verify the command left a usable terminal behind
      if (!isEditorOpen() && terminalBlank(phase)) {
        reset(phase, RECOVERY_NOTICE);
      }
    } catch (err) {
      try {
        reset(phase, RECOVERY_NOTICE);
      } catch (err2) { /* nothing left to do — never rethrow into the input handler */ }
    }
  }

  function isEditorOpen() {
    var el = document.getElementById('editor');
    return !!el && !el.hidden;
  }

  /** a healthy terminal always has visible scrollback text and a live input
      (except while the editor modal is open, when the input is paused) */
  function terminalBlank(phase) {
    var body = phase.rootEl.querySelector('.terminal__body');
    if (!body) return true;
    if (body.textContent.trim().length === 0) return true;
    if (!body.querySelector('.terminal__input')) return true;
    return false;
  }

  /** watchdog: whatever the cause — a bug, a rendering glitch, anything —
      if the active phase's terminal is ever found blank, auto-reset it */
  function watchdogTick() {
    if (isEditorOpen()) return;
    phases.forEach(function (p) {
      if (!p.booted || p.def.id !== activeId) return;
      if (terminalBlank(p)) {
        try {
          reset(p, RECOVERY_NOTICE);
        } catch (err) { /* next tick tries again */ }
      }
    });
  }

  /* ---- the core loop: run command → check skills → re-render -------------- */

  function handleCommand(phase, line) {
    runSafely(phase, function () {
      var result = GG.git.run(line, phase.scenario);

      if (result.meta.clear) {
        phase.terminal.clear();
        phase.terminal.print([
          { t: '(screen cleared — your files, commits, and progress are all untouched; the panel on the right still shows everything)', c: 'muted' }
        ]);
      } else {
        phase.terminal.print(result.lines);
      }

      // the edit command opens the modal editor; everything else finishes now
      if (result.meta.openEditor) {
        var folder = GG.state.currentFolder(phase.scenario);
        GG.editor.open({
          folder: folder,
          fileName: result.meta.openEditor.fileName,
          isNew: result.meta.openEditor.isNew,
          onDone: function (res) {
            runSafely(phase, function () {
              phase.terminal.print(editorFeedback(res));
              afterCommand(phase, { name: 'edit', ok: res.saved, meta: { edited: res.fileName, changed: res.changed } });
            });
          }
        });
        return;
      }

      afterCommand(phase, {
        name: result.name,
        ok: result.ok,
        meta: result.meta
      });
    });
  }

  function editorFeedback(res) {
    if (!res.saved) {
      return [{ t: '(simulator) Closed without saving — nothing changed.', c: 'muted' }];
    }
    if (res.wasConflicted && res.markersGone) {
      return [{ t: '(simulator) Saved ' + res.fileName + ' — conflict markers are gone. Now tell Git it’s resolved:  git add ' + res.fileName, c: 'muted' }];
    }
    if (res.wasConflicted && !res.markersGone) {
      return [{ t: '(simulator) Saved, but ' + res.fileName + ' still contains <<<<<<< markers. Open it again and delete the marker lines.', c: 'warn' }];
    }
    if (res.doneCoding && res.isNew) {
      return [{ t: '(simulator) Done coding! ' + res.fileName + ' is a brand-new file — Git sees it as untracked.', c: 'muted' }];
    }
    if (res.doneCoding) {
      return [{ t: '(simulator) Done coding! ' + res.fileName + ' has changed. Run git status to see how Git noticed.', c: 'muted' }];
    }
    return [{ t: '(simulator) Saved ' + res.fileName + '.', c: 'muted' }];
  }

  function afterCommand(phase, ctxBase) {
    var ctx = {
      name: ctxBase.name,
      ok: ctxBase.ok,
      meta: ctxBase.meta || {},
      scenario: phase.scenario,
      folder: GG.state.currentFolder(phase.scenario)
    };

    if (phase.def.track) phase.def.track(ctx, phase.rt);

    var newlyDone = [];
    phase.skills.forEach(function (s) {
      if (s.done) return;
      var passed = false;
      try { passed = !!s.def.check(ctx, phase.rt); } catch (err) { passed = false; }
      if (passed) {
        s.done = true;
        newlyDone.push(s);
      }
    });

    newlyDone.forEach(function (s) {
      phase.terminal.printPraise('skill complete: ' + s.def.label);
    });

    var allDone = phase.skills.every(function (s) { return s.done; });
    if (allDone && !phase.complete) {
      phase.complete = true;
      phase.missionEl.classList.add('mission--complete');
      phase.terminal.print([{ t: '', c: '' }]);
      phase.terminal.printPraise('PHASE ' + phase.def.id + ' COMPLETE — hit Reset and run it again from memory, or move to the next tab.');
    }

    renderMission(phase, newlyDone);
    updateTabProgress(phase);
    GG.panel.render(phase.panelEl, phase.scenario);
    phase.terminal.prompt();
  }

  /** labels are plain text (may contain <url>, <file> placeholders) */
  function escapeLabel(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---- mission list rendering ---------------------------------------------- */

  function renderMission(phase, newlyDone) {
    var justDoneIds = (newlyDone || []).map(function (s) { return s.def.id; });
    var ul = phase.skillsEl;
    ul.innerHTML = '';
    var currentAssigned = false;

    phase.skills.forEach(function (s) {
      var li = document.createElement('li');
      var cls = 'skill';
      if (s.done) cls += ' skill--done';
      if (justDoneIds.indexOf(s.def.id) !== -1) cls += ' skill--just-done';
      if (!s.done && !currentAssigned) {
        cls += ' skill--current';
        currentAssigned = true;
      }
      li.className = cls;
      li.innerHTML =
        '<div class="skill__row">' +
        '  <span class="skill__check">' + CHECK_SVG + '</span>' +
        '  <span class="skill__label">' + escapeLabel(s.def.label) + '</span>' +
        '</div>' +
        '<div class="skill__hint">' + s.def.hint + '</div>';
      ul.appendChild(li);
    });
  }

  function updateTabProgress(phase) {
    var done = phase.skills.filter(function (s) { return s.done; }).length;
    var total = phase.skills.length;
    phase.progressEl.textContent = done + '/' + total;
    phase.progressEl.classList.toggle('tab__progress--done', done === total);
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.GG);
