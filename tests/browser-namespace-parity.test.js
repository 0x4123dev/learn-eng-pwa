// tests/browser-namespace-parity.test.js — the browser and Node must be handed
// the SAME module surface.
//
// The bug this exists for: js/battlecalc.js has two export paths. A classic
// script's top-level `const` is script-scoped, not a window property, so the
// browser reads everything through a hand-written `const BattleCalc = {...}`
// namespace; Node and every test read `module.exports`. The volley rulebook is
// defined BELOW that literal and could not be listed in it, so volleyShots,
// volleyTotal, volleyDamage and POWER_REF_LEVEL reached Node but never reached
// a child's browser.
//
// js/petbattlegame.js calls BattleCalc.volleyShots on every shot. A child
// pressed FIRE, lost one poop, the call threw, and `busy` stayed true — which
// makes fire() return early forever after. The FIRE button was dead for the
// rest of the battle, in every friend battle, on the live site. The entire
// Node suite stayed green throughout, because Node takes the other door.
//
// So: any module that ships BOTH doors must put the same things through both.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// A module is in scope here when it exports a namespace object of the same
// name through module.exports — that is the two-door shape.
const TWO_DOOR = [
  ['js/battlecalc.js', 'BattleCalc'],
];

suite('browser namespace parity: both doors carry the same module', () => {
  for (const [file, name] of TWO_DOOR) {
    test(`${file}: every module.exports member is also on ${name}`, () => {
      const mod = require(path.join(ROOT, file));
      const ns = mod[name];
      assert.truthy(ns && typeof ns === 'object', `${file} must export its ${name} namespace`);
      // The namespace itself is not expected to contain itself.
      const missing = Object.keys(mod).filter(k => k !== name && !(k in ns));
      assert.deepEqual(missing, [],
        `these reach Node but never reach a browser: ${missing.join(', ')}`);
    });

    test(`${file}: and the two doors agree on identity, not just on names`, () => {
      const mod = require(path.join(ROOT, file));
      const ns = mod[name];
      const different = Object.keys(mod).filter(k => k !== name && k in ns && mod[k] !== ns[k]);
      assert.deepEqual(different, [],
        `the browser gets a DIFFERENT value for: ${different.join(', ')}`);
    });

    test(`${file}: the browser really is handed the namespace`, () => {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
      assert.truthy(src.includes(`window.${name} = ${name}`),
        `${file} must publish ${name} on window, or the browser sees nothing`);
    });
  }
});

