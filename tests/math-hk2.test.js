// math-hk2.test.js — Toán 7 Học kì 2: 5 chương luyện tập, lý thuyết, đề thi.
//
// Học kì 1 dùng chương 1..5, học kì 2 dùng chương 6..10, nên một câu hỏi tự
// nói nó thuộc học kì nào và hai ngân hàng dùng chung được mọi thứ: quiz, lịch
// sử, gợi ý, drill câu sai. Các phép kiểm dưới đây giữ đúng giao ước đó, và
// giữ những luật mà học kì 1 đã phải trả giá mới học được.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const { MATH_CHAPTERS_HK2, MATH_QUESTIONS_HK2 } = require(path.join(root, 'js', 'math-data-hk2.js'));
const { MATH_LESSONS_HK2 } = require(path.join(root, 'js', 'math-lessons-hk2.js'));
const { MATH_EXAMS_HK2 } = require(path.join(root, 'js', 'math-exams-hk2.js'));
const { MATH_SOURCE_EXAMS_HK2 } = require(path.join(root, 'js', 'math-source-exams-hk2.js'));
const { mathQuestionFigureHTML } = require(path.join(root, 'js', 'math-figures.js'));

const CHAPTERS = [6, 7, 8, 9, 10];
const examQs = () => MATH_EXAMS_HK2.flatMap(e => e.questions.map((q, i) => ({ id: `${e.id}#${q.n || i + 1}`, q })));
const practiceQs = () => MATH_QUESTIONS_HK2.map(q => ({ id: q.id, q }));
const allQs = () => practiceQs().concat(examQs());

// A bank that has not been written yet must not make these tests pass by
// having nothing to check — every count assertion below is guarded on this.
const ready = MATH_QUESTIONS_HK2.length > 0;

suite('Toán 7 HK2: chương và ngân hàng luyện tập', () => {
    test('đúng 5 chương VI..X, số hiệu nối tiếp học kì 1', () => {
        assert.deepEqual(MATH_CHAPTERS_HK2.map(c => c.num), CHAPTERS);
        MATH_CHAPTERS_HK2.forEach(c => {
            assert.truthy(String(c.title || '').trim().length > 8, `chương ${c.num}: thiếu tên`);
            assert.truthy(String(c.icon || '').trim(), `chương ${c.num}: thiếu icon`);
        });
        // Số chương phải KHÔNG đụng học kì 1, vì mathChapterQuestions() tra
        // cả hai ngân hàng bằng đúng con số này.
        const hk1 = require(path.join(root, 'js', 'math-data.js')).MATH_CHAPTERS.map(c => c.num);
        assert.deepEqual(hk1.filter(n => CHAPTERS.includes(n)), []);
    });

    test('mỗi chương đủ 100 câu, id duy nhất và đúng khuôn m<chương>-<số>', () => {
        if (!ready) return;
        const seen = new Set();
        CHAPTERS.forEach(ch => {
            const qs = MATH_QUESTIONS_HK2.filter(q => q.ch === ch);
            assert.equal(qs.length, 100, `chương ${ch} phải có 100 câu`);
        });
        assert.equal(MATH_QUESTIONS_HK2.length, 500);
        MATH_QUESTIONS_HK2.forEach(q => {
            assert.truthy(/^m(6|7|8|9|10)-\d+$/.test(q.id), `${q.id}: id sai khuôn`);
            assert.falsy(seen.has(q.id), `${q.id}: id trùng`);
            seen.add(q.id);
            assert.equal(Number(String(q.id).match(/^m(\d+)-/)[1]), q.ch, `${q.id}: id không khớp ch`);
        });
        // và không đụng id của học kì 1
        const hk1Ids = new Set(require(path.join(root, 'js', 'math-data.js')).MATH_QUESTIONS.map(q => q.id));
        MATH_QUESTIONS_HK2.forEach(q => assert.falsy(hk1Ids.has(q.id), `${q.id}: trùng id học kì 1`));
    });
});

