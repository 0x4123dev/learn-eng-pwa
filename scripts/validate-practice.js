#!/usr/bin/env node
// validate-practice.js — is this practice-bank file one the app can run?
//
//   node scripts/validate-practice.js reading data/reading/reading-03.json
//   node scripts/validate-practice.js cloze   data/cloze/*.json
//   node scripts/validate-practice.js errors  data/errors/errors-07.json
//
// The contract in data/reading/SCHEMA.md, made executable. An authoring agent
// runs this on its own file and fixes what it names; the build refuses a file
// that fails; tests/practice-data.test.js runs the same checks in the suite.
'use strict';
const fs = require('fs');

const KINDS = new Set(['main-idea', 'detail', 'inference', 'vocab', 'reference', 'purpose', 'tfng', 'section', 'gap']);
const FOCUS = new Set(['tense', 'agreement', 'article', 'preposition', 'word-form', 'pronoun', 'comparison',
  'conditional', 'reported', 'relative', 'word-order', 'collocation', 'quantifier', 'conjunction', 'other']);
const junk = /\b(undefined|null|NaN)\b/;
const words = (s) => String(s).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

function checkQuestion(q, at, p, opts) {
  if (!q || typeof q !== 'object') { p(`${at}: not an object`); return; }
  if (typeof q.q !== 'string' || !q.q.trim()) p(`${at}: q (stem) missing`);
  if (typeof q.explanation !== 'string' || q.explanation.trim().length < 15) p(`${at}: explanation missing or too short`);
  for (const k of ['q', 'explanation']) if (typeof q[k] === 'string' && junk.test(q[k])) p(`${at}: ${k} contains junk token`);
  if (q.type === 'mcq') {
    const want = opts.mcqOptions || 4;
    if (!Array.isArray(q.options) || q.options.length !== want) p(`${at}: mcq needs exactly ${want} options`);
    else {
      if (new Set(q.options.map(o => String(o).trim().toLowerCase())).size !== want) p(`${at}: duplicate options`);
      if (q.options.some(o => typeof o !== 'string' || !o.trim())) p(`${at}: empty option`);
      if (q.options.some(o => /^[A-D][.)]\s/.test(o))) p(`${at}: strip the "A." letters from options`);
    }
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= want) p(`${at}: correct must be 0..${want - 1}`);
    if ('accept' in q || 'answer' in q) p(`${at}: an mcq must not carry accept/answer`);
  } else if (q.type === 'tf') {
    if (!Array.isArray(q.options) || q.options[0] !== 'True' || q.options[1] !== 'False' || q.options.length !== 2) p(`${at}: tf options must be ["True","False"]`);
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 1) p(`${at}: correct must be 0 or 1`);
  } else if (q.type === 'text') {
    if (!Array.isArray(q.accept) || !q.accept.length) p(`${at}: text needs a non-empty accept list`);
    else {
      if (q.accept.some(a => typeof a !== 'string' || !a.trim())) p(`${at}: empty accept entry`);
      if (typeof q.answer !== 'string' || !q.accept.includes(q.answer)) p(`${at}: answer must be one of accept`);
      if (q.accept.some(a => a.split(/\s+/).length > 20)) p(`${at}: accept entry over 20 words`);
    }
    if ('options' in q || 'correct' in q) p(`${at}: a text question must not carry options/correct`);
  } else {
    p(`${at}: type must be mcq, tf or text (got "${q.type}")`);
  }
}

