// wordform-typed-mix.test.js — every Word form practice contains real typing.
//
// Typed questions are the ones that teach: picking "education" from four
// options is recognition, producing it is recall. They were only 100 of the 600
// questions (300 since 2026-08-25), and the practice used to be a plain random draw — so a
// 10-question practice contained ZERO typing 23% of the time and averaged 1.35
// typed instead of a fair 1.67. A child could use the tab for a week and
// barely type.
//
// Two separate faults were behind that, and both are pinned here:
//
//   1. The draw was unstratified — the mix was left to chance.
//   2. wfShuffle took an LCG's LOW bits (`s % (i + 1)`), which barely vary.
//      One question was drawn into 12.5% of practices against a fair 1.67%,
//      another essentially never. Because all 100 typed questions sit
//      contiguously at the END of the bank, the bias landed squarely on them:
//      they came up 18.6% less often than they should have.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function makeEnv() {
    const els = {};
    const el = (id) => (els[id] || (els[id] = {
        id, style: {}, innerHTML: '', value: '', focus() {}, setAttribute() {}, getAttribute() {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    }));
    let now = 1;
    const ctx = {
        console, Math, String, Array, Object, JSON, Number, RegExp, Set, Map,
        // A different seed per practice, the way Date.now() gives in the app.
        Date: { now: () => (now = (now * 2654435761 + 12345) & 0x7fffffff) },
        module: { exports: {} }, appState: { coins: 0 }, currentUser: 'tester', saveUserData() {},
        document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => el('x'), addEventListener() {} },
        showToast() {}, createConfetti() {}, recordStudy() {},
    };
    vm.createContext(ctx);
    vm.runInContext(read('js/wordform-data.js'), ctx);
    // Loaded because the browser loads it: every drawn question drags an
    // understanding check behind it, so the quiz array is twice the practice
    // size. Leaving it out would measure a draw the app never performs.
    vm.runInContext(read('js/wordform-followups.js'), ctx);
    vm.runInContext(read('js/wordform.js')
        + '\nthis.start = startWordformQuiz; this.quiz = () => _wfQuiz;'
        + '\nthis.BANK = WORDFORM_QUESTIONS; this.target = wfTypedTarget; this.SHARE = WF_TYPED_SHARE;', ctx);
    return ctx;
}

const RUNS = 3000;
// The DRAW is what these tests are about, so the understanding checks the quiz
// interleaves are filtered back out; `rawSize` below covers the interleaving.
function sample(ctx, n) {
    const out = [];
    for (let i = 0; i < RUNS; i++) { ctx.start(n); out.push(ctx.quiz().questions.filter(q => !q.followup)); }
    return out;
}
const typedCount = (qs) => qs.filter(q => q.type === 'text').length;

