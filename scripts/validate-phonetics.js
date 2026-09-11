#!/usr/bin/env node
// validate-phonetics.js — is this bank file / lesson one the Phonetics &
// Stress tab can take? data/phonetics/SCHEMA.md, executable.
//
//   node scripts/validate-phonetics.js data/phonetics/ph-*.json
//   node scripts/validate-phonetics.js --lesson data/phonetics/lessons/lesson-*.json
//
// What can be checked as data: shape, ids, one level per file, exactly one
// underlined part per sound option, same syllable count per stress item,
// three-share-one-differs on the stress positions, slot spread, no repeated
// key word. Whether an IPA transcription is right is for the blind verifier.
'use strict';
const fs = require('fs');
const path = require('path');

const PER_FILE = 20;
const SOUND_RULES = ['ed', 'es', 'a', 'e', 'i', 'o', 'u', 'oo-ou-ow', 'ea-ee-ie', 'c-g', 'ch-sh-th-gh', 's-z-sh', 'silent', 'h', 'prefix-ex', 'other'];
const STRESS_RULES = ['2syl', 'suffix-neutral', 'suffix-shift', 'suffix-final', '3syl', 'prefix', 'compound', '4syl', 'other'];
const LESSON_TAGS = new Set(['p', 'h4', 'ul', 'li', 'table', 'tr', 'td', 'th', 'b', 'br', 'i']);
const junk = /\b(undefined|null|NaN)\b/;
const strip = s => String(s).replace(/<\/?u>/g, '');

function validateBank(file) {
  const problems = [];
  const p = m => problems.push(m);
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return [`not valid JSON: ${e.message}`]; }
  const m = /ph-(\d{2})\.json$/.exec(path.basename(file));
  if (!m) return ['file must be named ph-<NN>.json'];
  const nn = m[1];
  if (doc.file !== nn) p(`file must be "${nn}"`);
  if (doc.level !== 'kc' && doc.level !== 'ch') p('level must be "kc" or "ch"');
  if (!Array.isArray(doc.items) || doc.items.length !== PER_FILE) { p(`needs exactly ${PER_FILE} items`); return problems; }
  const keys = new Set(), sets = new Set(), slots = [0, 0, 0, 0];
  doc.items.forEach((q, i) => {
    const want = `ph-${doc.level}-${nn}-${i + 1}`;
    const at = `item[${i}] (${q && q.id})`;
    if (!q || typeof q !== 'object') { p(`${at}: not an object`); return; }
    if (q.id !== want) p(`${at}: id must be ${want}`);
    if (q.level !== doc.level) p(`${at}: level must be "${doc.level}"`);
    const kind = i < 10 ? 'sound' : 'stress';
    if (q.kind !== kind) p(`${at}: items 1–10 are sound, 11–20 stress — this one must be "${kind}"`);
    const rules = kind === 'sound' ? SOUND_RULES : STRESS_RULES;
    if (!rules.includes(q.rule)) p(`${at}: rule "${q.rule}" is not a ${kind} rule`);
    if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o => typeof o !== 'string' || !o.trim())) { p(`${at}: needs 4 options`); return; }
    if (!Array.isArray(q.words) || q.words.length !== 4) p(`${at}: needs 4 words`);
    else q.options.forEach((o, k) => { if (strip(o) !== q.words[k]) p(`${at}: words[${k}] must be options[${k}] without tags`); });
    if (!Array.isArray(q.ipa) || q.ipa.length !== 4 || q.ipa.some(s => !/^\/.+\/$/.test(String(s)))) p(`${at}: needs 4 ipa strings in slashes`);
    if (new Set(q.options.map(o => strip(o).toLowerCase())).size !== 4) p(`${at}: duplicate words`);
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) p(`${at}: correct must be 0..3`); else slots[q.correct]++;
    if (kind === 'sound') {
      q.options.forEach((o, k) => {
        const n = (o.match(/<u>[^<]+<\/u>/g) || []).length;
        if (n !== 1 || /<(?!\/?u>)/.test(o)) p(`${at}: option ${k} needs exactly one <u>…</u> and no other tag`);
      });
      if ('syllables' in q || 'stress' in q) p(`${at}: sound items carry no syllables/stress`);
    } else {
      if (q.options.some(o => /<|>/.test(o))) p(`${at}: stress options are plain words`);
      if (!Array.isArray(q.syllables) || q.syllables.length !== 4 || q.syllables.some(n => !Number.isInteger(n) || n < 2 || n > 6)) p(`${at}: syllables must be 4 integers 2..6`);
      else if (new Set(q.syllables).size !== 1) p(`${at}: all four words must have the same number of syllables (${q.syllables.join(',')})`);
      if (!Array.isArray(q.stress) || q.stress.length !== 4 || q.stress.some((s, k) => !Number.isInteger(s) || s < 1 || (Array.isArray(q.syllables) && s > q.syllables[k]))) p(`${at}: stress must be 4 integers within the syllable count`);
      else if (Number.isInteger(q.correct)) {
        const others = q.stress.filter((_, k) => k !== q.correct);
        if (new Set(others).size !== 1) p(`${at}: the three non-key words must share a stress position (${q.stress.join(',')})`);
        else if (others[0] === q.stress[q.correct]) p(`${at}: the key word must differ in stress (${q.stress.join(',')})`);
      }
      if (Array.isArray(q.ipa) && q.ipa.some(s => !/ˈ/.test(String(s)))) p(`${at}: every stress ipa needs a stress mark ˈ`);
    }
    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 40) p(`${at}: explanation missing or too short`);
    else if ((q.explanation.match(/\//g) || []).length < 4) p(`${at}: explanation should give IPA for the words`);
    if (junk.test(JSON.stringify(q))) p(`${at}: contains undefined/null/NaN`);
    const key = Number.isInteger(q.correct) && q.words ? String(q.words[q.correct]).toLowerCase() : '';
    if (key && keys.has(key)) p(`${at}: "${key}" is already the key of another item in this file`);
    keys.add(key);
    const set = q.words ? q.words.map(w => String(w).toLowerCase()).sort().join('|') : '';
    if (set && sets.has(set)) p(`${at}: repeats another item's option set`);
    sets.add(set);
  });
  if (Math.max(...slots) > 8) p(`the correct option sits in one slot ${Math.max(...slots)} of ${PER_FILE} times — spread it (max 8)`);
  return problems;
}

