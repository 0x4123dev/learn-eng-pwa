#!/usr/bin/env node
// scripts/gen-math4-t5.js — dạng 5 của đề ôn Toán 4: "Đổi đơn vị đo".
//
// Sinh đúng 100 câu, mỗi câu 2 phần a) b) thuộc HAI họ đơn vị khác nhau, rồi
// ghi ra data/math4/math4-t5.json. Xem hợp đồng ở scripts/math4-spec.md.
//
//   node scripts/gen-math4-t5.js
//
// Chạy lần nào cũng cho ra đúng một tệp như nhau (hạt giống cố định), không
// phụ thuộc gì ngoài node:fs / node:path. Mọi con số đều được TÍNH, không gõ
// tay: một ngân hàng gõ tay là một ngân hàng sai đáp án.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SEED = 20260904;
const COUNT = 100;
const MAX_VALUE = 100000; // giữ trong tầm số có 5 chữ số của lớp 4

// ---------------------------------------------------------------- PRNG ----
// mulberry32: đủ tốt, và quan trọng hơn là tái lập được từng bit.
function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const ri = (n) => Math.floor(rnd() * n); // 0..n-1
const between = (lo, hi) => lo + ri(hi - lo + 1); // lo..hi, kể cả hai đầu
const pick = (arr) => arr[ri(arr.length)];

// ------------------------------------------------------ bảng đơn vị đo ----
// Quy về đơn vị bé nhất của mỗi họ:
//   khối lượng — 1 tấn = 10 tạ = 100 yến = 1000 kg; 1 kg = 1000 g
//   độ dài     — 1 km = 1000 m; 1 m = 10 dm = 100 cm = 1000 mm
//   thời gian  — 1 ngày = 24 giờ; 1 giờ = 60 phút; 1 phút = 60 giây
//
// `all`     — các cặp (lớn, bé) dùng cho phép đổi thẳng.
// `natural` — các cặp mà sách giáo khoa thật sự viết cạnh nhau trong một dòng
//             ("4 km − 400 m", "2 giờ 30 phút"). Dùng cho cộng, trừ, hỗn hợp;
//             nhờ vậy không sinh ra "2 giờ + 30 giây" nghe rất trái tai.
const FAMILIES = {
  kl: {
    key: 'kl',
    name: 'khối lượng',
    units: { g: 1, kg: 1000, 'yến': 10000, 'tạ': 100000, 'tấn': 1000000 },
    all: [
      ['kg', 'g'], ['tấn', 'kg'], ['tạ', 'kg'], ['yến', 'kg'],
      ['tấn', 'tạ'], ['tấn', 'yến'], ['tạ', 'yến'],
    ],
    natural: [
      ['kg', 'g'], ['tạ', 'kg'], ['tấn', 'kg'], ['yến', 'kg'],
      ['tấn', 'tạ'], ['tạ', 'yến'],
    ],
    via: { 'tấn|yến': 'tạ' },
  },
  dd: {
    key: 'dd',
    name: 'độ dài',
    units: { mm: 1, cm: 10, dm: 100, m: 1000, km: 1000000 },
    all: [
      ['km', 'm'], ['m', 'cm'], ['m', 'dm'], ['m', 'mm'],
      ['dm', 'cm'], ['cm', 'mm'], ['dm', 'mm'],
    ],
    natural: [
      ['km', 'm'], ['m', 'cm'], ['m', 'dm'], ['dm', 'cm'], ['cm', 'mm'],
    ],
    via: { 'm|mm': 'cm', 'dm|mm': 'cm' },
  },
  tg: {
    key: 'tg',
    name: 'thời gian',
    units: { 'giây': 1, 'phút': 60, 'giờ': 3600, 'ngày': 86400 },
    all: [
      ['ngày', 'giờ'], ['giờ', 'phút'], ['phút', 'giây'], ['giờ', 'giây'],
    ],
    natural: [
      ['ngày', 'giờ'], ['giờ', 'phút'], ['phút', 'giây'],
    ],
    via: { 'giờ|giây': 'phút' },
  },
};

