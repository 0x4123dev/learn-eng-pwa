#!/usr/bin/env node
// scripts/gen-math4-t2.js — Toán 4 · đề ôn "Pre", dạng 2: Tìm X.
//
// Usage:
//   node scripts/gen-math4-t2.js
//
// Writes data/math4/math4-t2.json with exactly 100 questions, two answerParts
// each. Deterministic: fixed seed, no arguments, byte-identical on every run.
// Every number is COMPUTED — nothing here is typed by hand.
//
// Contract: scripts/math4-spec.md, section "### t2".
//
// The six forms, and how X comes out:
//   F1  X : a = b   → X = b × a   (X là số bị chia)
//   F2  a : X = b   → X = a : b   (X là số chia)
//   F3  X × a = b   → X = b : a   (X là thừa số)
//   F4  X + a = b   → X = b − a   (X là số hạng)
//   F5  X − a = b   → X = a + b   (X là số bị trừ)
//   F6  a − X = b   → X = a − b   (X là số trừ)
//
// Bands: multipliers/divisors are one digit 2..9, every other number (and X)
// is 4- or 5-digit, X is always a positive whole number, every division is
// exact. The two division forms carry the most weight — that is what the real
// paper asks.
//
// About the lời giải. The mistake this dạng exists to catch is NAMING the
// wrong thành phần: the child reads `84564 : X = 6`, calls X the số bị chia
// and multiplies. So every ý says, in this order, where X stands → what that
// makes it → the rule for that thành phần → the sum → a check. Simply
// asserting "X là số chia" (which is what this file used to do) restates the
// answer without ever showing the child how to see it for themselves.

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------- constants

const COUNT = 100;
const MAXV = 99999; // nothing in this bank goes past five digits
const MINV = 1000; // "4- or 5-digit"
const SEED = 0x54494d58; // "TIMX"

const OUT = path.join(__dirname, '..', 'data', 'math4', 'math4-t2.json');

// How many of the 200 parts each form gets. Division forms (F1, F2) heaviest,
// then the multiplication form, then the three additive ones.
const WEIGHTS = { F1: 46, F2: 46, F3: 34, F4: 24, F5: 24, F6: 26 };
const FORM_ORDER = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'];

// The canonical school rule per form, worded the way a lớp-4 teacher says it.
// It is only ever printed AFTER the sentence that names X, because naming the
// thành phần is the step the child actually gets wrong.
const RULES = {
  F1: 'Muốn tìm số bị chia ta lấy thương nhân với số chia',
  F2: 'Muốn tìm số chia ta lấy số bị chia chia cho thương',
  F3: 'Muốn tìm thừa số chưa biết ta lấy tích chia cho thừa số kia',
  F4: 'Muốn tìm số hạng chưa biết ta lấy tổng trừ đi số hạng kia',
  F5: 'Muốn tìm số bị trừ ta lấy hiệu cộng với số trừ',
  F6: 'Muốn tìm số trừ ta lấy số bị trừ trừ đi hiệu',
};

