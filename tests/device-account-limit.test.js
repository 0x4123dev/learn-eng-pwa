// device-account-limit.test.js — one device, two accounts, no more.
//
// This is the supply side of the same hole tests/friend-battle-delay.test.js
// covers the demand side of. That file makes a throwaway opponent useless for
// 3 days; this one makes throwaway opponents hard to mint at all.
//
// What "device" means here, and what it deliberately does NOT mean:
//   * it is an opaque random string the client stores in localStorage
//   * it is NOT a browser fingerprint — not acceptable in a children's app
//   * it is NOT the IP address — that would block siblings on one home wifi
//     and whole classes on one school network, i.e. exactly this app's users
// Clearing site data resets it. That is a known, accepted limit and the
// reason the 3-day friendship delay exists as the second layer.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const libSrc = read('functions/api/_lib.js');
const registerSrc = read('functions/api/register.js');
const flagsSrc = read('functions/api/admin/user-flags.js');
const authSrc = read('js/auth.js');
const friendsSrc = read('js/friends.js');
const migrationSrc = read('db/004-device-limit.sql');
const schemaSrc = read('db/schema.sql');

// normalizeDeviceId is pure, so run the REAL one rather than describing it.
const lib = (() => {
    const body = libSrc.slice(libSrc.indexOf('export function normalizeDeviceId'));
    const fn = body.slice(0, body.indexOf('\n}') + 2).replace(/^export /, '');
    const sandbox = { String };
    vm.createContext(sandbox);
    vm.runInContext(fn + '\nthis.normalizeDeviceId = normalizeDeviceId;', sandbox);
    return sandbox;
})();

// The client's id generator, executed with a fake localStorage.
function makeClientDeviceId() {
    const m = authSrc.match(/const DEVICE_KEY = [\s\S]*?\n  function _randomIdHex\(nBytes\) \{[\s\S]*?\n  \}/);
    if (!m) throw new Error('deviceId()/_randomIdHex not found in js/auth.js');
    const store = new Map();
    const sandbox = {
        Math, Array, Uint8Array,
        crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) % 256; return a; } },
        localStorage: {
            getItem: (k) => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, String(v)),
        },
    };
    vm.createContext(sandbox);
    vm.runInContext(m[0].replace(/^  /gm, '') + '\nthis.deviceId = deviceId;', sandbox);
    return { deviceId: sandbox.deviceId, store };
}

suite('device limit: the id itself', () => {
    test('the cap is 2', () => {
        assert.truthy(/MAX_ACCOUNTS_PER_DEVICE = 2/.test(libSrc));
    });

    test('a well-formed opaque id is accepted', () => {
        for (const id of ['d0123456789abcdef', 'A-Z_az09'.repeat(2), 'x'.repeat(64)]) {
            assert.equal(lib.normalizeDeviceId(id), id.trim(), `rejected a legal id: ${id}`);
        }
    });

    test('junk, empty and oversized ids are rejected, not silently accepted', () => {
        // A null return is what makes register.js refuse. If any of these
        // normalized to a truthy value, every caller sending it would share
        // one device bucket — and two strangers would block each other.
        for (const bad of [null, undefined, '', '   ', 'short', 'x'.repeat(65),
            'has space', 'has/slash', "or';drop", {}, 42, []]) {
            assert.equal(lib.normalizeDeviceId(bad), null, `accepted junk: ${JSON.stringify(bad)}`);
        }
    });

    test('the client generates an id its own server will accept', () => {
        // These two shape rules live in different runtimes. If they disagree,
        // every signup fails with "missing device id" and no child can
        // register at all — so the client id is fed to the real validator.
        const { deviceId } = makeClientDeviceId();
        const id = deviceId();
        assert.truthy(id, 'the client produced no id');
        assert.equal(lib.normalizeDeviceId(id), id,
            `the client generated ${id}, which its own server would refuse`);
    });

    test('the id is stable across calls — a new one each time is no limit at all', () => {
        const { deviceId } = makeClientDeviceId();
        const first = deviceId();
        assert.equal(deviceId(), first);
        assert.equal(deviceId(), first);
    });

    test('a corrupted stored id is replaced, not sent as-is', () => {
        const { deviceId, store } = makeClientDeviceId();
        store.set('flashlingo_device_id', 'nope!');       // fails the shape check
        const id = deviceId();
        assert.truthy(id !== 'nope!', 'a malformed stored id must be regenerated');
        assert.equal(lib.normalizeDeviceId(id), id);
    });
});

