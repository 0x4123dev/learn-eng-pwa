// retry-drill.test.js — you owe back everything you got wrong.
//
// A child who misses a question, scores 8/10 and moves straight on collects a
// long tail of things they never learned. So in the Book practice (js/units.js,
// the one exercise left in the app) each missed word is owed back and no new
// practice opens until the debt is cleared.
//
// The rule lives ONCE, in js/retrydrill.js, and js/units.js plugs into it with
// one config (key 'word'). This file therefore tests the engine hard, and then
// checks only that the Book practice plugs into it correctly.
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

const TAB_FILES = ['units.js'];
const DATA_FILES = ['word-data.js'];

// Load the real engine, the real tab config and the real word bank in one
// sandbox — the same order index.html loads them (the bank is lazy in the app;
// here it is simply loaded first).
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
    vm.runInContext('this.CFG = RETRY_DRILLS; this.drill = () => _retryDrill;', ctx);
    return { ctx, el, saves };
}

// Real items from the drill's own bank (Book 1).
function bankFor(ctx, key) {
    return key === 'word' ? ctx.unitsBank('pr1') : [];
}
function sampleFor(ctx, key, i) {
    return bankFor(ctx, key)[i || 0] || null;
}
// What a child would type to get that item right.
function rightAnswerFor(key, cfg, item) {
    return String(cfg.answerText(item));
}
const WRONG = () => 'zzz';

const KEYS = ['word'];

suite('retry drill: the Book practice is plugged in', () => {
    test('exactly one drill is registered: the Book drill, key word', () => {
        const { ctx } = makeEnv();
        assert.deepEqual(Object.keys(ctx.CFG), KEYS);
    });

    test('js/units.js registers the Book drill, drawing on the Word detail pane', () => {
        const { ctx } = makeEnv();
        assert.equal(ctx.unitsRetryKey(), 'word');
        assert.equal(ctx.unitsRetryKey('word'), 'word');
        assert.equal(ctx.CFG.word.screenId, 'wordDetail');
        assert.equal(ctx.CFG.word.noun, 'từ');
        assert.equal(ctx.UNITS_RETRY_CONFIG, ctx.WORD_RETRY_CONFIG, 'the old name is an alias of the one config');
        assert.falsy(ctx.retryGate('word'), 'nothing owed: the practice opens');
        ctx.retryAdd('word', [sampleFor(ctx, 'word')]);
        assert.equal(ctx.retryCount('word'), 1);
        assert.truthy(ctx.retryGate('word'), 'a debt gates the practice');
    });

    for (const key of KEYS) {
        test(`${key}: resolves a real item, grades it, and can show the answer`, () => {
            // The tab supplies resolve/idOf/grade/answerText for its own data
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
            // once caught Verbs, where the hint read "was/were" and typing
            // exactly that was refused.
            const { ctx } = makeEnv();
            const cfg = ctx.CFG[key];
            const item = sampleFor(ctx, key);
            const shown = String(cfg.answerText(item));
            assert.truthy(cfg.grade(shown, item),
                `${key}: the hint shows "${shown}" but typing it is marked wrong`);
        });

        test(`${key}: every word of every book resolves back from its id`, () => {
            // The id carries the set ('pr2|advocate'), so a spelling shared by
            // two books comes back meaning what it meant when it was missed.
            const { ctx } = makeEnv();
            const cfg = ctx.CFG[key];
            for (const set of ['pr1', 'pr2', 'pr3']) {
                for (const w of ctx.unitsBank(set)) {
                    const id = cfg.idOf(w);
                    assert.truthy(id.startsWith(set + '|'), `${w.en}: id carries its set: ${id}`);
                    const back = cfg.resolve(id);
                    assert.truthy(back && back.set === set && back.en === w.en, `${id}: resolves to its own book`);
                }
            }
        });
    }

    test('the debt is stored under the drill\'s own slot in appState', () => {
        const { ctx } = makeEnv();
        for (const key of KEYS) {
            ctx.retryAdd(key, [sampleFor(ctx, key)]);
            assert.truthy(Array.isArray(ctx.appState[key + 'Retry']), `${key}Retry is the slot`);
            assert.equal(ctx.retryCount(key), 1, `${key} did not record its own debt`);
        }
        ctx.retryClear('word', ctx.CFG.word.idOf(sampleFor(ctx, 'word')));
        assert.equal(ctx.retryCount('word'), 0);
    });
});