function ratio(fam, big, small) {
  const r = fam.units[big] / fam.units[small];
  if (!Number.isInteger(r) || r < 2) {
    throw new Error(`quan hệ đơn vị hỏng: 1 ${big} = ${r} ${small}`);
  }
  return r;
}

// Kiểm bảng đơn vị ngay lúc nạp tệp: một dòng gõ nhầm ở trên sẽ làm hỏng cả
// 100 câu, nên bắt nó chết ở đây chứ đừng để lọt xuống JSON.
for (const fam of Object.values(FAMILIES)) {
  for (const [big, small] of fam.all) ratio(fam, big, small);
  for (const [big, small] of fam.natural) {
    ratio(fam, big, small);
    if (!fam.all.some(([a, b]) => a === big && b === small)) {
      throw new Error(`cặp tự nhiên ${big}/${small} không có trong bảng all`);
    }
  }
  for (const [pairKey, mid] of Object.entries(fam.via || {})) {
    const [big, small] = pairKey.split('|');
    if (ratio(fam, big, mid) * ratio(fam, mid, small) !== ratio(fam, big, small)) {
      throw new Error(`chuỗi đơn vị hỏng: 1 ${big} qua ${mid} xuống ${small}`);
    }
  }
}

// Quan hệ đơn vị viết ra để đưa lên sau chìa khoá 🔑. Với những cặp cách nhau
// hai bậc (1 giờ = 3600 giây, 1 m = 1000 mm) thì viết cả bậc ở giữa: bé lớp 4
// thuộc "1 giờ = 60 phút" chứ không thuộc 3600, và con số 3600 rơi từ trên
// trời xuống là chỗ bé bỏ cuộc.
function relText(fam, big, small) {
  const R = ratio(fam, big, small);
  const mid = (fam.via || {})[`${big}|${small}`];
  if (mid) return `1 ${big} = ${ratio(fam, big, mid)} ${mid} = ${R} ${small}`;
  return `1 ${big} = ${R} ${small}`;
}

// Lỗi thứ hai bé hay mắc (sau lỗi nhân nhầm thành chia) là rơi mất một chữ số
// 0. Khi tỉ số là 10, 100 hay 1000 thì nói thẳng ra phải thêm (bớt) mấy chữ
// số 0; các tỉ số khác (24, 60) thì không nói, vì nói ra là nói sai.
const ZERO_WORD = { 10: 'một', 100: 'hai', 1000: 'ba' };
function zeroWord(R) {
  return ZERO_WORD[R] || '';
}

// Bước nhảy của các con số, để đề đọc lên "tròn" như trong sách:
//   splitStep — khi tách một tổng ra hai số hạng (770 + 230)
//   roundStep — khi chọn phần lẻ đứng sau đơn vị lớn (4 km − 400 m)
function splitStep(R) {
  if (R >= 1000) return 10;
  if (R >= 60) return 5;
  return 1;
}
function roundStep(R) {
  if (R >= 1000) return 100;
  if (R >= 100) return 10;
  if (R >= 60) return 5;
  return 1;
}

const NICE_MULT = [2, 3, 4, 5, 6, 7, 8, 9, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100];

// ------------------------------------------------------- bốn kiểu câu ----
// Mỗi hàm trả về { label, answer, expr, rel, work } hoặc null nếu bốc phải bộ
// số không hợp lệ (vòng lặp ngoài sẽ bốc lại).
//   label — dòng bé điền, kết thúc bằng "= … <đơn vị>"
//   expr  — đúng phép tính ấy viết bằng ASCII, để bước build tự kiểm lại
//   rel   — quan hệ đơn vị cần dùng, đưa lên đầu lời giải sau chìa khoá
//   kind  — kiểu chi tiết, để chọn câu quy tắc cho khớp (xem phần lời giải)
//   work  — dòng trình bày trong lời giải, có <b> quanh đáp số
//
// Dòng `work` phải trả lời được câu hỏi của một bé vừa làm sai: SAI Ở ĐÂU.
// Hai lỗi có thật ở dạng này là (1) nhân trong khi phải chia, và (2) rơi mất
// một chữ số 0. Nên mỗi dòng nói rõ đơn vị nào lớn hơn đơn vị nào TRƯỚC khi
// nhân hay chia, và với phép cộng trừ thì nói rõ phải đưa hai số về cùng một
// đơn vị rồi mới tính — đó chính là lý do 4 km − 400 m không phải 3600 km.

