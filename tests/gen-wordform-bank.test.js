// gen-wordform-bank.test.js — deep characterization of the Word form bank
// (js/wordform-data.js): id sequencing, base-word formatting, the two question
// layouts, option/answer conventions, ✗-marked explanations and vi notes.
// Complements tests/wordform.test.js (which covers counts, option shape,
// grading and blank/explanation basics) without repeating its assertions.
const { suite, test, assert } = require('./harness');
const path = require('path');

const { WORDFORM_QUESTIONS } = require(path.join(__dirname, '..', 'js', 'wordform-data.js'));

const MCQ = WORDFORM_QUESTIONS.filter(q => q.type === 'mcq');
const TEXT = WORDFORM_QUESTIONS.filter(q => q.type === 'text');
const byId = id => WORDFORM_QUESTIONS.find(q => q.id === id);

// 200 of the wf- questions became typed in 2026-08-25 without moving or being
// renumbered, so id prefix no longer tells you the format — the file is still
// 500 wf- entries followed by 100 wft- ones, but 200 of the wf- block are text.
const WF = WORDFORM_QUESTIONS.filter(q => q.id.startsWith('wf-'));
const WFT = WORDFORM_QUESTIONS.filter(q => q.id.startsWith('wft-'));

// 37 late mcq entries put "(BASE)" after the sentence instead of inline "___ (BASE)".
const TAIL_LAYOUT_IDS = [
  'wf-444', 'wf-445', 'wf-446', 'wf-447', 'wf-448', 'wf-449', 'wf-450', 'wf-451',
  'wf-452', 'wf-453', 'wf-454', 'wf-455', 'wf-456', 'wf-457', 'wf-458', 'wf-459',
  'wf-460', 'wf-461', 'wf-462', 'wf-463', 'wf-464', 'wf-465', 'wf-466', 'wf-467',
  'wf-488', 'wf-489', 'wf-490', 'wf-491', 'wf-492', 'wf-493', 'wf-494', 'wf-495',
  'wf-496', 'wf-497', 'wf-498', 'wf-499', 'wf-500'
];
// 11 mcq where the base word itself (lowercased) IS the correct answer.
const BASE_IS_ANSWER_IDS = [
  'wf-202', 'wf-203', 'wf-204', 'wf-209', 'wf-224', 'wf-228',
  'wf-234', 'wf-235', 'wf-236', 'wf-239', 'wf-241'
];

suite('gen: wordform bank ids & shape', () => {
  test('wf- ids run wf-1..wf-500 sequentially in file order', () => {
    WF.forEach((q, i) => assert.equal(q.id, `wf-${i + 1}`, `entry at index ${i}`));
  });

  test('wft- ids run wft-1..wft-100 sequentially in file order', () => {
    WFT.forEach((q, i) => assert.equal(q.id, `wft-${i + 1}`, `entry at index ${i}`));
  });

  test('all 500 wf- entries precede all 100 wft- entries in the array', () => {
    const ids = WORDFORM_QUESTIONS.map(q => q.id);
    assert.equal(ids.findIndex(id => id.startsWith('wft-')), 500);
    assert.falsy(ids.slice(500).some(id => !id.startsWith('wft-')), 'no wf- entry after the wft- block');
  });

  test('an id is never reused, whatever format it now carries', () => {
    assert.equal(new Set(WORDFORM_QUESTIONS.map(q => q.id)).size, 600);
  });

  test('every mcq has exactly the documented key set', () => {
    const expected = 'answer,base,cat,correct,explanation,id,options,q,type,vi';
    for (const q of MCQ) {
      assert.equal(Object.keys(q).sort().join(','), expected, q.id);
    }
  });

  test('every text question has exactly the documented key set', () => {
    const expected = 'accept,answer,base,cat,explanation,id,q,type,vi';
    for (const q of TEXT) {
      assert.equal(Object.keys(q).sort().join(','), expected, q.id);
    }
  });

  test('cat distribution: noun 159 / adj 156 / adv 149 / verb 136, taught in both formats', () => {
    const count = (list, cat) => list.filter(q => q.cat === cat).length;
    const dist = list => ({
      noun: count(list, 'noun'), adj: count(list, 'adj'),
      adv: count(list, 'adv'), verb: count(list, 'verb')
    });
    // The overall spread is content: it is what the tab actually teaches, and
    // converting a question to typed does not move it between classes.
    assert.deepEqual(dist(WORDFORM_QUESTIONS), { noun: 159, adj: 156, adv: 149, verb: 136 });
    // The split between formats is free to shift; what must hold is that a
    // child meets every word class both by choosing and by writing.
    for (const cat of ['noun', 'adj', 'adv', 'verb']) {
      assert.truthy(count(MCQ, cat) >= 25, `only ${count(MCQ, cat)} ${cat} questions left to choose from`);
      assert.truthy(count(TEXT, cat) >= 25, `only ${count(TEXT, cat)} ${cat} questions to type`);
    }
  });

  test('all 600 question sentences are unique (no copy-pasted stems)', () => {
    assert.equal(new Set(WORDFORM_QUESTIONS.map(q => q.q)).size, 600);
  });
});

