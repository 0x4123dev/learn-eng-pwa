// retry-drill.test.js — you owe back everything you got wrong, in every tab.
//
// A child who misses a question, scores 8/10 and moves straight on collects a
// long tail of things they never learned. So in all six quiz tabs — Grade 4
// units, Word form, Phrases, Collocation, Rewrite and Verbs — each missed item
// is owed back and no new practice opens until the debt is cleared.
//
// The rule lives ONCE, in js/retrydrill.js. It was about to be written six
// times, and six copies means six places to fix the next bug in it. This file
// therefore tests the engine hard, and then checks only that each tab plugs
// into it correctly.
//
// Two things make a hard gate fair, and both are engine behaviour:
//   1. The debt PERSISTS, so closing the app is not a way out — which is only
//      acceptable because…
//   2. …the 👁 button always offers the answer while held. Without it a
//      persisted gate could trap a child on one item forever.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const engineSrc = read('js/retrydrill.js');
const cssSrc = read('css/styles.css');

const TAB_FILES = ['units.js', 'wordform.js', 'phrases.js', 'collocation.js', 'rewrite.js', 'verbs.js'];
const DATA_FILES = ['units-data.js', 'units-hk1-data.js', 'units-hk2-data.js', 'phrases-data.js', 'collocation-data.js',
    'rewrite-data.js', 'wordform-data.js', 'vocabulary.js', 'topic-vocab.js'];

