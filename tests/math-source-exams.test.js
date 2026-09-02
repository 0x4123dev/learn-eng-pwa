// math-source-exams.test.js — five real HK1 papers supplied as PDFs.
// These checks protect the transcription, original figures, untimed exam mode
// and the one malformed source question that must never penalise a child.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const { MATH_SOURCE_EXAMS } = require(path.join(root, 'js', 'math-source-exams.js'));
const { mathQuestionFigureHTML } = require(path.join(root, 'js', 'math-figures.js'));
const math = require(path.join(root, 'js', 'math.js'));

suite('math source exams: five supplied papers', () => {
    test('HK1 1..5 keep the source school, order and question counts', () => {
        const counts = [19, 13, 17, 19, 14];
        const schools = ['Trần Quý Cáp', 'Phạm Hữu Lầu', 'An Điền', 'Tương Bình Hiệp', 'Lý Thánh Tông'];
        assert.equal(MATH_SOURCE_EXAMS.length, 5);
        MATH_SOURCE_EXAMS.forEach((exam, i) => {
            assert.equal(exam.title, `HK1 ${i + 1}`);
            assert.truthy(exam.school.includes(schools[i]), `${exam.id}: wrong school`);
            assert.truthy(exam.sourceFile.endsWith('.pdf'), `${exam.id}: missing PDF provenance`);
            assert.equal(exam.questions.length, counts[i], `${exam.id}: wrong count`);
            assert.falsy(Object.prototype.hasOwnProperty.call(exam, 'durationMin'), `${exam.id}: must stay untimed`);
            exam.questions.forEach((q, k) => assert.equal(q.n, k + 1, `${exam.id}: order broken`));
        });
    });

    test('all 82 transcribed questions have unique ids and worked answers', () => {
        const all = MATH_SOURCE_EXAMS.flatMap(e => e.questions);
        assert.equal(all.length, 82);
        assert.equal(new Set(all.map(q => q.id)).size, 82, 'duplicate question id');
        all.forEach(q => {
            assert.truthy(String(q.q || '').length >= 12, `${q.id}: short stem`);
            assert.truthy(String(q.topic || '').trim(), `${q.id}: missing section/points`);
            assert.truthy(String(q.answer || '').trim(), `${q.id}: missing answer`);
            assert.truthy(String(q.explanation || '').startsWith('🔑'), `${q.id}: missing solution`);
        });
    });

    test('multiple choice and written questions use the right grading shape', () => {
        const all = MATH_SOURCE_EXAMS.flatMap(e => e.questions);
        const mcq = all.filter(q => q.type !== 'written');
        const written = all.filter(q => q.type === 'written');
        assert.equal(mcq.length, 52);
        assert.equal(written.length, 30);
        mcq.forEach(q => {
            assert.equal(q.options.length, 4, `${q.id}: not four options`);
            if (!q.sourceIssue) assert.equal(q.answer, q.options[q.correct], `${q.id}: key mismatch`);
        });
        written.forEach(q => {
            assert.truthy(math.mathIsTyped(q), `${q.id}: must use the maths keypad`);
            assert.falsy(math.mathIsWritten(q), `${q.id}: must not use self-assessment`);
            assert.truthy(Array.isArray(q.answerParts) && q.answerParts.length > 0,
                `${q.id}: missing checkable final-result fields`);
            const exact = q.answerParts.map(part => part.answer);
            assert.truthy(math.mathIsCorrect(q, exact), `${q.id}: its own answers do not pass`);
            const wrong = exact.slice();
            wrong[0] += '999';
            assert.falsy(math.mathIsCorrect(q, wrong), `${q.id}: a wrong result passed`);
        });
    });

    test('the malformed source chart question explains 9% and never costs a point', () => {
        const issue = MATH_SOURCE_EXAMS.flatMap(e => e.questions).filter(q => q.sourceIssue);
        assert.equal(issue.length, 1);
        assert.equal(issue[0].id, 's1-12');
        assert.equal(issue[0].correct, null);
        assert.truthy(/9%/.test(issue[0].answer));
        [0, 1, 2, 3].forEach(choice => assert.truthy(math.mathIsCorrect(issue[0], choice)));
    });
});

