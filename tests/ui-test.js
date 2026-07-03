/* UI smoke test: drives the real page in headless Edge.
   Types a full Phase 1 run + spot-checks tabs, panel, editor, paste block,
   and the Phase 4 parallel-conditionals merge. Age Safe edition. */

const path = require('path');

const SHOTS = path.join(__dirname, 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function assert(cond, label) {
  console.log((cond ? '  ok  ' : '  FAIL ') + label);
  if (!cond) failures++;
}

(async () => {
  const browser = await require('./launch-browser').launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href, { waitUntil: 'networkidle0' });

  assert((await page.title()).includes('Get Good @ GIT'), 'page loads with title');
  assert((await page.$$('.tab')).length === 5, 'five phase tabs render');
  assert(await page.$('.phase--active .terminal__body') !== null, 'terminal visible');
  assert(await page.$('.phase--active .panel__section') !== null, 'state panel visible');
  assert(await page.$('.phase--active .skill--current .skill__hint') !== null, 'current skill hint visible');
  const firstLabel = await page.$eval('.phase--active .skill__label', el => el.textContent);
  assert(firstLabel.includes('<url>'), 'placeholder <url> visible in skill label');

  async function type(cmd) {
    await page.click('.phase--active .terminal__body');
    await page.keyboard.type(cmd, { delay: 2 });
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 60));
  }
  async function bodyText() {
    return page.$eval('.phase--active .terminal__body', el => el.textContent);
  }
  async function doneCount() {
    return (await page.$$('.phase--active .skill--done')).length;
  }
  async function doneCoding(file) {
    await type('edit ' + file);
    await page.waitForSelector('#editor:not([hidden])');
    await page.click('#editor-save');
    await new Promise(r => setTimeout(r, 60));
  }

  // --- Phase 1 drive-through ---
  await type('git status');
  assert((await bodyText()).includes('fatal: not a git repository'), 'typed status -> real fatal error shown');

  await type('git clone https://github.com/student/age_safe.git');
  assert((await bodyText()).includes("Cloning into 'age_safe'"), 'clone output printed');
  assert((await bodyText()).includes('skill complete'), 'praise line printed');

  await type('cd age_safe');
  const promptText = await bodyText();
  assert(promptText.includes('PS C:\\CS1430\\age_safe>'), 'prompt shows PowerShell path');

  await type('dir');
  assert((await bodyText()).includes('age_safe.py'), 'dir lists files in age_safe directory');

  await type('git status');

  // simple "Done Coding" mode: message shown, textarea hidden, button relabeled
  await type('edit age_safe.py');
  await page.waitForSelector('#editor:not([hidden])');
  const simpleMode = await page.evaluate(() => ({
    workedVisible: !document.getElementById('editor-worked').hidden,
    textareaHidden: document.getElementById('editor-textarea').hidden,
    buttonText: document.getElementById('editor-save').textContent,
    message: document.getElementById('editor-worked').textContent
  }));
  assert(simpleMode.workedVisible && simpleMode.textareaHidden, 'Done Coding mode: message shown, no textarea');
  assert(simpleMode.buttonText === 'Done Coding', 'button says "Done Coding"');
  assert(simpleMode.message.includes('be sure to save your work'), 'save-your-work message present');
  await page.click('#editor-save');
  await new Promise(r => setTimeout(r, 60));
  assert((await bodyText()).includes('Done coding! age_safe.py has changed'), 'Done Coding feedback printed');

  const panelHtml = await page.$eval('.phase--active .panel', el => el.innerHTML);
  assert(panelHtml.includes('file-row--modified'), 'panel shows modified file');

  await type('git add age_safe.py');
  await type('git commit -m "Adjust ride age"');
  await doneCoding('README.md');
  await doneCoding('ages.txt');
  await type('git add .');
  await type('git commit -m "More changes"');
  await type('git push');

  assert((await bodyText()).includes('PHASE 1 COMPLETE'), 'phase complete banner printed');
  assert(await doneCount() === 9, 'all 9 skills checked off');
  const tabProgress = await page.$eval('.tab--active .tab__progress', el => el.textContent);
  assert(tabProgress === '9/9', 'tab progress shows 9/9');

  // arrow-up history recall
  await page.click('.phase--active .terminal__body');
  await page.keyboard.press('ArrowUp');
  const echo = await page.$eval('.phase--active .terminal__input-echo', el => el.textContent);
  assert(echo.trim().startsWith('git push'), 'arrow-up recalls last command');
  await page.keyboard.press('Escape');

  // paste blocking: synthetic paste event must be swallowed + notice shown
  const pasteResult = await page.evaluate(() => {
    const input = document.querySelector('.phase--active .terminal__input');
    const dt = new DataTransfer();
    dt.setData('text/plain', 'git push --force');
    const ev = new ClipboardEvent('paste', { clipboardData: dt, cancelable: true, bubbles: true });
    const before = input.value;
    input.dispatchEvent(ev);
    return {
      prevented: ev.defaultPrevented,
      unchanged: input.value === before,
      notice: !!document.querySelector('.phase--active .terminal__notice')
    };
  });
  assert(pasteResult.prevented && pasteResult.unchanged && pasteResult.notice, 'paste blocked with notice shown');

  const missionSelect = await page.$eval('.phase--active .mission', el => getComputedStyle(el).userSelect);
  assert(missionSelect === 'none', 'mission instructions are not selectable');

  await page.screenshot({ path: path.join(SHOTS, '1a-complete.png') });

  // --- reset works ---
  await page.click('.phase--active .btn--reset');
  await new Promise(r => setTimeout(r, 60));
  assert(await doneCount() === 0, 'reset clears skills');
  assert((await bodyText()).includes('phase reset'), 'reset message printed');

  // --- tab switch to Phase 2 (connect your repo) and check seeded state ---
  const tabs = await page.$$('.tab');
  await tabs[1].click();
  await new Promise(r => setTimeout(r, 60));
  await type('ls');
  assert((await bodyText()).includes('age_safe/'), 'Phase 2 shows age_safe folder');
  await type('cd age_safe');
  await type('git status');
  assert((await bodyText()).includes('fatal: not a git repository'), 'Phase 2 status-before-init error');
  assert(await doneCount() >= 2, 'Phase 2 cd + fatal-error skills complete');

  // --- phase 3 snippet renders in hints ---
  await tabs[3].click();
  await new Promise(r => setTimeout(r, 60));
  await type('git branch');
  await type('git branch nested-conditionals');
  await type('git switch nested-conditionals');
  const snippetVisible = await page.$eval('.phase--active .skill--current .mission__snippet', el => el.textContent);
  assert(snippetVisible.includes('if age > 0:'), 'phase 3 shows nested-conditional snippet in current hint');
  await page.screenshot({ path: path.join(SHOTS, '3-branching.png') });

  // --- phase 4 conflict flow in UI ---
  await tabs[4].click();
  await new Promise(r => setTimeout(r, 60));
  await type('git switch main');
  await type('git pull');
  await type('git merge parallel-conditionals');
  assert((await bodyText()).includes('CONFLICT (content): Merge conflict in age_safe.py'), 'phase 4 conflict shown in UI');
  const panel4 = await page.$eval('.phase--active .panel', el => el.textContent);
  assert(panel4.includes('IN PROGRESS'), 'panel shows merge in progress');

  await type('edit age_safe.py');
  await page.waitForSelector('#editor:not([hidden])');
  const conflictMode = await page.evaluate(() => ({
    badgeHidden: document.getElementById('editor-badge').hidden,
    textareaHidden: document.getElementById('editor-textarea').hidden,
    workedHidden: document.getElementById('editor-worked').hidden,
    buttonText: document.getElementById('editor-save').textContent
  }));
  assert(!conflictMode.badgeHidden, 'editor shows merge-conflict badge');
  assert(!conflictMode.textareaHidden && conflictMode.workedHidden, 'conflict keeps the REAL editor (textarea visible)');
  assert(conflictMode.buttonText === 'Save & Close', 'conflict mode button says "Save & Close"');
  // resolve: keep the parallel (elif) block, drop ours + markers
  await page.$eval('#editor-textarea', el => {
    const out = [];
    let mode = 'keep';
    for (const line of el.value.split('\n')) {
      if (line.startsWith('<<<<<<<')) { mode = 'ours'; continue; }
      if (line.startsWith('=======')) { mode = 'theirs'; continue; }
      if (line.startsWith('>>>>>>>')) { mode = 'keep'; continue; }
      if (mode !== 'ours') out.push(line);
    }
    el.value = out.join('\n');
  });
  await page.click('#editor-save');
  await new Promise(r => setTimeout(r, 60));
  assert((await bodyText()).includes('conflict markers are gone'), 'resolution feedback printed');

  await type('git add age_safe.py');
  await type('git commit -m "Merge parallel-conditionals"');
  await type('git push');
  await type('git branch -d parallel-conditionals');
  assert((await bodyText()).includes('PHASE 5 COMPLETE'), 'phase 5 completes in UI');
  await page.screenshot({ path: path.join(SHOTS, '4-complete.png') });

  assert(errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

  await browser.close();
  console.log('\n' + (failures ? failures + ' FAILURES' : 'ALL UI TESTS PASSED'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
