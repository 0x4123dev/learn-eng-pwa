const { suite, test, assert } = require('./harness');
// tests/gen-auth-client.test.js — CLIENT AUTH MODULE (js/auth.js): EngAuth account
// store round-trips through a Map-backed localStorage stub, /api plumbing,
// syncNow gating + batch building (30-day window, 400-item cap, syncedKeys
// dedup), postAttempt, 401 token-expiry handling, syncAccount register/login
// flow, and the syncNowUI toast/button wrapper. auth.js is vm-loaded standalone
// into a context with microtaskMode 'afterEvaluate', so every async EngAuth
// call settles synchronously inside this synchronous harness (the fetch stub
// lives INSIDE the vm so its promises drain with the context's microtask queue).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DAY = 24 * 60 * 60 * 1000;

// ── Sandbox globals ─────────────────────────────────────────────────────────
const storeMap = new Map(); // backing store for the localStorage stub
const toasts = [];          // showToast recorder
const timeouts = [];        // fake setTimeout recorder (never fires)
let currentBtn = null;      // what document.getElementById('syncBtn') returns

const sandbox = {
    localStorage: {
        getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
        setItem: (k, v) => { storeMap.set(k, String(v)); },
        removeItem: (k) => { storeMap.delete(k); },
        clear: () => { storeMap.clear(); },
    },
    document: { getElementById: (id) => (id === 'syncBtn' ? currentBtn : null) },
    showToast: (m) => { toasts.push(m); },
    setTimeout: (fn, ms) => { timeouts.push(ms); },
    console,
    currentUser: undefined,
    appState: null,
};
const ctx = vm.createContext(sandbox, { microtaskMode: 'afterEvaluate' });

// fetch stub defined inside the vm: records every call; behaviour is driven by
// the host-settable __fetchPlan(url, opts) → { ok, status, data, throw?, jsonThrow? }.
vm.runInContext(`
globalThis.__fetchCalls = [];
globalThis.__fetchPlan = null;
globalThis.fetch = function (url, opts) {
    __fetchCalls.push({ url: url, method: opts && opts.method, headers: opts && opts.headers, body: opts && opts.body });
    var plan = (__fetchPlan && __fetchPlan(url, opts)) || { ok: true, status: 200, data: {} };
    if (plan['throw']) return Promise.reject(new Error('network down'));
    return Promise.resolve({
        ok: plan.ok, status: plan.status,
        json: function () { return plan.jsonThrow ? Promise.reject(new Error('bad json')) : Promise.resolve(plan.data); },
    });
};
`, ctx, { filename: 'fetch-stub.js' });

const authSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');
vm.runInContext(
    authSrc + '\n;globalThis.EngAuth = EngAuth; globalThis.syncNowUI = syncNowUI;\n',
    ctx, { filename: 'auth.js' }
);
const EngAuth = sandbox.EngAuth;

// ── Helpers ─────────────────────────────────────────────────────────────────
// Evaluate an async expression in the vm; microtaskMode 'afterEvaluate' drains
// the queue when the evaluation returns, so the promise has settled by then.
function vmAwait(expr) {
    vm.runInContext(
        'globalThis.__done = false; globalThis.__result = undefined; globalThis.__err = undefined;' +
        'Promise.resolve((' + expr + ')).then(function (r) { __result = r; __done = true; },' +
        ' function (e) { __err = e || new Error("rejected"); __done = true; });',
        ctx, { filename: 'await-expr.js' });
    if (!sandbox.__done) throw new Error('async expression did not settle synchronously: ' + expr);
    if (sandbox.__err !== undefined) throw sandbox.__err;
    return sandbox.__result;
}

