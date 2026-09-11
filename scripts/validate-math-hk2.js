#!/usr/bin/env node
// validate-math-hk2.js — is this data/math-hk2/ch<N>-add-<NN>.json a file the
// Toán 7 HK2 bank can take?
//
//   node scripts/validate-math-hk2.js data/math-hk2/ch6-add-03.json [...]
//
// The contract in data/math-hk2/SCHEMA.md, executable — the same rules
// tests/math-hk2.test.js holds the shipped bank to, applied per file so an
// author fixes its own mistakes before the build. Arithmetic is NOT checked
// here (a verifier agent solves every item blind for that); shape, ids,
// topics, explanation form and answer-slot spread are.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TOPICS = {
  6: ['Tỉ lệ thức', 'Tính chất của dãy tỉ số bằng nhau', 'Đại lượng tỉ lệ thuận', 'Đại lượng tỉ lệ nghịch'],
  7: ['Biểu thức đại số', 'Đa thức một biến', 'Phép cộng và phép trừ đa thức một biến', 'Phép nhân đa thức một biến', 'Phép chia đa thức một biến'],
};
const PER_FILE = 20;
const TYPED_RE = /^[−-]?\d+(?:\/\d+)?$/;
const TAG = /<\/?([a-z0-9]+)[^>]*>/gi;
const junk = /\b(undefined|null|NaN)\b/;

function strayAngles(html) {
  // every '<' must open or close a <b> or <br>
  let n = 0;
  for (let i = 0; i < html.length; i++) {
    if (html[i] !== '<') continue;
    if (!/^<\/?(?:br|b)\s*\/?>/i.test(html.slice(i))) n++;
  }
  return n;
}
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9à-ỹ]+/gi, '');