// Đổi thẳng: "5 tấn = … kg" hoặc "7000 g = … kg".
function genPlain(fam) {
  const [big, small] = pick(fam.all);
  const R = ratio(fam, big, small);
  const rel = relText(fam, big, small);
  const pool = NICE_MULT.filter((v) => v * R <= MAX_VALUE);
  if (!pool.length) return null;
  const n = pick(pool);
  const val = n * R;
  const z = zeroWord(R);
  if (rnd() < 0.5) {
    // đơn vị lớn sang đơn vị bé: nhân
    return {
      label: `${n} ${big} = … ${small}`,
      answer: val,
      expr: `${n}*${R}`,
      rel,
      kind: 'plain-mul',
      work: `Vì ${small} bé hơn ${big} nên số đo phải to lên, ta nhân với ${R}`
        + `${z ? ` (viết thêm ${z} chữ số 0)` : ''}: ${n} ${big} = ${n} × ${R} = <b>${val}</b> ${small}.`,
    };
  }
  // đơn vị bé sang đơn vị lớn: chia
  return {
    label: `${val} ${small} = … ${big}`,
    answer: n,
    expr: `${val}/${R}`,
    rel,
    kind: 'plain-div',
    work: `Vì ${big} lớn hơn ${small} nên số đo phải bé lại, ta chia cho ${R}`
      + `${z ? ` (bớt đi ${z} chữ số 0)` : ''}: ${val} ${small} = ${val} : ${R} = <b>${n}</b> ${big}.`,
  };
}

// Phép cộng: "770 g + 230 g = … kg" hoặc "2 tạ + 50 kg = … kg".
function genAdd(fam) {
  const [big, small] = pick(fam.natural);
  const R = ratio(fam, big, small);
  const rel = relText(fam, big, small);

  if (rnd() < 0.5) {
    // hai số hạng cùng đơn vị bé, kết quả hỏi ở đơn vị lớn
    const k = pick([1, 1, 1, 2, 2, 3, 4, 5]);
    const total = k * R;
    if (total > MAX_VALUE) return null;
    const st = splitStep(R);
    const lo = Math.max(st, Math.ceil((total * 0.15) / st) * st);
    const hi = Math.min(total - st, Math.floor((total * 0.85) / st) * st);
    if (hi < lo) return null;
    const x = lo + st * ri((hi - lo) / st + 1);
    const y = total - x;
    if (x <= 0 || y <= 0) return null;
    if (x === y) return null; // "150 phút + 150 phút" đọc như một trò đùa
    return {
      label: `${x} ${small} + ${y} ${small} = … ${big}`,
      answer: k,
      expr: `(${x}+${y})/${R}`,
      rel,
      kind: 'add-same',
      work: `Hai số cùng đơn vị ${small} nên cộng thẳng: ${x} ${small} + ${y} ${small} = ${total} ${small}. `
        + `Đề hỏi ${big}, mà ${big} lớn hơn ${small} nên còn phải chia cho ${R}: `
        + `${total} : ${R} = <b>${k}</b> ${big}.`,
    };
  }

  // đơn vị lớn cộng đơn vị bé, kết quả hỏi ở đơn vị bé
  const n = between(1, 9);
  const st = roundStep(R);
  const s = st * between(1, Math.floor((2 * R) / st));
  if (s % R === 0) return null; // "1 giờ + 60 phút" chỉ là một cách viết thừa
  const answer = n * R + s;
  if (answer > MAX_VALUE) return null;
  return {
    label: `${n} ${big} + ${s} ${small} = … ${small}`,
    answer,
    expr: `${n}*${R}+${s}`,
    rel,
    kind: 'add-cross',
    work: `Hai số khác đơn vị thì chưa cộng được, phải đổi ${n} ${big} ra ${small} trước: `
      + `${n} × ${R} = ${n * R} ${small}. Xong rồi mới cộng được: `
      + `${n * R} ${small} + ${s} ${small} = <b>${answer}</b> ${small}.`,
  };
}