// HOW THE CHILD CAN TELL which thành phần X is — the missing half of the old
// explanation, which simply asserted "X là số chia" and left the child no way
// to see it. The tell is always the same: WHERE X stands. So each sentence
// points at the vị trí first, then names the other two numbers so the child
// cannot swap them either.
//
// The two forms where X stands AFTER the dấu (F2 and F6) are the ones a child
// mis-names — they read `84564 : X = 6` and treat X as the số bị chia, then
// multiply. Every variant of those two spells the contrast out.
//
// Three wordings per form, dealt in rotation, so the same sentence never lands
// twice in a row (see nextVariant).
const IDENTIFY = {
  // X : a = b — a là số chia, b là thương
  F1: [
    (a, b) => `X đứng trước dấu chia nên X là số bị chia (${a} là số chia, ${b} là thương)`,
    (a, b) => `X đứng ngay trước dấu chia, tức là ở chỗ của số bị chia; số chia là ${a}, thương là ${b}`,
    (a, b) => `X là số bị chia vì X đứng trước dấu chia; ${a} là số chia còn ${b} là thương`,
  ],
  // a : X = b — a là số bị chia, b là thương
  F2: [
    (a, b) => `X đứng sau dấu chia nên X là số chia chứ không phải số bị chia (số bị chia là ${a}, thương là ${b})`,
    (a, b) => `X đứng ngay sau dấu chia, tức là ở chỗ của số chia; ${a} mới là số bị chia, ${b} là thương`,
    (a, b) => `X là số chia vì X đứng sau dấu chia, đừng nhầm X với số bị chia; số bị chia ở đây là ${a}, thương là ${b}`,
  ],
  // X × a = b — a là thừa số kia, b là tích
  F3: [
    (a, b) => `X đứng ở phép nhân nên X là thừa số chưa biết (${a} là thừa số kia, ${b} là tích)`,
    (a, b) => `trong phép nhân, hai số nhân với nhau đều gọi là thừa số, kết quả gọi là tích; ở đây X là thừa số chưa biết, ${a} là thừa số đã biết, ${b} là tích`,
    (a, b) => `X là một thừa số của phép nhân, thừa số kia là ${a}, còn ${b} là tích`,
  ],
  // X + a = b — a là số hạng kia, b là tổng
  F4: [
    (a, b) => `X đứng ở phép cộng nên X là số hạng chưa biết (${a} là số hạng kia, ${b} là tổng)`,
    (a, b) => `trong phép cộng, hai số cộng với nhau đều gọi là số hạng, kết quả gọi là tổng; ở đây X là số hạng chưa biết, ${a} là số hạng đã biết, ${b} là tổng`,
    (a, b) => `X là một số hạng của phép cộng, số hạng kia là ${a}, còn ${b} là tổng`,
  ],
  // X − a = b — a là số trừ, b là hiệu
  F5: [
    (a, b) => `X đứng trước dấu trừ nên X là số bị trừ (${a} là số trừ, ${b} là hiệu)`,
    (a, b) => `X đứng ngay trước dấu trừ, tức là ở chỗ của số bị trừ; số trừ là ${a}, hiệu là ${b}`,
    (a, b) => `X là số bị trừ vì X đứng trước dấu trừ; ${a} là số trừ còn ${b} là hiệu`,
  ],
  // a − X = b — a là số bị trừ, b là hiệu
  F6: [
    (a, b) => `X đứng sau dấu trừ nên X là số trừ chứ không phải số bị trừ (số bị trừ là ${a}, hiệu là ${b})`,
    (a, b) => `X đứng ngay sau dấu trừ, tức là ở chỗ của số trừ; ${a} mới là số bị trừ, ${b} là hiệu`,
    (a, b) => `X là số trừ vì X đứng sau dấu trừ, đừng nhầm X với số bị trừ; số bị trừ ở đây là ${a}, hiệu là ${b}`,
  ],
};

// The 🔑 line. Same idea three ways, rotated by question index so the file does
// not read as one sentence repeated a hundred times.
const OPENERS = [
  'Muốn tìm X thì nhìn xem X đứng ở chỗ nào trong phép tính đã, biết X là thành phần nào rồi mới dùng quy tắc của thành phần đó.',
  'Đừng vội tính. Vị trí của X cho biết X là thành phần gì, mỗi thành phần có một quy tắc tìm riêng.',
  'Gọi đúng tên thành phần của X trước khi tính: X đứng ở chỗ nào thì mang tên của chỗ ấy, chọn nhầm tên là chọn nhầm quy tắc.',
];

// --------------------------------------------------------------------- PRNG

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(SEED);

/** Inclusive integer in [min, max]. */
function ri(min, max) {
  if (max < min) throw new Error(`ri: empty range ${min}..${max}`);
  return min + Math.floor(rnd() * (max - min + 1));
}

/** One-digit multiplier or divisor. */
function d1() {
  return ri(2, 9);
}

/** A 4- or 5-digit number, never above `cap`. Leans 5-digit like the paper. */
function d45(cap) {
  const hi = Math.min(MAXV, cap);
  if (hi < MINV) throw new Error(`d45: cap ${cap} below ${MINV}`);
  if (hi >= 10000 && rnd() < 0.62) return ri(10000, hi);
  return ri(MINV, Math.min(9999, hi));
}

// ---------------------------------------------------------------- the forms
//
// Each builder returns the whole part: what the child reads (`label`), the
// digits typed (`answer`), the build-time check string (`expr`), the worked
// line (`work`), the two numbers the equation shows (`a`, `b` — used to name
// the OTHER thành phần in the explanation) and the "Thử lại" line (`check`).
//
// EVERY form carries a check now. It used to be one per question, chosen by a
// priority table, which left the child who got the other ý wrong with nothing
// to test their answer against — exactly the child the explanation is for.
//
// The check is the original equation with X put back, so the child can see it
// is the same line they were given. The one exception is F2 (`a : X = b`):
// putting X back would ask a lớp-4 child to divide 84564 by 14094. There the
// check is the multiplication that undoes the division, and it says so.
//
// `label` uses school notation — × : − (U+2212). `expr` is ASCII + - * / and
// must evaluate to exactly Number(answer).

