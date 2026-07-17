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
  test('mcq ids run wf-1..wf-500 sequentially in file order', () => {
    MCQ.forEach((q, i) => assert.equal(q.id, `wf-${i + 1}`, `mcq at index ${i}`));
  });

  test('text ids run wft-1..wft-100 sequentially in file order', () => {
    TEXT.forEach((q, i) => assert.equal(q.id, `wft-${i + 1}`, `text at index ${i}`));
  });

  test('all 500 mcq precede all 100 text entries in the array', () => {
    assert.equal(WORDFORM_QUESTIONS.map(q => q.type).lastIndexOf('mcq'), 499);
    assert.equal(WORDFORM_QUESTIONS.findIndex(q => q.type === 'text'), 500);
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

  test('cat distribution: noun 159 / adj 156 / adv 149 / verb 136 overall', () => {
    const count = (list, cat) => list.filter(q => q.cat === cat).length;
    const dist = list => ({
      noun: count(list, 'noun'), adj: count(list, 'adj'),
      adv: count(list, 'adv'), verb: count(list, 'verb')
    });
    assert.deepEqual(dist(WORDFORM_QUESTIONS), { noun: 159, adj: 156, adv: 149, verb: 136 });
    assert.deepEqual(dist(MCQ), { noun: 126, adj: 134, adv: 125, verb: 115 });
    assert.deepEqual(dist(TEXT), { noun: 33, adj: 22, adv: 24, verb: 21 });
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

  test('563 questions use the inline "___ (BASE)" layout', () => {
    const inline = WORDFORM_QUESTIONS.filter(q => q.q.includes(`___ (${q.base})`));
    assert.equal(inline.length, 563);
    // all 100 text questions are inline-layout
    assert.equal(TEXT.filter(q => q.q.includes(`___ (${q.base})`)).length, 100);
  });

  test('exactly 37 mcq (wf-444..467, wf-488..500) use the trailing "(BASE)" layout', () => {
    const tail = MCQ.filter(q => !q.q.includes(`___ (${q.base})`));
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

  test('base word lowercased appears as an option in exactly 486 of 500 mcq (the classic trap)', () => {
    const withBase = MCQ.filter(q => q.options.includes(q.base.toLowerCase()));
    assert.equal(withBase.length, 486);
  });

  test('exactly 11 mcq legitimately keep the base form as the answer (at the correct index)', () => {
    const ids = MCQ.filter(q => q.answer === q.base.toLowerCase()).map(q => q.id);
    assert.deepEqual(ids, BASE_IS_ANSWER_IDS);
    for (const id of BASE_IS_ANSWER_IDS) {
      const q = byId(id);
      assert.equal(q.options[q.correct], q.base.toLowerCase(), id);
    }
  });

  test('in the other 475 mcq offering the base form, it is a wrong option (distractor)', () => {
    const distractors = MCQ.filter(q =>
      q.options.includes(q.base.toLowerCase()) && q.answer !== q.base.toLowerCase());
    assert.equal(distractors.length, 475);
    for (const q of distractors) {
      assert.truthy(q.options.indexOf(q.base.toLowerCase()) !== q.correct,
        `${q.id}: base distractor must not sit at the correct index`);
    }
  });

  test('correct answer position is near-uniform across A/B/C/D', () => {
    const dist = { 0: 0, 1: 0, 2: 0, 3: 0 };
    MCQ.forEach(q => { dist[q.correct]++; });
    assert.deepEqual(dist, { 0: 124, 1: 125, 2: 125, 3: 126 });
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

  test('94 text questions accept one spelling, 6 accept two', () => {
    assert.equal(TEXT.filter(q => q.accept.length === 1).length, 94);
    assert.equal(TEXT.filter(q => q.accept.length === 2).length, 6);
  });

  test('the 6 double-accept questions allow the British -ise spelling', () => {
    const two = TEXT.filter(q => q.accept.length === 2);
    assert.deepEqual(two.map(q => q.id), ['wft-19', 'wft-29', 'wft-56', 'wft-65', 'wft-81', 'wft-86']);
    for (const q of two) {
      assert.equal(q.accept[1], q.accept[0].replace('iz', 'is'), `${q.id}: -ise variant`);
    }
  });

  test('exactly 5 text answers derive via a negative/causative prefix; the other 95 keep the base onset', () => {
    const prefixed = TEXT.filter(q => q.answer.slice(0, 2) !== q.base.toLowerCase().slice(0, 2));
    assert.deepEqual(prefixed.map(q => q.id), ['wft-9', 'wft-24', 'wft-37', 'wft-50', 'wft-74']);
    for (const q of prefixed) {
      assert.truthy(/^(en|un|in|dis)/.test(q.answer), `${q.id}: ${q.answer} should start with a prefix`);
      assert.truthy(q.answer.includes(q.base.toLowerCase().slice(0, 5)),
        `${q.id}: ${q.answer} should still contain the base stem`);
    }
  });
});

suite('gen: wordform sampled questions', () => {
  // every 50th mcq — deterministic 10-question sample across the whole bank
  for (let n = 50; n <= 500; n += 50) {
    const id = `wf-${n}`;
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

  // every 20th text question — deterministic 5-question sample
  for (let n = 20; n <= 100; n += 20) {
    const id = `wft-${n}`;
    test(`${id}: lowercase transformed answer, accept list and BASE→ vi note`, () => {
      const q = byId(id);
      assert.equal(q.type, 'text');
      assert.truthy(/^[a-z]+$/.test(q.answer), 'answer is a lowercase word');
      assert.truthy(q.answer !== q.base.toLowerCase(), 'answer must differ from the base');
      assert.contains(q.accept, q.answer, 'accept includes the model answer');
      assert.truthy(q.vi.includes(q.base) && q.vi.includes('→'), 'vi shows BASE → derived form');
    });
  }
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
