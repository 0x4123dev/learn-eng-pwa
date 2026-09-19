# data/career-paths — Career Paths: Public Relations (Express Publishing) word bank

One file per book unit: `pr<book>-u<NN>.json`, book 1..3, NN 01..15.

```json
{
  "book": 1,
  "unit": 1,
  "title": "The Role of Public Relations",
  "words": [
    { "en": "advocate", "vi": "người ủng hộ, bênh vực", "emoji": "📣" }
  ]
}
```

- `title` — the unit title as printed in the book's Table of Contents.
- `words` — EXACTLY the Vocabulary column of that unit on the book's Scope and
  Sequence page, in that order. Spelling checked against the unit's reading page
  and the Glossary. Lowercase, except acronyms (RFP, ROI, PSA, CD, URL).
- `en` — letters, spaces, hyphens, apostrophes, digits; the engine blanks letters
  and grades ignoring case/spaces/hyphens.
- `vi` — the Vietnamese meaning IN THE PR SENSE the book uses (the Glossary
  definition decides): 2–10 words, 1–2 senses separated by a comma. Never the
  English word itself; never a whole sentence.
- `emoji` — 1 to 3 emoji that picture the word; no letters or digits (a pure
  digits/colon string renders as a number card, so do not use it here).
- No word appears twice within a book.

`node scripts/validate-word-data.js data/career-paths/pr1-u*.json` enforces this;
`node scripts/build-word-data.js` writes `js/word-data.js`.