function validateLesson(file) {
  const problems = [];
  const p = m => problems.push(m);
  let l;
  try { l = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return [`not valid JSON: ${e.message}`]; }
  if (typeof l.key !== 'string' || !/^[a-z0-9-]+$/.test(l.key)) p('key must be kebab-case');
  if (typeof l.title !== 'string' || l.title.length < 8) p('title missing');
  if (typeof l.icon !== 'string' || !l.icon) p('icon missing');
  const c = typeof l.content === 'string' ? l.content : '';
  if (c.length < 1500 || c.length > 6000) p(`content is ${c.length} chars; want 1500–6000`);
  if ((c.match(/<h4>/g) || []).length < 3) p('needs ≥3 <h4> sections');
  if (!/Bẫy/.test(c)) p('needs a "⚠️ Bẫy thường gặp" section');
  if (!/Cách làm bài/.test(c)) p('needs a "🎯 Cách làm bài" section');
  if ((c.match(/\/[^\/<>]{1,30}\//g) || []).length < 10) p('needs IPA examples in slashes (≥10)');
  const tags = [...c.matchAll(/<\/?([a-zA-Z0-9]+)[^>]*>/g)].map(x => x[1].toLowerCase());
  const bad = [...new Set(tags.filter(t => !LESSON_TAGS.has(t)))];
  if (bad.length) p(`disallowed tags: ${bad.join(',')}`);
  if (/<script|onerror=|onclick=|style=/i.test(c)) p('unsafe markup');
  if (junk.test(c)) p('contains undefined/null/NaN');
  return problems;
}

module.exports = { validateBank, validateLesson, PER_FILE, SOUND_RULES, STRESS_RULES };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const lesson = argv[0] === '--lesson';
  const files = lesson ? argv.slice(1) : argv;
  if (!files.length) { console.error('usage: node scripts/validate-phonetics.js [--lesson] <file> [...]'); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    const problems = (lesson ? validateLesson : validateBank)(f);
    if (!problems.length) { console.log(`OK   ${f}`); continue; }
    bad++;
    console.log(`FAIL ${f} — ${problems.length} problem(s)`);
    problems.slice(0, 60).forEach(x => console.log('   - ' + x));
  }
  process.exit(bad ? 1 : 0);
}