suite('gen: wordform base & question layout', () => {
  test('every base is one ALL-CAPS token of 3-12 letters, 386 unique overall', () => {
    for (const q of WORDFORM_QUESTIONS) {
      assert.truthy(/^[A-Z]+$/.test(q.base), `${q.id}: base ${JSON.stringify(q.base)}`);
      assert.inRange(q.base.length, 3, 12, `${q.id}: base length`);
    }
    assert.equal(new Set(WORDFORM_QUESTIONS.map(q => q.base)).size, 386);
  });

  test('q contains "(" + base + ")" exactly once for all 600', () => {
    for (const q of WORDFORM_QUESTIONS) {
      assert.equal(q.q.split(`(${q.base})`).length - 1, 1, `${q.id}: (${q.base}) must appear once`);
    }
  });

  test('every question is inline "___ (BASE)" apart from the 37 trailing ones', () => {
    const inline = WORDFORM_QUESTIONS.filter(q => q.q.includes(`___ (${q.base})`));
    assert.equal(inline.length, WORDFORM_QUESTIONS.length - TAIL_LAYOUT_IDS.length);
  });

  test('exactly 37 questions (wf-444..467, wf-488..500) use the trailing "(BASE)" layout', () => {
    // Checked across the whole bank rather than the mcq half: thirteen of these
    // are typed now, and the layout travelled with the sentence.
    const tail = WORDFORM_QUESTIONS.filter(q => !q.q.includes(`___ (${q.base})`));
    assert.deepEqual(tail.map(q => q.id), TAIL_LAYOUT_IDS);
  });

  test('trailing-layout questions end with "(BASE)" and still contain one blank', () => {
    for (const id of TAIL_LAYOUT_IDS) {
      const q = byId(id);
      assert.truthy(q.q.trim().endsWith(`(${q.base})`), `${id}: q must end with (${q.base})`);
      assert.equal((q.q.match(/___/g) || []).length, 1, `${id}: one blank`);
    }
  });

  test('562 questions end with "."; only the 37 tail-layout mcq and quote-final wf-43 do not', () => {
    const nonDot = WORDFORM_QUESTIONS.filter(q => !q.q.trim().endsWith('.')).map(q => q.id);
    assert.deepEqual(nonDot.sort(), TAIL_LAYOUT_IDS.concat('wf-43').sort());
    // wf-43 embeds direct speech, so the sentence closes with .'
    assert.truthy(byId('wf-43').q.trim().endsWith(".'"), 'wf-43 ends inside a quotation');
  });
});