suite('retry drill: the owed queue', () => {
    test('the same mistake twice is owed once', () => {
        const { ctx } = makeEnv();
        const a = sampleFor(ctx, 'word'), b = sampleFor(ctx, 'word', 5);
        ctx.retryAdd('word', [a, b]);
        ctx.retryAdd('word', [a, b, a]);
        assert.equal(ctx.retryCount('word'), 2, 'a repeated mistake must not inflate the debt');
    });

    test('IDs are stored, not copies of the item', () => {
        // Storing whole objects would freeze the wording and the accepted
        // answers at the moment of the mistake, so a data fix would never
        // reach an item a child already owes.
        const { ctx } = makeEnv();
        const q = sampleFor(ctx, 'word');
        ctx.retryAdd('word', [q]);
        assert.deepEqual(ctx.appState.wordRetry, ['pr1|' + q.en]);
    });

    test('an item dropped from the bank cannot wedge the gate shut', () => {
        const { ctx } = makeEnv();
        ctx.appState.wordRetry = ['pr1|no-such-word'];
        assert.equal(ctx.retryCount('word'), 0, 'an unresolvable id must be ignored, not owed forever');
    });

    test('junk in storage neither throws nor counts', () => {
        const { ctx } = makeEnv();
        for (const junk of [null, undefined, 'not-an-array', 42, {}, ['', null, undefined]]) {
            ctx.appState.wordRetry = junk;
            assert.equal(ctx.retryCount('word'), 0, `counted or threw for ${JSON.stringify(junk)}`);
        }
    });

    test('progress is saved as it happens, not at the end', () => {
        const { ctx, saves } = makeEnv();
        ctx.retryAdd('word', [sampleFor(ctx, 'word')]);
        assert.truthy(saves.length > 0, 'the debt must survive a reload');
    });
});

