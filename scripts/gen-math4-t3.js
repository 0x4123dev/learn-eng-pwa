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
// Nhãn (label) được dựng trước theo lối viết ở trường (× : −), rồi MỌI THỨ
// KHÁC — biểu thức ASCII, bước tính trung gian, câu lời giải — đều được SUY
// RA TỪ NHÃN. Nhờ vậy nhãn, đáp án và lời giải không bao giờ nói ba chuyện
// khác nhau. Mỗi hàm dựng biểu thức chỉ phải khai thêm đúng một con số: giá
// trị của phép tính được làm TRƯỚC.
//
// Về lời giải: bé mở nó ra khi đã làm SAI, và lỗi mà dạng này sinh ra để bắt
// là "tính từ trái sang phải". Cho nên lời giải không chỉ in ra dãy tính
// đúng — với mỗi ý nó nói phép nào được làm trước và vì sao, và khi biểu
// thức có bẫy trái-sang-phải thì nó gọi tên luôn phép tính sai mà bé vừa
// làm ("đừng tính 51183 − 89936 trước"). Ở 24 câu đối chứng, lời giải còn có
// một dòng so sánh hai ý, vì cả câu sinh ra là để thấy dấu ngoặc làm gì.

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

// Mọi nhãn của dạng này đều có đúng hình dạng "số op số op số", có thể bọc
// ngoặc quanh hai số đầu. Tách ra năm mảnh là đủ để nói được mọi câu lời giải.
function tokensOf(label) {
    return label.replace(/[()]/g, ' ').trim().split(/\s+/);
}

const HIGH = { [TIMES]: true, [DIVIDE]: true };   // nhân chia — được làm trước
const OP_WORD = {
    '+': 'phép cộng',
    [MINUS]: 'phép trừ',
    [TIMES]: 'phép nhân',
    [DIVIDE]: 'phép chia',
};

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Đọc nhãn ra "giải phẫu" của biểu thức: phép nào làm trước, phép nào làm
// sau, bước trung gian trông thế nào, và bé dễ làm sai kiểu gì.
//
//   kind = 'brk'   — có dấu ngoặc: tính trong ngoặc trước
//          'late'  — không ngoặc, nhân chia đứng SAU  → đây là câu có bẫy
//                    trái-sang-phải, hai phép đầu KHÔNG được làm trước
//          'early' — không ngoặc, nhân chia đứng TRƯỚC → làm lần lượt là đúng
function anatomy(label, firstValue, value) {
    const tk = tokensOf(label);
    const bracket = label.indexOf('(') !== -1;
    const ops = [tk[1], tk[3]];
    const leftPair = `${tk[0]} ${ops[0]} ${tk[2]}`;
    const rightPair = `${tk[2]} ${ops[1]} ${tk[4]}`;
    const firstIsLeft = bracket || HIGH[ops[0]] === true;
    return {
        label, value, bracket, firstValue,
        kind: bracket ? 'brk' : (firstIsLeft ? 'early' : 'late'),
        firstExpr: firstIsLeft ? leftPair : rightPair,
        firstOp: firstIsLeft ? ops[0] : ops[1],
        lastOp: firstIsLeft ? ops[1] : ops[0],
        leftPair,                                   // phép bé hay làm trước — sai
        mid: firstIsLeft ? `${firstValue} ${ops[1]} ${tk[4]}`
                         : `${tk[0]} ${ops[0]} ${firstValue}`,
    };
}