suite('gen: wordform mcq options & answers', () => {
  test('all mcq options are trimmed non-empty strings', () => {
    for (const q of MCQ) {
      for (const o of q.options) {
        assert.truthy(typeof o === 'string' && o.length > 0 && o === o.trim(),
          `${q.id}: bad option ${JSON.stringify(o)}`);
      }
    }
  });

  test('options and answers are lowercase in every mcq except wf-444', () => {
    for (const q of MCQ) {
      if (q.id === 'wf-444') continue;
      assert.equal(q.answer, q.answer.toLowerCase(), `${q.id}: answer casing`);
      for (const o of q.options) {
        assert.equal(o, o.toLowerCase(), `${q.id}: option casing ${o}`);
      }
    }
  });

  test('wf-444 is the sentence-initial-blank exception with capitalized "Confidence"', () => {
    const q = byId('wf-444');
    assert.truthy(q.q.startsWith('___'), 'blank opens the sentence');
    assert.equal(q.answer, 'Confidence');
    assert.equal(q.options[q.correct], 'Confidence');
    // the capitalized word is the only non-lowercase option in the whole bank
    const nonLower = MCQ.filter(x => x.options.some(o => o !== o.toLowerCase()));
    assert.deepEqual(nonLower.map(x => x.id), ['wf-444']);
  });

  test('every option is a single unbroken letter token of 3-17 chars (no spaces/hyphens/digits)', () => {
    for (const q of MCQ) {
      for (const o of q.options) {
        assert.truthy(/^[A-Za-z]+$/.test(o), `${q.id}: option ${JSON.stringify(o)} must be letters only`);
        assert.inRange(o.length, 3, 17, `${q.id}: option length ${o}`);
      }
    }
  });

  test('the answer string appears exactly once among the options (strict equality)', () => {
    for (const q of MCQ) {
      assert.equal(q.options.filter(o => o === q.answer).length, 1, q.id);
    }
  });

  test('nearly every mcq offers the untransformed base as a trap option', () => {
    const withBase = MCQ.filter(q => q.options.includes(q.base.toLowerCase()));
    assert.truthy(withBase.length / MCQ.length > 0.9,
      `only ${withBase.length}/${MCQ.length} mcq offer the base form`);
  });

  test('exactly 11 mcq legitimately keep the base form as the answer (at the correct index)', () => {
    const ids = MCQ.filter(q => q.answer === q.base.toLowerCase()).map(q => q.id);
    assert.deepEqual(ids, BASE_IS_ANSWER_IDS);
    for (const id of BASE_IS_ANSWER_IDS) {
      const q = byId(id);
      assert.equal(q.options[q.correct], q.base.toLowerCase(), id);
    }
  });

  test('wherever the base form is offered but not the answer, it is a wrong option', () => {
    const distractors = MCQ.filter(q =>
      q.options.includes(q.base.toLowerCase()) && q.answer !== q.base.toLowerCase());
    assert.truthy(distractors.length > 200, 'the trap should still be widespread');
    for (const q of distractors) {
      assert.truthy(q.options.indexOf(q.base.toLowerCase()) !== q.correct,
        `${q.id}: base distractor must not sit at the correct index`);
    }
  });

  test('correct answer position is near-uniform across A/B/C/D', () => {
    // Pinning the four exact counts meant any change to the bank had to be
    // hand-reconciled. What actually matters is that no position pays off: a
    // child who always taps D must do no better than one in four.
    const dist = { 0: 0, 1: 0, 2: 0, 3: 0 };
    MCQ.forEach(q => { dist[q.correct]++; });
    const even = MCQ.length / 4;
    for (const k of [0, 1, 2, 3]) {
      assert.inRange(dist[k], Math.floor(even * 0.85), Math.ceil(even * 1.15),
        `position ${'ABCD'[k]} holds ${dist[k]} of ${MCQ.length} answers`);
    }
  });
});

