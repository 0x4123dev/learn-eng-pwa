#!/usr/bin/env node
// scripts/build-math4-data.js — assemble js/math4-data.js from the five
// per-dạng author files under data/math4/.
//
//   node scripts/build-math4-data.js [dir]      (default: data/math4)
//
// The five banks are written by GENERATORS (scripts/gen-math4-t*.js), so the
// arithmetic in them was produced by code. That is not a reason to trust it:
// a generator that computes the label from one expression and the answer from
// another is exactly the bug a child would meet as "con làm đúng mà máy báo
// sai", and nothing downstream would catch it.
//
// So this file re-derives EVERY answer with its own arithmetic, written from
// scratch and sharing no code with any generator:
//
//   • `expr` is parsed here by a recursive-descent parser and must come out
//     equal to the answer, with every division exact;
//   • dạng 1 and 3 labels are re-read as expressions and must say the same
//     thing as `expr` — a label reading "21506 + 6930 : 3" over an expr of
//     "(21506+6930)/3" is caught here and nowhere else;
//   • dạng 2 equations are checked by SUBSTITUTING the answer back into the
//     equation the child is shown;
//   • dạng 5 conversions are recomputed from a unit table defined below, so
//     the units on the line and the number in the answer have to agree.
//
// `expr` exists only for that check. It is stripped before the bank ships.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = [1, 2, 3, 4, 5];
const PER_TYPE = 100;
const PARTS_PER_TYPE = { 1: 4, 2: 2, 3: 2, 4: 1, 5: 2 };

let failures = 0;
function fail(msg) { console.error('✗ ' + msg); failures++; }

// ---- the independent arithmetic ------------------------------------------
// Integers, + - * / and brackets, normal precedence. Division must be exact:
// nothing in a grade-4 bank may come out a fraction, and silently rounding
// one would hide the very error this parser is here to find.
function evaluate(src) {
  const s = String(src);
  let i = 0;
  const ws = () => { while (i < s.length && s[i] === ' ') i++; };
  function number() {
    ws();
    if (s[i] === '(') {
      i++;
      const v = sum();
      ws();
      if (s[i] !== ')') throw new Error('thiếu dấu ")" ở vị trí ' + i);
      i++;
      return v;
    }
    const start = i;
    while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
    if (i === start) throw new Error('cần một con số ở vị trí ' + i);
    return Number(s.slice(start, i));
  }
  function product() {
    let v = number();
    for (;;) {
      ws();
      const op = s[i];
      if (op !== '*' && op !== '/') return v;
      i++;
      const r = number();
      if (op === '*') v *= r;
      else {
        if (r === 0) throw new Error('chia cho 0');
        if (v % r !== 0) throw new Error(`phép chia ${v} : ${r} không chia hết`);
        v /= r;
      }
    }
  }
  function sum() {
    let v = product();
    for (;;) {
      ws();
      const op = s[i];
      if (op !== '+' && op !== '-') return v;
      i++;
      const r = product();
      v = op === '+' ? v + r : v - r;
    }
  }
  const value = sum();
  ws();
  if (i !== s.length) throw new Error('thừa ký tự từ vị trí ' + i);
  return value;
}

// School notation → the parser's notation. "×" is times, ":" is divide and
// "−" (U+2212) is the minus a maths keypad prints.
function asciiMath(text) {
  return String(text)
    .replace(/×/g, '*').replace(/·/g, '*')
    .replace(/:/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '');
}

// ---- unit table, for dạng 5 ----------------------------------------------
// Written out here rather than imported from the generator on purpose: two
// independent statements of "1 tạ = 100 kg" are what make the check a check.
const UNITS = {
  'g': 1, 'kg': 1000, 'yến': 10000, 'tạ': 100000, 'tấn': 1000000,
  'mm': 1, 'cm': 10, 'dm': 100, 'm': 1000, 'km': 1000000,
  'giây': 1, 'phút': 60, 'giờ': 3600, 'ngày': 86400,
};
const FAMILY = {
  'g': 'khối lượng', 'kg': 'khối lượng', 'yến': 'khối lượng', 'tạ': 'khối lượng', 'tấn': 'khối lượng',
  'mm': 'độ dài', 'cm': 'độ dài', 'dm': 'độ dài', 'm': 'độ dài', 'km': 'độ dài',
  'giây': 'thời gian', 'phút': 'thời gian', 'giờ': 'thời gian', 'ngày': 'thời gian',
};
const UNIT_WORD = Object.keys(UNITS).sort((a, b) => b.length - a.length)
  .map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