function reset(opts = {}) {
    storeMap.clear();
    toasts.length = 0;
    timeouts.length = 0;
    currentBtn = null;
    sandbox.__fetchCalls.length = 0;
    sandbox.__fetchPlan = opts.plan || null;
    sandbox.currentUser = ('user' in opts) ? opts.user : undefined;
    sandbox.appState = ('appState' in opts) ? opts.appState : null;
    sandbox.getGrammarUnit = opts.getGrammarUnit; // undefined → call throws → title falls back
}

function seedAccount(username, data) {
    let s = {};
    try { s = JSON.parse(storeMap.get('flashlingo_accounts') || '{}'); } catch (e) {}
    s[username] = data;
    storeMap.set('flashlingo_accounts', JSON.stringify(s));
}

function calls() { return sandbox.__fetchCalls; }
function sentItems(i = 0) { return JSON.parse(calls()[i].body).items; }

const NOW = Date.now();
const AT = {
    les: NOW - 1000, gram: NOW - 2000, phr: NOW - 3000,
    wf: NOW - 4000, rw: NOW - 5000, vb: NOW - 6000,
    old: NOW - 31 * DAY,
};

// One entry per history type within 30 days, plus one too-old lesson and one
// verbs entry with an invalid (NaN) date — both must be filtered out.
function richAppState() {
    return {
        lessonHistory: [
            { lessonNum: 2, accuracy: 80, date: AT.les },
            { lessonNum: 0, accuracy: 100, date: AT.old },
        ],
        grammarHistory: [{ unitId: 'u12', score: 7, total: 10, date: AT.gram }],
        phrasesHistory: [{ score: 4, total: 5, date: AT.phr }],
        wordformHistory: [{ score: 9, total: 10, date: AT.wf }],
        rewriteHistory: [{ score: 3, total: 5, date: AT.rw }],
        speedChallenge: { history: [
            { level: 'hard', correct: 12, total: 15, score: 999, date: AT.vb },
            { level: 'easy', correct: 1, total: 5, score: 5, date: NaN },
        ] },
    };
}

function seedRich(opts = {}) {
    reset(Object.assign({ user: 'Tester', appState: richAppState() }, opts));
    seedAccount('Tester', { token: 'tok123', role: 'user', id: 1, syncEpoch: 2 });
}

function makeBtn() {
    const classes = new Set();
    return {
        disabled: false, classes,
        classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    };
}

// ── Account store round-trip (localStorage stub) ───────────────────────────
suite('gen: auth account store', () => {
    test('getAccount and tokenFor for an unknown user are both null', () => {
        reset();
        assert.equal(EngAuth.getAccount('Nobody'), null);
        assert.equal(EngAuth.tokenFor('Nobody'), null, 'tokenFor short-circuits on the null account');
    });

    test('a seeded account round-trips through the localStorage stub (getAccount + tokenFor)', () => {
        reset();
        seedAccount('Tester', { token: 'tok123', role: 'admin', id: 5 });
        assert.deepEqual(EngAuth.getAccount('Tester'), { token: 'tok123', role: 'admin', id: 5 });
        assert.equal(EngAuth.tokenFor('Tester'), 'tok123');
    });

    test('tokenFor on an account WITHOUT a token returns undefined (not null)', () => {
        reset();
        seedAccount('NoTok', { role: 'user', id: 2 });
        assert.equal(EngAuth.tokenFor('NoTok'), undefined);
    });

    test('clearAccount removes only the named user and persists the change', () => {
        reset();
        seedAccount('A', { token: 'ta' });
        seedAccount('B', { token: 'tb' });
        EngAuth.clearAccount('A');
        assert.equal(EngAuth.getAccount('A'), null);
        assert.deepEqual(EngAuth.getAccount('B'), { token: 'tb' }, 'other accounts must survive');
    });

    test('clearAccount for an unknown user is a safe no-op', () => {
        reset();
        seedAccount('Tester', { token: 'tok123' });
        EngAuth.clearAccount('ZZZ');
        assert.deepEqual(EngAuth.getAccount('Tester'), { token: 'tok123' });
    });

    test('corrupted JSON under flashlingo_accounts reads as an empty store (no throw)', () => {
        reset();
        storeMap.set('flashlingo_accounts', '{not valid json');
        assert.equal(EngAuth.getAccount('Tester'), null);
        assert.equal(EngAuth.tokenFor('Tester'), null);
    });

    test('a write after a corrupted read repairs the store to valid JSON under the flashlingo_accounts key', () => {
        reset();
        storeMap.set('flashlingo_accounts', '{not valid json');
        EngAuth.clearAccount('anything');
        assert.equal(storeMap.get('flashlingo_accounts'), '{}');
    });
});