// `firstValue` là giá trị của phép tính được làm TRƯỚC — con số duy nhất mà
// hàm dựng biểu thức phải khai thêm; bước trung gian tự suy ra từ nó.
function part(label, firstValue, value) {
    if (!Number.isInteger(value) || value < 0 || value > BIG_MAX) return null;
    return {
        label,
        answer: String(value),
        expr: exprOf(label),
        step: anatomy(label, firstValue, value),
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
            ? part(`${a} + ${b} ${DIVIDE} ${c}`, q, a + q)
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
            ? part(`${a} ${MINUS} ${b} ${DIVIDE} ${c}`, q, a - q)
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
            ? part(`${a} + ${b} ${TIMES} ${c}`, p, a + p)
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
            ? part(`${a} ${MINUS} ${b} ${TIMES} ${c}`, p, a - p)
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
            ? part(`${a} ${TIMES} ${b} + ${c}`, p, p + c)
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
            ? part(`${a} ${TIMES} ${b} ${MINUS} ${c}`, p, p - c)
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
            ? part(`${a} ${DIVIDE} ${b} + ${c}`, q, q + c)
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
            ? part(`${a} ${DIVIDE} ${b} ${MINUS} ${c}`, q, q - c)
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
            ? part(`(${a} + ${b}) ${TIMES} ${c}`, s, s * c)
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
            ? part(`(${a} + ${b}) ${DIVIDE} ${c}`, s, sq)
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
            ? part(`(${a} ${MINUS} ${b}) ${TIMES} ${c}`, d, d * c)
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
            ? part(`(${a} ${MINUS} ${b}) ${DIVIDE} ${c}`, d, dq)
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
            part(`${a} + ${b} ${DIVIDE} ${c}`, bq, a + bq),
            part(`(${a} + ${b}) ${DIVIDE} ${c}`, a + b, aq + bq),
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
            part(`${a} ${MINUS} ${b} ${DIVIDE} ${c}`, bq, a - bq),
            part(`(${a} ${MINUS} ${b}) ${DIVIDE} ${c}`, d, dq),
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
            part(`${a} + ${b} ${TIMES} ${c}`, b * c, a + b * c),
            part(`(${a} + ${b}) ${TIMES} ${c}`, s, s * c),
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
            part(`${a} ${MINUS} ${b} ${TIMES} ${c}`, b * c, a - b * c),
            part(`(${a} ${MINUS} ${b}) ${TIMES} ${c}`, a - b, (a - b) * c),
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
// Câu quy tắc mở đầu, xếp theo NHÓM. Một câu nhắc dấu ngoặc dán lên biểu thức
// không hề có dấu ngoặc chỉ là tiếng ồn — bé đọc xong vẫn không biết vì sao
// mình sai. Nên mỗi nhóm chỉ nói đúng cái mà hai biểu thức của câu ấy cần:
//
//   trap     — không ngoặc, có ít nhất một ý mà nhân chia đứng SAU: đây mới
//              là chỗ "tính từ trái sang phải" làm hỏng bài, nên câu quy tắc
//              nói thẳng điều đó
//   plain    — không ngoặc, nhân chia đã đứng đầu cả hai ý: chỉ cần quy tắc
//              nhân chia trước, không dọa gì thêm
//   brackets — cả hai ý đều có ngoặc
//   mixed    — một ý có ngoặc, một ý không
//   contrast — hai ý cùng bộ số, chỉ khác dấu ngoặc
const RULES = {
    trap: [
        'Trong biểu thức không có dấu ngoặc, phép nhân và phép chia được làm trước phép cộng và phép trừ — không phải cứ tính từ trái sang phải.',
        'Đọc hết biểu thức rồi hãy đặt bút: không có ngoặc thì tìm phép nhân, phép chia mà làm trước, cộng trừ để sau.',
        'Không có dấu ngoặc thì nhân chia đi trước, cộng trừ theo sau, dù phép nhân hay phép chia đứng ở chỗ nào trong biểu thức.',
        'Nhân chia luôn được làm trước cộng trừ. Vì thế biểu thức không có ngoặc chưa chắc đã tính từ trái sang phải.',
        'Quy tắc cho biểu thức không có dấu ngoặc: nhân chia làm trước, cộng trừ làm sau.',
        'Nhìn cả biểu thức trước đã, đừng tính ngay hai số đầu: không có ngoặc thì phép nhân, phép chia mới là phép được làm trước.',
    ],
    plain: [
        'Biểu thức không có dấu ngoặc thì làm phép nhân, phép chia trước, rồi mới đến phép cộng, phép trừ.',
        'Không có dấu ngoặc: nhân chia trước, cộng trừ sau — ở đây nhân chia đã đứng đầu nên con cứ tính lần lượt.',
        'Quy tắc quen thuộc: trong biểu thức không có dấu ngoặc, nhân chia được làm trước cộng trừ.',
        'Nhân chia trước, cộng trừ sau — đó là thứ tự của mọi biểu thức không có dấu ngoặc.',
        'Tìm phép nhân hoặc phép chia mà làm trước, xong rồi mới cộng trừ.',
    ],
    brackets: [
        'Biểu thức có dấu ngoặc thì tính trong ngoặc trước, xong mới tính tiếp phần ngoài.',
        'Dấu ngoặc luôn được tính đầu tiên, bên trong là phép cộng hay phép trừ cũng vậy.',
        'Thấy dấu ngoặc là làm phần trong ngoặc trước đã.',
        'Trong ngoặc trước, ngoài ngoặc sau — dấu ngoặc sinh ra chính là để đổi thứ tự làm tính.',
        'Phần trong dấu ngoặc được làm trước tiên, tính xong nó rồi mới đến phép còn lại.',
    ],
    mixed: [
        'Có dấu ngoặc thì tính trong ngoặc trước; không có dấu ngoặc thì nhân chia trước, cộng trừ sau.',
        'Thứ tự thực hiện phép tính: trong ngoặc trước, rồi đến nhân chia, cuối cùng mới là cộng trừ.',
        'Nhìn dấu ngoặc trước đã: có ngoặc thì tính trong ngoặc, không có ngoặc thì làm nhân chia rồi mới cộng trừ.',
        'Hai ý dưới đây một ý có ngoặc, một ý không, nên thứ tự làm tính của chúng cũng khác nhau.',
        'Chỉ cần thuộc một câu: ngoặc trước đã, sau đó nhân chia, cộng trừ để sau cùng.',
        'Ý có dấu ngoặc thì tính trong ngoặc trước; ý không có ngoặc thì nhân chia mới là phép được làm trước.',
    ],
    contrast: [
        'Hai ý dưới đây cùng một bộ số, chỉ khác dấu ngoặc — con thử đoán xem kết quả có giống nhau không.',
        'Cùng ba số ấy, thêm một dấu ngoặc là thứ tự làm tính đổi, kết quả cũng đổi theo.',
        'Dấu ngoặc không phải để trang trí: nó bắt phép tính bên trong phải được làm trước.',
        'Đặt hai ý này cạnh nhau sẽ thấy dấu ngoặc mạnh cỡ nào — cùng số mà khác kết quả.',
        'Cùng một bộ số: ý không có ngoặc thì nhân chia làm trước, ý có ngoặc thì phần trong ngoặc làm trước.',
    ],
};

// Câu "vì sao" của mỗi ý. Ba cách nói cho mỗi kiểu, xoay theo số thứ tự câu
// và theo ý a) hay b), để hai trăm dòng không đọc như một con dấu đóng lại.
const WHY = {
    // Bẫy chính của cả dạng: nhân chia đứng sau nhưng phải làm trước. Câu nào
    // cũng gọi tên phép tính SAI mà bé vừa làm, chứ không chỉ khen phép đúng.
    late: [
        s => `Không có dấu ngoặc nên ${OP_WORD[s.firstOp]} được làm trước ${OP_WORD[s.lastOp]}: ${s.firstExpr} = ${s.firstValue}. Đừng tính ${s.leftPair} trước.`,
        s => `${cap(OP_WORD[s.firstOp])} đứng sau nhưng vẫn được làm trước: ${s.firstExpr} = ${s.firstValue}. Chưa vội tính ${s.leftPair} đâu.`,
        s => `Con phải làm ${OP_WORD[s.firstOp]} trước đã: ${s.firstExpr} = ${s.firstValue}. Lấy ${s.leftPair} trước là sai thứ tự.`,
    ],
    // Ở đây thứ tự đúng trùng với trái-sang-phải. Nói thật như vậy, đừng dọa
    // bé về một cái bẫy mà biểu thức này không có.
    early: [
        s => `${cap(OP_WORD[s.firstOp])} đứng ngay đầu nên làm nó trước: ${s.firstExpr} = ${s.firstValue}.`,
        s => `Ở biểu thức này ${OP_WORD[s.firstOp]} đã đứng trước rồi, cứ tính lần lượt: ${s.firstExpr} = ${s.firstValue}.`,
        s => `Không có dấu ngoặc, mà ${OP_WORD[s.firstOp]} đã đứng đầu — làm nó trước: ${s.firstExpr} = ${s.firstValue}.`,
    ],
    // Với biểu thức có ngoặc, bài học nằm ở chỗ NẾU KHÔNG có ngoặc thì thứ tự
    // sẽ khác — nên một trong ba cách nói chỉ thẳng ra điều đó.
    brk: [
        s => `Có dấu ngoặc thì tính trong ngoặc trước: ${s.firstExpr} = ${s.firstValue}.`,
        s => `Dấu ngoặc cho ${OP_WORD[s.firstOp]} được làm trước: ${s.firstExpr} = ${s.firstValue}. Bỏ quên dấu ngoặc là ra kết quả khác hẳn.`,
        s => `Không có dấu ngoặc thì ${OP_WORD[s.lastOp]} mới là phép làm trước, nhưng ở đây có ngoặc: tính trong ngoặc đã, ${s.firstExpr} = ${s.firstValue}.`,
    ],
};

// Bước 2 — thay giá trị vừa tìm được vào rồi làm nốt phép còn lại. Ba cách
// nói, vì hai trăm dòng mở đầu y hệt nhau thì bé thôi không đọc nữa.
const STEP2 = [
    s => `Còn ${OP_WORD[s.lastOp]} nữa thôi: ${s.mid} = ${s.value}.`,
    s => `Thay vào rồi làm nốt ${OP_WORD[s.lastOp]}: ${s.mid} = ${s.value}.`,
    s => `Biểu thức chỉ còn ${OP_WORD[s.lastOp]}: ${s.mid} = ${s.value}.`,
];

// Dòng khép lại của một câu đối chứng — chỗ duy nhất trong cả dạng nói được
// "cùng số mà khác kết quả", nên nó phải nêu cả hai kết quả và cả hai lý do.
// Ba cách nói, xoay theo số thứ tự câu, để nó không lặp lại nguyên văn câu
// quy tắc 🔑 vừa đứng ngay phía trên.
const COMPARE = [
    (tF, F, tB, B) => `Hai ý cùng ba số mà kết quả khác hẳn: ý ${tF} không có ngoặc nên ${OP_WORD[F.firstOp]} làm trước, ra <b>${F.value}</b>; ý ${tB} có ngoặc nên ${OP_WORD[B.firstOp]} làm trước, ra <b>${B.value}</b>.`,
    (tF, F, tB, B) => `Nhìn kỹ mà xem: ý ${tF} ra <b>${F.value}</b> vì ${OP_WORD[F.firstOp]} được làm trước; ý ${tB} ra <b>${B.value}</b> vì dấu ngoặc bắt ${OP_WORD[B.firstOp]} làm trước. Chỉ khác nhau mỗi dấu ngoặc thôi.`,
    (tF, F, tB, B) => `Khác nhau đúng một dấu ngoặc: ý ${tB} phải làm ${OP_WORD[B.firstOp]} trước nên ra <b>${B.value}</b>, còn ý ${tF} không có ngoặc nên ${OP_WORD[F.firstOp]} làm trước, ra <b>${F.value}</b>.`,
];

function compareLine(ordered, i) {
    const tags = ['a', 'b'];
    const iBrk = ordered[0].step.bracket ? 0 : 1;
    return COMPARE[i % COMPARE.length](
        tags[1 - iBrk], ordered[1 - iBrk].step,
        tags[iBrk], ordered[iBrk].step);
}

function familyOf(ordered, isContrast) {
    if (isContrast) return 'contrast';
    const brackets = ordered.filter(p => p.step.bracket).length;
    if (brackets === 2) return 'brackets';
    if (brackets === 1) return 'mixed';
    return ordered.some(p => p.step.kind === 'late') ? 'trap' : 'plain';
}

// Hình dạng lời giải mà spec bắt buộc (scripts/math4-spec.md, "Lời giải phải
// đi từng bước"): câu quy tắc 🔑 làm ô đầu, rồi nhãn "<b>Áp dụng:</b>" mở ô
// thứ hai chứa các bước. mathSolutionSteps() trong js/math.js chỉ nhận đúng
// hai nhãn ấy làm ranh giới ô; "Bước 1 —" và "Kết quả:" nằm trong cùng một ô,
// mỗi thứ một dòng — đúng cái ta cần, vì hai bước của một biểu thức thuộc về
// nhau.
//
// Mỗi ý ba bước, không hơn: phép nào làm trước và vì sao (Bước 1), biểu thức
// còn lại sau khi thay giá trị vừa tìm được (Bước 2), rồi cả dãy tính viết
// liền một mạch để bé chép vào vở (Kết quả).
function explain(ordered, rule, isContrast, i) {
    const lines = [`🔑 ${rule}`, '<b>Áp dụng:</b>'];
    ordered.forEach((p, k) => {
        const s = p.step;
        const why = WHY[s.kind][(i + k) % WHY[s.kind].length];
        lines.push(`${'ab'[k]}) ${s.label}`);
        lines.push(`Bước 1 — ${why(s)}`);
        lines.push(`Bước 2 — ${STEP2[(i + k) % STEP2.length](s)}`);
        lines.push(`Kết quả: ${s.label} = ${s.mid} = <b>${s.value}</b>`);
    });
    if (isContrast) lines.push(compareLine(ordered, i));
    return lines.join('<br>');
}

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

// Một dãy trăm số 0..9 đã trộn, dùng làm chỗ bắt đầu khi chọn câu quy tắc
// trong nhóm của câu ấy. Nếu cứ xoay vòng theo i thì mọi câu cùng nhóm có số
// thứ tự cách đều nhau lại mở đầu y hệt — bé lật vài trang là nhận ra ngay.
function buildRuleOrder() {
    const order = [];
    for (let r = 0; r < 10; r++) {
        for (let k = 0; k < COUNT / 10; k++) order.push(r);
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
    const famCount = {};
    const questions = [];
    let prevRule = null;

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

        // Chọn câu quy tắc trong đúng nhóm của câu này, rồi đẩy sang câu kế
        // tiếp trong nhóm nếu nó trùng với câu vừa dùng ở câu trước — hai lời
        // giải liền nhau mở đầu giống hệt thì bé bỏ qua luôn dòng 🔑.
        const isContrast = plan.kind === 'contrast';
        const fam = familyOf(ordered, isContrast);
        famCount[fam] = (famCount[fam] || 0) + 1;
        const choices = RULES[fam];
        let r = ruleOrder[i] % choices.length;
        if (choices[r] === prevRule) r = (r + 1) % choices.length;
        prevRule = choices[r];

        questions.push({
            id: `g4t3-${i + 1}`,
            t: 3,
            topic: 'Toán 4 · Tính giá trị biểu thức',
            q: 'Tính giá trị biểu thức:',
            workNote: WORK_NOTE,
            keys: [],
            answerParts: ordered.map(p => ({ label: p.label, answer: p.answer, expr: p.expr })),
            explanation: explain(ordered, choices[r], isContrast, i),
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
    const fams = Object.keys(RULES).map(f => `${f}=${famCount[f] || 0}`).join(', ');
    const parts = questions.reduce((n, q) => n + q.answerParts.length, 0);
    console.log(
        `gen-math4-t3: ${questions.length} câu · ${parts} biểu thức · ` +
        `${Object.keys(shapeCount).length} dạng (${dist}) · ` +
        `${CONTRAST_EACH * Object.keys(CONTRASTS).length} câu đối chứng có/không dấu ngoặc · ` +
        `quy tắc theo nhóm (${fams}) → ` +
        path.relative(ROOT, OUT)
    );
}

main();