suite('device limit: registration enforces it', () => {
    test('the count is checked before the account is created', () => {
        const check = registerSrc.indexOf('MAX_ACCOUNTS_PER_DEVICE');
        const insert = registerSrc.indexOf('INSERT INTO users');
        assert.truthy(check > 0 && insert > 0);
        assert.truthy(check < insert, 'the limit is checked after the user exists — too late');
    });

    test('it refuses before hashing and before claiming the username', () => {
        // A blocked signup should cost neither a PBKDF2 round nor a name that
        // the child can then never use.
        const check = registerSrc.indexOf('MAX_ACCOUNTS_PER_DEVICE');
        assert.truthy(check < registerSrc.indexOf('pbkdf2Hex('), 'hashing runs before the limit check');
        assert.truthy(check < registerSrc.indexOf('Username already taken'), 'the name is claimed first');
    });

    test('a missing or junk device id fails CLOSED', () => {
        // normalizeDeviceId returns null for junk, and register must treat
        // that as a refusal. Accepting it would make "send no deviceId" the
        // one-line bypass for this entire feature.
        assert.truthy(/const deviceId = normalizeDeviceId\(body\.deviceId\)/.test(registerSrc));
        assert.truthy(/if \(!deviceId\) \{[\s\S]{0,200}return err\(/.test(registerSrc),
            'a request with no usable device id must be refused, not allowed through');
    });

    test('the refusal is machine-readable so the client can explain it', () => {
        assert.truthy(registerSrc.includes("code: 'device_limit'"));
        assert.truthy(registerSrc.includes('403'), 'a used-up quota is a 403, not a validation 400');
    });

    test('the device is recorded on the new account, or the count never grows', () => {
        assert.truthy(/INSERT INTO users \(username, passcode_hash, salt, role, device_id\)/.test(registerSrc));
        assert.truthy(/\.bind\(username, hash, salt, 'user', deviceId\)/.test(registerSrc));
    });

    test('login is NOT gated — the cap is on creating, not on using', () => {
        // A child on a shared iPad must always be able to sign back in to an
        // account that already exists.
        const loginSrc = read('functions/api/login.js');
        assert.falsy(loginSrc.includes('MAX_ACCOUNTS_PER_DEVICE'), 'the limit must not block signing in');
        assert.falsy(loginSrc.includes('device_id'), 'login should not care about the device');
    });
});

suite('device limit: the database backs it', () => {
    test('the migration adds the column and indexes it', () => {
        assert.truthy(/ALTER TABLE users ADD COLUMN device_id TEXT/.test(migrationSrc));
        assert.truthy(/CREATE INDEX IF NOT EXISTS idx_users_device ON users\(device_id\)/.test(migrationSrc),
            'every signup counts rows for a device — that must not be a table scan');
    });

    test('a fresh install gets the same shape as a migrated one', () => {
        // db/schema.sql and the migrations are two descriptions of one table.
        // When they drift, a brand-new deployment is subtly different from the
        // live one and the bug only appears on someone else's machine.
        assert.truthy(/device_id\s+TEXT/.test(schemaSrc), 'schema.sql is missing device_id');
        assert.truthy(schemaSrc.includes('idx_users_device'), 'schema.sql is missing the index');
    });

    test('existing accounts are not retroactively counted', () => {
        // The column is nullable with no default, and SQL equality never
        // matches NULL — so everyone registered before this shipped keeps
        // working and occupies nobody's quota.
        assert.falsy(/device_id TEXT NOT NULL/.test(migrationSrc), 'a NOT NULL column would break the ALTER');
        assert.truthy(/WHERE device_id = \?/.test(registerSrc),
            'counting must be an equality test, which never matches the NULL of old rows');
    });
});

suite('device limit: a real household is not locked out', () => {
    test('an admin can free a slot', () => {
        // Three siblings on one iPad is a legitimate case. Without a way out,
        // the only remedy would be hand-editing production data.
        assert.truthy(flagsSrc.includes('clearDevice'), 'there must be an escape hatch');
        assert.truthy(/UPDATE users SET device_id = NULL WHERE id = \?/.test(flagsSrc));
    });

    test('only an admin can, and the account survives it', () => {
        assert.truthy(/auth\.role !== 'admin'[\s\S]{0,60}403/.test(flagsSrc),
            'a child clearing their own device would reopen the limit entirely');
        assert.falsy(/DELETE FROM users/.test(flagsSrc), 'clearing a device must not delete the account');
    });

    test('clearing a device still works when no flag is being changed', () => {
        // The endpoint used to reject any body without allowBot. If that guard
        // survived, clearDevice on its own would 400.
        assert.falsy(/if \(typeof body\.allowBot === 'undefined'\) return err\('Nothing to change'\)/.test(flagsSrc),
            'the old allowBot-only guard would reject a clearDevice-only request');
        // Written as "none of the intents were requested" so adding another
        // action does not silently reintroduce the old allowBot-only guard.
        // Order-agnostic on purpose: what matters is that every intent is in
        // the conjunction, not which one an author happened to list second.
        assert.truthy(/if \(!wantsBot(?: && !\w+)+\) return err\('Nothing to change'\)/.test(flagsSrc),
            'the guard must require that NO action was asked for, not just one');
        for (const intent of ['wantsBot', 'wantsClear', 'wantsDisable'])
            assert.truthy(new RegExp('!' + intent + '\\b').test(flagsSrc), intent + ' must be part of the guard');
    });
});

suite('device limit: what the child is told', () => {
    test('the client sends the id when registering', () => {
        assert.truthy(/api\('register',[\s\S]{0,120}deviceId: deviceId\(\)/.test(authSrc));
    });

    test('a used-up device gets its own reason, not "update the app"', () => {
        assert.truthy(authSrc.includes("code === 'device_limit' ? 'device-limit'"),
            'the limit must be distinguishable from a generic rejection');
        assert.truthy(friendsSrc.includes("'device-limit':"), 'and it needs its own message');
    });

    test('that message carries no second copy of the number 2', () => {
        // The count is the server's to state. A hardcoded "2" here would be
        // wrong the day MAX_ACCOUNTS_PER_DEVICE changes.
        const msg = friendsSrc.slice(friendsSrc.indexOf("'device-limit':"), friendsSrc.indexOf('rejected:'));
        assert.falsy(/<b>2 tài khoản<\/b>/.test(msg), 'the client hardcoded the limit');
        assert.truthy(msg.includes('st.detail'), 'it must quote the server sentence');
        assert.truthy(msg.includes('frEsc('), 'and escape it — that string is rendered as HTML');
    });

    test('it offers no passcode box and no futile retry', () => {
        // Both were actively misleading: a passcode cannot create a third
        // account, and "Thử lại" just fails again.
        assert.falsy(/needsCode = [^;]*device-limit/.test(friendsSrc), 'a passcode cannot fix a full device');
        assert.truthy(friendsSrc.includes("const canRetry = reason !== 'device-limit'"));
        assert.truthy(/canRetry \?/.test(friendsSrc), 'the retry button must be conditional on that');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
