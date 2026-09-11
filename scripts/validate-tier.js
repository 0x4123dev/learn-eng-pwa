#!/usr/bin/env node
// validate-tier.js — is this Chuyên-tier file one Word Form / Rewrite can take?
//
//   node scripts/validate-tier.js wordform data/wordform/ch-add-03.json
//   node scripts/validate-tier.js rewrite  data/rewrite/ch-add-*.json
//
// data/wordform/SCHEMA.md, executable. Shape, ids, uniqueness against the
// original bank, answer/accept discipline, key-word discipline. Whether a
// derived word truly exists or a rewrite truly keeps the meaning is for the
// verifier agent that solves each file blind.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PER_FILE = 20;
const junk = /\b(undefined|null|NaN)\b/;
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9à-ỹ]+/gi, ' ').trim();

function base(kind) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', kind, 'base.json'), 'utf8')).questions; } catch (e) { return []; }
}

function validateWordform(doc, nn, p) {
  const seenBase = new Set(base('wordform').map(q => norm(q.q)));
  const seenPair = new Set(base('wordform').map(q => (q.base + '>' + q.answer).toLowerCase()));
  const stems = new Set(), pairs = new Set(), slots = [0, 0, 0, 0];
  let mcq = 0, text = 0;
  doc.questions.forEach((q, i) => {
    const want = `wf-ch-${nn}-${i + 1}`;
    const at = `q[${i}] (${q && q.id})`;
    if (!q || typeof q !== 'object') { p(`${at}: not an object`); return; }
    if (q.id !== want) p(`${at}: id must be ${want}`);
    if (q.level !== 'ch') p(`${at}: level must be "ch"`);
    if (!['noun', 'adj', 'adv', 'verb'].includes(q.cat)) p(`${at}: cat must be noun|adj|adv|verb`);
    if (typeof q.base !== 'string' || !/^[A-Z][A-Z-]{1,}$/.test(q.base)) p(`${at}: base must be the root in CAPITALS`);
    if (typeof q.q !== 'string' || (q.q.match(/___/g) || []).length !== 1) p(`${at}: q needs exactly one ___`);
    if (typeof q.q === 'string' && typeof q.base === 'string' && !q.q.includes(`___ (${q.base})`)) p(`${at}: the root must follow the blank as "___ (${q.base})"`);
    const ans = String(q.answer || '').trim();
    if (!/^[A-Za-z][A-Za-z-]*$/.test(ans)) p(`${at}: answer must be one word`);
    if (ans.toLowerCase() === String(q.base || '').toLowerCase()) p(`${at}: answer is the root itself`);
    if (q.type === 'mcq') {
      mcq++;
      if (!Array.isArray(q.options) || q.options.length !== 4) p(`${at}: mcq needs 4 options`);
      else {
        if (new Set(q.options.map(o => String(o).toLowerCase())).size !== 4) p(`${at}: duplicate options`);
        if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) p(`${at}: correct must be 0..3`);
        else { if (q.options[q.correct] !== q.answer) p(`${at}: answer must equal options[correct]`); slots[q.correct]++; }
      }
    } else if (q.type === 'text') {
      text++;
      if (!Array.isArray(q.accept) || !q.accept.length) p(`${at}: text needs accept`);
      else if (!q.accept.includes(q.answer)) p(`${at}: answer must be in accept`);
      if ('options' in q || 'correct' in q) p(`${at}: text must not carry options/correct`);
    } else p(`${at}: type must be mcq or text`);
    for (const k of ['vi', 'explanation']) if (typeof q[k] !== 'string' || q[k].trim().length < 12) p(`${at}: ${k} missing or too short`);
    if (junk.test(JSON.stringify(q))) p(`${at}: contains undefined/null/NaN`);
    const stem = norm(q.q || '');
    if (seenBase.has(stem)) p(`${at}: repeats a sentence from the original bank`);
    if (stems.has(stem)) p(`${at}: repeats a sentence in this file`);
    stems.add(stem);
    const pair = (String(q.base) + '>' + ans).toLowerCase();
    if (seenPair.has(pair)) p(`${at}: ${q.base} → ${ans} is already in the original bank — that is not Chuyên`);
    if (pairs.has(pair)) p(`${at}: ${q.base} → ${ans} twice in this file`);
    pairs.add(pair);
  });
  if (mcq < 5 || text < 8) p(`mix is ${mcq} mcq / ${text} typed — aim for ~8 / ~12`);
  if (mcq && Math.max(...slots) > Math.ceil(mcq * 0.5)) p(`the correct option sits in one slot ${Math.max(...slots)} of ${mcq} times — spread it`);
}

