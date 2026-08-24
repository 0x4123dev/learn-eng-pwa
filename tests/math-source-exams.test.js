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
        assert.equal(figs.length, 20);
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
        });
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
        assert.truthy(index.includes('js/math-source-exams.js'));
        assert.truthy(index.indexOf('js/math-source-exams.js') < index.indexOf('js/math.js'));
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