// ── api()/login() plumbing ──────────────────────────────────────────────────
suite('gen: auth api plumbing', () => {
    test('api(path) defaults: GET to /api/<path>, JSON Content-Type, no Authorization, no body', () => {
        reset();
        const res = vmAwait("EngAuth.api('ping')");
        assert.equal(calls().length, 1);
        const c = calls()[0];
        assert.equal(c.url, '/api/ping');
        assert.equal(c.method, 'GET');
        assert.deepEqual(c.headers, { 'Content-Type': 'application/json' });
        assert.equal(c.body, undefined);
        assert.deepEqual(res, { ok: true, status: 200, data: {} });
    });

    test('api with a token adds an Authorization: Bearer header', () => {
        reset();
        vmAwait("EngAuth.api('secure', { token: 'abc' })");
        assert.equal(calls()[0].headers['Authorization'], 'Bearer abc');
    });

    test('api with a body POSTs it JSON-stringified', () => {
        reset();
        vmAwait("EngAuth.api('thing', { method: 'POST', body: { a: 1, b: 'x' } })");
        assert.equal(calls()[0].method, 'POST');
        assert.equal(calls()[0].body, '{"a":1,"b":"x"}');
    });

    test('api swallows a json() parse failure: data null but ok/status kept', () => {
        reset({ plan: () => ({ ok: true, status: 200, jsonThrow: true }) });
        const res = vmAwait("EngAuth.api('weird')");
        assert.deepEqual(res, { ok: true, status: 200, data: null });
    });

    test('login(username, passcode) POSTs both to /api/login', () => {
        reset();
        vmAwait("EngAuth.login('Bob', '0000')");
        assert.equal(calls()[0].url, '/api/login');
        assert.deepEqual(JSON.parse(calls()[0].body), { username: 'Bob', passcode: '0000' });
    });
});

// ── syncNow gating ──────────────────────────────────────────────────────────
suite('gen: syncNow gating', () => {
    test('no currentUser → { ok:false, reason:no-account } and no fetch', () => {
        reset();
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: false, reason: 'no-account' });
        assert.equal(calls().length, 0);
    });

    test('currentUser set but no stored account → no-account', () => {
        reset({ user: 'Ghost' });
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: false, reason: 'no-account' });
        assert.equal(calls().length, 0);
    });

    test('stored account without a token → still no-account', () => {
        reset({ user: 'Tester' });
        seedAccount('Tester', { role: 'user', id: 1 }); // no token
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: false, reason: 'no-account' });
        assert.equal(calls().length, 0);
    });

    test('token but appState null → { ok:true, synced:0, total:0 } without fetching', () => {
        reset({ user: 'Tester', appState: null });
        seedAccount('Tester', { token: 'tok123' });
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: true, synced: 0, total: 0 });
        assert.equal(calls().length, 0);
    });

    test('token but every history array empty → synced 0, no fetch', () => {
        reset({ user: 'Tester', appState: {
            lessonHistory: [], grammarHistory: [], phrasesHistory: [],
            wordformHistory: [], rewriteHistory: [], speedChallenge: { history: [] },
        } });
        seedAccount('Tester', { token: 'tok123' });
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: true, synced: 0, total: 0 });
        assert.equal(calls().length, 0);
    });
});