// Phép trừ: "4 km − 400 m = … m" hoặc "5300 g − 2300 g = … kg".
function genSub(fam) {
  const [big, small] = pick(fam.natural);
  const R = ratio(fam, big, small);
  const rel = relText(fam, big, small);
  const st = roundStep(R);

  if (rnd() < 0.55) {
    // đơn vị lớn trừ đơn vị bé, kết quả hỏi ở đơn vị bé — đúng mẫu của đề
    const n = between(1, 9);
    if (n * R > MAX_VALUE) return null;
    const maxS = Math.floor((n * R - st) / st);
    if (maxS < 1) return null;
    const s = st * between(1, maxS);
    const answer = n * R - s;
    if (answer < 1) return null;
    return {
      label: `${n} ${big} − ${s} ${small} = … ${small}`,
      answer,
      expr: `${n}*${R}-${s}`,
      rel,
      kind: 'sub-cross',
      work: `Hai số khác đơn vị thì chưa trừ được, phải đổi ${n} ${big} ra ${small} trước: `
        + `${n} × ${R} = ${n * R} ${small}. Xong rồi mới trừ được: `
        + `${n * R} ${small} − ${s} ${small} = <b>${answer}</b> ${small}.`,
    };
  }

  // hai số cùng đơn vị bé, hiệu hỏi ở đơn vị lớn
  const k = pick([1, 1, 2, 2, 3, 4, 5]);
  const diff = k * R;
  const y = st * between(1, Math.max(1, Math.floor((3 * R) / st)));
  const x = diff + y;
  if (x > MAX_VALUE) return null;
  return {
    label: `${x} ${small} − ${y} ${small} = … ${big}`,
    answer: k,
    expr: `(${x}-${y})/${R}`,
    rel,
    kind: 'sub-same',
    work: `Hai số cùng đơn vị ${small} nên trừ thẳng: ${x} ${small} − ${y} ${small} = ${diff} ${small}. `
      + `Đề hỏi ${big}, mà ${big} lớn hơn ${small} nên còn phải chia cho ${R}: `
      + `${diff} : ${R} = <b>${k}</b> ${big}.`,
  };
}

// Số đo có hai tên đơn vị: "2 giờ 30 phút = … phút", "3 kg 500 g = … g".
function genMixed(fam) {
  const [big, small] = pick(fam.natural);
  const R = ratio(fam, big, small);
  const rel = relText(fam, big, small);
  const st = roundStep(R);
  const maxB = Math.floor((R - 1) / st);
  if (maxB < 1) return null;
  const a = between(1, 9);
  const b = st * between(1, maxB);
  if (b <= 0 || b >= R) return null;
  const answer = a * R + b;
  if (answer > MAX_VALUE) return null;
  return {
    label: `${a} ${big} ${b} ${small} = … ${small}`,
    answer,
    expr: `${a}*${R}+${b}`,
    rel,
    kind: 'mixed',
    work: `${a} ${big} ${b} ${small} là ${a} ${big} và ${b} ${small} gộp lại. `
      + `Đổi ${a} ${big} ra ${small}: ${a} × ${R} = ${a * R} ${small}, rồi cộng thêm ${b} ${small}: `
      + `${a * R} ${small} + ${b} ${small} = <b>${answer}</b> ${small}.`,
  };
}

const SHAPES = ['plain', 'add', 'sub', 'mixed'];
const GEN = { plain: genPlain, add: genAdd, sub: genSub, mixed: genMixed };
const SHAPE_NAME = {
  plain: 'đổi thẳng',
  add: 'phép cộng',
  sub: 'phép trừ',
  mixed: 'số đo hỗn hợp',
};

