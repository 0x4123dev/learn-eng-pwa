#!/usr/bin/env node
// validate-grammar-vocab.js — is this file one the Grammar & Vocabulary tab
// can take?
//
//   node scripts/validate-grammar-vocab.js data/grammar-vocab/gv-07.json
//   node scripts/validate-grammar-vocab.js data/grammar-vocab/gv-*.json
//
// data/grammar-vocab/SCHEMA.md, executable: shape, ids, one level per file,
// exactly one blank (two for double-blank), four same-shape options, answer
// discipline, slot spread, no repeated sentence or answer in a file. Whether
// the key is truly the only defensible option is for the verifier agent
// that solves each file blind.
'use strict';
const fs = require('fs');
const path = require('path');

const PER_FILE = 25;
const FOCUS = ['tense', 'modal', 'conditional', 'passive', 'reported', 'relative', 'article-quantifier',
  'preposition', 'phrasal-verb', 'idiom', 'collocation', 'word-choice', 'linking', 'comparison',
  'gerund-infinitive', 'inversion', 'subjunctive', 'participle', 'agreement', 'pronoun', 'question-tag',
  'double-blank', 'other'];
const junk = /\b(undefined|null|NaN)\b/;
const norm = s => String(s).toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function validate(file) {
  const problems = [];
  const p = m => problems.push(m);
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return [`not valid JSON: ${e.message}`]; }
  const m = /gv-(\d{2})\.json$/.exec(path.basename(file));
  if (!m) return ['file must be named gv-<NN>.json'];
  const nn = m[1];
  if (doc.file !== nn) p(`file must be "${nn}"`);
  if (doc.level !== 'kc' && doc.level !== 'ch') p('level must be "kc" or "ch"');
  if (!Array.isArray(doc.items) || doc.items.length !== PER_FILE) { p(`needs exactly ${PER_FILE} items`); return problems; }
  const stems = new Set(), answers = new Set(), slots = [0, 0, 0, 0], focuses = new Set();
  doc.items.forEach((q, i) => {
    const want = `gv-${doc.level}-${nn}-${i + 1}`;
    const at = `item[${i}] (${q && q.id})`;
    if (!q || typeof q !== 'object') { p(`${at}: not an object`); return; }
    if (q.id !== want) p(`${at}: id must be ${want}`);
    if (q.level !== doc.level) p(`${at}: level must be "${doc.level}"`);
    if (!FOCUS.includes(q.focus)) p(`${at}: focus "${q.focus}" is not in the list`);
    focuses.add(q.focus);
    const stem = typeof q.q === 'string' ? q.q : '';
    const blanks = (stem.match(/______/g) || []).length;
    if (!stem.trim()) p(`${at}: q missing`);
    else if (/_{7,}|(?<!_)_{1,5}(?!_)/.test(stem)) p(`${at}: the blank must be exactly six underscores`);
    else if (q.focus === 'double-blank' ? blanks !== 2 : blanks !== 1) p(`${at}: needs ${q.focus === 'double-blank' ? 'two blanks' : 'exactly one blank'}, found ${blanks}`);
    if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o => typeof o !== 'string' || !o.trim())) p(`${at}: needs 4 non-empty options`);
    else {
      if (new Set(q.options.map(o => norm(o))).size !== 4) p(`${at}: duplicate options`);
      if (q.focus === 'double-blank' && q.options.some(o => !/\S\s*\/\s*\S/.test(o))) p(`${at}: double-blank options must be "x / y"`);
      if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) p(`${at}: correct must be 0..3`);
      else {
        if (q.options[q.correct] !== q.answer) p(`${at}: answer must equal options[correct]`);
        slots[q.correct]++;
      }
    }
    for (const k of ['vi', 'explanation']) if (typeof q[k] !== 'string' || q[k].trim().length < 12) p(`${at}: ${k} missing or too short`);
    if (junk.test(JSON.stringify(q))) p(`${at}: contains undefined/null/NaN`);
    const s = norm(stem);
    if (stems.has(s)) p(`${at}: repeats a sentence in this file`);
    stems.add(s);
    const a = norm(q.answer || '');
    if (a && answers.has(a)) p(`${at}: answer "${q.answer}" is already the key of another item in this file`);
    answers.add(a);
  });
  if (Math.max(...slots) > 9) p(`the correct option sits in one slot ${Math.max(...slots)} of ${PER_FILE} times — spread it (max 9)`);
  if (focuses.size < 6) p(`only ${focuses.size} distinct focuses — a round must feel like the paper, mix at least 6`);
  return problems;
}

module.exports = { validate, PER_FILE, FOCUS };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: node scripts/validate-grammar-vocab.js <file> [...]'); process.exit(2); }
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
