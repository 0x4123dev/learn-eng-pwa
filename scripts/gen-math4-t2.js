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

// The rule the child has to remember, per form. This is the sentence that
// opens the explanation.
const RULES = {
  F1: 'X là số bị chia, muốn tìm số bị chia ta lấy thương nhân với số chia',
  F2: 'X là số chia, muốn tìm số chia ta lấy số bị chia chia cho thương',
  F3: 'X là thừa số, muốn tìm thừa số ta lấy tích chia cho thừa số kia',
  F4: 'X là số hạng chưa biết, ta lấy tổng trừ đi số hạng kia',
  F5: 'X là số bị trừ, muốn tìm số bị trừ ta lấy hiệu cộng với số trừ',
  F6: 'X là số trừ, muốn tìm số trừ ta lấy số bị trừ trừ đi hiệu',
};

// Which part deserves the "Thử lại" line: the nhân/chia part first — that is
// where a child slips — then the cộng/trừ one. Ties keep part a).
const CHECK_PRIORITY = { F1: 0, F2: 0, F3: 0, F4: 1, F5: 1, F6: 1 };

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
// line (`work`) and the "Thử lại" line (`check`).
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
      label: `X : ${a} = ${b}`,
      answer: String(x),
      expr: `${b}*${a}`,
      work: `${b} × ${a}`,
      check: `${x} : ${a} = ${b}`,
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
      label: `${a} : X = ${b}`,
      answer: String(x),
      expr: `${a}/${b}`,
      work: `${a} : ${b}`,
      // Thử phép chia bằng phép nhân: số chia × thương = số bị chia.
      check: `${x} × ${b} = ${a}`,
    };
  },

  // X × a = b   →   X = b : a
  F3() {
    const a = d1();
    const x = ri(MINV, Math.floor(MAXV / a));
    const b = x * a;
    return {
      form: 'F3',
      label: `X × ${a} = ${b}`,
      answer: String(x),
      expr: `${b}/${a}`,
      work: `${b} : ${a}`,
      check: `${x} × ${a} = ${b}`,
    };
  },

  // X + a = b   →   X = b − a
  F4() {
    const x = d45(MAXV - MINV);
    const a = d45(MAXV - x);
    const b = x + a;
    return {
      form: 'F4',
      label: `X + ${a} = ${b}`,
      answer: String(x),
      expr: `${b}-${a}`,
      work: `${b} − ${a}`,
      check: `${x} + ${a} = ${b}`,
    };
  },

  // X − a = b   →   X = a + b
  F5() {
    const a = d45(MAXV - MINV);
    const b = d45(MAXV - a);
    const x = a + b;
    return {
      form: 'F5',
      label: `X − ${a} = ${b}`,
      answer: String(x),
      expr: `${a}+${b}`,
      work: `${a} + ${b}`,
      check: `${x} − ${a} = ${b}`,
    };
  },

  // a − X = b   →   X = a − b
  F6() {
    const b = d45(MAXV - MINV);
    const x = d45(MAXV - b);
    const a = b + x;
    return {
      form: 'F6',
      label: `${a} − X = ${b}`,
      answer: String(x),
      expr: `${a}-${b}`,
      work: `${a} − ${b}`,
      check: `${a} − ${x} = ${b}`,
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

function explain(parts) {
  const rules = parts
    .map((p, i) => `Phần ${PART_TAG[i]} ${RULES[p.form]}.`)
    .join(' ');
  const lines = parts.map(
    (p, i) => `${PART_TAG[i]} ${p.label} nên X = ${p.work} = <b>${p.answer}</b>`
  );
  let best = 0;
  if (CHECK_PRIORITY[parts[1].form] < CHECK_PRIORITY[parts[0].form]) best = 1;
  const check = `Thử lại phần ${PART_TAG[best]}: ${parts[best].check}.`;
  return `🔑 ${rules}<br>${lines.join('<br>')}<br>${check}`;
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
    const explanation = explain(parts);
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
