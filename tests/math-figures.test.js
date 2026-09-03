// math-figures.test.js — hình vẽ đi kèm mỗi khái niệm trong bảng "💡 Gợi ý".
//
// Một định nghĩa hình học sai một nét thì tệ hơn là không có hình: bé tin cái
// hình trước khi tin câu chữ. Nên bài test này canh hai thứ mà mắt người dễ
// bỏ sót khi sửa toạ độ — hình nào cũng phải CÓ, và mọi nét phải nằm TRONG
// khung 200×120, không thò ra ngoài rồi bị cắt cụt trên máy bé.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { MATH_QUESTIONS } = require(path.join(root, 'js', 'math-data.js'));
const { MATH_GLOSSARY } = require(path.join(root, 'js', 'math-glossary.js'));
const { MATH_EXAMS } = require(path.join(root, 'js', 'math-exams.js'));
const { MATH_FIGURES, mathFigureHTML, MATH_Q_FIGURES, mathQuestionFigureHTML } = require(path.join(root, 'js', 'math-figures.js'));

global.MATH_QUESTIONS = MATH_QUESTIONS;
global.MATH_GLOSSARY = MATH_GLOSSARY;
global.MATH_EXAMS = MATH_EXAMS;
global.MATH_FIGURES = MATH_FIGURES;
global.mathFigureHTML = mathFigureHTML;
global.mathQuestionFigureHTML = mathQuestionFigureHTML;
global.appState = { coins: 0, mathHistory: [] };
global.currentUser = 'tester';
global.saveUserData = () => {};
global.document = { getElementById: () => null, querySelectorAll: () => [] };
const math = require(path.join(root, 'js', 'math.js'));

const W = 200, H = 120, PAD = 2;   // khung vẽ, cộng chút mép cho nét dày

// Mọi toạ độ có trong một hình: thuộc tính x/y, points của polygon/polyline,
// và các điểm trong đường path (M, L, và điểm cuối của cung A).
function coordsOf(svg) {
  const pts = [];
  const attr = (re, fn) => { let m; while ((m = re.exec(svg))) fn(m); };
  attr(/<line[^>]*x1="(-?[\d.]+)"\s*y1="(-?[\d.]+)"\s*x2="(-?[\d.]+)"\s*y2="(-?[\d.]+)"/g, m => {
    pts.push([+m[1], +m[2]], [+m[3], +m[4]]);
  });
  attr(/<circle[^>]*cx="(-?[\d.]+)"[^>]*cy="(-?[\d.]+)"/g, m => pts.push([+m[1], +m[2]]));
  attr(/<(?:polygon|polyline)[^>]*points="([^"]+)"/g, m => {
    m[1].trim().split(/\s+/).forEach(p => {
      const xy = p.split(',');
      if (xy.length === 2) pts.push([+xy[0], +xy[1]]);
    });
  });
  attr(/<rect[^>]*x="(-?[\d.]+)"[^>]*y="(-?[\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/g, m => {
    pts.push([+m[1], +m[2]], [+m[1] + +m[3], +m[2] + +m[4]]);
  });
  attr(/<text[^>]*x="(-?[\d.]+)"[^>]*y="(-?[\d.]+)"/g, m => pts.push([+m[1], +m[2]]));
  attr(/<path[^>]*d="([^"]+)"/g, m => {
    const t = m[1].trim().split(/[\s,]+/);
    for (let i = 0; i < t.length; i++) {
      if (t[i] === 'M' || t[i] === 'L') { pts.push([+t[i + 1], +t[i + 2]]); i += 2; }
      else if (t[i] === 'A') { pts.push([+t[i + 6], +t[i + 7]]); i += 7; }
    }
  });
  return pts;
}

