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
const { MATH_FIGURES, mathFigureHTML } = require(path.join(root, 'js', 'math-figures.js'));

global.MATH_QUESTIONS = MATH_QUESTIONS;
global.MATH_GLOSSARY = MATH_GLOSSARY;
global.MATH_EXAMS = MATH_EXAMS;
global.MATH_FIGURES = MATH_FIGURES;
global.mathFigureHTML = mathFigureHTML;
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
