// contracts.test.js — the two checks that would have caught the bugs that
// reached a child's iPad, and that no amount of "does the source mention it"
// testing can catch.
//
// Most of this suite verifies behaviour by reading source text. That style
// proves code was not deleted; it cannot prove code works. Two whole classes
// of defect slipped past it in one week:
//
//   1. A call to a function that does not exist. js/math-fight.js called
//      EngAuth.userIdFor(), which was never an export, so the win/loss check
//      silently fell through to guessing from the scores — and a child who
//      walked away while ahead was congratulated for winning.
//   2. An asset path that resolves somewhere else. The yard pet's sprite was
//      handed to CSS as a custom property, where a RELATIVE url() resolves
//      against the stylesheet, not the page: img/night-raid/x.png became
//      /css/img/night-raid/x.png. Pages answered it with the SPA fallback at
//      status 200, so nothing looked broken and the dog was invisible.
//
// Both checks are cheap, run in the normal suite, and fail loudly.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const jsFiles = fs.readdirSync(path.join(root, 'js'))
  .filter(f => f.endsWith('.js') && f !== 'phaser.min.js');

// ---------------------------------------------------------------------------
// 1. Every Module.method() call must be something that module actually exports
// ---------------------------------------------------------------------------

// Modules that publish a single frozen/plain object at the end of an IIFE.
// Anything called as `Name.thing(` in any file must appear in that list.
const MODULES = {
  EngAuth: 'js/auth.js',
  NightRaid: 'js/night-raid.js',
  NightRaidRules: 'js/night-raid-rules.js',
  NightRaidChoreo: 'js/night-raid-choreo.js',
  MathFight: 'js/math-fight.js',
  MathFightRules: 'js/math-fight-rules.js',
};

// The export block is the last `return {...}` / `return Object.freeze({...})`
// in the file. Keys may be shorthand (`open`) or renamed (`api: doApi`).
function exportedNames(src) {
  const marks = [...src.matchAll(/return\s+(?:Object\.freeze\()?\{/g)];
  if (!marks.length) return null;
  const start = marks[marks.length - 1].index + marks[marks.length - 1][0].length - 1;
  let depth = 0, end = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) { end = i; break; } }
  }
  if (end < 0) return null;
  // Split on top-level commas rather than matching key,key,key: a regex that
  // consumes the separator swallows every other name, which is exactly the
  // false alarm this file caught itself producing the first time it ran.
  const body = src.slice(start + 1, end);
  const names = new Set();
  let nest = 0, piece = '';
  const take = () => {
    const m = piece.match(/^\s*([A-Za-z_$][\w$]*)\s*(?::|$)/);
    if (m) names.add(m[1]);
    piece = '';
  };
  for (const ch of body) {
    if ('([{'.includes(ch)) nest++;
    else if (')]}'.includes(ch)) nest--;
    if (ch === ',' && nest === 0) take(); else piece += ch;
  }
  take();
  return names;
}

suite('contracts: every call lands on something real', () => {
  test('each module publishes an export list this test can read', () => {
    for (const [name, file] of Object.entries(MODULES)) {
      const names = exportedNames(read(file));
      assert.truthy(names && names.size > 0, name + ' has no readable export block');
    }
  });

  test('no file calls a module method that does not exist', () => {
    const exports = {};
    for (const [name, file] of Object.entries(MODULES)) exports[name] = exportedNames(read(file));

    const missing = [];
    for (const file of jsFiles) {
      const src = read('js/' + file);
      for (const name of Object.keys(MODULES)) {
        // `EngAuth.foo(` — a call, not a property read, so a feature-detect
        // like `typeof X.foo === 'function'` is not flagged.
        for (const m of src.matchAll(new RegExp('\\b' + name + '\\.([A-Za-z_$][\\w$]*)\\s*\\(', 'g'))) {
          const method = m[1];
          if (exports[name].has(method)) continue;
          // A guarded call is a deliberate optional dependency: `X.foo && X.foo()`
          // or `X.foo ? … : …`. Those are allowed to be absent.
          const before = src.slice(Math.max(0, m.index - 90), m.index);
          if (new RegExp(name + '\\.' + method + '\\s*(?:&&|\\?|\\|\\|)').test(before)) continue;
          if (new RegExp('typeof\\s+' + name + '\\.' + method).test(before)) continue;
          missing.push('js/' + file + ' calls ' + name + '.' + method + '() — not exported');
        }
      }
    }
    assert.deepEqual(missing, [], missing.join('\n'));
  });
});

// ---------------------------------------------------------------------------
// 2. Every asset a file names must exist, and must resolve from the page
// ---------------------------------------------------------------------------

const ASSET_RE = /['"`(]((?:\/)?(?:img|audio|assets)\/[A-Za-z0-9_\-./]+\.(?:png|webp|jpg|jpeg|svg|gif|mp3))['"`)]/g;

suite('contracts: every asset path points at a real file', () => {
  test('asset paths written in JS and CSS exist on disk', () => {
    const missing = [];
    const files = jsFiles.map(f => 'js/' + f).concat(['css/styles.css', 'index.html', 'admin.html']);
    for (const file of files) {
      const src = read(file);
      for (const m of src.matchAll(ASSET_RE)) {
        const rel = m[1].replace(/^\//, '');
        // Word recordings live in their own Pages project, not this repo.
        if (rel.startsWith('audio/words/')) continue;
        if (!fs.existsSync(path.join(root, rel))) missing.push(file + ' → ' + m[1]);
      }
    }
    assert.deepEqual(missing, [], missing.join('\n'));
  });

  test('a url() handed to CSS through a variable is root-absolute', () => {
    // This is the one that made the patrolling dog invisible. A relative url()
    // inside a custom property is resolved against the stylesheet that CONSUMES
    // the variable, so it must be written from the site root instead.
    const offenders = [];
    for (const file of jsFiles) {
      const src = read('js/' + file);
      for (const m of src.matchAll(/--[\w-]+\s*:\s*url\(\s*['"]?([^'")]+)/g)) {
        const url = m[1];
        if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('http')) continue;
        if (url.startsWith('${')) continue;          // built elsewhere; checked below
        offenders.push('js/' + file + ' → ' + url);
      }
    }
    // Template-built values: the variable they interpolate must itself be
    // root-absolute, so check the assignment that feeds it.
    for (const file of jsFiles) {
      const src = read('js/' + file);
      for (const m of src.matchAll(/--[\w-]+\s*:\s*url\('\$\{(\w+)\}'\)/g)) {
        const varName = m[1];
        const decl = src.match(new RegExp(varName + "\\s*=\\s*`([^`]+)`"));
        if (decl && !decl[1].startsWith('/') && !decl[1].startsWith('$')) {
          offenders.push('js/' + file + ' → ' + varName + ' = ' + decl[1]);
        }
      }
    }
    assert.deepEqual(offenders, [], offenders.join('\n'));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