function validate(file) {
  const problems = [];
  const p = (m) => problems.push(m);
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return [`not valid JSON: ${e.message}`]; }
  const m = /ch(\d)-add-(\d{2})\.json$/.exec(path.basename(file));
  if (!m) return ['file must be named ch<N>-add-<NN>.json'];
  const ch = Number(m[1]), nn = Number(m[2]);
  if (!TOPICS[ch]) return [`chapter ${ch} is not one this validator knows (6, 7)`];
  if (doc.ch !== ch) p(`ch must be ${ch}`);
  if (doc.file !== m[2]) p(`file must be "${m[2]}"`);
  if (!Array.isArray(doc.questions) || doc.questions.length !== PER_FILE) { p(`needs exactly ${PER_FILE} questions (got ${doc.questions ? doc.questions.length : 'none'})`); return problems; }

  let base;
  try { base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'math-hk2', 'base.json'), 'utf8')).questions; } catch (e) { base = []; }
  const baseStems = new Set(base.filter(q => q.ch === ch).map(q => norm(q.q)));
  const stems = new Set();
  const slots = [0, 0, 0, 0];
  let mcq = 0, calc = 0;

  doc.questions.forEach((q, i) => {
    const want = `m${ch}-${100 + (nn - 1) * PER_FILE + i + 1}`;
    const at = `q[${i}] (${q && q.id})`;
    if (!q || typeof q !== 'object') { p(`${at}: not an object`); return; }
    if (q.id !== want) p(`${at}: id must be ${want}`);
    if (q.ch !== ch) p(`${at}: ch must be ${ch}`);
    if (!TOPICS[ch].includes(q.topic)) p(`${at}: topic "${q.topic}" is not one of the chapter's labels`);
    if (typeof q.q !== 'string' || q.q.trim().length < 12) p(`${at}: q missing or too short`);
    if (q.fig) p(`${at}: no fig in chapters 6–7`);
    if (/\b(hình vẽ|hình bên|như hình|hình sau)\b/i.test(String(q.q))) p(`${at}: mentions a figure it does not have`);
    const stem = norm(q.q || '');
    if (baseStems.has(stem)) p(`${at}: repeats a question from the original 100`);
    if (stems.has(stem)) p(`${at}: repeats a question in this file`);
    stems.add(stem);

    const answerIsNumber = TYPED_RE.test(String(q.answer || '').trim());
    if (q.type === 'calc') {
      calc++;
      if (!answerIsNumber) p(`${at}: a calc answer must be one integer or a reduced fraction a/b`);
      if (!Array.isArray(q.keys) || q.keys.length) p(`${at}: calc needs keys: []`);
      if ('options' in q || 'correct' in q) p(`${at}: calc must not carry options/correct`);
    } else {
      mcq++;
      if (answerIsNumber) p(`${at}: answer "${q.answer}" is a bare number — the build will turn this into calc; either mark it type "calc" (no options) or make the answer carry a symbol/word`);
      if (!Array.isArray(q.options) || q.options.length !== 4) p(`${at}: needs 4 options`);
      else {
        if (new Set(q.options.map(o => String(o).trim())).size !== 4) p(`${at}: duplicate options`);
        if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) p(`${at}: correct must be 0..3`);
        else {
          if (q.answer !== q.options[q.correct]) p(`${at}: answer must equal options[correct]`);
          slots[q.correct]++;
        }
      }
    }
    const ex = String(q.explanation || '');
    if (!ex.startsWith('🔑')) p(`${at}: explanation must start with 🔑`);
    if (!/🔑\s*<b>Lý thuyết:<\/b>/.test(ex)) p(`${at}: explanation must open with 🔑 <b>Lý thuyết:</b>`);
    if (!/🔑\s*<b>Áp dụng:<\/b>/.test(ex)) p(`${at}: explanation must have a 🔑 <b>Áp dụng:</b> part`);
    if ((ex.match(/✗/g) || []).length !== 3) p(`${at}: explanation must end with exactly 3 ✗ lines (found ${(ex.match(/✗/g) || []).length})`);
    if (!/\(SGK tr\.\s*\d+\)/.test(ex)) p(`${at}: cite the textbook page as (SGK tr. N)`);
    if (junk.test(ex) || junk.test(q.q || '')) p(`${at}: contains undefined/null/NaN`);
    const tags = [...ex.matchAll(TAG)].map(t => t[1].toLowerCase()).filter(t => t !== 'b' && t !== 'br');
    if (tags.length) p(`${at}: only <b> and <br> are allowed in an explanation (found <${tags[0]}>)`);
    if (strayAngles(ex)) p(`${at}: a bare "<" in the explanation — write &lt; or "nhỏ hơn"`);
    if (/\^|\\frac|\\\(/.test(q.q + ex)) p(`${at}: no ^ or LaTeX — use x², a/b`);
    const t = norm(q.topic || ''), a = norm(q.answer || '');
    if (t.length >= 5 && a.length >= 5 && !stem.includes(t) && (a.includes(t) || t.includes(a))) p(`${at}: the topic label gives the answer away`);
  });
  if (mcq && Math.max(...slots) > Math.ceil(mcq * 0.5)) p(`the correct option sits in one slot ${Math.max(...slots)} of ${mcq} times — spread it across A–D`);
  if (calc < 5) p(`only ${calc} calc questions — aim for 6–10 of ${PER_FILE}`);
  if (mcq < 8) p(`only ${mcq} multiple-choice questions — aim for 10–14 of ${PER_FILE}`);
  return problems;
}

module.exports = { validate, TOPICS, PER_FILE, TYPED_RE };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: node scripts/validate-math-hk2.js data/math-hk2/ch<N>-add-<NN>.json [...]'); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    const problems = validate(f);
    if (!problems.length) { console.log(`OK   ${f}`); continue; }
    bad++;
    console.log(`FAIL ${f} — ${problems.length} problem(s)`);
    problems.slice(0, 60).forEach(x => console.log('   - ' + x));
  }
  process.exit(bad ? 1 : 0);
}