function validateReading(doc, file, p) {
  const m = /reading-(\d{2})\.json$/.exec(file);
  const nn = m ? m[1] : null;
  if (!Array.isArray(doc.passages) || !doc.passages.length) { p('passages must be a non-empty array'); return; }
  const seenTitles = new Set();
  doc.passages.forEach((ps, i) => {
    const at = `passage[${i}] (${ps && ps.id})`;
    if (!ps || typeof ps !== 'object') { p(`${at}: not an object`); return; }
    if (!/^rd-(kc|ch)-\d{2}-\d+$/.test(ps.id || '')) p(`${at}: id must be rd-<kc|ch>-<NN>-<seq>`);
    else if (nn && ps.id.split('-')[2] !== nn) p(`${at}: id's NN must match the file name (${nn})`);
    if (ps.level !== 'kc' && ps.level !== 'ch') p(`${at}: level must be kc or ch`);
    if (ps.id && ps.level && ps.id.split('-')[1] !== ps.level) p(`${at}: id level and level field disagree`);
    for (const k of ['title', 'topic', 'passage']) if (typeof ps[k] !== 'string' || !ps[k].trim()) p(`${at}: ${k} missing`);
    if (typeof ps.passage === 'string' && junk.test(ps.passage)) p(`${at}: passage contains junk token`);
    if (seenTitles.has(ps.title)) p(`${at}: duplicate title in file`); seenTitles.add(ps.title);
    const w = words(ps.passage || '');
    const lo = ps.level === 'ch' ? 380 : 220, hi = ps.level === 'ch' ? 620 : 380;
    if (w < lo || w > hi) p(`${at}: passage is ${w} words; a ${ps.level} passage must be ${lo}–${hi}`);
    if (!Array.isArray(ps.questions) || ps.questions.length < 5 || ps.questions.length > 8) p(`${at}: needs 5–8 questions`);
    const kinds = new Set();
    (ps.questions || []).forEach((q, j) => {
      const qat = `${at} q[${j}]`;
      if (!KINDS.has(q && q.kind)) p(`${qat}: kind "${q && q.kind}" not allowed`);
      kinds.add(q && q.kind);
      const opts = {};
      if (q && q.kind === 'tfng') {
        opts.mcqOptions = 3;
        if (q.type !== 'mcq' || JSON.stringify(q.options) !== '["True","False","Not Given"]') p(`${qat}: tfng must be mcq with options ["True","False","Not Given"]`);
      } else if (q && (q.kind === 'section' || q.kind === 'gap')) {
        if (q.type !== 'text') p(`${qat}: ${q.kind} must be text`);
        if (q.type === 'text' && !(q.accept || []).every(a => /^[A-K]$/.test(a))) p(`${qat}: ${q.kind} accept must be single letters`);
        if (q.kind === 'section' && !/<b>[A-F]\.<\/b>/.test(ps.passage || '')) p(`${qat}: section question but the passage has no <b>A.</b> section labels`);
        if (q.kind === 'gap' && !/\[\d\]/.test(ps.passage || '')) p(`${qat}: gap question but the passage has no [n] gaps`);
      } else if (q && q.type !== 'mcq') p(`${qat}: ${q.kind} must be mcq`);
      checkQuestion(q, qat, p, opts);
    });
    if (kinds.size < 3) p(`${at}: mixes only ${kinds.size} question kind(s); at least 3`);
    if (ps.level === 'ch' && !kinds.has('section') && !kinds.has('gap')) p(`${at}: a ch passage must include a section or gap task`);
  });
}

function validateCloze(doc, file, p) {
  const m = /cloze-(\d{2})\.json$/.exec(file);
  const nn = m ? m[1] : null;
  if (!Array.isArray(doc.passages) || !doc.passages.length) { p('passages must be a non-empty array'); return; }
  doc.passages.forEach((ps, i) => {
    const at = `passage[${i}] (${ps && ps.id})`;
    if (!ps || typeof ps !== 'object') { p(`${at}: not an object`); return; }
    if (!/^cl-(kc|ch)-\d{2}-\d+$/.test(ps.id || '')) p(`${at}: id must be cl-<kc|ch>-<NN>-<seq>`);
    else if (nn && ps.id.split('-')[2] !== nn) p(`${at}: id's NN must match the file name (${nn})`);
    if (ps.level !== 'kc' && ps.level !== 'ch') p(`${at}: level must be kc or ch`);
    if (ps.id && ps.level && ps.id.split('-')[1] !== ps.level) p(`${at}: id level and level field disagree`);
    if (ps.mode !== 'mcq' && ps.mode !== 'open') p(`${at}: mode must be mcq or open`);
    for (const k of ['title', 'topic', 'passage']) if (typeof ps[k] !== 'string' || !ps[k].trim()) p(`${at}: ${k} missing`);
    const w = words(ps.passage || '');
    if (w < 120 || w > 320) p(`${at}: passage is ${w} words; must be 120–320`);
    for (let n = 1; n <= 10; n++) if (!(ps.passage || '').includes(`(${n})____`)) p(`${at}: passage is missing blank (${n})____`);
    if ((ps.passage || '').includes('(11)____')) p(`${at}: more than 10 blanks`);
    if (!Array.isArray(ps.questions) || ps.questions.length !== 10) p(`${at}: needs exactly 10 questions`);
    (ps.questions || []).forEach((q, j) => {
      const qat = `${at} q[${j}]`;
      if (q && q.n !== j + 1) p(`${qat}: n must be ${j + 1}`);
      if (q && typeof q.q === 'string' && !new RegExp(`^Blank \\(${j + 1}\\)`).test(q.q)) p(`${qat}: q must start with "Blank (${j + 1})"`);
      if (ps.mode === 'mcq' && q && q.type !== 'mcq') p(`${qat}: an mcq passage's questions must be mcq`);
      if (ps.mode === 'open' && q && q.type !== 'text') p(`${qat}: an open passage's questions must be text`);
      if (ps.mode === 'open' && q && Array.isArray(q.accept) && q.accept.some(a => /\s/.test(a.trim()))) p(`${qat}: open cloze answers are ONE word`);
      checkQuestion(q, qat, p, {});
    });
  });
}

