/* Headless test harness: loads state.js, git.js, curriculum.js with a stubbed
   window, then walks every phase like a student would and asserts all skills
   complete + error paths print the right Git errors. Age Safe edition. */

const fs = require('fs');
const path = require('path');

global.window = {};
const ROOT = path.join(__dirname, '..');
for (const f of ['js/state.js', 'js/git.js', 'js/curriculum.js']) {
  eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
}
const GG = global.window.GG;

let failures = 0;
function assert(cond, label) {
  if (cond) { console.log('  ok  ' + label); }
  else { console.log('  FAIL ' + label); failures++; }
}

function textOf(result) {
  return result.lines.map(l => l.t).join('\n');
}

/** simulate an editor change: modify file content */
function editFile(scn, name, append) {
  const folder = GG.state.currentFolder(scn);
  const f = GG.state.findFile(folder, name);
  f.content += append;
  if (f.status === 'clean' || f.status === 'staged') f.status = 'modified';
  return f;
}

/** resolve a conflict generically: keep "theirs" block, drop ours + markers */
function keepTheirs(content) {
  const out = [];
  let mode = 'keep';
  for (const line of content.split('\n')) {
    if (line.startsWith('<<<<<<<')) { mode = 'ours'; continue; }
    if (line.startsWith('=======')) { mode = 'theirs'; continue; }
    if (line.startsWith('>>>>>>>')) { mode = 'keep'; continue; }
    if (mode !== 'ours') out.push(line);
  }
  return out.join('\n');
}

function makePhaseRunner(def) {
  const scn = GG.state.seeds[def.seedId]();
  const rt = {};
  const skills = def.skills.map(s => ({ def: s, done: false }));
  function run(line) {
    const result = GG.git.run(line, scn);
    const ctx = {
      name: result.name, ok: result.ok, meta: result.meta,
      scenario: scn, folder: GG.state.currentFolder(scn)
    };
    if (def.track) def.track(ctx, rt);
    for (const s of skills) {
      if (!s.done && s.def.check(ctx, rt)) s.done = true;
    }
    return result;
  }
  return { scn, rt, skills, run };
}

const phases = {};
GG.curriculum.phases.forEach(p => phases[p.id] = p);

/* ================= PHASE 1 ================= */
console.log('\nPHASE 1');
{
  const R = makePhaseRunner(phases['1']);

  // error path: git status outside repo
  let r = R.run('git status');
  assert(!r.ok && textOf(r).includes('fatal: not a git repository'), 'status before clone -> fatal not a repo');

  // wrong URL
  r = R.run('git clone https://github.com/student/wrong-repo.git');
  assert(!r.ok && textOf(r).includes('not found'), 'clone wrong url -> repository not found');

  r = R.run('git clone https://github.com/student/age_safe.git');
  assert(r.ok && textOf(r).includes("Cloning into 'age_safe'"), 'clone succeeds');

  // git status still fails outside the folder
  r = R.run('git status');
  assert(!r.ok && textOf(r).includes('fatal: not a git repository'), 'status outside folder still fatal');

  r = R.run('cd age_safe');
  assert(r.ok, 'cd into repo');

  r = R.run('dir');
  assert(r.ok && textOf(r).includes('age_safe.py'), 'dir lists files in the repo');
  r = R.run('ls');
  assert(r.ok && textOf(r).includes('age_safe.py'), 'ls works as an alias for dir');

  r = R.run('git status');
  assert(r.ok && textOf(r).includes('working tree clean') && textOf(r).includes("up to date with 'origin/main'"), 'clean status');

  // commit with nothing staged
  r = R.run('git commit -m "empty"');
  assert(!r.ok && textOf(r).includes('nothing to commit'), 'commit with nothing staged');

  editFile(R.scn, 'age_safe.py', '\n# tweak\n');
  r = R.run('git status');
  assert(textOf(r).includes('Changes not staged for commit') && textOf(r).includes('modified:   age_safe.py'), 'modified shows unstaged');

  r = R.run('git add age_safe.py');
  assert(r.ok, 'add single file');

  r = R.run('git status');
  assert(textOf(r).includes('Changes to be committed') && textOf(r).includes('modified:   age_safe.py'), 'staged shows');

  // unquoted multi-word message
  r = R.run('git commit -m Adjust the ride age');
  assert(!r.ok && textOf(r).includes("pathspec 'the'"), 'unquoted message -> pathspec error');

  r = R.run('git commit -m "Adjust ride age"');
  assert(r.ok && /\[main [0-9a-f]{7}\] Adjust ride age/.test(textOf(r)), 'commit ok');

  editFile(R.scn, 'README.md', '\nnotes\n');
  editFile(R.scn, 'ages.txt', '33\n');
  r = R.run('git add .');
  assert(r.ok && r.meta.staged.length === 2, 'add . stages both');

  r = R.run('git commit -m "More changes"');
  assert(r.ok, 'second commit');

  r = R.run('git status');
  assert(textOf(r).includes('ahead of') && textOf(r).includes('by 2 commits'), 'ahead by 2');

  r = R.run('git push');
  assert(r.ok && /[0-9a-f]{7}\.\.[0-9a-f]{7} {2}main -> main/.test(textOf(r)), 'push ok with range');

  r = R.run('git push');
  assert(r.ok && textOf(r).includes('Everything up-to-date'), 'push again up to date');

  assert(R.skills.every(s => s.done), 'ALL Phase 1 skills complete: ' + R.skills.filter(s => !s.done).map(s => s.def.id).join(','));
}