suite('math figures: every geometry hint carries a drawing', () => {
    test('all 30 glossary entries point at a figure that exists', () => {
        const missing = MATH_GLOSSARY.filter(e => !e.f || !MATH_FIGURES[e.f]);
        assert.deepEqual(missing.map(e => e.t), [], 'these terms have no drawing');
        assert.equal(MATH_GLOSSARY.length, 30);
    });

    test('no orphan figures — every drawing belongs to a term', () => {
        const orphans = Object.keys(MATH_FIGURES).filter(k => !MATH_GLOSSARY.some(e => e.f === k));
        assert.deepEqual(orphans, [], 'drawings nothing links to');
    });

    test('figure ids are unique per term, so two terms never share one picture', () => {
        const ids = MATH_GLOSSARY.map(e => e.f);
        assert.equal(new Set(ids).size, ids.length, 'two terms reuse the same drawing');
    });
});

suite('math figures: the drawings themselves', () => {
    test('each is one self-contained SVG on the same 200×120 canvas', () => {
        Object.keys(MATH_FIGURES).forEach(id => {
            const svg = MATH_FIGURES[id];
            assert.truthy(/^<svg /.test(svg) && /<\/svg>$/.test(svg), `${id}: not a single svg`);
            assert.truthy(svg.indexOf('viewBox="0 0 200 120"') > 0, `${id}: wrong canvas`);
            assert.equal((svg.match(/<svg /g) || []).length, 1, `${id}: more than one svg`);
        });
    });

    test('nothing is loaded from outside — no images, fonts or scripts', () => {
        Object.keys(MATH_FIGURES).forEach(id => {
            const svg = MATH_FIGURES[id];
            assert.truthy(!/<script|<image|<foreignObject|xlink:href|url\(|https?:/i.test(svg),
                `${id}: reaches outside the file`);
        });
    });

    test('every stroke stays inside the canvas — nothing is clipped on a phone', () => {
        const out = [];
        Object.keys(MATH_FIGURES).forEach(id => {
            coordsOf(MATH_FIGURES[id]).forEach(p => {
                if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])
                    || p[0] < -PAD || p[0] > W + PAD || p[1] < -PAD || p[1] > H + PAD) {
                    out.push(`${id} @ ${p[0]},${p[1]}`);
                }
            });
        });
        assert.deepEqual(out.slice(0, 5), [], `${out.length} points fall off the canvas`);
    });

    test('no caption is long enough to be clipped by the canvas', () => {
        // Chữ trong hình được căn giữa: dài quá là mất luôn cả hai đầu, và bé
        // đọc được đúng khúc giữa của một câu không còn nghĩa gì.
        const over = [];
        Object.keys(MATH_FIGURES).forEach(id => {
            (MATH_FIGURES[id].match(/class="mf-t mf-cap"[^>]*>([^<]+)</g) || []).forEach(m => {
                const txt = m.replace(/.*>/, '').replace(/</, '');
                if ([...txt].length > 36) over.push(`${id}: "${txt}" (${[...txt].length})`);
            });
        });
        assert.deepEqual(over, [], 'these captions run off the drawing');
    });

    test('every figure actually draws something, not just captions', () => {
        Object.keys(MATH_FIGURES).forEach(id => {
            const marks = (MATH_FIGURES[id].match(/<(line|path|polygon|polyline|circle|rect)\b/g) || []).length;
            assert.truthy(marks >= 3, `${id}: only ${marks} marks — that is not a drawing`);
        });
    });

    test('only plain SVG shapes are used, and every tag is closed', () => {
        const allowed = ['svg', 'line', 'path', 'polygon', 'polyline', 'circle', 'rect', 'text'];
        Object.keys(MATH_FIGURES).forEach(id => {
            const svg = MATH_FIGURES[id];
            (svg.match(/<\/?([a-zA-Z]+)/g) || []).forEach(t => {
                const name = t.replace(/[<\/]/g, '');
                assert.truthy(allowed.indexOf(name) >= 0, `${id}: unexpected <${name}>`);
            });
            assert.equal((svg.match(/<text/g) || []).length, (svg.match(/<\/text>/g) || []).length,
                `${id}: an unclosed <text>`);
        });
    });
});