suite('Toán 7 HK2: mỗi câu hỏi phải tự đứng được', () => {
    test('122 câu chỉ có một đáp án số đã thành tự nhập, còn lại vẫn là trắc nghiệm', () => {
        if (!ready) return;
        const typed = practiceQs().filter(({ q }) => q.type === 'calc');
        assert.equal(typed.length, 122, 'phải đổi đúng 122 câu đã duyệt');
        assert.deepEqual(
            CHAPTERS.map(ch => typed.filter(({ q }) => q.ch === ch).length),
            [43, 25, 51, 2, 1],
            'số câu tự nhập của từng chương bị lệch'
        );
        typed.forEach(({ id, q }) => {
            assert.truthy(/^[−-]?\d+(?:\/\d+)?$/.test(q.answer), `${id}: đáp án không còn là đúng một số`);
            assert.equal(q.type, 'calc', `${id}: thiếu type calc`);
            assert.deepEqual(q.keys, [], `${id}: câu số không cần hàng phím ký hiệu phụ`);
            assert.falsy(Object.prototype.hasOwnProperty.call(q, 'options'), `${id}: câu tự nhập còn lộ lựa chọn`);
            assert.falsy(Object.prototype.hasOwnProperty.call(q, 'correct'), `${id}: câu tự nhập còn chỉ số lựa chọn`);
        });

        allQs().filter(({ q }) => q.type !== 'calc').forEach(({ id, q }) => {
            assert.truthy(Array.isArray(q.options) && q.options.length === 4, `${id}: không đủ 4 phương án`);
            assert.equal(new Set(q.options).size, 4, `${id}: có phương án trùng nhau`);
            assert.truthy(Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3, `${id}: correct sai`);
            // Sai chỗ này là bé thấy một đáp án nhưng bị chấm theo đáp án khác.
            assert.equal(q.answer, q.options[q.correct], `${id}: answer ≠ options[correct]`);
        });
    });

    test('lời giải nêu quy tắc rồi bác đủ ba phương án sai', () => {
        if (!ready) return;
        allQs().forEach(({ id, q }) => {
            const ex = String(q.explanation || '');
            assert.truthy(ex.startsWith('🔑'), `${id}: lời giải phải mở đầu bằng quy tắc`);
            assert.equal((ex.match(/✗/g) || []).length, 3, `${id}: phải có đúng 3 dòng ✗`);
            assert.falsy(/undefined|null|NaN/.test(ex), `${id}: lời giải lộ undefined/null/NaN`);
        });
    });

    test('nhãn chủ đề không được nói ra đáp án', () => {
        // Ở học kì 1 có 12 câu gắn nhãn "Trường hợp c-g-c" rồi hỏi "bằng nhau
        // theo trường hợp nào" — nhãn hiện ngay trên đầu câu hỏi nên bé chỉ
        // cần đọc nhãn là xong. Không để tái diễn ở học kì 2.
        if (!ready) return;
        const norm = s => String(s).toLowerCase().replace(/[^a-z0-9à-ỹ]+/gi, '');
        const leaks = [];
        allQs().forEach(({ id, q }) => {
            const t = norm(q.topic), a = norm(q.answer), stem = norm(q.q);
            // Đáp án ngắn như "AM" nằm lọt trong "tam giác" của tên chủ đề —
            // đó là trùng chữ cái, không phải lộ đáp án. Đòi cả hai phía đủ dài.
            if (t.length < 5 || a.length < 5 || stem.includes(t)) return;
            if (a.includes(t) || t.includes(a)) leaks.push(id);
        });
        assert.deepEqual(leaks, [], 'nhãn chủ đề trùng đáp án');
    });

    test('không câu nào nhắc tới một hình mà nó không có', () => {
        if (!ready) return;
        const orphans = allQs()
            .filter(({ q }) => !q.fig && /\b(hình vẽ|hình bên|như hình|hình sau)\b/i.test(String(q.q)))
            .map(x => x.id);
        assert.deepEqual(orphans, [], 'câu nhắc tới hình vẽ nhưng không đính hình');
    });
});

suite('Toán 7 HK2: hình vẽ lại, không phải ảnh chụp', () => {
    test('mọi hình đều là đặc tả vẽ được, và không có ảnh chụp trang đề', () => {
        if (!ready) return;
        const figs = allQs().filter(x => x.q.fig);
        figs.forEach(({ id, q }) => {
            assert.falsy(q.fig.t === 'source-crop', `${id}: hình phải được VẼ LẠI, không cắt ảnh`);
            const html = mathQuestionFigureHTML(q.fig);
            assert.truthy(html && html.length > 80, `${id}: hình ${q.fig.t} không vẽ ra gì`);
            assert.falsy(/NaN|undefined/.test(html), `${id}: hình ${q.fig.t} sinh toạ độ hỏng`);
        });
    });

    test('không hai nhãn nào trong một hình chồng lên nhau', () => {
        if (!ready) return;
        const clashes = [];
        allQs().filter(x => x.q.fig).forEach(({ id, q }) => {
            const html = mathQuestionFigureHTML(q.fig);
            const pts = [...html.matchAll(/<text[^>]*x="([\d.-]+)"[^>]*y="([\d.-]+)"[^>]*>([^<]*)</g)]
                .map(m => ({ x: +m[1], y: +m[2], t: m[3].trim() })).filter(p => p.t);
            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < 9) {
                        clashes.push(`${id}: "${pts[i].t}" đè "${pts[j].t}"`);
                    }
                }
            }
        });
        assert.deepEqual(clashes, [], 'nhãn chồng nhau thì hình đọc không ra');
    });
});

