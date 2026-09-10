// admin-night-raid-config.test.js — the admin screen that retunes Cướp Đêm.
//
// The handler is EXECUTED against a real SQLite database (tests/pages-harness.js),
// never substring-checked: this endpoint decides how much money moves in every
// raid, so "the source contains a range check" is not evidence that the range
// is enforced.
//
// Four things are pinned here, each one a way this could go wrong silently:
//
//   1. Only an admin may touch it. It rewrites the economy for every child.
//   2. An out-of-range number is REFUSED, not clamped. Clamping would leave the
//      admin looking at 500 in a box while the game plays 100 — the exact
//      confusion this whole screen exists to remove.
//   3. A database without night_raid_config still answers GET with the
//      defaults. The code ships before db/021 is applied, so a 500 here would
//      mean a dead admin tab for however long that gap lasts.
//   4. The page's field list and the server's key list are the SAME set. Add a
//      rule to the game with no row in admin.html and it becomes untunable and
//      invisible, which is precisely the state this feature was built to end.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const HANDLER = 'functions/api/admin/night-raid-config.js';
function handler() { return loadModule(HANDLER); }
function core() { return loadModule('functions/api/_night-raid.js'); }

const get = (world, o) => world.call(handler().onRequestGet, Object.assign(
  { method: 'GET', url: '/api/admin/night-raid-config' }, o));
const post = (world, o) => world.call(handler().onRequestPost, Object.assign(
  { method: 'POST', url: '/api/admin/night-raid-config' }, o));

async function adminWorld(opts) {
  const world = createWorld(opts);
  const admin = await world.createUser({ username: 'boss', role: 'admin' });
  const kid = await world.createUser({});
  return { world, admin, kid };
}

suite('night raid config: who may touch the economy', () => {
  test('no token at all is 401 on both verbs', async () => {
    const { world } = await adminWorld();
    assert.equal((await get(world, {})).status, 401);
    assert.equal((await post(world, { body: { key: 'win_cap', value: 50 } })).status, 401);
  });

  test('a child with a perfectly valid token is 403, and changes nothing', async () => {
    const { world, kid } = await adminWorld();
    assert.equal((await get(world, { token: kid.token })).status, 403);
    const r = await post(world, { token: kid.token, body: { key: 'win_cap', value: 9 } });
    assert.equal(r.status, 403);
    assert.equal(world.db.prepare('SELECT COUNT(*) AS n FROM night_raid_config').get().n, 0,
      'a forbidden request must not have written a row on its way to the 403');
  });

  test('an admin gets the complete rulebook plus the defaults to compare against', async () => {
    const { world, admin } = await adminWorld();
    const r = await get(world, { token: admin.token });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.config, core().RAID_CONFIG_DEFAULTS,
      'an empty table is the normal state and must read as the defaults');
    assert.deepEqual(r.data.defaults, core().RAID_CONFIG_DEFAULTS);
    assert.deepEqual(r.data.ranges, core().RAID_CONFIG_RANGE,
      'the page draws its min/max from here, so it cannot claim a limit the server does not enforce');
  });
});

suite('night raid config: the allow-list', () => {
  test('a key the game does not have is refused, not stored', async () => {
    const { world, admin } = await adminWorld();
    for (const key of ['win_pct_', 'WIN_CAP', 'nonsense', '', 'updated_at']) {
      const r = await post(world, { token: admin.token, body: { key, value: 5 } });
      assert.equal(r.status, 400, 'refused: ' + JSON.stringify(key));
      assert.equal(r.data.error, 'Unknown key');
    }
    assert.equal(world.db.prepare('SELECT COUNT(*) AS n FROM night_raid_config').get().n, 0,
      'a mistyped key must never be able to sit in the table pretending to do something');
  });

  test('a prototype key cannot smuggle itself past the allow-list', async () => {
    const { world, admin } = await adminWorld();
    const r = await post(world, { token: admin.token, body: { key: 'constructor', value: 1 } });
    assert.equal(r.status, 400);
    assert.equal(r.data.error, 'Unknown key');
  });

  test('every key the game defines really is writable — none is listed but dead', async () => {
    const { world, admin } = await adminWorld();
    for (const key of core().RAID_CONFIG_KEYS) {
      const r = await post(world, { token: admin.token, body: { key, value: 7 } });
      assert.equal(r.status, 200, key + ' should be writable');
      assert.equal(r.data.config[key], 7);
    }
  });
});

