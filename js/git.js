/* ==========================================================================
   git.js — command parser + context-sensitive handlers.
   The teaching value lives here: every handler validates the command against
   the CURRENT state and prints what real Git would print — success or error.
   ========================================================================== */

window.GG = window.GG || {};

(function (GG) {
  'use strict';

  var S = GG.state;

  /* line helper: {t: text, c: class-suffix} */
  function L(text, cls) { return { t: text, c: cls || '' }; }

  function simNote(text) { return L('(simulator) ' + text, 'muted'); }

  /* ---- tokenizer: split on spaces, respect single/double quotes --------- */

  function tokenize(raw) {
    var tokens = [];
    var cur = '';
    var quote = null;
    var started = false;
    for (var i = 0; i < raw.length; i++) {
      var ch = raw[i];
      if (quote) {
        if (ch === quote) { quote = null; } else { cur += ch; }
      } else if (ch === '"' || ch === "'") {
        quote = ch;
        started = true;
      } else if (ch === ' ' || ch === '\t') {
        if (started || cur.length) { tokens.push(cur); cur = ''; started = false; }
      } else {
        cur += ch;
      }
    }
    if (quote) return { error: 'unclosed-quote', quote: quote };
    if (started || cur.length) tokens.push(cur);
    return { tokens: tokens };
  }

  /* ---- tiny fakers for realistic-looking transfer output ---------------- */

  function kb() { return (Math.random() * 6 + 1).toFixed(2); }

  function longHash(short) {
    var h = short;
    while (h.length < 40) h += S.randHash();
    return h.slice(0, 40);
  }

  function statLines(files, insertions) {
    var lines = [];
    var width = 0;
    files.forEach(function (n) { width = Math.max(width, n.length); });
    files.forEach(function (n) {
      var pad = n + new Array(width - n.length + 1).join(' ');
      lines.push(L(' ' + pad + ' | ' + Math.max(1, Math.round(insertions / files.length)) + ' ' +
        plusRow(Math.max(1, Math.round(insertions / files.length)))));
    });
    lines.push(L(' ' + files.length + ' file' + (files.length === 1 ? '' : 's') + ' changed, ' +
      insertions + ' insertion' + (insertions === 1 ? '' : 's') + '(+)'));
    return lines;
  }

  function plusRow(n) {
    return new Array(Math.min(n, 20) + 1).join('+');
  }

  var NOT_A_REPO = 'fatal: not a git repository (or any of the parent directories): .git';

  /* ==========================================================================
     Main entry: run one typed line against a scenario.
     Returns { lines, ok, name, meta }
     ========================================================================== */

  function run(raw, scn) {
    var trimmed = raw.trim();
    if (!trimmed) return { lines: [], ok: true, name: '', meta: {} };

    var tk = tokenize(trimmed);
    if (tk.error === 'unclosed-quote') {
      return {
        lines: [
          L('dquote>'),
          simNote('That quote (' + tk.quote + ') was never closed, so a real terminal would sit waiting for more input. Close the quote around your text and try again.')
        ],
        ok: false, name: 'unclosed-quote', meta: {}
      };
    }

    var tokens = tk.tokens;
    var cmd = tokens[0];
    var args = tokens.slice(1);
    var folder = S.currentFolder(scn);

    switch (cmd) {
      case 'help': return doHelp();
      case 'clear': case 'cls': return { lines: [], ok: true, name: 'clear', meta: { clear: true } };
      case 'pwd':
        return {
          lines: [L(''), L('Path'), L('----'), L(S.winPath(scn)), L('')],
          ok: true, name: 'pwd', meta: {}
        };
      case 'ls': case 'dir': return doLs(scn, folder);
      case 'cd': return doCd(scn, args);
      case 'cat': return doCat(scn, folder, args);
      case 'touch': return doTouch(scn, folder, args);
      case 'edit': return doEdit(scn, folder, args);
      case 'git': return doGit(scn, folder, args, trimmed);
      default:
        return {
          lines: [
            L(cmd + ": The term '" + cmd + "' is not recognized as a name of a cmdlet, function, script file, or executable program.", 'err'),
            L('Check the spelling of the name, or if a path was included, verify that the path is correct and try again.', 'err')
          ],
          ok: false, name: cmd, meta: {}
        };
    }
  }

  /* ---- plain shell commands ---------------------------------------------- */

  function doHelp() {
    return {
      lines: [
        L('Available commands in this simulator:', 'muted'),
        L(''),
        L('  git <subcommand>   the whole point! clone, init, status, add,', 'muted'),
        L('                     commit, push, pull, log, branch, switch,', 'muted'),
        L('                     merge, remote', 'muted'),
        L('  ls                 list files and folders here', 'muted'),
        L('  cd <folder>        move into a folder (cd .. to go back up)', 'muted'),
        L('  pwd                print where you are', 'muted'),
        L('  cat <file>         print a file’s contents', 'muted'),
        L('  edit <file>        open a file in a tiny editor (this is how', 'muted'),
        L('                     you “work on your code” here)', 'muted'),
        L('  touch <file>       create a new empty file', 'muted'),
        L('  clear              wipe the screen', 'muted')
      ],
      ok: true, name: 'help', meta: {}
    };
  }

  function doLs(scn, folder) {
    var lines = [];
    if (!folder) {
      var names = Object.keys(scn.folders);
      if (!names.length) {
        lines.push(L('(empty — nothing here yet)', 'muted'));
      } else {
        names.forEach(function (n) { lines.push(L(n + '/', 'branch')); });
      }
    } else {
      folder.files.forEach(function (f) { lines.push(L(f.name)); });
      if (!folder.files.length) lines.push(L('(empty)', 'muted'));
    }
    return { lines: lines, ok: true, name: 'ls', meta: {} };
  }

  function doCd(scn, args) {
    var target = args[0];
    if (!target || target === '~') {
      scn.cwd = '~';
      return { lines: [], ok: true, name: 'cd', meta: { cd: '~' } };
    }
    if (target === '..') {
      scn.cwd = '~';
      return { lines: [], ok: true, name: 'cd', meta: { cd: '~' } };
    }
    var clean = target.replace(/\/+$/, '');
    if (scn.cwd === '~' && scn.folders[clean]) {
      scn.cwd = '~/' + clean;
      return { lines: [], ok: true, name: 'cd', meta: { cd: clean } };
    }
    return {
      lines: [L("Set-Location: Cannot find path '" + S.winPath(scn, clean) + "' because it does not exist.", 'err')],
      ok: false, name: 'cd', meta: {}
    };
  }

  function doCat(scn, folder, args) {
    if (!args[0]) return { lines: [L('usage: cat <file>', 'muted')], ok: false, name: 'cat', meta: {} };
    var f = folder && S.findFile(folder, args[0]);
    if (!f) {
      return { lines: [L("Get-Content: Cannot find path '" + S.winPath(scn, args[0]) + "' because it does not exist.", 'err')], ok: false, name: 'cat', meta: {} };
    }
    var lines = f.content.split('\n').map(function (ln) { return L(ln); });
    return { lines: lines, ok: true, name: 'cat', meta: {} };
  }

  function doTouch(scn, folder, args) {
    if (!args[0]) return { lines: [L('usage: touch <file>', 'muted')], ok: false, name: 'touch', meta: {} };
    if (!folder) {
      return { lines: [simNote('You’re in C:\\CS1430 itself — cd into a project before creating files.')], ok: false, name: 'touch', meta: {} };
    }
    if (!S.findFile(folder, args[0])) {
      folder.files.push(S.makeFile(args[0], '', folder.isRepo ? 'untracked' : 'untracked', false));
    }
    return { lines: [], ok: true, name: 'touch', meta: { touched: args[0] } };
  }

  function doEdit(scn, folder, args) {
    if (!args[0]) return { lines: [L('usage: edit <file>', 'muted')], ok: false, name: 'edit', meta: {} };
    if (!folder) {
      return { lines: [simNote('You’re in C:\\CS1430 itself — cd into a project first.')], ok: false, name: 'edit', meta: {} };
    }
    var f = S.findFile(folder, args[0]);
    return {
      lines: [],
      ok: true, name: 'edit',
      meta: { openEditor: { fileName: args[0], isNew: !f } }
    };
  }

  /* ==========================================================================
     git dispatcher
     ========================================================================== */

  function doGit(scn, folder, args, raw) {
    var sub = args[0];
    var rest = args.slice(1);

    if (!sub || sub === '--help') {
      return {
        lines: [
          L('usage: git <command> [<args>]', 'muted'),
          L(''),
          L('Commands this simulator understands:', 'muted'),
          L('   clone, init, status, add, commit, push, pull, log,', 'muted'),
          L('   branch, switch, checkout, merge, remote', 'muted')
        ],
        ok: true, name: 'git', meta: {}
      };
    }

    // commands that work OUTSIDE a repo
    if (sub === 'clone') return gitClone(scn, rest);
    if (sub === 'init') return gitInit(scn, folder);

    // everything else needs to be inside a repo
    if (!folder || !folder.isRepo) {
      return { lines: [L(NOT_A_REPO, 'err')], ok: false, name: 'git ' + sub, meta: { notARepo: true } };
    }

    switch (sub) {
      case 'status': return gitStatus(folder);
      case 'add': return gitAdd(folder, rest);
      case 'commit': return gitCommit(folder, rest);
      case 'push': return gitPush(folder, rest);
      case 'pull': return gitPull(folder, rest);
      case 'log': return gitLog(folder, rest);
      case 'branch': return gitBranch(folder, rest);
      case 'switch': return gitSwitch(folder, rest);
      case 'checkout': return gitCheckout(folder, rest);
      case 'merge': return gitMerge(folder, rest);
      case 'remote': return gitRemote(folder, rest);
      default:
        return {
          lines: [L("git: '" + sub + "' is not a git command. See 'git --help'.", 'err')],
          ok: false, name: 'git ' + sub, meta: {}
        };
    }
  }

  /* ---- git clone --------------------------------------------------------- */

  function gitClone(scn, rest) {
    var url = rest[0];
    if (!url) {
      return {
        lines: [L('fatal: You must specify a repository to clone.', 'err'), L(''), L('usage: git clone <repository>', 'muted')],
        ok: false, name: 'git clone', meta: {}
      };
    }
    if (scn.cwd !== '~') {
      return {
        lines: [simNote('Clone from C:\\CS1430, not from inside another project. Type cd .. to go back up.')],
        ok: false, name: 'git clone', meta: {}
      };
    }
    // find the fake remote repo: exact URL, or forgiving match on repo name
    var repo = scn.remoteRepos[url] || null;
    if (!repo) {
      Object.keys(scn.remoteRepos).forEach(function (key) {
        var name = scn.remoteRepos[key].name;
        if (url.indexOf('/' + name + '.git') !== -1 || url === name + '.git') repo = scn.remoteRepos[key];
      });
    }
    if (!repo) {
      return {
        lines: [
          L("Cloning into '" + guessName(url) + "'..."),
          L('remote: Repository not found.', 'err'),
          L("fatal: repository '" + url + "' not found", 'err')
        ],
        ok: false, name: 'git clone', meta: {}
      };
    }
    if (scn.folders[repo.name]) {
      return {
        lines: [L("fatal: destination path '" + repo.name + "' already exists and is not an empty directory.", 'err')],
        ok: false, name: 'git clone', meta: {}
      };
    }

    var files = repo.files.map(function (f) { return S.makeFile(f.name, f.content, 'clean', true); });
    var commits = repo.commits.slice();
    scn.folders[repo.name] = {
      name: repo.name,
      isRepo: true,
      branch: 'main',
      branches: ['main'],
      files: files,
      commitsByBranch: { main: commits.slice() },
      remote: { name: 'origin', url: repo.url },
      remoteBranches: { main: commits.slice() },
      upstreams: { main: true },
      merge: null,
      branchFiles: {},
      preMergeSnapshot: null
    };

    var n = 4 + commits.length * 3;
    return {
      lines: [
        L("Cloning into '" + repo.name + "'..."),
        L('remote: Enumerating objects: ' + n + ', done.'),
        L('remote: Counting objects: 100% (' + n + '/' + n + '), done.'),
        L('remote: Compressing objects: 100% (' + (n - 3) + '/' + (n - 3) + '), done.'),
        L('remote: Total ' + n + ' (delta 2), reused ' + n + ' (delta 2), pack-reused 0'),
        L('Receiving objects: 100% (' + n + '/' + n + '), ' + kb() + ' KiB | ' + kb() + ' MiB/s, done.'),
        L('Resolving deltas: 100% (2/2), done.')
      ],
      ok: true, name: 'git clone', meta: { cloned: repo.name }
    };
  }

  function guessName(url) {
    var m = url.match(/\/([^\/]+?)(\.git)?$/);
    return m ? m[1] : url;
  }

  /* ---- git init ----------------------------------------------------------- */

  function gitInit(scn, folder) {
    if (!folder) {
      return {
        lines: [simNote('Careful — you’re in C:\\CS1430 itself. Running git init here would turn the WHOLE course folder into a repo. cd into your project first.')],
        ok: false, name: 'git init', meta: {}
      };
    }
    if (folder.isRepo) {
      return {
        lines: [L('Reinitialized existing Git repository in C:/CS1430/' + folder.name + '/.git/')],
        ok: true, name: 'git init', meta: { reinit: true }
      };
    }
    folder.isRepo = true;
    folder.branch = 'master'; // real default until they run git branch -M main
    folder.branches = ['master'];
    folder.commitsByBranch = { master: [] };
    folder.files.forEach(function (f) { f.status = 'untracked'; f.everCommitted = false; });
    return {
      lines: [
        L("hint: Using 'master' as the name for the initial branch. This default branch name", 'muted'),
        L('hint: is subject to change. To configure the initial branch name to use in all', 'muted'),
        L('hint: of your new repositories, call:', 'muted'),
        L('hint:', 'muted'),
        L('hint: \tgit config --global init.defaultBranch main', 'muted'),
        L('Initialized empty Git repository in C:/CS1430/' + folder.name + '/.git/')
      ],
      ok: true, name: 'git init', meta: { init: true }
    };
  }

  /* ---- git status --------------------------------------------------------- */

  function gitStatus(folder) {
    var lines = [];
    var commits = S.localCommits(folder);
    var staged = folder.files.filter(function (f) { return f.status === 'staged'; });
    var modified = folder.files.filter(function (f) { return f.status === 'modified'; });
    var untracked = folder.files.filter(function (f) { return f.status === 'untracked'; });
    var conflicted = folder.files.filter(function (f) { return f.status === 'conflicted'; });

    lines.push(L('On branch ' + folder.branch));

    if (folder.merge) {
      if (conflicted.length) {
        lines.push(L('You have unmerged paths.'));
        lines.push(L('  (fix conflicts and run "git commit")', 'muted'));
        lines.push(L('  (use "git merge --abort" to abort the merge)', 'muted'));
        lines.push(L(''));
        lines.push(L('Unmerged paths:'));
        lines.push(L('  (use "git add <file>..." to mark resolution)', 'muted'));
        conflicted.forEach(function (f) { lines.push(L('\tboth modified:   ' + f.name, 'err')); });
        lines.push(L(''));
        lines.push(L('no changes added to commit (use "git add" and/or "git commit -a")'));
        return { lines: lines, ok: true, name: 'git status', meta: { conflict: true } };
      }
      lines.push(L('All conflicts fixed but you are still merging.'));
      lines.push(L('  (use "git commit" to conclude merge)', 'muted'));
      lines.push(L(''));
      lines.push(L('Changes to be committed:'));
      staged.forEach(function (f) { lines.push(L('\tmodified:   ' + f.name, 'ok')); });
      return { lines: lines, ok: true, name: 'git status', meta: { merging: true } };
    }

    if (!commits.length) {
      lines.push(L(''));
      lines.push(L('No commits yet'));
    } else if (folder.remote && folder.upstreams[folder.branch]) {
      var ahead = S.aheadCount(folder);
      var behind = S.behindCount(folder);
      if (ahead === 0 && behind === 0) {
        lines.push(L("Your branch is up to date with 'origin/" + folder.branch + "'."));
      } else if (ahead > 0 && behind === 0) {
        lines.push(L("Your branch is ahead of 'origin/" + folder.branch + "' by " + ahead + ' commit' + (ahead === 1 ? '' : 's') + '.'));
        lines.push(L('  (use "git push" to publish your local commits)', 'muted'));
      } else if (behind > 0 && ahead === 0) {
        lines.push(L("Your branch is behind 'origin/" + folder.branch + "' by " + behind + ' commit' + (behind === 1 ? '' : 's') + ', and can be fast-forwarded.'));
        lines.push(L('  (use "git pull" to update your local branch)', 'muted'));
      } else {
        lines.push(L("Your branch and 'origin/" + folder.branch + "' have diverged."));
      }
    }

    var printedSomething = false;

    if (staged.length) {
      lines.push(L(''));
      lines.push(L('Changes to be committed:'));
      lines.push(L('  (use "git restore --staged <file>..." to unstage)', 'muted'));
      staged.forEach(function (f) {
        lines.push(L('\t' + (f.everCommitted ? 'modified:   ' : 'new file:   ') + f.name, 'ok'));
      });
      printedSomething = true;
    }

    if (modified.length) {
      lines.push(L(''));
      lines.push(L('Changes not staged for commit:'));
      lines.push(L('  (use "git add <file>..." to update what will be committed)', 'muted'));
      lines.push(L('  (use "git restore <file>..." to discard changes in working directory)', 'muted'));
      modified.forEach(function (f) { lines.push(L('\tmodified:   ' + f.name, 'err')); });
      printedSomething = true;
    }

    if (untracked.length) {
      lines.push(L(''));
      lines.push(L('Untracked files:'));
      lines.push(L('  (use "git add <file>..." to include in what will be committed)', 'muted'));
      untracked.forEach(function (f) { lines.push(L('\t' + f.name, 'err')); });
      printedSomething = true;
    }

    lines.push(L(''));
    if (!printedSomething) {
      lines.push(L('nothing to commit, working tree clean'));
    } else if (!staged.length && untracked.length && !modified.length) {
      lines.push(L('nothing added to commit but untracked files present (use "git add" to track)'));
    } else if (!staged.length && modified.length) {
      lines.push(L('no changes added to commit (use "git add" and/or "git commit -a")'));
    } else {
      lines.pop(); // staged changes exist: no trailing summary line
    }

    return { lines: lines, ok: true, name: 'git status', meta: {} };
  }

  /* ---- git add ------------------------------------------------------------ */

  function gitAdd(folder, rest) {
    if (!rest.length) {
      return {
        lines: [
          L('Nothing specified, nothing added.'),
          L("hint: Maybe you wanted to say 'git add .'?", 'muted')
        ],
        ok: false, name: 'git add', meta: {}
      };
    }

    var stagedNow = [];
    var warnings = [];

    if (rest[0] === '.' || rest[0] === '-A' || rest[0] === '--all') {
      folder.files.forEach(function (f) {
        if (stageFile(f)) stagedNow.push(f.name);
        if (f.status === 'staged' && hasConflictMarkers(f)) warnings.push(f.name);
      });
      return {
        lines: warnings.map(function (n) {
          return simNote('heads-up: ' + n + ' still contains <<<<<<< conflict markers. Real Git would let you commit them anyway — and break your code. Edit the file first!');
        }),
        ok: true, name: 'git add', meta: { all: true, staged: stagedNow }
      };
    }

    // named files
    var lines = [];
    var anyFail = false;
    rest.forEach(function (name) {
      var f = S.findFile(folder, name);
      if (!f) {
        lines.push(L("fatal: pathspec '" + name + "' did not match any files", 'err'));
        anyFail = true;
      } else {
        if (stageFile(f)) stagedNow.push(f.name);
        if (hasConflictMarkers(f)) {
          lines.push(simNote('heads-up: ' + name + ' still contains <<<<<<< conflict markers. Edit the file before committing!'));
        }
      }
    });
    return { lines: lines, ok: !anyFail, name: 'git add', meta: { staged: stagedNow } };
  }

  function stageFile(f) {
    if (f.status === 'untracked') { f.status = 'staged'; f.wasNew = true; return true; }
    if (f.status === 'modified' || f.status === 'conflicted') { f.status = 'staged'; return true; }
    return false;
  }

  function hasConflictMarkers(f) {
    return f.content.indexOf('<<<<<<<') !== -1;
  }

  /* ---- git commit ---------------------------------------------------------- */

  function gitCommit(folder, rest) {
    var conflicted = S.conflictedFiles(folder);
    if (folder.merge && conflicted.length) {
      return {
        lines: [
          L('error: Committing is not possible because you have unmerged files.', 'err'),
          L("hint: Fix them up in the work tree, and then use 'git add <file>'", 'muted'),
          L('hint: as appropriate to mark resolution and make a commit.', 'muted'),
          L('fatal: Exiting because of an unresolved conflict.', 'err')
        ],
        ok: false, name: 'git commit', meta: { unresolvedConflict: true }
      };
    }

    // parse -m "message"
    var message = null;
    var mIndex = rest.indexOf('-m');
    if (mIndex !== -1) {
      message = rest[mIndex + 1];
      if (message === undefined) {
        return {
          lines: [L("error: switch 'm' requires a value", 'err')],
          ok: false, name: 'git commit', meta: {}
        };
      }
      var extra = rest.slice(mIndex + 2);
      if (extra.length) {
        return {
          lines: [
            L('error: pathspec \'' + extra[0] + '\' did not match any file(s) known to git', 'err'),
            simNote('It looks like your message wasn’t wrapped in quotes, so Git read “' + extra[0] + '” as a file name. Put the whole message inside "quotes".')
          ],
          ok: false, name: 'git commit', meta: { unquotedMessage: true }
        };
      }
    }

    var staged = S.stagedFiles(folder);

    // concluding a merge
    if (folder.merge) {
      var mergedBranch = folder.merge.branch;
      var msg = message || ("Merge branch '" + mergedBranch + "'");
      var lines = [];
      if (!message) lines.push(simNote('Real Git would open an editor with a pre-filled merge message here. Using: "' + msg + '"'));
      var mergeCommit = S.makeCommit(msg, {
        touched: staged.map(function (f) { return f.name; }),
        insertions: 1,
        isMerge: true
      });
      // main gets the feature branch's unique commits, then the merge commit
      var cur = folder.commitsByBranch[folder.branch];
      var theirs = folder.commitsByBranch[mergedBranch] || [];
      theirs.forEach(function (c) {
        if (!cur.some(function (x) { return x.hash === c.hash; })) cur.push(c);
      });
      cur.push(mergeCommit);
      staged.forEach(function (f) { f.status = 'clean'; f.everCommitted = true; f.wasNew = false; });
      folder.merge = null;
      folder.preMergeSnapshot = null;
      lines.push(L('[' + folder.branch + ' ' + mergeCommit.hash + '] ' + msg));
      return { lines: lines, ok: true, name: 'git commit', meta: { mergeCommit: true, message: msg } };
    }

    if (message === null && rest.length === 0) {
      return {
        lines: [
          simNote('Real Git would pop open a text editor here and wait for you to type a message — which confuses everyone the first time.'),
          simNote('Use the -m flag instead:  git commit -m "what you changed"')
        ],
        ok: false, name: 'git commit', meta: { missingM: true }
      };
    }

    if (!staged.length) {
      // mirror git: print a status-flavored explanation
      var st = gitStatus(folder);
      return { lines: st.lines, ok: false, name: 'git commit', meta: { nothingStaged: true } };
    }

    var isRoot = S.localCommits(folder).length === 0;
    var newFiles = staged.filter(function (f) { return f.wasNew; });
    var insertions = staged.length * (2 + Math.floor(Math.random() * 6));
    var commit = S.makeCommit(message, {
      touched: staged.map(function (f) { return f.name; }),
      insertions: insertions
    });
    folder.commitsByBranch[folder.branch].push(commit);

    var out = [];
    out.push(L('[' + folder.branch + (isRoot ? ' (root-commit)' : '') + ' ' + commit.hash + '] ' + message));
    out.push(L(' ' + staged.length + ' file' + (staged.length === 1 ? '' : 's') + ' changed, ' + insertions + ' insertions(+)'));
    newFiles.forEach(function (f) {
      out.push(L(' create mode 100644 ' + f.name));
    });

    staged.forEach(function (f) { f.status = 'clean'; f.everCommitted = true; f.wasNew = false; });

    return { lines: out, ok: true, name: 'git commit', meta: { committed: true, message: message, root: isRoot } };
  }

  /* ---- git push ------------------------------------------------------------ */

  function gitPush(folder, rest) {
    var setUpstream = false;
    var args = rest.slice();
    var uIdx = args.indexOf('-u');
    if (uIdx === -1) uIdx = args.indexOf('--set-upstream');
    if (uIdx !== -1) { setUpstream = true; args.splice(uIdx, 1); }
    var remoteName = args[0]; // e.g. origin
    var branchName = args[1]; // e.g. main

    if (!folder.remote) {
      return {
        lines: [
          L('fatal: No configured push destination.', 'err'),
          L('Either specify the URL from the command-line or configure a remote repository using', 'muted'),
          L('', 'muted'),
          L('    git remote add <name> <url>', 'muted'),
          L('', 'muted'),
          L('and then push using the remote name', 'muted'),
          L('', 'muted'),
          L('    git push <name>', 'muted')
        ],
        ok: false, name: 'git push', meta: { noRemote: true }
      };
    }

    if (remoteName && remoteName !== 'origin') {
      return {
        lines: [
          L("fatal: '" + remoteName + "' does not appear to be a git repository", 'err'),
          L('fatal: Could not read from remote repository.', 'err')
        ],
        ok: false, name: 'git push', meta: {}
      };
    }

    if (branchName && folder.branches.indexOf(branchName) === -1) {
      return {
        lines: [
          L('error: src refspec ' + branchName + ' does not match any', 'err'),
          L("error: failed to push some refs to '" + folder.remote.url + "'", 'err')
        ],
        ok: false, name: 'git push', meta: {}
      };
    }

    if (branchName && branchName !== folder.branch) {
      return {
        lines: [simNote('You’re on branch ‘' + folder.branch + '’ but tried to push ‘' + branchName + '’. Push the branch you’re standing on.')],
        ok: false, name: 'git push', meta: {}
      };
    }

    var explicit = !!(remoteName && branchName);
    if (!explicit && !folder.upstreams[folder.branch]) {
      return {
        lines: [
          L('fatal: The current branch ' + folder.branch + ' has no upstream branch.', 'err'),
          L('To push the current branch and set the remote as upstream, use', 'muted'),
          L('', 'muted'),
          L('    git push --set-upstream origin ' + folder.branch, 'muted'),
          L('', 'muted'),
          simNote('The short version of --set-upstream is -u, so:  git push -u origin ' + folder.branch)
        ],
        ok: false, name: 'git push', meta: { noUpstream: true }
      };
    }

    var local = S.localCommits(folder);
    if (!local.length) {
      return {
        lines: [
          L('error: src refspec ' + folder.branch + ' does not match any', 'err'),
          L("error: failed to push some refs to '" + folder.remote.url + "'", 'err'),
          simNote('There are no commits yet — nothing exists to push. Commit first.')
        ],
        ok: false, name: 'git push', meta: { noCommits: true }
      };
    }

    var behind = S.behindCount(folder);
    if (behind > 0) {
      return {
        lines: [
          L("To " + folder.remote.url),
          L(' ! [rejected]        ' + folder.branch + ' -> ' + folder.branch + ' (fetch first)', 'err'),
          L("error: failed to push some refs to '" + folder.remote.url + "'", 'err'),
          L('hint: Updates were rejected because the remote contains work that you do not', 'muted'),
          L('hint: have locally. This is usually caused by another repository pushing to', 'muted'),
          L('hint: the same ref. You may want to first integrate the remote changes', 'muted'),
          L("hint: (e.g., 'git pull ...') before pushing again.", 'muted')
        ],
        ok: false, name: 'git push', meta: { rejected: true }
      };
    }

    var ahead = S.aheadCount(folder);
    var remoteExisting = S.remoteCommits(folder);
    var isNewBranch = !remoteExisting || !remoteExisting.length;

    if (!ahead && !isNewBranch) {
      return { lines: [L('Everything up-to-date')], ok: true, name: 'git push', meta: { upToDate: true } };
    }

    var oldTip = (remoteExisting && remoteExisting.length) ? remoteExisting[remoteExisting.length - 1].hash : null;
    folder.remoteBranches[folder.branch] = local.slice();
    if (setUpstream) folder.upstreams[folder.branch] = true;

    var newTip = local[local.length - 1].hash;
    var n = Math.max(3, ahead * 3);
    var lines = [
      L('Enumerating objects: ' + n + ', done.'),
      L('Counting objects: 100% (' + n + '/' + n + '), done.'),
      L('Delta compression using up to 8 threads'),
      L('Compressing objects: 100% (' + Math.max(2, n - 2) + '/' + Math.max(2, n - 2) + '), done.'),
      L('Writing objects: 100% (' + n + '/' + n + '), ' + (Math.random() * 900 + 200).toFixed(0) + ' bytes | ' + (Math.random() * 900 + 200).toFixed(0) + '.00 KiB/s, done.'),
      L('Total ' + n + ' (delta 1), reused 0 (delta 0), pack-reused 0'),
      L('To ' + folder.remote.url)
    ];
    if (isNewBranch) {
      lines.push(L(' * [new branch]      ' + folder.branch + ' -> ' + folder.branch, 'ok'));
    } else {
      lines.push(L('   ' + oldTip + '..' + newTip + '  ' + folder.branch + ' -> ' + folder.branch, 'ok'));
    }
    if (setUpstream) {
      lines.push(L("branch '" + folder.branch + "' set up to track 'origin/" + folder.branch + "'."));
    }
    return {
      lines: lines, ok: true, name: 'git push',
      meta: { pushed: Math.max(ahead, 1), setUpstream: setUpstream, newBranch: isNewBranch }
    };
  }

  /* ---- git pull -------------------------------------------------------------- */

  function gitPull(folder, rest) {
    if (!folder.remote || !folder.upstreams[folder.branch]) {
      return {
        lines: [
          L('There is no tracking information for the current branch.', 'err'),
          L('Please specify which branch you want to merge with.', 'muted'),
          L('See git-pull(1) for details.', 'muted'),
          L('', 'muted'),
          L('    git pull <remote> <branch>', 'muted')
        ],
        ok: false, name: 'git pull', meta: { noUpstream: true }
      };
    }

    var behind = S.behindCount(folder);
    if (behind === 0) {
      return { lines: [L('Already up to date.')], ok: true, name: 'git pull', meta: { upToDate: true } };
    }

    var local = folder.commitsByBranch[folder.branch];
    var rem = S.remoteCommits(folder);
    var newCommits = rem.slice(rem.length - behind);
    var oldTip = local.length ? local[local.length - 1].hash : '0000000';

    var changedFiles = [];
    var insertions = 0;
    newCommits.forEach(function (c) {
      local.push(c);
      insertions += c.insertions;
      if (c.fileUpdates) {
        Object.keys(c.fileUpdates).forEach(function (name) {
          var f = S.findFile(folder, name);
          if (f) { f.content = c.fileUpdates[name]; }
          else { folder.files.push(S.makeFile(name, c.fileUpdates[name], 'clean', true)); }
          if (changedFiles.indexOf(name) === -1) changedFiles.push(name);
        });
      }
      c.touched.forEach(function (name) {
        if (changedFiles.indexOf(name) === -1) changedFiles.push(name);
      });
      // keep the branch's known-good content in sync for merge conflicts later
      if (folder.branchFiles[folder.branch] && c.fileUpdates) {
        Object.keys(c.fileUpdates).forEach(function (name) {
          folder.branchFiles[folder.branch][name] = c.fileUpdates[name];
        });
      }
    });
    var newTip = local[local.length - 1].hash;

    var n = behind * 3;
    var lines = [
      L('remote: Enumerating objects: ' + (n + 1) + ', done.'),
      L('remote: Counting objects: 100% (' + (n + 1) + '/' + (n + 1) + '), done.'),
      L('remote: Compressing objects: 100% (' + n + '/' + n + '), done.'),
      L('remote: Total ' + n + ' (delta 1), reused ' + n + ' (delta 1), pack-reused 0'),
      L('Unpacking objects: 100% (' + n + '/' + n + '), ' + kb() + ' KiB | ' + (Math.random() * 400 + 100).toFixed(0) + '.00 KiB/s, done.'),
      L('From ' + folder.remote.url.replace(/\.git$/, '')),
      L('   ' + oldTip + '..' + newTip + '  ' + folder.branch + '     -> origin/' + folder.branch),
      L('Updating ' + oldTip + '..' + newTip),
      L('Fast-forward')
    ];
    statLines(changedFiles, insertions).forEach(function (l) { lines.push(l); });

    return { lines: lines, ok: true, name: 'git pull', meta: { pulled: behind } };
  }

  /* ---- git log ------------------------------------------------------------- */

  function gitLog(folder, rest) {
    var commits = S.localCommits(folder);
    if (!commits.length) {
      return {
        lines: [L("fatal: your current branch '" + folder.branch + "' does not have any commits yet", 'err')],
        ok: false, name: 'git log', meta: {}
      };
    }

    var oneline = rest.indexOf('--oneline') !== -1;
    var lines = [];
    var reversed = commits.slice().reverse();

    reversed.forEach(function (c, i) {
      var refs = decorations(folder, c.hash, i === 0);
      if (oneline) {
        lines.push(L(c.hash + (refs ? ' (' + refs + ')' : '') + ' ' + c.message, refs ? 'branch' : ''));
      } else {
        lines.push(L('commit ' + longHash(c.hash) + (refs ? ' (' + refs + ')' : ''), 'warn'));
        lines.push(L('Author: ' + (c.author === 'you' ? 'Student <student@example.edu>' : c.author + ' <' + c.author + '@example.edu>')));
        lines.push(L('Date:   ' + fakeDate(i, reversed.length)));
        lines.push(L(''));
        lines.push(L('    ' + c.message));
        lines.push(L(''));
      }
    });

    return { lines: lines, ok: true, name: 'git log', meta: { oneline: oneline } };
  }

  function decorations(folder, hash, isTip) {
    var refs = [];
    if (isTip) refs.push('HEAD -> ' + folder.branch);
    folder.branches.forEach(function (b) {
      if (b === folder.branch) return;
      var arr = folder.commitsByBranch[b];
      if (arr && arr.length && arr[arr.length - 1].hash === hash) refs.push(b);
    });
    if (folder.remote) {
      Object.keys(folder.remoteBranches).forEach(function (b) {
        var arr = folder.remoteBranches[b];
        if (arr && arr.length && arr[arr.length - 1].hash === hash) refs.push('origin/' + b);
      });
    }
    return refs.join(', ');
  }

  function fakeDate(indexFromTip, total) {
    var d = new Date(Date.now() - indexFromTip * 86400000 * 2);
    return d.toDateString() + ' 14:0' + (indexFromTip % 10) + ':22 2026 -0500';
  }

  /* ---- git branch ------------------------------------------------------------ */

  function gitBranch(folder, rest) {
    // list
    if (!rest.length) {
      if (!S.localCommits(folder).length && folder.branches.length <= 1) {
        return { lines: [], ok: true, name: 'git branch', meta: { listed: true, empty: true } };
      }
      var lines = folder.branches.slice().sort().map(function (b) {
        return b === folder.branch ? L('* ' + b, 'ok') : L('  ' + b);
      });
      return { lines: lines, ok: true, name: 'git branch', meta: { listed: true } };
    }

    // rename: git branch -M <name>
    if (rest[0] === '-M' || rest[0] === '-m') {
      var newName = rest[1];
      if (!newName) {
        return { lines: [L('fatal: branch name required', 'err')], ok: false, name: 'git branch', meta: {} };
      }
      if (!S.localCommits(folder).length) {
        return {
          lines: [
            L('error: refname refs/heads/' + folder.branch + ' not found', 'err'),
            L('fatal: Branch rename failed', 'err'),
            simNote('You can’t rename a branch before it has at least one commit. Commit first, then rename.')
          ],
          ok: false, name: 'git branch', meta: {}
        };
      }
      var oldName = folder.branch;
      if (oldName === newName) {
        return { lines: [], ok: true, name: 'git branch', meta: { renamed: newName, from: oldName } };
      }
      folder.commitsByBranch[newName] = folder.commitsByBranch[oldName];
      delete folder.commitsByBranch[oldName];
      folder.branches[folder.branches.indexOf(oldName)] = newName;
      if (folder.upstreams[oldName]) {
        folder.upstreams[newName] = true;
        delete folder.upstreams[oldName];
      }
      if (folder.branchFiles[oldName]) {
        folder.branchFiles[newName] = folder.branchFiles[oldName];
        delete folder.branchFiles[oldName];
      }
      folder.branch = newName;
      return { lines: [], ok: true, name: 'git branch', meta: { renamed: newName, from: oldName } };
    }

    // delete: git branch -d <name>
    if (rest[0] === '-d' || rest[0] === '-D') {
      var name = rest[1];
      if (!name) return { lines: [L('fatal: branch name required', 'err')], ok: false, name: 'git branch', meta: {} };
      if (folder.branches.indexOf(name) === -1) {
        return { lines: [L("error: branch '" + name + "' not found.", 'err')], ok: false, name: 'git branch', meta: {} };
      }
      if (name === folder.branch) {
        return {
          lines: [L("error: cannot delete branch '" + name + "' used by worktree at 'C:/CS1430/" + folder.name + "'", 'err'),
            simNote('You can’t delete the branch you’re standing on. Switch to another branch first.')],
          ok: false, name: 'git branch', meta: {}
        };
      }
      var target = folder.commitsByBranch[name] || [];
      var cur = S.localCommits(folder);
      var merged = target.every(function (c) {
        return cur.some(function (x) { return x.hash === c.hash; });
      });
      if (!merged && rest[0] === '-d') {
        return {
          lines: [
            L("error: the branch '" + name + "' is not fully merged.", 'err'),
            L("hint: If you are sure you want to delete it, run 'git branch -D " + name + "'.", 'muted')
          ],
          ok: false, name: 'git branch', meta: {}
        };
      }
      var tip = target.length ? target[target.length - 1].hash : '0000000';
      folder.branches.splice(folder.branches.indexOf(name), 1);
      delete folder.commitsByBranch[name];
      delete folder.branchFiles[name];
      delete folder.upstreams[name];
      return {
        lines: [L('Deleted branch ' + name + ' (was ' + tip + ').')],
        ok: true, name: 'git branch', meta: { deleted: name }
      };
    }

    // create: git branch <name>
    var createName = rest[0];
    if (folder.branches.indexOf(createName) !== -1) {
      return {
        lines: [L("fatal: a branch named '" + createName + "' already exists", 'err')],
        ok: false, name: 'git branch', meta: {}
      };
    }
    if (!S.localCommits(folder).length) {
      return {
        lines: [L("fatal: not a valid object name: '" + folder.branch + "'", 'err'),
          simNote('Branches point at commits, and there are no commits yet. Make your first commit, then branch.')],
        ok: false, name: 'git branch', meta: {}
      };
    }
    folder.branches.push(createName);
    folder.commitsByBranch[createName] = S.localCommits(folder).slice();
    return { lines: [], ok: true, name: 'git branch', meta: { created: createName } };
  }

  /* ---- git switch / checkout --------------------------------------------------- */

  function gitSwitch(folder, rest) {
    var create = false;
    var args = rest.slice();
    var cIdx = args.indexOf('-c');
    if (cIdx !== -1) { create = true; args.splice(cIdx, 1); }
    var name = args[0];
    if (!name) {
      return { lines: [L('fatal: missing branch or commit argument', 'err')], ok: false, name: 'git switch', meta: {} };
    }
    return switchTo(folder, name, create, 'git switch');
  }

  function gitCheckout(folder, rest) {
    var create = false;
    var args = rest.slice();
    var bIdx = args.indexOf('-b');
    if (bIdx !== -1) { create = true; args.splice(bIdx, 1); }
    var name = args[0];
    if (!name) {
      return { lines: [L("error: you must specify a branch", 'err')], ok: false, name: 'git checkout', meta: {} };
    }
    return switchTo(folder, name, create, 'git checkout');
  }

  function switchTo(folder, name, create, cmdName) {
    if (folder.merge) {
      return {
        lines: [L('fatal: cannot switch branches in the middle of a merge — resolve the conflict or run git merge --abort', 'err')],
        ok: false, name: cmdName, meta: {}
      };
    }
    var exists = folder.branches.indexOf(name) !== -1;

    if (create) {
      if (exists) {
        return {
          lines: [L("fatal: a branch named '" + name + "' already exists", 'err')],
          ok: false, name: cmdName, meta: {}
        };
      }
      folder.branches.push(name);
      folder.commitsByBranch[name] = S.localCommits(folder).slice();
      folder.branch = name;
      return {
        lines: [L("Switched to a new branch '" + name + "'")],
        ok: true, name: cmdName, meta: { switched: name, created: true }
      };
    }

    if (!exists) {
      return {
        lines: [L('fatal: invalid reference: ' + name, 'err')],
        ok: false, name: cmdName, meta: {}
      };
    }
    if (name === folder.branch) {
      return {
        lines: [L("Already on '" + name + "'")],
        ok: true, name: cmdName, meta: { switched: name, already: true }
      };
    }

    // dirty working tree keeps it simple: block like git does when it would clobber
    var dirty = folder.files.some(function (f) { return f.status === 'modified' || f.status === 'staged'; });
    if (dirty) {
      return {
        lines: [
          L('error: Your local changes to the following files would be overwritten by checkout:', 'err'),
          L('\t' + folder.files.filter(function (f) { return f.status !== 'clean' && f.status !== 'untracked'; })
            .map(function (f) { return f.name; }).join('\n\t'), 'err'),
          L('Please commit your changes or stash them before you switch branches.', 'muted')
        ],
        ok: false, name: cmdName, meta: { dirtyBlock: true }
      };
    }

    folder.branch = name;
    // apply that branch's version of any seeded per-branch file contents
    var overrides = folder.branchFiles[name];
    if (overrides) {
      Object.keys(overrides).forEach(function (fname) {
        var f = S.findFile(folder, fname);
        if (f) { f.content = overrides[fname]; f.status = 'clean'; }
      });
    }

    var lines = [L("Switched to branch '" + name + "'")];
    if (folder.remote && folder.upstreams[name]) {
      var behind = S.behindCount(folder);
      var ahead = S.aheadCount(folder);
      if (!behind && !ahead) {
        lines.push(L("Your branch is up to date with 'origin/" + name + "'."));
      } else if (behind && !ahead) {
        lines.push(L("Your branch is behind 'origin/" + name + "' by " + behind + ' commit' + (behind === 1 ? '' : 's') + ', and can be fast-forwarded.'));
        lines.push(L('  (use "git pull" to update your local branch)', 'muted'));
      } else if (ahead && !behind) {
        lines.push(L("Your branch is ahead of 'origin/" + name + "' by " + ahead + ' commit' + (ahead === 1 ? '' : 's') + '.'));
      }
    }
    return { lines: lines, ok: true, name: cmdName, meta: { switched: name } };
  }

  /* ---- git merge ------------------------------------------------------------------ */

  function gitMerge(folder, rest) {
    if (rest[0] === '--abort') {
      if (!folder.merge) {
        return {
          lines: [L('fatal: There is no merge to abort (MERGE_HEAD missing).', 'err')],
          ok: false, name: 'git merge', meta: {}
        };
      }
      if (folder.preMergeSnapshot) {
        folder.files = folder.preMergeSnapshot;
        folder.preMergeSnapshot = null;
      }
      folder.merge = null;
      return { lines: [], ok: true, name: 'git merge', meta: { aborted: true } };
    }

    if (folder.merge) {
      return {
        lines: [
          L('error: Merging is not possible because you have unmerged files.', 'err'),
          L("hint: Fix them up in the work tree, and then use 'git add <file>'", 'muted'),
          L('fatal: Exiting because of an unresolved conflict.', 'err')
        ],
        ok: false, name: 'git merge', meta: {}
      };
    }

    var name = rest[0];
    if (!name) {
      return {
        lines: [L('fatal: No remote for the current branch.', 'err'), simNote('Tell git WHAT to merge:  git merge <branch-name>')],
        ok: false, name: 'git merge', meta: {}
      };
    }
    if (folder.branches.indexOf(name) === -1) {
      return {
        lines: [L('merge: ' + name + ' - not something we can merge', 'err')],
        ok: false, name: 'git merge', meta: {}
      };
    }
    if (name === folder.branch) {
      return { lines: [L('Already up to date.')], ok: true, name: 'git merge', meta: { upToDate: true } };
    }

    var cur = S.localCommits(folder);
    var theirs = folder.commitsByBranch[name] || [];
    var curHashes = {};
    cur.forEach(function (c) { curHashes[c.hash] = true; });
    var theirUnique = theirs.filter(function (c) { return !curHashes[c.hash]; });

    if (!theirUnique.length) {
      return { lines: [L('Already up to date.')], ok: true, name: 'git merge', meta: { upToDate: true } };
    }

    var theirHashes = {};
    theirs.forEach(function (c) { theirHashes[c.hash] = true; });
    var ourUnique = cur.filter(function (c) { return !theirHashes[c.hash]; });

    // conflict detection: both sides' unique commits touched the same file
    var oursTouched = {};
    ourUnique.forEach(function (c) { c.touched.forEach(function (n) { oursTouched[n] = true; }); });
    var conflictFiles = [];
    theirUnique.forEach(function (c) {
      c.touched.forEach(function (n) {
        if (oursTouched[n] && conflictFiles.indexOf(n) === -1) conflictFiles.push(n);
      });
    });

    var overrides = folder.branchFiles[name] || {};

    if (conflictFiles.length) {
      // snapshot so --abort can restore
      folder.preMergeSnapshot = folder.files.map(function (f) {
        return S.makeFile(f.name, f.content, f.status, f.everCommitted);
      });
      var lines = [];
      conflictFiles.forEach(function (fname) {
        var f = S.findFile(folder, fname);
        var theirContent = overrides[fname] !== undefined ? overrides[fname] : (f ? f.content : '');
        if (f) {
          f.content = buildConflictContent(f.content, theirContent, name);
          f.status = 'conflicted';
        }
        lines.push(L('Auto-merging ' + fname));
        lines.push(L('CONFLICT (content): Merge conflict in ' + fname, 'err'));
      });
      lines.push(L('Automatic merge failed; fix conflicts and then commit the result.', 'err'));
      folder.merge = { branch: name, conflictFiles: conflictFiles };
      return { lines: lines, ok: false, name: 'git merge', meta: { conflict: true, merging: name } };
    }

    // no conflict
    var changed = [];
    var insertions = 0;
    theirUnique.forEach(function (c) {
      insertions += c.insertions;
      c.touched.forEach(function (n) { if (changed.indexOf(n) === -1) changed.push(n); });
    });
    Object.keys(overrides).forEach(function (fname) {
      var f = S.findFile(folder, fname);
      if (f) { f.content = overrides[fname]; f.status = 'clean'; }
    });

    var fastForward = ourUnique.length === 0;
    var out = [];
    if (fastForward) {
      var oldTip = cur.length ? cur[cur.length - 1].hash : '0000000';
      theirUnique.forEach(function (c) { cur.push(c); });
      var newTip = cur[cur.length - 1].hash;
      out.push(L('Updating ' + oldTip + '..' + newTip));
      out.push(L('Fast-forward'));
    } else {
      theirUnique.forEach(function (c) { cur.push(c); });
      var mergeCommit = S.makeCommit("Merge branch '" + name + "'", { touched: changed, insertions: 0, isMerge: true });
      cur.push(mergeCommit);
      out.push(L("Merge made by the 'ort' strategy."));
    }
    statLines(changed.length ? changed : ['(files)'], Math.max(insertions, 1)).forEach(function (l) { out.push(l); });
    return { lines: out, ok: true, name: 'git merge', meta: { merged: name, fastForward: fastForward } };
  }

  /** wrap the differing middle of two versions in real conflict markers */
  function buildConflictContent(ours, theirs, theirBranch) {
    var a = ours.split('\n');
    var b = theirs.split('\n');
    var start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    var endA = a.length - 1;
    var endB = b.length - 1;
    while (endA >= start && endB >= start && a[endA] === b[endB]) { endA--; endB--; }
    var out = a.slice(0, start);
    out.push('<<<<<<< HEAD');
    out = out.concat(a.slice(start, endA + 1));
    out.push('=======');
    out = out.concat(b.slice(start, endB + 1));
    out.push('>>>>>>> ' + theirBranch);
    out = out.concat(a.slice(endA + 1));
    return out.join('\n');
  }

  /* ---- git remote ---------------------------------------------------------------- */

  function gitRemote(folder, rest) {
    if (!rest.length) {
      var lines = folder.remote ? [L(folder.remote.name)] : [];
      return { lines: lines, ok: true, name: 'git remote', meta: { listed: true } };
    }

    if (rest[0] === '-v' || rest[0] === '--verbose') {
      if (!folder.remote) {
        return { lines: [], ok: true, name: 'git remote', meta: { verbose: true, empty: true } };
      }
      return {
        lines: [
          L(folder.remote.name + '\t' + folder.remote.url + ' (fetch)'),
          L(folder.remote.name + '\t' + folder.remote.url + ' (push)')
        ],
        ok: true, name: 'git remote', meta: { verbose: true }
      };
    }

    if (rest[0] === 'add') {
      var name = rest[1];
      var url = rest[2];
      if (!name || !url) {
        return {
          lines: [L('usage: git remote add <name> <url>', 'muted')],
          ok: false, name: 'git remote', meta: {}
        };
      }
      if (folder.remote && folder.remote.name === name) {
        return {
          lines: [L('error: remote ' + name + ' already exists.', 'err')],
          ok: false, name: 'git remote', meta: {}
        };
      }
      folder.remote = { name: name, url: url };
      if (!folder.remoteBranches) folder.remoteBranches = {};
      // linking to an empty GitHub repo: remote has no commits yet
      return {
        lines: [],
        ok: true, name: 'git remote',
        meta: { added: name, url: url }
      };
    }

    return {
      lines: [L("error: Unknown subcommand: '" + rest[0] + "'", 'err')],
      ok: false, name: 'git remote', meta: {}
    };
  }

  /* ---- prompt data for the terminal ------------------------------------------------ */

  function promptParts(scn) {
    // VS Code integrated terminal on Windows: PowerShell prompt
    return { path: S.winPath(scn) };
  }

  GG.git = {
    run: run,
    promptParts: promptParts
  };
})(window.GG);