suite('math source exams: original figures and app wiring', () => {
    test('every crop stays inside a real cached source-page image', () => {
        const figs = MATH_SOURCE_EXAMS.flatMap(e => e.questions).filter(q => q.fig);
        assert.equal(figs.length, 22);
        figs.forEach(q => {
            const fig = q.fig;
            assert.equal(fig.t, 'source-crop', `${q.id}: wrong figure type`);
            assert.truthy(fs.existsSync(path.join(root, fig.src.replace(/^\//, ''))), `${q.id}: image missing`);
            const [W, H] = fig.size;
            const [x, y, w, h] = fig.crop;
            assert.truthy(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= W && y + h <= H,
                `${q.id}: crop outside ${W}x${H}`);
            const html = mathQuestionFigureHTML(fig);
            assert.truthy(html.includes('math-source-crop'), `${q.id}: crop did not render`);
            assert.truthy(html.includes(fig.alt), `${q.id}: no accessible description`);
            assert.truthy(html.includes(`width="${W}"`) && html.includes(`height="${H}"`),
                `${q.id}: source image has no intrinsic dimensions`);
            assert.truthy(html.includes('loading="eager"'), `${q.id}: Safari-unsafe lazy source image`);
            assert.falsy(html.includes('loading="lazy"'), `${q.id}: source image can render as a blank crop`);
        });
    });

    test('every source question that depends on a supplied figure or table keeps it', () => {
        const requiredFigureIds = [
            's1-12', 's1-15', 's1-16',
            's2-5', 's2-7', 's2-8', 's2-11', 's2-12',
            's3-10', 's3-12', 's3-17',
            's4-6', 's4-8', 's4-16', 's4-17', 's4-18',
            's5-6', 's5-7', 's5-8', 's5-11', 's5-13', 's5-14'
        ];
        const byId = new Map(MATH_SOURCE_EXAMS.flatMap(e => e.questions).map(q => [q.id, q]));
        requiredFigureIds.forEach(id => {
            assert.truthy(byId.get(id), `${id}: source question missing`);
            assert.truthy(byId.get(id).fig, `${id}: required source figure/table missing`);
        });
        const actual = [...byId.values()].filter(q => q.fig).map(q => q.id).sort();
        assert.deepEqual(actual, requiredFigureIds.slice().sort(), 'figure inventory changed without audit');
    });

    test('audited geometry crops keep the complete diagram and exclude neighbouring questions', () => {
        const byId = new Map(MATH_SOURCE_EXAMS.flatMap(e => e.questions).map(q => [q.id, q]));
        // The old box started at y=175 and ran 355 tall, which swept in
        // "C. Học bài. D. Chơi bóng đá." from the question above and a sliced
        // "ệ là" from the line below — the child saw two other questions'
        // words wrapped around their pie chart.
        assert.deepEqual(byId.get('s1-12').fig.crop, [534, 240, 436, 262],
            's1-12 must show the pie and its legend and NOTHING of the neighbouring questions');
        assert.deepEqual(byId.get('s2-12').fig.crop, [690, 865, 400, 270],
            's2-12 must show A, B, C, D, x, y, z and all three numbered angles');
        assert.deepEqual(byId.get('s3-12').fig.crop, [590, 430, 400, 260],
            's3-12 must show both parallel lines, x and the 60° angle');
        // The old box cut the prism's leftmost vertex flush off the edge and
        // left 150px of blank paper on the right, so the diagram rendered tiny.
        assert.deepEqual(byId.get('s5-13').fig.crop, [492, 806, 285, 210],
            's5-13 must show the whole prism and all four measurements');
        // The old box started right of the "m" label, so the figure named only
        // n while the question asks the child to prove m // n.
        assert.deepEqual(byId.get('s5-14').fig.crop, [525, 1035, 460, 300],
            's5-14 must show BOTH line names m and n');
    });

    test('the two angles a corresponding-angle slip got wrong stay corrected', () => {
        // Both shipped wrong for months, and both cost the child a mark while
        // telling them a false rule. They are pinned here because neither is
        // derivable from the question text alone — you have to read where the
        // numbered label actually sits on the scanned figure.
        const byId = new Map(MATH_SOURCE_EXAMS.flatMap(e => e.questions).map(q => [q.id, q]));

        // s2-12: label 3 sits RIGHT of the transversal and above BC, exactly as
        // D₂ sits right of it and above AD, so they are ĐỒNG VỊ and equal. The
        // old answer called them trong cùng phía and said 108°.
        const c3 = byId.get('s2-12').answerParts.find(p => p.label.includes('∠C₃'));
        assert.equal(c3.answer, '72', 's2-12: ∠C₃ is corresponding to ∠D₂, not co-interior');
        assert.truthy(/đồng vị/i.test(byId.get('s2-12').explanation),
            's2-12: the explanation must name the rule it actually uses');
        assert.falsy(/trong cùng phía/i.test(byId.get('s2-12').explanation),
            's2-12: the co-interior claim was the bug');

        // s5-14: label 3 sits BELOW n on the same side as label 1 above it, so
        // ∠D₃ is a linear pair with ∠D₁. The old answer called them đối đỉnh
        // and said 60°; the angle vertical to ∠D₁ is ∠D₂, which is not asked.
        const d3 = byId.get('s5-14').answerParts.find(p => p.label.includes('∠D₃'));
        assert.equal(d3.answer, '120', 's5-14: ∠D₃ is kề bù with ∠D₁, not đối đỉnh');
        assert.truthy(/kề bù/i.test(byId.get('s5-14').explanation),
            's5-14: the explanation must name the rule it actually uses');
    });

    test('a terminating decimal is explained by the 2-and-5 rule, not by "one prime"', () => {
        // The old wording said 8 = 2³ "chỉ có thừa số nguyên tố 2", which reads
        // as though having a single prime factor were the test — and then 27 =
        // 3³ would qualify too. The child asked exactly that question.
        const q = MATH_SOURCE_EXAMS.flatMap(e => e.questions).find(x => x.id === 's2-2');
        assert.truthy(/2 và\/hoặc 5/.test(q.explanation), 's2-2: must state the real rule');
        assert.truthy(/27/.test(q.explanation) && /vô hạn tuần hoàn/.test(q.explanation),
            's2-2: must say why a denominator of 27 is NOT terminating');
    });

    test('the five source papers appear after the ten practice papers', () => {
        global.MATH_SOURCE_EXAMS = MATH_SOURCE_EXAMS;
        const exams = math.mathExams();
        assert.equal(exams.length, 15);
        assert.deepEqual(exams.slice(-5).map(e => e.title), ['HK1 1', 'HK1 2', 'HK1 3', 'HK1 4', 'HK1 5']);
        assert.equal(math.mathById('s5-14').id, 's5-14', 'source misses must remain resolvable in review');
    });

    test('written work points to the whiteboard and shows ordered answer fields', () => {
        const q = MATH_SOURCE_EXAMS[1].questions.find(x => x.id === 's2-10');
        const html = math.mathAnswerPartsHTML(q, null);
        assert.truthy(/math-answer-parts/.test(html));
        assert.equal((html.match(/math-answer-part /g) || []).length, q.answerParts.length);
        assert.truthy(/Nghiệm âm/.test(html) && /Nghiệm dương/.test(html));
        assert.truthy(MATH_SOURCE_EXAMS.flatMap(e => e.questions)
            .filter(x => x.type === 'written').every(x => /bảng nháp/i.test(x.workNote)));
    });

    test('the bank and every source image load offline before math.js', () => {
        const index = read('index.html');
        const sw = read('sw.js');
        // Deferred with the rest of the maths banks (js/lazy-data.js), still
        // cached for offline use.
        assert.falsy(index.includes('<script src="js/math-source-exams.js"></script>'),
            'the source-exam bank must not block the first paint');
        const lazy = read('js/lazy-data.js');
        const block = lazy.slice(lazy.indexOf('mathHubScreen:'));
        assert.truthy(block.slice(0, block.indexOf(']')).includes('js/math-source-exams.js'),
            'it must be listed under mathHubScreen in the loader');
        assert.truthy(sw.includes("'/js/math-source-exams.js'"));
        const images = new Set(MATH_SOURCE_EXAMS.flatMap(e => e.questions)
            .filter(q => q.fig).map(q => q.fig.src));
        images.forEach(src => assert.truthy(sw.includes(`'${src}'`), `${src}: not cached`));
    });

    test('the production bundle includes the source-page image directory', () => {
        const deploy = read('scripts/deploy.sh');
        assert.truthy(/cp -R[^\n]*\bassets\b[^\n]*\.cf-dist\//.test(deploy),
            'deploy.sh leaves assets/math-exams out of the Pages bundle');
    });
});
