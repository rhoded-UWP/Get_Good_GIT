/* Overflow audit: drives the page into text-heavy states (long commit
   message, branch with refs, merge state) and asserts no element inside the
   panel/mission cards renders wider than its card. */

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
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href, { waitUntil: 'networkidle0' });

  async function type(cmd) {
    await page.click('.phase--active .terminal__body');
    await page.keyboard.type(cmd, { delay: 1 });
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 50));
  }

  /** every descendant of each card must fit inside the card's content box */
  async function auditOverflow(tag) {
    const offenders = await page.evaluate(() => {
      const bad = [];
      const cards = document.querySelectorAll(
        '.phase--active .panel__section, .phase--active .mission, .phase--active .skill'
      );
      cards.forEach(card => {
        const cr = card.getBoundingClientRect();
        card.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          // allow snippet inner scroll (overflow-x auto keeps it inside)
          if (el.closest('.mission__snippet')) return;
          if (r.right > cr.right + 1 || r.left < cr.left - 1) {
            bad.push(el.className + ' :: "' + (el.textContent || '').slice(0, 40) + '" right=' +
              Math.round(r.right) + ' cardRight=' + Math.round(cr.right));
          }
        });
      });
      return bad;
    });
    assert(offenders.length === 0, tag + ': no text exceeds card boundaries' +
      (offenders.length ? '\n       -> ' + offenders.join('\n       -> ') : ''));
  }

  for (const width of [1366, 1000, 800]) {
    await page.setViewport({ width, height: 900 });

    // fresh phase 1A with a very long commit message
    await page.evaluate(() => document.querySelectorAll('.tab')[0].click());
    await new Promise(r => setTimeout(r, 50));
    await page.click('.phase--active .btn--reset');
    await new Promise(r => setTimeout(r, 50));
    await type('git clone https://github.com/student/age-safe.git');
    await type('cd age-safe');
    await type('edit age_safe.py');
    await page.waitForSelector('#editor:not([hidden])');
    await page.click('#editor-textarea');
    await page.keyboard.press('End');
    await page.keyboard.type('\n# x');
    await page.click('#editor-save');
    await new Promise(r => setTimeout(r, 50));
    await type('git add .');
    await type('git commit -m "ThisIsAnExtremelyLongUnbrokenCommitMessageThatAStudentMightAbsolutelyTypeOneDay because why not add even more words"');
    await auditOverflow(width + 'px phase 1A long commit');

    // phase 4 merge state: long refs + branch names + conflict
    await page.evaluate(() => document.querySelectorAll('.tab')[4].click());
    await new Promise(r => setTimeout(r, 50));
    await page.click('.phase--active .btn--reset');
    await new Promise(r => setTimeout(r, 50));
    await type('git switch main');
    await type('git pull');
    await type('git merge parallel-conditionals');
    await auditOverflow(width + 'px phase 4 merge conflict');

    // phase 3: unpublished branch (long upstream warning text)
    await page.evaluate(() => document.querySelectorAll('.tab')[3].click());
    await new Promise(r => setTimeout(r, 50));
    await page.click('.phase--active .btn--reset');
    await new Promise(r => setTimeout(r, 50));
    await type('git switch -c super-extremely-long-branch-name-for-testing-overflow');
    await auditOverflow(width + 'px phase 3 long branch name');
  }

  await page.setViewport({ width: 1366, height: 900 });
  await page.evaluate(() => document.querySelectorAll('.tab')[0].click());
  await new Promise(r => setTimeout(r, 100));
  await page.screenshot({ path: path.join(__dirname, 'shots', 'overflow-check.png') });

  await browser.close();
  console.log('\n' + (failures ? failures + ' FAILURES' : 'ALL OVERFLOW CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
