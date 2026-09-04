// Night Raid, EXECUTED — not grepped.
//
// tests/night-raid-ui.test.js reads index.html, css/styles.css, sw.js and
// js/night-raid*.js as STRINGS: 306 of its assertions are `includes(...)`
// and js/night-raid.js is never actually run. A source grep can prove a line
// exists; it cannot prove what that line does to appState.coins. Every money
// bug this screen has shipped slipped through exactly there.
//
// So this file runs the real js/night-raid.js in a vm — same shape as
// tests/money-client.test.js — and asserts on the wallet afterwards. The three
// rules below are the ones a grep structurally cannot hold:
//
//   1. adoptServerCoins() restores ONCE, on a device that has never pushed
//      this profile's wallet, and never again. The refund loop was: build a
//      tower (server row 1000), spend 800 elsewhere (device 200), reopen —
//      and the row, still 1000, was adopted as "coins earned while offline".
//      Repeatable as often as the child reopened the screen.
//   2. claimVerified() applies a raid result to the wallet exactly once per
//      raidId, adds on a win, subtracts on a loss, and never goes negative.
//
// There is no third money path any more: the offline bot raid that paid
// straight into appState.coins is gone with the bot home it was fought in.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

// The screen's DOM is absent on purpose: every render entry point in
// js/night-raid.js starts with `const r=root(); if(!r)return;`, so a null
// document leaves the money code — and only the money code — running.
// `present` names the few ids a path genuinely dereferences.
function docStub(present) {
  const made = {};
  const el = id => {
    if (!made[id]) made[id] = {
      id, innerHTML: '', textContent: '', hidden: true, style: {}, dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      querySelector: () => null, closest: () => null, remove() {},
      appendChild() {}, replaceWith() {}, getContext: () => null,
      isConnected: true, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    };
    return made[id];
  };
  return {
    __el: el,
    getElementById: id => ((present || []).includes(id) ? el(id) : null),
    querySelector: () => null, querySelectorAll: () => [],
    createElement: () => el('#created'),
    addEventListener() {}, removeEventListener() {},
    body: el('#body'),
  };
}

// A renderer stand-in for js/night-raid-game.js. The battle engine has its own
// tests (night-raid-rules / night-raid-army); what is under test HERE is what
// js/night-raid.js does to the wallet when a battle reports its outcome, so
// the stub simply hands the outcome back through the real onFinish callback.
function gameStub(box) {
  function Fake(canvas, target, options) {
    box.target = target; box.options = options; box.started = 0;
    this.start = () => { box.started++; };
    this.charge = () => true;
    this.destroy = () => {};
  }
  return { AutoBattle: Fake, Game: Fake };
}

function loadNightRaid(opts) {
  opts = opts || {};
  const apiCalls = [];
  const toasts = [];
  const box = {};
  const ctx = {
    NightRaidRules: require(path.join(root, 'js/night-raid-rules.js')),
    NightRaidGame: gameStub(box),
    EngAuth: {
      tokenFor: () => 'tok',
      api: async (p, o) => {
        apiCalls.push({ path: p, method: (o && o.method) || 'GET', body: o && o.body });
        return (opts.api && opts.api(p, o)) || { ok: false, data: null };
      },
    },
    currentUser: 'Kid',
    appState: null,
    saveUserData: () => { ctx.__saves++; },
    showToast: t => { toasts.push(String(t)); },
    // Deferred UI only: finishRaid() moves the coins synchronously and then
    // schedules renderResult() for 450ms later, and startRaid() schedules the
    // charge. Neither is money; running them against a null DOM would only
    // throw inside a timer. The awaited paths (syncHome / refreshHome /
    // retryPendingFinish) are promise-driven and unaffected.
    setTimeout: (fn, ms) => { ctx.__timers.push({ fn, ms }); return ctx.__timers.length; },
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0, confirm: () => true,
    document: docStub(opts.present), console, Date, Math, JSON, Object, Array,
    Promise, Set, Map, Number, String, Boolean, Error, isNaN, parseInt, parseFloat,
    crypto: require('crypto').webcrypto,
  };
  ctx.__saves = 0;
  ctx.__timers = [];
  ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/night-raid.js'), 'utf8'), ctx,
    { filename: 'js/night-raid.js' });
  return { ctx, apiCalls, toasts, box };
}

// Drains the promise chains open() kicks off. open() does not return them
// (it is an onclick handler), so the test waits on the event loop instead.
const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r));
};

function state(over) {
  return Object.assign({
    coins: 200, dogLevel: 2, petName: 'Cún',
    nightRaidLayout: { cells: [], soldiers: 3 },
    nightRaidClaimed: {}, nightRaidHistory: [], nightRaidPending: null,
  }, over || {});
}