// ── syncNow batch building ──────────────────────────────────────────────────
suite('gen: syncNow batch', () => {
    test('sends ONE POST /api/activity with the Bearer token and only the 6 fresh items (31-day-old + NaN-date excluded)', () => {
        seedRich();
        vmAwait('EngAuth.syncNow()');
        assert.equal(calls().length, 1);
        assert.equal(calls()[0].url, '/api/activity');
        assert.equal(calls()[0].method, 'POST');
        assert.equal(calls()[0].headers['Authorization'], 'Bearer tok123');
        assert.equal(sentItems().length, 6);
    });

    test('batch items are sorted newest-first by at', () => {
        seedRich();
        vmAwait('EngAuth.syncNow()');
        assert.deepEqual(sentItems().map(i => i.at), [AT.les, AT.gram, AT.phr, AT.wf, AT.rw, AT.vb]);
    });

    test('lesson item shape: title #lessonNum+1, accuracy 80% → score 4/5, detail.accuracy', () => {
        seedRich();
        vmAwait('EngAuth.syncNow()');
        assert.deepEqual(sentItems()[0], {
            type: 'lesson', title: 'Vocabulary lesson #3',
            score: 4, total: 5, at: AT.les, detail: { accuracy: 80 },
        });
    });

    test('grammar item falls back to the raw unitId in the title when getGrammarUnit is unavailable', () => {
        seedRich();
        vmAwait('EngAuth.syncNow()');
        assert.deepEqual(sentItems()[1], {
            type: 'grammar', title: 'Grammar: u12',
            score: 7, total: 10, at: AT.gram, detail: { unitId: 'u12' },
        });
    });

    test('grammar item uses the unit NAME when getGrammarUnit resolves it', () => {
        seedRich({ getGrammarUnit: (id) => ({ name: 'Tenses (' + id + ')' }) });
        vmAwait('EngAuth.syncNow()');
        assert.equal(sentItems()[1].title, 'Grammar: Tenses (u12)');
    });

    test('phrases item shape: total baked into the title, no detail', () => {
        seedRich();
        vmAwait('EngAuth.syncNow()');
        assert.deepEqual(sentItems()[2], { type: 'phrases', title: 'Phrases practice (5 Qs)', score: 4, total: 5, at: AT.phr });
    });

    test('wordform item shape', () => {
        seedRich();
        vmAwait('EngAuth.syncNow()');
        assert.deepEqual(sentItems()[3], { type: 'wordform', title: 'Word form practice (10 Qs)', score: 9, total: 10, at: AT.wf });
    });

    test('rewrite item shape', () => {
        seedRich();
        vmAwait('EngAuth.syncNow()');
        assert.deepEqual(sentItems()[4], { type: 'rewrite', title: 'Rewrite practice (5 Qs)', score: 3, total: 5, at: AT.rw });
    });

    test('verbs item: score = correct answers, points score demoted to detail.score', () => {
        seedRich();
        vmAwait('EngAuth.syncNow()');
        assert.deepEqual(sentItems()[5], {
            type: 'verbs', title: 'Verbs challenge (hard)',
            score: 12, total: 15, at: AT.vb, detail: { score: 999 },
        });
    });

    test('successful sync resolves { ok:true, synced:6, total:6 }', () => {
        seedRich();
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: true, synced: 6, total: 6 });
    });

    test('successful sync records type|at syncedKeys on the account (token preserved by the merge)', () => {
        seedRich();
        vmAwait('EngAuth.syncNow()');
        const acct = EngAuth.getAccount('Tester');
        assert.equal(acct.syncedKeys.length, 6);
        assert.contains(acct.syncedKeys, 'lesson|' + AT.les);
        assert.contains(acct.syncedKeys, 'verbs|' + AT.vb);
        assert.notContains(acct.syncedKeys, 'lesson|' + AT.old, 'the filtered-out old item must not be marked synced');
        assert.equal(acct.token, 'tok123', 'setAccount merges syncedKeys without dropping the token');
        assert.equal(acct.role, 'user');
    });

    test('an account behind the sync epoch resends its whole window once', () => {
        // Collocation and Math activities were uploaded, silently dropped by the
        // server, and marked synced — so they could never be recovered by a
        // retry. Raising the epoch forgets those marks exactly once.
        seedRich();
        seedAccount('Tester', {
            token: 'tok123', syncEpoch: 1,
            syncedKeys: ['lesson|' + AT.les, 'grammar|' + AT.gram, 'verbs|' + AT.vb],
        });
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: true, synced: 6, total: 6 },
            'every item in the window goes up again, not just the unmarked ones');
        const acct = EngAuth.getAccount('Tester');
        assert.equal(acct.syncEpoch, 2, 'the account is stamped with the epoch it caught up to');
        assert.equal(acct.syncedKeys.length, 6, 'the stale marks are gone, the fresh ones stand');

        // …and only once: the next sync is back to normal de-duplication.
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: true, synced: 0, total: 6 });
        assert.equal(calls().length, 1, 'no second upload');
    });

    test('a pre-existing syncedKey skips ONLY that item: 5 of 6 sent, total still 6', () => {
        seedRich();
        seedAccount('Tester', { token: 'tok123', syncEpoch: 2, syncedKeys: ['grammar|' + AT.gram] });
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: true, synced: 5, total: 6 });
        const types = sentItems().map(i => i.type);
        assert.notContains(types, 'grammar');
        assert.deepEqual(types, ['lesson', 'phrases', 'wordform', 'rewrite', 'verbs']);
        assert.equal(EngAuth.getAccount('Tester').syncedKeys.length, 6, 'old key kept + 5 new');
    });

    test('syncedKeys are capped at the LAST 2000: oldest keys are evicted, the 6 new ones kept', () => {
        seedRich();
        const filler = Array.from({ length: 2000 }, (_, i) => 'exam|' + i);
        seedAccount('Tester', { token: 'tok123', syncEpoch: 2, syncedKeys: filler });
        vmAwait('EngAuth.syncNow()');
        const keys = EngAuth.getAccount('Tester').syncedKeys;
        assert.equal(keys.length, 2000, '2000 old + 6 new sliced back to 2000');
        assert.notContains(keys, 'exam|0');
        assert.notContains(keys, 'exam|5');
        assert.contains(keys, 'exam|6', 'eviction stops exactly 6 keys in');
        assert.equal(keys[1999], 'verbs|' + AT.vb, 'new keys land at the tail');
    });

    test('second syncNow is a no-op: { synced:0, total:6 } and NO additional fetch', () => {
        seedRich();
        vmAwait('EngAuth.syncNow()');
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: true, synced: 0, total: 6 });
        assert.equal(calls().length, 1, 'everything already synced → no network call');
    });

    test('batch is capped at 400 newest items; the remaining 50 go in the next call', () => {
        const big = Array.from({ length: 450 }, (_, i) => ({ score: 1, total: 5, date: NOW - 1000 - i }));
        reset({ user: 'Tester', appState: { wordformHistory: big } });
        seedAccount('Tester', { token: 'tok123' });
        const r1 = vmAwait('EngAuth.syncNow()');
        assert.deepEqual(r1, { ok: true, synced: 400, total: 450 });
        assert.equal(sentItems(0).length, 400);
        assert.equal(sentItems(0)[0].at, NOW - 1000, 'newest first');
        const r2 = vmAwait('EngAuth.syncNow()');
        assert.deepEqual(r2, { ok: true, synced: 50, total: 450 });
        assert.equal(sentItems(1).length, 50);
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: true, synced: 0, total: 450 });
        assert.equal(calls().length, 2);
    });

    test('two items sharing type+at are BOTH sent the first time but collapse to one syncedKey', () => {
        const d = NOW - 1234;
        reset({ user: 'Tester', appState: { wordformHistory: [
            { score: 1, total: 5, date: d }, { score: 2, total: 5, date: d },
        ] } });
        seedAccount('Tester', { token: 'tok123' });
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: true, synced: 2, total: 2 });
        assert.equal(sentItems().length, 2);
        assert.deepEqual(EngAuth.getAccount('Tester').syncedKeys, ['wordform|' + d]);
    });
});

