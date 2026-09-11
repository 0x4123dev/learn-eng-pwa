#!/usr/bin/env node
// balance-practice-keys.js — spread the correct option across A–D.
//
//   node scripts/balance-practice-keys.js            rewrites data/reading and data/cloze in place
//   node scripts/balance-practice-keys.js --check    report only, exit 1 if anything is skewed
//
// The engine draws options in file order and never shuffles. Authors — human
// or model — put the right answer first far more often than a quarter of the
// time: the tripled bank shipped with seven cloze texts whose ten keys were
// ALL option A, and slot D held 6 of 371 reading keys. A child who noticed
// would score 100% by tapping A and learn nothing.
//
// This rotates each MCQ's options so the key lands in a slot chosen by a
// hash of the item's id — deterministic, so running it twice changes nothing
// and a rebuilt bank matches the committed one. Rotation keeps the options'
// relative order, so an author's "near miss beside the answer" stays beside
// it. Nothing about the wording changes.
//
// Skipped on purpose: True/False/Not Given (fixed order by definition),
// error-identification items (their options are the four segments IN THE
// ORDER THEY APPEAR in the sentence), and any question whose options refer to
// each other by letter ("Both A and B", "None of the above").
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const check = process.argv.includes('--check');

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
const REFERS = /\b(both|neither|either|none|all)\b.*\b[A-D]\b|\bof the above\b/i;

function rotateTo(q, slot) {
  const n = q.options.length;
  const shift = ((slot - q.correct) % n + n) % n;
  if (!shift) return false;
  q.options = q.options.map((_, i) => q.options[((i - shift) % n + n) % n]);
  q.correct = slot;
  return true;
}

function balanceQuestion(q, key) {
  if (q.type !== 'mcq' || !Array.isArray(q.options) || q.options.length !== 4) return false;
  if (q.kind === 'tfng') return false;
  if (q.options.some(o => REFERS.test(o))) return false;
  return rotateTo(q, hash(key) % 4);
}

let changed = 0, skewed = [];
for (const [dir, re, list] of [['data/reading', /^reading-\d{2}\.json$/, 'passages'], ['data/cloze', /^cloze-\d{2}\.json$/, 'passages']]) {
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(x => re.test(x)).sort()) {
    const file = path.join(ROOT, dir, f);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    let touched = 0;
    for (const p of doc[list]) {
      p.questions.forEach((q, i) => {
        const key = p.id + '#' + (q.n || i + 1);
        if (check) {
          if (q.type === 'mcq' && q.options.length === 4 && q.kind !== 'tfng' && !q.options.some(o => REFERS.test(o))) {
            if (q.correct !== hash(key) % 4) touched++;
          }
        } else if (balanceQuestion(q, key)) touched++;
      });
      const mcq = p.questions.filter(q => q.type === 'mcq' && q.options.length === 4 && q.kind !== 'tfng');
      if (mcq.length >= 5) {
        const c = [0, 0, 0, 0]; mcq.forEach(q => c[q.correct]++);
        if (Math.max(...c) > Math.ceil(mcq.length * 0.6)) skewed.push(`${p.id} ${JSON.stringify(c)}`);
      }
    }
    if (touched && !check) fs.writeFileSync(file, JSON.stringify(doc, null, 1) + '\n');
    changed += touched;
  }
}
if (check) {
  console.log(changed ? `${changed} question(s) not in their balanced slot` : 'all keys in their balanced slots');
  if (skewed.length) { console.log('skewed items:'); skewed.forEach(s => console.log('  ' + s)); }
  process.exit(changed || skewed.length ? 1 : 0);
}
console.log(`✓ rotated ${changed} question(s); ${skewed.length ? skewed.length + ' item(s) still skewed after balancing: ' + skewed.join(', ') : 'no item skewed'}`);