// A server that answers GET /home with the row below and accepts every PUT.
function homeServer(homeRow, extra) {
  return (p, o) => {
    if (p === 'night-raid/home') {
      if ((o && o.method) === 'PUT') return { ok: true, data: {} };
      return { ok: true, data: { home: homeRow } };
    }
    return (extra && extra(p, o)) || { ok: false, data: null };
  };
}

suite('night raid EXECUTED: the mirror restores once, then never again', () => {
  test('a device that has never synced this wallet takes the server row once', async () => {
    const { ctx } = loadNightRaid({ api: homeServer({ lootableCoins: 1000, layout: { cells: [] } }) });
    ctx.appState = state({ coins: 200 });
    assert.falsy(ctx.appState.nightRaidWalletSynced, 'precondition: a fresh install');
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 1000, 'a reinstall/second phone adopts the server number once');
    assert.truthy(ctx.appState.nightRaidWalletSynced, 'and becomes the wallet of record from then on');
  });

  test('THE REFUND LOOP: spending after the restore is never handed back', async () => {
    const { ctx } = loadNightRaid({ api: homeServer({ lootableCoins: 1000, layout: { cells: [] } }) });
    ctx.appState = state({ coins: 200 });
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 1000);
    // The child now spends 800 somewhere the server hears nothing about — the
    // home shop, the armoury, a castle skin — and reopens Cướp Đêm. The row
    // still says 1000 until the next PUT lands.
    ctx.appState.coins = 200;
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 200, 'a spent wallet must stay spent');
    // and it must not creep back on the third, fourth, fifth open either.
    for (let i = 0; i < 3; i++) { ctx.NightRaid.open(); await flush(); }
    assert.equal(ctx.appState.coins, 200, 'reopening the screen is not an income source');
  });

  test('a server row above an ALREADY-SYNCED wallet is ignored outright', async () => {
    const { ctx } = loadNightRaid({ api: homeServer({ lootableCoins: 9999, layout: { cells: [] } }) });
    ctx.appState = state({ coins: 50, nightRaidWalletSynced: true });
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 50);
  });

  test('the one-shot restore never LOWERS a fresh device to a smaller row', async () => {
    const { ctx } = loadNightRaid({ api: homeServer({ lootableCoins: 10, layout: { cells: [] } }) });
    ctx.appState = state({ coins: 750 });
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 750, 'a stale mirror below the device is not a debit');
    assert.truthy(ctx.appState.nightRaidWalletSynced);
  });

  test('a junk / missing lootable_coins arms nothing and spends the one shot', async () => {
    for (const row of [{ layout: { cells: [] } }, { lootableCoins: null, layout: { cells: [] } },
                       { lootableCoins: 'lots', layout: { cells: [] } }]) {
      const { ctx } = loadNightRaid({ api: homeServer(row) });
      ctx.appState = state({ coins: 300 });
      ctx.NightRaid.open();
      await flush();
      assert.equal(ctx.appState.coins, 300, 'no usable number -> no change');
      assert.truthy(ctx.appState.nightRaidWalletSynced,
        'the restore is still consumed, or it stays armed for the next reopen');
    }
  });

  test('a PUT that lands makes the device authoritative before any GET can raise it', async () => {
    // collectResources() PUTs /home first — that is the moment this device
    // tells the server what it holds. From then on the mirror is downstream.
    const { ctx } = loadNightRaid({
      api: homeServer({ lootableCoins: 5000, layout: { cells: [] } }, p =>
        p === 'night-raid/collect'
          ? { ok: true, data: { layout: { cells: [] }, collectedCoins: 0, collectedSoldiers: 0 } }
          : null),
    });
    ctx.appState = state({ coins: 120 });
    await ctx.NightRaid.collectResources();
    assert.truthy(ctx.appState.nightRaidWalletSynced, 'a successful PUT sets the flag');
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 120, 'the 5000-xu row is a mirror, not a second wallet');
  });

  test('a FAILED PUT leaves the restore armed — the device said nothing yet', async () => {
    const { ctx } = loadNightRaid({
      api: (p, o) => {
        if (p === 'night-raid/home' && (o && o.method) === 'PUT') return { ok: false, data: null };
        if (p === 'night-raid/home') return { ok: true, data: { home: { lootableCoins: 900, layout: { cells: [] } } } };
        if (p === 'night-raid/collect') return { ok: false, data: null };
        return { ok: false, data: null };
      },
    });
    ctx.appState = state({ coins: 120 });
    await ctx.NightRaid.collectResources();
    assert.falsy(ctx.appState.nightRaidWalletSynced, 'an offline PUT proves nothing');
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 900, 'so the first successful read still restores');
  });
});