/* ================= PHASE 2 ================= */
console.log('\nPHASE 2');
{
  const R = makePhaseRunner(phases['2']);

  let r = R.run('cd age_safe');
  assert(r.ok, 'cd age_safe');

  r = R.run('git status');
  assert(!r.ok && r.meta.notARepo, 'status before init errors');

  // push before init also fatal
  r = R.run('git push');
  assert(!r.ok && textOf(r).includes('fatal: not a git repository'), 'push before init -> not a repo');

  r = R.run('git init');
  assert(r.ok && textOf(r).includes('Initialized empty Git repository in C:/CS1430/age_safe/.git/'), 'init ok with course path');
  const folder = GG.state.currentFolder(R.scn);
  assert(folder.branch === 'master', 'init creates master');

  r = R.run('git status');
  assert(textOf(r).includes('No commits yet') && textOf(r).includes('Untracked files') && textOf(r).includes('age_safe.py'), 'untracked listing');

  r = R.run('git add .');
  assert(r.ok && r.meta.staged.length === 3, 'add . stages 3');

  r = R.run('git commit -m "Initial commit"');
  assert(r.ok && textOf(r).includes('(root-commit)') && textOf(r).includes('create mode 100644 age_safe.py'), 'root commit with create modes');

  r = R.run('git push');
  assert(!r.ok && textOf(r).includes('No configured push destination'), 'push before remote add errors');

  r = R.run('git remote -v');
  assert(r.ok && r.lines.length === 0, 'remote -v empty before add');

  r = R.run('git remote add origin https://github.com/student/age_safe.git');
  assert(r.ok && r.lines.length === 0, 'remote add silent');

  r = R.run('git remote -v');
  assert(r.ok && textOf(r).includes('(fetch)') && textOf(r).includes('(push)'), 'remote -v shows both');

  // push before -u
  r = R.run('git push');
  assert(!r.ok && textOf(r).includes('has no upstream branch'), 'push before -u errors');

  r = R.run('git branch -M main');
  assert(r.ok && GG.state.currentFolder(R.scn).branch === 'main', 'rename to main');

  r = R.run('git push -u origin main');
  assert(r.ok && textOf(r).includes('[new branch]') && textOf(r).includes("set up to track"), 'push -u ok');

  r = R.run('git push');
  assert(r.ok && textOf(r).includes('Everything up-to-date'), 'plain push now works');

  assert(R.skills.every(s => s.done), 'ALL Phase 2 skills complete: ' + R.skills.filter(s => !s.done).map(s => s.def.id).join(','));
}

/* ================= PHASE 3 ================= */
console.log('\nPHASE 3');
{
  const R = makePhaseRunner(phases['3']);

  let r = R.run('git status');
  assert(textOf(r).includes('behind') && textOf(r).includes('fast-forwarded'), 'status shows behind');

  // push while behind -> rejected
  editFile(R.scn, 'age_safe.py', '\n# a\n');
  r = R.run('git add .');
  r = R.run('git commit -m "local work"');
  r = R.run('git push');
  assert(!r.ok && textOf(r).includes('[rejected]') && textOf(r).includes('fetch first'), 'push while behind rejected');

  // reset for the clean path
  const R2 = makePhaseRunner(phases['3']);
  r = R2.run('git pull');
  assert(r.ok && textOf(r).includes('Fast-forward') && textOf(r).includes('age_safe.py'), 'pull fast-forwards age_safe.py');
  const py = GG.state.findFile(GG.state.currentFolder(R2.scn), 'age_safe.py');
  assert(py.content.includes('not a real age'), 'pull applied the lab-computer update');

  r = R2.run('git pull');
  assert(r.ok && textOf(r).includes('Already up to date.'), 'pull again up to date');

  r = R2.run('git log --oneline');
  assert(r.ok && textOf(r).includes('HEAD -> main') && textOf(r).includes('Add input validation'), 'log oneline decorated');

  // loop 1
  editFile(R2.scn, 'age_safe.py', '\n# l1\n');
  R2.run('git add .');
  R2.run('git commit -m "loop 1"');
  R2.run('git push');
  // loop 2
  editFile(R2.scn, 'README.md', '\nl2\n');
  R2.run('git add .');
  R2.run('git commit -m "loop 2"');
  R2.run('git push');

  assert(R2.skills.every(s => s.done), 'ALL 2 skills complete: ' + R2.skills.filter(s => !s.done).map(s => s.def.id).join(','));
}