suite('Toán 7 HK2: lý thuyết và đề thi', () => {
    test('mỗi chương một bài lý thuyết, gắn đúng số chương', () => {
        if (!MATH_LESSONS_HK2.length) return;
        assert.deepEqual(MATH_LESSONS_HK2.map(l => l.chapter), CHAPTERS);
        MATH_LESSONS_HK2.forEach(l => {
            assert.truthy(/^hk2-ch(6|7|8|9|10)$/.test(l.key), `${l.key}: key sai khuôn`);
            assert.truthy(String(l.content || '').length > 400, `${l.key}: bài quá ngắn`);
            assert.falsy(/undefined|null|NaN/.test(l.content), `${l.key}: nội dung lộ undefined`);
        });
        // Không đụng key của học kì 1.
        const hk1 = require(path.join(root, 'js', 'math-lessons.js')).MATH_LESSONS.map(l => l.key);
        assert.deepEqual(hk1.filter(k => MATH_LESSONS_HK2.some(l => l.key === k)), []);
    });

    test('10 đề thử, mỗi đề cùng một tỉ lệ chương như đề thật', () => {
        if (!MATH_EXAMS_HK2.length) return;
        assert.equal(MATH_EXAMS_HK2.length, 10);
        const want = { 6: 4, 7: 8, 8: 3, 9: 7, 10: 3 };
        MATH_EXAMS_HK2.forEach(e => {
            assert.truthy(/^hk2-exam\d+$/.test(e.id), `${e.id}: id sai khuôn`);
            const by = {};
            e.questions.forEach(q => { by[q.ch] = (by[q.ch] || 0) + 1; });
            assert.deepEqual(by, want, `${e.id}: tỉ lệ chương lệch đề thật`);
            assert.equal(e.questions.length, 25, `${e.id}: phải 25 câu`);
        });
        const ids = MATH_EXAMS_HK2.map(e => e.id);
        assert.equal(new Set(ids).size, ids.length, 'đề trùng id');
    });

    test('đề thi thật của các trường có xuất xứ và không dùng ảnh chụp', () => {
        if (!MATH_SOURCE_EXAMS_HK2.length) return;
        MATH_SOURCE_EXAMS_HK2.forEach(e => {
            assert.truthy(String(e.school || '').trim(), `${e.id}: thiếu tên trường`);
            assert.truthy(String(e.sourceFile || '').endsWith('.pdf'), `${e.id}: thiếu file gốc`);
            e.questions.forEach(q => {
                assert.falsy(q.fig && q.fig.t === 'source-crop',
                    `${e.id}/${q.n}: hình phải VẼ LẠI, không cắt từ ảnh đề`);
            });
        });
    });

    test('đề tự soạn đứng trước, đề của các trường đứng sau', () => {
        if (!MATH_EXAMS_HK2.length || !MATH_SOURCE_EXAMS_HK2.length) return;
        const math = require(path.join(root, 'js', 'math.js'));
        global.MATH_EXAMS_HK2 = MATH_EXAMS_HK2;
        global.MATH_SOURCE_EXAMS_HK2 = MATH_SOURCE_EXAMS_HK2;
        if (typeof math.mathExamsAll === 'function') {
            const ids = math.mathExamsAll().map(e => e.id);
            const firstSource = ids.findIndex(id => MATH_SOURCE_EXAMS_HK2.some(e => e.id === id));
            const lastPractice = ids.map((id, i) => MATH_EXAMS_HK2.some(e => e.id === id) ? i : -1)
                .filter(i => i >= 0).pop();
            assert.truthy(firstSource > lastPractice, 'đề thật phải xếp sau đề tự soạn');
        }
    });
});