suite('word form: the typed/mcq mix is built, not hoped for', () => {
    test('a 10-question practice is always 5 typed + 5 multiple-choice', () => {
        // Half, not a third: recognition was carrying too much of a practice.
        const ctx = makeEnv();
        const counts = sample(ctx, 10).map(typedCount);
        assert.equal(Math.min(...counts), 5, 'a practice came up with fewer than 5 typed');
        assert.equal(Math.max(...counts), 5, 'a practice came up with more than 5 typed');
    });

    test('a 20-question practice is always 10 typed + 10 multiple-choice', () => {
        const ctx = makeEnv();
        const counts = sample(ctx, 20).map(typedCount);
        assert.equal(Math.min(...counts), 10);
        assert.equal(Math.max(...counts), 10);
    });

    test('no practice can ever contain zero typing', () => {
        // The whole point. This was 23% of 10-question practices.
        const ctx = makeEnv();
        for (const n of [2, 5, 10, 20, 40]) {
            const zero = sample(ctx, n).filter(qs => typedCount(qs) === 0).length;
            assert.equal(zero, 0, `${zero} of ${RUNS} ${n}-question practices had no typing`);
        }
    });

    test('the ratio is one constant, so both sizes stay in step', () => {
        const ctx = makeEnv();
        assert.equal(ctx.SHARE, 0.5);
        assert.equal(ctx.target(10, 100), 5);
        assert.equal(ctx.target(20, 100), 10);
        assert.equal(ctx.target(40, 100), 20);
    });

    test('it never asks for more typed questions than the bank holds', () => {
        // A practice bigger than the typed pool must still be buildable.
        const ctx = makeEnv();
        assert.equal(ctx.target(20, 3), 3, 'capped at what exists');
        assert.equal(ctx.target(10, 0), 0, 'an empty typed pool must not wedge the draw');
        assert.equal(ctx.target(1, 100), 1, 'at a half share a lone question rounds up to typed');
        assert.equal(ctx.target(20, 7), 7, 'a thin typed pool caps the ask, it does not short the practice');
    });

    test('practices are still the right size, with no repeats', () => {
        const ctx = makeEnv();
        for (const n of [10, 20]) {
            for (const qs of sample(ctx, n)) {
                assert.equal(qs.length, n, 'wrong practice size');
                assert.equal(new Set(qs.map(q => q.id)).size, n, 'a question appeared twice');
            }
        }
    });

    test('each drawn question is followed by its own understanding check', () => {
        const ctx = makeEnv();
        ctx.start(10);
        const qs = ctx.quiz().questions;
        assert.equal(qs.length, 20, '10 questions + 10 checks');
        for (let i = 0; i < qs.length; i += 2) {
            assert.truthy(!qs[i].followup, `screen ${i + 1} should be a question`);
            assert.equal(qs[i + 1].baseId, qs[i].id, `screen ${i + 2} should check the question before it`);
        }
    });

    test('the typed ones are mixed through, not bunched at the end', () => {
        // They are drawn from a separate pool, so without a final shuffle they
        // would all arrive together — and a child would learn to expect them.
        const ctx = makeEnv();
        const pos = new Array(10).fill(0);
        for (const qs of sample(ctx, 10)) qs.forEach((q, k) => { if (q.type === 'text') pos[k]++; });
        // 5 typed across 10 slots: a fair position is typed 50% of the time.
        const share = pos.map(p => p / RUNS);
        for (let k = 0; k < 10; k++) {
            assert.truthy(share[k] > 0.35 && share[k] < 0.65,
                `position ${k + 1} holds ${(share[k] * 100).toFixed(1)}% of typed questions — they are clustering`);
        }
    });

    test('"all" keeps the whole bank, ratio untouched', () => {
        const ctx = makeEnv();
        ctx.start('all');
        assert.equal(ctx.quiz().questions.filter(q => !q.followup).length, ctx.BANK.length);
    });
});

