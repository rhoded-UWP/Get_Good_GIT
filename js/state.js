/* ==========================================================================
   state.js — in-memory repository model + per-phase scenario seeds.
   No storage APIs: everything lives in JS memory for the session (spec).

   Story: a single student in a Python course builds "Age Safe", a small
   age-checking program. No teammates — when the remote is ahead, it's
   because the student pushed from the campus lab computer.
   ========================================================================== */

window.GG = window.GG || {};

(function (GG) {
  'use strict';

  var HASH_CHARS = '0123456789abcdef';

  function randHash() {
    var h = '';
    for (var i = 0; i < 7; i++) {
      h += HASH_CHARS[Math.floor(Math.random() * 16)];
    }
    return h;
  }

  /**
   * @param {string} message
   * @param {object} [opts] touched: file names, insertions, fileUpdates,
   *   isMerge, author
   */
  function makeCommit(message, opts) {
    opts = opts || {};
    return {
      hash: opts.hash || randHash(),
      message: message,
      touched: opts.touched || [],
      insertions: opts.insertions || (1 + Math.floor(Math.random() * 9)),
      fileUpdates: opts.fileUpdates || null, // {name: content} applied on pull
      isMerge: !!opts.isMerge,
      author: opts.author || 'you'
    };
  }

  function makeFile(name, content, status, everCommitted) {
    return {
      name: name,
      content: content,
      status: status, // untracked | modified | staged | clean | conflicted
      everCommitted: !!everCommitted
    };
  }

  /* ---- lookups ---------------------------------------------------------- */

  var HOME_PATH = 'C:\\CS1430';

  /** display path in Windows form, e.g. C:\CS1430\age-safe */
  function winPath(scn, extra) {
    var p = scn.cwd === '~' ? HOME_PATH : HOME_PATH + '\\' + scn.cwd.slice(2);
    return extra ? p + '\\' + extra : p;
  }

  function currentFolder(scn) {
    if (scn.cwd === '~') return null;
    return scn.folders[scn.cwd.slice(2)] || null;
  }

  function findFile(folder, name) {
    for (var i = 0; i < folder.files.length; i++) {
      if (folder.files[i].name === name) return folder.files[i];
    }
    return null;
  }

  function localCommits(folder) {
    return folder.commitsByBranch[folder.branch] || [];
  }

  function remoteCommits(folder, branch) {
    if (!folder.remote) return null;
    return folder.remoteBranches[branch || folder.branch] || null;
  }

  /** commits on local branch that the remote branch doesn't have */
  function aheadCount(folder) {
    var loc = localCommits(folder);
    var rem = remoteCommits(folder);
    if (!rem) return loc.length;
    return Math.max(0, loc.length - sharedPrefix(loc, rem));
  }

  /** commits on remote branch that local doesn't have */
  function behindCount(folder) {
    var loc = localCommits(folder);
    var rem = remoteCommits(folder);
    if (!rem) return 0;
    return Math.max(0, rem.length - sharedPrefix(loc, rem));
  }

  function sharedPrefix(a, b) {
    var n = 0;
    while (n < a.length && n < b.length && a[n].hash === b[n].hash) n++;
    return n;
  }

  function stagedFiles(folder) {
    return folder.files.filter(function (f) { return f.status === 'staged'; });
  }

  function conflictedFiles(folder) {
    return folder.files.filter(function (f) { return f.status === 'conflicted'; });
  }

  /* ---- Age Safe fake file contents --------------------------------------- */

  var C = {
    /* v1 starter: one simple if/else */
    ageSafeV1: [
      '# Age Safe — is this age safe for the ride?',
      '',
      'age = int(input("Enter your age: "))',
      '',
      'if age >= 12:',
      '    print("You may ride.")',
      'else:',
      '    print("Sorry, not yet!")',
      ''
    ].join('\n'),

    /* v2: after the lab-computer session added input validation */
    ageSafeV2: [
      '# Age Safe — is this age safe for the ride?',
      '',
      'age = int(input("Enter your age: "))',
      '',
      'if age < 0:',
      '    print("That is not a real age!")',
      'elif age >= 12:',
      '    print("You may ride.")',
      'else:',
      '    print("Sorry, not yet!")',
      ''
    ].join('\n'),

    /* complex conditionals: compound boolean tests, lives on main in ph 3/4 */
    ageSafeComplex: [
      '# Age Safe — decide what content is safe for an age',
      '',
      'age = int(input("Enter your age: "))',
      '',
      'if age > 0 and age < 13:',
      '    rating = "kids only"',
      'if age >= 13 and age < 17:',
      '    rating = "teen approved"',
      'if age >= 17:',
      '    rating = "all access"',
      '',
      'print("Age Safe rating:", rating)',
      ''
    ].join('\n'),

    /* complex version after the boundary bug-fix pushed from the lab */
    ageSafeComplexFixed: [
      '# Age Safe — decide what content is safe for an age',
      '',
      'age = int(input("Enter your age: "))',
      '',
      'if age >= 0 and age < 13:',
      '    rating = "kids only"',
      'if age >= 13 and age < 18:',
      '    rating = "teen approved"',
      'if age >= 18:',
      '    rating = "all access"',
      '',
      'print("Age Safe rating:", rating)',
      ''
    ].join('\n'),

    /* parallel conditionals (if/elif/else): the winning approach */
    ageSafeParallel: [
      '# Age Safe — decide what content is safe for an age',
      '',
      'age = int(input("Enter your age: "))',
      '',
      'if age < 0:',
      '    rating = "invalid age"',
      'elif age < 13:',
      '    rating = "kids only"',
      'elif age < 18:',
      '    rating = "teen approved"',
      'else:',
      '    rating = "all access"',
      '',
      'print("Age Safe rating:", rating)',
      ''
    ].join('\n'),

    readme: [
      '# Age Safe',
      '',
      'A tiny Python program that decides whether an age qualifies.',
      'Run it with:  python age_safe.py',
      ''
    ].join('\n'),

    agesTxt: [
      '12',
      '15',
      '8',
      '21',
      '0',
      ''
    ].join('\n')
  };

  var REPO_URL = 'https://github.com/student/age-safe.git';

  /* ---- scenario factories ------------------------------------------------
     One per phase tab. Reset = call the factory again.                     */

  function baseScenario() {
    return {
      user: 'student',
      host: 'laptop',
      cwd: '~',
      folders: {},
      remoteRepos: {}
    };
  }

  /** helper: a folder that is already a cloned, clean repo */
  function clonedRepo(name, url, files, commits) {
    var byBranch = { main: commits.slice() };
    return {
      name: name,
      isRepo: true,
      branch: 'main',
      branches: ['main'],
      files: files,
      commitsByBranch: byBranch,
      remote: { name: 'origin', url: url },
      remoteBranches: { main: commits.slice() },
      upstreams: { main: true },
      merge: null,
      branchFiles: {},
      preMergeSnapshot: null
    };
  }

  /* Phase 1A — clone your Age Safe repo, practice the basic loop */
  function seed1A() {
    var scn = baseScenario();
    var commits = [
      makeCommit('Initial commit', { touched: ['age_safe.py', 'README.md'], insertions: 12 }),
      makeCommit('Add sample test ages', { touched: ['ages.txt'], insertions: 5 })
    ];
    scn.remoteRepos[REPO_URL] = {
      name: 'age-safe',
      url: REPO_URL,
      files: [
        makeFile('age_safe.py', C.ageSafeV1, 'clean', true),
        makeFile('README.md', C.readme, 'clean', true),
        makeFile('ages.txt', C.agesTxt, 'clean', true)
      ],
      commits: commits
    };
    return scn;
  }

  /* Phase 1B — Age Safe already written locally, connect it to an empty repo */
  function seed1B() {
    var scn = baseScenario();
    scn.expectedRemoteUrl = REPO_URL;
    scn.folders['age-safe'] = {
      name: 'age-safe',
      isRepo: false,
      branch: null,
      branches: [],
      files: [
        makeFile('age_safe.py', C.ageSafeV1, 'untracked', false),
        makeFile('README.md', C.readme, 'untracked', false),
        makeFile('ages.txt', C.agesTxt, 'untracked', false)
      ],
      commitsByBranch: {},
      remote: null,
      remoteBranches: {},
      upstreams: {},
      merge: null,
      branchFiles: {},
      preMergeSnapshot: null
    };
    return scn;
  }

  /* Phase 2 — update your program: pull what you pushed from the lab computer */
  function seed2() {
    var scn = baseScenario();
    var c1 = makeCommit('Initial commit', { touched: ['age_safe.py', 'README.md'], insertions: 12 });
    var c2 = makeCommit('Add sample test ages', { touched: ['ages.txt'], insertions: 5 });
    var c3 = makeCommit('Explain how to run it in README', { touched: ['README.md'], insertions: 2 });
    var folder = clonedRepo('age-safe', REPO_URL, [
      makeFile('age_safe.py', C.ageSafeV1, 'clean', true),
      makeFile('README.md', C.readme, 'clean', true),
      makeFile('ages.txt', C.agesTxt, 'clean', true)
    ], [c1, c2, c3]);
    // yesterday, in the campus lab, you pushed a commit this laptop doesn't have
    folder.remoteBranches.main.push(
      makeCommit('Add input validation', {
        touched: ['age_safe.py'],
        insertions: 2,
        fileUpdates: { 'age_safe.py': C.ageSafeV2 }
      })
    );
    scn.folders['age-safe'] = folder;
    scn.cwd = '~/age-safe';
    return scn;
  }

  /* Phase 3 — branching: try nested and parallel conditional rewrites */
  function seed3() {
    var scn = baseScenario();
    var commits = [
      makeCommit('Initial commit', { touched: ['age_safe.py', 'README.md'], insertions: 12 }),
      makeCommit('Add sample test ages', { touched: ['ages.txt'], insertions: 5 }),
      makeCommit('Switch to content ratings (complex conditionals)', { touched: ['age_safe.py'], insertions: 8 })
    ];
    var folder = clonedRepo('age-safe', REPO_URL, [
      makeFile('age_safe.py', C.ageSafeComplex, 'clean', true),
      makeFile('README.md', C.readme, 'clean', true),
      makeFile('ages.txt', C.agesTxt, 'clean', true)
    ], commits);
    // switching back to main restores main's version of the program
    folder.branchFiles = { main: { 'age_safe.py': C.ageSafeComplex } };
    scn.folders['age-safe'] = folder;
    scn.cwd = '~/age-safe';
    return scn;
  }

  /* Phase 4 — merging: parallel conditionals won; merge them into main.
     Deliberate conflict: main got a boundary bug-fix (pushed from the lab)
     touching the same lines the parallel rewrite replaced. */
  function seed4() {
    var scn = baseScenario();
    var c1 = makeCommit('Initial commit', { touched: ['age_safe.py', 'README.md'], insertions: 12 });
    var c2 = makeCommit('Switch to content ratings (complex conditionals)', { touched: ['age_safe.py'], insertions: 8 });
    var f1 = makeCommit('Rewrite checks as parallel conditionals', {
      touched: ['age_safe.py'],
      insertions: 10
    });
    var m3 = makeCommit('Fix age boundary bug', {
      touched: ['age_safe.py'],
      insertions: 3,
      fileUpdates: { 'age_safe.py': C.ageSafeComplexFixed }
    });

    var folder = {
      name: 'age-safe',
      isRepo: true,
      branch: 'parallel-conditionals',
      branches: ['main', 'parallel-conditionals'],
      files: [
        makeFile('age_safe.py', C.ageSafeParallel, 'clean', true),
        makeFile('README.md', C.readme, 'clean', true)
      ],
      commitsByBranch: {
        main: [c1, c2],
        'parallel-conditionals': [c1, c2, f1]
      },
      remote: { name: 'origin', url: REPO_URL },
      remoteBranches: { main: [c1, c2, m3] },
      upstreams: { main: true },
      merge: null,
      // what each branch's version of the disputed file looks like
      branchFiles: {
        main: { 'age_safe.py': C.ageSafeComplex },
        'parallel-conditionals': { 'age_safe.py': C.ageSafeParallel }
      },
      preMergeSnapshot: null
    };
    scn.folders['age-safe'] = folder;
    scn.cwd = '~/age-safe';
    return scn;
  }

  GG.state = {
    randHash: randHash,
    makeCommit: makeCommit,
    makeFile: makeFile,
    winPath: winPath,
    currentFolder: currentFolder,
    findFile: findFile,
    localCommits: localCommits,
    remoteCommits: remoteCommits,
    aheadCount: aheadCount,
    behindCount: behindCount,
    stagedFiles: stagedFiles,
    conflictedFiles: conflictedFiles,
    seeds: {
      '1A': seed1A,
      '1B': seed1B,
      '2': seed2,
      '3': seed3,
      '4': seed4
    }
  };
})(window.GG);
