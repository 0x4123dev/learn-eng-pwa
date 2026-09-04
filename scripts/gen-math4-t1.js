#!/usr/bin/env node
// scripts/gen-math4-t1.js — sinh ngân hàng câu hỏi "dạng 1: Đặt tính rồi tính"
// cho đề ôn Toán 4 (xem scripts/math4-spec.md).
//
//   node scripts/gen-math4-t1.js   →  data/math4/math4-t1.json (đúng 100 câu)
//
// Bộ sinh dùng một hạt giống cố định nên chạy bao nhiêu lần cũng ra file y hệt
// nhau (byte-identical). Mọi phép tính đều được MÁY tính, không có con số nào
// gõ tay — một ngân hàng 400 phép tính chép tay chắc chắn sai ở đâu đó.
//
// Mỗi câu có đúng 4 phần, luôn theo thứ tự cộng · trừ · nhân · chia:
//   1) a + b   — cả hai số có 5 chữ số (10000..89999), có ít nhất một cột nhớ
//   2) a − b   — a có 5 chữ số, b có 4 hoặc 5 chữ số, a > b, có ít nhất một
//                cột phải mượn
//   3) a × b   — a có 5 chữ số, b là số có một chữ số 2..9
//   4) a : b   — b là số có một chữ số 2..9, a có 5 chữ số và chia hết cho b

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'math4');
const OUT_FILE = path.join(OUT_DIR, 'math4-t1.json');

const COUNT = 100;
const SEED = 0x4a1c0f41; // hạt giống cố định — đừng đổi, đổi là cả file đổi theo

// ── PRNG (mulberry32) ────────────────────────────────────────────────────────
function makeRandom(seed) {
    let a = seed >>> 0;
    return function random() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rand = makeRandom(SEED);

// số nguyên ngẫu nhiên trong [lo, hi] (bao gồm hai đầu)
function randInt(lo, hi) {
    return lo + Math.floor(rand() * (hi - lo + 1));
}

function shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
    }
    return out;
}

// ── Kiểm tra "có nhớ" / "có mượn" khi đặt tính ───────────────────────────────
// Cộng: duyệt từ hàng đơn vị, hễ một cột nào tổng ≥ 10 là phải nhớ 1 sang trái.
function hasCarry(a, b) {
    let x = a;
    let y = b;
    let carry = 0;
    while (x > 0 || y > 0) {
        const s = (x % 10) + (y % 10) + carry;
        if (s >= 10) return true;
        carry = 0;
        x = Math.floor(x / 10);
        y = Math.floor(y / 10);
    }
    return false;
}

// Trừ: hễ chữ số ở trên bé hơn chữ số ở dưới là phải mượn 1 ở hàng bên trái.
function hasBorrow(a, b) {
    let x = a;
    let y = b;
    let borrow = 0;
    while (y > 0 || x > 0) {
        const top = (x % 10) - borrow;
        const bottom = y % 10;
        if (top < bottom) return true;
        borrow = 0;
        x = Math.floor(x / 10);
        y = Math.floor(y / 10);
    }
    return false;
}

// ── Các phép tính (mỗi phép trả về label · expr · answer) ────────────────────
const MINUS = '−'; // dấu trừ của nhà trường (U+2212), KHÔNG phải gạch nối

function partAdd() {
    for (;;) {
        const a = randInt(10000, 89999);
        const b = randInt(10000, 89999);
        if (!hasCarry(a, b)) continue;
        return { label: `${a} + ${b}`, answer: String(a + b), expr: `${a}+${b}` };
    }
}

function partSub(wantFourDigit) {
    for (;;) {
        const a = randInt(20000, 99999);
        const b = wantFourDigit ? randInt(1000, 9999) : randInt(10000, a - 1);
        if (b >= a) continue;
        if (!hasBorrow(a, b)) continue;
        return { label: `${a} ${MINUS} ${b}`, answer: String(a - b), expr: `${a}-${b}` };
    }
}

function partMul(b) {
    const a = randInt(10000, 99999);
    return { label: `${a} × ${b}`, answer: String(a * b), expr: `${a}*${b}` };
}

