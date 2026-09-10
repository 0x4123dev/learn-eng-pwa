#!/usr/bin/env node
// validate-ptnk.js — is this data/ptnk/<id>.json a paper the app can run?
//
//   node scripts/validate-ptnk.js data/ptnk/ptnk-2022-chuyen.json
//   node scripts/validate-ptnk.js data/ptnk/*.json
//
// Exit 0 with "OK" per file, or exit 1 listing every problem. The rules are
// the contract in data/ptnk/SCHEMA.md, made executable: a transcriber runs
// this on its own output and fixes what it names, so structural mistakes never
// reach the build. tests/ptnk-data.test.js runs the same checks in the suite.
'use strict';
const fs = require('fs');
const path = require('path');

const PAPERS = {
  'ptnk-2021-kc': { year: 2021, track: 'kc', keySource: 'official', durationMin: 60 },
  'ptnk-2021-chuyen': { year: 2021, track: 'chuyen', keySource: 'official', durationMin: 120 },
  'ptnk-2022-kc': { year: 2022, track: 'kc', keySource: 'official', durationMin: 60 },
  'ptnk-2022-chuyen': { year: 2022, track: 'chuyen', keySource: 'official', durationMin: 120 },
  'ptnk-2023-chuyen': { year: 2023, track: 'chuyen', keySource: 'official', durationMin: 120 },
  'ptnk-2024-kc': { year: 2024, track: 'kc', keySource: 'solved', durationMin: 60 },
  'ptnk-2024-chuyen': { year: 2024, track: 'chuyen', keySource: 'solved', durationMin: 120 },
  'ptnk-2025-kc': { year: 2025, track: 'kc', keySource: 'solved', durationMin: 60 },
  'ptnk-2025-chuyen': { year: 2025, track: 'chuyen', keySource: 'solved', durationMin: 120 },
  'ptnk-2026-kc': { year: 2026, track: 'kc', keySource: 'solved', durationMin: 60 },
  'ptnk-2026-chuyen': { year: 2026, track: 'chuyen', keySource: 'solved', durationMin: 120 },
};
const SECTIONS = new Set(['Phonetics', 'Stress', 'Language use', 'Error correction', 'Reading',
  'Cloze', 'Open cloze', 'Word form', 'Collocation', 'Rewrite', 'Sentence transformation', 'Word bank']);
const PASSAGE_SECTIONS = new Set(['Reading', 'Cloze', 'Open cloze']);
// A paper this short is a transcriber that gave up partway; a KC paper is
// ~50 questions and a chuyên paper ~80–100.
const MIN_QUESTIONS = { kc: 30, chuyen: 40 };