suite('retry drill: the gate', () => {
    test('it takes over and says why', () => {
        const { ctx } = makeEnv();
        ctx.retryAdd('word', [sampleFor(ctx, 'word')]);
        assert.truthy(ctx.retryGate('word'), 'the gate must report that it handled the call');
        assert.truthy(ctx.isRetryDrillActive(), 'and open the drill');
        assert.truthy(/sai/.test(ctx.lastToast || ''), 'and tell the child why');
    });

    test('it stands aside when nothing is owed', () => {
        const { ctx } = makeEnv();
        assert.falsy(ctx.retryGate('word'), 'with no debt the practice must start normally');
        assert.falsy(ctx.isRetryDrillActive());
    });

    for (const [file, fns] of [
        ['js/units.js', ['startUnitPractice']],
    ]) {
        test(`${file}: every way into a practice is gated`, () => {
            // Including the "practise again" button on an old results screen:
            // an ungated side door lets a child loop forever without clearing
            // the debt. Comment lines are dropped first: these functions open
            // with a comment explaining the rule, and the call sits after it.
            const src = read(file).replace(/^[ \t]*\/\/.*$/gm, '');
            for (const fn of fns) {
                const i = src.indexOf('function ' + fn + '(');
                assert.truthy(i > 0, `${fn} not found in ${file}`);
                // Generous window: the call must be among the first statements.
                assert.truthy(/retryGate\(/.test(src.slice(i, i + 500)),
                    `${fn} does not call retryGate — it is a side door around the gate`);
            }
        });
    }

    for (const [file, fn, key] of [
        ['js/units.js', 'finishUnitPractice', 'unitsRetryKey()'],
    ]) {
        test(`${file}: mistakes are owed when the practice ends`, () => {
            const src = read(file);
            const i = src.indexOf('function ' + fn + '(');
            assert.truthy(i > 0, `${fn} not found`);
            const body = src.slice(i, src.indexOf('\n}\n', i));   // the whole function, however long
            assert.truthy(body.includes('retryAdd(' + key),
                `${fn} never records what was missed`);
        });
    }

    test('coins are banked before the debt is recorded', () => {
        // Getting something wrong must never feel like it took away what was
        // just earned.
        for (const [file, coinLine, debtLine] of [
            ['js/units.js', 'appState.coins = (appState.coins || 0) + coinsEarned', 'retryAdd(unitsRetryKey()'],
        ]) {
            const src = read(file);
            const coins = src.indexOf(coinLine);
            const debt = src.indexOf(debtLine);
            assert.truthy(coins > 0 && debt > 0, `${file}: could not locate both lines`);
            assert.truthy(debt > coins, `${file}: the debt is recorded before the coins are banked`);
        }
    });
});

suite('retry drill: hold to peek', () => {
    function open(key) {
        const env = makeEnv();
        env.ctx.retryAdd(key, [sampleFor(env.ctx, key), sampleFor(env.ctx, key, 1)]);
        env.ctx.startRetryDrill(key);
        return env;
    }

    test('pressing shows, releasing hides', () => {
        const { ctx } = open('word');
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
        const { ctx } = open('word');
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
        env.ctx.retryAdd(key, bankFor(env.ctx, key).slice(0, n));
        env.ctx.startRetryDrill(key);
        return env;
    }
    const typed = (ctx, v) => { ctx.document.getElementById('retryInput').value = v; };

    test('answering does not advance — it shows the verdict for this item', () => {
        const { ctx } = open('word', 3);
        const asked = ctx.drill().queue[0];
        typed(ctx, 'zzz');
        ctx.submitRetryAnswer();
        const st = ctx.drill();
        assert.truthy(st.answered, 'a verdict must be held');
        assert.equal(ctx.CFG.word.idOf(st.answered.item), ctx.CFG.word.idOf(asked),
            'the verdict must belong to the item just asked');
        assert.equal(st.answered.ok, false);
        assert.equal(st.answered.shown, 'zzz', 'what the child typed is echoed back');
    });

    test('moving on clears it, so no verdict reaches the next item', () => {
        const { ctx } = open('word', 3);
        typed(ctx, 'zzz');
        ctx.submitRetryAnswer();
        ctx.nextRetryQuestion();
        assert.falsy(ctx.drill().answered, 'a stale verdict would be painted over the next item');
    });

    test('the screen shows an input OR a verdict, never both', () => {
        const { ctx, el } = open('word', 3);
        const html = () => el('wordDetail').innerHTML;
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
        const { ctx } = open('word', 3);
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
        const { ctx } = open('word', 3);
        const first = ctx.CFG.word.idOf(ctx.drill().queue[0]);
        typed(ctx, 'zzz');
        ctx.submitRetryAnswer();
        assert.equal(ctx.retryCount('word'), 3, 'a wrong answer must not clear the debt');
        ctx.nextRetryQuestion();
        const now = ctx.CFG.word.idOf(ctx.drill().queue[ctx.drill().idx % ctx.drill().queue.length]);
        assert.truthy(now !== first, 'it must move on');
        assert.truthy(ctx.drill().queue.some(q => ctx.CFG.word.idOf(q) === first), 'and still owe it');
    });

    test('a correct answer clears that item immediately', () => {
        const { ctx } = open('word', 2);
        const q = ctx.drill().queue[0];
        typed(ctx, String(ctx.CFG.word.answerText(q)));
        ctx.submitRetryAnswer();
        assert.equal(ctx.retryCount('word'), 1, 'the item must no longer be owed');
        assert.falsy((ctx.appState.wordRetry || []).includes(ctx.CFG.word.idOf(q)),
            'and the saved copy must not still list it');
    });

    test('the verdict still shows when the last item is cleared', () => {
        // A correct answer removes it from the queue, so the screen must draw
        // from the held verdict rather than an empty queue — otherwise the
        // drill closes before the child sees they got it right.
        const { ctx } = open('word', 1);
        const q = ctx.drill().queue[0];
        typed(ctx, String(ctx.CFG.word.answerText(q)));
        ctx.submitRetryAnswer();
        assert.truthy(ctx.drill(), 'the drill must not close before the result is seen');
        assert.truthy(ctx.drill().answered.ok);
        assert.equal(ctx.drill().queue.length, 0);
        ctx.nextRetryQuestion();
        assert.falsy(ctx.isRetryDrillActive(), 'only then does it finish');
    });

    test('the drill ends only when nothing is owed', () => {
        const { ctx } = open('word', 3);
        let guard = 0;
        while (ctx.isRetryDrillActive() && guard++ < 30) {
            const st = ctx.drill();
            if (!st.queue.length) { ctx.nextRetryQuestion(); break; }
            const q = st.queue[st.idx % st.queue.length];
            typed(ctx, String(ctx.CFG.word.answerText(q)));
            ctx.submitRetryAnswer();
            ctx.nextRetryQuestion();
        }
        assert.equal(ctx.retryCount('word'), 0);
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
        assert.equal(ctx.retryOwedBannerHTML('word'), '', 'no banner when nothing is owed');
        ctx.retryAdd('word', [sampleFor(ctx, 'word')]);
        const html = ctx.retryOwedBannerHTML('word');
        assert.truthy(/1 từ sai/.test(html), 'it must say how much is owed, in the drill\'s own noun');
        assert.truthy(/startRetryDrill\('word'\)/.test(html), 'and be able to start the drill');
    });

    test('a locked control looks locked', () => {
        assert.truthy(cssSrc.includes('.g4-card.locked'), 'unit cards');
    });

    test('the tab that locks a control also renders the reason', () => {
        for (const [file, needle] of [
            ['js/units.js', "retryOwedBannerHTML(unitsRetryKey())"],
        ]) {
            assert.truthy(read(file).includes(needle), `${file} disables controls without explaining why`);
        }
    });

    test('the engine is loaded before the tab that registers a config', () => {
        // A config registered before the engine exists throws on load and the
        // whole tab file stops executing. Match the <script> tags, not a
        // comment that happens to name the file.
        const html = read('index.html');
        const engine = html.indexOf('<script src="js/retrydrill.js">');
        assert.truthy(engine > 0, 'retrydrill.js is not loaded at all');
        for (const f of TAB_FILES) {
            const at = html.indexOf('<script src="js/' + f + '">');
            assert.truthy(at > 0, `js/${f} is not loaded at all`);
            assert.truthy(engine < at, `js/${f} loads before the engine it needs`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
