// collocation-followups.test.js — every Collocation question must carry the
// understanding check that follows it (js/collocation-followups.js): what the
// collocation MEANS, and WHY those words go together. Locks both the data and
// the quiz behaviour built on it.
const { suite, test, assert } = require('./harness');
// The quiz tabs render their Next button through the answer gate, exactly as
// the browser does — index.html always loads it before them.
Object.assign(global, require('../js/answer-audio.js'));
const path = require('path');

const { COLLOCATION_QUESTIONS: BANK } = require(path.join(__dirname, '..', 'js', 'collocation-data.js'));
const { COLLOCATION_FOLLOWUPS: FU } = require(path.join(__dirname, '..', 'js', 'collocation-followups.js'));

global.COLLOCATION_QUESTIONS = BANK;
global.COLLOCATION_FOLLOWUPS = FU;
global.appState = { coins: 0, collocHistory: [] };
global.currentUser = 'tester';
global.saveUserData = () => {};
global.document = { getElementById: () => null, querySelectorAll: () => [] };
const col = require(path.join(__dirname, '..', 'js', 'collocation.js'));

const norm = s => String(s).toLowerCase().normalize('NFC')
    .replace(/[.,!?;:"'’`]/g, '').replace(/\s+/g, ' ').trim();

function makeEl() { return { innerHTML: '', value: '', focus() {} }; }
function useScreen(el) {
    global.document = {
        getElementById: id => (id === 'phrasesScreen' ? el : null),
        querySelectorAll: () => [],
    };
}
// A practice draws at random, so tests answer whatever format came up.
function answerCurrent(screen) {
    if (screen.innerHTML.includes('colTextInput')) {
        const doc = global.document;
        global.document = {
            getElementById: id => (id === 'colTextInput' ? { value: 'zz' } : doc.getElementById(id)),
            querySelectorAll: () => [],
        };
        col.submitCollocText();
        global.document = doc;
    } else {
        col.answerCollocChoice(0);
    }
}

suite('collocation follow-ups: data', () => {
    test('all 500 questions have a follow-up, and none is orphaned', () => {
        const missing = BANK.filter(q => !FU[q.id]).map(q => q.id);
        assert.deepEqual(missing.slice(0, 8), [], `questions with no follow-up: ${missing.length}`);
        const ids = new Set(BANK.map(q => q.id));
        const orphans = Object.keys(FU).filter(id => !ids.has(id));
        assert.deepEqual(orphans.slice(0, 8), [], `follow-ups for unknown ids: ${orphans.length}`);
        assert.equal(Object.keys(FU).length, 500);
    });

    test('both blocks have 4 distinct options and a valid correct index', () => {
        for (const q of BANK) {
            for (const k of ['m', 'r']) {
                const b = FU[q.id][k];
                assert.truthy(Array.isArray(b.o) && b.o.length === 4, `${q.id}.${k}: needs 4 options`);
                assert.truthy(b.c >= 0 && b.c < 4, `${q.id}.${k}: bad correct index ${b.c}`);
                assert.equal(new Set(b.o.map(norm)).size, 4, `${q.id}.${k}: duplicate options`);
                b.o.forEach((o, i) => assert.truthy(typeof o === 'string' && o.trim(), `${q.id}.${k}.o[${i}]: empty`));
            }
        }
    });

    test('no option smuggles in the explanation markup', () => {
        // The bank's explanations are trusted HTML; these options are not, and
        // are rendered escaped — a stray <b> would show up as literal text.
        for (const q of BANK) {
            for (const k of ['m', 'r']) {
                FU[q.id][k].o.forEach((t, i) => {
                    assert.truthy(!/<[^>]+>|🔑|✗/.test(t), `${q.id}.${k}.o[${i}]: HTML or 🔑/✗ in an option`);
                });
            }
        }
    });

    test('meaning options are Vietnamese and short enough for a phone', () => {
        for (const q of BANK) {
            FU[q.id].m.o.forEach((t, i) => {
                assert.truthy(t.trim().split(/\s+/).length <= 8, `${q.id}.m.o[${i}]: too long`);
                assert.truthy(!/[()"'’]/.test(t), `${q.id}.m.o[${i}]: no quotes or parentheses`);
            });
        }
    });

    test('the right meaning is the bank\'s own gloss, not a paraphrase of it', () => {
        // The first authoring pass drifted here — a checker bug pushed authors
        // off the gloss and "quyền truy cập" came out as "vào được hệ thống dù
        // không được phép". Accurate, but no longer the thing the bank teaches.
        // Every meaning must share real wording with the gloss it comes from.
        const GLUE = new Set(['sự', 'việc', 'một', 'cái', 'làm', 'là', 'của', 'cho', 'được', 'bị',
                              'điều', 'người', 'ai', 'gì', 'đó', 'các', 'những', 'và', 'với', 'về',
                              'có', 'không']);
        const tok = s => String(s).toLowerCase().normalize('NFC')
            .replace(/[.,!?;:"'’`()[\]/]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
        let checked = 0;
        for (const q of BANK) {
            const parts = String(q.vi || '').split(/\s[—–-]\s/);
            if (parts.length < 2) continue;              // 25 glosses carry no Vietnamese half
            checked++;
            const gloss = tok(parts.slice(1).join(' ')).filter(w => !GLUE.has(w));
            if (!gloss.length) continue;
            const right = tok(FU[q.id].m.o[FU[q.id].m.c]);
            assert.truthy(gloss.some(w => right.includes(w)),
                `${q.id}: meaning "${FU[q.id].m.o[FU[q.id].m.c]}" shares no wording with the gloss "${parts.slice(1).join(' ')}"`);
        }
        assert.equal(checked, 475, 'the number of glossed questions changed — recheck this rule');
    });

    test('a quoted English string is quoted from the question itself', () => {
        for (const q of BANK) {
            const corpus = [q.q, q.frame, q.answer, q.keyword, q.explanation.replace(/<[^>]+>/g, ' ')]
                .concat(q.options || []).filter(Boolean).join(' ').toLowerCase();
            FU[q.id].r.o.forEach((t, i) => {
                (t.match(/'([^']+)'/g) || []).forEach(qt => {
                    const s = qt.replace(/'/g, '').trim();
                    if (!/[A-Za-z]/.test(s)) return;
                    assert.truthy(corpus.includes(s.toLowerCase()),
                        `${q.id}.r.o[${i}]: quotes '${s}', which is nowhere in the record`);
                });
            });
        }
    });

    test('on a 4-option question, every wrong choice is answered by a reason', () => {
        // Three reasons that all argue about the same distractor would leave the
        // right one findable without reading the sentence.
        for (const q of BANK.filter(x => Array.isArray(x.options) && x.options.length === 4)) {
            const r = FU[q.id].r;
            const distractors = r.o.filter((_, i) => i !== r.c);
            q.options.forEach((opt, i) => {
                if (i === q.correct) return;
                const words = opt.split('/').map(s => s.trim()).filter(s => s.length > 2);
                // A one- or two-letter option ("do", "on") gives nothing to
                // search for; requiring it quoted is a demand no wording meets.
                if (!words.length) return;
                const hit = distractors.some(d => words.some(w => d.toLowerCase().includes(w.toLowerCase())));
                assert.truthy(hit, `${q.id}: no reason addresses the wrong option "${opt}"`);
            });
        }
    });

    test('the correct answer is not parked on one letter', () => {
        for (const k of ['m', 'r']) {
            const spread = [0, 0, 0, 0];
            BANK.forEach(q => spread[FU[q.id][k].c]++);
            spread.forEach((n, i) => assert.truthy(n > 90 && n < 165,
                `${k}: slot ${i} holds ${n} of 500 — too skewed (${spread.join('/')})`));
        }
    });
});

suite('collocation follow-ups: the phrase being asked about', () => {
    test('collocPhrase reads the English head of the vi gloss', () => {
        const q = BANK.find(x => / [—–-] /.test(x.vi) && /^[A-Za-z]/.test(x.vi));
        assert.equal(col.collocPhrase(q), q.vi.split(/\s[—–-]\s/)[0].trim());
    });

    test('a purely Vietnamese gloss falls back to the answer, never to Vietnamese', () => {
        // 25 glosses carry no English head; asking "what is the meaning of
        // <Vietnamese>?" would be nonsense.
        const VN = /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
        BANK.forEach(q => {
            const p = col.collocPhrase(q);
            assert.truthy(p && !VN.test(p), `${q.id}: phrase "${p}" is not English`);
        });
    });

    test('the filled sentence uses the frame for transforms and both halves for pairs', () => {
        const pair = BANK.find(q => q.type === 'pair');
        const fp = col.collocFilledParts(pair);
        assert.equal(fp.src, pair.q);
        assert.equal(fp.fills.length, 2, 'a pair answer fills two gaps');
        assert.equal((pair.q.match(/_{2,}/g) || []).length, 2);

        const tr = BANK.find(q => q.type === 'transform');
        assert.equal(col.collocFilledParts(tr).src, tr.frame, 'a transform is rewritten into its frame');
    });
});

suite('collocation follow-ups: quiz behaviour', () => {
    test('collocFollowupQuestion builds a two-part question from the bank entry', () => {
        const base = BANK[0];
        const f = col.collocFollowupQuestion(base);
        assert.equal(f.id, 'colu-' + base.id);
        assert.truthy(f.followup === true);
        assert.equal(f.baseId, base.id);
        assert.truthy(f.m.q.includes(col.collocPhrase(base)), 'the meaning question quotes the collocation');
        assert.truthy(f.r.q.includes(base.answer), 'the reason question quotes the answer');
        assert.equal(f.explanation, base.explanation, 'the bank explanation is carried over, not rewritten');
        assert.equal(f.vi, base.vi);
    });

    test('a question with no follow-up data keeps its place instead of vanishing', () => {
        const saved = global.COLLOCATION_FOLLOWUPS;
        global.COLLOCATION_FOLLOWUPS = {};
        try {
            assert.equal(col.collocFollowupQuestion(BANK[0]), null);
            assert.equal(col.colExpandFollowups(BANK.slice(0, 3)).length, 3);
        } finally { global.COLLOCATION_FOLLOWUPS = saved; }
    });

    test('malformed data is refused rather than rendered', () => {
        const saved = global.COLLOCATION_FOLLOWUPS;
        const id = BANK[0].id;
        try {
            global.COLLOCATION_FOLLOWUPS = { [id]: { m: { o: ['a', 'b', 'c'], c: 0 }, r: FU[id].r } };
            assert.equal(col.collocFollowupQuestion(BANK[0]), null, 'three options is not a question');
            global.COLLOCATION_FOLLOWUPS = { [id]: { m: { o: FU[id].m.o, c: 7 }, r: FU[id].r } };
            assert.equal(col.collocFollowupQuestion(BANK[0]), null, 'an out-of-range correct index');
            global.COLLOCATION_FOLLOWUPS = { [id]: { m: FU[id].m } };
            assert.equal(col.collocFollowupQuestion(BANK[0]), null, 'a missing reason block');
        } finally { global.COLLOCATION_FOLLOWUPS = saved; }
    });

    test('every question is followed by its own check, in order', () => {
        const picked = BANK.slice(0, 3);
        const out = col.colExpandFollowups(picked);
        assert.equal(out.length, 6);
        picked.forEach((q, i) => {
            assert.equal(out[i * 2].id, q.id);
            assert.equal(out[i * 2 + 1].id, 'colu-' + q.id);
        });
    });

    test('a practice of 10 runs 20 screens, starting with the collocation', () => {
        const screen = makeEl();
        useScreen(screen);
        try {
            col.startCollocPractice(10);
            assert.truthy(screen.innerHTML.includes('>🧩 1/20<'),
                `expected a 1/20 counter, got: ${(/🧩 \d+\/\d+/.exec(screen.innerHTML) || ['none'])[0]}`);
            assert.truthy(!screen.innerHTML.includes('wf-follow-card'), 'the first screen is the question');
        } finally { col.abandonCollocPractice(); }
    });

    test('the check recaps the sentence with its blanks filled', () => {
        // "Vì sao đáp án đúng là …?" cannot be answered once the sentence has
        // scrolled away, so it comes back with the answer written into it.
        const screen = makeEl();
        useScreen(screen);
        try {
            col.startCollocPractice(1);
            const drawn = /🧩 1\/2/.test(screen.innerHTML);
            answerCurrent(screen);
            col.nextCollocQuestion();
            assert.truthy(drawn, 'a 1-question practice is 2 screens');
            assert.truthy(screen.innerHTML.includes('wf-follow-recap'), 'the check must recap the question');
            assert.truthy(screen.innerHTML.includes('col-recap-answer'), 'the blank must be filled in');
            assert.truthy(/wf-recap-you (ok|bad)/.test(screen.innerHTML), "the child's own answer is shown back");
        } finally { col.abandonCollocPractice(); }
    });

    test('a base-question tap cannot land on a check screen', () => {
        // The check has no options of its own; a stale node or a queued tap
        // reaching answerCollocChoice would crash on q.options[i] and overwrite
        // the check's two-part answer with a single value.
        const screen = makeEl();
        useScreen(screen);
        try {
            col.startCollocPractice(1);
            answerCurrent(screen);
            col.nextCollocQuestion();
            col.answerCollocChoice(0);          // must be ignored, not throw
            col.submitCollocText();
            assert.truthy(screen.innerHTML.includes('Trả lời câu 1 để mở câu 2'),
                'the check must still be waiting for its own answer');
            col.answerCollocFollowup('m', 0);
            col.answerCollocFollowup('r', 0);
            assert.truthy(screen.innerHTML.includes('grammar-next-btn'), 'and must still be answerable');
        } finally { col.abandonCollocPractice(); }
    });

    test('a follow-up is only done when BOTH questions are answered', () => {
        assert.falsy(col.colFollowDone(null));
        assert.falsy(col.colFollowDone({ m: 0, r: null }));
        assert.falsy(col.colFollowDone({ m: null, r: 0 }));
        assert.truthy(col.colFollowDone({ m: 0, r: 3 }));
    });

    test('it scores two points, one per question', () => {
        const f = col.collocFollowupQuestion(BANK[0]);
        const rightM = f.m.correct, rightR = f.r.correct;
        assert.equal(col.colFollowScore(f, { m: rightM, r: rightR }), 2);
        assert.equal(col.colFollowScore(f, { m: (rightM + 1) % 4, r: rightR }), 1);
        assert.equal(col.colFollowScore(f, { m: (rightM + 1) % 4, r: (rightR + 2) % 4 }), 0);
        assert.equal(col.colFollowScore(f, null), 0);
    });

    test('step 2 is locked until step 1 is answered, and Next waits for both', () => {
        const screen = makeEl();
        useScreen(screen);
        try {
            col.startCollocPractice(1);
            answerCurrent(screen);
            col.nextCollocQuestion();
            assert.truthy(screen.innerHTML.includes('wf-follow-card'), 'the check follows the question');
            assert.truthy(screen.innerHTML.includes('Trả lời câu 1 để mở câu 2'), 'step 2 starts locked');
            col.answerCollocFollowup('r', 0);   // must not sneak past the lock
            assert.truthy(screen.innerHTML.includes('Trả lời câu 1 để mở câu 2'), 'still locked');
            assert.truthy(!screen.innerHTML.includes('grammar-next-btn'), 'Next waits');
            col.answerCollocFollowup('m', 0);
            assert.truthy(!screen.innerHTML.includes('Trả lời câu 1'), 'step 2 opens');
            assert.truthy(!screen.innerHTML.includes('grammar-next-btn'), 'Next still waits for step 2');
            col.answerCollocFollowup('r', 1);
            assert.truthy(screen.innerHTML.includes('grammar-next-btn'), 'Next appears once both are answered');
        } finally { col.abandonCollocPractice(); }
    });

    test('the understanding card reports both checks, and stays away when empty', () => {
        assert.equal(col.colUnderstandCardHTML({ count: 0, m: 0, r: 0 }), '');
        assert.equal(col.colUnderstandCardHTML(null), '');
        const html = col.colUnderstandCardHTML({ count: 10, m: 9, r: 6 });
        assert.truthy(html.includes('9/10'), 'meaning score missing');
        assert.truthy(html.includes('6/10'), 'reason score missing');
        assert.truthy(html.includes('60%'), 'the reason bar should be 60% wide');
    });

    test('a finished practice scores the checks and records them in history', () => {
        const screen = makeEl();
        global.appState = { coins: 0, collocHistory: [] };
        useScreen(screen);
        let guard = 0;
        col.startCollocPractice(4);
        while (col.isCollocActive() && guard++ < 100) {
            answerCurrent(screen);
            col.answerCollocFollowup('m', 0);
            col.answerCollocFollowup('r', 0);
            col.nextCollocQuestion();
        }
        const s = global.appState.collocHistory[0];
        assert.equal(s.total, 12, '4 questions + 4 two-part checks');
        assert.equal(s.fu.count, 4);
        assert.truthy(s.fu.m <= 4 && s.fu.r <= 4, 'a check cannot score more than once');
        assert.equal(global.appState.coins, 5 * s.score, 'coins are 5 per point scored');
    });
});