suite('word form: the 5 typed come from the whole 300-question typed pool', () => {
    // 200 multiple-choice questions became typed on 2026-08-25 while keeping
    // their wf- ids, so the typed pool is no longer "the wft- block at the end
    // of the file". Anything that picked typed questions by id prefix, or by
    // position, would still hand a child five typed questions — drawn from 100
    // of them, with the 200 new ones never appearing. These tests read the pool
    // the same way the app does: by type.
    test('the bank really holds 300 typed questions, 200 of them converted', () => {
        const ctx = makeEnv();
        const typed = ctx.BANK.filter(q => q.type === 'text');
        assert.equal(typed.length, 300, 'the typed pool');
        assert.equal(typed.filter(q => q.id.startsWith('wft-')).length, 100, 'originally-typed questions');
        assert.equal(typed.filter(q => q.id.startsWith('wf-')).length, 200, 'converted questions');
        assert.equal(ctx.BANK.filter(q => q.type === 'mcq').length, 300, 'the multiple-choice half');
    });

    test('every one of the 5 typed in a practice is a real typed question', () => {
        const ctx = makeEnv();
        const pool = new Set(ctx.BANK.filter(q => q.type === 'text').map(q => q.id));
        for (const qs of sample(ctx, 10)) {
            const typed = qs.filter(q => q.type === 'text');
            assert.equal(typed.length, 5, 'a practice did not have 5 typed questions');
            for (const q of typed) {
                assert.truthy(pool.has(q.id), `${q.id} is not in the typed pool`);
                assert.falsy(q.options, `${q.id} still carries options — a child could tap instead of write`);
                assert.truthy(Array.isArray(q.accept) && q.accept.includes(q.answer),
                    `${q.id} has no accept list to grade typing against`);
            }
        }
    });

    test('the draw reaches all 300, not just the original 100', () => {
        // The failure this catches: 5 typed every time, all five forever drawn
        // from the same third of the pool.
        const ctx = makeEnv();
        const seen = new Set();
        for (let i = 0; i < 6000; i++) {
            ctx.start(10);
            for (const q of ctx.quiz().questions) if (!q.followup && q.type === 'text') seen.add(q.id);
        }
        const converted = [...seen].filter(id => id.startsWith('wf-')).length;
        const original = [...seen].filter(id => id.startsWith('wft-')).length;
        assert.equal(seen.size, 300, `only ${seen.size} of the 300 typed questions can ever be drawn`);
        assert.equal(converted, 200, `only ${converted} of the 200 converted questions are reachable`);
        assert.equal(original, 100, `only ${original} of the 100 original typed questions are reachable`);
    });

    test('converted and original typed questions come up about equally often', () => {
        // 200 of 300 are converted, so they should take about two thirds of the
        // typed slots. A big skew would mean the draw still favours one block.
        const ctx = makeEnv();
        let converted = 0, total = 0;
        for (const qs of sample(ctx, 10)) {
            for (const q of qs) {
                if (q.type !== 'text') continue;
                total++;
                if (q.id.startsWith('wf-')) converted++;
            }
        }
        const share = converted / total;
        assert.truthy(share > 0.58 && share < 0.75,
            `converted questions take ${(share * 100).toFixed(1)}% of typed slots, expected about 67%`);
    });

    test('a 20-question practice takes 10 typed from the same pool, none repeated', () => {
        const ctx = makeEnv();
        for (const qs of sample(ctx, 20)) {
            const typed = qs.filter(q => q.type === 'text');
            assert.equal(typed.length, 10);
            assert.equal(new Set(typed.map(q => q.id)).size, 10, 'the same typed question appeared twice');
        }
    });
});

suite('word form: the shuffle reaches every question', () => {
    test('no question is stranded', () => {
        // The old low-bit shuffle left one question drawn essentially never.
        const ctx = makeEnv();
        const seen = new Set(), seenTyped = new Set();
        for (let i = 0; i < 20000; i++) {
            ctx.start(10);
            for (const q of ctx.quiz().questions) {
                if (q.followup) continue;                  // checks are derived, not drawn
                seen.add(q.id);
                if (q.type === 'text') seenTyped.add(q.id);
            }
        }
        assert.equal(seen.size, ctx.BANK.length, 'some questions are unreachable');
        assert.equal(seenTyped.size, ctx.BANK.filter(q => q.type === 'text').length,
            'some typed questions are unreachable');
    });

    test('every shuffle uses the LCG high bits, in all three tabs', () => {
        // The same biased line was copy-pasted into three files.
        for (const f of ['js/wordform.js', 'js/phrases.js', 'js/rewrite.js']) {
            const src = read(f);
            assert.falsy(/const j = s % \(i \+ 1\);/.test(src),
                `${f} still takes the LCG's low bits — one question gets drawn 7x too often`);
            assert.truthy(/const j = Math\.floor\(\(s \/ 0x80000000\) \* \(i \+ 1\)\);/.test(src),
                `${f} is missing the high-bit fix`);
        }
    });

    test('the shuffle is uniform enough to be fair', () => {
        // Measured directly: every position should be roughly equally likely.
        const ctx = makeEnv();
        const src = read('js/wordform.js');
        const sandbox = { Math, Array };
        vm.createContext(sandbox);
        vm.runInContext(src.slice(src.indexOf('function wfShuffle'), src.indexOf('function wordformBank'))
            + '\nthis.sh = wfShuffle;', sandbox);
        const SIZE = 600, TOP = 10, N = 20000, fair = TOP / SIZE;
        const hits = new Array(SIZE).fill(0);
        const base = Array.from({ length: SIZE }, (_, i) => i);
        for (let s = 1; s <= N; s++) {
            const a = sandbox.sh(base, s);
            for (let k = 0; k < TOP; k++) hits[a[k]]++;
        }
        const rate = hits.map(h => h / N);
        const lo = Math.min(...rate), hi = Math.max(...rate);
        assert.truthy(lo > fair * 0.5, `some question is drawn only ${(lo * 100).toFixed(2)}% of the time (fair ${(fair * 100).toFixed(2)}%)`);
        assert.truthy(hi < fair * 2, `some question is drawn ${(hi * 100).toFixed(2)}% of the time (fair ${(fair * 100).toFixed(2)}%)`);
    });
});


