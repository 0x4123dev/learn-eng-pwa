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

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