/* ================= PHASE 4 ================= */
console.log('\nPHASE 4');
{
  const R = makePhaseRunner(phases['4']);

  let r = R.run('git branch');
  assert(r.ok && textOf(r).includes('* main'), 'branch lists main');

  r = R.run('git switch nested-conditionals');
  assert(!r.ok && textOf(r).includes('invalid reference'), 'switch to missing branch errors');

  r = R.run('git branch nested-conditionals');
  assert(r.ok, 'create branch');

  r = R.run('git branch nested-conditionals');
  assert(!r.ok && textOf(r).includes('already exists'), 'duplicate branch errors');

  r = R.run('git switch nested-conditionals');
  assert(r.ok && textOf(r).includes("Switched to branch 'nested-conditionals'"), 'switch ok');

  editFile(R.scn, 'age_safe.py', '\n# nested rewrite\n');
  R.run('git add .');
  r = R.run('git commit -m "Nested version"');
  assert(r.ok, 'commit on branch');
  const folder = GG.state.currentFolder(R.scn);
  assert(folder.commitsByBranch['nested-conditionals'].length === 4 && folder.commitsByBranch['main'].length === 3, 'commit landed on branch only');

  // back to main, then switch -c: main's version of the file is restored
  r = R.run('git switch main');
  assert(r.ok, 'switch back to main');
  const py = GG.state.findFile(folder, 'age_safe.py');
  assert(!py.content.includes('# nested rewrite'), 'main restored its own version of age_safe.py');

  r = R.run('git switch -c parallel-conditionals');
  assert(r.ok && textOf(r).includes("Switched to a new branch 'parallel-conditionals'"), 'switch -c ok');

  r = R.run('git push');
  assert(!r.ok && textOf(r).includes('no upstream branch'), 'push new branch without -u errors');

  r = R.run('git push -u origin parallel-conditionals');
  assert(r.ok && textOf(r).includes('[new branch]'), 'push -u new branch');

  assert(R.skills.every(s => s.done), 'ALL 3 skills complete: ' + R.skills.filter(s => !s.done).map(s => s.def.id).join(','));
}

/* ================= PHASE 5 ================= */
console.log('\nPHASE 5');
{
  const R = makePhaseRunner(phases['5']);

  let r = R.run('git switch main');
  assert(r.ok && textOf(r).includes('behind'), 'switch main warns behind');
  let folder = GG.state.currentFolder(R.scn);
  let py = () => folder.files.find(f => f.name === 'age_safe.py');
  assert(py().content.includes('if age >= 17:'), 'main has the complex-conditional version');

  r = R.run('git pull');
  assert(r.ok && textOf(r).includes('Fast-forward'), 'pull main');
  assert(py().content.includes('if age >= 18:'), 'pull applied the boundary bug-fix');

  r = R.run('git merge parallel-conditionals');
  assert(!r.ok && textOf(r).includes('CONFLICT (content): Merge conflict in age_safe.py'), 'merge conflicts');
  assert(py().content.includes('<<<<<<< HEAD') && py().content.includes('>>>>>>> parallel-conditionals'), 'conflict markers written');
  assert(py().content.includes('elif age < 13:') && py().content.includes('if age >= 18:'), 'both versions present');

  r = R.run('git status');
  assert(textOf(r).includes('both modified:   age_safe.py'), 'status shows unmerged');

  // commit before resolving
  r = R.run('git commit -m "nope"');
  assert(!r.ok && textOf(r).includes('unmerged files'), 'commit blocked by conflict');

  // resolve: keep the parallel (elif) version
  py().content = keepTheirs(py().content);
  assert(py().content.includes('elif age < 18:') && !py().content.includes('if age >= 18 and') && !py().content.includes('<<<<<<<'), 'resolution kept parallel version');

  r = R.run('git add age_safe.py');
  assert(r.ok, 'add resolved file');

  r = R.run('git status');
  assert(textOf(r).includes('All conflicts fixed but you are still merging'), 'status: conflicts fixed still merging');

  r = R.run('git commit -m "Merge parallel-conditionals"');
  assert(r.ok && r.meta.mergeCommit, 'merge commit concluded');

  r = R.run('git push');
  assert(r.ok && r.meta.pushed, 'push merged main');

  r = R.run('git branch -d parallel-conditionals');
  assert(r.ok && textOf(r).includes('Deleted branch parallel-conditionals'), 'branch deleted');

  assert(R.skills.every(s => s.done), 'ALL 4 skills complete: ' + R.skills.filter(s => !s.done).map(s => s.def.id).join(','));

  // merge --abort path on a fresh run
  const R2 = makePhaseRunner(phases['5']);
  R2.run('git switch main');
  R2.run('git pull');
  R2.run('git merge parallel-conditionals');
  const f2 = GG.state.currentFolder(R2.scn);
  r = R2.run('git merge --abort');
  assert(r.ok && !f2.merge && !f2.files.find(f => f.name === 'age_safe.py').content.includes('<<<<<<<'), 'merge --abort restores');
}

console.log('\n' + (failures ? failures + ' FAILURES' : 'ALL TESTS PASSED'));
process.exit(failures ? 1 : 0);
