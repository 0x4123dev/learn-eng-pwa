# data/wordform, data/rewrite — Chuyên tier for two existing menus

`base.json` in each directory is the menu's original bank (600 Word Form
items, 200 Rewrite items), extracted once from the hand-written JS. Every
original item is Không chuyên. Files `ch-add-NN.json` hold CHUYÊN items, one
author each. `scripts/build-tier-data.js` rebuilds `js/wordform-data.js` and
`js/rewrite-data.js` from base + additions; the JS files are generated now.

Validate: `node scripts/validate-tier.js wordform data/wordform/ch-add-03.json`
          `node scripts/validate-tier.js rewrite  data/rewrite/ch-add-03.json`

A child sees Chuyên items only when an admin has switched Chuyên on for
them; by default a round draws Không chuyên only. So a Chuyên item may be as
hard as the real PTNK Chuyên paper (CEFR B2–C1) — that is its whole point.

## Word Form — `data/wordform/ch-add-NN.json`

```json
{ "level": "ch", "file": "03", "questions": [ …20 items… ] }
```

Ids `wf-ch-<NN>-<1…20>`. Same shape as the original bank plus `level`:

```json
{ "id": "wf-ch-03-7", "level": "ch", "type": "text", "cat": "noun", "base": "ADMIT",
  "q": "The judge ruled on the ___ (ADMIT) of the recording as evidence.",
  "answer": "admissibility", "accept": ["admissibility"],
  "vi": "ADMIT (thừa nhận) → admissibility — tính có thể chấp nhận được (danh từ)",
  "explanation": "…" }
```

- `type`: `text` (typed, ~12 of 20) or `mcq` (4 options, all real forms of the
  same root or plausible mis-derivations, `answer` = `options[correct]`,
  ~8 of 20; spread `correct` over A–D).
- `cat`: `noun` | `adj` | `adv` | `verb` — the class of the ANSWER.
- `q`: exactly one `___` and the root in brackets `(BASE)` right after it.
- `answer`: ONE word (hyphens allowed), never the root itself. For `text`,
  `accept` holds every form a marker would take (British/American spelling:
  `["prioritise","prioritize"]`).
- Chuyên means: nominalisation (`rely → reliance`, `deny → denial`), negative
  prefixes chosen by rule (`il-/ir-/im-/in-/un-/dis-/non-`), double
  derivation (`response → irresponsibly`), the `-ity/-ness/-ance/-ence` family,
  adjective-vs-adverb after linking verbs, compound roots (`YOUTH → younger`,
  `STRONG → strengthening`, `PRIORITY → prioritise`), words a B2–C1 reader
  meets in press and science. NOT `happy → happiness`.
- `vi`: one line — root (meaning) → answer — meaning (word class).
- `explanation`: two or three sentences in Vietnamese: the slot (what the
  sentence needs and why), the derivation (which affix, any spelling change),
  and the trap (the near-miss a student writes). Plain text; `<b>` allowed.

## Rewrite — `data/rewrite/ch-add-NN.json` (key word transformation)

```json
{ "level": "ch", "file": "03", "questions": [ …20 items… ] }
```

Ids `rw-ch-<NN>-<1…20>`. The Chuyên paper's Part 5 format: rewrite the
sentence using the KEY WORD unchanged, filling a gap of 3–8 words.

```json
{ "id": "rw-ch-03-4", "level": "ch", "cat": "kwt", "catLabel": "Key word transformation",
  "key": "INFORMED",
  "orig": "She felt greatly relieved when she received the news of her promotion.",
  "stem": "Much to",
  "tail": "her promotion.",
  "answer": "her relief, she was informed of",
  "accept": ["her relief, she was informed of", "her relief she was informed of", "her relief, she was informed about"],
  "vi": "much to one's relief + be informed of — nhẹ cả người khi được báo tin",
  "explanation": "…" }
```

- `key`: ONE word in capitals; it appears in `answer` and every `accept`
  entry **unchanged** (not inflected).
- `stem` + `answer` + `tail` reads as one complete, natural sentence with the
  same meaning as `orig`. `tail` may be `""`.
- Every `accept` entry is 3–8 words; `answer` is the first.
- Chuyên means: idioms and fixed collocations (`carry more weight than`,
  `bewildered by the sheer scale of`, `no sooner had … than`, `it was not
  until … that`, `far from being`, `on the verge of`, `take … for granted`,
  `in spite of the fact that`), inversion, cleft sentences, participle and
  relative clauses, `would rather / had better`, mixed conditionals — the
  Cambridge FCE/CAE key-word transformation register.
- `explanation`: Vietnamese, two or three sentences: the target structure or
  idiom, how the key word forces it, and the common wrong attempt.

## Both

- No item may repeat a sentence or a root+answer pair already in `base.json`
  (read it first) or in the same file. No `undefined`/`null`.