suite('math figures: on the hint panel', () => {
    test('an unknown or missing id draws nothing instead of breaking the panel', () => {
        assert.equal(mathFigureHTML(''), '');
        assert.equal(mathFigureHTML('khong-co-hinh-nay'), '');
    });

    test('a known id comes back wrapped and ready to drop into the card', () => {
        const html = mathFigureHTML('so-le-trong');
        assert.truthy(html.indexOf('math-hint-figwrap') > 0, 'no wrapper');
        assert.truthy(html.indexOf('<svg') > 0, 'no drawing');
    });

    test('opening a hint shows the picture above the words', () => {
        const q = MATH_QUESTIONS.find(x => /so le trong/i.test(x.q) || /so le trong/i.test(x.topic || ''));
        assert.truthy(q, 'no so-le-trong question to hang the test on');
        math.toggleMathHint();                       // mở bảng
        try {
            const html = math.mathHintHTML(q);
            assert.truthy(html.indexOf('<svg') > 0, 'the open panel carries no drawing');
            assert.truthy(html.indexOf('math-hint-figwrap') < html.indexOf('math-hint-def'),
                'the drawing must come before the definition');
        } finally { math.toggleMathHint(); }
    });

    test('the drawings ship with the app: loaded on the page and cached offline', () => {
        const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
        assert.truthy(idx.indexOf('js/math-figures.js') > 0, 'index.html never loads the figures');
        assert.truthy(sw.indexOf("'/js/math-figures.js'") > 0, 'the figures are not cached offline');
        assert.truthy(idx.indexOf('js/math-figures.js') < idx.indexOf('js/math.js'),
            'math.js must load after the figures it draws with');
    });
});

// ---- hình của ĐỀ BÀI ---------------------------------------------------
// Hình vẽ sai một nét thì bé giải sai cả bài mà không hiểu vì sao, nên ba
// điều dưới đây được canh bằng máy chứ không bằng mắt: hình phải nằm trong
// khung, nhãn không được đè lên nhau, và — quan trọng nhất — hình không được
// ghi sẵn đáp án.
const WITH_FIG = MATH_QUESTIONS.filter(q => q.fig);

function textsOf(svg) {
    return (svg.match(/<text[^>]*x="(-?[\d.]+)"[^>]*y="(-?[\d.]+)"[^>]*>([^<]*)</g) || []).map(t => {
        const m = /x="(-?[\d.]+)"[^>]*y="(-?[\d.]+)"[^>]*>([^<]*)/.exec(t);
        return { x: +m[1], y: +m[2], s: m[3] };
    });
}