const BUILDERS = {
  // X : a = b   →   X = b × a
  F1() {
    const a = d1();
    const b = d45(Math.floor(MAXV / a));
    const x = b * a;
    return {
      form: 'F1',
      a,
      b,
      label: `X : ${a} = ${b}`,
      answer: String(x),
      expr: `${b}*${a}`,
      work: `${b} × ${a}`,
      check: `Thử lại: ${x} : ${a} = ${b}.`,
    };
  },

  // a : X = b   →   X = a : b
  // Đúng như đề: thương là số có một chữ số, X là số chia lớn. Giữ thương một
  // chữ số để phép chia đi tìm X vẫn là "chia cho số có một chữ số" — nếu để X
  // nhỏ thì thương thành số 5 chữ số và trẻ lớp 4 không chia nổi.
  F2() {
    const b = d1();
    const x = ri(MINV, Math.floor(MAXV / b));
    const a = x * b;
    return {
      form: 'F2',
      a,
      b,
      label: `${a} : X = ${b}`,
      answer: String(x),
      expr: `${a}/${b}`,
      work: `${a} : ${b}`,
      // Thử phép chia bằng phép nhân: số chia × thương = số bị chia. Thay X
      // vào đúng như đề thì bé phải chia 5 chữ số cho 5 chữ số — không làm nổi.
      check: `Thử lại bằng phép nhân: ${x} × ${b} = ${a}, đúng bằng số bị chia.`,
    };
  },

  // X × a = b   →   X = b : a
  F3() {
    const a = d1();
    const x = ri(MINV, Math.floor(MAXV / a));
    const b = x * a;
    return {
      form: 'F3',
      a,
      b,
      label: `X × ${a} = ${b}`,
      answer: String(x),
      expr: `${b}/${a}`,
      work: `${b} : ${a}`,
      check: `Thử lại: ${x} × ${a} = ${b}.`,
    };
  },

  // X + a = b   →   X = b − a
  F4() {
    const x = d45(MAXV - MINV);
    const a = d45(MAXV - x);
    const b = x + a;
    return {
      form: 'F4',
      a,
      b,
      label: `X + ${a} = ${b}`,
      answer: String(x),
      expr: `${b}-${a}`,
      work: `${b} − ${a}`,
      check: `Thử lại: ${x} + ${a} = ${b}.`,
    };
  },

  // X − a = b   →   X = a + b
  F5() {
    const a = d45(MAXV - MINV);
    const b = d45(MAXV - a);
    const x = a + b;
    return {
      form: 'F5',
      a,
      b,
      label: `X − ${a} = ${b}`,
      answer: String(x),
      expr: `${a}+${b}`,
      // Hiệu TRƯỚC, số trừ sau — cùng thứ tự với câu quy tắc ngay trên nó
      // ("lấy hiệu cộng với số trừ"). Cộng thì đảo cũng ra thế, nhưng bé đang
      // học thuộc quy tắc: dòng tính phải đọc đúng như câu vừa đọc.
      work: `${b} + ${a}`,
      check: `Thử lại: ${x} − ${a} = ${b}.`,
    };
  },

  // a − X = b   →   X = a − b
  F6() {
    const b = d45(MAXV - MINV);
    const x = d45(MAXV - b);
    const a = b + x;
    return {
      form: 'F6',
      a,
      b,
      label: `${a} − X = ${b}`,
      answer: String(x),
      expr: `${a}-${b}`,
      work: `${a} − ${b}`,
      check: `Thử lại: ${a} − ${x} = ${b}.`,
    };
  },
};

// ------------------------------------------------------------ form spreading

/** Fisher-Yates with the seeded PRNG. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = ri(0, i);
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/**
 * Turn the per-form weights into 100 pairs of two DIFFERENT forms, hitting the
 * weights exactly. Shuffle the 200 slots, cut them into pairs, then repair the
 * pairs that came out doubled — so all fifteen combinations of forms show up
 * in proportion, instead of the same two forms meeting every time.
 */