// ---- collocation: the same rule, a lighter ratio ----
// Collocation is 40% typed by nature (letter/open/transform = 200 of 500), so
// this ratio REDUCES typing rather than raising it: 1 in 10 instead of ~4.
// That is deliberate — those questions are the slowest to answer.
//
// Phrases deliberately has no equivalent: all 913 of its questions are
// four-option, base and meaning alike, so there is nothing to stratify.
function colEnv() {
    const els = {};
    const el = (id) => (els[id] || (els[id] = {
        id, style: {}, innerHTML: '', value: '', focus() {}, setAttribute() {}, getAttribute() {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    }));
    const ctx = {
        console, Math, Date, String, Array, Object, JSON, Number, RegExp, Set, Map,
        module: { exports: {} }, appState: { coins: 0 }, currentUser: 'tester', saveUserData() {},
        document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => el('x'), addEventListener() {} },
        showToast() {}, createConfetti() {}, recordStudy() {},
    };
    vm.createContext(ctx);
    vm.runInContext(read('js/collocation-data.js'), ctx);
    vm.runInContext(read('js/collocation.js')
        + '\nthis.start = startCollocPractice; this.quiz = () => _colQuiz;'
        + '\nthis.isTyped = colIsTyped; this.target = colTypedTarget; this.SHARE = COL_TYPED_SHARE;'
        + '\nthis.BANK = COLLOCATION_QUESTIONS;', ctx);
    return ctx;
}

suite('collocation: 1 typed in 10, 2 in 20', () => {
    test('a 10-question practice always has exactly 1 typed', () => {
        const ctx = colEnv();
        for (let i = 0; i < 2000; i++) {
            ctx.start(10);
            assert.equal(ctx.quiz().questions.filter(ctx.isTyped).length, 1);
        }
    });

    test('a 20-question practice always has exactly 2 typed', () => {
        const ctx = colEnv();
        for (let i = 0; i < 2000; i++) {
            ctx.start(20);
            assert.equal(ctx.quiz().questions.filter(ctx.isTyped).length, 2);
        }
    });

    test('typed means "no options to choose from"', () => {
        // letter / open / transform are typed; pair / mcq are chosen.
        const ctx = colEnv();
        const typed = ctx.BANK.filter(ctx.isTyped).map(q => q.type);
        const choice = ctx.BANK.filter(q => !ctx.isTyped(q)).map(q => q.type);
        assert.deepEqual([...new Set(typed)].sort(), ['letter', 'open', 'transform']);
        assert.deepEqual([...new Set(choice)].sort(), ['mcq', 'pair']);
    });

    test('the ratio is one constant, and both sizes follow it', () => {
        const ctx = colEnv();
        assert.equal(ctx.SHARE, 0.1);
        assert.equal(ctx.target(10, 200), 1);
        assert.equal(ctx.target(20, 200), 2);
        assert.equal(ctx.target(40, 200), 4);
    });

    test('an empty typed pool does not produce a short practice', () => {
        // The bug this guards: the "at least one" floor ignoring availability,
        // so the slice returned nothing and the practice lost a question.
        const ctx = colEnv();
        assert.equal(ctx.target(10, 0), 0);
        assert.equal(ctx.target(10, 1), 1);
        assert.equal(ctx.target(1, 200), 0);
    });

    test('practices keep their size, with no repeats', () => {
        const ctx = colEnv();
        for (const n of [10, 20]) {
            for (let i = 0; i < 500; i++) {
                ctx.start(n);
                const qs = ctx.quiz().questions;
                assert.equal(qs.length, n);
                assert.equal(new Set(qs.map(q => q.id)).size, n);
            }
        }
    });

    test('the typed one is not always in the same place', () => {
        const ctx = colEnv();
        const pos = new Array(10).fill(0);
        const N = 3000;
        for (let i = 0; i < N; i++) {
            ctx.start(10);
            ctx.quiz().questions.forEach((q, k) => { if (ctx.isTyped(q)) pos[k]++; });
        }
        for (let k = 0; k < 10; k++) {
            assert.truthy(pos[k] / N > 0.04 && pos[k] / N < 0.18,
                `position ${k + 1} holds ${(pos[k] / N * 100).toFixed(1)}% of the typed questions`);
        }
    });
});

