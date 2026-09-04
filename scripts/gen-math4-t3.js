#!/usr/bin/env node
// scripts/gen-math4-t3.js — dạng 3 của đề ôn Toán 4: "Tính giá trị biểu thức".
//
//   node scripts/gen-math4-t3.js   →   data/math4/math4-t3.json  (đúng 100 câu)
//
// Sinh có hạt giống cố định: chạy bao nhiêu lần cũng ra đúng một tệp giống
// nhau từng byte. Không phụ thuộc gì ngoài node:fs / node:path.
//
// Kỹ năng của dạng này là THỨ TỰ THỰC HIỆN PHÉP TÍNH, nên mỗi biểu thức có
// đúng hai phép tính, và một phần tư số câu là hai biểu thức CÙNG BỘ SỐ, chỉ
// khác dấu ngoặc — "21506 + 6930 : 3" đặt cạnh "(21506 + 6930) : 3" — để bé
// tự thấy dấu ngoặc đổi kết quả thế nào.
//
// Nhãn (label) được dựng trước theo lối viết ở trường (× : −), rồi `expr`
// được SUY RA TỪ NHÃN bằng phép thay ký tự. Nhờ vậy nhãn và biểu thức ASCII
// không bao giờ nói hai chuyện khác nhau.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'math4', 'math4-t3.json');

const SEED = 0x4304_3303;   // "t3" — cố định, đừng đổi nếu không muốn cả tệp đổi
const COUNT = 100;

// Lối viết ở trường tiểu học.
const TIMES = '×';   // ×
const MINUS = '−';   // − (U+2212, KHÔNG phải dấu gạch nối)
const DIVIDE = ':';

// Cả toán hạng lẫn kết quả trung gian đều nằm trong vùng số của lớp 4: số có
// bốn hoặc năm chữ số, nhân chia với số có một chữ số.
const BIG_MIN = 1000;
const BIG_MAX = 99999;

// ---------------------------------------------------------------- ngẫu nhiên
// mulberry32: nhỏ, không phụ thuộc, cùng hạt giống thì cùng dãy số.
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rand = mulberry32(SEED);

function int(lo, hi) {            // số nguyên trong [lo, hi]
    return lo + Math.floor(rand() * (hi - lo + 1));
}

