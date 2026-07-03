/* ==========================================================================
   editor.js — the "work on your code" modal.

   Two modes:
   - SIMPLE (default): students don't actually type Python here. The modal
     shows "First do some coding, be sure to save your work. Click 'Done
     Coding' to continue." and clicking the button applies a simulated change
     so the file shows up as modified/untracked in Git.
   - CONFLICT: when the file contains merge-conflict markers (Phase 4), the
     real textarea opens — deleting the <<<<<<< markers by hand IS the
     lesson, so that stays hands-on.
   ========================================================================== */

window.GG = window.GG || {};

(function (GG) {
  'use strict';

  var els = null;
  var current = null; // { folder, fileName, isNew, mode, onDone }
  var editCounter = 0; // makes every simulated edit produce distinct content

  function init() {
    els = {
      root: document.getElementById('editor'),
      filename: document.getElementById('editor-filename'),
      badge: document.getElementById('editor-badge'),
      conflictHelp: document.getElementById('editor-conflict-help'),
      worked: document.getElementById('editor-worked'),
      textarea: document.getElementById('editor-textarea'),
      save: document.getElementById('editor-save')
    };

    els.save.addEventListener('click', save);
    els.root.querySelectorAll('[data-editor-cancel]').forEach(function (el) {
      el.addEventListener('click', cancel);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !els.root.hidden) cancel();
    });
  }

  /**
   * @param {object} opts { folder, fileName, isNew, onDone(result) }
   *   result: { saved, changed, fileName, isNew, wasConflicted, markersGone,
   *             doneCoding }
   */
  function open(opts) {
    current = opts;
    var file = opts.isNew ? null : GG.state.findFile(opts.folder, opts.fileName);
    var conflicted = !!file && file.status === 'conflicted';
    current.mode = conflicted ? 'conflict' : 'simple';
    current.wasConflicted = conflicted;

    els.filename.textContent = opts.fileName;
    els.badge.hidden = !conflicted;
    els.conflictHelp.hidden = !conflicted;

    if (conflicted) {
      els.worked.hidden = true;
      els.textarea.hidden = false;
      els.textarea.value = file.content;
      current.originalContent = file.content;
      els.save.textContent = 'Save & Close';
      els.root.hidden = false;
      els.textarea.focus();
      els.textarea.setSelectionRange(0, 0);
    } else {
      els.worked.hidden = false;
      els.textarea.hidden = true;
      els.save.textContent = 'Done Coding';
      els.root.hidden = false;
      els.save.focus();
    }
  }

  function save() {
    if (!current) return;
    var folder = current.folder;
    var file;
    var result;

    if (current.mode === 'simple') {
      editCounter++;
      if (current.isNew) {
        file = GG.state.makeFile(current.fileName, '# my new code (edit ' + editCounter + ')\n', 'untracked', false);
        folder.files.push(file);
      } else {
        file = GG.state.findFile(folder, current.fileName);
        file.content += '\n# my latest work (edit ' + editCounter + ')\n';
        if (folder.isRepo && (file.status === 'clean' || file.status === 'staged')) {
          file.status = 'modified';
        }
      }
      result = {
        saved: true,
        changed: true,
        doneCoding: true,
        fileName: current.fileName,
        isNew: current.isNew,
        wasConflicted: false,
        markersGone: false
      };
    } else {
      // conflict mode: apply exactly what the student typed
      var newContent = els.textarea.value;
      var changed = newContent !== current.originalContent;
      file = GG.state.findFile(folder, current.fileName);
      file.content = newContent;
      result = {
        saved: true,
        changed: changed,
        doneCoding: false,
        fileName: current.fileName,
        isNew: false,
        wasConflicted: true,
        markersGone: newContent.indexOf('<<<<<<<') === -1
      };
    }

    close();
    finish(result);
  }

  function cancel() {
    if (!current) return;
    var result = { saved: false, changed: false, fileName: current.fileName };
    close();
    finish(result);
  }

  function close() {
    els.root.hidden = true;
  }

  function finish(result) {
    var cb = current && current.onDone;
    current = null;
    if (cb) cb(result);
  }

  GG.editor = { init: init, open: open };
})(window.GG);