function partDiv(b) {
    // Lấy thương trước rồi nhân lên, thế thì số bị chia luôn chia hết cho b.
    const qLo = Math.ceil(10000 / b);
    const qHi = Math.floor(99999 / b);
    const q = randInt(qLo, qHi);
    const a = q * b;
    return { label: `${a} : ${b}`, answer: String(q), expr: `${a}/${b}` };
}

// ── Rải đều số nhân và số chia 2..9 ──────────────────────────────────────────
// Nếu cứ bốc ngẫu nhiên thì có số xuất hiện 5 lần, có số 20 lần. Ở đây dựng sẵn
// một túi 100 số cân bằng (mỗi số 12 hoặc 13 lần) rồi mới xáo.
function balancedDigits() {
    const bag = [];
    for (let round = 0; round < Math.floor(COUNT / 8); round++) {
        for (let d = 2; d <= 9; d++) bag.push(d);
    }
    const extra = shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, COUNT - bag.length);
    for (const d of extra) bag.push(d);
    return shuffle(bag);
}

// ── Lời giải ─────────────────────────────────────────────────────────────────
// Mười câu quy tắc, xoay vòng, để bé đọc năm lời giải liền nhau không gặp lại
// đúng một câu chữ. Không được có "/", "^", "<", ">" ngoài thẻ <b> và <br>.
const RULES = [
    'Đặt tính thẳng cột: đơn vị dưới đơn vị, chục dưới chục; cộng, trừ, nhân đều tính từ phải sang trái, còn chia thì chia từ trái sang phải.',
    'Cộng từ hàng đơn vị, cột nào được từ 10 trở lên thì viết chữ số hàng đơn vị và nhớ 1 sang cột bên trái.',
    'Khi trừ, gặp chữ số ở trên bé hơn chữ số ở dưới thì mượn 1 ở cột bên trái, trừ xong nhớ trả lại 1 vào cột vừa mượn.',
    'Nhân số có năm chữ số với số có một chữ số: nhân lần lượt từ hàng đơn vị, phần chục của mỗi lần nhân thì nhớ sang hàng liền trước.',
    'Phép chia đi ngược với ba phép kia: chia từ hàng cao nhất bên trái, hạ dần từng chữ số, mỗi lần chia được một chữ số của thương.',
    'Chỉ cần một chữ số đặt lệch cột là sai cả phép tính, nên viết thật thẳng hàng rồi hãy tính.',
    'Nhớ 1 khi cộng thì cộng thêm 1 vào cột bên trái; mượn 1 khi trừ thì cột bên trái phải bớt đi 1.',
    'Tính xong nên thử lại: lấy hiệu cộng với số trừ phải ra số bị trừ, lấy thương nhân với số chia phải ra số bị chia.',
    'Chia hết nghĩa là đến chữ số cuối cùng vẫn chia được và số dư bằng 0; nếu còn dư thì em đặt tính hoặc hạ số sai rồi.',
    'Làm bốn phép tính này theo đúng thứ tự cộng, trừ, nhân, chia và viết kết quả thẳng dưới phép tính cho dễ soát lại.',
];

function explain(index, parts) {
    const rule = RULES[index % RULES.length];
    const lines = parts.map((p) => `${p.label} = <b>${p.answer}</b>`);
    return `🔑 ${rule}<br>${lines.join('<br>')}`;
}

// ── Sinh ngân hàng ───────────────────────────────────────────────────────────
const multipliers = balancedDigits();
const divisors = balancedDigits();

const questions = [];
const seenTuples = new Set();

for (let i = 0; i < COUNT; i++) {
    let parts;
    let tuple;
    for (;;) {
        parts = [
            partAdd(),
            partSub(i % 2 === 0), // xen kẽ số trừ 4 chữ số và 5 chữ số
            partMul(multipliers[i]),
            partDiv(divisors[i]),
        ];
        tuple = parts.map((p) => p.expr).join('|');
        if (!seenTuples.has(tuple)) break;
    }
    seenTuples.add(tuple);

    questions.push({
        id: `g4t1-${i + 1}`,
        t: 1,
        topic: 'Toán 4 · Đặt tính rồi tính',
        q: 'Đặt tính rồi tính:',
        workNote: 'Đặt tính ra bảng nháp rồi nhập kết quả của từng phép tính.',
        keys: [],
        answerParts: parts,
        explanation: explain(i, parts),
    });
}

