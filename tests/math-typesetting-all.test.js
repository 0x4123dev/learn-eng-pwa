// math-typesetting-all.test.js — every visible formula in the complete Math
// experience goes through the same readable fraction/root/mixed-number engine.
const { suite, test, assert } = require('./harness');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const { MATH_QUESTIONS } = require(path.join(root, 'js', 'math-data.js'));
const { MATH_LESSONS } = require(path.join(root, 'js', 'math-lessons.js'));
const { MATH_EXAMS } = require(path.join(root, 'js', 'math-exams.js'));
const { MATH_SOURCE_EXAMS } = require(path.join(root, 'js', 'math-source-exams.js'));
// The "(SGK tr. N)" citation style — the exact string the old sentence-splitter
// tore in half — is written by the HK2 banks, not by the HK1 banks above, so the
// citation guard further down sources a real explanation from there.
const { MATH_QUESTIONS_HK2 } = require(path.join(root, 'js', 'math-data-hk2.js'));
const math = require(path.join(root, 'js', 'math.js'));

const questions = MATH_QUESTIONS.concat(
    MATH_EXAMS.flatMap(e => e.questions),
    MATH_SOURCE_EXAMS.flatMap(e => e.questions)
);
const visible = questions.flatMap(q => [q.q, q.answer].concat(q.options || []))
    .filter(v => v != null).map(String);
const FRACTION = /(?:\([^)]*\)|\|[^|]+\||[−-]?[\dA-Za-zÀ-ỹ]+[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ᵃᵇᶜᵈᵉᵏᵐⁿᵖʳˢᵗᵘᵛʷˣʸᶻ]*)\/(?!\/)(?:\([^)]*\)|\|[^|]+\||[−-]?[\dA-Za-zÀ-ỹ]+)/;

