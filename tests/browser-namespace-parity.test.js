// tests/browser-namespace-parity.test.js — the browser and Node must be handed
// the SAME module surface.
//
// The bug this exists for (in the Arena, since removed): js/battlecalc.js had
// two export paths. A classic script's top-level `const` is script-scoped, not
// a window property, so the browser read everything through a hand-written
// `const BattleCalc = {...}` namespace; Node and every test read
// `module.exports`. A rulebook defined BELOW that literal could not be listed
// in it, so its functions reached Node but never reached a child's browser.
// The game called one of them on every shot, the call threw, and the FIRE
// button was dead for the rest of the battle, on the live site. The entire
// Node suite stayed green throughout, because Node takes the other door.
//
// So: any module that publishes a namespace object must carry every member
// anyone calls on it, and any module that ships BOTH doors must put the same
// things through both.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// The question asked of the WHOLE repo rather than of one file.
//
// The live bug was a property lookup — Namespace.member — on a namespace
// object that did not carry it. Any module that publishes such an object is
// exposed to it. This sweep finds every namespace the browser can reach and
// checks that every `Namespace.member` written anywhere in js/ actually exists
// on it. It reads the namespaces and the call sites out of the source, so a
// module added tomorrow is covered without editing this file.
//
// Note on scope: a top-level `const` in a classic script lands in the shared
// global lexical environment, so a BARE name crosses files fine. Only property
// access on an object can silently miss, which is why that is what is checked.
suite('browser namespace parity: no call anywhere reaches a member that does not exist', () => {
  const JS = path.join(ROOT, 'js');
  const SKIP = /-data\.js$|dictionary-data|word-data|hot-words/;
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
    return found;
  }

  test('at least the game namespaces are under test, so a pass means something', () => {
    const names = [...namespaces().keys()];
    for (const expected of ['NightRaidRules', 'FarmRules', 'DailyTask', 'DailyTaskCatalog']) {
      assert.contains(names, expected, 'the sweep should cover ' + expected);
    }
    assert.truthy(names.length >= 5, 'only ' + names.length + ' namespaces found — the scan probably broke');
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
    for (const f of fs.readdirSync(JS).filter(x => x.endsWith('.js'))) {
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