suite('night raid config: a value is refused, never quietly bent', () => {
  // Just inside and just outside, for every key, both ends. RAID_CONFIG_RANGE
  // is the server's own table, so a range widened there is tested at its new
  // edge automatically rather than against a number copied into this file.
  test('both ends of every range: the edge saves, one step past it does not', async () => {
    const { world, admin } = await adminWorld();
    const RANGE = core().RAID_CONFIG_RANGE;
    for (const key of core().RAID_CONFIG_KEYS) {
      const [min, max] = RANGE[key];
      for (const ok of [min, max]) {
        const r = await post(world, { token: admin.token, body: { key, value: ok } });
        assert.equal(r.status, 200, key + ' = ' + ok + ' is inside the range');
        assert.equal(r.data.config[key], ok);
      }
      for (const bad of [min - 1, max + 1]) {
        const r = await post(world, { token: admin.token, body: { key, value: bad } });
        assert.equal(r.status, 400, key + ' = ' + bad + ' is outside the range');
        assert.truthy(String(r.data.error).indexOf(String(min)) >= 0 &&
                      String(r.data.error).indexOf(String(max)) >= 0,
          'the refusal must name the range the admin has to stay inside: ' + r.data.error);
      }
      // The last accepted write was `max`; a refusal must not have moved it.
      const stored = world.db.prepare('SELECT value FROM night_raid_config WHERE key=?').get(key);
      assert.equal(stored.value, max, key + ' kept its last GOOD value through two refusals');
    }
  });

  test('a refused value is refused, not clamped to the nearest legal one', async () => {
    const { world, admin } = await adminWorld();
    const r = await post(world, { token: admin.token, body: { key: 'win_pct', value: 500 } });
    assert.equal(r.status, 400, 'silently storing 100 would leave the admin reading a rule the game is not playing by');
    const after = await get(world, { token: admin.token });
    assert.equal(after.data.config.win_pct, core().RAID_CONFIG_DEFAULTS.win_pct);
  });

  test('anything that is not a whole number is refused', async () => {
    const { world, admin } = await adminWorld();
    for (const value of [10.5, '10.5', 'abc', '', '  ', null, true, false, [], {}, undefined, NaN, Infinity, '1e999']) {
      const r = await post(world, { token: admin.token, body: { key: 'win_cap', value } });
      assert.equal(r.status, 400, 'refused: ' + JSON.stringify(value === undefined ? 'undefined' : value));
      assert.truthy(/số/.test(String(r.data.error)), 'the refusal has to say what was wrong: ' + r.data.error);
    }
    assert.equal((await get(world, { token: admin.token })).data.config.win_cap,
      core().RAID_CONFIG_DEFAULTS.win_cap);
  });

  test('a numeric string from a form field is accepted — it is what an <input> sends', async () => {
    const { world, admin } = await adminWorld();
    const r = await post(world, { token: admin.token, body: { key: 'seal_hours', value: ' 6 ' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.config.seal_hours, 6);
    assert.equal(typeof r.data.config.seal_hours, 'number', 'the config is integers, never strings');
  });

  test('a body that is not JSON at all is a 400, not a crash', async () => {
    const { world, admin } = await adminWorld();
    const request = new Request('http://app.test/api/admin/night-raid-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + admin.token },
      body: 'not json',
    });
    const res = await handler().onRequestPost({ request, env: world.env });
    assert.equal(res.status, 400);
  });
});

suite('night raid config: what is written is what comes back', () => {
  test('a saved value survives the round trip and reaches the game itself', async () => {
    const { world, admin } = await adminWorld();
    const w = await post(world, { token: admin.token, body: { key: 'win_cap', value: 250 } });
    assert.equal(w.status, 200);
    assert.equal(w.data.ok, true);
    assert.equal(w.data.config.win_cap, 250, 'the POST answers with the new rulebook, so the page need not re-fetch');

    const r = await get(world, { token: admin.token });
    assert.equal(r.data.config.win_cap, 250);
    assert.deepEqual(r.data.defaults, core().RAID_CONFIG_DEFAULTS,
      'the defaults column must keep showing the DEFAULT, not the value just saved');

    // The endpoint and the game read the same table through the same function.
    const live = await core().readRaidConfig(world.env);
    assert.equal(live.win_cap, 250, 'the raid itself must see the admin edit');
  });

  test('editing one rule leaves the other seven alone', async () => {
    const { world, admin } = await adminWorld();
    await post(world, { token: admin.token, body: { key: 'loss', value: 33 } });
    const r = await get(world, { token: admin.token });
    for (const key of core().RAID_CONFIG_KEYS) {
      if (key === 'loss') continue;
      assert.equal(r.data.config[key], core().RAID_CONFIG_DEFAULTS[key], key + ' must not have moved');
    }
  });

  test('saving the same key twice updates the row instead of failing on the primary key', async () => {
    const { world, admin } = await adminWorld();
    await post(world, { token: admin.token, body: { key: 'retry_hours', value: 3 } });
    const second = await post(world, { token: admin.token, body: { key: 'retry_hours', value: 9 } });
    assert.equal(second.status, 200);
    assert.equal(second.data.config.retry_hours, 9);
    assert.equal(world.db.prepare("SELECT COUNT(*) AS n FROM night_raid_config WHERE key='retry_hours'").get().n, 1);
  });

  test('the row records WHO changed it and WHEN', async () => {
    const { world, admin } = await adminWorld();
    const before = Date.now();
    await post(world, { token: admin.token, body: { key: 'shield_loss', value: 150 } });
    const row = world.db.prepare("SELECT * FROM night_raid_config WHERE key='shield_loss'").get();
    assert.equal(row.updated_by, admin.uid);
    assert.truthy(row.updated_at >= before, 'an unstamped edit cannot be traced back to a raid that felt wrong');
  });
});

suite('night raid config: the migration may lag the deploy', () => {
  // db/021 is applied by hand after the code goes live. For that window the
  // admin tab must still open and show the rules the game is really playing by.
  const withoutTable = async () => {
    const w = await adminWorld();
    w.world.db.exec('DROP TABLE night_raid_config');
    return w;
  };

  test('GET answers with the defaults instead of a 500', async () => {
    const { world, admin } = await withoutTable();
    const r = await get(world, { token: admin.token });
    assert.equal(r.status, 200, 'a missing table must not take the admin screen down');
    assert.deepEqual(r.data.config, core().RAID_CONFIG_DEFAULTS);
    assert.deepEqual(r.data.defaults, core().RAID_CONFIG_DEFAULTS);
  });

  test('POST fails with a sentence that says how to fix it, not a stack trace', async () => {
    const { world, admin } = await withoutTable();
    const r = await post(world, { token: admin.token, body: { key: 'win_cap', value: 40 } });
    assert.equal(r.status, 500);
    assert.truthy(/night_raid_config/.test(String(r.data.error)) && /021/.test(String(r.data.error)),
      'the admin must be told the migration is missing: ' + r.data.error);
  });

  test('a bad value is still refused before the table is ever touched', async () => {
    const { world, admin } = await withoutTable();
    const r = await post(world, { token: admin.token, body: { key: 'win_pct', value: 900 } });
    assert.equal(r.status, 400, 'validation comes first, so the message is about the value, not the schema');
  });
});

suite('night raid config: the admin page and the server agree', () => {
  const adminHtml = read('admin.html');
  // RAID_FIELDS is the page's only key list; parse it rather than trusting a
  // comment that says the two match.
  const pageKeys = (() => {
    const block = adminHtml.match(/const RAID_FIELDS = \[([\s\S]*?)\n\];/);
    if (!block) throw new Error('RAID_FIELDS not found in admin.html');
    return [...block[1].matchAll(/\bkey:'([a-z_]+)'/g)].map(m => m[1]);
  })();

  test('the page offers exactly the keys the server accepts — no more, no fewer', () => {
    assert.deepEqual(pageKeys.slice().sort(), core().RAID_CONFIG_KEYS.slice().sort(),
      'a rule with no row in admin.html is untunable; a row with no rule saves nothing');
  });

  test('no key is listed twice, and every one lands in a group that exists', () => {
    assert.equal(new Set(pageKeys).size, pageKeys.length, 'a duplicated key would render two boxes for one rule');
    const groups = [...adminHtml.matchAll(/\{ id:'(\w+)',\s+title:/g)].map(m => m[1]);
    assert.deepEqual(groups, ['money', 'time']);
    const used = [...adminHtml.matchAll(/group:'(\w+)'/g)].map(m => m[1]);
    assert.deepEqual([...new Set(used)].filter(g => groups.indexOf(g) === -1), [],
      'a field in an unknown group renders nowhere at all');
  });

  test('every key carries a Vietnamese sentence saying what it does', () => {
    const block = adminHtml.match(/const RAID_FIELDS = \[([\s\S]*?)\n\];/)[1];
    for (const key of core().RAID_CONFIG_KEYS) {
      const entry = block.split(/\{ key:'/).find(s => s.indexOf(key + "'") === 0);
      assert.truthy(entry, key + ' has no entry');
      assert.truthy(/help:'[^']{20,}'/.test(entry), key + ' has no explanation for the owner to read');
      assert.truthy(/label:'[^']+'/.test(entry), key + ' has no label');
    }
  });

  test('the card is reachable: a tab, a panel, and a loader wired to both', () => {
    assert.truthy(/data-tab="raid"/.test(adminHtml), 'no tab button');
    assert.truthy(/id="raidPanel"[^>]*role="tabpanel"/.test(adminHtml), 'no panel for the tab to control');
    assert.truthy(/if \(tab === 'raid'\) loadRaidConfig\(\)/.test(adminHtml), 'opening the tab never loads the rules');
    assert.truthy(/api\('admin\/night-raid-config'\)/.test(adminHtml), 'the page never GETs the config');
    assert.truthy(/api\('admin\/night-raid-config', \{ method:'POST'/.test(adminHtml), 'the page never saves');
    assert.truthy(fs.existsSync(path.join(ROOT, HANDLER)), 'the endpoint the page calls must exist');
  });

  test('the page shows the server refusal verbatim rather than inventing its own', () => {
    const fn = adminHtml.slice(adminHtml.indexOf('async function saveRaidKey('));
    assert.truthy(/note.textContent = '✗ ' \+ e.message/.test(fn),
      'a refused save must tell the admin WHY the server said no');
    assert.truthy(/note.className = 'raid-note ok'/.test(fn), 'a successful save must confirm itself');
  });

  test('the worked example uses win floor, cap and percentage, including an empty house', () => {
    const fn = adminHtml.slice(adminHtml.indexOf('function paintRaidExample('),
                               adminHtml.indexOf('function paintRaidStatus('));
    assert.truthy(/raidLiveValue\('win_cap'\)/.test(fn) && /raidLiveValue\('win_floor'\)/.test(fn) && /raidLiveValue\('win_pct'\)/.test(fn));
    assert.truthy(/Math\.min\(cap, share\)/.test(fn) && /Math\.max\(floor, loot\)/.test(fn),
      'the example must compute the victim loot and then apply the win floor');
    assert.truthy(/Nếu kho địch trống/.test(fn), 'the parent must see the exact empty-vault rule');
    assert.truthy(/RAID_EXAMPLE_PILE = 3000/.test(adminHtml), 'the example house holds 3.000 xu');
  });
});
if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
