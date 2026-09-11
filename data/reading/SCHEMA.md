# data/reading, data/cloze, data/errors — PTNK-style practice banks

Three practice menus built for the PTNK grade-10 entrance paper's formats,
where no existing menu trained them. All content is ORIGINAL — written for
this app, never copied from a published text, a past paper or a textbook.

Every file is written by one authoring agent and validated with
`node scripts/validate-practice.js <reading|cloze|errors> <file>`.
`scripts/build-practice-data.js` concatenates each directory into
`js/reading-data.js`, `js/cloze-data.js`, `js/errors-data.js`.

The question shape is the exam engine's (see `js/exam-data.js`):
`mcq` (options + correct index), `tf` (options exactly ["True","False"]),
`text` (accept list + answer). Every question has a 1–2 sentence
`explanation`. Levels: `kc` (Không chuyên, ~grade 9 / B1) and `ch` (Chuyên,
~B2–C1).

## reading — `data/reading/reading-NN.json`

```json
{ "passages": [ {
  "id": "rd-kc-03-1",              // rd-<kc|ch>-<NN>-<seq>
  "level": "kc",
  "title": "Why Cities Are Planting More Trees",
  "topic": "environment",
  "words": 320,
  "passage": "…paragraphs joined with <br><br>…",
  "questions": [ …5 to 8… ]
} ] }
```

Question `kind` (a field alongside `type`) must be one of:
- `main-idea`, `detail`, `inference`, `vocab` (word-in-context), `reference`
  (what "it"/"this" refers to), `purpose` — all `mcq` with 4 options;
- `tfng` — `mcq` with options exactly `["True","False","Not Given"]`;
- `section` — the passage is split into lettered sections `<b>A.</b> …`,
  the question is "Which section contains …", `text` with `accept: ["C"]`;
- `gap` — the passage has `[1]`…`[5]` gaps and ends with a list of
  paragraphs/sentences `<b>A.</b> … <b>G.</b> …` (2 extras), each question
  is "Which fits gap [3]?", `text` with `accept: ["E"]`.

Each passage mixes at least three kinds. A kc passage is 250–350 words and
takes one MCQ style throughout (main-idea/detail/inference/vocab + tfng); a ch
passage is 400–550 words and MUST use one of `section` or `gap` in addition.

## cloze — `data/cloze/cloze-NN.json`

```json
{ "passages": [ {
  "id": "cl-ch-07-2",              // cl-<kc|ch>-<NN>-<seq>
  "level": "ch",
  "mode": "open",                  // "mcq" = 4 options per blank; "open" = type ONE word
  "title": "The Last Lighthouse Keeper",
  "topic": "history",
  "passage": "… (1)____ … (2)____ … up to (10)____ …",
  "questions": [ …exactly 10, n 1..10 in blank order… ]
} ] }
```

Every blank tests something a marker can defend: a collocation, a
preposition, a linking word, a determiner, a phrasal verb, a tense marker,
a relative pronoun. `mode: "open"` questions are `text` with EVERY defensible
single word in `accept` (e.g. `["which","that"]`) and `answer` the first.
`mode: "mcq"` questions have 4 options of the same part of speech; wrong
options must be near misses, never absurd. Each question's `q` is
`"Blank (n): …"` and repeats nothing from the passage.

## errors — `data/errors/errors-NN.json`

```json
{ "items": [ {
  "id": "er-kc-02-14",             // er-<kc|ch>-<NN>-<seq>
  "level": "kc",
  "focus": "tense",                // tense | agreement | article | preposition | word-form | pronoun | comparison | conditional | reported | relative | word-order | collocation | quantifier | conjunction | other
  "q": "It was (A) reported that people (B) have been queuing in front of the (C) newly opened store since (D) yesterday.",
  "options": ["reported", "have been queuing", "newly opened", "yesterday"],
  "correct": 1,
  "correction": "had been queuing",
  "explanation": "…"
} ] }
```

Exactly one segment is wrong. The four `options` are the four underlined
segments in order, verbatim. `correction` is the fixed segment. The error must
be a real, teachable mistake — a native reader would mark it — never a matter
of style. Across a file, spread `focus` over at least 8 values and put the
error in every position (A–D) roughly equally.

## Shared rules

- `explanation`: the rule or the clue, one or two sentences, `<b>` allowed,
  never empty, never "undefined".
- No two items in a file share a passage or a sentence. Topics assigned to an
  author must be respected so the bank stays varied.
- British or American spelling consistently within one passage.