// ------------------------------------------------------------ lời giải ----
// Câu mở đầu sau chìa khoá, xoay vòng để 100 lời giải không đọc như một câu.
// Bốn nhóm, và nhóm nào chỉ được dùng cho câu thật sự cần nó:
//   RULES_ANY      — hợp với mọi câu (quy tắc nhân/chia theo bậc đơn vị)
//   RULES_CROSS    — có phép cộng/trừ hai số KHÁC đơn vị ("4 km − 400 m")
//   RULES_SAME     — cộng/trừ hai số CÙNG đơn vị rồi đổi kết quả ("770 g + 230 g = … kg")
//   RULES_MIXNAME  — có số đo mang hai tên đơn vị ("2 giờ 30 phút")
// Bảo "hai số phải cùng đơn vị mới cộng được" ở một câu mà hai số vốn đã cùng
// đơn vị thì bé đọc xong vẫn không biết mình sai chỗ nào.
const RULES_ANY = [
  (A, B) => `Nhớ ${A} và ${B}. Đổi ra đơn vị bé hơn thì nhân, đổi ra đơn vị lớn hơn thì chia.`,
  (A, B) => `Bài này cần ${A} và ${B}. Trước khi tính, hãy xem đơn vị nào lớn hơn để biết nên nhân hay nên chia.`,
  (A, B) => `Dựa vào ${A} và ${B}. Đơn vị càng bé thì số đo càng lớn, nên xuống một bậc đơn vị là nhân, lên một bậc đơn vị là chia.`,
  (A, B) => `Theo bảng đơn vị đo thì ${A} và ${B}. Nhân hay chia xong nhớ đếm lại các chữ số 0, thiếu một chữ số 0 là sai cả bài.`,
  (A, B) => `Nhắc lại ${A} và ${B}. Mỗi lần đổi, viết luôn tên đơn vị bên cạnh số thì mới biết mình đang có bao nhiêu.`,
  (A, B) => `Hai quan hệ cần dùng là ${A} và ${B}. Đơn vị lớn đổi ra đơn vị bé thì nhân, đơn vị bé đổi ra đơn vị lớn thì chia.`,
];
const RULES_CROSS = [
  (A, B) => `Ghi nhớ ${A} và ${B}. Hai số phải cùng một đơn vị thì mới cộng, trừ được với nhau.`,
  (A, B) => `Cần thuộc ${A} và ${B}. Đưa hai số về cùng một đơn vị đã, rồi mới cộng trừ như với số tự nhiên.`,
  (A, B) => `Dùng ${A} và ${B}. Đổi trước, tính sau, và kết quả ghi theo đúng đơn vị mà đề hỏi.`,
];
const RULES_SAME = [
  (A, B) => `Trước hết phải thuộc ${A} và ${B}. Hai số cùng đơn vị thì cộng trừ thẳng, xong mới đổi kết quả sang đơn vị đề hỏi.`,
  (A, B) => `Bài dùng ${A} và ${B}. Tính xong đừng vội ghi đáp số, còn phải đổi sang đơn vị mà đề hỏi nữa.`,
];
const RULES_MIXNAME = [
  (A, B) => `Nhớ ${A} và ${B}. Số đo có hai tên đơn vị thì đổi phần đơn vị lớn ra đơn vị bé, rồi cộng với phần còn lại.`,
  (A, B) => `Cần ${A} và ${B}. Gặp số đo viết bằng hai đơn vị, ta đổi phần lớn thành đơn vị bé rồi cộng vào phần bé.`,
];

// ------------------------------------------------------------- lắp bài ----
const FAM_PAIRS = [['kl', 'dd'], ['kl', 'tg'], ['dd', 'tg']];
// Lệch pha kiểu câu theo từng họ, để mỗi họ đều đi hết bốn kiểu chứ không
// dồn cục — chia đều là việc của bộ đếm, không phải của bộ sinh ngẫu nhiên.
const SHAPE_OFFSET = { kl: 0, dd: 1, tg: 2 };

const usedLabels = new Set();
const usedExprPairs = new Set();
const famCount = { kl: 0, dd: 0, tg: 0 };

function nextShape(famKey) {
  const s = SHAPES[(famCount[famKey] + SHAPE_OFFSET[famKey]) % SHAPES.length];
  famCount[famKey] += 1;
  return s;
}

