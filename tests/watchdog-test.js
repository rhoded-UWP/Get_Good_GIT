/* Watchdog test: force the terminal into the exact blank states the teacher
   described (empty body / dead input) and verify the phase auto-resets like
   the Reset button. Also verify it does NOT false-positive while the editor
   modal is open. */

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
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href, { waitUntil: 'networkidle0' });

  async function type(cmd) {
    await page.click('.phase--active .terminal__body');
    await page.keyboard.type(cmd, { delay: 2 });
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 60));
  }

  // build some progress first
  await type('git clone https://github.com/student/age_safe.git');
  assert((await page.$$('.phase--active .skill--done')).length >= 1, 'progress before blank');

  // --- scenario 1: scrollback wiped (screen went blank) ---
  await page.evaluate(() => {
    document.querySelector('.phase--active .terminal__body').innerHTML = '';
  });
  await new Promise(r => setTimeout(r, 2600)); // watchdog runs every 2s
  let state = await page.evaluate(() => {
    const body = document.querySelector('.phase--active .terminal__body');
    return {
      text: body.textContent,
      hasInput: !!body.querySelector('.terminal__input'),
      done: document.querySelectorAll('.phase--active .skill--done').length
    };
  });
  assert(state.text.includes('reset to a clean start') && state.text.includes('PHASE 1'),
    'wiped scrollback -> watchdog auto-reset with explanation');
  assert(state.hasInput, 'live prompt restored');
  assert(state.done === 0, 'skills reset like the Reset button');
  await type('git status');
  state = await page.evaluate(() =>
    document.querySelector('.phase--active .terminal__body').textContent);
  assert(state.includes('fatal: not a git repository'), 'terminal fully usable after recovery');

  // --- scenario 2: input silently dead (no live prompt) ---
  await page.evaluate(() => {
    const input = document.querySelector('.phase--active .terminal__input');
    if (input) input.remove();
  });
  await new Promise(r => setTimeout(r, 2600));
  state = await page.evaluate(() => ({
    hasInput: !!document.querySelector('.phase--active .terminal__input'),
    text: document.querySelector('.phase--active .terminal__body').textContent
  }));
  assert(state.hasInput && state.text.includes('reset to a clean start'),
    'dead input -> watchdog auto-reset restores a prompt');

  // --- scenario 3: editor open must NOT trigger the watchdog ---
  await type('git clone https://github.com/student/age_safe.git');
  await type('cd age_safe');
  await type('edit age_safe.py');
  await page.waitForSelector('#editor:not([hidden])');
  await new Promise(r => setTimeout(r, 2600)); // watchdog ticks while modal open
  const editorStill = await page.evaluate(() => ({
    open: !document.getElementById('editor').hidden,
    reset: document.querySelector('.phase--active .terminal__body').textContent.includes('reset to a clean start')
  }));
  assert(editorStill.open, 'editor stayed open through watchdog ticks (no false positive)');
  await page.click('#editor-save');
  await new Promise(r => setTimeout(r, 100));
  const afterEditor = await page.evaluate(() =>
    document.querySelector('.phase--active .terminal__body').textContent);
  assert(afterEditor.includes('Done coding!'), 'editor flow unaffected by watchdog');

  assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('\n' + (failures ? failures + ' FAILURES' : 'ALL WATCHDOG TESTS PASSED'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
