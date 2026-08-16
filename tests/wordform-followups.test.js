// wordform-followups.test.js — every Word form question must carry the
// understanding check that follows it (js/wordform-followups.js): what the
// answer word MEANS, and WHY the blank needs that word class. This file locks
// both the data (600 pairs, well formed, no giveaways) and the behaviour the
// quiz builds on top of it.
const { suite, test, assert } = require('./harness');
// The quiz tabs render their Next button through the answer gate, exactly as
// the browser does — index.html always loads it before them.
Object.assign(global, require('../js/answer-audio.js'));
const path = require('path');

const { WORDFORM_QUESTIONS: BANK } = require(path.join(__dirname, '..', 'js', 'wordform-data.js'));
const { WORDFORM_FOLLOWUPS: FU } = require(path.join(__dirname, '..', 'js', 'wordform-followups.js'));

global.WORDFORM_QUESTIONS = BANK;
global.WORDFORM_FOLLOWUPS = FU;
global.appState = { coins: 0, wordformHistory: [] };
global.currentUser = 'tester';
global.saveUserData = () => {};
global.document = { getElementById: () => null, querySelectorAll: () => [] };
const wf = require(path.join(__dirname, '..', 'js', 'wordform.js'));

const norm = s => String(s).toLowerCase().normalize('NFC')
    .replace(/[.,!?;:"'’`]/g, '').replace(/\s+/g, ' ').trim();
const CLASS_WORD = { noun: 'danh từ', adj: 'tính từ', adv: 'trạng từ', verb: 'động từ' };
const ALL_CLASSES = Object.values(CLASS_WORD);

// Which word class a reason concludes: whatever follows the last "cần".
function concluded(t) {
    const s = t.toLowerCase();
    const m = [...s.matchAll(/cần\s+(?:một\s+|1\s+)?(danh từ|tính từ|trạng từ|động từ)/g)];
    if (m.length) return m[m.length - 1][1];
    let last = null, at = -1;
    ALL_CLASSES.forEach(c => { const i = s.lastIndexOf(c); if (i > at) { at = i; last = c; } });
    return last;
}

suite('word form follow-ups: data', () => {
    test('all 600 questions have a follow-up, and none is orphaned', () => {
        const missing = BANK.filter(q => !FU[q.id]).map(q => q.id);
        assert.deepEqual(missing.slice(0, 8), [], `questions with no follow-up: ${missing.length}`);
        const ids = new Set(BANK.map(q => q.id));
        const orphans = Object.keys(FU).filter(id => !ids.has(id));
        assert.deepEqual(orphans.slice(0, 8), [], `follow-ups for unknown ids: ${orphans.length}`);
        assert.equal(Object.keys(FU).length, 600);
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

    test('meaning options are Vietnamese and never spell the English answer', () => {
        for (const q of BANK) {
            const re = new RegExp('\\b' + q.answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
            FU[q.id].m.o.forEach((o, i) => {
                assert.truthy(!re.test(o), `${q.id}.m.o[${i}]: leaks the English answer "${q.answer}"`);
                assert.truthy(!/[()]/.test(o), `${q.id}.m.o[${i}]: word-class label in a meaning option`);
                assert.truthy(o.trim().split(/\s+/).length <= 7, `${q.id}.m.o[${i}]: too long for a child's screen`);
            });
        }
    });

    test('the right reason names the answer\'s own word class', () => {
        for (const q of BANK) {
            const r = FU[q.id].r;
            assert.equal(concluded(r.o[r.c]), CLASS_WORD[q.cat],
                `${q.id}: the correct reason must conclude "${CLASS_WORD[q.cat]}" for answer "${q.answer}"`);
        }
    });

    test('the four reasons cover the four word classes — one each', () => {
        // Three distractors that all say "cần danh từ" would leave the answer
        // findable by counting rather than by reading the sentence.
        for (const q of BANK) {
            const got = FU[q.id].r.o.map(concluded);
            assert.equal(new Set(got).size, 4, `${q.id}: reasons repeat a word class (${got.join(' | ')})`);
        }
    });

    test('a reason quoting an English word quotes one that is really in the sentence', () => {
        for (const q of BANK) {
            FU[q.id].r.o.forEach((t, i) => {
                (t.match(/'([^']+)'/g) || []).forEach(qt => {
                    const w = qt.replace(/'/g, '');
                    if (!/^[A-Za-z][A-Za-z' -]*$/.test(w)) return;
                    const re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
                    assert.truthy(re.test(q.q), `${q.id}.r.o[${i}]: quotes '${w}', absent from the sentence`);
                });
            });
        }
    });

    test('the correct answer is not parked on one letter', () => {
        // The index is derived from the question id rather than chosen, so a
        // child cannot learn "it is usually B". Each slot should hold roughly a
        // quarter of the 600.
        for (const k of ['m', 'r']) {
            const spread = [0, 0, 0, 0];
            BANK.forEach(q => spread[FU[q.id][k].c]++);
            spread.forEach((n, i) => assert.truthy(n > 100 && n < 200,
                `${k}: slot ${i} holds ${n} of 600 — too skewed (${spread.join('/')})`));
        }
    });
});

suite('word form follow-ups: the negative-prefix question', () => {
    const NEG_PREFIXES = ['un', 'in', 'im', 'ir', 'il', 'dis', 'non'];
    const negIds = Object.keys(FU).filter(id => FU[id].neg);

    test('24 questions ask it — the ones whose answer really carries a prefix', () => {
        assert.equal(negIds.length, 24);
        negIds.forEach(id => {
            const q = BANK.find(x => x.id === id);
            const a = q.answer.toLowerCase();
            const w = FU[id].neg.w.toLowerCase();
            assert.truthy(NEG_PREFIXES.some(p => a === p + w),
                `${id}: "${q.answer}" is not a negative prefix + "${FU[id].neg.w}"`);
        });
    });

    test('it is NOT asked where the prefix is only a lookalike', () => {
        // invention, imagination, inspiration, understandable, unite… all start
        // with prefix letters and negate nothing. Asking "why not vention?" is
        // nonsense, so those questions must keep their two checks.
        ['wf-73', 'wf-148', 'wf-161', 'wf-12', 'wf-316', 'wf-45', 'wf-330'].forEach(id => {
            assert.truthy(!FU[id].neg, `${id} should not ask about a negative prefix`);
        });
    });

    test('4 distinct options, a valid index, and no giveaway of either form', () => {
        negIds.forEach(id => {
            const q = BANK.find(x => x.id === id);
            const n = FU[id].neg;
            assert.truthy(Array.isArray(n.o) && n.o.length === 4, `${id}: needs 4 options`);
            assert.truthy(n.c >= 0 && n.c < 4, `${id}: bad correct index`);
            assert.equal(new Set(n.o.map(norm)).size, 4, `${id}: duplicate options`);
            n.o.forEach((t, i) => {
                assert.truthy(t.length <= 95, `${id}.neg.o[${i}]: ${t.length} chars — max 95`);
                [q.answer, n.w].forEach(word => {
                    const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
                    assert.truthy(!re.test(t), `${id}.neg.o[${i}]: names "${word}", already in the question`);
                });
            });
        });
    });

    test('the right answer argues from meaning, not from word class', () => {
        // Word class is what the SECOND question asks; position in the sentence
        // can never explain a prefix.
        negIds.forEach(id => {
            const right = FU[id].neg.o[FU[id].neg.c];
            assert.truthy(!/danh từ|tính từ|trạng từ|động từ/i.test(right),
                `${id}: the correct reason falls back on word class — "${right}"`);
        });
    });

    test('a quoted English phrase is quoted from the sentence itself', () => {
        negIds.forEach(id => {
            const q = BANK.find(x => x.id === id);
            FU[id].neg.o.forEach((t, i) => {
                (t.match(/'([^']+)'/g) || []).forEach(qt => {
                    const s = qt.replace(/'/g, '');
                    if (!/^[A-Za-z][A-Za-z' -]*$/.test(s)) return;
                    assert.truthy(q.q.toLowerCase().includes(s.toLowerCase()),
                        `${id}.neg.o[${i}]: quotes '${s}', not in the sentence`);
                });
            });
        });
    });

    test('the built question contrasts the two forms and names the prefix', () => {
        const id = negIds[0];
        const f = wf.wfFollowupQuestion(BANK.find(x => x.id === id));
        assert.truthy(f.neg, 'the third part must be built');
        assert.truthy(f.neg.q.includes(BANK.find(x => x.id === id).answer), 'question names the answer');
        assert.truthy(f.neg.q.includes(f.neg.positive), 'question names the positive form');
        assert.equal(f.neg.prefix + f.neg.positive, BANK.find(x => x.id === id).answer);
        assert.deepEqual(wf.wfFollowParts(f), ['m', 'r', 'neg']);
    });

    test('a three-part check is worth three points and needs all three answered', () => {
        const f = wf.wfFollowupQuestion(BANK.find(x => x.id === negIds[0]));
        const all = { m: f.m.correct, r: f.r.correct, neg: f.neg.correct };
        assert.equal(wf.wfFollowScore(f, all), 3);
        assert.equal(wf.wfFollowScore(f, { ...all, neg: (f.neg.correct + 1) % 4 }), 2);
        assert.truthy(!wf.wfFollowDone(f, { m: 0, r: 0 }));
    });

    test('step 3 stays locked until step 2 is answered', () => {
        const screen = { innerHTML: '' };
        const savedDoc = global.document;
        global.document = { getElementById: id => (id === 'wordformScreen' ? screen : null), querySelectorAll: () => [] };
        try {
            const id = negIds[0];
            const base = BANK.find(x => x.id === id);
            wf.startWordformReviewQuiz([id]);
            wf.answerWfQuestion(base.type === 'mcq' ? base.correct : 0);
            if (base.type === 'text') { /* typed questions need submitWfText */ }
            wf.nextWfQuestion();
            assert.truthy(screen.innerHTML.includes('Trả lời câu 1 để mở câu 2'), 'step 2 locked');
            wf.answerWfFollowup('neg', 0);            // must not sneak past the lock
            assert.truthy(!screen.innerHTML.includes('Vì sao là'), 'step 3 must not be reachable yet');
            wf.answerWfFollowup('m', FU[id].m.c);
            assert.truthy(screen.innerHTML.includes('Trả lời câu 2 để mở câu 3'), 'step 3 locked');
            wf.answerWfFollowup('r', FU[id].r.c);
            assert.truthy(screen.innerHTML.includes('Vì sao là'), 'step 3 now open');
            assert.truthy(!screen.innerHTML.includes('grammar-next-btn'), 'Next waits for step 3');
            wf.answerWfFollowup('neg', FU[id].neg.c);
            assert.truthy(screen.innerHTML.includes('grammar-next-btn'), 'Next appears once all three are answered');
            assert.truthy(screen.innerHTML.includes('đảo ngược nghĩa của'), 'the prefix rule is explained');
        } finally {
            wf.abandonWordformQuiz();
            global.document = savedDoc;
        }
    });
});

suite('word form follow-ups: quiz behaviour', () => {
    test('wfFollowupQuestion builds a two-part question from the bank entry', () => {
        const base = BANK[0];
        const f = wf.wfFollowupQuestion(base);
        assert.equal(f.id, 'wfu-' + base.id);
        assert.truthy(f.followup === true);
        assert.equal(f.baseId, base.id);
        assert.truthy(f.m.q.includes(base.answer), 'the meaning question must quote the answer word');
        assert.truthy(f.r.q.includes(base.answer), 'the reason question must quote the answer word');
        assert.equal(f.m.options.length, 4);
        assert.equal(f.r.options.length, 4);
        // The explanation the child already earned is carried over, not re-written.
        assert.equal(f.explanation, base.explanation);
        assert.equal(f.vi, base.vi);
    });

    test('a question with no follow-up data keeps its place instead of vanishing', () => {
        const saved = global.WORDFORM_FOLLOWUPS;
        global.WORDFORM_FOLLOWUPS = {};
        try {
            assert.equal(wf.wfFollowupQuestion(BANK[0]), null);
            assert.equal(wf.wfExpandFollowups(BANK.slice(0, 3)).length, 3);
        } finally { global.WORDFORM_FOLLOWUPS = saved; }
    });

    test('malformed data is refused rather than rendered', () => {
        const saved = global.WORDFORM_FOLLOWUPS;
        const id = BANK[0].id;
        try {
            global.WORDFORM_FOLLOWUPS = { [id]: { m: { o: ['a', 'b', 'c'], c: 0 }, r: FU[id].r } };
            assert.equal(wf.wfFollowupQuestion(BANK[0]), null, 'three options is not a question');
            global.WORDFORM_FOLLOWUPS = { [id]: { m: { o: FU[id].m.o, c: 9 }, r: FU[id].r } };
            assert.equal(wf.wfFollowupQuestion(BANK[0]), null, 'an out-of-range correct index');
            global.WORDFORM_FOLLOWUPS = { [id]: { m: FU[id].m } };
            assert.equal(wf.wfFollowupQuestion(BANK[0]), null, 'a missing reason block');
        } finally { global.WORDFORM_FOLLOWUPS = saved; }
    });

    test('every question is followed by its own check, in order', () => {
        const picked = [BANK[0], BANK[1], BANK[2]];
        const out = wf.wfExpandFollowups(picked);
        assert.equal(out.length, 6);
        picked.forEach((q, i) => {
            assert.equal(out[i * 2].id, q.id);
            assert.equal(out[i * 2 + 1].id, 'wfu-' + q.id);
        });
    });

    test('a practice of 10 runs 20 screens, and the first is the word-form one', () => {
        // The button promises 10 word-form questions; each drags its check
        // along, so the progress counter reads 1/20 — not 1/10, and not 1/30.
        const screen = { innerHTML: '' };
        const savedDoc = global.document;
        global.document = { getElementById: id => (id === 'wordformScreen' ? screen : null), querySelectorAll: () => [] };
        try {
            wf.startWordformQuiz(10);
            assert.truthy(screen.innerHTML.includes('>1/20<'),
                `expected a 1/20 progress counter, got: ${(/>\d+\/\d+</.exec(screen.innerHTML) || ['none'])[0]}`);
            assert.truthy(!screen.innerHTML.includes('wf-follow-card'), 'the first screen must be the word-form question');
        } finally {
            wf.abandonWordformQuiz();
            global.document = savedDoc;
        }
    });

    test('the check shows the sentence again, with the blank filled', () => {
        // "Vì sao chỗ trống phải là X?" cannot be answered from memory alone.
        const screen = { innerHTML: '' };
        const savedDoc = global.document;
        global.document = { getElementById: id => (id === 'wordformScreen' ? screen : null), querySelectorAll: () => [] };
        try {
            const base = BANK.find(q => q.type === 'mcq' && q.correct !== 0);
            wf.startWordformReviewQuiz([base.id]);
            wf.answerWfQuestion(0);                 // deliberately wrong
            wf.nextWfQuestion();
            const html = screen.innerHTML;
            assert.truthy(html.includes('wf-follow-recap'), 'the check must recap the question');
            const tail = base.q.split('___')[1].trim().split(' ').slice(0, 3).join(' ');
            assert.truthy(html.includes(tail), `the original sentence must be shown again (looking for "${tail}")`);
            assert.truthy(html.includes(`<b class="wf-recap-answer">${base.answer}</b>`), 'the blank is filled with the answer');
            assert.truthy(html.includes(base.options[0]), "the child's own wrong answer is shown back");
            assert.truthy(html.includes('wf-recap-you bad'), 'a wrong answer is marked as wrong');
        } finally {
            wf.abandonWordformQuiz();
            global.document = savedDoc;
        }
    });

    test('a correct answer is recapped as correct, not struck through', () => {
        const screen = { innerHTML: '' };
        const savedDoc = global.document;
        global.document = { getElementById: id => (id === 'wordformScreen' ? screen : null), querySelectorAll: () => [] };
        try {
            const base = BANK.find(q => q.type === 'mcq');
            wf.startWordformReviewQuiz([base.id]);
            wf.answerWfQuestion(base.correct);
            wf.nextWfQuestion();
            assert.truthy(screen.innerHTML.includes('wf-recap-you ok'), 'a correct answer is marked correct');
            assert.truthy(!screen.innerHTML.includes('<s>'), 'nothing to strike through');
        } finally {
            wf.abandonWordformQuiz();
            global.document = savedDoc;
        }
    });

    test('a follow-up is only done when BOTH questions are answered', () => {
        const two = wf.wfFollowupQuestion(BANK.find(q => !FU[q.id].neg));
        assert.falsy(wf.wfFollowDone(two, null));
        assert.falsy(wf.wfFollowDone(two, { m: 0, r: null }));
        assert.falsy(wf.wfFollowDone(two, { m: null, r: 0 }));
        assert.truthy(wf.wfFollowDone(two, { m: 0, r: 3 }));
        // …and all THREE when the answer carries a negative prefix.
        const three = wf.wfFollowupQuestion(BANK.find(q => FU[q.id].neg));
        assert.falsy(wf.wfFollowDone(three, { m: 0, r: 3 }));
        assert.truthy(wf.wfFollowDone(three, { m: 0, r: 3, neg: 1 }));
    });

    test('it scores two points, one per question', () => {
        const f = wf.wfFollowupQuestion(BANK[0]);
        const right = f.m.correct, rightR = f.r.correct;
        const wrongM = (right + 1) % 4;
        assert.equal(wf.wfFollowScore(f, { m: right, r: rightR }), 2);
        assert.equal(wf.wfFollowScore(f, { m: wrongM, r: rightR }), 1);
        assert.equal(wf.wfFollowScore(f, { m: wrongM, r: (rightR + 2) % 4 }), 0);
        assert.equal(wf.wfFollowScore(f, null), 0);
    });

    test('the understanding card reports both checks, and stays away when empty', () => {
        assert.equal(wf.wfUnderstandCardHTML({ count: 0, m: 0, r: 0 }), '');
        assert.equal(wf.wfUnderstandCardHTML(null), '');
        const html = wf.wfUnderstandCardHTML({ count: 10, m: 9, r: 6, negCount: 0, neg: 0 });
        assert.truthy(html.includes('9/10'), 'meaning score missing');
        assert.truthy(html.includes('6/10'), 'reason score missing');
        assert.truthy(html.includes('60%'), 'the reason bar should be 60% wide');
        assert.truthy(!html.includes('phủ định'), 'no prefix row when the practice had no prefix answer');
        // The prefix row counts only the questions that asked — 0/0 is not a score.
        const withNeg = wf.wfUnderstandCardHTML({ count: 10, m: 9, r: 6, negCount: 2, neg: 1 });
        assert.truthy(withNeg.includes('phủ định'), 'prefix row missing');
        assert.truthy(withNeg.includes('1/2'), 'the prefix row is out of the 2 that asked, not 10');
    });
});
