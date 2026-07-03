/* Reproduce the "terminal goes blank" report: huge single lines, marathon
   command volume, and natural-language typing. After each abuse, check the
   terminal still shows content and a live prompt. */

const puppeteer = require('puppeteer-core');
const path = require('path');

let failures = 0;
function assert(cond, label) {
  console.log((cond ? '  ok  ' : '  FAIL ') + label);
  if (!cond) failures++;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href, { waitUntil: 'networkidle0' });

  async function health(tag) {
    const h = await page.evaluate(() => {
      const body = document.querySelector('.phase--active .terminal__body');
      const input = document.querySelector('.phase--active .terminal__input');
      const caret = document.querySelector('.phase--active .terminal__caret');
      const r = body.getBoundingClientRect();
      // is any text visibly rendered inside the terminal viewport?
      const visibleText = body.textContent.trim().length > 0;
      return {
        children: body.children.length,
        visibleText,
        hasInput: !!input,
        hasCaret: !!caret,
        bodyVisible: r.width > 100 && r.height > 100,
        scrollHeight: body.scrollHeight
      };
    });
    const alive = h.visibleText && h.hasInput && h.hasCaret && h.bodyVisible;
    assert(alive, tag + ' — terminal alive (children=' + h.children + ', scrollH=' + h.scrollHeight + ')');
    return h;
  }

  // set input value directly (typing 30k chars via keyboard is too slow),
  // then type the tail for realism and submit
  async function typeHuge(chars) {
    await page.click('.phase--active .terminal__body');
    await page.evaluate((n) => {
      const input = document.querySelector('.phase--active .terminal__input');
      input.value = 'x'.repeat(n);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, chars);
    await page.keyboard.type('tail');
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 120));
  }

  async function type(cmd) {
    await page.click('.phase--active .terminal__body');
    await page.keyboard.type(cmd, { delay: 0 });
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 25));
  }

  await health('baseline');

  // 1: huge unbroken line (30k chars)
  await typeHuge(30000);
  await health('after 30k-char line');

  // 2: several huge quoted commit messages
  await page.evaluate(() => {
    const input = document.querySelector('.phase--active .terminal__input');
    input.value = 'git commit -m "' + 'blah '.repeat(4000) + '"';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 120));
  await health('after huge commit message');

  // 3: natural-language sentences (the way confused students type)
  await type('please clear my homework and start over thanks');
  const afterSentence = await page.evaluate(() =>
    document.querySelector('.phase--active .terminal__body').textContent.length);
  await health('after natural-language sentence');
  console.log('       (note: sentence starting with "please" -> command not found, len=' + afterSentence + ')');

  // 4: sentence starting with the word "clear" must NOT wipe the screen
  const beforeLen = await page.evaluate(() =>
    document.querySelector('.phase--active .terminal__body').textContent.length);
  await type('clear all of my files please');
  const afterClearSentence = await page.evaluate(() => {
    const t = document.querySelector('.phase--active .terminal__body').textContent;
    return { len: t.length, hasError: t.includes("Clear-Host: A positional parameter cannot be found that accepts argument 'all'") };
  });
  assert(afterClearSentence.len > beforeLen && afterClearSentence.hasError,
    'sentence starting with "clear" keeps scrollback + prints PowerShell error');

  // 5: marathon: 300 commands to bloat the scrollback (trim caps the DOM)
  for (let i = 0; i < 300; i++) {
    await type(i % 3 === 0 ? 'help' : (i % 3 === 1 ? 'git status' : 'ls'));
  }
  const marathon = await health('after 300 commands');
  assert(marathon.children <= 2501, 'scrollback capped (nodes=' + marathon.children + ')');

  // 6: bare "clear" still clears, but prints the reassurance note
  await type('clear');
  const clearNote = await page.evaluate(() =>
    document.querySelector('.phase--active .terminal__body').textContent);
  assert(clearNote.includes('screen cleared') && clearNote.includes('untouched'),
    'bare clear shows reassurance note instead of pure blank');
  await health('after clear (prompt remains)');

  // 7: forced internal failure -> auto phase reset (same as Reset button)
  await type('git clone https://github.com/student/age-safe.git'); // make some progress first
  const doneBefore = (await page.$$('.phase--active .skill--done')).length;
  assert(doneBefore >= 1, 'progress exists before forced failure (done=' + doneBefore + ')');
  await page.evaluate(() => {
    const real = window.GG.git.run;
    window.GG.git.run = function () { window.GG.git.run = real; throw new Error('forced test explosion'); };
  });
  await type('git status');
  const recovered = await page.evaluate(() => {
    const t = document.querySelector('.phase--active .terminal__body').textContent;
    return {
      notice: t.includes('reset to a clean start'),
      banner: t.includes('PHASE 1A'),
      done: document.querySelectorAll('.phase--active .skill--done').length
    };
  });
  assert(recovered.notice && recovered.banner && recovered.done === 0,
    'internal failure auto-resets the phase with explanation (done=' + recovered.done + ')');
  await type('git status');
  await health('terminal fully usable after auto-reset');

  assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();
  console.log('\n' + (failures ? failures + ' FAILURES' : 'STRESS TEST DONE'));
})().catch(e => { console.error(e); process.exit(1); });
