/* ==========================================================================
   editor.js — the tiny modal file editor. This is how students "work on
   their code" so files become modified, and how they resolve merge
   conflicts by deleting the <<<<<<< markers.
   ========================================================================== */

window.GG = window.GG || {};

(function (GG) {
  'use strict';

  var els = null;
  var current = null; // { folder, fileName, isNew, onDone }

  function init() {
    els = {
      root: document.getElementById('editor'),
      filename: document.getElementById('editor-filename'),
      badge: document.getElementById('editor-badge'),
      conflictHelp: document.getElementById('editor-conflict-help'),
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
   *   result: { saved, changed, fileName, isNew, hadMarkers, markersGone }
   */
  function open(opts) {
    current = opts;
    var file = opts.isNew ? null : GG.state.findFile(opts.folder, opts.fileName);
    var content = file ? file.content : '';
    var conflicted = !!file && file.status === 'conflicted';

    els.filename.textContent = opts.fileName;
    els.badge.hidden = !conflicted;
    els.conflictHelp.hidden = !conflicted;
    els.textarea.value = content;
    current.originalContent = content;
    current.wasConflicted = conflicted;

    els.root.hidden = false;
    els.textarea.focus();
    els.textarea.setSelectionRange(0, 0);
  }

  function save() {
    if (!current) return;
    var folder = current.folder;
    var newContent = els.textarea.value;
    var changed = newContent !== current.originalContent;
    var file;

    if (current.isNew) {
      file = GG.state.makeFile(current.fileName, newContent, folder.isRepo ? 'untracked' : 'untracked', false);
      folder.files.push(file);
    } else {
      file = GG.state.findFile(folder, current.fileName);
      file.content = newContent;
      if (changed && folder.isRepo) {
        // conflicted files stay conflicted until git add; others become modified
        if (file.status === 'clean' || file.status === 'staged') {
          file.status = 'modified';
        }
      }
    }

    var result = {
      saved: true,
      changed: changed,
      fileName: current.fileName,
      isNew: current.isNew,
      wasConflicted: current.wasConflicted,
      markersGone: current.wasConflicted && newContent.indexOf('<<<<<<<') === -1
    };
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
