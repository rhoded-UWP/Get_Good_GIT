/* Screen-reader accessibility test: proves the page a screen reader receives
   (the browser accessibility tree — what NVDA/JAWS/Narrator actually read)
   still contains everything, even though mission text is unselectable and
   paste is blocked. Also runs axe-core (WCAG) on every phase + the editor.

   The core regression this guards: user-select:none / paste-blocking are
   VISUAL-ONLY restrictions. If a future change ever hides instructional
   content from assistive technology (aria-hidden, display tricks, canvas
   rendering...), this suite fails. */

const path = require('path');
const axeSource = require('axe-core').source;

let failures = 0;
function assert(cond, label) {
  console.log((cond ? '  ok  ' : '  FAIL ') + label);
  if (!cond) failures++;
}

/* strip ALL whitespace so AX-tree text (split across nodes) matches DOM text */
function squash(s) { return String(s || '').replace(/\s+/g, ''); }

(async () => {
  const browser = await require('./launch-browser').launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  await page.goto(require('url').pathToFileURL(path.join(__dirname, '..', 'index.html')).href, { waitUntil: 'networkidle0' });
  await page.addScriptTag({ content: axeSource });

  /* ---- helpers ---------------------------------------------------------- */

  async function type(cmd) {
    await page.click('.phase--active .terminal__body');
    await page.keyboard.type(cmd, { delay: 2 });
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 60));
  }

  /* flatten the accessibility tree to (a) all text, (b) a node list */
  async function axTree() {
    const snap = await page.accessibility.snapshot({ interestingOnly: false });
    const nodes = [];
    (function walk(n) {
      if (!n) return;
      /* InlineTextBox nodes are layout duplicates of their StaticText parent —
         including them would double every text run and break substring checks */
      if (n.role === 'InlineTextBox') return;
      nodes.push(n);
      (n.children || []).forEach(walk);
    })(snap);
    const text = squash(nodes.map(n => (n.name || '') + ' ' + (n.value || '')).join(' '));
    return { nodes, text };
  }

  /* axe-core scan of the current page state.
     color-contrast is excluded: it is a low-vision (visual) criterion, not a
     screen-reader one, and the terminal deliberately mirrors VS Code's real
     theme colors. Everything else — names, roles, labels, ARIA validity,
     structure, keyboard traps — fails the suite. */
  async function runAxe(label) {
    const res = await page.evaluate(async () => {
      const r = await window.axe.run(document, {
        resultTypes: ['violations'],
        rules: { 'color-contrast': { enabled: false } }
      });
      return r.violations.map(v => ({
        id: v.id, impact: v.impact,
        targets: v.nodes.slice(0, 3).map(n => n.target.join(' '))
      }));
    });
    assert(res.length === 0, 'axe-core clean: ' + label +
      (res.length ? ' — ' + res.map(v => v.id + '(' + v.impact + ') @ ' + v.targets.join(', ')).join(' | ') : ''));
  }

  /* ---- 1. document basics a screen reader depends on --------------------- */

  assert(await page.$eval('html', el => el.getAttribute('lang')) === 'en', 'html lang="en" set (SR pronunciation)');
  assert((await page.title()).length > 0, 'document has a title');
  assert(await page.$('main') !== null, 'main landmark present');
  assert(await page.$('nav[aria-label] [role="tablist"][aria-label]') !== null, 'labeled tablist inside a labeled nav landmark');
  assert(await page.$eval('#controlbar-score', el => el.getAttribute('aria-live')) === 'polite', 'score changes are announced (aria-live)');

  {
    const { nodes } = await axTree();
    assert(nodes.some(n => n.role === 'heading' && /get good/i.test(n.name || '')), 'h1 exposed as heading in AX tree');
    const tabs = nodes.filter(n => n.role === 'tab');
    assert(tabs.length === 5, 'all 5 phase tabs exposed with role=tab (got ' + tabs.length + ')');
    assert(tabs.filter(t => t.selected).length === 1, 'exactly one tab reads as selected');
    assert(tabs.every(t => (t.name || '').trim().length > 0), 'every tab has an accessible name');
  }

  /* ---- 2. THE core guarantee: unselectable text is still readable -------- */
  /* For every phase: user-select is none (pedagogy intact) AND the mission
     brief + every skill label are present in the accessibility tree. */

  const tabEls = await page.$$('.tab');
  for (let i = 0; i < tabEls.length; i++) {
    await tabEls[i].click();
    await new Promise(r => setTimeout(r, 80));
    const id = await page.$eval('.tab--active .tab__phase', el => el.textContent);

    const sel = await page.$eval('.phase--active .mission', el => getComputedStyle(el).userSelect);
    assert(sel === 'none', 'phase ' + id + ': mission stays unselectable (pedagogy)');

    const dom = await page.evaluate(() => ({
      brief: document.querySelector('.phase--active .mission__brief').textContent,
      skills: Array.from(document.querySelectorAll('.phase--active .skill__label')).map(el => el.textContent),
      title: document.querySelector('.phase--active .mission__title').textContent
    }));
    const { text } = await axTree();
    assert(text.includes(squash(dom.title)), 'phase ' + id + ': mission title readable by screen reader');
    assert(text.includes(squash(dom.brief)), 'phase ' + id + ': mission brief readable by screen reader');
    const missing = dom.skills.filter(s => !text.includes(squash(s)));
    assert(missing.length === 0, 'phase ' + id + ': all ' + dom.skills.length + ' skill labels readable' +
      (missing.length ? ' — MISSING: ' + missing.join(' | ') : ''));

    await runAxe('phase ' + id);
  }

  /* nothing instructional may sit inside aria-hidden — only decorative bits */
  const badHidden = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-hidden="true"]'))
      .filter(el => el.tagName.toLowerCase() !== 'svg' && el.textContent.trim() !== '')
      .map(el => el.className || el.tagName)
  );
  assert(badHidden.length === 0, 'aria-hidden only on decorative elements' + (badHidden.length ? ' — FOUND ON: ' + badHidden.join(', ') : ''));

  /* ---- 3. phase 3 code snippets (also unselectable) reach the AX tree ---- */

  await tabEls[3].click();
  await new Promise(r => setTimeout(r, 80));
  await type('git branch');
  await type('git branch nested-conditionals');
  await type('git switch nested-conditionals');
  {
    const snippet = await page.$eval('.phase--active .skill--current .mission__snippet', el => el.textContent);
    const { text } = await axTree();
    assert(text.includes(squash(snippet)), 'phase 3: unselectable code snippet readable by screen reader');
  }

  /* ---- 4. terminal: input labeled, paste block announced ----------------- */

  await tabEls[0].click();
  await new Promise(r => setTimeout(r, 80));
  {
    const { nodes } = await axTree();
    assert(nodes.some(n => n.role === 'textbox' && n.name === 'Terminal command input'),
      'terminal input exposed as labeled textbox');
  }

  /* the paste-refusal must be ANNOUNCED, not just flashed on screen */
  await page.evaluate(() => {
    const input = document.querySelector('.phase--active .terminal__input');
    const dt = new DataTransfer();
    dt.setData('text/plain', 'git push --force');
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, cancelable: true, bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 100));
  {
    const notice = await page.$eval('.phase--active .terminal__notice', el => ({
      role: el.getAttribute('role'),
      live: el.getAttribute('aria-live'),
      text: el.textContent
    }));
    assert(notice.role === 'status' && notice.live === 'polite', 'paste notice is a live region (role=status, polite)');
    const { text } = await axTree();
    assert(text.includes(squash(notice.text)), 'paste-blocked explanation readable by screen reader');
  }

  /* ---- 5. editor dialog: role, label, focus in, Escape out --------------- */

  await type('git clone https://github.com/student/age_safe.git');
  await type('cd age_safe');
  await type('edit age_safe.py');
  await page.waitForSelector('#editor:not([hidden])');
  {
    const dialog = await page.evaluate(() => {
      const win = document.querySelector('.editor__window');
      const labelId = win.getAttribute('aria-labelledby');
      const labelEl = labelId && document.getElementById(labelId);
      return {
        role: win.getAttribute('role'),
        modal: win.getAttribute('aria-modal'),
        labelText: labelEl ? labelEl.textContent.trim() : '',
        focusInside: win.contains(document.activeElement),
        closeLabeled: !!document.querySelector('.editor__close[aria-label]')
      };
    });
    assert(dialog.role === 'dialog' && dialog.modal === 'true', 'editor is role=dialog aria-modal');
    assert(dialog.labelText.length > 0, 'dialog labeled by filename (' + dialog.labelText + ')');
    assert(dialog.focusInside, 'focus moves INTO the dialog when it opens');
    assert(dialog.closeLabeled, 'icon-only close button has an aria-label');

    const { text } = await axTree();
    const worked = await page.$eval('#editor-worked', el => el.textContent);
    assert(text.includes(squash(worked)), 'Done Coding message readable by screen reader');
  }
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 60));
  assert(await page.$eval('#editor', el => el.hidden), 'Escape closes the dialog (keyboard operable)');
  await runAxe('editor dialog state');

  /* ---- 6. everything reachable by keyboard alone -------------------------- */

  {
    await page.evaluate(() => document.body.focus());
    const want = { tab: false, control: false, terminal: false, reset: false };
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const cls = await page.evaluate(() => {
        const el = document.activeElement;
        return (el.className || '') + ' #' + (el.id || '');
      });
      if (/\btab\b/.test(cls)) want.tab = true;
      if (/#font-|#theme-toggle/.test(cls)) want.control = true;
      if (/terminal__input/.test(cls)) want.terminal = true;
      if (/btn--reset/.test(cls)) want.reset = true;
    }
    assert(want.control, 'control bar reachable by Tab key');
    assert(want.tab, 'phase tabs reachable by Tab key');
    assert(want.terminal, 'terminal input reachable by Tab key');
    assert(want.reset, 'reset button reachable by Tab key');
  }

  assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

  await browser.close();
  console.log('\n' + (failures ? failures + ' FAILURES' : 'ALL ACCESSIBILITY TESTS PASSED'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