// ── postAttempt ─────────────────────────────────────────────────────────────
suite('gen: postAttempt', () => {
    test('without a token it no-ops: resolves undefined, zero fetch calls', () => {
        reset({ user: 'Tester' }); // no account seeded
        const r = vmAwait("EngAuth.postAttempt({ examId: 'exam1', score: 1, total: 40 })");
        assert.equal(r, undefined);
        assert.equal(calls().length, 0);
    });

    test('with a token but a null attempt it also no-ops', () => {
        reset({ user: 'Tester' });
        seedAccount('Tester', { token: 'tok123' });
        vmAwait('EngAuth.postAttempt(null)');
        assert.equal(calls().length, 0);
    });

    test('with token + attempt it POSTs the attempt to /api/attempts with the Bearer token', () => {
        reset({ user: 'Tester' });
        seedAccount('Tester', { token: 'tok123' });
        vmAwait("EngAuth.postAttempt({ examId: 'exam1', score: 35, total: 40 })");
        assert.equal(calls().length, 1);
        assert.equal(calls()[0].url, '/api/attempts');
        assert.equal(calls()[0].method, 'POST');
        assert.equal(calls()[0].headers['Authorization'], 'Bearer tok123');
        assert.deepEqual(JSON.parse(calls()[0].body), { examId: 'exam1', score: 35, total: 40 });
    });

    test('a 401 response clears the stored account (forces re-login next time)', () => {
        reset({ user: 'Tester', plan: () => ({ ok: false, status: 401, data: { error: 'unauthorized' } }) });
        seedAccount('Tester', { token: 'expired' });
        vmAwait("EngAuth.postAttempt({ examId: 'exam1', score: 0, total: 40 })");
        assert.equal(calls().length, 1, 'the attempt WAS posted before the 401 came back');
        assert.equal(EngAuth.getAccount('Tester'), null);
    });

    test('a network failure is swallowed and the account survives', () => {
        reset({ user: 'Tester', plan: () => ({ throw: true }) });
        seedAccount('Tester', { token: 'tok123' });
        vmAwait("EngAuth.postAttempt({ examId: 'exam1', score: 5, total: 40 })"); // must not throw
        assert.deepEqual(EngAuth.getAccount('Tester'), { token: 'tok123' });
    });
});

