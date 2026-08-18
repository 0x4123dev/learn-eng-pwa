const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const CastleSkins = require(path.join(root, 'js', 'castle-skins.js'));

suite('castle skins: fair cosmetic collection', () => {
  test('there are exactly ten unique skins', () => {
    assert.equal(CastleSkins.skins.length, 10);
    assert.equal(new Set(CastleSkins.skins.map(s => s.id)).size, 10);
  });

  test('the starter is free and the cheapest purchasable skin costs 2,000', () => {
    assert.equal(CastleSkins.get(CastleSkins.defaultId).price, 0);
    const paid = CastleSkins.skins.filter(s => s.price > 0).map(s => s.price);
    assert.equal(Math.min(...paid), 2000);
    for (let i = 1; i < paid.length; i++) assert.truthy(paid[i] > paid[i - 1], 'prices must rise with complexity');
    assert.equal(Math.max(...paid), 10000, 'the most expensive skin must stay affordable');
  });

  test('unknown skin ids safely become the starter', () => {
    assert.equal(CastleSkins.normalize('../evil.png'), CastleSkins.defaultId);
    assert.equal(CastleSkins.normalize(null), CastleSkins.defaultId);
  });

  test('every skin has bilingual copy and a complete palette', () => {
    for (const skin of CastleSkins.skins) {
      assert.truthy(skin.name.en && skin.name.vi && skin.desc.en && skin.desc.vi, skin.id);
      assert.equal(skin.colors.length, 6);
    }
  });

  test('visual prestige rises with price so expensive skins look more premium', () => {
    const paid = CastleSkins.skins.filter(s => s.price > 0);
    paid.forEach((skin, index) => {
      assert.equal(skin.prestige, index + 2, `${skin.id} should have the next visual prestige rank`);
      if (index) assert.truthy(skin.price > paid[index - 1].price, 'price must rise with visual prestige');
    });
  });

  test('the starter stays basic while all paid castles use the premium atlases', () => {
    assert.equal(CastleSkins.atlasSources.length, 2);
    CastleSkins.atlasSources.forEach(src => assert.truthy(fs.existsSync(path.join(root, src)), `${src} is missing`));
    const cells = CastleSkins.skins.filter(s => s.price > 0).map(s => CastleSkins.atlasCell(s.id));
    assert.equal(cells.filter(c => c.atlas === 0).length, 4);
    assert.equal(cells.filter(c => c.atlas === 1).length, 5);
    assert.equal(new Set(cells.map(c => `${c.atlas}:${c.cell}`)).size, 9);
    const source = read('js/castle-skins.js');
    assert.truthy(source.includes('normalize(id) === defaultId'), 'free preview must bypass premium artwork');
    assert.truthy(source.includes('skin.id === defaultId'), 'free battle castle must use the basic renderer');
  });

  test('battle renderer uses premium sprites and preserves staged destruction', () => {
    const src = read('js/castle-skins.js');
    assert.truthy(/function drawBattle/.test(src));
    for (const stage of [0,1,2,3,4]) assert.truthy(src.includes(`damage === ${stage}`) || stage === 4, `damage stage ${stage} missing`);
    assert.truthy(/CastleSkins\.drawBattle/.test(read('js/petbattlegame.js')));
  });
});

suite('castle skins: purchase and equip', () => {
  global.CastleSkins = CastleSkins;
  const pb = require(path.join(root, 'js', 'petbattle.js'));

  function state(coins, fn) {
    const old = { appState:global.appState, document:global.document, currentUser:global.currentUser,
      saveUserData:global.saveUserData, window:global.window };
    global.appState = { coins, petBattleCastleSkins:['stone-keep'], petBattleCastleSkin:'stone-keep' };
    global.document = { getElementById:() => null };
    global.currentUser = 'child'; global.saveUserData = () => {};
    global.window = { confirm:() => true };
    try { fn(global.appState); } finally { Object.assign(global, old); }
  }

  test('insufficient coins never unlock or charge', () => state(1999, st => {
    assert.falsy(pb.pbBuyCastleSkin('forest-fort'));
    assert.equal(st.coins, 1999);
    assert.deepEqual(st.petBattleCastleSkins, ['stone-keep']);
  }));

  test('buying subtracts once, owns and equips', () => state(5000, st => {
    assert.truthy(pb.pbBuyCastleSkin('forest-fort'));
    assert.equal(st.coins, 3000);
    assert.truthy(st.petBattleCastleSkins.includes('forest-fort'));
    assert.equal(st.petBattleCastleSkin, 'forest-fort');
    assert.truthy(pb.pbBuyCastleSkin('forest-fort'));
    assert.equal(st.coins, 3000, 'equipping an owned skin must be free');
  }));

  // The shop no longer carries a "looks only" disclaimer: the fairness is
  // enforced in the renderer and on the server, which the rest of this file
  // tests, and a child does not need to be told what they never doubted.
  test('the shop offers a preview of every skin', () => state(0, () => {
    const html = pb._pbCastleWorkshop();
    assert.equal((html.match(/data-castle-preview=/g) || []).length, 10);
    assert.falsy(/no HP or defence bonus|không tăng HP/i.test(html), 'the disclaimer was removed');
  }));
});

suite('castle skins: battle boundary', () => {
  test('server snapshots and whitelists both players skins', () => {
    const shared = read('functions/api/_battle.js');
    assert.truthy(/CASTLE_SKIN_IDS/.test(shared) && /normalizeCastleSkin/.test(shared));
    assert.truthy(/challenger_castle_skin/.test(shared) && /opponent_castle_skin/.test(shared));
    const sql = read('db/007-castle-skins.sql');
    assert.truthy(sql.includes('challenger_castle_skin') && sql.includes('opponent_castle_skin'));
  });

  test('skins never enter deterministic combat maths', () => {
    assert.falsy(/castleSkin|castle_skin|CastleSkins/.test(read('js/battlecalc.js')));
    const ui = read('js/petbattle.js');
    assert.truthy(/castleSkin: pbSelectedCastleSkinId\(\)/.test(ui));
  });
});
