// wordform.test.js — the Word form MCQ bank (js/wordform-data.js) must be
// well-formed, and the quiz helpers must resolve questions correctly.
const { suite, test, assert } = require('./harness');
// The quiz tabs render their Next button through the answer gate, exactly as
// the browser does — index.html always loads it before them.
Object.assign(global, require('../js/answer-audio.js'));
const path = require('path');

const { WORDFORM_QUESTIONS } = require(path.join(__dirname, '..', 'js', 'wordform-data.js'));
global.WORDFORM_QUESTIONS = WORDFORM_QUESTIONS;
const wf = require(path.join(__dirname, '..', 'js', 'wordform.js'));

const norm = s => String(s).toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
const CATS = new Set(['noun', 'adj', 'adv', 'verb']);

suite('word form bank', () => {
  // The bank carries two tiers since 2026-09-11: the original 600 (no
  // `level`, Không chuyên) and a Chuyên tier (level "ch") a child meets only
  // once an admin has switched it on. The pins on the ORIGINAL tier are as
  // they always were; the Chuyên tier is pinned in tests/chuyen-tier.test.js
  // and its files in tests/chuyen-tier-data.test.js.
  const KC = WORDFORM_QUESTIONS.filter(q => q.level !== 'ch');
  test('the original tier has 600 questions (300 mcq + 300 typed) with unique ids', () => {
    assert.equal(KC.length, 600);
    assert.equal(new Set(WORDFORM_QUESTIONS.map(q => q.id)).size, WORDFORM_QUESTIONS.length, 'ids unique across both tiers');
    // 200 of the original 500 multiple-choice questions were converted to typed
    // ones on 2026-08-25, so half the bank now asks the child to write the form.
    assert.equal(KC.filter(q => q.type === 'mcq').length, 300);
    assert.equal(KC.filter(q => q.type === 'text').length, 300);
  });

  test('mcq questions: 4 distinct options with correct = answer', () => {
    for (const q of WORDFORM_QUESTIONS.filter(q => q.type === 'mcq')) {
      assert.truthy(CATS.has(q.cat), `${q.id}: bad cat ${q.cat}`);
      assert.truthy(Array.isArray(q.options) && q.options.length === 4, `${q.id}: needs 4 options`);
      assert.equal(new Set(q.options.map(norm)).size, 4, `${q.id}: duplicate options`);
      assert.truthy(q.correct >= 0 && q.correct < 4, `${q.id}: bad correct index`);
      assert.equal(norm(q.options[q.correct]), norm(q.answer), `${q.id}: options[correct] must equal answer`);
    }
  });

  test('text questions: accept[] includes the model answer, grading works', () => {
    for (const q of WORDFORM_QUESTIONS.filter(q => q.type === 'text')) {
      assert.truthy(CATS.has(q.cat), `${q.id}: bad cat`);
      assert.truthy(Array.isArray(q.accept) && q.accept.length >= 1, `${q.id}: missing accept`);
      assert.truthy(q.accept.map(norm).includes(norm(q.answer)), `${q.id}: answer not in accept`);
      assert.truthy(wf._wfTextCorrect(q.answer, q), `${q.id}: exact answer should grade correct`);
      assert.truthy(wf._wfTextCorrect(' ' + q.answer.toUpperCase() + ' ', q), `${q.id}: case/space-insensitive grading`);
      assert.truthy(!wf._wfTextCorrect('zznotaword', q), `${q.id}: wrong text should grade incorrect`);
    }
  });

  test('every question has one blank, a (BASE) root, and a clear explanation', () => {
    for (const q of WORDFORM_QUESTIONS) {
      assert.equal((q.q.match(/___/g) || []).length, 1, `${q.id}: needs exactly one ___`);
      assert.truthy(/\([A-Z][A-Z\- ]*\)/.test(q.q), `${q.id}: q must show the (BASE) root`);
      assert.truthy(q.vi && q.vi.length > 0, `${q.id}: missing vi note`);
      assert.truthy(q.explanation && q.explanation.length >= 40, `${q.id}: explanation too short`);
    }
  });

  test('quiz helpers resolve and start correctly', () => {
    // With no admin switch (the test's appState), the bank IS the original tier.
    assert.equal(wf.wordformBank().length, 600);
    assert.truthy(wf.wordformById('wf-1') && wf.wordformById('wf-1').id === 'wf-1');
    assert.equal(wf.wordformById('nope'), null);
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
