// math-source-exams.test.js — five real HK1 papers supplied as PDFs.
// These checks protect the transcription, original figures, untimed exam mode
// and the one malformed source question that must never penalise a child.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const { MATH_SOURCE_EXAMS } = require(path.join(root, 'js', 'math-source-exams.js'));
const { MATH_Q_FIGURES, mathQuestionFigureHTML } = require(path.join(root, 'js', 'math-figures.js'));

// Khung vẽ của mọi hình là 200×120, cộng chút mép cho nét dày.
const FIG_W = 200, FIG_H = 120, FIG_PAD = 2;

// Mọi toạ độ có trong một hình — để bắt cái nét trót vẽ ra ngoài khung và bị
// mép SVG cắt cụt trên máy bé.
function figPoints(svg) {
    const pts = [];
    const attr = (re, fn) => { let m; while ((m = re.exec(svg))) fn(m); };
    attr(/<line[^>]*x1="(-?[\d.]+)"\s*y1="(-?[\d.]+)"\s*x2="(-?[\d.]+)"\s*y2="(-?[\d.]+)"/g,
        m => { pts.push([+m[1], +m[2]], [+m[3], +m[4]]); });
    attr(/<circle[^>]*cx="(-?[\d.]+)"[^>]*cy="(-?[\d.]+)"/g, m => pts.push([+m[1], +m[2]]));
    attr(/<(?:polygon|polyline)[^>]*points="([^"]+)"/g, m => {
        m[1].trim().split(/\s+/).forEach(p => {
            const xy = p.split(',');
            if (xy.length === 2) pts.push([+xy[0], +xy[1]]);
        });
    });
    attr(/<path[^>]*d="([^"]+)"/g, m => {
        const t = m[1].trim().split(/[\s,]+/);
        for (let i = 0; i < t.length; i++) {
            if (t[i] === 'M' || t[i] === 'L') { pts.push([+t[i + 1], +t[i + 2]]); i += 2; }
            else if (t[i] === 'C') { pts.push([+t[i + 1], +t[i + 2]], [+t[i + 3], +t[i + 4]], [+t[i + 5], +t[i + 6]]); i += 6; }
            else if (t[i] === 'A') { pts.push([+t[i + 6], +t[i + 7]]); i += 7; }
        }
    });
    return pts;
}

// Ô CHỮ NHẬT của mỗi nhãn, chứ không phải điểm neo của nó. Đo bằng điểm neo
// thì hai nhãn cách nhau 13 đơn vị vẫn "đạt", trong khi "50°" rộng tới 26 và
// nằm đè hẳn lên chữ bên cạnh — lỗi ấy chỉ mắt người mới thấy, mà mắt người
// thì không chạy lại sau mỗi lần sửa toạ độ.
function figLabels(svg) {
    return [...svg.matchAll(/<text([^>]*)>([^<]*)</g)].map(m => {
        const at = m[1], s = m[2].trim();
        if (!s) return null;
        const x = +/x="(-?[\d.]+)"/.exec(at)[1], y = +/y="(-?[\d.]+)"/.exec(at)[1];
        const anchor = (/text-anchor="(\w+)"/.exec(at) || [, 'middle'])[1];
        const inline = /font-size:([\d.]+)px/.exec(at);
        const fs = inline ? +inline[1] : (/mf-cap/.test(at) ? 10 : 12);
        const w = [...s].length * fs * 0.55;
        const x0 = anchor === 'start' ? x : (anchor === 'end' ? x - w : x - w / 2);
        return { s, x0, x1: x0 + w, y0: y - fs * 0.8, y1: y + fs * 0.22 };
    }).filter(Boolean);
}
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

