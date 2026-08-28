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
    coins, dogLevel: 2, vaultCoins: 0, battleTeammates: [],
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
