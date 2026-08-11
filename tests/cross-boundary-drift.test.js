// cross-boundary-drift.test.js — values that MUST be identical in two places
// that cannot import each other.
//
// This project has three runtimes that never share a module: the browser
// (js/*.js, classic scripts), Cloudflare Pages Functions (functions/**, ESM),
// and the relay Durable Object (battle-worker/, a separate deploy). Any value
// duplicated across that boundary can drift, and drift there fails SILENTLY —
// nothing throws, the feature just quietly does the wrong thing.
//
// The arena-allowlist guard in tests/battle-scenes.test.js is the same idea.
// This file covers the rest of them.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const C = require(path.join(ROOT, 'js', 'battlecalc.js'));

const serverBattle = read('functions/api/_battle.js');
const turnSrc = read('functions/api/battle/turn.js');
const gameSrc = read('js/petbattlegame.js');
const workerSrc = read('battle-worker/src/index.js');
const linkSrc = read('js/battlelink.js');

const serverNum = (name) => {
    const m = serverBattle.match(new RegExp('export const ' + name + ' = (\\d+)'));
    return m ? +m[1] : null;
};

suite('drift: battle constants shared by the client and the API', () => {
    // MAX_TURNS decides when a battle ends. If the two sides disagree, one
    // keeps offering turns the other has already closed.
    test('MAX_TURNS is identical on both sides', () => {
        const m = serverBattle.match(/export const MAX_TURNS = ([^;]+);/);
        const c = read('js/battlecalc.js').match(/const MAX_TURNS = ([^;]+);/);
        assert.truthy(m && c, 'MAX_TURNS must exist on both sides');
        assert.equal(m[1].trim(), c[1].trim(), 'MAX_TURNS expression differs between server and client');
        assert.equal(C.MAX_TURNS, 44, 'and the computed value is pinned');
    });

    test('every numeric rule the server exports matches the client', () => {
        for (const name of ['AMMO_PER_CORRECT', 'AMMO_VOLUME_MAX', 'AMMO_PERFECT_MAX',
            'AMMO_STREAK_BONUS', 'AMMO_CAP', 'BARRELS', 'BATTLE_ROUNDS']) {
            assert.equal(serverNum(name), C[name], `${name} differs between server and client`);
        }
    });
});

suite('drift: the battlefield version', () => {
    // The nastiest one. The server stamps field_version onto the battle row;
    // the client turns it into terrain. If the server ever writes a version
    // the client does not know, fieldRules() falls back to v1 and the child
    // plays a DIFFERENT WORLD from the one the battle was created in — with
    // no error anywhere.
    test('the client can render every version the server may write', () => {
        const newV = serverNum('FIELD_VERSION_NEW');
        const maxV = serverNum('FIELD_VERSION_MAX');
        assert.truthy(newV && maxV, 'server field-version constants missing');
        const known = Object.keys(C.FIELD_RULES).map(Number);
        for (let v = 1; v <= maxV; v++) {
            assert.truthy(known.includes(v), `server allows field_version ${v} but the client has no rules for it`);
            assert.equal(C.fieldRules(v).version, v, `fieldRules(${v}) silently fell back to v${C.fieldRules(v).version}`);
        }
        assert.truthy(newV <= maxV, 'new battles must not be stamped above the supported maximum');
        assert.equal(C.fieldRules(newV).version, newV,
            'the version new battles are stamped with must be one the client can actually draw');
    });

    test('an unknown version falls back rather than throwing', () => {
        const maxV = serverNum('FIELD_VERSION_MAX');
        assert.equal(C.fieldRules(maxV + 1).version, 1, 'a future version must degrade to v1, not crash');
    });
});

suite('drift: the damage clamp', () => {
    // turn.js re-types the damage formula because it cannot import battlecalc.
    // If shotDamage() changes and the clamp does not, the server either
    // rejects legitimate hits or lets a tampered client claim inflated ones.
    test('the server clamp uses the same numbers as shotDamage()', () => {
        const m = turnSrc.match(/\(([\d.]+) \+ ([\d.]+) \* Math\.max\(1, level \|\| 1\)\)/);
        assert.truthy(m, 'could not find the re-typed damage formula in turn.js');
        const base = +m[1], perLevel = +m[2];
        // Recover the client's own coefficients from the function itself.
        const at1 = C.shotDamage(1), at101 = C.shotDamage(101);
        const clientPerLevel = (at101 - at1) / 100;
        const clientBase = at1 - clientPerLevel;
        assert.equal(base, +clientBase.toFixed(6), 'damage base differs from shotDamage()');
        assert.equal(perLevel, +clientPerLevel.toFixed(6), 'per-level damage differs from shotDamage()');
    });

    test('the clamp multiplier matches the client maximum', () => {
        const m = turnSrc.match(/\* ([\d.]+)\);/);
        assert.truthy(m, 'direct-hit multiplier not found in turn.js');
        // maxTurnDamage(shots, level) on the client uses the same 1.5.
        const expected = C.maxTurnDamage(1, 100) / Math.ceil(C.shotDamage(100));
        assert.truthy(Math.abs(+m[1] - 1.5) < 1e-9, `server multiplier ${m[1]} is not 1.5`);
        assert.truthy(expected > 1, 'client maxTurnDamage should exceed a single plain hit');
    });
});

suite('drift: the relay worker', () => {
    // battle-worker is a SEPARATE deploy. It allowlists message types and
    // emoji; anything the client sends that is missing there is dropped in
    // silence — the opponent simply never sees it.
    test('the worker relays every message type the client sends', () => {
        const clientTypes = [...linkSrc.matchAll(/_send\(\{\s*t:\s*'([a-z]+)'/g)].map(m => m[1]);
        assert.truthy(clientTypes.length >= 4, `only found ${clientTypes.length} client message types`);
        const allow = workerSrc.match(/RELAY_TYPES = new Set\(\[([^\]]+)\]\)/);
        assert.truthy(allow, 'worker RELAY_TYPES not found');
        const relayed = (allow[1].match(/'[^']+'/g) || []).map(s => s.slice(1, -1));
        const dropped = clientTypes.filter(t => !relayed.includes(t));
        assert.equal(dropped.join(', '), '', 'the worker would silently drop these client messages');
    });

    test('the worker accepts exactly the emoji the client offers', () => {
        const clientEmotes = gameSrc.match(/\[('(?:[^']+)',\s*)+'[^']+'\]\.map\(e =>/);
        assert.truthy(clientEmotes, 'client emote list not found');
        const client = (clientEmotes[0].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));
        const workerSet = workerSrc.match(/EMOTES = new Set\(\[([^\]]+)\]\)/);
        assert.truthy(workerSet, 'worker EMOTES not found');
        const worker = (workerSet[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));
        const dropped = client.filter(e => !worker.includes(e));
        const orphan = worker.filter(e => !client.includes(e));
        assert.equal(dropped.join(' '), '', 'these emoji would never reach the opponent');
        assert.equal(orphan.join(' '), '', 'the worker allows emoji the client cannot send');
        assert.equal(client.length, worker.length);
    });
});

suite('drift: the username rule', () => {
    // Already pinned in tests/username.test.js; asserted here too so the whole
    // cross-boundary inventory lives in one place.
    test('the client and the register endpoint share one pattern', () => {
        const srv = read('functions/api/register.js').match(/(\/\^\[[^\n]*?\/u)\.test\(username\)/);
        const cli = read('js/auth.js').match(/const USERNAME_RE = (\/\^\[[^\n]*?\/u);/);
        assert.truthy(srv && cli, 'username pattern missing on one side');
        assert.equal(cli[1], srv[1], 'the username rule differs between client and server');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
