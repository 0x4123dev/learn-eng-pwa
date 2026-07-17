// wordform.test.js — the Word form MCQ bank (js/wordform-data.js) must be
// well-formed, and the quiz helpers must resolve questions correctly.
const { suite, test, assert } = require('./harness');
const path = require('path');

const { WORDFORM_QUESTIONS } = require(path.join(__dirname, '..', 'js', 'wordform-data.js'));
global.WORDFORM_QUESTIONS = WORDFORM_QUESTIONS;
const wf = require(path.join(__dirname, '..', 'js', 'wordform.js'));

const norm = s => String(s).toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
const CATS = new Set(['noun', 'adj', 'adv', 'verb']);

suite('word form bank', () => {
  test('has 500 questions with unique ids', () => {
    assert.equal(WORDFORM_QUESTIONS.length, 500);
    assert.equal(new Set(WORDFORM_QUESTIONS.map(q => q.id)).size, 500);
  });

  test('every question is well-formed (4 distinct options, correct = answer)', () => {
    for (const q of WORDFORM_QUESTIONS) {
      assert.truthy(CATS.has(q.cat), `${q.id}: bad cat ${q.cat}`);
      assert.truthy(Array.isArray(q.options) && q.options.length === 4, `${q.id}: needs 4 options`);
      assert.equal(new Set(q.options.map(norm)).size, 4, `${q.id}: duplicate options`);
      assert.truthy(q.correct >= 0 && q.correct < 4, `${q.id}: bad correct index`);
      assert.equal(norm(q.options[q.correct]), norm(q.answer), `${q.id}: options[correct] must equal answer`);
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
    assert.equal(wf.wordformBank().length, 500);
    assert.truthy(wf.wordformById('wf-1') && wf.wordformById('wf-1').id === 'wf-1');
    assert.equal(wf.wordformById('nope'), null);
  });
});