// "770 g + 230 g = … kg", "2 giờ 30 phút = … phút", "5 tấn = … kg".
// Returns the value the right-hand side must hold, or null when the line is
// not one of those shapes (which is itself a failure — see checkConversion).
function readConversionLine(label) {
  const text = String(label).replace(/\s+/g, ' ').trim();
  const parts = text.split('=');
  if (parts.length !== 2) return null;
  const term = new RegExp(`(\\d+)\\s*(${UNIT_WORD})(?![\\p{L}])`, 'gu');
  const left = [...parts[0].matchAll(term)];
  if (!left.length) return null;
  // Everything between the terms must be nothing (a mixed quantity: "2 giờ 30
  // phút") or a single "+" / "−". Anything else and we do not understand the
  // line, and not understanding it is a failure, never a pass.
  let total = 0;
  let cursor = 0;
  for (let k = 0; k < left.length; k++) {
    const m = left[k];
    const between = parts[0].slice(cursor, m.index).trim();
    cursor = m.index + m[0].length;
    const value = Number(m[1]) * UNITS[m[2]];
    if (k === 0) {
      if (between !== '') return null;
      total = value;
    } else if (between === '' ) total += value;          // "2 giờ 30 phút"
    else if (between === '+') total += value;
    else if (/^[−–—-]$/.test(between)) total -= value;
    else return null;
  }
  if (parts[0].slice(cursor).trim() !== '') return null;
  const right = parts[1].trim().match(new RegExp(`^[….]+\\s*(${UNIT_WORD})$`, 'u'));
  if (!right) return null;
  const target = UNITS[right[1]];
  const families = new Set(left.map(m => FAMILY[m[2]]).concat(FAMILY[right[1]]));
  if (families.size !== 1) return null;                   // g + km is not a line
  if (total < 0 || total % target !== 0) return null;
  return { value: total / target, unit: right[1], family: [...families][0] };
}

// ---- text rules -----------------------------------------------------------
// `q` and `explanation` are rendered by js/math.js's typesetter, which turns
// "a/b" into a stacked fraction and "x^2" into an exponent. A grade-4 story
// containing a slash would be drawn as a fraction of two sentences.
const ALLOWED_TAG = /<\/?(?:b|br)\s*\/?>/gi;
function checkProse(where, field, text) {
  const bare = String(text == null ? '' : text).replace(ALLOWED_TAG, '');
  for (const [ch, why] of [
    ['/', 'dấu gạch chéo sẽ bị vẽ thành phân số — viết phép chia là ":"'],
    ['^', 'dấu mũ sẽ bị vẽ thành số mũ'],
    ['<', 'thẻ HTML lạ — chỉ cho phép <b> và <br>'],
    ['>', 'thẻ HTML lạ — chỉ cho phép <b> và <br>'],
  ]) if (bare.indexOf(ch) !== -1) fail(`${where}: ${field} chứa "${ch}" — ${why}`);
  if (/\btr\.\s*\d/.test(bare)) fail(`${where}: ${field} chứa "tr. N" — sẽ bị hiểu là trích dẫn trang sách`);
}