suite('math source exams: hình vẽ lại và app wiring', () => {
    test('mọi hình đều VẼ LẠI bằng fig spec, không còn mẩu ảnh cắt nào', () => {
        // Hai mươi hai hình này từng là `source-crop`: một mẩu cắt từ ảnh scan
        // trang đề. Ảnh mờ, kẹt ở theme sáng, phóng to là vỡ, và nặng hơn cả
        // phần còn lại của app. Bài test giữ chúng ở dạng vẽ.
        const figs = MATH_SOURCE_EXAMS.flatMap(e => e.questions).filter(q => q.fig);
        assert.equal(figs.length, 22);
        figs.forEach(q => {
            assert.falsy(q.fig.t === 'source-crop', `${q.id}: hình phải VẼ LẠI, không cắt ảnh`);
            assert.falsy(q.fig.src, `${q.id}: hình không được trỏ tới một file ảnh`);
            assert.truthy(MATH_Q_FIGURES[q.fig.t], `${q.id}: khuôn "${q.fig.t}" không có thật`);
            const html = mathQuestionFigureHTML(q.fig);
            assert.truthy(html.indexOf('<svg') >= 0 && html.length > 200,
                `${q.id}: khuôn ${q.fig.t} không vẽ ra gì`);
            assert.falsy(/NaN|undefined/.test(html), `${q.id}: khuôn ${q.fig.t} sinh toạ độ hỏng`);
            assert.falsy(/<img|<image|https?:|\.jpg|\.png/i.test(html),
                `${q.id}: hình vẫn nạp một tấm ảnh từ đâu đó`);
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

    test('hình nào cũng nằm gọn trong khung và không nhãn nào đè nhãn nào', () => {
        const loi = [];
        MATH_SOURCE_EXAMS.flatMap(e => e.questions).filter(q => q.fig).forEach(q => {
            const svg = mathQuestionFigureHTML(q.fig);
            figPoints(svg).forEach(p => {
                if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])
                    || p[0] < -FIG_PAD || p[0] > FIG_W + FIG_PAD
                    || p[1] < -FIG_PAD || p[1] > FIG_H + FIG_PAD) {
                    loi.push(`${q.id}: nét vẽ ra ngoài khung @ ${p[0]},${p[1]}`);
                }
            });
            const L = figLabels(svg);
            L.forEach(b => {
                if (b.x0 < -1 || b.x1 > FIG_W + 1 || b.y0 < -1 || b.y1 > FIG_H + 1) {
                    loi.push(`${q.id}: nhãn "${b.s}" bị mép khung cắt mất`);
                }
            });
            for (let i = 0; i < L.length; i++) {
                for (let j = i + 1; j < L.length; j++) {
                    const a = L[i], c = L[j];
                    if (a.x0 < c.x1 - 1 && c.x0 < a.x1 - 1 && a.y0 < c.y1 - 1 && c.y0 < a.y1 - 1) {
                        loi.push(`${q.id}: "${a.s}" đè lên "${c.s}"`);
                    }
                }
            }
        });
        assert.deepEqual(loi.slice(0, 5), [], `${loi.length} chỗ hình đọc không ra`);
    });

    test('hình dựng ra đúng cái đáp án của đề, và không ghi sẵn đáp án lên hình', () => {
        const byId = new Map(MATH_SOURCE_EXAMS.flatMap(e => e.questions).map(q => [q.id, q]));

        // Biểu đồ quạt: bốn phần phải cộng đủ 100% (nếu không thì cái bánh
        // không tròn), và đúng MỘT phần để dấu "?" — chính phần đề hỏi.
        const pie = byId.get('s1-12').fig.segments;
        assert.equal(pie.reduce((a, x) => a + x.value, 0), 100, 's1-12: quạt không đủ 100%');
        assert.equal(pie.filter(x => x.text === '?').length, 1, 's1-12: phải có đúng một phần "?"');

        // Câu 8 đề 2 hỏi "hình nào có hai đường thẳng song song". Hình vẽ phải
        // TỰ trả lời được: đúng một ô có hai số đo ăn khớp, và ô đó phải là ô
        // đề chấm đúng. Vẽ bốn ô giống nhau rồi ghi số khác nhau thì bé chỉ
        // còn cách đoán.
        const ss = byId.get('s2-8');
        const lech = ss.fig.hinh.map(h => [h.tren, h.duoi].map(m => {
            const g = /(\d+(?:[.,]\d+)?)/.exec(String(m.goc || ''));
            const so = m.vuong ? 90 : parseFloat(g[1].replace(',', '.'));
            return (m.o === 'tp' || m.o === 'dt') ? so : 180 - so;
        }));
        const song = lech.map((d, i) => (d[0] === d[1] ? i : -1)).filter(i => i >= 0);
        assert.deepEqual(song, [ss.correct], 's2-8: ô song song vẽ ra không trùng đáp án');

        // Câu 7 đề 5 hỏi "hình nào có cặp góc đối đỉnh". Đối đỉnh chỉ sinh ra
        // khi HAI đường thẳng cắt nhau, tức là tại một đỉnh có HAI cặp tia đối
        // nhau. Một đường thẳng với một tia cắm vào (Hình a) cũng có một cặp
        // tia đối, nhưng không có góc đối đỉnh nào — đó đúng là cái bẫy của đề.
        const dd = byId.get('s5-7');
        const co = dd.fig.hinh.map(h => h.dinh.some(d => d.tia.filter(a => d.tia.some(b =>
            Math.abs(((b - a) % 360 + 360) % 360 - 180) < 1)).length >= 4));
        assert.deepEqual(co.map((x, i) => (x ? i : -1)).filter(i => i >= 0), [dd.correct],
            's5-7: ô có góc đối đỉnh vẽ ra không trùng đáp án');

        // Câu 6 đề 5: ô được chấm đúng phải là ô vẽ hình hộp chữ nhật.
        const kh = byId.get('s5-6');
        assert.equal(kh.fig.khoi[kh.correct], 'hop', 's5-6: đáp án không trỏ vào hình hộp');

        // Câu 5 đề 2: hai mặt đáy của lăng trụ trên hình phải đúng là hai mặt
        // đề chấm đúng (EAD và FBC).
        const lt = byId.get('s2-5');
        assert.deepEqual(lt.fig.v.map(m => m.slice().sort().join('')), ['ADE', 'BCF'],
            's2-5: hai đáy vẽ ra không phải EAD và FBC');

        // Chỗ phải TÌM để trống ('?' hoặc 'x'), và con số phải tìm không được
        // ghi lên hình. s4-18 là chỗ dễ lộ nhất: 80° suy ra từ 65° và 35°.
        const tri = figLabels(mathQuestionFigureHTML(byId.get('s4-18').fig)).map(b => b.s);
        assert.truthy(tri.indexOf('?') >= 0, 's4-18: góc phải tìm phải để trống');
        assert.falsy(tri.indexOf('80°') >= 0, 's4-18: hình ghi sẵn đáp án');
        [['s1-15', '?'], ['s3-12', 'x']].forEach(([id, dau]) => {
            const chu = figLabels(mathQuestionFigureHTML(byId.get(id).fig)).map(b => b.s);
            assert.truthy(chu.indexOf(dau) >= 0, `${id}: hình phải chừa chỗ trống cho góc phải tìm`);
        });
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
        // Không câu nào còn nạp một tấm ảnh trang đề nữa: hình nằm hết trong
        // js/math-figures.js, mà file ấy đã được cache sẵn.
        assert.deepEqual(MATH_SOURCE_EXAMS.flatMap(e => e.questions)
            .filter(q => q.fig && q.fig.src).map(q => q.id), [],
            'a source question still loads a page scan');
        assert.truthy(sw.includes("'/js/math-figures.js'"), 'the drawings are not cached offline');
    });

    // Mọi hình đều được vẽ lại, nên 1,9 MB ảnh chụp trang đề trong
    // assets/math-exams/ không còn được câu nào nạp. Chúng từng nằm trong
    // danh sách precache của service worker: máy của bé tải về 1,9 MB rồi
    // không hiển thị tấm nào. Test này giữ cho chúng đừng quay lại.
    test('the unused page scans are not shipped to the child offline', () => {
        const sw = read('sw.js');
        assert.falsy(sw.includes('assets/math-exams'),
            'sw.js precaches page scans that no question renders');
        for (const f of ['js/math-source-exams.js', 'js/math-exams.js', 'js/math-data.js', 'index.html']) {
            assert.falsy(read(f).includes("'/assets/math-exams"),
                `${f} still points a question at a page scan`);
        }
    });
});
