/* ==========================================================================
   curriculum.js — phases, skills, and checkpoint detection.
   Skills complete by observing state transitions + command metadata, not by
   string-matching what the student typed (guided, not on-rails).
   Each check receives ctx = { name, ok, meta, scenario, folder } and the
   phase's runtime scratch object.

   Course story: a single student building "Age Safe", a Python program.
   No teammates — remote changes are things YOU pushed from the lab computer.
   ========================================================================== */

window.GG = window.GG || {};

(function (GG) {
  'use strict';

  function code(s) { return '<span class="mission__code">' + s + '</span>'; }

  function snip(lines) {
    return '<pre class="mission__snippet">' + lines.join('\n') + '</pre>';
  }

  var phases = [

    /* =====================================================================
       PHASE 1 — clone your repo, learn the basic loop
       ===================================================================== */
    {
      id: '1',
      tabLabel: 'Clone & Commit',
      title: 'Start from the cloud',
      brief: 'Your <strong>Age Safe</strong> starter repo (a small Python program) is already on your GitHub account. ' +
        'Copy it down to this computer, improve the program, and push your work back up. This is the daily loop you’ll use all semester. ' +
        'Repo URL: ' + code('https://github.com/student/age_safe.git'),
      welcome: [
        'PHASE 1 — Clone & Commit',
        '',
        'Goal: copy your Age Safe repo from GitHub, list your files,',
        'program, and push your changes back up.',
        '',
        'Follow the checklist on the left. Type help to see all commands.'
      ],
      seedId: '1',
      skills: [
        {
          id: 'clone',
          label: 'git clone <url>',
          hint: 'Copy the repo down from GitHub. Type ' + code('git clone https://github.com/student/age_safe.git'),
          check: function (ctx) { return ctx.name === 'git clone' && ctx.ok && ctx.meta.cloned; }
        },
        {
          id: 'cd',
          label: 'cd age_safe',
          hint: 'Cloning made a new folder, but you’re still standing outside it. Move inside with ' + code('cd age_safe') + ' — notice the prompt changes.',
          check: function (ctx) {
            return ctx.name === 'cd' && ctx.ok && ctx.folder && ctx.folder.name === 'age_safe';
          }
        },
        {
          id: 'ls',
          label: 'dir  (or ls)',
          hint: 'See what you just cloned. Type ' + code('dir') + ' (or ' + code('ls') + ' — either works) to list the files in your ' + code('age_safe') + ' directory.',
          check: function (ctx) {
            return ctx.name === 'ls' && ctx.ok && ctx.folder && ctx.folder.name === 'age_safe';
          }
        },
        {
          id: 'status',
          label: 'git status',
          hint: 'The “where am I?” command. Run it any time you’re unsure. Right now it should say the working tree is clean.',
          check: function (ctx) { return ctx.name === 'git status' && ctx.ok; }
        },
        {
          id: 'add-one',
          label: 'git add <file>',
          hint: 'Type ' + code('edit age_safe.py') + ' and click <strong>Done Coding</strong> (the pop-up reminds you to save your work), then stage JUST that file: ' + code('git add age_safe.py'),
          check: function (ctx) {
            return ctx.name === 'git add' && ctx.ok && !ctx.meta.all && ctx.meta.staged && ctx.meta.staged.length > 0;
          }
        },
        {
          id: 'commit',
          label: 'git commit -m "message"',
          hint: 'Save a snapshot of what’s staged. The message describes the change: ' + code('git commit -m "Adjust ride age"'),
          check: function (ctx) { return ctx.name === 'git commit' && ctx.ok && ctx.meta.committed; }
        },
        {
          id: 'add-all',
          label: 'git add .',
          hint: 'Now change TWO files (' + code('edit README.md') + ' and ' + code('edit ages.txt') + ' — click <strong>Done Coding</strong> for each), then stage everything at once with ' + code('git add .'),
          check: function (ctx) {
            return ctx.name === 'git add' && ctx.ok && ctx.meta.all && ctx.meta.staged && ctx.meta.staged.length > 0;
          }
        },
        {
          id: 'commit2',
          label: 'git commit (again)',
          hint: 'Commit the new snapshot. Every commit needs its own message.',
          check: function (ctx, rt) {
            if (ctx.name === 'git commit' && ctx.ok && ctx.meta.committed) rt.commits = (rt.commits || 0) + 1;
            return (rt.commits || 0) >= 2;
          }
        },
        {
          id: 'push',
          label: 'git push',
          hint: 'Your commits are still only on this computer. Upload them to GitHub with ' + code('git push'),
          check: function (ctx) { return ctx.name === 'git push' && ctx.ok && ctx.meta.pushed; }
        }
      ]
    },

    /* =====================================================================
       PHASE 2 — connect YOUR code to YOUR empty repo
       ===================================================================== */
    {
      id: '2',
      tabLabel: 'Connect Your Repo',
      title: 'Start from your own code',
      brief: 'You wrote Age Safe on this laptop <em>before</em> learning Git — it lives in the ' + code('age_safe') + ' folder. ' +
        'You already created an <strong>empty</strong> repo on GitHub. Neither one knows the other exists yet. Your job: introduce them. ' +
        'Your repo URL: ' + code('https://github.com/student/age_safe.git') +
        '<br><br><strong>Remember:</strong> this setup happens <em>once per project</em>. After it, every day is just add → commit → push.',
      welcome: [
        'PHASE 2 — Connect Your Own Code to Your Own Repo',
        '',
        'This time nothing is coming down from the cloud. Your Python',
        'program is HERE, and an empty repo is waiting on GitHub.',
        'Link them up.',
        '',
        'Tip: try git status before git init — read what Git says.'
      ],
      seedId: '2',
      skills: [
        {
          id: 'cd',
          label: 'cd age_safe',
          hint: 'Move into the folder where your program lives.',
          check: function (ctx) {
            return ctx.name === 'cd' && ctx.ok && ctx.folder && ctx.folder.name === 'age_safe';
          }
        },
        {
          id: 'fatal',
          label: 'see the "not a git repository" error',
          hint: 'Run ' + code('git status') + ' BEFORE ' + code('git init') + '. It will fail — on purpose. Read the error: this folder isn’t a repository yet. You will meet this error in real life; now you know what it means.',
          check: function (ctx) {
            return ctx.meta.notARepo && ctx.folder && ctx.folder.name === 'age_safe';
          }
        },
        {
          id: 'init',
          label: 'git init',
          hint: 'Turn this ordinary folder into a Git repository. It creates a hidden ' + code('.git') + ' folder — nothing visible changes.',
          check: function (ctx) { return ctx.name === 'git init' && ctx.ok && ctx.meta.init; }
        },
        {
          id: 'status',
          label: 'git status → untracked files',
          hint: 'Now it works! Every file shows as <em>untracked</em> in red: Git can see them but isn’t tracking them yet.',
          check: function (ctx) {
            return ctx.name === 'git status' && ctx.ok && ctx.folder && ctx.folder.isRepo &&
              ctx.folder.files.some(function (f) { return f.status === 'untracked'; });
          }
        },
        {
          id: 'add',
          label: 'git add .',
          hint: 'Stage everything for the first snapshot.',
          check: function (ctx) { return ctx.name === 'git add' && ctx.ok && ctx.meta.all && ctx.meta.staged.length > 0; }
        },
        {
          id: 'commit',
          label: 'git commit -m "Initial commit"',
          hint: 'The traditional first message: ' + code('git commit -m "Initial commit"') + '. This snapshot exists ONLY on your computer so far.',
          check: function (ctx) { return ctx.name === 'git commit' && ctx.ok && ctx.meta.committed; }
        },
        {
          id: 'remote-add',
          label: 'git remote add origin <url>',
          hint: 'The critical new step: tell your local repo where its GitHub home is. ' + code('git remote add origin https://github.com/student/age_safe.git') + ' — note that NOTHING prints. Silence means it worked.',
          check: function (ctx) { return ctx.name === 'git remote' && ctx.ok && ctx.meta.added; }
        },
        {
          id: 'remote-v',
          label: 'git remote -v',
          hint: 'Since remote add printed nothing, verify the link exists: ' + code('git remote -v') + ' shows the URL for fetch and push.',
          check: function (ctx) { return ctx.name === 'git remote' && ctx.ok && ctx.meta.verbose && !ctx.meta.empty; }
        },
        {
          id: 'branch-m',
          label: 'git branch -M main',
          hint: 'Your branch is called ' + code('master') + ' (check the Repository panel!) but GitHub expects ' + code('main') + '. Rename it: ' + code('git branch -M main'),
          check: function (ctx) { return ctx.name === 'git branch' && ctx.ok && ctx.meta.renamed === 'main'; }
        },
        {
          id: 'push-u',
          label: 'git push -u origin main',
          hint: 'First push needs the full form. The ' + code('-u') + ' remembers the connection so every future push is just ' + code('git push') + '.',
          check: function (ctx) { return ctx.name === 'git push' && ctx.ok && ctx.meta.setUpstream; }
        }
      ]
    },

    /* =====================================================================
       PHASE 3 — update program: same person, two computers, one repo
       ===================================================================== */
    {
      id: '3',
      tabLabel: 'Update Program',
      title: 'Pull before you code',
      brief: 'Yesterday you worked on Age Safe from a <strong>campus lab computer</strong> and pushed an improvement ' +
        '(input validation). Your laptop hasn’t heard about it yet — GitHub has a newer version of your own program than you do. ' +
        '<strong>Habit to build:</strong> ' + code('git pull') + ' <em>before</em> you start working, every single time. ' +
        'Same person, two computers, one repo.',
      welcome: [
        'PHASE 3 — Update Program',
        '',
        'You pushed a change from the campus lab yesterday. Your',
        'laptop copy is out of date. Start the day the professional',
        'way: pull first, then code.',
        '',
        'Then: edit → add → commit → push. Twice. Make it automatic.'
      ],
      seedId: '3',
      track: function (ctx, rt) {
        if (ctx.name === 'git push' && ctx.ok && ctx.meta.pushed) {
          rt.pushLoops = (rt.pushLoops || 0) + 1;
        }
      },
      skills: [
        {
          id: 'pull',
          label: 'git pull',
          hint: 'Download yesterday’s lab-computer commit: ' + code('git pull') + '. Watch the panel — age_safe.py updates and the commit appears in your history.',
          check: function (ctx) { return ctx.name === 'git pull' && ctx.ok && ctx.meta.pulled; }
        },
        {
          id: 'log',
          label: 'git log --oneline',
          hint: 'See history as a compact list, newest first: ' + code('git log --oneline') + '. Spot the commit you pushed from the lab at the top.',
          check: function (ctx) { return ctx.name === 'git log' && ctx.ok && ctx.meta.oneline; }
        },
        {
          id: 'loop1',
          label: 'loop #1: edit → add → commit → push',
          hint: 'Improve the program (' + code('edit age_safe.py') + ', then <strong>Done Coding</strong>), then ' + code('git add .') + ', ' + code('git commit -m "..."') + ', ' + code('git push') + '.',
          check: function (ctx, rt) { return (rt.pushLoops || 0) >= 1; }
        },
        {
          id: 'loop2',
          label: 'loop #2: do it again, faster',
          hint: 'Same four steps, new change. No peeking at the hints this time.',
          check: function (ctx, rt) { return (rt.pushLoops || 0) >= 2; }
        }
      ]
    },

    /* =====================================================================
       PHASE 4 — branching: try different conditional styles safely
       ===================================================================== */
    {
      id: '4',
      tabLabel: 'Branching',
      title: 'Try a different approach',
      brief: 'Age Safe currently rates content using <strong>complex conditionals</strong> — three separate ' +
        code('if') + ' statements with compound tests like ' + code('age &gt;= 13 and age &lt; 17') + '. ' +
        'It works, but you suspect there’s a cleaner way. Branches let you try rewrites without risking the working program on ' +
        code('main') + ': one branch for a <strong>nested</strong> version, one for a <strong>parallel</strong> (if/elif/else) version.',
      welcome: [
        'PHASE 4 — Branching',
        '',
        'A branch is a parallel universe for your code. Commits land',
        'on whichever branch you are standing on — watch the',
        'Repository panel.',
        '',
        'main keeps working while you experiment. Start by seeing',
        'what branches exist: git branch'
      ],
      seedId: '4',
      skills: [
        {
          id: 'list',
          label: 'git branch',
          hint: 'List all branches. The ' + code('*') + ' marks where you’re standing. Peek at the current program first: ' + code('cat age_safe.py'),
          check: function (ctx) { return ctx.name === 'git branch' && ctx.ok && ctx.meta.listed; }
        },
        {
          id: 'create',
          label: 'git branch <name>',
          hint: 'Create a branch for the first experiment: ' + code('git branch nested-conditionals') + '. Run ' + code('git branch') + ' again — it exists, but you’re still on main.',
          check: function (ctx) { return ctx.name === 'git branch' && ctx.ok && ctx.meta.created; }
        },
        {
          id: 'switch',
          label: 'git switch <name>',
          hint: 'Now step onto it: ' + code('git switch nested-conditionals') + '. Watch the branch change in the Repository panel.',
          check: function (ctx) { return ctx.meta.switched && !ctx.meta.created && !ctx.meta.already; }
        },
        {
          id: 'commit-on-branch',
          label: 'commit the nested rewrite',
          hint: 'On this branch you rewrite the checks as <strong>nested conditionals</strong> — one decision inside another, like:' +
            snip([
              'if age > 0:',
              '    if age < 13:',
              '        rating = "kids only"',
              '    else:',
              '        if age < 17:',
              '            rating = "teen approved"',
              '        else:',
              '            rating = "all access"'
            ]) +
            'Do the work: ' + code('edit age_safe.py') + ' and click <strong>Done Coding</strong>. Then ' + code('git add .') + ' and ' + code('git commit -m "Nested version"') + '. The commit lands on YOUR branch — main stayed safe.',
          check: function (ctx) {
            return ctx.name === 'git commit' && ctx.ok && ctx.meta.committed && ctx.folder && ctx.folder.branch !== 'main';
          }
        },
        {
          id: 'switch-c',
          label: 'git switch -c <name>',
          hint: 'Second experiment: hop back to a clean start with ' + code('git switch main') + ', then create AND switch in one step: ' + code('git switch -c parallel-conditionals') + '. This rewrite uses <strong>parallel conditionals</strong> — one flat if/elif/else chain:' +
            snip([
              'if age < 0:',
              '    rating = "invalid age"',
              'elif age < 13:',
              '    rating = "kids only"',
              'elif age < 18:',
              '    rating = "teen approved"',
              'else:',
              '    rating = "all access"'
            ]) +
            'Do the work (' + code('edit age_safe.py') + ' → <strong>Done Coding</strong>) and commit it on this branch too.',
          check: function (ctx) { return ctx.meta.switched && ctx.meta.created; }
        },
        {
          id: 'push-u-branch',
          label: 'git push -u origin <branch>',
          hint: 'Publish the branch you’re on so GitHub has your experiment: ' + code('git push -u origin parallel-conditionals') + '. New branches always need the ' + code('-u origin <name>') + ' form the first time — GitHub has never heard of this branch.',
          check: function (ctx) {
            return ctx.name === 'git push' && ctx.ok && ctx.meta.setUpstream && ctx.folder && ctx.folder.branch !== 'main';
          }
        }
      ]
    },

    /* =====================================================================
       PHASE 5 — merging: crown the parallel-conditionals rewrite
       ===================================================================== */
    {
      id: '5',
      tabLabel: 'Merging',
      title: 'Merge the winner',
      brief: 'The experiments are in, and <strong>parallel conditionals won</strong> — one flat ' + code('if/elif/else') +
        ' chain: every case handled exactly once, no gaps, no overlaps. Your ' + code('parallel-conditionals') + ' branch holds the rewrite. ' +
        'But ' + code('main') + ' moved too: you fixed an age-boundary bug from the lab computer and pushed it. Same lines, two versions — ' +
        'merging will <strong>conflict</strong>, deliberately. The first conflict of your life is scary; the second one is Tuesday. Have your first one here.',
      welcome: [
        'PHASE 5 — Merging',
        '',
        'You are on branch parallel-conditionals. The winning rewrite',
        'is committed. Time to crown it: merge it into main.',
        '',
        'Heads up: main has a bug-fix touching the SAME lines. A',
        'conflict is coming. That is the plan.',
        '',
        'Step 1: get back onto main.'
      ],
      seedId: '5',
      skills: [
        {
          id: 'switch-main',
          label: 'git switch main',
          hint: 'Merges happen FROM the branch you’re standing on. Go stand on ' + code('main') + '.',
          check: function (ctx) { return ctx.meta.switched === 'main'; }
        },
        {
          id: 'pull',
          label: 'git pull',
          hint: 'Update main before merging — always. This grabs the boundary bug-fix you pushed from the lab. Notice Git warned you main was behind when you switched.',
          check: function (ctx) { return ctx.name === 'git pull' && ctx.ok && ctx.meta.pulled; }
        },
        {
          id: 'merge',
          label: 'git merge parallel-conditionals',
          hint: 'Pull the branch’s commits into main: ' + code('git merge parallel-conditionals') + '. Brace for the CONFLICT message — read it, it tells you exactly which file to fix.',
          check: function (ctx) { return ctx.name === 'git merge' && ctx.meta.conflict; }
        },
        {
          id: 'resolve',
          label: 'fix the conflict, then git add',
          hint: 'Open the file: ' + code('edit age_safe.py') + '. Git wrote BOTH versions in, fenced by ' + code('&lt;&lt;&lt;&lt;&lt;&lt;&lt;') + ' markers. ' +
            '<strong>Keep the parallel (elif) version</strong> — delete the marker lines AND the old complex-conditional block. Save, then ' + code('git add age_safe.py') + ' to tell Git it’s resolved.',
          check: function (ctx) {
            return ctx.name === 'git add' && ctx.ok && ctx.folder && ctx.folder.merge &&
              GG.state.conflictedFiles(ctx.folder).length === 0 &&
              GG.state.stagedFiles(ctx.folder).every(function (f) { return f.content.indexOf('<<<<<<<') === -1; });
          }
        },
        {
          id: 'commit-merge',
          label: 'git commit → conclude the merge',
          hint: 'Commit to finish the merge: ' + code('git commit -m "Merge parallel-conditionals"'),
          check: function (ctx) { return ctx.name === 'git commit' && ctx.ok && ctx.meta.mergeCommit; }
        },
        {
          id: 'push',
          label: 'git push',
          hint: 'Publish the merged result — GitHub’s main now has the winning version too.',
          check: function (ctx) { return ctx.name === 'git push' && ctx.ok && ctx.meta.pushed; }
        },
        {
          id: 'delete',
          label: 'git branch -d parallel-conditionals',
          hint: 'The branch’s work now lives in main — the branch itself is done. Delete it: ' + code('git branch -d parallel-conditionals'),
          check: function (ctx) { return ctx.name === 'git branch' && ctx.ok && ctx.meta.deleted; }
        }
      ]
    }
  ];

  GG.curriculum = { phases: phases };
})(window.GG);