// Load the real engine, the real tab configs and the real question banks in one
// sandbox — the same order index.html loads them.
function makeEnv() {
    const els = {};
    const el = (id) => (els[id] || (els[id] = {
        id, style: {}, innerHTML: '', value: '', className: '', attrs: {},
        focus() {}, addEventListener() {}, removeEventListener() {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
        querySelector: () => null, querySelectorAll: () => [],
    }));
    const saves = [];
    const ctx = {
        console, Math, Date, String, Array, Object, JSON, Number, RegExp, Set, Map,
        setTimeout, clearTimeout, setInterval, clearInterval,
        module: { exports: {} },
        appState: { coins: 0 },
        currentUser: 'tester',
        saveUserData: (u, st) => saves.push(st),
        document: {
            getElementById: el, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => el('scratch'), addEventListener() {}, body: el('body'),
        },
        window: { addEventListener() {} },
        localStorage: { getItem: () => null, setItem() {} },
        showToast: (m) => { ctx.lastToast = m; },
        createConfetti() {}, recordStudy() {},
    };
    vm.createContext(ctx);
    for (const f of DATA_FILES) { try { vm.runInContext(read('js/' + f), ctx); } catch (e) {} }
    vm.runInContext(engineSrc, ctx);
    for (const f of TAB_FILES) { try { vm.runInContext(read('js/' + f), ctx); } catch (e) {} }
    vm.runInContext('this.CFG = RETRY_DRILLS; this.drill = () => _retryDrill;'
        + '\nthis.VERBS = (typeof irregularVerbs !== "undefined") ? irregularVerbs : [];', ctx);
    return { ctx, el, saves };
}

// One real item per drill, taken from that tab's own bank.
function sampleFor(ctx, key) {
    switch (key) {
        case 'units': return ctx.unitsBank()[0];
        case 'wf': return ctx.wordformBank()[0];
        case 'phr': return ctx.phrasesBank()[0];
        case 'col': return ctx.collocBank()[0];
        case 'rw': return ctx.rewriteBank()[0];
        case 'verbs': return ctx.VERBS[0];
        default: return null;
    }
}
// What a child would type to get that item right.
function rightAnswerFor(key, cfg, item) {
    if (key === 'verbs') return { v2: item.v2, v3: item.v3 };
    return String(cfg.answerText(item));
}
const WRONG = (key) => (key === 'verbs' ? { v2: 'zzz', v3: 'zzz' } : 'zzz');

const KEYS = ['units', 'wf', 'phr', 'col', 'rw', 'verbs'];

suite('retry drill: every tab is plugged in', () => {
    test('all six tabs register a drill', () => {
        const { ctx } = makeEnv();
        assert.deepEqual(Object.keys(ctx.CFG).sort(), KEYS.slice().sort());
    });

    for (const key of KEYS) {
        test(`${key}: resolves a real item, grades it, and can show the answer`, () => {
            // Each tab supplies resolve/idOf/grade/answerText for its own data
            // shape. If any of them is wrong the drill either shows nothing,
            // never clears, or rejects the right answer — all silent.
            const { ctx } = makeEnv();
            const cfg = ctx.CFG[key];
            const item = sampleFor(ctx, key);
            assert.truthy(item, `${key} has no sample item — its bank did not load`);

            const id = cfg.idOf(item);
            assert.truthy(id, `${key}: idOf returned nothing`);
            assert.truthy(cfg.resolve(id), `${key}: resolve(idOf(item)) found nothing`);

            const answer = cfg.answerText(item);
            assert.truthy(answer && String(answer).length, `${key}: nothing to reveal`);

            assert.truthy(cfg.grade(rightAnswerFor(key, cfg, item), item),
                `${key}: the right answer was graded wrong`);
            assert.falsy(cfg.grade(WRONG(key), item), `${key}: junk was graded right`);
        });

        test(`${key}: the 👁 hint shows something the grader accepts`, () => {
            // A hint that displays a string the grader rejects is a trap. This
            // caught Verbs, where the hint read "was/were" and typing exactly
            // that was refused.
            const { ctx } = makeEnv();
            const cfg = ctx.CFG[key];
            const item = sampleFor(ctx, key);
            const shown = String(cfg.answerText(item));
            const typed = key === 'verbs'
                ? { v2: shown.split(' · ')[0], v3: shown.split(' · ')[1] }
                : shown;
            assert.truthy(cfg.grade(typed, item),
                `${key}: the hint shows "${shown}" but typing it is marked wrong`);
        });
    }

    test('every tab writes to its own slot in appState', () => {
        // One shared key would make a mistake in Phrases block Rewrite.
        const { ctx } = makeEnv();
        const slots = new Set();
        for (const key of KEYS) {
            ctx.retryAdd(key, [sampleFor(ctx, key)]);
            slots.add(key + 'Retry');
        }
        assert.equal(slots.size, KEYS.length, 'two tabs share a storage slot');
        for (const key of KEYS) {
            assert.equal(ctx.retryCount(key), 1, `${key} did not record its own debt`);
        }
        ctx.retryClear('phr', ctx.CFG.phr.idOf(sampleFor(ctx, 'phr')));
        assert.equal(ctx.retryCount('phr'), 0);
        assert.equal(ctx.retryCount('rw'), 1, 'clearing one tab emptied another');
    });
});

suite('retry drill: the owed queue', () => {
    test('the same mistake twice is owed once', () => {
        const { ctx } = makeEnv();
        const a = sampleFor(ctx, 'wf'), b = ctx.wordformBank()[5];
        ctx.retryAdd('wf', [a, b]);
        ctx.retryAdd('wf', [a, b, a]);
        assert.equal(ctx.retryCount('wf'), 2, 'a repeated mistake must not inflate the debt');
    });

    test('IDs are stored, not copies of the item', () => {
        // Storing whole objects would freeze the wording and the accepted
        // answers at the moment of the mistake, so a data fix would never
        // reach an item a child already owes.
        const { ctx } = makeEnv();
        const q = sampleFor(ctx, 'rw');
        ctx.retryAdd('rw', [q]);
        assert.deepEqual(ctx.appState.rwRetry, [String(q.id)]);
    });

    test('an item dropped from the bank cannot wedge the gate shut', () => {
        const { ctx } = makeEnv();
        ctx.appState.wfRetry = ['no-such-question'];
        assert.equal(ctx.retryCount('wf'), 0, 'an unresolvable id must be ignored, not owed forever');
    });

    test('junk in storage neither throws nor counts', () => {
        const { ctx } = makeEnv();
        for (const junk of [null, undefined, 'not-an-array', 42, {}, ['', null, undefined]]) {
            ctx.appState.wfRetry = junk;
            assert.equal(ctx.retryCount('wf'), 0, `counted or threw for ${JSON.stringify(junk)}`);
        }
    });

    test('progress is saved as it happens, not at the end', () => {
        const { ctx, saves } = makeEnv();
        ctx.retryAdd('wf', [sampleFor(ctx, 'wf')]);
        assert.truthy(saves.length > 0, 'the debt must survive a reload');
    });
});

suite('retry drill: the gate', () => {
    test('it takes over and says why', () => {
        const { ctx } = makeEnv();
        ctx.retryAdd('wf', [sampleFor(ctx, 'wf')]);
        assert.truthy(ctx.retryGate('wf'), 'the gate must report that it handled the call');
        assert.truthy(ctx.isRetryDrillActive(), 'and open the drill');
        assert.truthy(/sai/.test(ctx.lastToast || ''), 'and tell the child why');
    });

    test('it stands aside when nothing is owed', () => {
        const { ctx } = makeEnv();
        assert.falsy(ctx.retryGate('wf'), 'with no debt the practice must start normally');
        assert.falsy(ctx.isRetryDrillActive());
    });

    for (const [file, fns] of [
        ['js/units.js', ['startUnitPractice']],
        ['js/wordform.js', ['startWordformQuiz', 'startWordformReviewQuiz']],
        ['js/phrases.js', ['startPhrasesQuiz', 'startPhrasesReviewQuiz']],
        ['js/collocation.js', ['startCollocPractice']],
        ['js/rewrite.js', ['startRewriteQuiz', 'startRewriteReviewQuiz']],
        ['js/verbs.js', ['startSpeedChallenge']],
    ]) {
        test(`${file}: every way into a practice is gated`, () => {
            // Including the "practise your mistakes" buttons: an ungated side
            // door lets a child loop forever without clearing the debt.
            const src = read(file);
            for (const fn of fns) {
                const i = src.indexOf('function ' + fn + '(');
                assert.truthy(i > 0, `${fn} not found in ${file}`);
                // Generous window: these functions open with a comment
                // explaining the rule, and the call sits after it.
                assert.truthy(/retryGate\(/.test(src.slice(i, i + 500)),
                    `${fn} does not call retryGate — it is a side door around the gate`);
            }
        });
    }

    for (const [file, fn, key] of [
        ['js/units.js', 'finishUnitPractice', 'units'],
        ['js/wordform.js', 'finishWordformQuiz', 'wf'],
        ['js/phrases.js', 'finishPhrasesQuiz', 'phr'],
        ['js/collocation.js', 'finishCollocPractice', 'col'],
        ['js/rewrite.js', 'finishRewriteQuiz', 'rw'],
    ]) {
        test(`${file}: mistakes are owed when the practice ends`, () => {
            const src = read(file);
            const i = src.indexOf('function ' + fn + '(');
            assert.truthy(i > 0, `${fn} not found`);
            const body = src.slice(i, i + 3000);
            assert.truthy(new RegExp("retryAdd\\('" + key + "'").test(body),
                `${fn} never records what was missed`);
        });
    }

    test('verbs owes the verbs it got wrong, and only those', () => {
        const src = read('js/verbs.js');
        assert.truthy(/retryAdd\('verbs',[\s\S]{0,120}filter\(r => r && !r\.correct\)/.test(src),
            'a correct verb must not be owed back');
    });

    test('coins are banked before the debt is recorded', () => {
        // Getting something wrong must never feel like it took away what was
        // just earned.
        for (const [file, coinLine, key] of [
            ['js/wordform.js', 'appState.coins = (appState.coins || 0) + coinsEarned', 'wf'],
            ['js/phrases.js', 'appState.coins = (appState.coins || 0) + coinsEarned', 'phr'],
            ['js/collocation.js', 'appState.coins = (appState.coins || 0) + coinsEarned', 'col'],
            ['js/verbs.js', 'appState.coins = (appState.coins || 0) + _wfCoins', 'verbs'],
        ]) {
            const src = read(file);
            const coins = src.indexOf(coinLine);
            const debt = src.indexOf("retryAdd('" + key + "'");
            assert.truthy(coins > 0 && debt > 0, `${file}: could not locate both lines`);
            assert.truthy(debt > coins, `${file}: the debt is recorded before the coins are banked`);
        }
    });
});

suite('retry drill: hold to peek', () => {
    function open(key) {
        const env = makeEnv();
        env.ctx.retryAdd(key, [sampleFor(env.ctx, key), sampleFor(env.ctx, key)]);
        env.ctx.startRetryDrill(key);
        return env;
    }

    test('pressing shows, releasing hides', () => {
        const { ctx } = open('wf');
        assert.falsy(ctx.drill().revealed, 'an item starts hidden');
        ctx.setRetryReveal(true);
        assert.truthy(ctx.drill().revealed);
        ctx.setRetryReveal(false);
        assert.falsy(ctx.drill().revealed);
    });

    test('every way of letting go hides it', () => {
        // Release, sliding a finger off, the touch being cancelled, key-up, or
        // the button losing focus. Any one missing leaves the answer on screen
        // and turns the hint into a free pass.
        for (const off of ['onmouseup', 'onmouseleave', 'ontouchend', 'ontouchcancel', 'onkeyup', 'onblur']) {
            assert.truthy(new RegExp(off + '="setRetryReveal\\(false\\)"').test(engineSrc),
                `${off} must hide the answer`);
        }
        for (const on of ['onmousedown', 'ontouchstart', 'onkeydown']) {
            assert.truthy(new RegExp(on + '="[^"]*setRetryReveal\\(true\\)').test(engineSrc),
                `${on} must show it`);
        }
    });

    test('peeking does not wipe what was already typed', () => {
        // A child half-way through a word who reaches for the hint must not
        // have the input rebuilt underneath them.
        const fn = engineSrc.slice(engineSrc.indexOf('function setRetryReveal'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.falsy(/renderRetryDrill/.test(body),
            'setRetryReveal must not re-render — that rebuilds the input and loses the text');
        assert.truthy(/getElementById\('retryReveal'\)/.test(body), 'it must touch the reveal node directly');
    });

    test('the next item starts hidden, however the last one ended', () => {
        const { ctx } = open('wf');
        ctx.setRetryReveal(true);
        ctx.submitRetryAnswer();
        ctx.nextRetryQuestion();
        assert.falsy(ctx.drill().revealed, 'the answer would otherwise be given away');
    });

    test('a long press does not raise the iOS selection callout', () => {
        assert.truthy(/oncontextmenu="return false"/.test(engineSrc));
        assert.truthy(/ontouchstart="event\.preventDefault\(\)/.test(engineSrc),
            'without preventDefault the press selects text and fires a synthetic mousedown');
        assert.truthy(/-webkit-touch-callout: none/.test(cssSrc));
        assert.truthy(/\.unit-peek-btn \{[^}]*user-select: none/.test(cssSrc));
    });

    test('the hidden state keeps its height', () => {
        assert.truthy(/\.unit-retry-reveal \{[^}]*min-height/.test(cssSrc),
            'without a reserved row the input jumps under the child’s thumb on every peek');
        assert.truthy(/\.unit-retry-reveal\.hidden \{ visibility: hidden/.test(cssSrc),
            'display:none would collapse the row and cause exactly that jump');
    });
});

suite('retry drill: the verdict belongs to the item that earned it', () => {
    function open(key, n) {
        const env = makeEnv();
        const bank = { wf: () => env.ctx.wordformBank(), rw: () => env.ctx.rewriteBank() }[key]();
        env.ctx.retryAdd(key, bank.slice(0, n));
        env.ctx.startRetryDrill(key);
        return env;
    }
    const typed = (ctx, v) => { ctx.document.getElementById('retryInput').value = v; };

    test('answering does not advance — it shows the verdict for this item', () => {
        const { ctx } = open('wf', 3);
        const asked = ctx.drill().queue[0];
        typed(ctx, 'zzz');
        ctx.submitRetryAnswer();
        const st = ctx.drill();
        assert.truthy(st.answered, 'a verdict must be held');
        assert.equal(ctx.CFG.wf.idOf(st.answered.item), ctx.CFG.wf.idOf(asked),
            'the verdict must belong to the item just asked');
        assert.equal(st.answered.ok, false);
        assert.equal(st.answered.shown, 'zzz', 'what the child typed is echoed back');
    });

    test('moving on clears it, so no verdict reaches the next item', () => {
        const { ctx } = open('wf', 3);
        typed(ctx, 'zzz');
        ctx.submitRetryAnswer();
        ctx.nextRetryQuestion();
        assert.falsy(ctx.drill().answered, 'a stale verdict would be painted over the next item');
    });

    test('the screen shows an input OR a verdict, never both', () => {
        const { ctx, el } = open('wf', 3);
        const html = () => el('wordformScreen').innerHTML;
        assert.truthy(html().includes('id="retryInput"'), 'a fresh item must offer the input');
        assert.falsy(html().includes('grammar-next-btn'), 'and no Next button');
        assert.falsy(html().includes('wf-text-answer'), 'nor a verdict');

        typed(ctx, 'zzz');
        ctx.submitRetryAnswer();
        assert.truthy(html().includes('wf-text-answer'), 'the verdict must appear');
        assert.truthy(html().includes('nextRetryQuestion()'), 'with a Next button');
        assert.falsy(html().includes('id="retryInput"'), 'and the input must be gone');

        ctx.nextRetryQuestion();
        assert.truthy(html().includes('id="retryInput"'), 'the next item offers the input again');
        assert.falsy(html().includes('wf-text-answer'), 'carrying no verdict with it');
    });

    test('a second answer for the same item is ignored', () => {
        // Enter held down, or a double tap on Check, must not score twice.
        const { ctx } = open('wf', 3);
        typed(ctx, 'zzz');
        ctx.submitRetryAnswer();
        const missed = ctx.drill().missed;
        ctx.submitRetryAnswer();
        ctx.submitRetryAnswer();
        assert.equal(ctx.drill().missed, missed, 'the item was scored more than once');
    });

    test('a wrong answer keeps the debt and moves to another item', () => {
        // Pinning a child on one item they cannot spell turns a gate into a
        // wall; it goes to the back of the queue instead.
        const { ctx } = open('wf', 3);
        const first = ctx.CFG.wf.idOf(ctx.drill().queue[0]);
        typed(ctx, 'zzz');
        ctx.submitRetryAnswer();
        assert.equal(ctx.retryCount('wf'), 3, 'a wrong answer must not clear the debt');
        ctx.nextRetryQuestion();
        const now = ctx.CFG.wf.idOf(ctx.drill().queue[ctx.drill().idx % ctx.drill().queue.length]);
        assert.truthy(now !== first, 'it must move on');
        assert.truthy(ctx.drill().queue.some(q => ctx.CFG.wf.idOf(q) === first), 'and still owe it');
    });

    test('a correct answer clears that item immediately', () => {
        const { ctx } = open('wf', 2);
        const q = ctx.drill().queue[0];
        typed(ctx, String(ctx.CFG.wf.answerText(q)));
        ctx.submitRetryAnswer();
        assert.equal(ctx.retryCount('wf'), 1, 'the item must no longer be owed');
        assert.falsy((ctx.appState.wfRetry || []).includes(String(q.id)),
            'and the saved copy must not still list it');
    });

    test('the verdict still shows when the last item is cleared', () => {
        // A correct answer removes it from the queue, so the screen must draw
        // from the held verdict rather than an empty queue — otherwise the
        // drill closes before the child sees they got it right.
        const { ctx } = open('wf', 1);
        const q = ctx.drill().queue[0];
        typed(ctx, String(ctx.CFG.wf.answerText(q)));
        ctx.submitRetryAnswer();
        assert.truthy(ctx.drill(), 'the drill must not close before the result is seen');
        assert.truthy(ctx.drill().answered.ok);
        assert.equal(ctx.drill().queue.length, 0);
        ctx.nextRetryQuestion();
        assert.falsy(ctx.isRetryDrillActive(), 'only then does it finish');
    });

    test('the drill ends only when nothing is owed', () => {
        const { ctx } = open('rw', 3);
        let guard = 0;
        while (ctx.isRetryDrillActive() && guard++ < 30) {
            const st = ctx.drill();
            if (!st.queue.length) { ctx.nextRetryQuestion(); break; }
            const q = st.queue[st.idx % st.queue.length];
            typed(ctx, String(ctx.CFG.rw.answerText(q)));
            ctx.submitRetryAnswer();
            ctx.nextRetryQuestion();
        }
        assert.equal(ctx.retryCount('rw'), 0);
        assert.falsy(ctx.isRetryDrillActive());
    });

    test('a wrong verdict promises the item will come back', () => {
        assert.truthy(/Đáp án đúng/.test(engineSrc), 'the right answer must be shown');
        assert.truthy(/gặp lại/.test(engineSrc), 'and the child told it is not gone');
    });
});

suite('retry drill: the lock explains itself', () => {
    test('the banner states the debt and is the way out', () => {
        const { ctx } = makeEnv();
        ctx.retryAdd('wf', [sampleFor(ctx, 'wf')]);
        const html = ctx.retryOwedBannerHTML('wf');
        assert.truthy(/1 câu sai/.test(html), 'it must say how much is owed');
        assert.truthy(/startRetryDrill\('wf'\)/.test(html), 'and be able to start the drill');
        assert.equal(ctx.retryOwedBannerHTML('rw'), '', 'no banner when nothing is owed');
    });

    test('a locked control looks locked', () => {
        assert.truthy(cssSrc.includes('.g4-card.locked'), 'unit cards');
        assert.truthy(cssSrc.includes('.phrases-cta.locked'), 'practice buttons');
    });

    test('the tabs that lock a control also render the reason', () => {
        for (const [file, needle] of [
            ['js/units.js', "retryOwedBannerHTML('units')"],
            ['js/wordform.js', "retryOwedBannerHTML('wf')"],
        ]) {
            assert.truthy(read(file).includes(needle), `${file} disables controls without explaining why`);
        }
    });

    test('the engine is loaded before any tab that registers a config', () => {
        // A config registered before the engine exists throws on load and the
        // whole tab file stops executing.
        const html = read('index.html');
        const engine = html.indexOf('js/retrydrill.js');
        assert.truthy(engine > 0, 'retrydrill.js is not loaded at all');
        for (const f of TAB_FILES) {
            const at = html.indexOf('js/' + f);
            if (at > 0) assert.truthy(engine < at, `js/${f} loads before the engine it needs`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