// ---- phrases: typed variants, derived not authored ----
// The bank is 913 four-option questions. Rather than write 913 more records, a
// typed variant is DERIVED from each one — the same sentence with the answer
// produced instead of chosen — exactly as the meaning follow-ups already are.
// The bank stays the single source of the sentence, translation and
// explanation, so a data fix reaches the typed form too.
function phrEnv() {
    const els = {};
    const el = (id) => (els[id] || (els[id] = { id, style: {}, innerHTML: '', value: '', focus() {} }));
    const ctx = {
        console, Math, Date, String, Array, Object, JSON, Number, RegExp, Set, Map,
        module: { exports: {} }, appState: { coins: 0 }, currentUser: 'tester', saveUserData() {},
        document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [] },
        showToast() {}, createConfetti() {}, recordStudy() {},
    };
    vm.createContext(ctx);
    for (const f of ['js/phrases-data.js', 'js/phrases-meanings.js']) {
        try { vm.runInContext(read(f), ctx); } catch (e) {}
    }
    vm.runInContext(read('js/phrases.js')
        + '\nthis.start = startPhrasesQuiz; this.quiz = () => _phrQuiz;'
        + '\nthis.typedQ = phrTypedQuestion; this.isCorrect = phrIsCorrect; this.byId = phrasesById;'
        + '\nthis.target = phrTypedTarget; this.SHARE = PHR_TYPED_SHARE; this.BANK = PREPOSITION_QUESTIONS;', ctx);
    return ctx;
}