function validateErrors(doc, file, p) {
  const m = /errors-(\d{2})\.json$/.exec(file);
  const nn = m ? m[1] : null;
  if (!Array.isArray(doc.items) || doc.items.length < 20) { p('items must be an array of at least 20'); return; }
  const focus = new Set(), pos = [0, 0, 0, 0], seen = new Set();
  doc.items.forEach((it, i) => {
    const at = `item[${i}] (${it && it.id})`;
    if (!it || typeof it !== 'object') { p(`${at}: not an object`); return; }
    if (!/^er-(kc|ch)-\d{2}-\d+$/.test(it.id || '')) p(`${at}: id must be er-<kc|ch>-<NN>-<seq>`);
    else if (nn && it.id.split('-')[2] !== nn) p(`${at}: id's NN must match the file name (${nn})`);
    if (it.level !== 'kc' && it.level !== 'ch') p(`${at}: level must be kc or ch`);
    if (!FOCUS.has(it.focus)) p(`${at}: focus "${it.focus}" not allowed`);
    focus.add(it.focus);
    if (typeof it.correction !== 'string' || !it.correction.trim()) p(`${at}: correction missing`);
    const segs = (String(it.q || '').match(/\(([A-D])\)\s*/g) || []).length;
    if (segs !== 4) p(`${at}: q must contain the four markers (A) (B) (C) (D) exactly once each (found ${segs})`);
    if (Array.isArray(it.options) && it.options.length === 4 && typeof it.q === 'string') {
      it.options.forEach((o, k) => { if (!it.q.includes(o)) p(`${at}: option ${'ABCD'[k]} "${o}" is not a verbatim segment of q`); });
      if (Number.isInteger(it.correct) && it.options[it.correct] === it.correction) p(`${at}: correction must differ from the wrong segment`);
    }
    if (Number.isInteger(it.correct) && it.correct >= 0 && it.correct < 4) pos[it.correct]++;
    const key = String(it.q || '').toLowerCase().replace(/\([a-d]\)\s*/g, '');
    if (seen.has(key)) p(`${at}: duplicate sentence in file`); seen.add(key);
    checkQuestion(Object.assign({ type: 'mcq' }, it), at, p, {});
  });
  if (focus.size < 8) p(`file spreads focus over only ${focus.size} values; at least 8`);
  const n = doc.items.length;
  pos.forEach((c, k) => { if (c < n * 0.12) p(`the error sits in position ${'ABCD'[k]} only ${c}/${n} times — spread it across A–D`); });
}

const VALIDATORS = { reading: validateReading, cloze: validateCloze, errors: validateErrors };

function validate(kind, file) {
  const problems = [];
  const p = (m) => problems.push(m);
  if (!VALIDATORS[kind]) return [`unknown kind "${kind}"`];
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return [`not valid JSON: ${e.message}`]; }
  VALIDATORS[kind](doc, file, p);
  return problems;
}

module.exports = { validate, KINDS, FOCUS };

if (require.main === module) {
  const [kind, ...files] = process.argv.slice(2);
  if (!kind || !files.length) { console.error('usage: node scripts/validate-practice.js <reading|cloze|errors> <file> [...]'); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    const problems = validate(kind, f);
    if (!problems.length) { console.log(`OK   ${f}`); continue; }
    bad++;
    console.log(`FAIL ${f} — ${problems.length} problem(s)`);
    for (const m of problems.slice(0, 60)) console.log('   - ' + m);
    if (problems.length > 60) console.log(`   … and ${problems.length - 60} more`);
  }
  process.exit(bad ? 1 : 0);
}
