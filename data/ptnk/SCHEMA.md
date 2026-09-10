# data/ptnk — PTNK grade-10 entrance English papers

One JSON file per paper. `scripts/build-ptnk-data.js` concatenates them into
`js/ptnk-data.js` (`PTNK_EXAMS`), which the PTNK tab lazy-loads. Never edit
`js/ptnk-data.js` by hand — edit the JSON here and rebuild.

The question shape is EXACTLY the one `js/exam.js` already renders and grades
(see `js/exam-data.js`), so nothing new is drawn. Three types only:

| type   | fields                                        | graded how                     |
|--------|-----------------------------------------------|--------------------------------|
| `mcq`  | `options` (4 strings), `correct` (0-based idx) | index match                    |
| `tf`   | `options: ["True","False"]`, `correct`          | index match                    |
| `text` | `accept` (array), `answer` (the primary one)    | normalised string ∈ accept     |

## File

```json
{
  "id": "ptnk-2022-chuyen",
  "year": 2022,
  "track": "chuyen",
  "title": "PTNK 2022 · Tiếng Anh Chuyên",
  "subtitle": "Đề thi tuyển sinh lớp 10 · Trường Phổ thông Năng khiếu · 2022-2023",
  "durationMin": 120,
  "keySource": "official",
  "source": "2022 Thi vào 10 Đề thi Anh chuyên Phổ thông Năng khiếu.pdf",
  "questions": [ ... ]
}
```

- `id`: `ptnk-<year>-<kc|chuyen>`. Fixed list below; do not invent.
- `track`: `kc` (không chuyên / chung) or `chuyen`.
- `durationMin`: as printed on the paper (KC papers are 60, chuyên 120).
- `keySource`: `official` when a đáp án PDF was available, `solved` when the
  answers were worked out and cross-checked (2024, 2025, 2026). The tab shows
  `solved` papers with an "Đáp án tham khảo" badge.

## Question

```json
{
  "n": 12,
  "part": "Part 1. Reading",
  "section": "Reading",
  "passage": "…full passage text…",
  "q": "Which of the following best explains the meaning of the word <b>compulsive</b>?",
  "options": ["caused by a secret wish", "resulting from an irresistible urge", "relating to a psychological pain", "driven by an emotional loss"],
  "correct": 1,
  "explanation": "The passage defines it directly: \"repeatedly spend money on items, regardless of need … compulsive buying\" — an urge that cannot be resisted."
}
```

- `n`: 1..N, **globally sequential across the whole paper**. The printed
  papers restart numbering in every part; the app does not.
- `part`: the heading as printed (`Part 1. Reading`, `PHẦN I. TRẮC NGHIỆM`…).
- `section`: one of `Phonetics`, `Stress`, `Language use`, `Error correction`,
  `Reading`, `Cloze`, `Open cloze`, `Word form`, `Collocation`, `Rewrite`,
  `Sentence transformation`, `Word bank`. Pick the closest; do not invent.
- `passage`: on EVERY question that belongs to a passage or cloze text, the
  full text, paragraphs joined with `<br><br>`. Cloze blanks written as
  `(1)____`. Repeat the passage on each of its questions — the engine renders
  one question at a time and has no other way to show it.
- `q`: the question stem. Keep the paper's wording. Underlined pronunciation
  parts as `<u>…</u>`, bold as `<b>…</b>`. For error-correction items put the
  lettered segments inline: `It was (A) reported that people (B) had been …`.
- `options`: strip the `A.`/`B.` letters — the app adds them.
- `text` questions: `accept` holds every form a marker would accept
  (`["had her own locker at school", "had her own locker"]`); `answer` is the
  first. Grading is case/space/punctuation-insensitive, apostrophes optional.
  For word-formation the stem carries the root: `Increased ___ rates helped
  to eradicate the deadly disease. (VACCINE)`.
- `explanation`: one or two sentences — the rule, or the clue in the passage.
  Plain prose, `<b>` allowed, no `undefined`/`null`, never empty.

- `omitted` (optional): a list of short strings naming parts of the printed
  paper that are NOT in this file and why — e.g. `"không sao chép được: Part 1
  Passage 3 (8 câu)"`. The PTNK card shows it, so the paper is never quietly
  shorter than the one a child sat. Set from `meta.json` by the assembler.

## Writing a paper in parts (`scripts/assemble-ptnk.js`)

A chuyên paper is ~100 kB of JSON, most of it verbatim reading passages, and
producing that as one output was refused by an output filter on four of the
six chuyên papers. So a paper may be written as
`data/ptnk/parts/<id>/meta.json` + `part-01.json`, `part-02.json`, … — one
passage or one section per file — and assembled with
`node scripts/assemble-ptnk.js <id>`, which renumbers `n` globally and runs
the validator. `data/ptnk/parts/` is gitignored; the assembled file is the
source of truth. A part the filter still refuses is listed in `meta.omitted`.

## What to leave out

- Essay / free writing (a paragraph or letter from a prompt). Not gradeable.
  Omit; do not include as text.
- Answer sheets (phiếu trả lời), cover pages, blank pages.
- Listening sections, if any.

## Papers (fixed ids → source files in ~/Downloads/de-thi-ptnk)

| id                | đề                                                                       | đáp án                                                        | keySource |
|-------------------|--------------------------------------------------------------------------|---------------------------------------------------------------|-----------|
| ptnk-2021-kc      | 2021 Thi vào 10 Đề thi Anh chung Phổ thông Năng khiếu.pdf               | 2021 Thi vào 10 Đề thi Anh chung Phổ thông Năng khiếu - Đáp án.pdf | official |
| ptnk-2021-chuyen  | 2021 Thi vào 10 Đề thi Anh chuyên Phổ thông Năng khiếu kèm đáp án.pdf   | (inside the same file)                                        | official  |
| ptnk-2022-kc      | 2022 Thi vào 10 Đề thi Anh chung Phổ thông Năng khiếu.pdf               | 2022 Thi vào 10 Đề thi Anh chung phổ thông năng khiếu - Đáp án.pdf | official |
| ptnk-2022-chuyen  | 2022 Thi vào 10 Đề thi Anh chuyên Phổ thông Năng khiếu.pdf              | 2022 Thi vào 10 Đề thi Anh chuyên phổ thông năng khiếu - Đáp án.pdf | official |
| ptnk-2023-chuyen  | De-thi-Tieng-Anh-chuyen-2023-2024 THPTNK.pdf                             | Dap-an-Anh-chuyen-2023-2024 THPTNK.pdf                        | official  |
| ptnk-2024-kc      | PTNK 2024 - Anh KC - Đề thi.pdf                                          | —                                                             | solved    |
| ptnk-2024-chuyen  | PTNK 2024 - Tiếng Anh Chuyên - Đề thi & Phiếu trả lời tự luận.pdf       | —                                                             | solved    |
| ptnk-2025-kc      | 2025 - Tiếng Anh (Không Chuyên) - Đề thi.pdf                             | —                                                             | solved    |
| ptnk-2025-chuyen  | 2025 - Tiếng Anh (Chuyên) - Đề thi.pdf                                   | —                                                             | solved    |
| ptnk-2026-kc      | 2026 - TS10 - Tiếng Anh KC (Đề thi).pdf                                  | —                                                             | solved    |
| ptnk-2026-chuyen  | 2026 - TS10 - Tiếng Anh chuyên (Đề thi).pdf                              | —                                                             | solved    |