// ---- per-question validation ---------------------------------------------
function validateType(data, t) {
  const where0 = `dạng ${t}`;
  if (data.t !== t) fail(`${where0}: file khai t=${data.t}`);
  if (!data.key || !data.title || !data.icon) fail(`${where0}: thiếu key/title/icon`);
  const qs = data.questions || [];
  if (qs.length !== PER_TYPE) fail(`${where0}: ${qs.length} câu, cần đúng ${PER_TYPE}`);

  const seenId = new Set();
  const seenShape = new Set();
  qs.forEach((q, index) => {
    const where = `${where0} câu ${index + 1}`;
    const id = `g4t${t}-${index + 1}`;
    if (q.id !== id) fail(`${where}: id "${q.id}", cần "${id}"`);
    if (seenId.has(q.id)) fail(`${where}: id trùng ${q.id}`);
    seenId.add(q.id);
    if (q.t !== t) fail(`${where}: t=${q.t}`);
    if (q.options) fail(`${where}: có options — câu này nhập đáp án, không chọn`);
    if (!String(q.q || '').trim()) fail(`${where}: thiếu đề bài`);
    if (!String(q.topic || '').trim()) fail(`${where}: thiếu topic`);
    if (!/🔑/.test(q.explanation || '')) fail(`${where}: lời giải không có quy tắc 🔑`);
    if (String(q.explanation || '').length < 40) fail(`${where}: lời giải quá ngắn`);
    if (!Array.isArray(q.keys) || q.keys.length) fail(`${where}: keys phải là [] — bàn phím số là đủ`);
    checkProse(where, 'đề bài', q.q);
    checkProse(where, 'lời giải', q.explanation);

    const parts = q.answerParts;
    if (!Array.isArray(parts) || parts.length !== PARTS_PER_TYPE[t]) {
      fail(`${where}: cần đúng ${PARTS_PER_TYPE[t]} ô đáp án, có ${Array.isArray(parts) ? parts.length : 'không có'}`);
      return;
    }
    parts.forEach((p, k) => {
      const at = `${where} ô ${k + 1}`;
      if (!String(p.label || '').trim()) fail(`${at}: thiếu nhãn`);
      if (/[<>]/.test(String(p.label || ''))) fail(`${at}: nhãn chứa thẻ HTML`);
      if (!/^\d+$/.test(String(p.answer))) fail(`${at}: đáp án "${p.answer}" phải là số nguyên không dấu`);
      if (p.accept !== undefined && !Array.isArray(p.accept)) fail(`${at}: accept phải là mảng`);
      if (!/^[0-9+\-*/() ]+$/.test(String(p.expr || ''))) {
        fail(`${at}: expr "${p.expr}" chứa ký tự lạ`);
        return;
      }
      let value;
      try { value = evaluate(p.expr); }
      catch (e) { fail(`${at}: expr "${p.expr}" không tính được — ${e.message}`); return; }
      if (value !== Number(p.answer)) fail(`${at}: expr "${p.expr}" ra ${value} nhưng đáp án ghi ${p.answer}`);
      if (value < 0) fail(`${at}: kết quả âm (${value})`);
      if (!Number.isSafeInteger(value)) fail(`${at}: kết quả không phải số nguyên (${value})`);

      // Dạng 1 và 3: nhãn CHÍNH LÀ biểu thức, nên đọc lại nhãn phải ra đúng
      // cùng một phép tính. Đây là chỗ bắt được lỗi "nhãn một đằng, đáp án
      // một nẻo" mà mọi kiểm tra khác đều bỏ qua.
      if (t === 1 || t === 3) {
        const fromLabel = asciiMath(p.label);
        let got;
        try { got = evaluate(fromLabel); }
        catch (e) { fail(`${at}: nhãn "${p.label}" không đọc được thành phép tính — ${e.message}`); return; }
        if (got !== value) fail(`${at}: nhãn "${p.label}" ra ${got} nhưng expr ra ${value}`);
        if (fromLabel !== asciiMath(p.expr)) {
          fail(`${at}: nhãn "${p.label}" và expr "${p.expr}" không cùng một biểu thức`);
        }
      }
      // Dạng 2: thay đáp án vào phương trình mà bé nhìn thấy, hai vế phải bằng nhau.
      if (t === 2) {
        const sides = String(p.label).split('=');
        if (sides.length !== 2 || !/x/i.test(sides[0])) {
          fail(`${at}: nhãn "${p.label}" không phải một phương trình có X`);
          return;
        }
        const lhs = asciiMath(sides[0]).replace(/[Xx]/g, '(' + p.answer + ')');
        let l, r;
        try { l = evaluate(lhs); r = evaluate(asciiMath(sides[1])); }
        catch (e) { fail(`${at}: thay X = ${p.answer} vào "${p.label}" không tính được — ${e.message}`); return; }
        if (l !== r) fail(`${at}: thay X = ${p.answer} vào "${p.label}" ra ${l} ≠ ${r}`);
      }
      // Dạng 5: tính lại phép đổi từ bảng đơn vị ở trên.
      if (t === 5) {
        const line = readConversionLine(p.label);
        if (!line) { fail(`${at}: không đọc được dòng đổi đơn vị "${p.label}"`); return; }
        if (line.value !== Number(p.answer)) {
          fail(`${at}: "${p.label}" phải là ${line.value} ${line.unit}, đáp án ghi ${p.answer}`);
        }
      }
    });
    if (t === 5 && parts.length === 2) {
      const fams = parts.map(p => (readConversionLine(p.label) || {}).family);
      if (fams[0] && fams[0] === fams[1]) fail(`${where}: cả hai ý cùng nhóm đơn vị "${fams[0]}"`);
    }

    const shape = parts.map(p => p.expr).join('|');
    if (seenShape.has(shape)) fail(`${where}: trùng hệt câu đã có (${shape})`);
    seenShape.add(shape);
  });

  // Dạng 1: bốn phép theo đúng thứ tự cộng, trừ, nhân, chia — đó là hình dạng
  // của đề thật, và một bank đảo thứ tự sẽ dạy bé đọc đề sai.
  if (t === 1) {
    qs.forEach((q, index) => {
      const ops = (q.answerParts || []).map(p => (String(p.expr).match(/[+\-*/]/) || [''])[0]);
      if (ops.join('') !== '+-*/') fail(`${where0} câu ${index + 1}: bốn phép phải theo thứ tự + − × :, đang là "${ops.join(' ')}"`);
    });
  }
  return data;
}