suite('math figures: the drawing that comes with the question', () => {
    test('every Chương 3 and 4 question that can be drawn has a drawing', () => {
        const ch34 = MATH_QUESTIONS.filter(q => q.ch === 3 || q.ch === 4);
        assert.equal(ch34.length, 119, 'chapter sizes moved — recheck which questions need a figure');
        // Năm câu còn lại là loại vẽ ra sẽ lộ đáp án (m3-6, m3-16, m3-42) hoặc
        // không có gì để vẽ (m3-51 chọn mệnh đề nào là định lí, m4-10 chọn bộ
        // ba số). Cố vẽ cho đủ 119 là làm hỏng chính năm câu đó.
        const bare = ch34.filter(q => !q.fig).map(q => q.id).sort();
        assert.deepEqual(bare, ['m3-16', 'm3-42', 'm3-51', 'm3-6', 'm4-10'].sort());
        assert.truthy(WITH_FIG.length >= 114, `only ${WITH_FIG.length} questions carry a figure`);
    });

    test('no chapter outside 3, 4 and 5 carries one — the tab is not an art gallery', () => {
        const stray = WITH_FIG.filter(q => q.ch !== 3 && q.ch !== 4 && q.ch !== 5).map(q => q.id);
        assert.deepEqual(stray, []);
    });

    test('Chương 5 reads a real chart, the way the đề thi does', () => {
        // Một câu "đọc biểu đồ" mà kể số liệu bằng lời thì bé không hề đọc
        // biểu đồ nào — nó thành bài cộng trừ. Ngân hàng luyện tập phải cho
        // xem hình đúng như mười đề thi thử đang làm.
        const ch5 = WITH_FIG.filter(q => q.ch === 5);
        assert.truthy(ch5.length >= 13, `only ${ch5.length} chapter-5 questions draw their chart`);
        const wrong = ch5.filter(q => q.fig.t !== 'pie-chart' && q.fig.t !== 'line-chart').map(q => q.id);
        assert.deepEqual(wrong, [], 'a Chương 5 figure is a chart, not a geometry drawing');
        // Hai câu cố tình KHÔNG có hình: m5-40 hỏi tổng các phần trăm (vẽ ra
        // là cộng lên thành đáp án) và m5-42 nói về một biểu đồ SAI, tổng mới
        // 90% — khuôn pie-chart luôn khép kín vòng tròn nên không tả được nó.
        const bare = MATH_QUESTIONS
            .filter(q => q.ch === 5 && !q.fig && /^(Đọc biểu đồ|Phân tích bảng)/.test(q.topic || ''))
            .map(q => q.id).sort();
        assert.deepEqual(bare, ['m5-40', 'm5-42']);
    });

    test('every fig names a template that exists and actually draws', () => {
        WITH_FIG.forEach(q => {
            assert.truthy(MATH_Q_FIGURES[q.fig.t], `${q.id}: unknown template "${q.fig.t}"`);
            const html = mathQuestionFigureHTML(q.fig);
            assert.truthy(html.indexOf('<svg') > 0, `${q.id}: template drew nothing`);
        });
    });

    test('THE RULE: a figure states the question, never the answer', () => {
        // Con số duy nhất được phép ghi lên hình là con số đề đã cho. Ghi thêm
        // con số phải tìm là biến bài toán thành bài chép lại.
        const leaks = [];
        WITH_FIG.forEach(q => {
            textsOf(mathQuestionFigureHTML(q.fig)).forEach(t => {
                // Chỉ soi nhãn mang SỐ ĐO (có ° hoặc cm). "∠1", "∠3", "2x" là
                // tên gọi và ẩn số, không phải con số đề cho.
                if (!/°|cm/.test(t.s)) return;
                (t.s.match(/\d+/g) || []).forEach(n => {
                    if (q.q.indexOf(n) === -1) leaks.push(`${q.id}: figure says "${t.s}" but the question never mentions ${n}`);
                });
            });
        });
        assert.deepEqual(leaks.slice(0, 5), [], `${leaks.length} figure(s) put a number on screen that the question did not give`);
    });

    test('nothing is drawn outside the canvas, captions and labels included', () => {
        const out = [];
        WITH_FIG.forEach(q => {
            coordsOf(mathQuestionFigureHTML(q.fig)).forEach(p => {
                if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])
                    || p[0] < -PAD || p[0] > W + PAD || p[1] < -PAD || p[1] > H + PAD) {
                    out.push(`${q.id} (${q.fig.t}) @ ${p[0]},${p[1]}`);
                }
            });
        });
        assert.deepEqual([...new Set(out)].slice(0, 5), [], `${out.length} points fall off the canvas`);
    });

    test('no two labels land on top of each other', () => {
        // "25°" in lên "25°" đọc thành một số thứ ba — lỗi này mắt bỏ sót rất dễ
        // khi chỉnh toạ độ, nên để máy canh.
        const clash = [];
        const check = (name, svg) => {
            const L = textsOf(svg);
            for (let i = 0; i < L.length; i++) {
                for (let j = i + 1; j < L.length; j++) {
                    const d = Math.hypot(L[i].x - L[j].x, L[i].y - L[j].y);
                    if (d < 12) clash.push(`${name}: "${L[i].s}" over "${L[j].s}" (${d.toFixed(1)} apart)`);
                }
            }
        };
        WITH_FIG.forEach(q => check(q.id, mathQuestionFigureHTML(q.fig)));
        Object.keys(MATH_FIGURES).forEach(id => check('glossary/' + id, MATH_FIGURES[id]));
        assert.deepEqual(clash.slice(0, 5), [], `${clash.length} overlapping label(s)`);
    });

    test('the question card draws it, above the options', () => {
        const src = fs.readFileSync(path.join(root, 'js', 'math.js'), 'utf8');
        const i = src.indexOf('mathQuestionFigureHTML(q.fig)');
        assert.truthy(i > 0, 'renderMathQuestion never draws the question figure');
        assert.truthy(src.indexOf('grammar-question-text') < i, 'the figure must follow the question text');
        assert.truthy(i < src.lastIndexOf('${body}'), 'the figure must come before the options');
    });

    test('the build refuses a figure it cannot draw', () => {
        const src = fs.readFileSync(path.join(root, 'scripts', 'build-math-data.js'), 'utf8');
        assert.truthy(/MATH_Q_FIGURES\[q\.fig\.t\]/.test(src), 'the build never checks the template name');
        assert.truthy(/unknown figure template/.test(src), 'a bad template must fail the build, not ship');
        assert.truthy(/fig: q\.fig/.test(src), 'the build must carry fig through to js/math-data.js');
    });
});

