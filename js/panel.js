/* ==========================================================================
   panel.js — the visible-state sidebar. Makes the invisible model visible:
   current branch, file statuses, commit graph, and remote sync state.
   Re-rendered after every command.
   ========================================================================== */

window.GG = window.GG || {};

(function (GG) {
  'use strict';

  var S = GG.state;

  var ICONS = {
    repo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    files: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    commits: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v8M12 15v8"/></svg>',
    remote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
  };

  var STATUS_LABEL = {
    untracked: 'untracked',
    modified: 'modified',
    staged: 'staged',
    clean: 'clean',
    conflicted: 'conflict'
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** render the entire panel for a scenario into a container element */
  function render(container, scn) {
    var folder = S.currentFolder(scn);
    var html = '';

    html += sectionRepo(scn, folder);
    html += sectionFiles(folder);
    html += sectionCommits(folder);
    html += sectionRemote(folder);

    container.innerHTML = html;
  }

  function sectionRepo(scn, folder) {
    var h = '<section class="panel__section">';
    h += '<h3 class="panel__heading">' + ICONS.repo + 'Repository</h3>';
    h += kv('location', esc(S.winPath(scn)), '');
    if (!folder) {
      h += '<p class="panel__empty">You’re in the course folder. The projects live below you — cd into one.</p>';
    } else if (!folder.isRepo) {
      h += kv('git repo?', 'no — just a folder', 'err');
      h += '<p class="panel__empty">No hidden .git here yet, so Git commands will fail. That’s what git init fixes.</p>';
    } else {
      h += kv('git repo?', 'yes (.git exists)', 'ok');
      h += kv('branch', esc(folder.branch), 'branch');
      if (folder.merge) {
        h += kv('merge', 'IN PROGRESS — resolve conflicts', 'warn');
      }
    }
    h += '</section>';
    return h;
  }

  function sectionFiles(folder) {
    var h = '<section class="panel__section">';
    h += '<h3 class="panel__heading">' + ICONS.files + 'Working Tree</h3>';
    if (!folder) {
      h += '<p class="panel__empty">—</p>';
    } else if (!folder.files.length) {
      h += '<p class="panel__empty">No files.</p>';
    } else {
      h += '<ul class="panel__files">';
      folder.files.forEach(function (f) {
        var st = folder.isRepo ? f.status : 'clean';
        var label = folder.isRepo ? STATUS_LABEL[f.status] : 'file';
        h += '<li class="file-row file-row--' + st + '">' +
          '<span class="file-row__name">' + esc(f.name) + '</span>' +
          '<span class="file-row__status">' + label + '</span></li>';
      });
      h += '</ul>';
    }
    h += '</section>';
    return h;
  }

  function sectionCommits(folder) {
    var h = '<section class="panel__section">';
    h += '<h3 class="panel__heading">' + ICONS.commits + 'Commits</h3>';
    if (!folder || !folder.isRepo) {
      h += '<p class="panel__empty">—</p>';
      h += '</section>';
      return h;
    }
    var commits = S.localCommits(folder);
    if (!commits.length) {
      h += '<p class="panel__empty">No commits yet. Stage files, then git commit.</p>';
      h += '</section>';
      return h;
    }
    var recent = commits.slice(-5).reverse();
    h += '<ul class="commits">';
    recent.forEach(function (c, i) {
      var isHead = i === 0;
      var refs = [];
      if (isHead) refs.push('HEAD');
      Object.keys(folder.remoteBranches || {}).forEach(function (b) {
        var arr = folder.remoteBranches[b];
        if (arr && arr.length && arr[arr.length - 1].hash === c.hash) refs.push('origin/' + b);
      });
      folder.branches.forEach(function (b) {
        if (b === folder.branch) return;
        var arr = folder.commitsByBranch[b];
        if (arr && arr.length && arr[arr.length - 1].hash === c.hash) refs.push(b);
      });
      h += '<li class="commit' + (isHead ? ' commit--head' : '') + (c.isMerge ? ' commit--merge' : '') + '">' +
        '<span class="commit__rail"><span class="commit__dot"></span></span>' +
        '<span class="commit__meta">' +
        '<span class="commit__hash">' + esc(c.hash) + '</span> ' +
        (refs.length ? '<span class="commit__refs">(' + esc(refs.join(', ')) + ')</span>' : '') +
        '<span class="commit__msg" title="' + esc(c.message) + '">' + esc(c.message) + '</span>' +
        '</span></li>';
    });
    h += '</ul>';
    if (commits.length > 5) {
      h += '<p class="panel__empty">…and ' + (commits.length - 5) + ' older commit' + (commits.length - 5 === 1 ? '' : 's') + '</p>';
    }
    h += '</section>';
    return h;
  }

  function sectionRemote(folder) {
    var h = '<section class="panel__section">';
    h += '<h3 class="panel__heading">' + ICONS.remote + 'GitHub (remote)</h3>';
    if (!folder || !folder.isRepo) {
      h += '<p class="panel__empty">—</p>';
      h += '</section>';
      return h;
    }
    if (!folder.remote) {
      h += kv('origin', 'not linked', 'err');
      h += '<p class="panel__empty">This repo doesn’t know GitHub exists. git remote add origin &lt;url&gt; creates the link.</p>';
      h += '</section>';
      return h;
    }
    h += kv('origin', esc(shortUrl(folder.remote.url)), '');
    var hasUpstream = !!folder.upstreams[folder.branch];
    h += kv('upstream', hasUpstream ? "tracking origin/" + esc(folder.branch) : 'not set for ' + esc(folder.branch), hasUpstream ? 'ok' : 'warn');

    var remCommits = folder.remoteBranches[folder.branch];
    if (remCommits) {
      h += kv('commits on GitHub', String(remCommits.length), '');
    } else if (Object.keys(folder.remoteBranches).length) {
      h += kv('this branch on GitHub?', 'not yet — push -u to publish', 'warn');
    } else {
      h += kv('commits on GitHub', 'none (empty repo)', 'warn');
    }

    var ahead = S.aheadCount(folder);
    var behind = S.behindCount(folder);
    if (ahead === 0 && behind === 0 && remCommits && remCommits.length) {
      h += '<div class="panel__sync panel__sync--ok">' + ICONS.check + 'in sync with GitHub</div>';
    } else {
      if (ahead > 0) {
        h += '<div class="panel__sync panel__sync--ahead">' + ICONS.up + ahead + ' commit' + (ahead === 1 ? '' : 's') + ' to push</div>';
      }
      if (behind > 0) {
        h += '<div class="panel__sync panel__sync--behind">' + ICONS.down + behind + ' commit' + (behind === 1 ? '' : 's') + ' to pull</div>';
      }
    }
    h += '</section>';
    return h;
  }

  function kv(key, valueHtml, tone) {
    return '<div class="panel__kv"><span class="panel__key">' + key + '</span>' +
      '<span class="panel__value' + (tone ? ' panel__value--' + tone : '') + '">' + valueHtml + '</span></div>';
  }

  function shortUrl(url) {
    return url.replace('https://github.com/', 'github.com/');
  }

  GG.panel = { render: render };
})(window.GG);