function buildPairs() {
  const slots = [];
  for (const f of FORM_ORDER) {
    for (let i = 0; i < WEIGHTS[f]; i++) slots.push(f);
  }
  if (slots.length !== COUNT * 2) {
    throw new Error(`weights sum to ${slots.length}, expected ${COUNT * 2}`);
  }
  shuffle(slots);

  const pairs = [];
  for (let i = 0; i < COUNT; i++) pairs.push([slots[2 * i], slots[2 * i + 1]]);

  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][0] !== pairs[i][1]) continue;
    const f = pairs[i][0];
    let fixed = false;
    for (let step = 1; step < pairs.length && !fixed; step++) {
      const j = (i + step) % pairs.length;
      for (const k of [0, 1]) {
        // take a slot that is not f, out of a pair whose other slot is not f
        if (pairs[j][k] === f || pairs[j][1 - k] === f) continue;
        const t = pairs[i][1];
        pairs[i][1] = pairs[j][k];
        pairs[j][k] = t;
        fixed = true;
        break;
      }
    }
    if (!fixed) throw new Error(`cannot split the doubled pair ${f}+${f}`);
  }

  const tally = {};
  for (const p of pairs) for (const f of p) tally[f] = (tally[f] || 0) + 1;
  for (const f of FORM_ORDER) {
    if (tally[f] !== WEIGHTS[f]) throw new Error(`form ${f}: ${tally[f]} ≠ ${WEIGHTS[f]}`);
  }
  return pairs;
}

const pairKey = (p) => p.slice().sort().join('+');

/**
 * Deal the pairs out so the six forms stay spread over the 100 instead of
 * clumping: flip half of them so neither form always lands in part a), then
 * repeatedly take from the biggest remaining bucket that is not the one just
 * used. Two questions in a row never carry the same pair of forms.
 */
function spread(pairs) {
  for (const p of pairs) {
    if (rnd() < 0.5) {
      const t = p[0];
      p[0] = p[1];
      p[1] = t;
    }
  }
  const buckets = new Map();
  for (const p of pairs) {
    const k = pairKey(p);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(p);
  }
  for (const arr of buckets.values()) shuffle(arr);
  const biggest = Math.max(...[...buckets.values()].map((a) => a.length));
  if (biggest > Math.ceil(pairs.length / 2)) {
    throw new Error(`a pair of forms owns ${biggest} of ${pairs.length} — cannot spread`);
  }

  const out = [];
  let prev = null;
  while (out.length < pairs.length) {
    const live = [...buckets.keys()].filter((k) => buckets.get(k).length > 0);
    const open = live.filter((k) => k !== prev);
    const from = open.length ? open : live;
    const top = Math.max(...from.map((k) => buckets.get(k).length));
    const tied = from.filter((k) => buckets.get(k).length === top).sort();
    const key = tied[ri(0, tied.length - 1)];
    out.push(buckets.get(key).pop());
    prev = key;
  }
  return out;
}

// -------------------------------------------------------------- explanations

const PART_TAG = ['a)', 'b)'];

// One counter per form, advanced in file order, so consecutive appearances of
// the SAME form always take different wording. (Within one question the two ý
// are different forms by construction, so they can never collide either.)
// It is a plain counter, not a random pick: the generator must stay
// deterministic, and this way it also never repeats a sentence back to back.
const variantSeen = {};

function nextVariant(form) {
  const n = variantSeen[form] || 0;
  variantSeen[form] = n + 1;
  return n % IDENTIFY[form].length;
}

/**
 * Three lines per ý, in the order the child needs them:
 *   1. the equation, then HOW you can tell which thành phần X is;
 *   2. the rule for that thành phần, and the sum;
 *   3. the check, so the child can prove the answer to themselves.
 * Both ý get all three — a child who missed part b) is not helped by a
 * "Thử lại" that only covers part a).
 */
function explainPart(p, i) {
  const tell = IDENTIFY[p.form][nextVariant(p.form)](p.a, p.b);
  return [
    `${PART_TAG[i]} ${p.label} — ${tell}.`,
    `${RULES[p.form]}: X = ${p.work} = <b>${p.answer}</b>.`,
    p.check,
  ].join('<br>');
}

function explain(parts, index) {
  const opener = OPENERS[index % OPENERS.length];
  return `🔑 ${opener}<br>${parts.map(explainPart).join('<br>')}`;
}

// ---------------------------------------------------------- self-check (cheap)