function makePart(famKey, shape) {
  const fam = FAMILIES[famKey];
  for (let tries = 0; tries < 6000; tries += 1) {
    const p = GEN[shape](fam);
    if (!p) continue;
    if (!Number.isInteger(p.answer) || p.answer < 0) continue;
    if (usedLabels.has(p.label)) continue;
    usedLabels.add(p.label);
    p.fam = famKey;
    p.shape = shape;
    return p;
  }
  throw new Error(`không sinh nổi phần "${shape}" của họ ${famKey}`);
}

const questions = [];
let prevRuleTmpl = null;
const famTally = { kl: 0, dd: 0, tg: 0 };
const shapeTally = { plain: 0, add: 0, sub: 0, mixed: 0 };
for (let i = 0; i < COUNT; i += 1) {
  const pair = FAM_PAIRS[i % FAM_PAIRS.length];
  const flip = Math.floor(i / FAM_PAIRS.length) % 2 === 1;
  const famA = flip ? pair[1] : pair[0];
  const famB = flip ? pair[0] : pair[1];

  const a = makePart(famA, nextShape(famA));
  const shapeB = nextShape(famB);
  let b = null;
  for (let tries = 0; tries < 6000; tries += 1) {
    const cand = makePart(famB, shapeB);
    const key = `${a.expr}|${cand.expr}`;
    if (!usedExprPairs.has(key)) {
      usedExprPairs.add(key);
      b = cand;
      break;
    }
  }
  if (!b) throw new Error(`câu ${i + 1}: trùng cặp expr mãi không thoát`);

  for (const p of [a, b]) {
    famTally[p.fam] += 1;
    shapeTally[p.shape] += 1;
  }

  const kinds = [a.kind, b.kind];
  let pool = RULES_ANY;
  if (kinds.some((k) => k === 'add-cross' || k === 'sub-cross')) pool = pool.concat(RULES_CROSS);
  if (kinds.some((k) => k === 'add-same' || k === 'sub-same')) pool = pool.concat(RULES_SAME);
  if (kinds.includes('mixed')) pool = pool.concat(RULES_MIXNAME);
  // Xoay vòng, và nếu vòng quay rơi đúng vào câu vừa dùng ở bài trước thì bước
  // sang câu kế: hai bài liền nhau mở đầu y hệt nhau đọc như máy nói.
  let tmpl = pool[i % pool.length];
  if (tmpl === prevRuleTmpl) tmpl = pool[(i + 1) % pool.length];
  prevRuleTmpl = tmpl;
  const rule = tmpl(a.rel, b.rel);

  questions.push({
    id: `g4t5-${i + 1}`,
    t: 5,
    topic: 'Toán 4 · Đổi đơn vị đo',
    q: 'Viết số thích hợp vào chỗ chấm:',
    workNote: 'Viết phép đổi ra bảng nháp cho khỏi sót chữ số 0, rồi nhập số vào ô.',
    keys: [],
    answerParts: [
      { label: a.label, answer: String(a.answer), expr: a.expr },
      { label: b.label, answer: String(b.answer), expr: b.expr },
    ],
    explanation: `🔑 ${rule}<br>a) ${a.work}<br>b) ${b.work}`,
  });
}

