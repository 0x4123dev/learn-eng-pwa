// wrong-priority.test.js — what you got wrong comes back until you have got
// it right five times in a row, silently, in every quiz tab.
//
// The engine (js/wrong-priority.js) is tested here on its own with toy pools.
// tests/wrong-priority-tabs.test.js checks that each real tab plugs into it.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const engineSrc = read('js/wrong-priority.js');

// A sandbox with ONLY the engine. `state` undefined → no appState at all
// (logged out, or a tab loaded on its own in a test).
function engineEnv(state) {
    const ctx = {
        console, Math, Date, String, Array, Object, JSON, Number, Set,
        module: { exports: {} }, currentUser: 'tester', saves: 0,
        saveUserData() { ctx.saves++; },
    };
    if (state !== undefined) ctx.appState = state;
    vm.createContext(ctx);
    vm.runInContext(engineSrc, ctx);
    return ctx;
}

// Deterministic rand, so a draw can be compared with a hand-rolled one.
function lcg(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x80000000; };
}
function fisherYates(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
const pool = (n) => Array.from({ length: n }, (_, i) => ({ id: 'q' + i }));
const ids = (items) => items.map(i => i.id);
const entry = (s, w, t) => ({ s, w, t: t || 0 });

suite('wrong priority: bookkeeping', () => {
    test('the first miss starts tracking; a second miss counts it', () => {
        const ctx = engineEnv({});
        ctx.prioRecord('wf', [], ['q1'], 100);
        assert.deepEqual(ctx.appState.wrongPrio.wf.q1, { s: 0, w: 1, t: 100 });
        ctx.prioRecord('wf', [], ['q1'], 200);
        assert.deepEqual(ctx.appState.wrongPrio.wf.q1, { s: 0, w: 2, t: 200 });
    });

    test('a right answer moves the streak up; the fifth in a row releases the item', () => {
        const ctx = engineEnv({ wrongPrio: { wf: { q1: entry(0, 1) } } });
        for (let k = 1; k <= 4; k++) {
            ctx.prioRecord('wf', ['q1'], [], k);
            assert.equal(ctx.prioStreak('wf', 'q1'), k, 'streak after ' + k + ' right answers');
        }
        ctx.prioRecord('wf', ['q1'], [], 5);
        assert.equal(ctx.prioStreak('wf', 'q1'), null, 'released: no entry at all, plain random again');
        assert.falsy(ctx.appState.wrongPrio.wf.q1);
    });

    test('a miss in the middle resets the streak to zero', () => {
        const ctx = engineEnv({ wrongPrio: { wf: { q1: entry(4, 1) } } });
        ctx.prioRecord('wf', [], ['q1'], 9);
        assert.deepEqual(ctx.appState.wrongPrio.wf.q1, { s: 0, w: 2, t: 9 });
    });

    test('a right answer on something never missed is not tracked', () => {
        const ctx = engineEnv({});
        ctx.prioRecord('wf', ['q1', 'q2'], [], 1);
        assert.deepEqual(ctx.appState.wrongPrio.wf, {});
    });

    test('reported both right and wrong, wrong wins', () => {
        const ctx = engineEnv({ wrongPrio: { wf: { q1: entry(3, 1) } } });
        ctx.prioRecord('wf', ['q1'], ['q1'], 1);
        assert.equal(ctx.prioStreak('wf', 'q1'), 0);
    });

    test('tabs never share a slot', () => {
        const ctx = engineEnv({});
        ctx.prioRecord('wf', [], ['q1'], 1);
        ctx.prioRecord('phr', [], ['q1'], 1);
        ctx.prioRecord('phr', ['q1'], [], 2);
        assert.equal(ctx.prioStreak('wf', 'q1'), 0);
        assert.equal(ctx.prioStreak('phr', 'q1'), 1);
    });

    test('it is saved as it happens, not at the next save', () => {
        const ctx = engineEnv({});
        ctx.prioRecord('wf', [], ['q1'], 1);
        assert.truthy(ctx.saves > 0, 'a reload right after a practice must not lose a streak');
    });

    test('no profile: nothing recorded, nothing thrown', () => {
        const ctx = engineEnv();
        ctx.prioRecord('wf', ['q1'], ['q2'], 1);
        assert.equal(ctx.prioStreak('wf', 'q2'), null);
        assert.equal(ctx.saves, 0);
    });

    test('junk in storage is replaced, never trusted', () => {
        for (const junk of [null, 'nope', 42, [], { wf: [] }, { wf: 'nope' }]) {
            const ctx = engineEnv({ wrongPrio: junk });
            ctx.prioRecord('wf', [], ['q1'], 1);
            assert.equal(ctx.prioStreak('wf', 'q1'), 0, 'threw or miscounted for ' + JSON.stringify(junk));
        }
    });

    test('a junk entry value is replaced on the next miss, not wedged forever', () => {
        // A stray primitive where an { s, w, t } object belongs: `e.s = ...`
        // on it would be a silent no-op, so it could never reach 5 and never
        // graduate. It must be treated as never-tracked, same as no entry.
        const ctx = engineEnv({ wrongPrio: { wf: { q1: 42 } } });
        ctx.prioRecord('wf', [], ['q1'], 5);
        assert.deepEqual(ctx.appState.wrongPrio.wf.q1, { s: 0, w: 1, t: 5 });
    });

    test('an inherited key can never look like a tracked entry', () => {
        const ctx = engineEnv({ wrongPrio: { wf: {} } });
        assert.equal(ctx.prioStreak('wf', 'constructor'), null);
        assert.equal(ctx.prioStreak('wf', 'toString'), null);
    });

    test('the missed count does not wrap at 32 bits', () => {
        const ctx = engineEnv({ wrongPrio: { wf: { q1: entry(0, 2147483647) } } });
        ctx.prioRecord('wf', [], ['q1'], 1);
        assert.equal(ctx.appState.wrongPrio.wf.q1.w, 2147483648, '`| 0` would have wrapped this negative');
    });
});

suite('wrong priority: the forced part of a draw', () => {
    test('at most half the practice, and only what is tracked', () => {
        const ctx = engineEnv({ wrongPrio: { wf: { q1: entry(0, 1), q2: entry(0, 1), q3: entry(0, 1) } } });
        const forced = ctx.prioForced('wf', pool(50), 10);
        assert.deepEqual(ids(forced).sort(), ['q1', 'q2', 'q3']);
    });

    test('more tracked than the cap: exactly floor(n/2)', () => {
        const store = {};
        for (let i = 0; i < 8; i++) store['q' + i] = entry(0, 1);
        const ctx = engineEnv({ wrongPrio: { wf: store } });
        assert.equal(ctx.prioForced('wf', pool(50), 10).length, 5);
        assert.equal(ctx.prioForced('wf', pool(50), 25).length, 8, 'never more than are tracked');
        assert.equal(ctx.prioForced('wf', pool(50), 3).length, 1);
        assert.equal(ctx.prioForced('wf', pool(50), 1).length, 0, 'a one-question practice forces nothing');
    });

    test('the cap follows the pool when the pool is smaller than n', () => {
        const ctx = engineEnv({ wrongPrio: { wf: { q0: entry(0, 1), q1: entry(0, 1), q2: entry(0, 1) } } });
        assert.equal(ctx.prioForced('wf', pool(4), 10).length, 2, 'floor(4/2)');
    });

    test('tracked items outside the pool are ignored', () => {
        // A word missed in HK1 must not leak into an HK2 practice.
        const ctx = engineEnv({ wrongPrio: { wf: { elsewhere: entry(0, 9) } } });
        assert.deepEqual(ctx.prioForced('wf', pool(10), 10), []);
    });

    test('least progress first, then most missed, then longest unseen', () => {
        const ctx = engineEnv({ wrongPrio: { wf: {
            q1: entry(2, 5, 10),   // furthest along
            q2: entry(0, 1, 50),   // no progress, missed once, seen recently
            q3: entry(0, 1, 20),   // no progress, missed once, seen longer ago
            q4: entry(0, 3, 90),   // no progress, missed most
        } } });
        const forced = ctx.prioForced('wf', pool(10), 6);   // cap 3 of 4 tracked
        assert.deepEqual(ids(forced), ['q4', 'q3', 'q2']);
    });

    test('a tab can say how an item is identified', () => {
        const ctx = engineEnv({ wrongPrio: { verbs: { go: entry(0, 1) } } });
        const verbs = [{ v1: 'be' }, { v1: 'go' }, { v1: 'see' }, { v1: 'eat' }];
        const forced = ctx.prioForced('verbs', verbs, 4, { idOf: v => v.v1 });
        assert.deepEqual(forced.map(v => v.v1), ['go']);
        assert.deepEqual(ctx.prioForced('verbs', verbs, 4), [], 'without idOf these items have no id');
    });

    test('no profile: nothing is forced', () => {
        assert.deepEqual(engineEnv().prioForced('wf', pool(10), 10), []);
    });

    test('a junk entry is never forced', () => {
        const ctx = engineEnv({ wrongPrio: { wf: { q1: 42 } } });
        assert.deepEqual(ctx.prioForced('wf', pool(10), 10), []);
    });

    test('an inherited key can never look like a forced entry', () => {
        const ctx = engineEnv({ wrongPrio: { wf: {} } });
        assert.deepEqual(ctx.prioForced('wf', [{ id: 'constructor' }], 10), []);
    });
});

suite('wrong priority: the whole draw', () => {
    test('every forced item is in it, filled to n, no duplicates', () => {
        const ctx = engineEnv({ wrongPrio: { wf: { q1: entry(0, 1), q2: entry(0, 1), q3: entry(0, 1) } } });
        const drawn = ctx.prioPick('wf', pool(50), 10, { rand: lcg(3) });
        assert.equal(drawn.length, 10);
        assert.equal(new Set(ids(drawn)).size, 10, 'no question twice');
        for (const id of ['q1', 'q2', 'q3']) assert.contains(ids(drawn), id);
    });

    test('a pool smaller than n is returned whole', () => {
        const ctx = engineEnv({ wrongPrio: { wf: { q1: entry(0, 1) } } });
        assert.equal(ctx.prioPick('wf', pool(4), 10).length, 4);
        assert.deepEqual(ctx.prioPick('wf', pool(4), 0), []);
        assert.deepEqual(ctx.prioPick('wf', [], 10), []);
    });

    test('forced items are shuffled in, not lined up at the front', () => {
        // Position must give nothing away — the child is not told.
        const store = {};
        for (let i = 0; i < 5; i++) store['q' + i] = entry(0, 1);
        const ctx = engineEnv({ wrongPrio: { wf: store } });
        let atFrontEveryTime = true;
        for (let seed = 1; seed <= 20 && atFrontEveryTime; seed++) {
            const drawn = ctx.prioPick('wf', pool(50), 10, { rand: lcg(seed) });
            atFrontEveryTime = ids(drawn.slice(0, 5)).every(id => store[id]);
        }
        assert.falsy(atFrontEveryTime, 'the forced items sat at the front in 20 of 20 draws');
    });

    test('with nothing tracked it is exactly shuffle-and-take-n', () => {
        for (const state of [undefined, {}, { wrongPrio: { wf: {} } }, { wrongPrio: { phr: { q1: entry(0, 1) } } }]) {
            const ctx = engineEnv(state);
            const drawn = ctx.prioPick('wf', pool(30), 10, { rand: lcg(7) });
            assert.deepEqual(ids(drawn), ids(fisherYates(pool(30), lcg(7)).slice(0, 10)),
                'differs from a plain draw for state ' + JSON.stringify(state));
        }
    });

    test('the pool passed in is not mutated', () => {
        const ctx = engineEnv({ wrongPrio: { wf: { q1: entry(0, 1) } } });
        const p = pool(20);
        const before = ids(p).join();
        ctx.prioPick('wf', p, 10);
        assert.equal(ids(p).join(), before);
    });

    test('a pool with duplicate ids never yields the same id twice', () => {
        // Two DIFFERENT objects that resolve to the same id — the forced copy
        // must not leave its sibling free to be drawn again by chance, and two
        // untracked duplicates must not both survive into the random fill.
        const ctx = engineEnv({ wrongPrio: { wf: { q1: entry(0, 1) } } });
        const p = [{ id: 'q1' }, { id: 'q2' }, { id: 'q1' }, { id: 'q3' }, { id: 'q4' }, { id: 'q3' }];
        for (let seed = 1; seed <= 20; seed++) {
            const drawn = ctx.prioPick('wf', p, 4, { rand: lcg(seed) });
            assert.equal(drawn.length, 4);
            assert.equal(new Set(ids(drawn)).size, 4,
                'duplicate-id pool yielded a repeat for seed ' + seed + ': ' + ids(drawn).join(','));
        }
    });
});

suite('wrong priority: prioStore', () => {
    test('a read never creates the container', () => {
        const ctx = engineEnv({});
        assert.equal(ctx.prioStore('wf'), null);
        assert.deepEqual(ctx.appState, {}, 'reading must not create appState.wrongPrio');
    });

    test('a read with no profile at all does not throw', () => {
        assert.equal(engineEnv().prioStore('wf'), null);
    });

    test('junk in the container is left alone by a read, replaced only when something is written', () => {
        const ctx = engineEnv({ wrongPrio: { wf: 'nope' } });
        assert.equal(ctx.prioStore('wf'), null, 'junk is not trusted on a read');
        assert.equal(ctx.appState.wrongPrio.wf, 'nope', 'a read must not repair it either');
        ctx.prioRecord('wf', [], ['q1'], 1);
        assert.deepEqual(ctx.appState.wrongPrio.wf, { q1: { s: 0, w: 1, t: 1 } });
    });

    test('an existing well-formed slot is returned as-is', () => {
        const ctx = engineEnv({ wrongPrio: { wf: { q1: entry(0, 1) } } });
        assert.equal(ctx.prioStore('wf'), ctx.appState.wrongPrio.wf);
    });
});

suite('wrong priority: shipped with the app', () => {
    test('index.html loads the engine before every tab that draws through it', () => {
        const html = read('index.html');
        const at = html.indexOf('js/wrong-priority.js');
        assert.truthy(at > 0, 'wrong-priority.js is not loaded at all');
        for (const f of ['units.js', 'wordform.js', 'phrases.js', 'collocation.js', 'rewrite.js', 'verbs.js', 'grammar-ui.js']) {
            assert.truthy(html.indexOf('js/' + f) > at, 'js/' + f + ' loads before the engine it draws through');
        }
    });

    test('the service worker precaches it, so it is there offline like every tab', () => {
        assert.truthy(read('sw.js').includes("'/js/wrong-priority.js'"));
    });

    test('the engine renders nothing: it is a background rule', () => {
        assert.falsy(/innerHTML|document\.|<div|<button|showToast/.test(engineSrc));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
