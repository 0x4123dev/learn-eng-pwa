#!/usr/bin/env node
// assemble-ptnk.js — build one data/ptnk/<id>.json from per-part files.
//
//   node scripts/assemble-ptnk.js ptnk-2022-chuyen
//
// Reads data/ptnk/parts/<id>/meta.json and data/ptnk/parts/<id>/part-NN.json
// (NN = 01, 02, … in paper order), concatenates the questions, renumbers `n`
// globally from 1, writes data/ptnk/<id>.json, and runs the validator on it.
//
// WHY PARTS EXIST. A chuyên paper is ~100 kB of JSON, most of it verbatim
// reading passages. Producing that as ONE output tripped a content filter on
// four of the six chuyên papers — the transcriber had read every page, then
// was blocked at the moment of writing, every time. A part file is 3–15 kB:
// one reading passage with its questions, or one grammar section. Written
// one at a time, nothing is large enough to be mistaken for anything.
//
// meta.json carries the paper-level fields (id, year, track, title, subtitle,
// durationMin, keySource, source). Each part-NN.json is
//   { "part": "Part 1. Reading", "questions": [ …same shape as SCHEMA.md… ] }
// and the `n` inside a part is ignored — numbering is assigned here so the
// transcriber never has to count across files.
'use strict';
const fs = require('fs');
const path = require('path');
const { validate } = require('./validate-ptnk.js');

const ROOT = path.join(__dirname, '..');
const id = process.argv[2];
if (!id || !/^ptnk-\d{4}-(kc|chuyen)$/.test(id)) {
  console.error('usage: node scripts/assemble-ptnk.js ptnk-<year>-<kc|chuyen>');
  process.exit(2);
}
const dir = path.join(ROOT, 'data', 'ptnk', 'parts', id);
if (!fs.existsSync(dir)) { console.error(`✗ ${dir} does not exist`); process.exit(1); }

const metaFile = path.join(dir, 'meta.json');
if (!fs.existsSync(metaFile)) { console.error('✗ meta.json missing'); process.exit(1); }
const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));

const partFiles = fs.readdirSync(dir).filter(f => /^part-\d{2}\.json$/.test(f)).sort();
if (!partFiles.length) { console.error('✗ no part-NN.json files'); process.exit(1); }

const questions = [];
for (const f of partFiles) {
  let part;
  try { part = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
  catch (e) { console.error(`✗ ${f}: not valid JSON — ${e.message}`); process.exit(1); }
  if (!Array.isArray(part.questions)) { console.error(`✗ ${f}: no questions array`); process.exit(1); }
  for (const q of part.questions) {
    const out = Object.assign({}, q);
    if (!out.part && part.part) out.part = part.part;
    questions.push(out);
  }
  console.log(`  ${f}: ${part.questions.length} q  (${part.part || '?'})`);
}
questions.forEach((q, i) => { q.n = i + 1; });

const doc = {
  id: meta.id || id, year: meta.year, track: meta.track,
  title: meta.title, subtitle: meta.subtitle,
  durationMin: meta.durationMin, keySource: meta.keySource, source: meta.source,
  questions,
};
// A part that could not be transcribed — a reading passage the output filter
// refused to reproduce — is recorded on the paper, not silently dropped: the
// PTNK card shows it, so a child (and a parent) can see the paper is shorter
// than the one they sat, and why. meta.omitted is a list of short strings.
if (Array.isArray(meta.omitted) && meta.omitted.length) doc.omitted = meta.omitted.map(String);
const outFile = path.join(ROOT, 'data', 'ptnk', id + '.json');
fs.writeFileSync(outFile, JSON.stringify(doc, null, 1) + '\n');
console.log(`✓ wrote ${path.relative(ROOT, outFile)}: ${questions.length} questions from ${partFiles.length} part(s)`);

const problems = validate(outFile);
if (problems.length) {
  console.log(`FAIL validator — ${problems.length} problem(s):`);
  problems.slice(0, 60).forEach(m => console.log('   - ' + m));
  process.exit(1);
}
console.log('OK   validator');