// ── Tự kiểm trước khi ghi ────────────────────────────────────────────────────
// Bộ sinh nào cũng phải tự soát lại mình: thà gãy ở đây còn hơn ra tới máy bé.
function selfCheck(list) {
    if (list.length !== COUNT) throw new Error(`cần ${COUNT} câu, đang có ${list.length}`);
    list.forEach((qn, i) => {
        if (qn.id !== `g4t1-${i + 1}`) throw new Error(`id sai ở câu ${i + 1}: ${qn.id}`);
        if (qn.answerParts.length !== 4) throw new Error(`${qn.id}: cần 4 phần`);
        for (const field of [qn.q, qn.explanation]) {
            const bare = field.replace(/<\/?b>|<br>/g, '');
            if (/[/^<>]/.test(bare)) throw new Error(`${qn.id}: kí tự cấm trong q hoặc explanation`);
        }
        if (!qn.explanation.startsWith('🔑 ')) throw new Error(`${qn.id}: lời giải phải mở đầu bằng 🔑`);
        qn.answerParts.forEach((p) => {
            if (!/^\d+$/.test(p.answer)) throw new Error(`${qn.id}: đáp án phải là chữ số`);
            if (!/^[0-9+\-*/() ]+$/.test(p.expr)) throw new Error(`${qn.id}: expr có kí tự lạ`);
            if (!qn.explanation.includes(`${p.label} = <b>${p.answer}</b>`)) {
                throw new Error(`${qn.id}: lời giải thiếu phép ${p.label}`);
            }
        });
        const [add, sub, mul, div] = qn.answerParts;
        const nums = (p) => p.expr.split(/[+\-*/]/).map(Number);
        const [a1, b1] = nums(add);
        if (a1 < 10000 || a1 > 89999 || b1 < 10000 || b1 > 89999) throw new Error(`${qn.id}: phép cộng lệch khoảng`);
        if (!hasCarry(a1, b1)) throw new Error(`${qn.id}: phép cộng không có nhớ`);
        const [a2, b2] = nums(sub);
        if (a2 < 10000 || a2 > 99999) throw new Error(`${qn.id}: số bị trừ không có 5 chữ số`);
        if (b2 < 1000 || b2 >= a2) throw new Error(`${qn.id}: số trừ lệch khoảng`);
        if (!hasBorrow(a2, b2)) throw new Error(`${qn.id}: phép trừ không có mượn`);
        const [a3, b3] = nums(mul);
        if (a3 < 10000 || a3 > 99999 || b3 < 2 || b3 > 9) throw new Error(`${qn.id}: phép nhân lệch khoảng`);
        const [a4, b4] = nums(div);
        if (a4 < 10000 || a4 > 99999 || b4 < 2 || b4 > 9) throw new Error(`${qn.id}: phép chia lệch khoảng`);
        if (a4 % b4 !== 0) throw new Error(`${qn.id}: phép chia còn dư`);
    });
    const tuples = new Set(list.map((qn) => qn.answerParts.map((p) => p.expr).join('|')));
    if (tuples.size !== list.length) throw new Error('có hai câu trùng bộ bốn phép tính');
}

selfCheck(questions);

const bank = {
    t: 1,
    key: 'dattinh',
    title: 'Đặt tính rồi tính',
    icon: '①',
    questions,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(bank, null, 2) + '\n', 'utf8');

const countBy = (arr) => {
    const m = {};
    for (const d of arr) m[d] = (m[d] || 0) + 1;
    return Object.keys(m).sort().map((k) => `${k}:${m[k]}`).join(' ');
};
console.log(
    `math4-t1: ${questions.length} câu → ${path.relative(ROOT, OUT_FILE)} · số nhân [${countBy(multipliers)}] · số chia [${countBy(divisors)}]`
);
