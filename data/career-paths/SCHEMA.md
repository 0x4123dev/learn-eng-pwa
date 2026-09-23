# data/career-paths — Career Paths: Public Relations (Express Publishing) word bank

One file per book unit: `pr<book>-u<NN>.json`.

- **Book 1** — the book's first EIGHT units, `pr1-u01`..`pr1-u08`, about
  THIRTY words each: the unit's printed Vocabulary list first, then the rest
  of the new words on that unit's two pages (reading text, exercises,
  listening, speaking and writing prompts). One practice unit per book unit
  (re-cut 2026-09-23 — the app used to carry all fifteen units at ten words).
- **Books 2 and 3** — all fifteen units, `pr<b>-u01`..`pr<b>-u15`, carrying
  EXACTLY the printed Vocabulary column. The app merges them into SEVEN
  practice units per book (1-2, 3-4, …, 11-12, 13-15) at build time.

A word is taught once in the whole app: `scripts/validate-word-data.js`
refuses one already used in the same book, and `tests/integration.test.js`
caps how many may recur across books.

```json
{
  "book": 1,
  "unit": 1,
  "title": "The Role of Public Relations",
  "words": [
    { "en": "advocate", "vi": "người ủng hộ, bênh vực", "emoji": "📣",
      "ex": "An advocate speaks up for people who cannot speak for themselves.",
      "exVi": "Người bênh vực lên tiếng thay cho những người không thể tự lên tiếng." }
  ]
}
```

- `title` — the unit title as printed in the book's Table of Contents.
- `words` — for Books 2 and 3, EXACTLY the Vocabulary column of that unit on
  the book's Scope and Sequence page, in that order. For Book 1, that column
  first, then the other new words of the unit's two pages, to about thirty. Spelling checked against the unit's reading page
  and the Glossary. Lowercase, except acronyms (RFP, ROI, PSA, CD, URL).
- `en` — letters, spaces, hyphens, apostrophes, digits; the engine blanks letters
  and grades ignoring case/spaces/hyphens.
- `vi` — the Vietnamese meaning IN THE PR SENSE the book uses (the Glossary
  definition decides): 2–10 words, 1–2 senses separated by a comma. Never the
  English word itself; never a whole sentence.
- `emoji` — 1 to 3 emoji that picture the word; no letters or digits (a pure
  digits/colon string renders as a number card, so do not use it here).
- `ex` — one natural English sentence (6–18 words) that USES the word in the
  book's sense and shows what it means, so a learner can fill the blank from the
  sentence alone. The word appears in it exactly once, in exactly the `en`
  spelling (same inflection — the engine blanks that span; "advocate" does not
  match "advocates"), surrounded by non-letters. Never starts with the word
  when a determiner reads naturally ("The advocate…" is fine — the first token
  before the blank is a hint, not the answer).
- `exVi` — the Vietnamese translation of `ex`, shown after answering. A full
  sentence, ends with a full stop.
- No word appears twice within a book.

`node scripts/validate-word-data.js data/career-paths/pr1-u*.json` enforces this;
`node scripts/build-word-data.js` writes `js/word-data.js`.
