# data/grammar-vocab — Grammar & Vocabulary practice bank

The PTNK grade-10 entrance paper's largest section is "Language use": one
sentence, one blank (sometimes two), four options. It is 23% of a Không
chuyên paper and 31% of a Chuyên paper, and until this bank nothing in the
app trained it as a whole — Grammar drilled rules by unit, Phrases and
Collocation each drilled one slice. This bank drills the section as the
paper sets it: mixed focuses, exam-style distractors, timed rounds.

All content is ORIGINAL — written for this app, never copied from a past
paper, a textbook or a published test. Every file is written by one
authoring agent, re-solved blind by a verifier, and validated with
`node scripts/validate-grammar-vocab.js data/grammar-vocab/gv-NN.json`.
`scripts/build-grammar-vocab-data.js` concatenates the directory into
`js/grammar-vocab-data.js` (`GRAMMAR_VOCAB_ITEMS`).

## File — `data/grammar-vocab/gv-NN.json`

```json
{ "file": "07", "level": "kc",
  "items": [ {
    "id": "gv-kc-07-1",              // gv-<kc|ch>-<NN>-<seq>, seq 1..25 in order
    "level": "kc",
    "focus": "tense",                // see the list below
    "q": "By the time the guests arrived, Mai ______ the whole house.",
    "options": ["has cleaned", "had cleaned", "was cleaning", "cleaned"],
    "correct": 1,
    "answer": "had cleaned",
    "vi": "Trước lúc khách tới, Mai đã dọn xong cả nhà.",
    "explanation": "An action finished <b>before</b> another past action (the guests arrived) takes the past perfect: <b>had cleaned</b>."
  } ] }
```

- `file`: the two digits in the filename. `level` on the file and on every
  item: `kc` (Không chuyên, ~B1, grade-9 syllabus) or `ch` (Chuyên, ~B2–C1).
  A file holds ONE level, exactly 25 items.
- `q`: one sentence (two short ones are fine for a dialogue), the blank as
  exactly `______` (six underscores). A `double-blank` item has TWO blanks
  and options written `"grip / into"` (slash, spaces) — each option fills both.
  `<b>` allowed. Keep the paper's register: everyday and school life for
  kc; news, science, work and society for ch.
- `options`: exactly 4, all the same part of speech, no duplicates, letters
  stripped (the app adds A–D). Wrong options must be NEAR misses a
  grade-9/10 learner would actually pick — the same tense family, the same
  preposition set, the same idiom pattern — never absurd.
- `correct`: 0–3; `answer` equals `options[correct]`. Spread the correct
  slot across A–D over the file (no slot more than 9 of 25) — the app never
  shuffles.
- `vi`: the whole sentence in natural Vietnamese, with the blank filled.
- `explanation`: 1–2 sentences — the rule, or why the answer collocates and
  the others do not. `<b>` allowed. Never empty, never "undefined".

## focus — one of

tense, modal, conditional, passive, reported, relative, article-quantifier,
preposition, phrasal-verb, idiom, collocation, word-choice, linking,
comparison, gerund-infinitive, inversion, subjunctive, participle, agreement,
pronoun, question-tag, double-blank, other

Each file follows the focus quota it was given (the real papers' mix), and no
two items in a file test the same answer word or share a sentence.