// --------------------------------------------------------- tự kiểm tra ----
// Bước build còn kiểm lại một lần nữa bằng bộ tính riêng của nó, nhưng một
// tệp sai thì đừng để nó kịp ra khỏi đây.
function evalExpr(src) {
  let i = 0;
  const skip = () => { while (src[i] === ' ') i += 1; };
  function factor() {
    skip();
    if (src[i] === '(') {
      i += 1;
      const v = sum();
      skip();
      if (src[i] !== ')') throw new Error(`thiếu ")" trong "${src}"`);
      i += 1;
      return v;
    }
    let d = '';
    while (i < src.length && src[i] >= '0' && src[i] <= '9') { d += src[i]; i += 1; }
    if (!d) throw new Error(`không đọc được số trong "${src}"`);
    return Number(d);
  }
  function term() {
    let v = factor();
    for (;;) {
      skip();
      const op = src[i];
      if (op !== '*' && op !== '/') return v;
      i += 1;
      const r = factor();
      if (op === '*') { v *= r; continue; }
      if (r === 0 || v % r !== 0) throw new Error(`chia không hết trong "${src}"`);
      v /= r;
    }
  }
  function sum() {
    let v = term();
    for (;;) {
      skip();
      const op = src[i];
      if (op !== '+' && op !== '-') return v;
      i += 1;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
  }
  const out = sum();
  skip();
  if (i !== src.length) throw new Error(`thừa ký tự trong "${src}"`);
  return out;
}

const seenPairs = new Set();
questions.forEach((qq, idx) => {
  if (qq.id !== `g4t5-${idx + 1}`) throw new Error(`id sai ở câu ${idx + 1}`);
  if (qq.answerParts.length !== 2) throw new Error(`${qq.id}: phải có đúng 2 phần`);
  const key = qq.answerParts.map((p) => p.expr).join('|');
  if (seenPairs.has(key)) throw new Error(`${qq.id}: trùng cặp expr ${key}`);
  seenPairs.add(key);
  for (const p of qq.answerParts) {
    if (!/^\d+$/.test(p.answer)) throw new Error(`${qq.id}: đáp án "${p.answer}" không phải số`);
    if (!/^[0-9+\-*/() ]+$/.test(p.expr)) throw new Error(`${qq.id}: expr có ký tự lạ`);
    if (evalExpr(p.expr) !== Number(p.answer)) {
      throw new Error(`${qq.id}: expr "${p.expr}" không ra ${p.answer}`);
    }
    if (!/ = … \S+$/.test(p.label)) throw new Error(`${qq.id}: label "${p.label}" sai đuôi`);
  }
  const bare = qq.explanation.replace(/<\/?b>|<br>/g, '');
  if (/[/^<>]/.test(bare)) throw new Error(`${qq.id}: lời giải có ký tự cấm`);
  if (/[/^<>]/.test(qq.q)) throw new Error(`${qq.id}: đề bài có ký tự cấm`);
  if (!qq.explanation.startsWith('🔑 ')) throw new Error(`${qq.id}: lời giải thiếu chìa khoá`);

  // Dòng lời giải phải kết đúng bằng con số bé phải điền VÀ đơn vị mà nhãn
  // hỏi. Đây là chỗ bắt được lời giải "2000 m = 2 m": một lời giải nói khác
  // dòng nó đang giải thì tệ hơn là không có lời giải.
  const lines = qq.explanation.split('<br>');
  if (lines.length !== 3) throw new Error(`${qq.id}: lời giải phải có 3 dòng`);
  qq.answerParts.forEach((p, k) => {
    const tag = k === 0 ? 'a' : 'b';
    const unit = p.label.match(/ = … (\S+)$/)[1];
    if (!lines[k + 1].startsWith(`${tag}) `)) throw new Error(`${qq.id}: dòng ${tag} sai đầu dòng`);
    if (!lines[k + 1].endsWith(`<b>${p.answer}</b> ${unit}.`)) {
      throw new Error(`${qq.id}: dòng ${tag} phải kết bằng "<b>${p.answer}</b> ${unit}."`);
    }
  });
});

// ------------------------------------------------------------- ghi tệp ----
const outDir = path.join(__dirname, '..', 'data', 'math4');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'math4-t5.json');
fs.writeFileSync(
  outFile,
  `${JSON.stringify({ t: 5, key: 'doidonvi', title: 'Đổi đơn vị đo', icon: '⑤', questions }, null, 2)}\n`,
  'utf8',
);

console.log(
  `math4-t5: ${questions.length} câu · khối lượng ${famTally.kl} · độ dài ${famTally.dd} · thời gian ${famTally.tg}`
  + ` · ${SHAPE_NAME.plain} ${shapeTally.plain} · ${SHAPE_NAME.add} ${shapeTally.add}`
  + ` · ${SHAPE_NAME.sub} ${shapeTally.sub} · ${SHAPE_NAME.mixed} ${shapeTally.mixed}`
  + ` → ${path.relative(path.join(__dirname, '..'), outFile)}`,
);