function validateRewrite(doc, nn, p) {
  const seenBase = new Set(base('rewrite').map(q => norm(q.orig)));
  const origs = new Set();
  doc.questions.forEach((q, i) => {
    const want = `rw-ch-${nn}-${i + 1}`;
    const at = `q[${i}] (${q && q.id})`;
    if (!q || typeof q !== 'object') { p(`${at}: not an object`); return; }
    if (q.id !== want) p(`${at}: id must be ${want}`);
    if (q.level !== 'ch') p(`${at}: level must be "ch"`);
    if (q.cat !== 'kwt') p(`${at}: cat must be "kwt"`);
    if (typeof q.catLabel !== 'string' || !q.catLabel.trim()) p(`${at}: catLabel missing`);
    if (typeof q.key !== 'string' || !/^[A-Z][A-Z'-]*$/.test(q.key)) p(`${at}: key must be ONE word in CAPITALS`);
    for (const k of ['orig', 'stem', 'answer', 'vi', 'explanation']) if (typeof q[k] !== 'string' || !q[k].trim()) p(`${at}: ${k} missing`);
    if (typeof q.tail !== 'string') p(`${at}: tail must be a string ("" allowed)`);
    if (!Array.isArray(q.accept) || !q.accept.length) p(`${at}: accept missing`);
    else {
      if (!q.accept.includes(q.answer)) p(`${at}: answer must be in accept`);
      const key = String(q.key || '').toLowerCase();
      q.accept.forEach(a => {
        const w = String(a).trim().split(/\s+/);
        if (w.length < 3 || w.length > 8) p(`${at}: accept entry "${a}" is ${w.length} words; must be 3–8`);
        if (key && !new RegExp('(^|[^a-z])' + key.replace(/[-']/g, '\\$&') + '([^a-z]|$)', 'i').test(a)) p(`${at}: accept entry "${a}" does not use the key word ${q.key} unchanged`);
      });
    }
    if (typeof q.stem === 'string' && /___/.test(q.stem + (q.tail || ''))) p(`${at}: do not write the blank into stem/tail — the app draws it`);
    if (junk.test(JSON.stringify(q))) p(`${at}: contains undefined/null/NaN`);
    const o = norm(q.orig || '');
    if (seenBase.has(o)) p(`${at}: repeats a sentence from the original bank`);
    if (origs.has(o)) p(`${at}: repeats a sentence in this file`);
    origs.add(o);
  });
  const keys = doc.questions.map(q => String(q.key || '').toUpperCase());
  if (new Set(keys).size < 16) p(`only ${new Set(keys).size} distinct key words in 20 items — vary them`);
}

function validate(kind, file) {
  const problems = [];
  const p = m => problems.push(m);
  if (kind !== 'wordform' && kind !== 'rewrite') return [`unknown kind "${kind}"`];
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return [`not valid JSON: ${e.message}`]; }
  const m = /ch-add-(\d{2})\.json$/.exec(path.basename(file));
  if (!m) return ['file must be named ch-add-<NN>.json'];
  if (doc.level !== 'ch') p('level must be "ch"');
  if (doc.file !== m[1]) p(`file must be "${m[1]}"`);
  if (!Array.isArray(doc.questions) || doc.questions.length !== PER_FILE) { p(`needs exactly ${PER_FILE} questions`); return problems; }
  (kind === 'wordform' ? validateWordform : validateRewrite)(doc, m[1], p);
  return problems;
}

module.exports = { validate, PER_FILE };

if (require.main === module) {
  const [kind, ...files] = process.argv.slice(2);
  if (!kind || !files.length) { console.error('usage: node scripts/validate-tier.js <wordform|rewrite> <file> [...]'); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    const problems = validate(kind, f);
    if (!problems.length) { console.log(`OK   ${f}`); continue; }
    bad++;
    console.log(`FAIL ${f} — ${problems.length} problem(s)`);
    problems.slice(0, 60).forEach(x => console.log('   - ' + x));
  }
  process.exit(bad ? 1 : 0);
}