function shuffle(arr) {           // Fisher–Yates, dùng chính dãy ngẫu nhiên trên
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

// ------------------------------------------------------------------ tiện ích
// expr LUÔN suy ra từ label — đây là điều giữ cho hai thứ không lệch nhau.
function exprOf(label) {
    return label
        .split(TIMES).join('*')
        .split(MINUS).join('-')
        .split(DIVIDE).join('/')
        .split(' ').join('');
}

function part(label, steps, value) {
    if (!Number.isInteger(value) || value < 0 || value > BIG_MAX) return null;
    return {
        label,
        answer: String(value),
        expr: exprOf(label),
        // Dòng lời giải: "21506 + 6930 : 3 = 21506 + 2310 = <b>23816</b>"
        work: `${label} = ${steps} = <b>${value}</b>`,
    };
}

function ok(...values) {          // mọi giá trị phải là số tự nhiên trong vùng
    return values.every(v => Number.isInteger(v) && v >= 0 && v <= BIG_MAX);
}

// ------------------------------------------------------- mười hai dạng biểu thức
// Mỗi hàm trả về một answerPart, hoặc null khi bộ số bốc được không hợp lệ
// (bốc lại — dãy ngẫu nhiên vẫn xác định nên kết quả vẫn không đổi).
const SHAPES = {
    // a + b : c
    addDiv() {
        const c = int(2, 9);
        const q = int(Math.ceil(BIG_MIN / c), Math.floor(BIG_MAX / c));
        const b = q * c;
        if (!ok(b) || b < BIG_MIN || BIG_MAX - q < BIG_MIN) return null;
        const a = int(BIG_MIN, BIG_MAX - q);
        return ok(a, a + q)
            ? part(`${a} + ${b} ${DIVIDE} ${c}`, `${a} + ${q}`, a + q)
            : null;
    },

    // a − b : c
    subDiv() {
        const c = int(2, 9);
        const q = int(Math.ceil(BIG_MIN / c), Math.floor(BIG_MAX / c));
        const b = q * c;
        const lo = Math.max(BIG_MIN, q + 1);
        if (b < BIG_MIN || lo > BIG_MAX) return null;
        const a = int(lo, BIG_MAX);
        return ok(a, a - q)
            ? part(`${a} ${MINUS} ${b} ${DIVIDE} ${c}`, `${a} ${MINUS} ${q}`, a - q)
            : null;
    },

    // a + b × c
    addMul() {
        const c = int(2, 9);
        const bMax = Math.floor((BIG_MAX - BIG_MIN) / c);
        if (bMax < BIG_MIN) return null;
        const b = int(BIG_MIN, bMax);
        const p = b * c;
        if (BIG_MAX - p < BIG_MIN) return null;
        const a = int(BIG_MIN, BIG_MAX - p);
        return ok(a, p, a + p)
            ? part(`${a} + ${b} ${TIMES} ${c}`, `${a} + ${p}`, a + p)
            : null;
    },

    // a − b × c
    subMul() {
        const c = int(2, 9);
        const bMax = Math.floor((BIG_MAX - 1) / c);
        if (bMax < BIG_MIN) return null;
        const b = int(BIG_MIN, bMax);
        const p = b * c;
        const lo = Math.max(BIG_MIN, p + 1);
        if (lo > BIG_MAX) return null;
        const a = int(lo, BIG_MAX);
        return ok(a, p, a - p)
            ? part(`${a} ${MINUS} ${b} ${TIMES} ${c}`, `${a} ${MINUS} ${p}`, a - p)
            : null;
    },

    // a × b + c
    mulAdd() {
        const b = int(2, 9);
        const aMax = Math.floor((BIG_MAX - BIG_MIN) / b);
        if (aMax < BIG_MIN) return null;
        const a = int(BIG_MIN, aMax);
        const p = a * b;
        if (BIG_MAX - p < BIG_MIN) return null;
        const c = int(BIG_MIN, BIG_MAX - p);
        return ok(p, c, p + c)
            ? part(`${a} ${TIMES} ${b} + ${c}`, `${p} + ${c}`, p + c)
            : null;
    },

    // a × b − c
    mulSub() {
        const b = int(2, 9);
        const a = int(BIG_MIN, Math.floor(BIG_MAX / b));
        const p = a * b;
        if (p - 1 < BIG_MIN) return null;
        const c = int(BIG_MIN, p - 1);
        return ok(p, c, p - c)
            ? part(`${a} ${TIMES} ${b} ${MINUS} ${c}`, `${p} ${MINUS} ${c}`, p - c)
            : null;
    },

    // a : b + c
    divAdd() {
        const b = int(2, 9);
        const q = int(Math.ceil(BIG_MIN / b), Math.floor(BIG_MAX / b));
        const a = q * b;
        if (a < BIG_MIN || BIG_MAX - q < BIG_MIN) return null;
        const c = int(BIG_MIN, BIG_MAX - q);
        return ok(a, q, q + c)
            ? part(`${a} ${DIVIDE} ${b} + ${c}`, `${q} + ${c}`, q + c)
            : null;
    },

    // a : b − c
    divSub() {
        const b = int(2, 9);
        const qMax = Math.floor(BIG_MAX / b);
        if (qMax < BIG_MIN + 1) return null;
        const q = int(BIG_MIN + 1, qMax);
        const a = q * b;
        const c = int(BIG_MIN, q - 1);
        return ok(a, q, q - c)
            ? part(`${a} ${DIVIDE} ${b} ${MINUS} ${c}`, `${q} ${MINUS} ${c}`, q - c)
            : null;
    },

    // (a + b) × c
    parAddMul() {
        const c = int(2, 9);
        const sMax = Math.floor(BIG_MAX / c);
        if (sMax < 2 * BIG_MIN) return null;
        const s = int(2 * BIG_MIN, sMax);
        const a = int(BIG_MIN, s - BIG_MIN);
        const b = s - a;
        return ok(a, b, s, s * c)
            ? part(`(${a} + ${b}) ${TIMES} ${c}`, `${s} ${TIMES} ${c}`, s * c)
            : null;
    },

    // (a + b) : c
    parAddDiv() {
        const c = int(2, 9);
        const sqMax = Math.floor(BIG_MAX / c);
        const sqMin = Math.ceil((2 * BIG_MIN) / c);
        if (sqMax < sqMin) return null;
        const sq = int(sqMin, sqMax);
        const s = sq * c;
        if (s - BIG_MIN < BIG_MIN) return null;
        const a = int(BIG_MIN, s - BIG_MIN);
        const b = s - a;
        return ok(a, b, s, sq)
            ? part(`(${a} + ${b}) ${DIVIDE} ${c}`, `${s} ${DIVIDE} ${c}`, sq)
            : null;
    },

    // (a − b) × c
    parSubMul() {
        const c = int(2, 9);
        const dMax = Math.floor(BIG_MAX / c);
        if (dMax < BIG_MIN) return null;
        const d = int(BIG_MIN, dMax);
        if (BIG_MAX - d < BIG_MIN) return null;
        const b = int(BIG_MIN, BIG_MAX - d);
        const a = b + d;
        return ok(a, b, d, d * c)
            ? part(`(${a} ${MINUS} ${b}) ${TIMES} ${c}`, `${d} ${TIMES} ${c}`, d * c)
            : null;
    },

    // (a − b) : c
    parSubDiv() {
        const c = int(2, 9);
        const dqMax = Math.floor((BIG_MAX - BIG_MIN) / c);
        const dqMin = Math.ceil(BIG_MIN / c);
        if (dqMax < dqMin) return null;
        const dq = int(dqMin, dqMax);
        const d = dq * c;
        if (d < BIG_MIN || BIG_MAX - d < BIG_MIN) return null;
        const b = int(BIG_MIN, BIG_MAX - d);
        const a = b + d;
        return ok(a, b, d, dq)
            ? part(`(${a} ${MINUS} ${b}) ${DIVIDE} ${c}`, `${d} ${DIVIDE} ${c}`, dq)
            : null;
    },
};

// Nhãn ngắn để in ra bảng thống kê cuối cùng.
const SHAPE_LABEL = {
    addDiv: `a + b ${DIVIDE} c`,
    subDiv: `a ${MINUS} b ${DIVIDE} c`,
    addMul: `a + b ${TIMES} c`,
    subMul: `a ${MINUS} b ${TIMES} c`,
    mulAdd: `a ${TIMES} b + c`,
    mulSub: `a ${TIMES} b ${MINUS} c`,
    divAdd: `a ${DIVIDE} b + c`,
    divSub: `a ${DIVIDE} b ${MINUS} c`,
    parAddMul: `(a + b) ${TIMES} c`,
    parAddDiv: `(a + b) ${DIVIDE} c`,
    parSubMul: `(a ${MINUS} b) ${TIMES} c`,
    parSubDiv: `(a ${MINUS} b) ${DIVIDE} c`,
};

// ------------------------------------------------- cặp "cùng số, khác ngoặc"
// Bốn cặp đối chứng: hai phần của câu dùng CHUNG a, b, c, chỉ khác dấu ngoặc.
const CONTRASTS = {
    // a + b : c   ↔   (a + b) : c      (a và b đều chia hết cho c)
    addDiv_parAddDiv() {
        const c = int(2, 9);
        const bq = int(Math.ceil(BIG_MIN / c), Math.floor(90000 / c));
        const b = bq * c;
        const aqMax = Math.floor((BIG_MAX - b) / c);
        const aqMin = Math.ceil(BIG_MIN / c);
        if (b < BIG_MIN || aqMax < aqMin) return null;
        const aq = int(aqMin, aqMax);
        const a = aq * c;
        if (!ok(a, b, a + b, a + bq, aq + bq)) return null;
        return [
            part(`${a} + ${b} ${DIVIDE} ${c}`, `${a} + ${bq}`, a + bq),
            part(`(${a} + ${b}) ${DIVIDE} ${c}`, `${a + b} ${DIVIDE} ${c}`, aq + bq),
        ];
    },

    // a − b : c   ↔   (a − b) : c
    subDiv_parSubDiv() {
        const c = int(2, 9);
        const bq = int(Math.ceil(BIG_MIN / c), Math.floor((BIG_MAX - BIG_MIN) / c));
        const b = bq * c;
        const dqMax = Math.floor((BIG_MAX - b) / c);
        const dqMin = Math.ceil(BIG_MIN / c);
        if (b < BIG_MIN || dqMax < dqMin) return null;
        const dq = int(dqMin, dqMax);
        const d = dq * c;
        const a = b + d;
        if (!ok(a, b, d, a - bq, dq)) return null;
        return [
            part(`${a} ${MINUS} ${b} ${DIVIDE} ${c}`, `${a} ${MINUS} ${bq}`, a - bq),
            part(`(${a} ${MINUS} ${b}) ${DIVIDE} ${c}`, `${d} ${DIVIDE} ${c}`, dq),
        ];
    },

    // a + b × c   ↔   (a + b) × c
    addMul_parAddMul() {
        const c = int(2, 9);
        const sMax = Math.floor(BIG_MAX / c);
        if (sMax < 2 * BIG_MIN) return null;
        const s = int(2 * BIG_MIN, sMax);
        const a = int(BIG_MIN, s - BIG_MIN);
        const b = s - a;
        if (!ok(a, b, b * c, a + b * c, s * c)) return null;
        return [
            part(`${a} + ${b} ${TIMES} ${c}`, `${a} + ${b * c}`, a + b * c),
            part(`(${a} + ${b}) ${TIMES} ${c}`, `${s} ${TIMES} ${c}`, s * c),
        ];
    },

    // a − b × c   ↔   (a − b) × c
    subMul_parSubMul() {
        const c = int(2, 9);
        const bMax = Math.floor((Math.floor(BIG_MAX / c) - 1) / (c - 1));
        if (bMax < BIG_MIN) return null;
        const b = int(BIG_MIN, bMax);
        const lo = b * c + 1;
        const hi = Math.min(BIG_MAX, b + Math.floor(BIG_MAX / c));
        if (lo > hi) return null;
        const a = int(lo, hi);
        if (!ok(a, b, b * c, a - b * c, (a - b) * c)) return null;
        return [
            part(`${a} ${MINUS} ${b} ${TIMES} ${c}`, `${a} ${MINUS} ${b * c}`, a - b * c),
            part(`(${a} ${MINUS} ${b}) ${TIMES} ${c}`, `${a - b} ${TIMES} ${c}`, (a - b) * c),
        ];
    },
};

const CONTRAST_SHAPES = {
    addDiv_parAddDiv: ['addDiv', 'parAddDiv'],
    subDiv_parSubDiv: ['subDiv', 'parSubDiv'],
    addMul_parAddMul: ['addMul', 'parAddMul'],
    subMul_parSubMul: ['subMul', 'parSubMul'],
};

// ---------------------------------------------------------------- lời giải
// Câu quy tắc mở đầu — viết mười câu rồi xoay vòng, để cả trăm lời giải không
// đọc như một câu duy nhất chép lại trăm lần.
const RULES = [
    'Trong biểu thức không có dấu ngoặc, ta làm phép nhân, phép chia trước rồi mới làm phép cộng, phép trừ; biểu thức có dấu ngoặc thì tính trong ngoặc trước.',
    'Biểu thức không có ngoặc thì nhân chia làm trước, cộng trừ làm sau; biểu thức có ngoặc thì phần trong ngoặc được tính đầu tiên.',
    'Thứ tự thực hiện phép tính: trong ngoặc trước, rồi đến nhân chia, cuối cùng mới là cộng trừ.',
    'Gặp biểu thức có cả cộng trừ lẫn nhân chia mà không có dấu ngoặc, con làm nhân chia trước, cộng trừ sau; có dấu ngoặc thì ưu tiên phần trong ngoặc.',
    'Dấu ngoặc luôn được tính đầu tiên. Khi không có dấu ngoặc, phép nhân và phép chia làm trước phép cộng và phép trừ.',
    'Con nhìn dấu ngoặc trước đã: có ngoặc thì tính trong ngoặc, không có ngoặc thì làm nhân chia rồi mới cộng trừ.',
    'Nhớ quy tắc quen thuộc: trong ngoặc trước, nhân chia tiếp theo, cộng trừ sau cùng.',
    'Không có dấu ngoặc thì nhân chia đi trước, cộng trừ theo sau; còn khi có dấu ngoặc, ta tính giá trị trong ngoặc rồi mới tính tiếp.',
    'Chỉ cần thuộc một câu: ngoặc trước đã, sau đó nhân chia, cộng trừ để sau cùng.',
    'Hai phép tính trong cùng một biểu thức phải xếp hàng: trong ngoặc làm trước, không có ngoặc thì nhân chia được làm trước cộng trừ.',
];

const WORK_NOTE = 'Viết từng bước ra bảng nháp — trong ngoặc và nhân chia trước — rồi nhập giá trị của mỗi biểu thức.';

// ------------------------------------------------------------------- dựng đề
// Số phần cho mỗi dạng, cộng lại đúng 200 (100 câu × 2 phần):
//   24 câu đối chứng  → 48 phần (6 câu mỗi cặp)
//   76 câu còn lại    → 152 phần chia theo bảng dưới
const CONTRAST_EACH = 6;
const FREE_SLOTS = {
    addDiv: 11, subDiv: 11, addMul: 11, subMul: 11,
    mulAdd: 17, mulSub: 17, divAdd: 17, divSub: 17,
    parAddMul: 10, parAddDiv: 10, parSubMul: 10, parSubDiv: 10,
};

function attempt(fn, tries = 4000) {
    for (let i = 0; i < tries; i++) {
        const got = fn();
        if (got) return got;
    }
    throw new Error('không bốc được bộ số hợp lệ sau nhiều lần thử');
}

function buildPlans() {
    // Túi các suất "phần rời", trộn rồi ghép đôi sao cho hai phần của một câu
    // không trùng dạng.
    const bag = [];
    for (const [shape, n] of Object.entries(FREE_SLOTS)) {
        for (let i = 0; i < n; i++) bag.push(shape);
    }
    const pool = shuffle(bag);
    const plans = [];
    while (pool.length) {
        const first = pool.shift();
        let idx = pool.findIndex(s => s !== first);
        if (idx === -1) idx = 0;                 // hết lựa chọn thì đành trùng
        const second = pool.splice(idx, 1)[0];
        plans.push({ kind: 'free', shapes: [first, second] });
    }
    for (const name of Object.keys(CONTRASTS)) {
        for (let i = 0; i < CONTRAST_EACH; i++) plans.push({ kind: 'contrast', name });
    }
    return shuffle(plans);
}

// Mười câu quy tắc, mỗi câu dùng đúng mười lần, THỨ TỰ ĐÃ TRỘN. Nếu cứ xoay
// vòng theo i % 10 thì mọi câu có số thứ tự cùng chữ số cuối lại mở đầu y hệt
// nhau — bé lật vài trang là nhận ra ngay.
function buildRuleOrder() {
    const order = [];
    for (let r = 0; r < RULES.length; r++) {
        for (let k = 0; k < COUNT / RULES.length; k++) order.push(r);
    }
    return shuffle(order);
}

function main() {
    const plans = buildPlans();
    if (plans.length !== COUNT) {
        throw new Error(`kế hoạch ra ${plans.length} câu, cần ${COUNT}`);
    }
    const ruleOrder = buildRuleOrder();

    const usedExpr = new Set();
    const usedPair = new Set();
    const shapeCount = {};
    const questions = [];

    plans.forEach((plan, i) => {
        const [parts, shapes] = attempt(() => {
            let ps, ss;
            if (plan.kind === 'contrast') {
                ps = CONTRASTS[plan.name]();
                ss = CONTRAST_SHAPES[plan.name];
            } else {
                const a = SHAPES[plan.shapes[0]]();
                const b = SHAPES[plan.shapes[1]]();
                ps = (a && b) ? [a, b] : null;
                ss = plan.shapes;
            }
            if (!ps || ps.some(p => !p)) return null;
            if (ps[0].expr === ps[1].expr) return null;
            if (ps.some(p => usedExpr.has(p.expr))) return null;
            const key = ps.map(p => p.expr).join('|');
            if (usedPair.has(key)) return null;
            return [ps, ss];
        });

        // Đảo thứ tự a) b) một cách ngẫu nhiên để bé không đoán được câu nào
        // là câu có ngoặc.
        let ordered = parts, orderedShapes = shapes;
        if (rand() < 0.5) {
            ordered = [parts[1], parts[0]];
            orderedShapes = [shapes[1], shapes[0]];
        }

        ordered.forEach(p => usedExpr.add(p.expr));
        usedPair.add(ordered.map(p => p.expr).join('|'));
        orderedShapes.forEach(s => { shapeCount[s] = (shapeCount[s] || 0) + 1; });

        const rule = RULES[ruleOrder[i]];
        questions.push({
            id: `g4t3-${i + 1}`,
            t: 3,
            topic: 'Toán 4 · Tính giá trị biểu thức',
            q: 'Tính giá trị biểu thức:',
            workNote: WORK_NOTE,
            keys: [],
            answerParts: ordered.map(p => ({ label: p.label, answer: p.answer, expr: p.expr })),
            explanation: `🔑 ${rule}<br>a) ${ordered[0].work}<br>b) ${ordered[1].work}`,
        });
    });

    const bank = {
        t: 3,
        key: 'bieuthuc',
        title: 'Tính giá trị biểu thức',
        icon: '③',
        questions,
    };

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(bank, null, 2) + '\n', 'utf8');

    const dist = Object.keys(SHAPE_LABEL)
        .map(s => `${SHAPE_LABEL[s]}=${shapeCount[s] || 0}`)
        .join(', ');
    const parts = questions.reduce((n, q) => n + q.answerParts.length, 0);
    console.log(
        `gen-math4-t3: ${questions.length} câu · ${parts} biểu thức · ` +
        `${Object.keys(shapeCount).length} dạng (${dist}) · ` +
        `${CONTRAST_EACH * Object.keys(CONTRASTS).length} câu đối chứng có/không dấu ngoặc → ` +
        path.relative(ROOT, OUT)
    );
}

main();
