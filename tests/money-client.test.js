// Money-flow invariants, CLIENT SIDE — the real js/auth.js, js/night-raid.js
// and login migration are EXECUTED with scripted fetch/api stubs. The rule
// under test: no sync, missing field, offline fallback or migration may zero
// the wallet or the dog; only an explicit spend lowers the balance.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

function nullDoc() {
  return {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
  };
}

// ---- js/auth.js under a scripted fetch ----
function loadAuth(plan) {
  const calls = [];
  const store = {};
  const ctx = {
    localStorage: {
      getItem: k => (store[k] !== undefined ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    fetch: async (url, opts) => {
      const body = opts && opts.body ? JSON.parse(opts.body) : null;
      calls.push({ url, method: (opts && opts.method) || 'GET', body });
      const r = (plan && plan(url, body)) || { data: { ok: true } };
      return { ok: r.ok !== false, status: r.status || 200, json: async () => r.data };
    },
    document: nullDoc(), console, Date, Math, JSON, Object, Array, Promise, Set,
    setTimeout, clearTimeout, crypto: require('crypto').webcrypto,
    saveUserData: () => {},
  };
  ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  // `const EngAuth` is lexical inside the vm script; surface it on the context.
  vm.runInContext(fs.readFileSync(path.join(root, 'js/auth.js'), 'utf8')
    + '\n;globalThis.EngAuth = EngAuth;', ctx, { filename: 'js/auth.js' });
  store['flashlingo_accounts'] = JSON.stringify({
    Kid: { token: 'tok', syncEpoch: 2, skillSyncEpoch: 2, syncedKeys: [], syncedSkillKeys: [] },
  });
  return { ctx, calls, store };
}

suite('money client: admin grants land exactly as the server says', () => {
  test('a Daily Task reward is described as earned, not as an admin gift', async () => {
    const { ctx } = loadAuth(url =>
      url === '/api/coins' ? { data: { granted: 200, dailyTaskGranted: 200, flags: {} } } : null);
    const toasts = [];
    ctx.showToast = msg => toasts.push(msg);
    ctx.appState = { coins: 100 };
    ctx.currentUser = 'Kid';
    await ctx.EngAuth.refreshFlags('Kid');
    assert.equal(ctx.appState.coins, 300);
    assert.equal(toasts[0], '🎉 Hoàn thành Daily Task được tặng 200 xu!');
    assert.falsy(toasts[0].includes('Admin'));
  });

  test('a 50-coin grant adds 50 to the wallet and saves it', async () => {
    const { ctx } = loadAuth(url =>
      url === '/api/coins' ? { data: { granted: 50, flags: { mathFight: false, bot: false } } } : null);
    let saves = 0;
    ctx.appState = { coins: 100 };
    ctx.currentUser = 'Kid';
    ctx.saveUserData = () => { saves++; };
    await ctx.EngAuth.refreshFlags('Kid');
    assert.equal(ctx.appState.coins, 150);
    assert.truthy(saves >= 1, 'the new balance must be persisted');
  });

  test('granted: 0 leaves the wallet untouched', async () => {
    const { ctx } = loadAuth(url =>
      url === '/api/coins' ? { data: { granted: 0, flags: {} } } : null);
    ctx.appState = { coins: 100 };
    ctx.currentUser = 'Kid';
    await ctx.EngAuth.refreshFlags('Kid');
    assert.equal(ctx.appState.coins, 100);
  });

  test('a server error changes nothing — the IOU stays claimable', async () => {
    const { ctx } = loadAuth(url =>
      url === '/api/coins' ? { ok: false, status: 500, data: { error: 'x' } } : null);
    ctx.appState = { coins: 100 };
    ctx.currentUser = 'Kid';
    await ctx.EngAuth.refreshFlags('Kid');
    assert.equal(ctx.appState.coins, 100);
  });
});

suite('money client: every wallet reaches the recovery snapshot', () => {
  test('a sync with no new activity still reports the balance once per change', async () => {
    const { ctx, calls } = loadAuth(url =>
      url === '/api/activity' ? { data: { ok: true, count: 0 } } : null);
    ctx.appState = { coins: 700 };
    ctx.currentUser = 'Kid';
    const res = await ctx.EngAuth.syncNow();
    assert.truthy(res.ok);
    const acts = () => calls.filter(c => c.url === '/api/activity');
    assert.equal(acts().length, 1, 'a balance-only sync must still POST the balance');
    assert.deepEqual(acts()[0].body.items, []);
    assert.equal(acts()[0].body.coinBalance, 700);
    await ctx.EngAuth.syncNow();
    assert.equal(acts().length, 1, 'an unchanged balance is not re-posted');
    ctx.appState.coins = 750;
    await ctx.EngAuth.syncNow();
    assert.equal(acts().length, 2, 'a changed balance is posted again');
    assert.equal(acts()[1].body.coinBalance, 750);
  });

  test('an unhydrated wallet is never reported as a balance of 0', async () => {
    const { ctx, calls } = loadAuth(url =>
      url === '/api/activity' ? { data: { ok: true, count: 1 } } : null);
    // One real history item, but appState.coins was never set (half-loaded
    // profile). Reporting 0 here would poison the recovery snapshot.
    ctx.appState = { lessonHistory: [{ lessonNum: 0, date: Date.now(), accuracy: 80 }] };
    ctx.currentUser = 'Kid';
    await ctx.EngAuth.syncNow();
    const act = calls.find(c => c.url === '/api/activity');
    assert.truthy(act, 'the history item itself still syncs');
    assert.falsy('coinBalance' in act.body,
      'a non-numeric wallet must be omitted, not sent as 0');
  });
});

suite('money client: grant receipts — the gift survives every crash point', () => {
  const R = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
  function accounts(store) { return JSON.parse(store['flashlingo_accounts']); }

  test('claim declares proto 2, saves the coins, then acks the receipt', async () => {
    const { ctx, calls, store } = loadAuth((url, body) => {
      if (url !== '/api/coins') return null;
      if (body && body.ackOnly) return { data: { granted: 0, receipt: null, flags: {} } };
      return { data: { granted: 50, receipt: R, flags: {} } };
    });
    ctx.appState = { coins: 100 };
    ctx.currentUser = 'Kid';
    await ctx.EngAuth.refreshFlags('Kid');
    const coins = calls.filter(c => c.url === '/api/coins');
    assert.equal(coins.length, 2, 'one claim, one ack');
    assert.equal(coins[0].body.proto, 2, 'the claim must opt into the receipt protocol');
    assert.truthy(coins[1].body.ackOnly, 'the second call only acks');
    assert.deepEqual(coins[1].body.ackReceipts, [R]);
    assert.equal(ctx.appState.coins, 150);
    assert.deepEqual(accounts(store).Kid.pendingCoinReceipts, [],
      'an acked receipt does not linger');
  });

  test('a failed ack keeps the receipt stored, and the next sync retries it', async () => {
    let ackAttempts = 0;
    const { ctx, calls, store } = loadAuth((url, body) => {
      if (url !== '/api/coins') return null;
      if (body && body.ackOnly) { ackAttempts++; return { ok: false, status: 500, data: null }; }
      return { data: { granted: 50, receipt: ackAttempts === 0 ? R : null, granted2: 0, flags: {} } };
    });
    ctx.appState = { coins: 100 };
    ctx.currentUser = 'Kid';
    await ctx.EngAuth.refreshFlags('Kid');
    assert.equal(ctx.appState.coins, 150, 'the coins landed even though the ack failed');
    assert.deepEqual(accounts(store).Kid.pendingCoinReceipts, [R],
      'the unacked receipt is kept durably for retry');
    // Next sync: the claim call itself must carry the stored receipt as an ack.
    await ctx.EngAuth.refreshFlags('Kid');
    const claims = calls.filter(c => c.url === '/api/coins' && !(c.body && c.body.ackOnly));
    assert.deepEqual(claims[1].body.ackReceipts, [R],
      'stored receipts ride along with the next claim');
    assert.deepEqual(accounts(store).Kid.pendingCoinReceipts, [],
      'a successful claim call clears the retried receipts');
  });

  test('the crash guard leaves the claim unacked so the server re-offers it', async () => {
    const { ctx, calls, store } = loadAuth((url, body) => {
      if (url !== '/api/coins') return null;
      return { data: { granted: 50, receipt: R, flags: {} } };
    });
    // The profile switched between sync start and reply — the coins must NOT
    // be applied, and crucially nothing may ack the receipt: the unacked
    // pending row is exactly what lets the server pay it again later.
    ctx.appState = { coins: 100 };
    ctx.currentUser = 'SomeoneElse';
    await ctx.EngAuth.refreshFlags('Kid');
    assert.equal(ctx.appState.coins, 100, 'a switched profile gets no coins');
    assert.equal(calls.filter(c => c.url === '/api/coins').length, 1, 'no ack was sent');
    assert.falsy((accounts(store).Kid.pendingCoinReceipts || []).length,
      'no receipt is stored for coins that were never applied');
  });
});

suite('money client: owned assets ride the backup both ways', () => {
  const SERVER_ASSETS = {
    accessories: ['bow', 'cap'], castleSkins: ['stone-keep', 'royal-keep'],
    stickers: ['star1'], dogGrowthXP: 30000, streakShields: 2,
  };

  test('a fresh device is restored from the sync reply, dog level included', async () => {
    const { ctx, calls } = loadAuth(url =>
      url === '/api/assets' ? { data: { ok: true, assets: SERVER_ASSETS } } : null);
    ctx.appState = { coins: 0, petAccessories: [], petBattleCastleSkins: ['stone-keep'],
      stickers: [], dogGrowthXP: 0, dogLevel: 1, streakShields: 0 };
    ctx.currentUser = 'Kid';
    ctx.getDogLevel = xp => Math.max(1, Math.floor(xp / 1000)); // stand-in formula
    let saves = 0; ctx.saveUserData = () => { saves++; };
    await ctx.EngAuth.syncAssets('Kid');
    assert.deepEqual(ctx.appState.petAccessories.sort(), ['bow', 'cap']);
    assert.deepEqual(ctx.appState.petBattleCastleSkins.sort(), ['royal-keep', 'stone-keep']);
    assert.deepEqual(ctx.appState.stickers, ['star1']);
    assert.equal(ctx.appState.dogGrowthXP, 30000);
    assert.equal(ctx.appState.dogLevel, 30, 'the dog level is re-derived from restored XP');
    assert.equal(ctx.appState.streakShields, 2);
    assert.truthy(saves >= 1, 'the restore must be persisted');
    const put = calls.find(c => c.url === '/api/assets');
    assert.equal(put.method, 'PUT', 'one round trip backs up AND restores');
  });

  test('local purchases are uploaded, and the merge never loses either side', async () => {
    const { ctx, calls } = loadAuth((url, body) =>
      url === '/api/assets'
        ? { data: { ok: true, assets: {
            accessories: ['bow'].concat(body.accessories || []),
            castleSkins: body.castleSkins || [], stickers: body.stickers || [],
            dogGrowthXP: Math.max(30000, body.dogGrowthXP || 0),
            streakShields: body.streakShields || 0 } } }
        : null);
    ctx.appState = { petAccessories: ['crown'], petBattleCastleSkins: ['stone-keep'],
      stickers: [], dogGrowthXP: 45000, dogLevel: 45, streakShields: 1 };
    ctx.currentUser = 'Kid';
    await ctx.EngAuth.syncAssets('Kid');
    const put = calls.find(c => c.url === '/api/assets');
    assert.deepEqual(put.body.accessories, ['crown'], 'local ownership is uploaded');
    assert.equal(put.body.dogGrowthXP, 45000);
    assert.deepEqual(ctx.appState.petAccessories.sort(), ['bow', 'crown'],
      'the merged union lands locally');
    assert.equal(ctx.appState.dogGrowthXP, 45000, 'a lower server XP never lowers local');
  });

  test('offline or a switched profile changes nothing', async () => {
    const { ctx } = loadAuth(() => { throw new Error('network down'); });
    ctx.appState = { petAccessories: ['crown'], dogGrowthXP: 45000, dogLevel: 45 };
    ctx.currentUser = 'Kid';
    await ctx.EngAuth.syncAssets('Kid');
    assert.deepEqual(ctx.appState.petAccessories, ['crown']);
    const { ctx: c2 } = loadAuth(url =>
      url === '/api/assets' ? { data: { ok: true, assets: SERVER_ASSETS } } : null);
    c2.appState = { petAccessories: [], dogGrowthXP: 0, dogLevel: 1 };
    c2.currentUser = 'SomeoneElse';
    await c2.EngAuth.syncAssets('Kid');
    assert.deepEqual(c2.appState.petAccessories, [],
      'a reply for Kid must never write into another profile');
  });
});

// ---- js/night-raid.js under a scripted EngAuth.api ----
function loadNightRaid(apiPlan) {
  const apiCalls = [];
  const ctx = {
    NightRaidRules: require(path.join(root, 'js/night-raid-rules.js')),
    EngAuth: {
      tokenFor: () => 'tok',
      api: async (p, opts) => {
        apiCalls.push({ path: p, method: (opts && opts.method) || 'GET', body: opts && opts.body });
        return (apiPlan && apiPlan(p, opts)) || { ok: false, data: null };
      },
    },
    currentUser: 'Kid',
    appState: null,
    saveUserData: () => {},
    showToast: () => {},
    document: nullDoc(), console, Date, Math, JSON, Object, Array, Promise, Set, Map,
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: () => {}, confirm: () => true,
    crypto: require('crypto').webcrypto,
  };
  ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/night-raid.js'), 'utf8'), ctx,
    { filename: 'js/night-raid.js' });
  return { ctx, apiCalls };
}
function raidState(coins) {
  return {
    coins, dogLevel: 2, vaultCoins: 0,
    petBattleCastleSkin: 'stone-keep', nightRaidLayout: { cells: [], soldiers: 0 },
    nightRaidClaimed: {}, nightRaidHistory: [],
  };
}

suite('money client: night raid sync can never invent a zero', () => {
  test('collect keeps the harvest but never swallows the wallet when the reply has no coins', async () => {
    const { ctx } = loadNightRaid(p => {
      if (p === 'night-raid/home') return { ok: true, data: {} };
      if (p === 'night-raid/collect') return { ok: true, data: {
        layout: { cells: [], soldiers: 0 }, collectedCoins: 5, collectedSoldiers: 0 } };
      return null;
    });
    ctx.appState = raidState(900);
    await ctx.NightRaid.collectResources();
    assert.equal(ctx.appState.coins, 905,
      'a reply without a coins field must fall back to local + harvest, never 0');
  });

  test('a well-formed reply still hands the server balance to the wallet', async () => {
    const { ctx } = loadNightRaid(p => {
      if (p === 'night-raid/home') return { ok: true, data: {} };
      if (p === 'night-raid/collect') return { ok: true, data: {
        coins: 950, layout: { cells: [], soldiers: 0 }, collectedCoins: 50, collectedSoldiers: 0 } };
      return null;
    });
    ctx.appState = raidState(900);
    await ctx.NightRaid.collectResources();
    assert.equal(ctx.appState.coins, 950);
  });

  test('syncHome omits an unhydrated wallet instead of pushing 0 to the server', async () => {
    const { ctx, apiCalls } = loadNightRaid(p => {
      if (p === 'night-raid/home') return { ok: true, data: {} };
      return { ok: false, data: null };
    });
    ctx.appState = raidState(undefined);
    delete ctx.appState.dogLevel;
    await ctx.NightRaid.collectResources(); // first step is a syncHome PUT
    const put = apiCalls.find(c => c.path === 'night-raid/home' && c.method === 'PUT');
    assert.truthy(put, 'the home sync still happens');
    assert.falsy('coins' in put.body, 'no numeric wallet -> no coins field');
    assert.falsy('dogLevel' in put.body, 'no numeric level -> no dogLevel field');
  });

  test('a real wallet is still pushed as its exact number', async () => {
    const { ctx, apiCalls } = loadNightRaid(p => {
      if (p === 'night-raid/home') return { ok: true, data: {} };
      return { ok: false, data: null };
    });
    ctx.appState = raidState(1234);
    await ctx.NightRaid.collectResources();
    const put = apiCalls.find(c => c.path === 'night-raid/home' && c.method === 'PUT');
    assert.equal(put.body.coins, 1234);
    assert.equal(put.body.dogLevel, 2);
    assert.falsy('vaultCoins' in put.body,
      'vault_coins is a dead write-only column — the client must stop feeding it');
  });
});

// ---- the defender's wallet: the one number the SERVER moves ----------------
// Every other coin path starts on the device. This one does not: when someone
// attacks this child's house and LOSES, functions/api/night-raid/finish.js
// credits night_raid_homes.lootable_coins while the child is asleep. The
// device cannot know it happened — and the next PUT /night-raid/home used to
// push the wallet the phone still remembered straight over it, so the xu the
// child had earned by defending simply vanished.
//
// Both halves are REAL here: the actual client in a vm, the actual Pages
// handler over a real SQLite row, with nothing between them but the network
// hop. Executed, not substring-matched.
const { createWorld, loadModule: loadPagesModule } = require('./pages-harness');

function liveNightRaid(world, user) {
  const home = loadPagesModule('functions/api/night-raid/home.js');
  return loadNightRaid(async (p, opts) => {
    if (p !== 'night-raid/home') return { ok: false, data: null };
    const method = (opts && opts.method) || 'GET';
    const r = await world.call(method === 'PUT' ? home.onRequestPut : home.onRequestGet,
      { url: '/api/night-raid/home', method, token: user.token, body: opts && opts.body });
    return { ok: r.ok, data: r.data };
  });
}
// open() fires the GET without handing back a promise, so drain the queue the
// way the browser would between the child's taps.
const drain = async (ticks = 20) => { for (let i = 0; i < ticks; i++) await new Promise(r => setImmediate(r)); };
const lootable = (world, uid) =>
  world.db.prepare('SELECT lootable_coins FROM night_raid_homes WHERE user_id=?').get(uid).lootable_coins;

async function seedRaidHome(world, user, coins) {
  const home = loadPagesModule('functions/api/night-raid/home.js');
  const r = await world.call(home.onRequestPut, {
    url: '/api/night-raid/home', method: 'PUT', token: user.token,
    body: { layout: { cells: [], soldiers: 0, dogLane: 2 }, dogLevel: 2, castleSkin: 'stone-keep', coins },
  });
  assert.truthy(r.ok, 'seeding the home must succeed: ' + JSON.stringify(r.data));
  return r;
}

suite('money client: coins won while the child was offline survive the next sync', () => {
  test('a defender who beat off a raid while asleep keeps the reward through open + PUT', async () => {
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    await seedRaidHome(world, user, 500);
    // The attack the child slept through: finish.js pays the defender.
    world.db.prepare('UPDATE night_raid_homes SET lootable_coins=lootable_coins+? WHERE user_id=?')
      .run(100, user.uid);
    assert.equal(lootable(world, user.uid), 600);

    const { ctx } = liveNightRaid(world, user);
    ctx.appState = raidState(500);         // the device still remembers 500
    ctx.NightRaid.open();
    await drain();
    assert.equal(ctx.appState.coins, 600, 'the client must adopt what the server credited');

    // …and the very next PUT must carry the reconciled number, not the stale one.
    await ctx.NightRaid.collectResources();
    await drain();
    assert.equal(lootable(world, user.uid), 600, 'the reward must survive the sync that follows');
    assert.equal(ctx.appState.coins, 600);
  });

  test('a device that is AHEAD is never dragged down by a stale row', async () => {
    // Lessons, the shop, the cups and the armoury all move appState.coins
    // without telling any server (functions/api/coins.js: "the wallet lives in
    // the child's device profile"). Adopting the row outright would eat the xu
    // a child earned in a lesson two minutes ago.
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    await seedRaidHome(world, user, 500);

    const { ctx } = liveNightRaid(world, user);
    ctx.appState = raidState(800);         // +300 earned in a lesson since
    ctx.NightRaid.open();
    await drain();
    assert.equal(ctx.appState.coins, 800, 'a lower row is the device being ahead, not a debt');

    await ctx.NightRaid.collectResources();
    await drain();
    assert.equal(lootable(world, user.uid), 800, 'and the PUT brings the row up to date');
  });

  test('an empty row can never zero a wallet', async () => {
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    await seedRaidHome(world, user, 0);

    const { ctx } = liveNightRaid(world, user);
    ctx.appState = raidState(1000);
    ctx.NightRaid.open();
    await drain();
    assert.equal(ctx.appState.coins, 1000, 'a 0 on the server is not an instruction to be poor');
  });

  test('a child with no home row yet still gets one, wallet intact', async () => {
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    const { ctx } = liveNightRaid(world, user);
    ctx.appState = raidState(750);
    ctx.NightRaid.open();
    await drain();
    assert.equal(ctx.appState.coins, 750);
    assert.equal(lootable(world, user.uid), 750, 'the first sync seeds the row from the device');
  });

  test('a PUT that starts during the GET waits for it instead of overwriting it', async () => {
    // The race the ordering in open() exists for: a sync fired while the read
    // is still in the air used to land first and push the stale wallet.
    let releaseGet, gets = 0;
    const gate = new Promise(r => { releaseGet = r; });
    const puts = [];
    const { ctx } = loadNightRaid(async (p, opts) => {
      if (p !== 'night-raid/home') return { ok: false, data: null };
      if ((opts && opts.method) === 'PUT') { puts.push(opts.body.coins); return { ok: true, data: { layout: { cells: [], soldiers: 0 } } }; }
      gets++;
      await gate;
      return { ok: true, data: { home: { lockedUntil: 0, shieldUntil: 0, lootableCoins: 600, layout: { cells: [], soldiers: 0, dogLane: 2 } } } };
    });
    ctx.appState = raidState(500);
    ctx.NightRaid.open();
    await drain(3);
    assert.equal(gets, 1, 'the read is in the air');
    const syncing = ctx.NightRaid.collectResources();   // starts with a syncHome PUT
    await drain(3);
    assert.deepEqual(puts, [], 'and no PUT may overtake it');
    releaseGet();
    await syncing; await drain();
    assert.equal(ctx.appState.coins, 600, 'the read landed first');
    assert.deepEqual(puts, [600], 'so the PUT carried the reconciled wallet, not the stale 500');
  });
});

// ---- the login migration (js/app.js) ----
suite('money client: logging in never costs a wallet or a dog', () => {
  const { loadAppCode } = require('./setup');
  function seed(app, data) {
    app.localStorage.setItem('flashlingo-users', JSON.stringify(['Kid']));
    app.localStorage.setItem('flashlingo-user-Kid', JSON.stringify(data));
  }

  test('an existing wallet and dog survive login untouched', () => {
    const app = loadAppCode({});
    seed(app, { points: 1000, coins: 5000, dogGrowthXP: 30000, dogLevel: 9, srs: {} });
    try { app.loginUser('Kid'); } catch (e) { /* later render steps may lack DOM */ }
    const st = app.__getAppState();
    assert.equal(st.coins, 5000);
    assert.equal(st.dogLevel, 9);
    assert.equal(st.dogGrowthXP, 30000);
  });

  test('a legacy profile derives its dog level from XP, not a hardcoded 1', () => {
    const app = loadAppCode({});
    seed(app, { points: 1000, coins: 5000, dogGrowthXP: 30000, srs: {} });
    try { app.loginUser('Kid'); } catch (e) {}
    const st = app.__getAppState();
    assert.equal(st.coins, 5000, 'coins already present are never reseeded');
    assert.equal(st.dogLevel, app.getDogLevel(30000));
    assert.truthy(st.dogLevel > 1, 'sanity: 30000 XP is well past level 1');
  });

  test('when the level formula is not loaded, login must not brand the dog level 1 forever', () => {
    // home.js failing to load (a half-updated service worker cache) used to
    // make the migration write dogLevel = 1 permanently — the === undefined
    // guard then protected the WRONG value on every later login.
    const app = loadAppCode({ includeHome: false });
    seed(app, { points: 1000, coins: 5000, dogGrowthXP: 30000, srs: {} });
    try { app.loginUser('Kid'); } catch (e) {}
    const st = app.__getAppState();
    assert.falsy(st.dogLevel === 1, 'a wrong permanent 1 must never be persisted');
    const saved = JSON.parse(app.localStorage.getItem('flashlingo-user-Kid'));
    assert.falsy(saved.dogLevel === 1, 'the wrong 1 must not reach disk either');
  });

  test('the migration is idempotent: a second login changes no money field', () => {
    const app = loadAppCode({});
    seed(app, { points: 1000, srs: {} }); // truly legacy: no coins at all
    try { app.loginUser('Kid'); } catch (e) {}
    const first = JSON.parse(JSON.stringify(app.__getAppState()));
    try { app.loginUser('Kid'); } catch (e) {}
    const second = app.__getAppState();
    for (const k of ['coins', 'dogGrowthXP', 'dogLevel', 'petBattleCastleSkins', 'vaultCoins']) {
      assert.deepEqual(second[k], first[k], k + ' must not drift on re-login');
    }
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
