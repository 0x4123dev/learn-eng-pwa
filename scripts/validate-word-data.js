#!/usr/bin/env node
// validate-word-data.js — is this Career Paths unit file one the Word tab can take?
//
//   node scripts/validate-word-data.js data/career-paths/pr1-u*.json
//
// data/career-paths/SCHEMA.md, executable. Shape, naming, the en/vi/emoji
// discipline, and no repeated word within a book (the other unit files of the
// same book are read for that). Whether the list matches the book's Scope and
// Sequence page is for the review agent that reads the scan.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data', 'career-paths');
const junk = /\b(undefined|null|NaN)\b/;
// Letters, digits, space, hyphen, apostrophe, dot, slash. A leading digit is
// allowed for the one entry a book prints that way ("24-hour", Book 3 unit 13).
const EN_RE = /^[A-Za-z0-9][A-Za-z0-9 '\-./&]*$/;
const VI_MARK = /[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
const HAS_LETTER_OR_DIGIT = /[A-Za-z0-9]/;

function loadBook(book, skipFile) {
  const seen = new Map();
  let files = [];
  try { files = fs.readdirSync(DIR); } catch (e) { return seen; }
  for (const f of files) {
    if (!new RegExp('^pr' + book + '-u\\d\\d\\.json$').test(f)) continue;
    if (path.resolve(DIR, f) === path.resolve(skipFile)) continue;
    try {
      const doc = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
      for (const w of (doc.words || [])) if (w && w.en) seen.set(String(w.en).toLowerCase(), f);
    } catch (e) { /* that file's own run will report it */ }
  }
  return seen;
}

function validateFile(file) {
  const problems = [];
  const p = m => problems.push(m);
  const name = path.basename(file);
  const m = name.match(/^pr([123])-u(\d\d)\.json$/);
  if (!m) { p('file name must be pr<1-3>-u<01-15>.json'); return problems; }
  const book = Number(m[1]), unit = Number(m[2]);
  if (unit < 1 || unit > 15) p('unit in the file name must be 01..15');

  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { p('not valid JSON: ' + e.message); return problems; }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) { p('top level must be an object'); return problems; }
  if (doc.book !== book) p(`book must be ${book} (from the file name)`);
  if (doc.unit !== unit) p(`unit must be ${unit} (from the file name)`);
  if (typeof doc.title !== 'string' || doc.title.trim().length < 3) p('title missing');
  if (!Array.isArray(doc.words)) { p('words must be an array'); return problems; }
  if (doc.words.length < 8) p(`only ${doc.words.length} words — a Career Paths unit lists 10-16`);
  if (doc.words.length > 20) p(`${doc.words.length} words — more than any unit of the book lists`);
  const extra = Object.keys(doc).filter(k => !['book', 'unit', 'title', 'words'].includes(k));
  if (extra.length) p('unexpected keys: ' + extra.join(', '));

  const inBook = loadBook(book, file);
  const here = new Set();
  doc.words.forEach((w, i) => {
    const at = `words[${i}]` + (w && w.en ? ` (${w.en})` : '');
    if (!w || typeof w !== 'object') { p(`${at}: not an object`); return; }
    const keys = Object.keys(w).filter(k => !['en', 'vi', 'emoji', 'ex', 'exVi'].includes(k));
    if (keys.length) p(`${at}: unexpected keys ${keys.join(', ')}`);
    const en = typeof w.en === 'string' ? w.en : '';
    if (!en.trim()) p(`${at}: en missing`);
    else {
      if (en !== en.trim() || /\s{2}/.test(en)) p(`${at}: en has stray whitespace`);
      if (!EN_RE.test(en)) p(`${at}: en may only hold letters, digits, spaces, hyphens, apostrophes`);
      if (en.length > 40) p(`${at}: en is longer than any vocabulary entry`);
      // Lowercase unless it is an acronym (all capitals) — "Internet" is the
      // one proper noun the books list, allowed by name.
      const word0 = en.split(/[\s-]/)[0];
      if (/[A-Z]/.test(en) && !/^[A-Z0-9.&]+$/.test(word0) && !/^Internet$/.test(word0)) p(`${at}: en must be lowercase (acronyms stay in capitals)`);
      const key = en.toLowerCase();
      if (here.has(key)) p(`${at}: repeated in this file`);
      here.add(key);
      if (inBook.has(key)) p(`${at}: already listed in ${inBook.get(key)}`);
    }
    const vi = typeof w.vi === 'string' ? w.vi : '';
    if (!vi.trim()) p(`${at}: vi missing`);
    else {
      if (vi.trim().length < 3) p(`${at}: vi too short`);
      if (vi.length > 90) p(`${at}: vi is a sentence, not a meaning (>90 chars)`);
      if (!VI_MARK.test(vi)) p(`${at}: vi carries no Vietnamese letter — is it Vietnamese?`);
      if (en && vi.toLowerCase().split(/[^a-z]+/).includes(en.toLowerCase())) p(`${at}: vi repeats the English word`);
      if (/[.!?]$/.test(vi.trim())) p(`${at}: vi must not end with a full stop`);
    }
    const emoji = typeof w.emoji === 'string' ? w.emoji : '';
    if (!emoji.trim()) p(`${at}: emoji missing`);
    else {
      if (HAS_LETTER_OR_DIGIT.test(emoji)) p(`${at}: emoji must not contain letters or digits`);
      if (/^[0-9:]+$/.test(emoji)) p(`${at}: a digits-only emoji renders as a number card`);
      const glyphs = [...emoji.replace(/[‍️]/g, '')].length;
      if (glyphs > 6) p(`${at}: at most 3 emoji`);
    }
    // The example sentence: the engine (js/units.js _unitExampleParts) finds
    // the exact `en` spelling once, bounded by non-letters, and blanks it.
    const ex = typeof w.ex === 'string' ? w.ex.trim() : '';
    const exVi = typeof w.exVi === 'string' ? w.exVi.trim() : '';
    if (!ex) p(`${at}: ex (example sentence) missing`);
    else if (en) {
      const words = ex.split(/\s+/).length;
      if (words < 5) p(`${at}: ex too short (${words} words)`);
      if (words > 22) p(`${at}: ex too long (${words} words)`);
      if (!/[.!?]$/.test(ex)) p(`${at}: ex must end with . ! or ?`);
      const esc = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hits = ex.match(new RegExp('(^|[^A-Za-z-])' + esc + '(?![A-Za-z-])', 'gi')) || [];
      if (hits.length !== 1) p(`${at}: ex must contain "${en}" exactly once as a whole word (found ${hits.length})`);
      else if (!new RegExp('(^|[^A-Za-z-])' + esc + '(?![A-Za-z-])').test(ex)) p(`${at}: ex spells "${en}" with different capitals`);
      if (VI_MARK.test(ex)) p(`${at}: ex must be English`);
    }
    if (!exVi) p(`${at}: exVi (translation) missing`);
    else {
      if (!VI_MARK.test(exVi)) p(`${at}: exVi carries no Vietnamese letter`);
      if (!/[.!?]$/.test(exVi)) p(`${at}: exVi must end with . ! or ?`);
      if (exVi.length < 10) p(`${at}: exVi too short`);
    }
    if (junk.test(JSON.stringify(w))) p(`${at}: contains undefined/null/NaN`);
  });
  return problems;
}

function main(argv) {
  const files = argv.slice(2);
  if (!files.length) { console.error('usage: validate-word-data.js data/career-paths/pr1-u*.json'); return 2; }
  let bad = 0;
  for (const f of files) {
    const problems = validateFile(f);
    if (problems.length) {
      bad++;
      console.log(`✗ ${f}`);
      for (const m of problems) console.log('   - ' + m);
    } else {
      const n = JSON.parse(fs.readFileSync(f, 'utf8')).words.length;
      console.log(`✓ ${f} (${n} words)`);
    }
  }
  console.log(bad ? `${bad} of ${files.length} file(s) have problems` : `all ${files.length} file(s) valid`);
  return bad ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv));
module.exports = { validateFile };