// ── syncNow error handling ──────────────────────────────────────────────────
suite('gen: syncNow errors', () => {
    test('401 → { ok:false, reason:auth }, account cleared, next call degrades to no-account', () => {
        seedRich({ plan: () => ({ ok: false, status: 401, data: {} }) });
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: false, reason: 'auth' });
        assert.equal(EngAuth.getAccount('Tester'), null);
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: false, reason: 'no-account' });
        assert.equal(calls().length, 1, 'the follow-up call must not hit the network');
    });

    test('server error (500) → reason server, account kept, nothing marked synced → retry resends all', () => {
        seedRich({ plan: () => ({ ok: false, status: 500, data: { error: 'boom' } }) });
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: false, reason: 'server' });
        assert.equal(EngAuth.getAccount('Tester').syncedKeys, undefined);
        sandbox.__fetchPlan = null; // server recovers
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: true, synced: 6, total: 6 });
        assert.equal(calls().length, 2);
    });

    test('network throw → { ok:false, reason:offline } and the account survives', () => {
        seedRich({ plan: () => ({ throw: true }) });
        assert.deepEqual(vmAwait('EngAuth.syncNow()'), { ok: false, reason: 'offline' });
        assert.equal(calls().length, 1, 'the POST was attempted before the network died');
        assert.equal(EngAuth.tokenFor('Tester'), 'tok123');
        assert.equal(EngAuth.getAccount('Tester').syncedKeys, undefined, 'nothing marked synced');
    });
});

