# Toán 4 · Đề ôn "Pre" — question-bank spec

Five question types, 100 questions each = 500. They mirror one real grade-4
paper (Phần 2, 7 điểm), and the difficulty must stay at that paper's level —
five-digit arithmetic, one-digit multipliers and divisors, whole-number
answers everywhere.

| t | dạng | parts | model item from the paper |
|---|---|---|---|
| 1 | Đặt tính rồi tính | 4 | `54036 + 18358` · `18376 − 3927` · `20312 × 4` · `36846 : 6` |
| 2 | Tìm X | 2 | `X : 5 = 10281` · `16800 : X = 8` |
| 3 | Tính giá trị biểu thức | 2 | `21506 + 6930 : 3` · `10291 × 5 − 8148` |
| 4 | Giải toán có lời văn | 1 | 6 kg chia đều vào 3 bao → 20 kg chia được mấy bao? |
| 5 | Đổi đơn vị đo | 2 | `770 g + 230 g = … kg` · `4 km − 400 m = … m` |

## How a type is produced

Each type is built by a **deterministic generator**, `scripts/gen-math4-t<N>.js`,
which writes `data/math4/math4-t<N>.json`. Arithmetic is COMPUTED, never typed
by hand — a hand-written bank of 500 sums ships wrong answers. The generator:

* takes no arguments, uses a fixed seed, and produces byte-identical output on
  every run (`node scripts/gen-math4-t<N>.js`);
* prints a one-line summary and exits 0;
* has no dependencies outside `node:fs` / `node:path`.

`scripts/build-math4-data.js` then re-checks every answer with its **own**
arithmetic evaluator before assembling `js/math4-data.js`. A generator that
lies about an answer fails the build.

## File shape

```json
{
  "t": 1,
  "key": "dattinh",
  "title": "Đặt tính rồi tính",
  "icon": "①",
  "questions": [ … exactly 100 … ]
}
```

## Question shape

```json
{
  "id": "g4t1-1",
  "t": 1,
  "topic": "Toán 4 · Đặt tính rồi tính",
  "q": "Đặt tính rồi tính:",
  "workNote": "Đặt tính ra bảng nháp rồi nhập kết quả của từng phép tính.",
  "keys": [],
  "answerParts": [
    { "label": "54036 + 18358", "answer": "72394", "expr": "54036+18358" },
    { "label": "18376 − 3927",  "answer": "14449", "expr": "18376-3927" },
    { "label": "20312 × 4",     "answer": "81248", "expr": "20312*4" },
    { "label": "36846 : 6",     "answer": "6141",  "expr": "36846/6" }
  ],
  "explanation": "🔑 Đặt tính thẳng cột, cộng trừ từ phải sang trái, nhớ sang cột bên trái.<br>54036 + 18358 = <b>72394</b><br>18376 − 3927 = <b>14449</b><br>20312 × 4 = <b>81248</b><br>36846 : 6 = <b>6141</b>"
}
```

* `id` — `g4t<N>-<i>`, i = 1..100, in order.
* `answer` — the digits the child types: **plain digits only**, no thousand
  separator, no unit, no sign. Every answer is a whole number ≥ 0.
* `expr` — the same computation as an ASCII arithmetic string over
  `0-9 + - * / ( )`. Build-time only; it is stripped from the shipped bank.
  It must evaluate (normal precedence) to exactly `Number(answer)`, and every
  intermediate division must be exact.
* `label` — what the child reads above the answer box. School notation:
  `×` for times, `:` for divide, `−` (U+2212) for minus. Rendered as **plain
  text**, so it may hold units ("Số bao", "… kg").
* `explanation` — one paragraph. Opens with `🔑 ` and the rule, then the worked
  steps with the real numbers. Only `<b>` and `<br>` are allowed as tags.

### Characters that must NOT appear in `q` or `explanation`

`q` and `explanation` go through the maths typesetter, which turns `a/b` into a
stacked fraction and `x^2` into an exponent.

* no `/` — write division as `:`
* no `^`, no `<`, no `>`
* no `tr. 12` (the typesetter treats it as a page citation)

`label` is escaped as plain text and is exempt, but keep it to the same
notation for consistency.

## Rules every type obeys

1. Exactly 100 questions. Ids sequential from 1.
2. No two questions in a file share the same tuple of `expr` values.
3. Every answer is a non-negative integer; subtraction never goes below zero;
   every division is exact (no remainders anywhere in the bank).
4. The numbers stay inside the band the type declares below. A grade-4 child
   meets five-digit numbers, one-digit multipliers and one-digit divisors.
5. Explanations show the arithmetic, not just the result — that paragraph is
   what the child reads after getting it wrong.

## Per-type bands

### t1 — Đặt tính rồi tính (4 parts, always in this order)
* `a + b` — both 5-digit (10000..89999). At least one column carries.
* `a − b` — a 5-digit, b 4- or 5-digit, a > b. At least one column borrows.
* `a × b` — a 5-digit, b one digit 2..9.
* `a : b` — b one digit 2..9, a 5-digit and divisible by b exactly.

### t2 — Tìm X (2 parts, a) and b), two DIFFERENT forms per question)
Forms: `X : a = b`, `a : X = b`, `X × a = b`, `X + a = b`, `X − a = b`,
`a − X = b`. Division forms carry the most weight (that is what the paper
asks). Multipliers/divisors are one digit 2..9; the other numbers are 4- or
5-digit; X is always a positive whole number.
The `label` is the equation as the child sees it — `"X : 5 = 10281"` — and the
answer is X.

### t3 — Tính giá trị biểu thức (2 parts, a) and b))
Two operations per expression, so the order of operations is the skill:
`a + b : c`, `a − b : c`, `a + b × c`, `a − b × c`, `a × b + c`, `a × b − c`,
`a : b + c`, `a : b − c`, `(a + b) × c`, `(a + b) : c`, `(a − b) × c`,
`(a − b) : c`. Use at least eight of these shapes across the 100. `a` is 4- or
5-digit, `c` is one digit 2..9, results non-negative, divisions exact.
The `label` is the expression itself; `q` says `"Tính giá trị biểu thức:"`.

### t4 — Giải toán có lời văn (1 part)
Dạng **rút về đơn vị** and **tìm tỉ số**, exactly the shape of the paper's
question 4: a known quantity split evenly, then asked about a different
quantity. Both directions ("mấy bao?", "bao nhiêu kg?"). Numbers small and
clean like the paper's (6 kg → 3 bao → 20 kg → 10 bao).
`q` is the whole story and ends in a question. `workNote` invites the nháp
board. The single answerPart's `label` names the unit — `"Số bao"`, `"Số kg"`.
**Use at least 20 different contexts** (goods, containers, people, vehicles,
workdays) with varied Vietnamese names, so the 100 do not read as one sentence
with the numbers swapped. The explanation shows both steps: the unit value,
then the answer.

### t5 — Đổi đơn vị đo (2 parts, a) and b))
Families: khối lượng (g, kg, yến, tạ, tấn), độ dài (mm, cm, dm, m, km), thời
gian (giây, phút, giờ, ngày). Shapes: a plain conversion (`5 tấn = … kg`) and
an arithmetic one like the paper's (`770 g + 230 g = … kg`,
`4 km − 400 m = … m`). Both parts of one question come from different families.
The result is always a whole number; the `label` is the line the child fills
in, ending in `= … <unit>`.