suite('gen: wordform explanations & vi notes', () => {
  test('every mcq explanation contains exactly three ✗ marks', () => {
    for (const q of MCQ) {
      assert.equal((q.explanation.match(/✗/g) || []).length, 3, q.id);
    }
  });

  test('every wrong option is called out as "✗ <option>" in its explanation', () => {
    for (const q of MCQ) {
      q.options.forEach((o, i) => {
        if (i === q.correct) return;
        assert.truthy(q.explanation.includes(`✗ ${o}`), `${q.id}: missing "✗ ${o}"`);
      });
    }
  });

  test('text explanations never use the ✗ mark (no wrong options to reject)', () => {
    for (const q of TEXT) {
      assert.falsy(q.explanation.includes('✗'), q.id);
    }
  });

  test('every explanation is substantial (≥78 chars) and names the answer, verbatim in 598', () => {
    for (const q of WORDFORM_QUESTIONS) {
      assert.inRange(q.explanation.length, 78, 1000, `${q.id}: explanation length`);
      assert.truthy(q.explanation.toLowerCase().includes(q.answer.toLowerCase()),
        `${q.id}: explanation must mention the answer`);
    }
    // only two mcq shift the answer's casing: wf-234 says 'Translate', wf-444 says 'confidence'
    const nonVerbatim = WORDFORM_QUESTIONS.filter(q => !q.explanation.includes(q.answer)).map(q => q.id);
    assert.deepEqual(nonVerbatim, ['wf-234', 'wf-444']);
  });

  test('vi is a non-empty trimmed string for all 600', () => {
    for (const q of WORDFORM_QUESTIONS) {
      assert.truthy(typeof q.vi === 'string' && q.vi.trim().length > 0, q.id);
      assert.equal(q.vi, q.vi.trim(), `${q.id}: vi has stray whitespace`);
    }
  });

  test('every vi note is genuinely Vietnamese (contains at least one diacritic mark)', () => {
    const viDiacritic = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
    for (const q of WORDFORM_QUESTIONS) {
      assert.truthy(viDiacritic.test(q.vi), `${q.id}: vi ${JSON.stringify(q.vi)} lacks Vietnamese diacritics`);
    }
  });

  test('vi uses the "BASE ... → derived" style everywhere except wf-444..wf-500', () => {
    const tailBlock = new Set(Array.from({ length: 57 }, (_, i) => `wf-${444 + i}`));
    for (const q of WORDFORM_QUESTIONS) {
      if (tailBlock.has(q.id)) continue;
      assert.truthy(q.vi.includes(q.base), `${q.id}: vi should name the BASE`);
      assert.truthy(q.vi.includes('→'), `${q.id}: vi should show the derivation arrow`);
    }
  });

  test('wf-444..wf-500 use the short Vietnamese gloss style (no BASE, no arrow)', () => {
    for (let n = 444; n <= 500; n++) {
      const q = byId(`wf-${n}`);
      assert.falsy(q.vi.includes(q.base), `${q.id}: gloss style has no BASE`);
      assert.falsy(q.vi.includes('→'), `${q.id}: gloss style has no arrow`);
    }
  });

  test('arrow-style vi names the derived answer verbatim, except stem-only wf-245/wf-380', () => {
    const tailBlock = new Set(Array.from({ length: 57 }, (_, i) => `wf-${444 + i}`));
    const arrowQs = WORDFORM_QUESTIONS.filter(q => !tailBlock.has(q.id));
    const missing = arrowQs.filter(q => !q.vi.includes(q.answer)).map(q => q.id);
    assert.deepEqual(missing, ['wf-245', 'wf-380']);
    // those two inflect the verb in the sentence but keep the dictionary stem in vi
    assert.equal(byId('wf-245').answer, 'enriched');
    assert.truthy(byId('wf-245').vi.includes('enrich'), 'wf-245 vi names the stem');
    assert.equal(byId('wf-380').answer, 'softens');
    assert.truthy(byId('wf-380').vi.includes('soften'), 'wf-380 vi names the stem');
  });
});