// ── syncAccount (register/login flow) ───────────────────────────────────────
suite('gen: syncAccount', () => {
    test('missing username or passcode returns a reason with no fetch', () => {
        reset();
        // The reason is what lets the Friends tab explain itself instead of
        // telling a signed-in child to sign in.
        assert.equal(vmAwait("EngAuth.syncAccount('', '').then(r => r.reason)"), 'no-user');
        assert.equal(vmAwait("EngAuth.syncAccount('X', null).then(r => r.reason)"), 'no-passcode');
        assert.equal(calls().length, 0);
    });

    test('a wrong passcode for an existing server account reports bad-passcode', () => {
        reset({ user: 'Alice', appState: null, plan: (url) =>
            url === '/api/register' ? { ok: false, status: 409, data: { error: 'taken' } }
          : url === '/api/login' ? { ok: false, status: 401, data: { error: 'wrong' } } : null });
        assert.equal(vmAwait("EngAuth.syncAccount('Alice', '0000').then(r => r.reason)"), 'bad-passcode');
        assert.falsy(vmAwait("EngAuth.tokenFor('Alice')"), 'no token may be stored');
    });

    test('register success stores token/role/id for the user', () => {
        reset({ user: 'Alice', appState: null, plan: (url) =>
            url === '/api/register' ? { ok: true, status: 200, data: { token: 'newtok', user: { role: 'student', id: 42 } } } : null });
        vmAwait("EngAuth.syncAccount('Alice', '4321')");
        assert.deepEqual(calls().map(c => c.url), ['/api/register', '/api/coins'],
            'no history → register, then the coin-grant claim');
        assert.equal(calls()[0].url, '/api/register');
        const sent = JSON.parse(calls()[0].body);
        assert.equal(sent.username, 'Alice');
        assert.equal(sent.passcode, '4321');
        // Registration also carries the device id the per-device account cap
        // is counted from. If this ever stops being sent, register.js refuses
        // every signup outright — see tests/device-account-limit.test.js.
        assert.truthy(/^[A-Za-z0-9_-]{8,64}$/.test(sent.deviceId),
            `deviceId missing or malformed: ${JSON.stringify(sent.deviceId)}`);
        assert.deepEqual(Object.keys(sent).sort(), ['deviceId', 'passcode', 'username']);
        // syncNow runs straight after registering and stamps the account with
        // the sync epoch it has caught up to.
        assert.deepEqual(EngAuth.getAccount('Alice'),
            { token: 'newtok', role: 'student', id: 42, syncEpoch: 2, syncedKeys: [] });
    });

    test('register 409 (name taken) falls back to login and stores that token', () => {
        reset({ user: 'Alice', appState: null, plan: (url) => {
            if (url === '/api/register') return { ok: false, status: 409, data: { error: 'taken' } };
            if (url === '/api/login') return { ok: true, status: 200, data: { token: 'lt9', user: { role: 'user', id: 9 } } };
            return null;
        } });
        vmAwait("EngAuth.syncAccount('Alice', '4321')");
        assert.deepEqual(calls().map(c => c.url), ['/api/register', '/api/login', '/api/coins']);
        assert.equal(EngAuth.tokenFor('Alice'), 'lt9');
    });

    test('an existing token skips register/login entirely and goes straight to the activity sync', () => {
        reset({ user: 'Tester', appState: { wordformHistory: [{ score: 5, total: 5, date: NOW - 500 }] } });
        seedAccount('Tester', { token: 'tok123' });
        vmAwait("EngAuth.syncAccount('Tester', '9999')");
        assert.deepEqual(calls().map(c => c.url), ['/api/activity', '/api/coins']);
        assert.equal(EngAuth.tokenFor('Tester'), 'tok123', 'token untouched');
    });

    test('register failing with a non-409 stores nothing and the piggybacked syncNow stays offline-quiet', () => {
        reset({ user: 'Alice', appState: richAppState(), plan: (url) =>
            url === '/api/register' ? { ok: false, status: 500, data: { error: 'boom' } } : null });
        vmAwait("EngAuth.syncAccount('Alice', '4321')");
        assert.equal(EngAuth.getAccount('Alice'), null);
        assert.equal(calls().length, 1, 'no token → syncNow bails as no-account, no activity POST');
    });
});