function validate(file) {
  const problems = [];
  const p = (msg) => problems.push(msg);
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return [`not valid JSON: ${e.message}`]; }

  const spec = PAPERS[doc.id];
  if (!spec) p(`id "${doc.id}" is not one of the fixed ids in SCHEMA.md`);
  if (spec && path.basename(file) !== doc.id + '.json') p(`file must be named ${doc.id}.json`);
  if (spec) {
    if (doc.year !== spec.year) p(`year must be ${spec.year}, got ${doc.year}`);
    if (doc.track !== spec.track) p(`track must be "${spec.track}", got "${doc.track}"`);
    if (doc.keySource !== spec.keySource) p(`keySource must be "${spec.keySource}", got "${doc.keySource}"`);
    if (doc.durationMin !== spec.durationMin) p(`durationMin must be ${spec.durationMin}, got ${doc.durationMin}`);
  }
  for (const k of ['title', 'subtitle', 'source']) {
    if (typeof doc[k] !== 'string' || !doc[k].trim()) p(`${k} must be a non-empty string`);
  }
  if (!Array.isArray(doc.questions)) { p('questions must be an array'); return problems; }
  const min = spec ? MIN_QUESTIONS[spec.track] : 30;
  if (doc.questions.length < min) p(`only ${doc.questions.length} questions — a ${spec ? spec.track : ''} paper has at least ${min}; was a part skipped?`);

  const junk = /\b(undefined|null|NaN)\b/;
  doc.questions.forEach((q, i) => {
    const at = `q[${i}] (n=${q && q.n})`;
    if (!q || typeof q !== 'object') { p(`${at}: not an object`); return; }
    if (q.n !== i + 1) p(`${at}: n must be ${i + 1} — numbering is global and sequential from 1`);
    if (typeof q.part !== 'string' || !q.part.trim()) p(`${at}: part missing`);
    if (!SECTIONS.has(q.section)) p(`${at}: section "${q.section}" is not in the allowed list`);
    if (typeof q.q !== 'string' || !q.q.trim()) p(`${at}: q (stem) missing`);
    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 15) p(`${at}: explanation missing or too short`);
    for (const k of ['q', 'explanation', 'passage']) {
      if (typeof q[k] === 'string' && junk.test(q[k])) p(`${at}: ${k} contains "${junk.exec(q[k])[0]}"`);
    }
    if (PASSAGE_SECTIONS.has(q.section) && (typeof q.passage !== 'string' || q.passage.trim().length < 80)) {
      p(`${at}: a ${q.section} question must carry its full passage`);
    }
    if (q.type === 'mcq' || q.type === 'tf') {
      const want = q.type === 'tf' ? 2 : 4;
      if (!Array.isArray(q.options) || q.options.length !== want) p(`${at}: ${q.type} needs exactly ${want} options`);
      else {
        if (new Set(q.options.map(o => String(o).trim().toLowerCase())).size !== want) p(`${at}: duplicate options`);
        if (q.options.some(o => typeof o !== 'string' || !o.trim())) p(`${at}: empty option`);
        if (q.options.some(o => /^[A-D][.)]\s/.test(o))) p(`${at}: strip the "A." letters from options — the app adds them`);
        if (q.type === 'tf' && !(q.options[0] === 'True' && q.options[1] === 'False')) p(`${at}: tf options must be exactly ["True","False"]`);
      }
      if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= want) p(`${at}: correct must be 0..${want - 1}`);
      if ('accept' in q || 'answer' in q) p(`${at}: an ${q.type} question must not carry accept/answer`);
    } else if (q.type === 'text') {
      if (!Array.isArray(q.accept) || !q.accept.length) p(`${at}: text needs a non-empty accept list`);
      else {
        if (q.accept.some(a => typeof a !== 'string' || !a.trim())) p(`${at}: empty accept entry`);
        if (typeof q.answer !== 'string' || !q.accept.includes(q.answer)) p(`${at}: answer must be one of accept`);
        if (q.accept.some(a => a.split(/\s+/).length > 20)) p(`${at}: an accept entry is longer than 20 words — is this an essay? Essays are omitted`);
      }
      if ('options' in q || 'correct' in q) p(`${at}: a text question must not carry options/correct`);
    } else {
      p(`${at}: type must be mcq, tf or text (got "${q.type}")`);
    }
  });
  return problems;
}

module.exports = { validate, PAPERS, SECTIONS };

// CLI only when run directly. Required from scripts/assemble-ptnk.js,
// scripts/build-ptnk-data.js and tests/ptnk-data.test.js, this block used to
// run anyway — reading THEIR argv and calling process.exit() from inside a
// require(), which is how the assembler once died on "ENOENT: ptnk-2025-kc".
if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: node scripts/validate-ptnk.js data/ptnk/<id>.json [...]'); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    const problems = validate(f);
    if (!problems.length) { console.log(`OK   ${f}`); continue; }
    bad++;
    console.log(`FAIL ${f} — ${problems.length} problem(s)`);
    for (const m of problems.slice(0, 60)) console.log('   - ' + m);
    if (problems.length > 60) console.log(`   … and ${problems.length - 60} more`);
  }
  process.exit(bad ? 1 : 0);
}