suite('gen: wordform text answers & accept lists', () => {
  test('text answers are all lowercase single words', () => {
    for (const q of TEXT) {
      assert.truthy(/^[a-z]+$/.test(q.answer), `${q.id}: answer ${JSON.stringify(q.answer)}`);
    }
  });

  test('text answer never equals the base lowercase — a transformation is always required', () => {
    for (const q of TEXT) {
      assert.truthy(q.answer !== q.base.toLowerCase(), q.id);
    }
  });

  test('no accept variant reintroduces the untransformed base either', () => {
    for (const q of TEXT) {
      assert.notContains(q.accept, q.base.toLowerCase(),
        `${q.id}: accepting the raw base would defeat the exercise`);
    }
  });

  test('accept entries are trimmed lowercase and unique, with answer first', () => {
    for (const q of TEXT) {
      assert.equal(new Set(q.accept).size, q.accept.length, `${q.id}: duplicate accepts`);
      assert.equal(q.accept[0], q.answer, `${q.id}: accept[0] is the model answer`);
      for (const a of q.accept) {
        assert.truthy(typeof a === 'string' && a === a.trim() && a === a.toLowerCase() && a.length > 0,
          `${q.id}: bad accept ${JSON.stringify(a)}`);
      }
    }
  });

  test('a second accepted spelling is only ever the British -ise form', () => {
    // Anything else in accept[] would be a different word, and marking a
    // different word right is how a typed question stops teaching.
    for (const q of TEXT) {
      assert.inRange(q.accept.length, 1, 2, `${q.id}: accept list size`);
      if (q.accept.length === 1) continue;
      assert.equal(q.accept[1], q.accept[0].replace('iz', 'is'), `${q.id}: -ise variant`);
    }
    assert.truthy(TEXT.some(q => q.accept.length === 2), 'the -ise allowance still exists somewhere');
  });

  test('an answer that drops the base onset is still tied back to its base', () => {
    // English rewrites some stems outright — EMPIRE → imperial, JUSTICE →
    // unjust, PRONOUNCE → pronunciation — so "must contain the first five
    // letters of the base" is not a rule the language keeps. What has to hold
    // is that the child is told where the word came from: the Vietnamese note
    // or the explanation names the base every time.
    const detached = TEXT.filter(q => q.answer.slice(0, 2) !== q.base.toLowerCase().slice(0, 2));
    assert.truthy(detached.length > 0, 'the bank should still teach prefixed and stem-changing forms');
    for (const q of detached) {
      const told = (q.vi + ' ' + q.explanation).toLowerCase().includes(q.base.toLowerCase());
      assert.truthy(told, `${q.id}: ${q.base} → ${q.answer} is never linked back to the base`);
    }
  });
});

suite('gen: wordform sampled questions', () => {
  // Ten multiple-choice questions spread evenly through whatever the mcq half
  // now contains — sampling by hard-coded id broke the moment 200 of those ids
  // stopped being multiple choice.
  for (let k = 0; k < 10; k++) {
    const q0 = MCQ[Math.floor(k * MCQ.length / 10)];
    const id = q0.id;
    test(`${id}: base shown in q, answer at correct index, wrong options ✗-explained`, () => {
      const q = byId(id);
      assert.equal(q.type, 'mcq');
      assert.truthy(q.q.includes(`(${q.base})`), 'q shows the (BASE) root');
      assert.equal(q.options[q.correct], q.answer, 'options[correct] === answer (strict)');
      assert.equal((q.explanation.match(/✗/g) || []).length, 3, 'three rejections');
      q.options.forEach((o, i) => {
        if (i === q.correct) return;
        assert.truthy(q.explanation.includes(`✗ ${o}`), `explanation rejects ${o}`);
      });
    });
  }

  // Fifteen typed questions spread across the whole text half, so the sample
  // reaches both the original wft- block and the converted wf- ones.
  for (let k = 0; k < 15; k++) {
    const id = TEXT[Math.floor(k * TEXT.length / 15)].id;
    test(`${id}: lowercase transformed answer, accept list and vi note`, () => {
      const q = byId(id);
      assert.equal(q.type, 'text');
      assert.truthy(/^[a-z]+$/.test(q.answer), 'answer is a lowercase word');
      assert.truthy(q.answer !== q.base.toLowerCase(), 'answer must differ from the base');
      assert.contains(q.accept, q.answer, 'accept includes the model answer');
      assert.falsy(q.explanation.includes('✗'), 'a typed question has no options to reject');
      // wf-444..500 use a short Vietnamese gloss instead of the BASE → form style.
      const tailBlock = Number((q.id.match(/^wf-(\d+)$/) || [])[1]) >= 444;
      if (!tailBlock) assert.truthy(q.vi.includes(q.base) && q.vi.includes('→'), 'vi shows BASE → derived form');
    });
  }
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
