/* Shared headless-Edge launcher for every browser suite.

   Edge 149+ on Windows turned msedge.exe into a launcher process that hands
   off to the real browser and exits immediately — puppeteer.launch() sees
   its child die and reports "Failed to launch the browser process!" even
   though the browser is running fine. So: try the normal launch first (older
   Edge, or Chrome via EDGE_PATH), and when it fails, start Edge ourselves
   with a debugging port and connect over CDP. */

const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EXE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/* a profile dir WE own. Passing this to puppeteer.launch means puppeteer
   treats the profile as user-managed and will NOT try to delete it on close,
   which on Windows races Edge's file lock and throws EBUSY. We leave the dir
   for the OS temp sweeper. */
function freshProfile() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gg-edge-'));
}

async function launch() {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: EXE,
      headless: 'new',
      args: ['--no-sandbox'],
      userDataDir: freshProfile()
    });
  } catch (e) {
    browser = await connectToManuallyStartedEdge();
  }
  /* belt and suspenders: swallow any residual cleanup error on close */
  const origClose = browser.close.bind(browser);
  browser.close = async function () {
    try { await origClose(); } catch (e) {}
  };
  return browser;
}

async function connectToManuallyStartedEdge() {
  const port = 9333 + Math.floor(Math.random() * 400);
  const profile = freshProfile();
  spawn(EXE, [
    '--headless=new',
    '--no-sandbox',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile
  ], { detached: true, stdio: 'ignore' }).unref();

  const deadline = Date.now() + 20000;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/version');
      const info = await res.json();
      // defaultViewport null lets each suite's page.setViewport() win
      return await puppeteer.connect({
        browserWSEndpoint: info.webSocketDebuggerUrl,
        defaultViewport: null
      });
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 250));
    }
  }
  throw new Error('Edge never opened its debugging port: ' + (lastErr && lastErr.message));
}

module.exports = { launch };
