// tests/css-split.test.js — the stylesheet split.
//
// css/styles.css was one 664 kB render-blocking file, and ~38% of it styled
// screens Home never shows. The farm's rules now live in css/night-raid.css,
// appended as <link rel="stylesheet"> by js/lazy-data.js when its screen is
// opened. This file
// guards the four things that would let that quietly rot:
//
//   • the two feature files exist, are precached by sw.js, and are listed in
//     LazyData.SCREEN_FILES for the screens that render their classes;
//   • LazyData.loadFile really appends a <link> for a .css entry and resolves
//     on load AND on error (a stylesheet that 404s must not hang the tab);
//   • no selector is defined in more than one stylesheet — a rule that exists
//     in two files is decided by load order, which differs per session;
//   • styles.css stays under a size ceiling, so nothing lands back in the
//     startup path without someone raising the number on purpose.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const CORE = 'css/styles.css';
const FEATURE_FILES = ['css/night-raid.css'];
const ALL = [CORE].concat(FEATURE_FILES);

// Raise this ONLY with a reason: it is the whole point of the split.
// 2026-09-11: 379 kB after the split (was 664 kB).
const STYLES_CSS_MAX_BYTES = 400 * 1024;

// ---------------------------------------------------------------------------
// A small CSS reader: top-level rules, and rules inside @media/@supports,
// with their selector lists split and normalised. Enough to compare files.
// ---------------------------------------------------------------------------
function readRules(text) {
  const out = [];
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
  function matchBrace(t, open) {
    let d = 0;
    for (let i = open; i < t.length; i++) {
      const c = t[i];
      if (c === '"' || c === "'") { const q = c; i++; while (i < t.length && t[i] !== q) { if (t[i] === '\\') i++; i++; } continue; }
      if (c === '{') d++;
      else if (c === '}') { d--; if (d === 0) return i + 1; }
    }
    throw new Error('unbalanced braces');
  }
  function walk(t, s, e, ctx) {
    let i = s;
    while (i < e) {
      if (/\s/.test(t[i])) { i++; continue; }
      let j = i;
      while (j < e && t[j] !== '{' && t[j] !== ';') j++;
      if (t[j] === ';' || j >= e) { i = j + 1; continue; }
      const close = matchBrace(t, j);
      const head = t.slice(i, j).replace(/\s+/g, ' ').trim();
      if (/^@(media|supports|layer|container)/.test(head)) walk(t, j + 1, close - 1, ctx.concat(head));
      else if (head[0] === '@') out.push({ ctx, at: head, selectors: [] });
      else {
        const selectors = splitTop(head).map(x => x.replace(/\s*([>+~])\s*/g, '$1').replace(/'/g, '"').trim()).filter(Boolean);
        out.push({ ctx, selectors, body: t.slice(j + 1, close - 1) });
      }
      i = close;
    }
  }
  function splitTop(sel) {
    const parts = []; let depth = 0, cur = '';
    for (const c of sel) {
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts;
  }
  const clean = strip(text);
  walk(clean, 0, clean.length, []);
  return out;
}

// ---------------------------------------------------------------------------
// The files
// ---------------------------------------------------------------------------
suite('css split: the feature stylesheets exist and are real', () => {
  for (const f of FEATURE_FILES) {
    test(`${f} exists and holds rules`, () => {
      assert.truthy(fs.existsSync(path.join(ROOT, f)), f + ' is missing');
      const rules = readRules(read(f));
      assert.truthy(rules.length > 100, `${f} has only ${rules.length} rules — was the split undone?`);
    });
  }

  test('css/styles.css stays under the ceiling', () => {
    const size = fs.statSync(path.join(ROOT, CORE)).size;
    assert.truthy(size <= STYLES_CSS_MAX_BYTES,
      `css/styles.css is ${size} bytes, ceiling ${STYLES_CSS_MAX_BYTES}. Rules that only a lazily styled screen ` +
      'needs belong in css/night-raid.css; raise the ceiling only for core UI.');
  });

  test('every stylesheet parses (balanced braces)', () => {
    for (const f of ALL) readRules(read(f));
  });

  test('relative url() assets in the feature files resolve from css/', () => {
    const missing = [];
    for (const f of FEATURE_FILES) {
      for (const m of read(f).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        const u = m[1];
        if (/^(data:|https?:|\/|#)/.test(u)) continue;   // # = an SVG fragment in the page
        const rel = path.normalize(path.join('css', u.split('?')[0]));
        if (!fs.existsSync(path.join(ROOT, rel))) missing.push(f + ' → ' + u);
      }
    }
    assert.deepEqual(missing, [], missing.join('\n'));
  });
});

// ---------------------------------------------------------------------------
// Precache + SCREEN_FILES
// ---------------------------------------------------------------------------
suite('css split: precached and wired into LazyData', () => {
  const sw = read('sw.js');
  const block = sw.match(/const PRECACHE\s*=\s*\{([\s\S]*?)\};/);
  const precached = block ? [...block[1].matchAll(/'(\/[^']*)'\s*:/g)].map(m => m[1]) : [];

  for (const f of FEATURE_FILES) {
    test(`sw.js precaches /${f}`, () => {
      assert.contains(precached, '/' + f, 'offline Nông trại / Book would open unstyled');
    });
  }

  const LazyData = require(path.join(ROOT, 'js', 'lazy-data.js'));
  const wants = {
    nightRaidScreen: ['css/night-raid.css'],
  };
  for (const [screen, files] of Object.entries(wants)) {
    for (const f of files) {
      test(`SCREEN_FILES.${screen} lists ${f}`, () => {
        assert.contains(LazyData.SCREEN_FILES[screen] || [], f);
      });
    }
  }

  test('every .css in SCREEN_FILES is a known feature file, and each is used', () => {
    const listed = new Set();
    for (const files of Object.values(LazyData.SCREEN_FILES)) for (const f of files) if (/\.css$/.test(f)) listed.add(f);
    for (const f of listed) assert.contains(FEATURE_FILES, f, `${f} is lazily loaded but not a known feature sheet`);
    for (const f of FEATURE_FILES) assert.truthy(listed.has(f), `${f} is never loaded by any screen`);
  });

  test('the stylesheet is listed first in its screen, so it is requested first', () => {
    const files = LazyData.SCREEN_FILES.nightRaidScreen;
    assert.equal(files[0], 'css/night-raid.css');
  });
});

// ---------------------------------------------------------------------------
// loadFile really handles .css — executed, not grepped
// ---------------------------------------------------------------------------
function bootLazyData() {
  const appended = [];
  const document = {
    head: { appendChild(el) { appended.push(el); return el; } },
    createElement(tag) { return { tagName: tag.toUpperCase() }; },
  };
  const sandbox = { document, console: { warn() {} }, localStorage: { getItem() { return null; }, setItem() {} },
    setTimeout, module: { exports: {} } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('js/lazy-data.js'), sandbox, { filename: 'js/lazy-data.js' });
  return { LazyData: sandbox.LazyData, appended };
}

suite('css split: LazyData.loadFile appends a <link> for a .css entry', () => {
  test('ensure(nightRaidScreen) appends <link rel="stylesheet" href="css/night-raid.css"> and resolves on load', async () => {
    const { LazyData, appended } = bootLazyData();
    assert.falsy(LazyData.ready('nightRaidScreen'));
    assert.deepEqual(LazyData.pendingCss('nightRaidScreen'), ['css/night-raid.css']);
    let settled = false;
    const p = LazyData.ensure('nightRaidScreen').then(() => { settled = true; });
    const link = appended.find(el => el.tagName === 'LINK');
    assert.truthy(link, 'no <link> was appended to <head>');
    assert.equal(link.rel, 'stylesheet');
    assert.equal(link.href, 'css/night-raid.css');
    assert.falsy(appended.some(el => el.tagName === 'SCRIPT' && /\.css$/.test(el.src || '')), 'a .css must never be appended as a <script>');
    // The screen's code group (GROUP_FILES.farm) rides in the same ensure();
    // let every script land first, so only the stylesheet holds the promise.
    for (const el of appended) if (el.tagName === 'SCRIPT') el.onload();
    await new Promise(r => setImmediate(r));
    assert.falsy(settled, 'resolved before the stylesheet loaded');
    link.onload();
    await p;
    assert.truthy(LazyData.ready('nightRaidScreen'));
    assert.deepEqual(LazyData.pendingCss('nightRaidScreen'), []);
  });

  test('a stylesheet that fails to load still resolves, and is retried next time', async () => {
    const { LazyData, appended } = bootLazyData();
    const p = LazyData.ensure('nightRaidScreen');
    const link = appended.find(el => el.tagName === 'LINK');
    for (const el of appended) if (el.tagName === 'SCRIPT') el.onload();
    link.onerror();
    await p;
    assert.falsy(LazyData.ready('nightRaidScreen'), 'a failed sheet must not count as loaded');
    LazyData.ensure('nightRaidScreen');
    assert.equal(appended.filter(el => el.tagName === 'LINK').length, 2, 'the failed sheet was not requested again');
  });

  test('scripts still load as <script> with async=false', async () => {
    const { LazyData, appended } = bootLazyData();
    LazyData.ensure('wordScreen');
    const scripts = appended.filter(el => el.tagName === 'SCRIPT');
    assert.equal(scripts.length, LazyData.SCREEN_FILES.wordScreen.filter(f => /\.js$/.test(f)).length);
    assert.truthy(scripts.length > 0, 'wordScreen has no bank to load');
    for (const s of scripts) assert.equal(s.async, false);
  });
});

// ---------------------------------------------------------------------------
// switchScreen hides a screen until its stylesheet is in
// ---------------------------------------------------------------------------
suite('css split: a screen never paints unstyled', () => {
  const app = read('js/app.js');
  const core = read(CORE);
  test('switchScreen marks the screen lazy-css-pending while a stylesheet is on its way', () => {
    assert.truthy(/LazyData\.pendingCss\(screenId\)/.test(app), 'app.js does not ask LazyData which stylesheets are pending');
    assert.truthy(/classList\.add\('lazy-css-pending'\)/.test(app));
    assert.truthy(/classList\.remove\('lazy-css-pending'\)/.test(app));
  });
  test('styles.css (the core sheet, always present) hides pending content but keeps the loading notice', () => {
    assert.truthy(/\.screen\.lazy-css-pending\s*>\s*:not\(\.lazy-loading\)\s*\{\s*visibility:\s*hidden;?\s*\}/.test(core));
  });
});

// ---------------------------------------------------------------------------
// Disjoint files
// ---------------------------------------------------------------------------
suite('css split: no selector is defined in more than one stylesheet', () => {
  const rulesByFile = Object.fromEntries(ALL.map(f => [f, readRules(read(f))]));

  test('selectors are disjoint across the three files', () => {
    const owner = new Map(); // selector -> file
    const clashes = [];
    for (const f of ALL) {
      const mine = new Set();
      for (const r of rulesByFile[f]) for (const s of r.selectors) mine.add(s);
      for (const s of mine) {
        if (owner.has(s) && owner.get(s) !== f) clashes.push(`${s}  (${owner.get(s)} and ${f})`);
        else owner.set(s, f);
      }
    }
    assert.deepEqual(clashes, [], 'a selector in two files is decided by load order, which changes per session:\n' + clashes.join('\n'));
  });

  test('@keyframes names are disjoint across the three files', () => {
    const owner = new Map();
    const clashes = [];
    for (const f of ALL) {
      for (const r of rulesByFile[f]) {
        if (!r.at || !/^@(-webkit-)?keyframes/.test(r.at)) continue;
        const name = r.at.replace(/^@(-webkit-)?keyframes\s+/, '');
        if (owner.has(name) && owner.get(name) !== f) clashes.push(`${name} (${owner.get(name)} and ${f})`);
        else owner.set(name, f);
      }
    }
    assert.deepEqual(clashes, [], clashes.join('\n'));
  });

  test('every @keyframes a feature file animates with is defined in that file or in styles.css', () => {
    const defined = {};
    for (const f of ALL) {
      defined[f] = new Set(rulesByFile[f].filter(r => r.at && /^@keyframes/.test(r.at)).map(r => r.at.replace(/^@keyframes\s+/, '')));
    }
    const missing = [];
    for (const f of FEATURE_FILES) {
      for (const r of rulesByFile[f]) {
        if (!r.body) continue;
        for (const m of r.body.matchAll(/(?:^|;|\s)animation(?:-name)?\s*:\s*([^;]+)/g)) {
          for (const part of m[1].split(',')) {
            const name = part.trim().split(/\s+/).find(t => /^[a-zA-Z_-][\w-]*$/.test(t) && !/^(none|infinite|normal|reverse|alternate|alternate-reverse|forwards|backwards|both|running|paused|ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)$/.test(t));
            if (name && !defined[f].has(name) && !defined[CORE].has(name)) missing.push(`${f}: ${name}`);
          }
        }
      }
    }
    assert.deepEqual(missing, [], missing.join('\n'));
  });

  test('a feature file only styles what its own modules render — no core-only class as the whole selector', () => {
    // The class every rule in a feature file hangs on must be mentioned by
    // that feature's JS (or its screen element in index.html). A rule like
    // `.home-card { … }` landing in css/night-raid.css would style Home only
    // after the farm had been opened.
    const modules = {
      'css/night-raid.css': /^js\/(night-raid[\w-]*|farm-rules|farm-art-manifest)\.js$/,
    };
    const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).map(f => 'js/' + f);
    const screenTags = {
      'css/night-raid.css': 'night-raid-screen',
    };
    const bad = [];
    for (const f of FEATURE_FILES) {
      const text = jsFiles.filter(j => modules[f].test(j)).map(read).join('\n') + ' ' + screenTags[f];
      for (const r of rulesByFile[f]) {
        for (const s of r.selectors) {
          const classes = [...s.replace(/:not\([^)]*\)/g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]);
          const ids = [...s.matchAll(/#([\w-]+)/g)].map(m => m[1]);
          const attrs = [...s.matchAll(/\[([\w-]+)/g)].map(m => m[1]);
          const tokens = classes.concat(ids, attrs);
          if (!tokens.length) { bad.push(`${f}: ${s} (no class, id or attribute at all)`); continue; }
          // at least one token has to be rendered by the feature — a full
          // literal, or a prefix/suffix it composes at runtime
          const ok = tokens.some(t => text.includes(t) || prefixes(t).some(p => new RegExp(esc(p) + "-['\"`]|" + esc(p) + '-\\$\\{').test(text)));
          if (!ok) bad.push(`${f}: ${s}`);
        }
      }
    }
    assert.deepEqual(bad, [], bad.join('\n'));
  });
});

function prefixes(t) { const out = []; let i = t.indexOf('-'); while (i > 0) { out.push(t.slice(0, i)); i = t.indexOf('-', i + 1); } return out; }
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
