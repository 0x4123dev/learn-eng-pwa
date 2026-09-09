// battle-lobby-poll-cost.test.js — what one lobby poll costs the database.
//
// This is a COST test, and it exists because the cost was invisible until
// somebody read the bill. The Đấu trường lobby polls GET /api/battle for as
// long as a child sits on the screen. At one call a second, re-running a
// three-day aggregate over `activities` each time, that single screen was
// ~85% of every row this app's database read — 2.69M rows in three days, to
// re-answer "how much ammo do you have" for a child who was standing still.
//
// So the endpoint grew a `?light=1` shape carrying only what moves between
// two seconds, and the client polls that. The things worth pinning are:
//
//   1. The light shape really is cheaper — asserted by COUNTING queries against
//      a real database, not by reading the source. A future edit that quietly
//      puts ammoStatsFor back on the polling path fails here.
//   2. The light shape still carries the one thing the lobby is watching for:
//      an incoming challenge. Cheap and useless is not an improvement.
//   3. The full shape is unchanged, because that is what the screen opens with.
//   4. The client merges rather than replaces, so ammo does not blink away.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function handler() { return loadModule('functions/api/battle/index.js'); }

// Count every statement the handler prepares, by wrapping the D1 binding.
async function callCountingQueries(world, url, token) {
  const seen = [];
  const realPrepare = world.env.DB.prepare.bind(world.env.DB);
  world.env.DB.prepare = (sql) => { seen.push(String(sql).replace(/\s+/g, ' ').trim()); return realPrepare(sql); };
  try {
    const res = await world.call(handler().onRequestGet, { method: 'GET', url, token });
    return { res, queries: seen };
  } finally {
    world.env.DB.prepare = realPrepare;
  }
}

async function arena() {
  const world = createWorld();
  const kid = await world.createUser({});
  const friend = await world.createUser({});
  return { world, kid, friend };
}

suite('lobby poll: the light shape is genuinely cheaper', () => {
  test('a light poll runs strictly fewer queries than a full one', async () => {
    const { world, kid } = await arena();
    const full = await callCountingQueries(world, '/api/battle', kid.token);
    const light = await callCountingQueries(world, '/api/battle?light=1', kid.token);
    assert.equal(full.res.status, 200);
    assert.equal(light.res.status, 200);
    assert.truthy(light.queries.length < full.queries.length,
      `light ran ${light.queries.length} queries, full ran ${full.queries.length}`);
  });

  test('a light poll never runs the three-day ammo aggregate', async () => {
    // The single most expensive statement in the whole app: ~60 rows read to
    // produce a number that cannot change while the child is on this screen.
    const { world, kid } = await arena();
    const light = await callCountingQueries(world, '/api/battle?light=1', kid.token);
    const ammoish = light.queries.filter(q => /FROM activities|FROM exam_attempts/i.test(q));
    assert.deepEqual(ammoish, [],
      'the ammo aggregate is back on the polling path — this was 60% of all rows read');
  });

  test('a light poll does not re-read the admin bot switch either', async () => {
    const { world, kid } = await arena();
    const light = await callCountingQueries(world, '/api/battle?light=1', kid.token);
    assert.deepEqual(light.queries.filter(q => /allow_bot/.test(q)), []);
  });

  test('a full poll still runs it — this is what the screen opens with', async () => {
    const { world, kid } = await arena();
    const full = await callCountingQueries(world, '/api/battle', kid.token);
    assert.truthy(full.queries.some(q => /FROM activities/i.test(q)),
      'the full shape must still compute ammo');
    assert.truthy(full.res.data.ammo !== undefined, 'full reply carries ammo');
    assert.truthy(full.res.data.stats !== undefined, 'full reply carries stats');
    assert.truthy(full.res.data.allowBot !== undefined, 'full reply carries allowBot');
  });
});

suite('lobby poll: cheap must not mean useless', () => {
  test('the light shape still carries the cooldown and the battle slot', async () => {
    const { world, kid } = await arena();
    const r = (await callCountingQueries(world, '/api/battle?light=1', kid.token)).res;
    assert.equal(r.status, 200);
    assert.truthy('readyAt' in r.data, 'the cooldown must still move');
    assert.truthy('battle' in r.data, 'the whole point of polling is to see a challenge arrive');
    assert.truthy('now' in r.data && 'inviteTtlMs' in r.data);
  });

  test('and it omits exactly the fields the client keeps from the full call', async () => {
    const { world, kid } = await arena();
    const r = (await callCountingQueries(world, '/api/battle?light=1', kid.token)).res;
    for (const k of ['ammo', 'stats', 'allowBot']) {
      assert.falsy(k in r.data, k + ' should not be re-sent on every poll');
    }
  });

  test('a stranger is refused on both shapes', async () => {
    const { world } = await arena();
    assert.equal((await callCountingQueries(world, '/api/battle?light=1')).res.status, 401);
    assert.equal((await callCountingQueries(world, '/api/battle')).res.status, 401);
  });
});

