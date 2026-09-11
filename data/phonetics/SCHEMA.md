# data/phonetics — Phonetics & Stress practice bank and lessons

The PTNK Không chuyên paper opens with 2–3 "odd one out" pronunciation
items and 2 word-stress items (8–10% of the paper). Nothing in the app
trained them. This bank drills both formats exactly as the paper sets them,
and `lessons/` teaches the rules a grade-9 child needs to solve them.

All content is ORIGINAL. Every bank file is written by one agent and
re-solved blind by a verifier; every lesson is written by one agent and
checked by a phonetics reviewer.

Validate: `node scripts/validate-phonetics.js data/phonetics/ph-NN.json`
and `node scripts/validate-phonetics.js --lesson data/phonetics/lessons/lesson-NN.json`.
Build: `node scripts/build-phonetics-data.js` → `js/phonetics-data.js`
(`PHONETICS_ITEMS`) and `js/phonetics-lessons.js` (`PHONETICS_LESSONS`).

## Bank file — `data/phonetics/ph-NN.json`

```json
{ "file": "03", "level": "kc",
  "items": [
    { "id": "ph-kc-03-1", "level": "kc", "kind": "sound", "rule": "ed",
      "options": ["look<u>ed</u>", "laugh<u>ed</u>", "declin<u>ed</u>", "hop<u>ed</u>"],
      "words": ["looked", "laughed", "declined", "hoped"],
      "ipa": ["/lʊkt/", "/lɑːft/", "/dɪˈklaɪnd/", "/həʊpt/"],
      "correct": 2,
      "explanation": "<b>declined</b> /dɪˈklaɪnd/ — đuôi -ed đọc /d/ vì đứng sau âm hữu thanh /n/. Ba từ còn lại đọc /t/ vì đứng sau âm vô thanh: looked /lʊkt/, laughed /lɑːft/, hoped /həʊpt/." },
    { "id": "ph-kc-03-11", "level": "kc", "kind": "stress", "rule": "2syl",
      "options": ["helpful", "global", "distract", "monkey"],
      "words": ["helpful", "global", "distract", "monkey"],
      "ipa": ["/ˈhelpfʊl/", "/ˈɡləʊbəl/", "/dɪˈstrækt/", "/ˈmʌŋki/"],
      "syllables": [2, 2, 2, 2], "stress": [1, 1, 2, 1],
      "correct": 2,
      "explanation": "<b>distract</b> /dɪˈSTRÆKT/ — động từ 2 âm tiết thường nhấn âm 2. Ba từ còn lại nhấn âm 1: HELP-ful, GLO-bal, MON-key." }
  ] }
```

- 20 items per file: items 1–10 are `kind: "sound"`, 11–20 `kind: "stress"`.
  Ids `ph-<kc|ch>-<NN>-<seq>`. One level per file: `kc` (grade-9 core
  vocabulary, the rules every textbook teaches) or `ch` (grade-10/11
  vocabulary, loanwords, 4-syllable words, the rarer rules).
- `sound`: each option is a real word with EXACTLY ONE underlined part
  `<u>…</u>` (the letters being compared — the same letters in all four).
  `words` are the options with the tags stripped, in order. `ipa` is the
  full IPA of each word (British, slashes, stress mark ˈ). The three
  non-key words share the sound; the key word's underlined part differs.
- `stress`: four plain words (no tags) with the SAME number of syllables;
  `syllables` the count, `stress` the stressed syllable (1-based). The three
  non-key words share a stress position; the key differs. `ipa` as above.
- `rule` — sound: ed | es | a | e | i | o | u | oo-ou-ow | ea-ee-ie | c-g |
  ch-sh-th-gh | s-z-sh | silent | h | prefix-ex | other.
  stress: 2syl | suffix-neutral | suffix-shift | suffix-final | 3syl |
  prefix | compound | 4syl | other.
- `correct`: 0–3, spread across A–D over the file (max 8 of 20).
- `explanation`: Vietnamese, for a child: name the key word with its IPA
  and the rule, then list the other three with their IPA. `<b>` allowed.
- Within a file no word is the key twice and no two items share an option set.

## Lesson — `data/phonetics/lessons/lesson-NN.json`

```json
{ "key": "ed", "title": "Đuôi -ed đọc /t/, /d/ hay /ɪd/?", "icon": "🔚",
  "content": "<p>…</p><h4>📌 Quy tắc</h4><table>…</table><h4>…</h4>…" }
```

Vietnamese, for a grade-9 child. Only `p h4 ul li table tr td th b br i`
(no `ol`, no attributes needed). At least 3 `<h4>` sections, 1500–6000
characters, IPA in slashes throughout, a "⚠️ Bẫy thường gặp" section and a
"🎯 Cách làm bài" section. `key` matches a bank `rule` where one exists.
