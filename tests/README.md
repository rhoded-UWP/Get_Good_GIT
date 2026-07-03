# Test Suites

Automated tests for the simulator. The engine tests are pure Node; the rest
drive the real page in a headless browser via `puppeteer-core`, using the
Microsoft Edge already installed on Windows (no browser download needed).

## Setup (once)

```
cd tests
npm install
```

## Running

| Command | What it checks |
|---------|----------------|
| `npm run engine` | Full student walkthrough of all 5 phases against the command engine: every skill completes, every error path prints the real Git message |
| `npm run fuzz` | ~12,000 randomized/hostile command lines against every phase seed — any crash fails |
| `npm run ui` | Drives the real page: typing, cloning, `dir`/`ls`, Done Coding modal, Phase 5 conflict editor, paste blocking, tab progress |
| `npm run controls` | Control bar: score API, font clamps + persistence, theme toggle + system-preference default, sticky layout, 375px usability |
| `npm run stress` | Blank-screen defenses: 30k-char lines, `clear`-with-args, 300-command marathons, forced internal failure → auto phase reset |
| `npm run watchdog` | Blank-terminal watchdog: wiped scrollback / dead input auto-reset; no false positive while the editor modal is open |
| `npm run overflow` | Text never exceeds card boundaries across widths and wordy states |
| `npm run a11y` | Screen-reader accessibility: unselectable instructions + blocked paste still reach the accessibility tree; ARIA roles/labels, focus, keyboard reachability; axe-core (WCAG) clean on every phase + the editor |
| `npm run all` | Everything, in sequence |

Screenshots from failures/checkpoints land in `tests/shots/` (git-ignored).

If Edge lives somewhere unusual, point the tests at it:

```
$env:EDGE_PATH = 'D:\wherever\msedge.exe'
```

Chrome works too — set `EDGE_PATH` to `chrome.exe`.
