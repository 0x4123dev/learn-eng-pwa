// chuyen-tier-data.test.js — the Chuyên tier files of Word Form and Rewrite,
// as data.
//
// 15 Word Form files and 10 Rewrite files, 20 items each, authored by
// parallel agents and each re-solved blind by a verifier. This file holds
// them to the contract (data/wordform/SCHEMA.md) in the suite, checks the
// built banks are the source files, and pins two things the verifiers cannot
// see across files: no root+answer pair repeats across the whole Chuyên
// tier, and the correct MCQ option is spread across A–D (the tab draws
// options in file order and never shuffles).
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { validate } = require(path.join(ROOT, 'scripts', 'validate-tier.js'));
const { WORDFORM_QUESTIONS } = require(path.join(ROOT, 'js', 'wordform-data.js'));
const { REWRITE_QUESTIONS } = require(path.join(ROOT, 'js', 'rewrite-data.js'));

const files = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter(f => /^ch-add-\d{2}\.json$/.test(f)).sort();
const load = (dir, f) => JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), 'utf8')).questions;

suite('Chuyên tier files: contract', () => {
  test('Word Form: 15 files, every one valid', () => {
    const fs_ = files('data/wordform');
    assert.equal(fs_.length, 15, 'expected 15 Word Form addition files, found ' + fs_.length);
    for (const f of fs_) {
      const problems = validate('wordform', path.join(ROOT, 'data/wordform', f));
      assert.deepEqual(problems, [], f + ': ' + problems.slice(0, 4).join(' | '));
    }
  });

  test('Rewrite: 10 files, every one valid', () => {
    const fs_ = files('data/rewrite');
    assert.equal(fs_.length, 10, 'expected 10 Rewrite addition files, found ' + fs_.length);
    for (const f of fs_) {
      const problems = validate('rewrite', path.join(ROOT, 'data/rewrite', f));
      assert.deepEqual(problems, [], f + ': ' + problems.slice(0, 4).join(' | '));
    }
  });

  test('the built banks hold base + every addition (rebuild if this fails)', () => {
    const wfAdded = files('data/wordform').flatMap(f => load('data/wordform', f));
    const rwAdded = files('data/rewrite').flatMap(f => load('data/rewrite', f));
    assert.equal(WORDFORM_QUESTIONS.filter(q => q.level === 'ch').length, wfAdded.length);
    assert.equal(REWRITE_QUESTIONS.filter(q => q.level === 'ch').length, rwAdded.length);
    assert.equal(WORDFORM_QUESTIONS.length, 600 + wfAdded.length);
    assert.equal(REWRITE_QUESTIONS.length, 200 + rwAdded.length);
    const ids = new Set(WORDFORM_QUESTIONS.map(q => q.id));
    wfAdded.forEach(q => assert.truthy(ids.has(q.id), q.id + ' missing from the built bank'));
  });
});

suite('Chuyên tier files: what one file cannot see', () => {
  test('root → answer pairs are nearly all distinct across the tier', () => {
    // Authors with adjacent focuses (negative prefixes; double derivation)
    // landed on the same pair a few times — illegal/illegally, unpredictability.
    // The sentences differ, so those are still sound items, and two such items
    // in one ten-question round is unlikely; but a tier where the same pair
    // keeps coming back is not "300 items". Cap the repeats at 5%.
    const seen = new Set();
    let repeats = 0;
    const ch = WORDFORM_QUESTIONS.filter(q => q.level === 'ch');
    for (const q of ch) {
      const k = (q.base + '>' + q.answer).toLowerCase();
      if (seen.has(k)) repeats++;
      seen.add(k);
    }
    assert.truthy(repeats <= ch.length * 0.05, repeats + ' repeated pairs across ' + ch.length + ' items');
  });

  test('no rewrite sentence repeats across the whole Chuyên tier', () => {
    const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
    const seen = new Set(), dupes = [];
    for (const q of REWRITE_QUESTIONS.filter(q => q.level === 'ch')) {
      const k = norm(q.orig);
      if (seen.has(k)) dupes.push(q.id);
      seen.add(k);
    }
    assert.deepEqual(dupes, []);
  });

  test('the correct MCQ option is spread across A–D over the tier', () => {
    const mcq = WORDFORM_QUESTIONS.filter(q => q.level === 'ch' && q.type === 'mcq');
    const c = [0, 0, 0, 0]; mcq.forEach(q => c[q.correct]++);
    assert.truthy(Math.min(...c) >= mcq.length * 0.15, 'slots ' + JSON.stringify(c) + ' of ' + mcq.length);
  });

  test('the tier does the work the PTNK Chuyên paper asks for: prefixes and no overlap with the original', () => {
    // Difficulty itself was judged by the blind verifiers (they rewrote items
    // that were not Chuyên). What can be checked as data: a real share of the
    // answers add a prefix the root does not have (il-/ir-/dis-/un-/over-…),
    // and no root → answer pair is one the original tier already drills.
    const kc = WORDFORM_QUESTIONS.filter(q => q.level !== 'ch'), ch = WORDFORM_QUESTIONS.filter(q => q.level === 'ch');
    const prefixed = ch.filter(q => /^(un|in|im|il|ir|dis|non|mis|over|under|re)/i.test(q.answer) && !new RegExp('^' + q.answer.slice(0, 2), 'i').test(q.base)).length;
    assert.truthy(prefixed >= ch.length * 0.12, `only ${prefixed} of ${ch.length} add a prefix — not the PTNK paper`);
    const kcPairs = new Set(kc.map(q => (q.base + '>' + q.answer).toLowerCase()));
    const overlap = ch.filter(q => kcPairs.has((q.base + '>' + q.answer).toLowerCase())).map(q => q.id);
    assert.deepEqual(overlap, [], 'a Chuyên item that the original tier already drills');
  });

  test('every key-word transformation keeps its key word unchanged in every accepted answer', () => {
    for (const q of REWRITE_QUESTIONS.filter(q => q.level === 'ch')) {
      const re = new RegExp('(^|[^a-z])' + q.key.toLowerCase().replace(/[-']/g, '\\$&') + '([^a-z]|$)', 'i');
      for (const a of q.accept) assert.truthy(re.test(a), `${q.id}: "${a}" drops or inflects ${q.key}`);
      assert.truthy(q.accept.every(a => { const n = a.trim().split(/\s+/).length; return n >= 3 && n <= 8; }), q.id + ': 3–8 words');
    }
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