suite('math typesetting: the complete Math bank', () => {
    test('all 662 practice and exam questions render balanced markup', () => {
        assert.equal(questions.length, 662);
        visible.forEach((source, i) => {
            const html = math.mathFormula(source);
            assert.equal((html.match(/<span\b/g) || []).length, (html.match(/<\/span>/g) || []).length,
                `unbalanced span in formula ${i}: ${source}`);
            assert.equal((html.match(/<sup>/g) || []).length, (html.match(/<\/sup>/g) || []).length,
                `unbalanced exponent in formula ${i}: ${source}`);
        });
    });

    test('every fraction-like expression is drawn with a real fraction bar', () => {
        const fractions = visible.filter(s => FRACTION.test(s));
        assert.truthy(fractions.length >= 500, `only ${fractions.length} fraction strings scanned`);
        const missed = fractions.filter(s => !math.mathFormula(s).includes('math-frac'));
        assert.deepEqual(missed.slice(0, 5), [], `${missed.length} fractions remained inline`);
    });

    test('every mixed number is grouped and every square root has a vinculum', () => {
        const mixed = visible.filter(s => /[−-]?\d+\s+\d+\/\d+/.test(s));
        const roots = visible.filter(s => /√(?=[(\dA-Za-zÀ-ỹ])/.test(s));
        assert.truthy(mixed.length >= 12, `only ${mixed.length} mixed-number strings scanned`);
        assert.truthy(roots.length >= 110, `only ${roots.length} radical strings scanned`);
        assert.deepEqual(mixed.filter(s => !math.mathFormula(s).includes('math-mixed')), []);
        assert.deepEqual(roots.filter(s => !math.mathFormula(s).includes('math-root')), []);
    });

    test('all explanations and lesson bodies keep trusted tags and balanced formula markup', () => {
        const rich = questions.map(q => q.explanation).concat(MATH_LESSONS.map(l => l.content)).filter(Boolean);
        rich.forEach((source, i) => {
            const html = math.mathRich(source);
            assert.equal((html.match(/<span\b/g) || []).length, (html.match(/<\/span>/g) || []).length,
                `unbalanced rich formula ${i}`);
            assert.falsy(/&lt;(?:b|br|strong|i|u)&gt;/i.test(html), `trusted tag escaped in rich formula ${i}`);
        });
    });

    test('legacy prose and caret powers render as real raised mathematical exponents', () => {
        const legacy = visible.concat(questions.map(q => q.explanation || ''))
            .filter(s => /(?:[\d)]\s+mũ|\^)\s*\([^()]+\)/i.test(s));
        assert.truthy(legacy.length >= 14, `only ${legacy.length} legacy powers scanned`);
        legacy.forEach(source => {
            const html = math.mathRich(source);
            assert.truthy(html.includes('<sup>'), `power not raised: ${source}`);
            assert.falsy(/[\d)]\s+mũ\s*\(/i.test(html), `prose power still visible: ${source}`);
            assert.falsy(/\^\s*\(/.test(html), `caret power still visible: ${source}`);
        });
    });

    // The panel used to invent its own opening rule and closing conclusion, and
    // to shred the stored explanation into one numbered box per sentence. Both
    // behaviours are gone; this pins what the renderer is allowed to produce now.
    test('all 662 explanations use a readable worked-solution layout', () => {
        const strip = html => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        questions.forEach(q => {
            const id = q.id || q.n;
            const html = math.mathExplanationHTML(q.explanation, q);
            assert.truthy(html.includes('math-explanation-layout'), `missing layout: ${id}`);
            assert.truthy(html.includes('math-solution-steps'), `missing steps: ${id}`);
            // An UNordered list. The cards are the sections a bank chose to
            // write, so a counter down the side implied a step order that was
            // never in the source — the numbers are gone from the CSS too.
            const worked = (html.match(/<ul class="math-solution-steps">([\s\S]*?)<\/ul>/) || [])[1] || '';
            assert.truthy(worked, `solution list is not a <ul>: ${id}`);
            assert.falsy(html.includes('<ol'), `numbered list came back: ${id}`);
            const cards = worked.match(/<li>[\s\S]*?<\/li>/g) || [];
            // One card per section a bank actually writes (Lý thuyết, Lý thuyết
            // 1/2, Áp dụng) — never one per sentence, which is what turned a
            // single paragraph into up to a dozen boxes.
            assert.inRange(cards.length, 1, 3, `card count off (${cards.length}): ${id}`);

            // THE regression guard, and the reason this test exists.
            // mathRuleForQuestion picked a rule by keyword-matching topic + stem
            // against a long if-chain, and the keywords overlap: "dãy tỉ số bằng
            // NHAU" fell into the triangle-congruence branch (/bằng nhau/) and
            // "TỈ LỆ thức" fell into the percentages branch (/tỉ lệ/). The panel
            // then opened with a confidently-worded rule from a different
            // chapter, printed ABOVE the correct stored explanation — the child
            // is taught the wrong thing first. Nothing generated goes here again.
            assert.falsy(html.includes('Quy tắc cần dùng'), `generated rule came back: ${id}`);
            assert.falsy(html.includes('Kết luận:</strong>'), `generated conclusion came back: ${id}`);

            cards.forEach((li, i) => {
                const text = strip(li);
                assert.truthy(text.length > 0, `empty card ${i}: ${id}`);
                // The old splitter left cards that read "(SGK tr", then "5)",
                // and — because it also made one card per <br> row — a card
                // holding nothing but the words "Bước 2 —". A card is never
                // just its own label with the content split off the end of it.
                assert.falsy(/^(?:Bước\s*\d+|Lý thuyết\s*\d*|Áp dụng)\s*[—–:.-]*$/i.test(text),
                    `card ${i} is a bare label ("${text}"): ${id}`);
                // "(SGK tr. 5)" broke at the ". " in the middle of the citation.
                assert.falsy(/\btr\.?$/.test(text),
                    `card ${i} ends mid-citation ("${text.slice(-24)}"): ${id}`);
                assert.falsy(/^\d+\)/.test(text),
                    `card ${i} opens with a citation tail ("${text.slice(0, 24)}"): ${id}`);
            });
            // A card can only BE a fragment when the explanation was split at
            // all: a lone card is the whole stored text. A few banks store a
            // genuinely terse one-liner ("🔑 √81 = 9." — 8 visible characters),
            // so the 12-character floor applies to split explanations only.
            if (cards.length > 1) {
                cards.forEach((li, i) => assert.truthy(strip(li).length >= 12,
                    `card ${i} too short to be a section ("${strip(li)}"): ${id}`));
            }
            assert.falsy(html.includes('🔑'), `key emoji leaked: ${id}`);
            assert.falsy(html.includes('✗'), `cross emoji leaked: ${id}`);
        });
    });

    // "(SGK tr. 5)" is precisely where the old sentence-splitter cut: it broke
    // at the ". " inside the citation, so one card ended "(SGK tr" and the next
    // opened "5)". Only the reasoning rows matter here — a citation inside a ✗
    // row belongs to the mistakes section by design, not to a solution card.
    test('every "(SGK tr. N)" citation stays whole inside a single card', () => {
        const reasoningOf = source => String(source || '').split(/<br\s*\/?\s*>/i)
            .filter(row => !/^\s*✗/u.test(row.trim())).join(' ');
        const cited = MATH_QUESTIONS_HK2
            .filter(q => /\(SGK tr\.\s*\d+\)/.test(reasoningOf(q.explanation)));
        assert.truthy(cited.length >= 100, `only ${cited.length} explanations cite (SGK tr. N)`);
        cited.forEach(q => {
            const html = math.mathExplanationHTML(q.explanation, q);
            const worked = (html.match(/<ul class="math-solution-steps">([\s\S]*?)<\/ul>/) || [])[1] || '';
            const texts = (worked.match(/<li>[\s\S]*?<\/li>/g) || [])
                .map(li => li.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim());
            reasoningOf(q.explanation).match(/\(SGK tr\.\s*\d+\)/g).forEach(cite => {
                assert.truthy(texts.some(text => text.includes(cite)),
                    `citation ${cite} split across cards: ${q.id}`);
            });
        });
    });

    // Both helpers were DELETED rather than left in place unwired, so that
    // nobody re-attaches a rule picked by keyword guessing later. Gone from the
    // module surface AND from the source text — an unused function sitting in
    // the file is an invitation to call it again.
    test('the invented rule and conclusion helpers are gone from math.js', () => {
        assert.equal(math.mathRuleForQuestion, undefined, 'mathRuleForQuestion is still exported');
        assert.equal(math.mathConclusionForQuestion, undefined, 'mathConclusionForQuestion is still exported');
        const src = fs.readFileSync(path.join(root, 'js', 'math.js'), 'utf8');
        assert.falsy(src.includes('mathRuleForQuestion'), 'mathRuleForQuestion still present in js/math.js');
        assert.falsy(src.includes('mathConclusionForQuestion'), 'mathConclusionForQuestion still present in js/math.js');
    });

    // The grouping rule itself: a card opens at a label the BANK wrote, and
    // everything under that label stays together. mathSolutionSteps is internal
    // (not on module.exports), so this drives it through the exported renderer.
    test('solution cards group at bank labels and nowhere else', () => {
        const cards = source => {
            const html = math.mathExplanationHTML(source, {});
            const worked = (html.match(/<ul class="math-solution-steps">([\s\S]*?)<\/ul>/) || [])[1] || '';
            return (worked.match(/<li>[\s\S]*?<\/li>/g) || []).map(li => ({
                title: (li.match(/<div class="math-step-title">([\s\S]*?)<\/div>/) || [])[1] || '',
                body: li.replace(/<div class="math-step-title">[\s\S]*?<\/div>/, '')
                    .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim(),
            }));
        };

        // Two labels, two cards, each carrying its section name as the title.
        const labelled = cards('🔑 <b>Lý thuyết:</b> Hai góc đối đỉnh thì bằng nhau.<br>🔑 <b>Áp dụng:</b> Vậy ∠A = ∠B = 40°.');
        assert.equal(labelled.length, 2, 'each bank label should open exactly one card');
        assert.deepEqual(labelled.map(c => c.title), ['Lý thuyết', 'Áp dụng'],
            'section names should reach math-step-title');
        assert.deepEqual(labelled.map(c => c.body),
            ['Hai góc đối đỉnh thì bằng nhau.', 'Vậy ∠A = ∠B = 40°.']);

        // The numbered variants the banks also write.
        const numbered = cards('🔑 <b>Lý thuyết 1:</b> Định nghĩa.<br>🔑 <b>Lý thuyết 2:</b> Dấu hiệu.<br>🔑 <b>Áp dụng:</b> Xong việc.');
        assert.deepEqual(numbered.map(c => c.title), ['Lý thuyết 1', 'Lý thuyết 2', 'Áp dụng']);

        // The older banks store one bare 🔑 sentence with no label at all: that
        // is one unlabelled card holding the whole thing — not zero, not three.
        const bare = cards('🔑 √81 = 9.');
        assert.equal(bare.length, 1, 'an unlabelled explanation is a single card');
        assert.equal(bare[0].title, '', 'there is no section name to show');
        assert.equal(bare[0].body, '√81 = 9.', 'the whole text is the body');

        // The point of the whole change: <br> rows are line breaks, not section
        // boundaries. "Bước 1 …<br>Bước 2 …<br>Bước 3 …" under one Áp dụng is
        // ONE worked example and a reader wants it in one place; it used to
        // arrive as three cards, one of which read only "Bước 2 —".
        const steps = cards('🔑 <b>Áp dụng:</b><br><b>Bước 1 — Tách dữ kiện.</b> OA = OB = OC.<br><b>Bước 2 — Xét từng cạnh.</b> Từ OA = OB.<br><b>Bước 3 — Kết luận.</b> Xong việc.');
        assert.equal(steps.length, 1, 'three Bước rows under one label stay in one card');
        assert.equal(steps[0].title, 'Áp dụng');
        ['Bước 1', 'Bước 2', 'Bước 3'].forEach(step =>
            assert.truthy(steps[0].body.includes(step), `${step} fell out of its card`));

        // 🔑 opens EVERY reasoning row in the banks, so once the rows are
        // rejoined there is one mid-paragraph as well as the leading one —
        // none of them may reach the screen.
        [labelled, numbered, bare, steps].forEach(set => set.forEach(card => {
            assert.falsy(card.title.includes('🔑'), `key emoji in card title: ${card.title}`);
            assert.falsy(card.body.includes('🔑'), `key emoji in card body: ${card.body}`);
        }));
    });
});