// ---- hình trong ĐỀ THI THỬ ---------------------------------------------
// Đề thi là để bé TỰ làm: có hình cho hiểu đề, nhưng KHÔNG có bảng gợi ý.
const EXAM_Q = [];
MATH_EXAMS.forEach(e => (e.questions || []).forEach(q => EXAM_Q.push({ id: `${e.id}#${q.n}`, q })));
const EXAM_GEO = EXAM_Q.filter(x => x.q.ch === 3 || x.q.ch === 4);
const EXAM_FIG = EXAM_Q.filter(x => x.q.fig);
const EXAM_CHART = EXAM_Q.filter(x => /biểu đồ (?:hình )?(?:quạt tròn|đoạn thẳng).*(?:cho biết|ghi)/i.test(x.q.q));

suite('math figures: the mock exam papers', () => {
    test('almost every geometry question in the ten papers is drawn', () => {
        assert.equal(EXAM_GEO.length, 80, 'the papers changed — recheck which questions need a figure');
        assert.equal(EXAM_FIG.filter(x => x.q.ch === 3 || x.q.ch === 4).length, 77);
        // Ba câu còn lại chỉ hỏi "phần đã cho gọi là gì" — vẽ ra thì hoặc là
        // viết sẵn đáp án, hoặc là một cái hộp chữ không phải hình học.
        const bare = EXAM_GEO.filter(x => !x.q.fig).map(x => x.id).sort();
        assert.deepEqual(bare, ['hk1-exam2#10', 'hk1-exam6#10', 'hk1-exam7#10']);
    });

    test('all 16 questions that ask children to read a chart show the actual chart', () => {
        assert.equal(EXAM_CHART.length, 16);
        const missing = EXAM_CHART.filter(x => !x.q.fig
            || !/^(?:line|pie)-chart$/.test(x.q.fig.t)).map(x => x.id);
        assert.deepEqual(missing, []);
        assert.equal(EXAM_FIG.length, 93);
    });

    test('figures appear only where geometry or chart reading needs them', () => {
        const stray = EXAM_FIG.filter(x => x.q.ch !== 3 && x.q.ch !== 4
            && !EXAM_CHART.some(c => c.id === x.id)).map(x => x.id);
        assert.deepEqual(stray, []);
    });

    test('a triangle is drawn with its angles in the size order its labels claim', () => {
        // _MF_TRI is a fixed shape: v[0] opens 51.3°, v[1] 47°, v[2] 81.7°.
        // Every one of the nine triangle questions used to list its vertices in
        // question order, so the angle labelled 97° was drawn as the SMALLEST
        // corner and the 35° answer as the largest. A child checking their
        // answer against the picture was told the opposite of the truth.
        const SLOT = [51.3, 47.0, 81.7];
        const rank = a => a.map((x, i) => [x, i]).sort((p, r) => p[0] - r[0])
            .map((p, k) => [p[1], k]).sort((p, r) => p[0] - r[0]).map(p => p[1]);
        const tri = EXAM_FIG.filter(x => x.q.fig.t === 'tam-giac' && x.q.fig.angles);
        assert.equal(tri.length, 9, 'triangle inventory changed — re-check the drawn order');
        tri.forEach(({ id, q }) => {
            const v = q.fig.v;
            assert.equal(new Set(v).size, 3, `${id}: a vertex is repeated`);
            const num = s => {
                const m = /(\d+(?:[.,]\d+)?)/.exec(String(s || ''));
                return m ? parseFloat(m[1].replace(',', '.')) : null;
            };
            const vals = v.map(name => num(q.fig.angles[name]));
            const gap = vals.findIndex(x => x === null);
            if (gap >= 0) vals[gap] = 180 - vals.filter(x => x !== null).reduce((a, b) => a + b, 0);
            assert.deepEqual(rank(vals), rank(SLOT),
                `${id}: the drawn corners do not match the labelled sizes`);
        });
    });

    test('no exam question prints its own answer in the topic badge above it', () => {
        // renderMathQuestion draws q.topic in a pill directly above the stem,
        // in exam mode too. Twelve questions carried a badge that WAS the
        // answer — "Trường hợp c-g-c" over "which congruence case is it?",
        // "Số hữu tỉ" over "what does ℚ stand for?" — so those were free marks.
        const norm = s => String(s).toLowerCase().replace(/[^a-z0-9à-ỹ]+/gi, '');
        const leaks = [];
        EXAM_Q.forEach(({ id, q }) => {
            const t = norm(q.topic), a = norm(q.answer), stem = norm(q.q);
            // A short answer like "AM" sits inside "tam giác" in a topic name;
            // that is a letter collision, not a leak. Require both to be long.
            if (t.length < 5 || a.length < 5 || stem.includes(t)) return;
            if (a.includes(t) || t.includes(a)) leaks.push(id);
            const m = /^Trường hợp (c-g-c|c-c-c|g-c-g)$/.exec(q.topic || '');
            if (m && new RegExp(m[1].replace(/-/g, '.'), 'i').test(q.answer)) leaks.push(id);
        });
        assert.deepEqual([...new Set(leaks)], [], 'the topic badge gives the answer away');
    });

    test('every exam figure names a real template and draws inside the canvas', () => {
        const out = [];
        EXAM_FIG.forEach(({ id, q }) => {
            assert.truthy(MATH_Q_FIGURES[q.fig.t], `${id}: unknown template "${q.fig.t}"`);
            const svg = mathQuestionFigureHTML(q.fig);
            assert.truthy(svg.indexOf('<svg') > 0, `${id}: drew nothing`);
            coordsOf(svg).forEach(p => {
                if (p[0] < -PAD || p[0] > W + PAD || p[1] < -PAD || p[1] > H + PAD) out.push(`${id} @ ${p[0]},${p[1]}`);
            });
        });
        assert.deepEqual([...new Set(out)].slice(0, 5), [], `${out.length} points fall off the canvas`);
    });

    test('THE RULE holds in the exam too: the figure never carries the answer', () => {
        const leaks = [];
        EXAM_FIG.forEach(({ id, q }) => {
            textsOf(mathQuestionFigureHTML(q.fig)).forEach(t => {
                if (!/°|cm|m²/.test(t.s)) return;
                (t.s.match(/\d+/g) || []).forEach(n => {
                    if (q.q.indexOf(n) === -1) leaks.push(`${id}: figure says "${t.s}", the question never gives ${n}`);
                });
            });
        });
        assert.deepEqual(leaks.slice(0, 5), [], `${leaks.length} exam figure(s) show a number the question did not`);
    });

    test('chart data matches the stem and pie slices always make one whole', () => {
        const bad = [];
        EXAM_CHART.forEach(({ id, q }) => {
            if (q.fig.t === 'line-chart') {
                if (q.fig.labels.length !== q.fig.values.length || q.fig.values.length < 2) bad.push(`${id}: bad point count`);
                q.fig.values.forEach(v => {
                    if (!q.q.includes(String(v))) bad.push(`${id}: chart invents ${v}`);
                });
            } else {
                const sum = q.fig.segments.reduce((s, x) => s + Number(x.value), 0);
                if (sum !== 100) bad.push(`${id}: pie totals ${sum}%`);
                q.fig.segments.forEach(s => {
                    if (s.text !== '?' && !q.q.includes(String(s.value))) bad.push(`${id}: pie invents ${s.value}%`);
                });
            }
        });
        assert.deepEqual(bad, []);
    });

    test('numeric geometry figures agree with their answers', () => {
        const bad = [];
        const number = s => { const m = /-?\d+(?:[.,]\d+)?/.exec(String(s || '')); return m ? +m[0].replace(',', '.') : null; };
        EXAM_GEO.forEach(({ id, q }) => {
            const f = q.fig;
            if (!f) return;
            const ans = number(q.answer);
            if (f.t === 'phan-giac' && f.lw && ans !== f.w / 2) bad.push(`${id}: bisector answer ${ans}`);
            if (f.t === 'ke-bu' && /bao nhiêu/.test(q.q) && ans !== 180 - f.a) bad.push(`${id}: supplementary answer ${ans}`);
            if (f.t === 'tam-giac') {
                const given = Object.values(f.angles).map(number).filter(x => x != null);
                if (given.length === 2 && ans !== 180 - given[0] - given[1]) bad.push(`${id}: triangle answer ${ans}`);
            }
            if (f.t === 'cut2') {
                let base = null;
                Object.entries(f.angles).forEach(([p, label]) => {
                    const v = number(/°/.test(label) ? label : '');
                    if (v == null) return;
                    const candidate = /[13]$/.test(p) ? v : 180 - v;
                    if (base == null) base = candidate;
                    else if (Math.abs(base - candidate) > 1e-9) bad.push(`${id}: ${p}=${v}° conflicts with the other marked angle`);
                });
            }
        });
        assert.deepEqual(bad, []);
    });

    test('no two labels overlap in any exam figure', () => {
        const clash = [];
        EXAM_FIG.forEach(({ id, q }) => {
            const L = textsOf(mathQuestionFigureHTML(q.fig));
            for (let i = 0; i < L.length; i++) {
                for (let j = i + 1; j < L.length; j++) {
                    const d = Math.hypot(L[i].x - L[j].x, L[i].y - L[j].y);
                    if (d < 12) clash.push(`${id}: "${L[i].s}" over "${L[j].s}"`);
                }
            }
        });
        assert.deepEqual(clash.slice(0, 5), [], `${clash.length} overlapping label(s)`);
    });
});