suite('phrases: 1 typed in 10, 2 in 20', () => {
    test('a 10-question practice always has exactly 1 typed', () => {
        const ctx = phrEnv();
        for (let i = 0; i < 800; i++) {
            ctx.start(10);
            assert.equal(ctx.quiz().questions.filter(q => q.typed).length, 1);
        }
    });

    test('a 20-question practice always has exactly 2 typed', () => {
        const ctx = phrEnv();
        for (let i = 0; i < 800; i++) {
            ctx.start(20);
            assert.equal(ctx.quiz().questions.filter(q => q.typed).length, 2);
        }
    });

    test('a typed variant does NOT cost the practice its meaning follow-up', () => {
        // The bug this pins: meanings are filed under the BASE id, and a typed
        // variant's own id is 'pt-<baseId>'. Looking one up by that silently
        // returned nothing, and a 10-question practice rendered 19 screens
        // instead of 20 — one question quietly missing.
        const ctx = phrEnv();
        for (let i = 0; i < 400; i++) {
            ctx.start(10);
            assert.equal(ctx.quiz().questions.length, 20, 'a typed pick lost its meaning question');
        }
        ctx.start(20);
        assert.equal(ctx.quiz().questions.length, 40);
    });

    test('the variant carries the base id it was derived from', () => {
        const ctx = phrEnv();
        const base = ctx.BANK[0];
        const t = ctx.typedQ(base);
        assert.equal(t.id, 'pt-' + base.id);
        assert.equal(t.baseId, base.id, 'without baseId the meaning lookup fails');
        assert.truthy(ctx.byId(t.id), 'the id must resolve back to a question');
    });

    test('every one of the 913 variants is well formed and gradeable', () => {
        const ctx = phrEnv();
        const bad = [];
        for (const b of ctx.BANK) {
            const t = ctx.typedQ(b);
            if (!t) { bad.push(b.id + ':none'); continue; }
            if (!ctx.isCorrect(t.answer, t)) bad.push(b.id + ':own answer rejected');
            if (ctx.isCorrect('zzz', t)) bad.push(b.id + ':junk accepted');
            if (String(t.q).indexOf('___') < 0) bad.push(b.id + ':no blank');
            if (t.options) bad.push(b.id + ':still has options');
        }
        assert.deepEqual(bad.slice(0, 5), [], `${bad.length} malformed variants`);
    });

    test('grading is lenient about case and spacing, strict about the word', () => {
        const ctx = phrEnv();
        const t = ctx.typedQ(ctx.BANK[0]);
        assert.truthy(ctx.isCorrect(t.answer, t));
        assert.truthy(ctx.isCorrect(t.answer.toUpperCase(), t));
        assert.truthy(ctx.isCorrect('  ' + t.answer + ' ', t));
        assert.falsy(ctx.isCorrect('zzz', t));
        assert.falsy(ctx.isCorrect('', t));
    });

    test('an answer stored for one kind cannot score the other', () => {
        // Typed answers are strings, multiple-choice answers are indexes. A
        // bare `answers[i] === q.correct` marked every typed question wrong,
        // because a typed question has no `correct` index at all.
        const ctx = phrEnv();
        const base = ctx.BANK[0];
        const t = ctx.typedQ(base);
        assert.falsy(ctx.isCorrect(base.correct, t), 'an index must not pass a typed question');
        assert.falsy(ctx.isCorrect(t.answer, base), 'a string must not pass a multiple-choice one');
        assert.truthy(ctx.isCorrect(base.correct, base), 'multiple-choice scoring still works');
    });

    test('the ratio is one constant, and the floor respects availability', () => {
        const ctx = phrEnv();
        assert.equal(ctx.SHARE, 0.1);
        assert.equal(ctx.target(10, 913), 1);
        assert.equal(ctx.target(20, 913), 2);
        assert.equal(ctx.target(10, 0), 0, 'an empty pool must not produce a short practice');
        assert.equal(ctx.target(1, 913), 0);
    });

    test('the typed one is not always in the same place', () => {
        const ctx = phrEnv();
        const seen = new Set();
        for (let i = 0; i < 300; i++) {
            ctx.start(10);
            ctx.quiz().questions.forEach((q, k) => { if (q.typed) seen.add(k); });
        }
        assert.truthy(seen.size >= 4, `the typed question only ever appears at ${seen.size} position(s)`);
    });
});

suite('rewrite: one practice size', () => {
    test('only the 10-question practice is offered', () => {
        // Every Rewrite question is typed, so a 5-question round was over
        // almost before it began.
        const src = read('js/rewrite.js');
        const sizes = [...src.matchAll(/startRewriteQuiz\((\d+)\)/g)].map(m => Number(m[1]));
        assert.deepEqual(sizes, [10], `rewrite offers ${sizes.join(', ')} — expected only 10`);
    });

    test('its questions are all typed, so no ratio applies', () => {
        const ctx = { console, Math, Date, String, Array, Object, JSON, Number, RegExp };
        vm.createContext(ctx);
        vm.runInContext(read('js/rewrite-data.js'), ctx);
        vm.runInContext('this.R = REWRITE_QUESTIONS;', ctx);
        const choice = ctx.R.filter(q => Array.isArray(q.options) && q.options.length);
        assert.equal(choice.length, 0, 'rewrite gained multiple-choice questions — revisit this');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