function main() {
  const dir = process.argv[2] || path.join(ROOT, 'data', 'math4');
  const types = [];
  const questions = [];

  for (const t of TYPES) {
    const file = path.join(dir, `math4-t${t}.json`);
    if (!fs.existsSync(file)) { fail(`thiếu ${file}`); continue; }
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { fail(`${file}: JSON hỏng — ${e.message}`); continue; }
    validateType(data, t);
    types.push({ t, key: data.key, title: data.title, icon: data.icon, count: (data.questions || []).length });
    for (const q of (data.questions || [])) {
      questions.push({
        id: q.id, t: q.t, grade: 4, topic: q.topic, q: q.q,
        workNote: q.workNote || 'Làm bài trên bảng nháp, rồi nhập kết quả cuối cùng.',
        keys: [],
        // `expr` is the build's own check, not the child's question.
        answerParts: (q.answerParts || []).map(p => (
          p.accept ? { label: p.label, answer: p.answer, accept: p.accept }
                   : { label: p.label, answer: p.answer })),
        explanation: q.explanation,
      });
    }
  }

  if (failures) {
    console.error(`\nbuild dừng lại — ${failures} lỗi ở trên`);
    process.exit(1);
  }

  fs.writeFileSync(path.join(ROOT, 'js', 'math4-data.js'),
    '// math4-data.js — GENERATED by scripts/build-math4-data.js. Do not edit.\n' +
    `// Toán 4 · Đề ôn: ${types.length} dạng bài, ${questions.length} câu.\n` +
    'const MATH4_TYPES = ' + JSON.stringify(types, null, 0) + ';\n' +
    'const MATH4_QUESTIONS = ' + JSON.stringify(questions, null, 0) + ';\n\n' +
    "if (typeof module !== 'undefined' && module.exports) { module.exports = { MATH4_TYPES, MATH4_QUESTIONS }; }\n");

  console.log(`✓ ${types.length} dạng, ${questions.length} câu`);
  types.forEach(t => console.log(`   ${t.icon} Dạng ${t.t} · ${t.title} — ${t.count} câu`));
}

module.exports = { evaluate, asciiMath, readConversionLine, validateType, PER_TYPE, PARTS_PER_TYPE, UNITS };

if (require.main === module) main();
