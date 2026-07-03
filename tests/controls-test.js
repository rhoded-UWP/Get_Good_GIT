/* Control bar test: score API, font +/- with clamps + persistence,
   theme toggle + persistence + system-preference default, sticky layout. */

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

  // system preference: dark → default theme should be dark with no stored choice
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'networkidle0' });

  assert(await page.$('.controlbar') !== null, 'control bar renders');
  assert(await page.$eval('.controlbar', el => getComputedStyle(el).position) === 'sticky', 'bar is sticky');
  assert(await page.$eval('html', el => el.getAttribute('data-theme')) === 'dark', 'defaults to system dark');

  // content not hidden behind the bar
  const layout = await page.evaluate(() => {
    const bar = document.querySelector('.controlbar').getBoundingClientRect();
    const header = document.querySelector('.header').getBoundingClientRect();
    return { barBottom: bar.bottom, headerTop: header.top };
  });
  assert(layout.headerTop >= layout.barBottom - 1, 'header starts below the bar (nothing hidden)');

  // bar stays visible after scrolling
  await page.evaluate(() => window.scrollTo(0, 600));
  await new Promise(r => setTimeout(r, 100));
  const stuckTop = await page.$eval('.controlbar', el => el.getBoundingClientRect().top);
  assert(stuckTop === 0, 'bar pinned to top while scrolled');
  await page.evaluate(() => window.scrollTo(0, 0));

  // --- score API ---
  assert(await page.$eval('#controlbar-score', el => el.textContent) === '0', 'score defaults to 0');
  await page.evaluate(() => window.GG.score.add(25));
  assert(await page.$eval('#controlbar-score', el => el.textContent) === '25', 'GG.score.add updates display');
  await page.evaluate(() => window.GG.score.set(100));
  assert(await page.$eval('#controlbar-score', el => el.textContent) === '100', 'GG.score.set updates display');

  // --- font controls ---
  const rootSize = () => page.$eval('html', el => getComputedStyle(el).fontSize);
  assert(await rootSize() === '16px', 'default root font 16px');
  await page.click('#font-plus');
  await page.click('#font-plus');
  assert(await rootSize() === '18px', 'two plus clicks -> 18px');
  assert(await page.$eval('#font-value', el => el.textContent) === '18px', 'readout shows 18px');
  // terminal text scales too (0.875rem of 18px = 15.75px)
  const termSize = await page.$eval('.phase--active .terminal__body', el => getComputedStyle(el).fontSize);
  assert(termSize === '15.75px', 'terminal text scales with root (got ' + termSize + ')');

  // clamps: hammer minus far past the floor
  for (let i = 0; i < 15; i++) await page.click('#font-minus');
  assert(await rootSize() === '12px', 'clamped at 12px minimum');
  assert(await page.$eval('#font-minus', el => el.disabled), 'minus disabled at minimum');
  for (let i = 0; i < 15; i++) await page.click('#font-plus');
  assert(await rootSize() === '22px', 'clamped at 22px maximum');
  assert(await page.$eval('#font-plus', el => el.disabled), 'plus disabled at maximum');

  // persistence across reload
  await page.click('#font-minus'); // 21px
  await page.reload({ waitUntil: 'networkidle0' });
  assert(await rootSize() === '21px', 'font size survives reload');

  // --- theme toggle ---
  await page.click('#theme-toggle');
  assert(await page.$eval('html', el => el.getAttribute('data-theme')) === 'light', 'toggle switches to light');
  const lightBg = await page.$eval('body', el => getComputedStyle(el).backgroundColor);
  assert(lightBg === 'rgb(242, 245, 250)', 'light background applied (got ' + lightBg + ')');
  const termBg = await page.$eval('.phase--active .terminal__body', el => getComputedStyle(el.closest('.terminal')).backgroundColor);
  assert(termBg === 'rgb(255, 255, 255)', 'terminal goes VS Code Light+ (got ' + termBg + ')');
  const aria = await page.$eval('#theme-toggle', el => el.getAttribute('aria-label'));
  assert(aria === 'Switch to dark mode', 'toggle aria-label flips');

  await page.reload({ waitUntil: 'networkidle0' });
  assert(await page.$eval('html', el => el.getAttribute('data-theme')) === 'light', 'theme survives reload');
  await page.click('#theme-toggle');
  assert(await page.$eval('html', el => el.getAttribute('data-theme')) === 'dark', 'toggle back to dark');

  // system preference: light → fresh visitor gets light
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.reload({ waitUntil: 'networkidle0' });
  assert(await page.$eval('html', el => el.getAttribute('data-theme')) === 'light', 'fresh visitor follows system light preference');

  // mobile: all three controls visible and inside viewport at 375px
  await page.setViewport({ width: 375, height: 700 });
  await new Promise(r => setTimeout(r, 100));
  const mobile = await page.evaluate(() => {
    const ids = ['controlbar-score', 'font-minus', 'font-plus', 'theme-toggle'];
    return ids.every(id => {
      const r = document.getElementById(id).getBoundingClientRect();
      return r.width > 0 && r.right <= window.innerWidth + 1 && r.left >= -1;
    });
  });
  assert(mobile, 'all controls usable at 375px');
  await page.screenshot({ path: path.join(__dirname, 'shots', 'controlbar-light.png') });

  // reset to dark + 16px so the teacher's next manual open is default
  await page.setViewport({ width: 1366, height: 900 });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

  await browser.close();
  console.log('\n' + (failures ? failures + ' FAILURES' : 'ALL CONTROL BAR TESTS PASSED'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