suite('night raid EXECUTED: a verified result lands exactly once', () => {
  const won = { won: true, reward: 60, loss: 0, stars: 2, soldiers: 3 };
  const lost = { won: false, reward: 0, loss: 20, stars: 0, soldiers: 1 };
  function pendingServer(row, verified) {
    return homeServer(row, p => (p === 'night-raid/finish' ? { ok: true, data: { result: verified } } : null));
  }

  test('a win credits the reward, and only the first sweep credits it', async () => {
    const { ctx, apiCalls } = loadNightRaid({
      api: pendingServer({ lootableCoins: 0, layout: { cells: [] } }, won),
    });
    ctx.appState = state({ coins: 500, nightRaidWalletSynced: true, nightRaidPending: { raidId: 'r1', at: Date.now() } });
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 560, '+60 exactly once');
    assert.truthy(ctx.appState.nightRaidClaimed.r1, 'the raid id is banked');
    assert.falsy(ctx.appState.nightRaidPending, 'and the pending row is cleared');
    // The same raid re-offered: a retry, a second device, a duplicated sweep.
    ctx.appState.nightRaidPending = { raidId: 'r1', at: Date.now() };
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 560, 'a second claim of r1 pays nothing');
    assert.truthy(apiCalls.filter(c => c.path === 'night-raid/finish').length >= 2,
      'the server was genuinely asked twice — the guard is client-side, not luck');
  });

  test('a different raidId is a different payment', async () => {
    let id = 'r1';
    const { ctx } = loadNightRaid({
      api: homeServer({ lootableCoins: 0, layout: { cells: [] } },
        p => (p === 'night-raid/finish' ? { ok: true, data: { result: won } } : null)),
    });
    ctx.appState = state({ coins: 500, nightRaidWalletSynced: true, nightRaidPending: { raidId: id, at: Date.now() } });
    ctx.NightRaid.open();
    await flush();
    ctx.appState.nightRaidPending = { raidId: 'r2', at: Date.now() };
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 620, 'two raids, two rewards');
  });

  test('a loss debits the wallet, once', async () => {
    const { ctx } = loadNightRaid({
      api: pendingServer({ lootableCoins: 0, layout: { cells: [] } }, lost),
    });
    ctx.appState = state({ coins: 500, nightRaidWalletSynced: true, nightRaidPending: { raidId: 'r9', at: Date.now() } });
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 480);
    ctx.appState.nightRaidPending = { raidId: 'r9', at: Date.now() };
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 480, 'a replayed loss is not charged twice');
  });

  test('a loss larger than the purse floors at zero, never negative', async () => {
    const { ctx } = loadNightRaid({
      api: pendingServer({ lootableCoins: 0, layout: { cells: [] } },
        { won: false, reward: 0, loss: 5000, stars: 0 }),
    });
    ctx.appState = state({ coins: 7, nightRaidWalletSynced: true, nightRaidPending: { raidId: 'r3', at: Date.now() } });
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 0);
    assert.truthy(ctx.appState.coins >= 0, 'a child can owe the castle nothing');
  });

  test('a nonsense reward/loss cannot move the wallet the wrong way', async () => {
    const { ctx } = loadNightRaid({
      api: pendingServer({ lootableCoins: 0, layout: { cells: [] } },
        { won: true, reward: -999, loss: 0, stars: 1 }),
    });
    ctx.appState = state({ coins: 400, nightRaidWalletSynced: true, nightRaidPending: { raidId: 'r4', at: Date.now() } });
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 400, 'a negative reward is clamped to 0, not applied as a debit');
  });

  test('the verified soldier count replaces the local one', async () => {
    const { ctx, apiCalls } = loadNightRaid({
      api: pendingServer({ lootableCoins: 0, layout: { cells: [] } },
        { won: false, reward: 0, loss: 0, stars: 0, soldiers: 1 }),
    });
    ctx.appState = state({ coins: 400, nightRaidWalletSynced: true, nightRaidPending: { raidId: 'r5', at: Date.now() } });
    ctx.appState.nightRaidLayout.soldiers = 9;
    ctx.NightRaid.open();
    await flush();
    // Read it off the PUT claimVerified fires, not off appState at the end of
    // the turn: claimVerified -> syncHome -> refreshHome, and that last GET
    // legitimately adopts the server's layout (which, in a stub, has no army).
    const put = apiCalls.filter(c => c.path === 'night-raid/home' && c.method === 'PUT')[0];
    assert.equal(put.body.layout.soldiers, 1, 'the server owns the army after a raid');
  });

  test('a server that cannot answer keeps the raid pending and the wallet still', async () => {
    const { ctx } = loadNightRaid({
      api: homeServer({ lootableCoins: 0, layout: { cells: [] } },
        p => (p === 'night-raid/finish' ? { ok: false, data: null } : null)),
    });
    ctx.appState = state({ coins: 300, nightRaidWalletSynced: true, nightRaidPending: { raidId: 'r6', at: Date.now() } });
    ctx.NightRaid.open();
    await flush();
    assert.equal(ctx.appState.coins, 300, 'no verdict, no money');
    assert.truthy(ctx.appState.nightRaidPending, 'the raid stays queued for the next open');
    assert.falsy(ctx.appState.nightRaidClaimed.r6, 'and is NOT banked as claimed');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