suite('browser namespace parity: what the game actually calls must be there', () => {
  // Read the call sites out of the engine rather than listing them by hand, so
  // a new BattleCalc.x() added tomorrow is covered without touching this file.
  test('every BattleCalc member js/petbattlegame.js calls exists on the namespace', () => {
    const game = fs.readFileSync(path.join(ROOT, 'js/petbattlegame.js'), 'utf8');
    const { BattleCalc } = require(path.join(ROOT, 'js/battlecalc.js'));
    // `C` is the engine's own alias: `const C = this.calc` (which is BattleCalc).
    const used = new Set([
      ...[...game.matchAll(/\bBattleCalc\.([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1]),
      ...[...game.matchAll(/\bC\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map(m => m[1]),
    ]);
    assert.truthy(used.has('volleyShots'), 'the engine should still resolve a volley through BattleCalc');
    const missing = [...used].filter(k => !(k in BattleCalc));
    assert.deepEqual(missing, [],
      `js/petbattlegame.js calls these on BattleCalc but the browser has no such member: ${missing.join(', ')}`);
  });

  test('and every one js/petbattle.js calls, too', () => {
    const lobby = fs.readFileSync(path.join(ROOT, 'js/petbattle.js'), 'utf8');
    const { BattleCalc } = require(path.join(ROOT, 'js/battlecalc.js'));
    const used = [...lobby.matchAll(/\bBattleCalc\.([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1]);
    const missing = [...new Set(used)].filter(k => !(k in BattleCalc));
    assert.deepEqual(missing, [], `js/petbattle.js calls: ${missing.join(', ')}`);
  });
});

// ---------------------------------------------------------------------------
// The same question, asked of the WHOLE repo rather than of one file.
//
// The live bug was a property lookup — BattleCalc.volleyShots — on a namespace
// object that did not carry it. Any module that publishes such an object is
// exposed to it, in any game. This sweep finds every namespace the browser can
// reach and checks that every `Namespace.member` written anywhere in js/
// actually exists on it. It reads the namespaces and the call sites out of the
// source, so a game added tomorrow is covered without editing this file.
//
// Note on scope: a top-level `const` in a classic script lands in the shared
// global lexical environment, so a BARE name crosses files fine. Only property
// access on an object can silently miss, which is why that is what is checked.
suite('browser namespace parity: no call anywhere reaches a member that does not exist', () => {
  const JS = path.join(ROOT, 'js');
  const SKIP = /phaser\.min|-data\.js$|dictionary-data|math4-data|units-|word-data|grammar-units|grammar-lessons|collocation-(data|followups)|phrases-(data|meanings)|wordform-(data|followups|lessons)|rewrite-(data|lessons)|math-(data|exams|lessons|source|fight-bank)|hot-words|topic-vocab/;
  const sourceFiles = fs.readdirSync(JS).filter(f => f.endsWith('.js') && !SKIP.test(f));
  const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
  // String literals are not code: 'learn-eng-pwa-api.pages.dev' in
  // js/hosting.js is a hostname, not a call on an `api` namespace.
  const stripStrings = src => src.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");

  // Every module that hands the browser one object under a global name.
  function namespaces() {
    const found = new Map();
    for (const f of sourceFiles) {
      const src = fs.readFileSync(path.join(JS, f), 'utf8');
      const tail = src.match(/module\.exports\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*;?\s*$/m);
      if (!tail) continue;
      const name = tail[1];
      if (!new RegExp('(^|\\n)\\s*(var|const|let)\\s+' + name + '\\s*=').test(src)) continue;
      let obj;
      try { obj = require(path.join(JS, f)); } catch (e) { continue; }
      if (obj && typeof obj === 'object') found.set(name, { file: f, obj });
    }
    // battlecalc publishes its namespace INSIDE an object-literal export.
    const bc = require(path.join(ROOT, 'js', 'battlecalc.js'));
    if (bc && bc.BattleCalc) found.set('BattleCalc', { file: 'battlecalc.js', obj: bc.BattleCalc });
    return found;
  }

  test('at least the game namespaces are under test, so a pass means something', () => {
    const names = [...namespaces().keys()];
    for (const expected of ['BattleCalc', 'NightRaidRules', 'FarmRules', 'DailyTask', 'MathFightRules']) {
      assert.contains(names, expected, 'the sweep should cover ' + expected);
    }
    assert.truthy(names.length >= 10, 'only ' + names.length + ' namespaces found — the scan probably broke');
  });

  test('every Namespace.member written in js/ exists on that namespace', () => {
    const ns = namespaces();
    const problems = [];
    for (const f of sourceFiles) {
      const src = stripStrings(stripComments(fs.readFileSync(path.join(JS, f), 'utf8')));
      for (const [name, { obj }] of ns) {
        for (const m of src.matchAll(new RegExp('\\b' + name + '\\.([A-Za-z_][A-Za-z0-9_]*)', 'g'))) {
          if (!(m[1] in obj)) problems.push(f + ' → ' + name + '.' + m[1]);
        }
      }
    }
    assert.deepEqual([...new Set(problems)], [],
      'these calls would throw in a browser: ' + [...new Set(problems)].join('; '));
  });
});

// The two-door shape, found automatically instead of listed by hand — so a
// module written next month is covered without anyone remembering this file.
// The shape: a file declares `const Name = { … }` as its browser namespace AND
// exports an object literal that also carries `Name`. Whatever is in that
// export but not on `Name` reaches Node and never reaches a child.
suite('browser namespace parity: the two-door shape is found, not remembered', () => {
  const JS = path.join(ROOT, 'js');
  function twoDoorModules() {
    const out = [];
    for (const f of fs.readdirSync(JS).filter(x => x.endsWith('.js') && !/phaser\.min/.test(x))) {
      const src = fs.readFileSync(path.join(JS, f), 'utf8');
      if (!/module\.exports\s*=\s*\{/.test(src)) continue;
      for (const m of src.matchAll(/(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{/g)) {
        const name = m[1];
        // What makes an object the BROWSER'S DOOR is that it is published on
        // window. A plain data table that happens to be exported is not one,
        // and holding it to this rule only produces noise.
        if (!new RegExp('window\\.' + name + '\\s*=\\s*' + name + '\\b').test(src)) continue;
        if (!new RegExp('module\\.exports\\s*=\\s*\\{[\\s\\S]*?\\b' + name + '\\b[\\s\\S]*?\\}').test(src)) continue;
        let mod;
        try { mod = require(path.join(JS, f)); } catch (e) { continue; }
        if (mod && mod[name] && typeof mod[name] === 'object') out.push([f, name, mod]);
      }
    }
    return out;
  }

  test('the detector still finds js/battlecalc.js — otherwise this suite proves nothing', () => {
    assert.truthy(twoDoorModules().some(([f, n]) => f === 'battlecalc.js' && n === 'BattleCalc'),
      'the two-door detector found nothing in battlecalc.js; it has probably stopped working');
  });

  test('every two-door module puts the same members through both doors', () => {
    const problems = [];
    for (const [file, name, mod] of twoDoorModules()) {
      const ns = mod[name];
      // Constants a module exports only for tests to pin are reachable in a
      // browser by BARE name (top-level const joins the global lexical scope),
      // so only a MISSING FUNCTION can break a property lookup at runtime.
      const missingFns = Object.keys(mod)
        .filter(k => k !== name && typeof mod[k] === 'function' && !(k in ns));
      for (const k of missingFns) problems.push(file + ' → ' + name + '.' + k);
    }
    assert.deepEqual(problems, [],
      'these functions reach Node but never reach a browser: ' + problems.join('; '));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