// ── syncNowUI wrapper ───────────────────────────────────────────────────────
suite('gen: syncNowUI', () => {
    test('no account → login-first toast; button un-spun, re-enabled, no ok class', () => {
        reset();
        currentBtn = makeBtn();
        vmAwait('syncNowUI()');
        assert.deepEqual(toasts, ['Log in with a passcode first to sync']);
        assert.equal(currentBtn.disabled, false);
        assert.falsy(currentBtn.classes.has('syncing'));
        assert.falsy(currentBtn.classes.has('ok'));
        assert.equal(timeouts.length, 0);
    });

    test('successful sync of 6 items → "✅ Synced 6 activities" toast + ok class + 2s reset timer', () => {
        seedRich();
        currentBtn = makeBtn();
        vmAwait('syncNowUI()');
        assert.deepEqual(toasts, ['✅ Synced 6 activities']);
        assert.truthy(currentBtn.classes.has('ok'));
        assert.equal(currentBtn.disabled, false);
        assert.deepEqual(timeouts, [2000]);
    });

    test('nothing to sync → "✅ Already up to date" toast (still shows the ok state)', () => {
        reset({ user: 'Tester', appState: null });
        seedAccount('Tester', { token: 'tok123' });
        currentBtn = makeBtn();
        vmAwait('syncNowUI()');
        assert.deepEqual(toasts, ['✅ Already up to date']);
        assert.truthy(currentBtn.classes.has('ok'));
    });

    test('offline → warning toast, no ok class', () => {
        seedRich({ plan: () => ({ throw: true }) });
        currentBtn = makeBtn();
        vmAwait('syncNowUI()');
        assert.deepEqual(toasts, ['⚠️ Offline — try again later']);
        assert.falsy(currentBtn.classes.has('ok'));
    });

    test('expired session (401) → session-expired toast and the account is gone', () => {
        seedRich({ plan: () => ({ ok: false, status: 401, data: {} }) });
        currentBtn = makeBtn();
        vmAwait('syncNowUI()');
        assert.deepEqual(toasts, ['⚠️ Session expired — log in again']);
        assert.equal(EngAuth.getAccount('Tester'), null);
        assert.falsy(currentBtn.classes.has('ok'));
        assert.equal(currentBtn.disabled, false, 'button re-enabled even on failure');
    });

    test('server error (500) falls through to the generic "⚠️ Sync failed" toast', () => {
        seedRich({ plan: () => ({ ok: false, status: 500, data: { error: 'boom' } }) });
        currentBtn = makeBtn();
        vmAwait('syncNowUI()');
        assert.deepEqual(toasts, ['⚠️ Sync failed']);
        assert.falsy(currentBtn.classes.has('ok'));
        assert.falsy(currentBtn.classes.has('syncing'), 'spinner removed after the call');
    });

    test('a missing #syncBtn does not break the flow: toast still fires, no throw', () => {
        seedRich();
        currentBtn = null;
        vmAwait('syncNowUI()');
        assert.deepEqual(toasts, ['✅ Synced 6 activities']);
        assert.equal(timeouts.length, 0, 'no button → no 2s ok-class reset timer scheduled');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