suite('math exam: no hints — the child sits it alone', () => {
    test('the hint panel is empty in exam mode, however many terms would match', () => {
        const q = MATH_QUESTIONS.find(x => x.ch === 3 && math.mathHintsFor(x).length > 0);
        assert.truthy(q, 'no hinted Chương 3 question to test with');
        assert.truthy(math.mathHintHTML(q, false).length > 0, 'practice must still offer the hint');
        assert.equal(math.mathHintHTML(q, true), '', 'an exam must not show the hint at all');
    });

    test('an open hint does not leak into an exam either', () => {
        const q = MATH_QUESTIONS.find(x => x.ch === 4 && math.mathHintsFor(x).length > 0);
        math.toggleMathHint();                        // bé mở gợi ý ở phần luyện tập
        try {
            assert.truthy(math.mathHintHTML(q, false).indexOf('math-hint-body') > 0);
            assert.equal(math.mathHintHTML(q, true), '', 'the open state must not carry into the exam');
        } finally { math.toggleMathHint(); }
    });

    test('the question card passes the exam flag, so this cannot be bypassed', () => {
        const src = fs.readFileSync(path.join(root, 'js', 'math.js'), 'utf8');
        assert.truthy(/mathHintHTML\(q, !!st\.examId\)/.test(src),
            'renderMathQuestion must tell mathHintHTML whether this is an exam');
    });

    test('but the exam DOES draw the figure — hình học vẫn cần cái hình', () => {
        const src = fs.readFileSync(path.join(root, 'js', 'math.js'), 'utf8');
        const i = src.indexOf('mathQuestionFigureHTML(q.fig)');
        const j = src.indexOf('mathHintHTML(q, !!st.examId)');
        assert.truthy(i > 0 && j > i, 'the figure is drawn for every mode, before the hint slot');
    });
});