suite('Toán 7 HK2: đã nối vào ứng dụng', () => {
    test('bốn ngân hàng đều được nạp lười và có trong bộ nhớ đệm ngoại tuyến', () => {
        const lazy = read('js/lazy-data.js');
        const sw = read('sw.js');
        ['math-data-hk2.js', 'math-exams-hk2.js', 'math-lessons-hk2.js', 'math-source-exams-hk2.js']
            .forEach(f => {
                assert.truthy(lazy.includes(f), `${f}: chưa khai báo trong lazy-data`);
                assert.truthy(sw.includes('/js/' + f), `${f}: chưa precache trong sw.js`);
            });
        // Ngân hàng KHÔNG được nhét vào index.html: đó là cân nặng lúc khởi động.
        const html = read('index.html');
        ['math-data-hk2.js', 'math-exams-hk2.js', 'math-source-exams-hk2.js']
            .forEach(f => assert.falsy(html.includes(f), `${f}: không được nạp sẵn trong index.html`));
    });

    test('đổi tab con KHÔNG được nhảy học kì, và danh sách đề không được rỗng', () => {
        // Hai lỗi thật, chỉ lộ ra khi mở app chứ test cũ không thấy:
        //  1. switchMathSubTab() ép cứng _mathView='hk1', nên bấm Lý thuyết hay
        //     Đề thi trong Học kì 2 là văng ngược về Học kì 1.
        //  2. mathExams() tra ngân hàng qua globalThis['MATH_EXAMS']. Ngân hàng
        //     khai báo bằng `const` ở đầu file script, mà const cấp cao nhất
        //     KHÔNG nằm trên globalThis — danh sách đề của CẢ HAI học kì rỗng.
        const vm = require('vm');
        const ctx = {
            console, Math, Date, String, Array, Object, JSON, Number, RegExp, Set, Map,
            setTimeout, clearTimeout, appState: { coins: 0 }, currentUser: 't', saveUserData() {},
            module: { exports: {} }, window: { addEventListener() {} },
            document: {
                getElementById: () => ({ innerHTML: '', style: {}, scrollTop: 0,
                    classList: { add() {}, remove() {}, contains: () => false } }),
                querySelectorAll: () => [], querySelector: () => null, addEventListener() {},
            },
        };
        vm.createContext(ctx);
        ['math-data.js', 'math-lessons.js', 'math-exams.js', 'math-source-exams.js',
         'math-data-hk2.js', 'math-lessons-hk2.js', 'math-exams-hk2.js', 'math-source-exams-hk2.js',
         'math-figures.js', 'math.js'].forEach(f => {
            try { vm.runInContext(read('js/' + f), ctx); } catch (e) {}
        });
        vm.runInContext('this.snap = () => ({ hk: mathSemester(), bank: mathBank().length,'
            + ' lessons: mathLessons().length, exams: mathExams().length, chapters: mathChapters().map(c => c.num) });', ctx);

        ctx.openMathSection('hk2');
        const hk2 = ctx.snap();
        assert.equal(hk2.hk, 2, 'mở Học kì 2 mà học kì vẫn là 1');
        ['lessons', 'exams', 'practice'].forEach(tab => {
            ctx.switchMathSubTab(tab);
            assert.equal(ctx.snap().hk, 2, `bấm tab ${tab} làm văng khỏi Học kì 2`);
            assert.deepEqual(ctx.snap().chapters, CHAPTERS, `tab ${tab} lấy nhầm chương của học kì 1`);
        });
        // Danh sách đề phải có thật ở CẢ HAI học kì.
        ctx.openMathSection('hk1');
        assert.truthy(ctx.snap().exams > 0, 'danh sách đề học kì 1 rỗng');
        assert.deepEqual(ctx.snap().chapters, [1, 2, 3, 4, 5]);
        ctx.openMathSection('hk2');
        if (MATH_EXAMS_HK2.length) assert.truthy(ctx.snap().exams > 0, 'danh sách đề học kì 2 rỗng');
    });

    test('màn hình học kì 2 mở được và chọn đúng ngân hàng của nó', () => {
        const src = read('js/math.js');
        assert.truthy(/'hk2'/.test(src), 'chưa có view hk2');
        assert.truthy(/function mathSemester\(\)/.test(src), 'chưa có hàm chọn học kì');
        assert.truthy(/MATH_QUESTIONS_HK2/.test(src), 'math.js chưa biết ngân hàng HK2');
        // Tra id phải với sang được học kì kia, nếu không thì drill câu sai và
        // lịch sử sẽ không tìm thấy câu của học kì không đang mở.
        assert.truthy(/function mathBankAll\(\)/.test(src), 'chưa có mathBankAll');
        assert.truthy(/mathBankAll\(\)\.find\(q => q\.id === id\)/.test(src),
            'mathById phải tra cả hai học kì');
    });
});

if (require.main === module) {
    require('./harness').runAll().then(code => process.exit(code));
}