function assertPart(p, id) {
  const x = Number(p.answer);
  if (!/^[1-9][0-9]*$/.test(p.answer)) throw new Error(`${id}: bad answer ${p.answer}`);
  if (!Number.isInteger(x) || x <= 0) throw new Error(`${id}: X not a positive integer`);
  if (x > MAXV) throw new Error(`${id}: X ${x} above five digits`);
  const m = /^([0-9]+)([-+*/])([0-9]+)$/.exec(p.expr);
  if (!m) throw new Error(`${id}: bad expr ${p.expr}`);
  const l = Number(m[1]);
  const r = Number(m[3]);
  let v;
  if (m[2] === '+') v = l + r;
  else if (m[2] === '-') v = l - r;
  else if (m[2] === '*') v = l * r;
  else {
    if (r === 0 || l % r !== 0) throw new Error(`${id}: inexact division ${p.expr}`);
    v = l / r;
  }
  if (v !== x) throw new Error(`${id}: expr ${p.expr} = ${v}, answer says ${p.answer}`);
  // every number written in the label is either one digit 2..9 or 4-5 digit
  for (const n of p.label.match(/[0-9]+/g) || []) {
    const val = Number(n);
    const ok = (val >= 2 && val <= 9 && n.length === 1) || (val >= MINV && val <= MAXV);
    if (!ok) throw new Error(`${id}: number ${n} outside the band`);
  }
}

function assertText(s, id) {
  const bare = s.replace(/<\/?b>/g, '').replace(/<br>/g, '');
  for (const ch of ['/', '^', '<', '>']) {
    if (bare.includes(ch)) throw new Error(`${id}: forbidden "${ch}" in text`);
  }
  if (bare.includes('tr. ')) throw new Error(`${id}: looks like a page citation`);
}

// --------------------------------------------------------------------- build

function main() {
  const pairs = spread(buildPairs());
  const seenTuple = new Set();
  const seenExpr = new Set();
  const questions = [];

  for (let i = 0; i < COUNT; i++) {
    const [fa, fb] = pairs[i];
    const id = `g4t2-${i + 1}`;
    let parts = null;
    for (let tries = 0; tries < 500 && !parts; tries++) {
      const cand = [BUILDERS[fa](), BUILDERS[fb]()];
      const tuple = cand.map((p) => p.expr).join('|');
      if (seenTuple.has(tuple)) continue;
      if (seenExpr.has(cand[0].expr) || seenExpr.has(cand[1].expr)) continue;
      if (cand[0].expr === cand[1].expr) continue;
      if (cand[0].label === cand[1].label) continue;
      seenTuple.add(tuple);
      seenExpr.add(cand[0].expr);
      seenExpr.add(cand[1].expr);
      parts = cand;
    }
    if (!parts) throw new Error(`${id}: could not find two fresh parts`);

    parts.forEach((p) => assertPart(p, id));
    const q = 'Tìm X:';
    const explanation = explain(parts, i);
    assertText(q, id);
    assertText(explanation, id);

    questions.push({
      id,
      t: 2,
      topic: 'Toán 4 · Tìm X',
      q,
      workNote:
        'Nhớ lại quy tắc tìm thành phần chưa biết, tính ra bảng nháp rồi nhập giá trị của X.',
      keys: [],
      answerParts: parts.map((p) => ({ label: p.label, answer: p.answer, expr: p.expr })),
      explanation,
    });
  }

  if (questions.length !== COUNT) throw new Error(`built ${questions.length} questions`);

  const bank = {
    t: 2,
    key: 'timx',
    title: 'Tìm X',
    icon: '②',
    questions,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(bank, null, 2) + '\n', 'utf8');

  const tally = {};
  for (const q of questions) {
    for (const p of q.answerParts) {
      const f = formOf(p.label);
      tally[f] = (tally[f] || 0) + 1;
    }
  }
  const dist = FORM_ORDER.map((f) => `${FORM_LABEL[f]}=${tally[f] || 0}`).join(' ');
  console.log(
    `math4-t2: ${questions.length} câu, ${questions.length * 2} phần · ${dist} · ${path.relative(process.cwd(), OUT)}`
  );
}

const FORM_LABEL = {
  F1: 'X:a=b',
  F2: 'a:X=b',
  F3: 'X×a=b',
  F4: 'X+a=b',
  F5: 'X−a=b',
  F6: 'a−X=b',
};

/** Recover the form from the label alone — keeps the summary honest. */
function formOf(label) {
  if (/^X : /.test(label)) return 'F1';
  if (/^[0-9]+ : X /.test(label)) return 'F2';
  if (/^X × /.test(label)) return 'F3';
  if (/^X \+ /.test(label)) return 'F4';
  if (/^X − /.test(label)) return 'F5';
  if (/^[0-9]+ − X /.test(label)) return 'F6';
  throw new Error(`unknown form: ${label}`);
}

main();
