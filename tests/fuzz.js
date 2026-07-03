/* Fuzz the command engine: random garbage, huge inputs, quote abuse, and
   random valid-command sequences against every phase seed. Any uncaught
   throw = the bug that kills the terminal. */

const fs = require('fs');
const path = require('path');

global.window = {};
const ROOT = path.join(__dirname, '..');
for (const f of ['js/state.js', 'js/git.js', 'js/curriculum.js']) {
  eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
}
const GG = global.window.GG;

const vocab = [
  'git', 'clone', 'init', 'status', 'add', 'commit', 'push', 'pull', 'log',
  'branch', 'switch', 'checkout', 'merge', 'remote', '-m', '-u', '-M', '-d',
  '-c', '-b', '-v', '--oneline', '--abort', '--all', '.', '..', 'origin',
  'main', 'master', 'age-safe', 'age_safe.py', 'README.md', 'ages.txt',
  'https://github.com/student/age-safe.git', 'nested-conditionals',
  'parallel-conditionals', 'ls', 'cd', 'cat', 'edit', 'touch', 'pwd',
  'clear', 'help', '"hello world"', '"', "'", '""', "''", '-', '--', '---',
  'nonsense', '<script>', '&&', '|', ';', '$(rm -rf)', '`x`', '\\', '/',
  'ThisIsAReallyLongTokenWithoutAnySpacesInItAtAllWhatsoeverHonestly'
];

function randInt(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[randInt(arr.length)]; }

function randomLine() {
  const style = randInt(6);
  if (style === 0) {
    // pure garbage string with weird chars
    let s = '';
    const chars = 'abc XYZ0123"\'-.$#@!%^&*(){}[]<>~`|\\/;:な😀\t';
    const len = randInt(200) + 1;
    for (let i = 0; i < len; i++) s += chars[randInt(chars.length)];
    return s;
  }
  if (style === 1) {
    // huge line
    return pick(['git commit -m "', 'echo ', 'git add ', '']) + 'x'.repeat(2000 + randInt(8000)) + (randInt(2) ? '"' : '');
  }
  // random token soup
  const n = randInt(8) + 1;
  const parts = [];
  for (let i = 0; i < n; i++) parts.push(pick(vocab));
  return parts.join(' ');
}

let crashes = 0;
let runs = 0;

for (const seedId of ['1A', '1B', '2', '3', '4']) {
  for (let trial = 0; trial < 40; trial++) {
    const scn = GG.state.seeds[seedId]();
    for (let i = 0; i < 60; i++) {
      const line = randomLine();
      runs++;
      try {
        const r = GG.git.run(line, scn);
        if (!r || !Array.isArray(r.lines)) {
          crashes++;
          console.log('BAD RETURN [' + seedId + ']: ' + JSON.stringify(line.slice(0, 120)));
        }
      } catch (e) {
        crashes++;
        console.log('CRASH [' + seedId + ']: ' + JSON.stringify(line.slice(0, 120)));
        console.log('   ' + e.stack.split('\n').slice(0, 3).join('\n   '));
      }
    }
  }
}

// targeted nasties
const targeted = [
  'git commit -m "' + 'a'.repeat(50000) + '"',
  'a'.repeat(100000),
  'git ' + 'add '.repeat(2000),
  'git add ' + Array.from({ length: 500 }, (_, i) => 'file' + i + '.py').join(' '),
  'git commit -m',
  'git commit -m ' + '"'.repeat(101),
  'cd ' + 'x'.repeat(10000),
  'git clone ' + 'y'.repeat(10000),
  'git branch ' + 'z'.repeat(10000),
  'touch ' + 'w'.repeat(10000),
  '"' + 'q'.repeat(9999),
  '\t\t\t   \t',
  'git\tstatus',
  'git  status',
  'git status ' + '--verbose '.repeat(100)
];
for (const seedId of ['1A', '2', '4']) {
  const scn = GG.state.seeds[seedId]();
  GG.git.run('git clone https://github.com/student/age-safe.git', scn);
  GG.git.run('cd age-safe', scn);
  for (const line of targeted) {
    runs++;
    try {
      GG.git.run(line, scn);
    } catch (e) {
      crashes++;
      console.log('CRASH targeted [' + seedId + ']: ' + JSON.stringify(line.slice(0, 80)));
      console.log('   ' + e.stack.split('\n').slice(0, 3).join('\n   '));
    }
  }
}

console.log('\n' + runs + ' commands fuzzed, ' + crashes + ' crashes');
process.exit(crashes ? 1 : 0);