suite('lobby poll: the reaper still reaps, just not every second', () => {
  test('it reaps, then holds for the gap, then reaps again', async () => {
    // The clock is injected rather than slept through, and the base is pushed
    // far ahead so this does not depend on whether an earlier test in this
    // process already tripped the module-level throttle.
    const { world } = await arena();
    const lib = loadModule('functions/api/_battle.js');
    const gap = lib.REAP_MIN_GAP_MS;
    const t0 = Date.now() + 3600000;
    assert.equal(await lib.reapStaleThrottled(world.env, t0), true, 'the first call must reap');
    assert.equal(await lib.reapStaleThrottled(world.env, t0 + 1), false, 'an immediate second must not');
    assert.equal(await lib.reapStaleThrottled(world.env, t0 + gap - 1), false, 'still inside the gap');
    assert.equal(await lib.reapStaleThrottled(world.env, t0 + gap), true, 'the gap must reopen');
  });

  test('the gap is short enough that a dead invite cannot linger long', async () => {
    const lib = loadModule('functions/api/_battle.js');
    const ttl = lib.INVITE_TTL_MS;
    assert.truthy(lib.REAP_MIN_GAP_MS <= ttl,
      'a stale invite must never outlive its own TTL by a whole reap gap');
  });

  test('every endpoint that ACTS on a battle still reaps exactly', () => {
    // This is what makes throttling the polling path safe: an expired invite
    // can never be accepted, however stale the lobby's view of it looks.
    for (const f of ['respond', 'turn', 'challenge']) {
      const src = read('functions/api/battle/' + f + '.js');
      assert.truthy(/await reapStale\(env\)/.test(src),
        f + '.js must call the un-throttled reaper before acting');
      assert.falsy(/reapStaleThrottled/.test(src),
        f + '.js must NOT use the throttled reaper — it acts on what it reads');
    }
  });
});

suite('lobby poll: the client half', () => {
  const arenaSrc = () => read('js/petbattle.js');

  test('the lobby no longer polls once a second', () => {
    const m = /const PB_POLL_LOBBY_MS = (\d+);/.exec(arenaSrc());
    assert.truthy(m, 'PB_POLL_LOBBY_MS must exist');
    assert.truthy(Number(m[1]) >= 5000,
      'the lobby poll is back under 5s — it was 85% of all rows read at 1s');
  });

  test('a hidden tab stops polling', () => {
    // An iPad left on this screen and put down used to poll for as long as the
    // browser lived. That, not real use, is what a spike day is made of.
    const src = arenaSrc();
    assert.truthy(src.includes('visibilitychange'), 'nothing listens for the tab being hidden');
    assert.truthy(/_pbHidden\(\)/.test(src), 'the poll must check visibility');
    assert.truthy(/!_pbGame && !_pbHidden\(\)/.test(src),
      'the tick must skip the request while hidden, not merely re-render');
  });

  test('a light poll MERGES, so ammo cannot blink to undefined', () => {
    const src = arenaSrc();
    const body = src.slice(src.indexOf('async function refreshPetBattle('),
                           src.indexOf('function pbFmtCountdown'));
    assert.truthy(/Object\.assign\(\{\}, _pbState, r\.data\)/.test(body),
      'a light reply must be merged over the last full one, never replace it');
    assert.truthy(/light=1/.test(body), 'the poll must actually ask for the light shape');
  });

  test('the full shape is still asked for periodically and on return to the tab', () => {
    const src = arenaSrc();
    assert.truthy(/PB_FULL_REFRESH_MS/.test(src), 'ammo must refresh on some cadence');
    const m = /const PB_FULL_REFRESH_MS = (\d+);/.exec(src);
    assert.truthy(m && Number(m[1]) <= 300000, 'ammo cannot go stale for more than 5 minutes');
    assert.truthy(/_pbLastFullAt = 0;\s*\n\s*try \{ refreshPetBattle\(false\)/.test(src),
      'returning to the tab must force a FULL refresh');
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
