// math.js — Toán 7 formula practice. Two sub-tabs, like the English tabs:
// Practice (10 multiple-choice questions, "which formula is correct?") and
// Lessons (the chapter's formulas written out to revise from).
//
// The poster this is built from is a formula sheet, so the whole tab is about
// RECOGNISING the right formula rather than computing with it: every question
// offers four formulas and exactly one is the real one. The wrong three are
// the mistakes a Grade 7 student actually makes — added exponents where they
// should be multiplied, 90° where it should be 180°, √(a²) = a instead of |a|.
//
// Data: js/math-data.js (MATH_QUESTIONS, MATH_CHAPTERS) and js/math-lessons.js
// (MATH_LESSONS). No audio anywhere in this tab — nothing here is pronounced.

const MATH_QUIZ_SIZE = 10;
const MATH_HISTORY_CAP = 300;
// Pet-shop coins per correct answer. The English tabs pay 5; maths pays 2.
const MATH_COINS_PER_CORRECT = 2;
// Toán 4 has two ten-question modes. Mix keeps the original write-the-answer
// paper and its existing 100-xu perfect reward; Pre is the shorter, tap-only
// placement round and pays 50 xu for a clean 10/10.
const MATH4_MIX_PERFECT_BONUS = 100;
const MATH4_PRE_PERFECT_BONUS = 50;
const MATH_TIER_LABELS = { all: 'Tất cả', perfect: '⭐ Hoàn hảo', great: '✅ Tốt', ok: '👍 Khá', weak: '📝 Cần ôn' };

// Both Toán 4 modes draw the same balanced paper from the 500-question bank:
// five dạng, two questions per dạng, kept in the order of the real paper.
const MATH4_QUIZ_SIZE = 10;
const MATH4_PER_TYPE = 2;
const MATH4_MIX_SET = 'mix';
const MATH4_PRE_SET = 'pre';

let _mathQuiz = null;          // { chapter, questions:[], idx, answers:[] }
let _mathSubTab = 'practice';  // chỉ có nghĩa bên trong Học kì 1: 'practice' | 'exams' | 'lessons'
let _mathView = 'home';        // 'home' | 'toan7' | 'toan4' | 'cuuchuong' | 'hk1' | 'hk2' | 'history' | 'wars' | 'fight'
// Lịch sử làm bài mở được từ cả Toán 7 lẫn Toán 4, nên nút ‹ phải quay về
// đúng chỗ bé vừa đứng — không thì bé bấm ‹ ở Toán 4 lại rơi sang Toán 7.
let _mathHistoryBack = 'toan7';
let _mathHistoryFilter = 'all';
let _mathHistoryType = 'all';  // 'all' | 'practice' | 'exam'

function mathEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Unicode superscripts (x⁵, xᵐ⁺ⁿ) are drawn as tiny glyphs by the font, and
// nothing but enlarging the whole line can make them bigger — on a phone the
// exponent was simply unreadable. Turning them into real <sup> lets CSS size
// them, which is the only way the child can actually see "x⁻⁵" is negative.
const MATH_SUPERSCRIPTS = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5',
  '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '−', '⁼': '=', '⁽': '(', '⁾': ')',
  'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᵏ': 'k',
  'ᵐ': 'm', 'ⁿ': 'n', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't',
  'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z'
};
const MATH_SUP_RE = new RegExp('[' + Object.keys(MATH_SUPERSCRIPTS).join('') + ']+', 'g');

// The same argument as MATH_SUPERSCRIPTS, one row down: y₁ and x₂ are drawn by
// the font as glyphs so small a child cannot tell ₁ from ₂ on a phone, and no
// amount of enlarging the line helps. Turning them into real <sub> lets CSS
// size them like every other index in the app. 204 subscripts in the banks.
const MATH_SUBSCRIPTS = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5',
  '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '−', '₌': '=', '₍': '(', '₎': ')',
  'ₐ': 'a', 'ₑ': 'e', 'ₕ': 'h', 'ᵢ': 'i', 'ⱼ': 'j', 'ₖ': 'k', 'ₗ': 'l',
  'ₘ': 'm', 'ₙ': 'n', 'ₒ': 'o', 'ₚ': 'p', 'ᵣ': 'r', 'ₛ': 's', 'ₜ': 't',
  'ᵤ': 'u', 'ᵥ': 'v', 'ₓ': 'x'
};

// "√" on its own is only the hook. A căn bậc hai is the hook PLUS the bar
// (vinculum) drawn over what is under it — without it, "√36" reads as a tick
// mark standing next to a number, and "√(a²) = |a|" gives no clue where the
// radicand stops. The bar is a border-top on the radicand.
//
// Stops at "<" so it can never run across a tag and eat the markup: the same
// function is used on explanation HTML.
const MATH_RADICAND_CHAR = /[0-9A-Za-zÀ-ỹ⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ᵃᵇᶜᵈᵉᵏᵐⁿᵖʳˢᵗᵘᵛʷˣʸᶻ.,]/;

function mathSuper(s) {
  return s.replace(MATH_SUP_RE, run =>
    '<sup>' + Array.from(run).map(ch => MATH_SUPERSCRIPTS[ch] || ch).join('') + '</sup>');
}

function _mathBalancedEnd(s, start, open, close) {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close && --depth === 0) return i + 1;
  }
  return start;
}

// Return one printable maths atom: a number/letter, (...), or |...|, followed
// by any Unicode exponent. Keeping the reader small and deterministic avoids
// turning ordinary Vietnamese punctuation into formula markup.
function _mathAtomEnd(s, start) {
  let i = start;
  if (s[i] === '−' || s[i] === '-') i++;
  if (s[i] === '(') {
    const end = _mathBalancedEnd(s, i, '(', ')');
    if (end === i) return start;
    i = end;
  } else if (s[i] === '|') {
    const end = s.indexOf('|', i + 1);
    if (end < 0) return start;
    i = end + 1;
  } else {
    const rest = s.slice(i);
    const number = /^\d+(?:[.,]\d+)?/.exec(rest);
    const letters = /^[A-Za-zÀ-ỹ]+/.exec(rest);
    const token = number || letters;
    if (!token) return start;
    i += token[0].length;
  }
  while (i < s.length && MATH_SUPERSCRIPTS[s[i]]) i++;
  return i;
}

function _mathFraction(num, den, escapeText) {
  return '<span class="math-frac">'
    + '<span class="math-num">' + _mathTypeset(num, escapeText) + '</span>'
    + '<span class="math-frac-slash">/</span>'
    + '<span class="math-den">' + _mathTypeset(den, escapeText) + '</span>'
    + '</span>';
}

// A tiny purpose-built typesetter for the notation used in Toán 7. It draws
// real stacked fractions, grouped mixed numbers, scalable roots and exponents
// while leaving the stored question/answer strings unchanged for grading.
function _mathTypeset(value, escapeText) {
  const s = String(value == null ? '' : value);
  let out = '';
  for (let i = 0; i < s.length;) {
    // Old imported exams used prose/caret notation such as
    // "5 mũ (x + 4)" and "5^(x+4)". Both are mathematically correct data,
    // but neither should be printed to a child. Convert them at the shared
    // renderer boundary so every question, option, answer and explanation
    // receives the same real raised exponent without rewriting the source.
    // Two notations, both stored in the banks and neither fit to show a child.
    // The parenthesised one covers either spelling — "5 mũ (x + 4)", "5^(x+4)".
    // The bare one is caret-ONLY: "mũ" is also an ordinary Vietnamese noun
    // ("số mũ" = exponent) and occurs as prose 343 times, where there is no
    // base to raise; a caret never means anything else. 884 exponents in the
    // banks are written bare — "x^2", "ax^m", "(−3)^2" — and until now every
    // one of them printed the caret raw.
    //
    // A letter base is ONE letter on purpose: "ax^m" is a·xᵐ, not (ax)ᵐ, so a
    // greedy letter run would raise the coefficient along with the variable.
    // The base's parentheses may themselves contain a pair — "(2 · (−3))^2" is
    // real bank content — so the group allows one level of nesting.
    const POWER_BASE = '([−-]?(?:\\((?:[^()]|\\([^()]*\\))*\\)|\\|[^|]+\\||\\d+(?:[.,]\\d+)?|[A-Za-z]))';
    const power = new RegExp('^' + POWER_BASE + '\\s*(?:mũ|\\^)\\s*\\(([^()]*)\\)', 'i')
      .exec(s.slice(i))
      || new RegExp('^' + POWER_BASE + '\\^(\\d+|[A-Za-z])')
        .exec(s.slice(i));
    if (power) {
      out += '<span class="math-power">' + _mathTypeset(power[1], escapeText)
        + '<sup>' + _mathTypeset(power[2], escapeText) + '</sup></span>';
      i += power[0].length;
      continue;
    }

    // Mixed number: "2 2/5" must read as one quantity, not three loose digits.
    const mixed = /^([−-]?\d+)\s+(\d+)\/(\d+)/.exec(s.slice(i));
    if (mixed && (i === 0 || !/[\dA-Za-zÀ-ỹ]/.test(s[i - 1]))) {
      out += '<span class="math-mixed"><span class="math-whole">'
        + (escapeText ? mathEsc(mixed[1]) : mixed[1]) + '</span>'
        + _mathFraction(mixed[2], mixed[3], escapeText) + '</span>';
      i += mixed[0].length;
      continue;
    }

    if (s[i] === '√') {
      const end = _mathAtomEnd(s, i + 1);
      if (end > i + 1) {
        out += '<span class="math-root"><span class="math-root-symbol">√</span>'
          + '<span class="math-radicand">' + _mathTypeset(s.slice(i + 1, end), escapeText)
          + '</span></span>';
        i = end;
        continue;
      }
    }

    const atomEnd = _mathAtomEnd(s, i);
    if (atomEnd > i && s[atomEnd] === '/') {
      const denEnd = _mathAtomEnd(s, atomEnd + 1);
      if (denEnd > atomEnd + 1) {
        out += _mathFraction(s.slice(i, atomEnd), s.slice(atomEnd + 1, denEnd), escapeText);
        i = denEnd;
        continue;
      }
    }

    if (MATH_SUPERSCRIPTS[s[i]]) {
      let end = i + 1;
      while (end < s.length && MATH_SUPERSCRIPTS[s[end]]) end++;
      out += '<sup>' + Array.from(s.slice(i, end))
        .map(ch => MATH_SUPERSCRIPTS[ch] || ch).join('') + '</sup>';
      i = end;
      continue;
    }

    if (MATH_SUBSCRIPTS[s[i]]) {
      let end = i + 1;
      while (end < s.length && MATH_SUBSCRIPTS[s[end]]) end++;
      out += '<sub>' + Array.from(s.slice(i, end))
        .map(ch => MATH_SUBSCRIPTS[ch] || ch).join('') + '</sub>';
      i = end;
      continue;
    }

    out += escapeText ? mathEsc(s[i]) : s[i];
    i++;
  }
  return out;
}

// A page citation is one indivisible token to a reader — "(SGK tr. 5)" — but
// to the line-breaker it is three words with two break opportunities, so at
// 320px it could leave "5)." alone on its own line, looking exactly like the
// split card this panel was just rescued from. Keep it whole.
//
// Two shapes, both real: the whole parenthetical when it IS the citation, and
// a bare "tr. 5" when the reference runs on into the sentence ("SGK tr. 28:
// chẳng hạn…", 243 of those). The 24-character cap is what stops the first
// rule swallowing an ordinary parenthetical that happens to end in a number,
// and excluding < > keeps it from ever reaching across a tag.
const MATH_CITE_PAREN_RE = /\((?:[^()<>]{0,24}?)tr\.\s*\d+\)/g;
const MATH_CITE_BARE_RE = /\btr\.\s*\d+/g;

function mathCite(html) {
  return String(html == null ? '' : html)
    .replace(MATH_CITE_PAREN_RE, cite => '<span class="math-cite">' + cite + '</span>')
    .replace(MATH_CITE_BARE_RE, (cite, at, whole) =>
      /<span class="math-cite">[^<]*$/.test(whole.slice(0, at))
        ? cite
        : '<span class="math-cite">' + cite + '</span>');
}

function mathFormula(s) {
  return mathCite(_mathTypeset(s, true));
}

// Explanations carry a deliberately tiny trusted tag set. Typeset only the
// text between those tags so <b>/<br> survive and generated maths spans never
// get parsed a second time.
function mathRich(html) {
  return mathCite(String(html == null ? '' : html)
    .split(/(<\/?(?:b|br|i|strong|u)\s*\/?\s*>)/i)
    .map(part => /^<\/?(?:b|br|i|strong|u)\s*\/?\s*>$/i.test(part)
      ? part : _mathTypeset(part, false))
    .join(''));
}

// A stored explanation is one paragraph that already names its own parts:
// "Lý thuyết: …" and then "Áp dụng: …". Those two labels are the only place it
// may legitimately be broken.
//
// This used to split on ". ", "; " and some ", ", which shredded one
// explanation into a dozen numbered boxes — and broke inside "(SGK tr. 5)",
// where box 4 read "(SGK tr" and box 5 read "5)". Sentence punctuation is not
// structure. Everything else in the paragraph — "Kết luận", "Thử lại",
// "Bước 3 — …" — stays INSIDE its section, because it is the same thought
// continuing, and a reader wants it in one place rather than spread over five
// numbered cards.
// A section label is the full shape a bank writes — bold, and with the colon
// welded to the label: "<b>Áp dụng:</b>". Nothing looser will do, because
// "áp dụng" is also an ordinary verb. Matching the bare words case-insensitively
// promoted prose to a heading 57 times: "<b>Bước 2 — Áp dụng định lí.</b>" broke
// into a line reading "Bước 2 —" and a fresh ÁP DỤNG card opening "định lí.",
// and "🔑 Áp dụng quy tắc chuyển vế: …" — one plain sentence, no label anywhere —
// grew a heading its author never wrote. That is the same sin as the deleted
// "Quy tắc cần dùng", only quieter. The colon is what tells a label from a verb.
const MATH_SECTION_RE = /(?:<br\s*\/?>\s*)?<(?:b|strong)>\s*(Lý thuyết(?:\s*\d)?|Áp dụng)\s*(?::\s*<\/(?:b|strong)>|<\/(?:b|strong)>\s*:)\s*/g;

// Inside a section, a wall of prose is still a wall. A child reads a worked
// example one step at a time, so each step gets its own LINE — a <br> inside
// the one box, not a box of its own, which is what shredded these panels
// before.
//
// Breaks are inserted at:
//   • "Bước N —" markers, so every step of a solution starts a line;
//   • the connectives that mark a deduction — "suy ra", "nên", "do đó",
//     "từ đó", "vậy", "ta được" — which is where one step ends;
//   • a full stop that really ends a sentence.
//
// "Really" is the whole difficulty. A period is NOT a sentence end when it
// sits inside brackets — "(SGK tr. 6)" — or after "tr", which appears 2,815
// times as a page citation and 243 of those outside any bracket ("Định lí 1
// tr. 60, cạnh lớn hơn…"). Breaking there is how the old code produced a card
// reading "(SGK tr" and another reading "5)".
const MATH_STEP_RE = /^(?:<(?:b|strong)>\s*)?Bước\s*\d/i;
const MATH_DEDUCE_RE = /^,\s+(?:suy ra|nên|do đó|từ đó|vậy|ta được)\b/i;

function _mathIsUpper(ch) {
  return !!ch && ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

function mathLineBreaks(html) {
  const text = String(html == null ? '' : html);
  let out = '';
  let depth = 0;
  // Whether the last thing WRITTEN was a break. It has to be a flag rather than
  // a look at the tail of `out`, because a step marker is bold: the <br> goes in
  // before "<b>", then "Bước" is reached with `out` ending in "<b>", a regex on
  // the tail sees no break, and a second one goes in — "<br><b><br>Bước 2".
  // That put a blank line under 460 headings and doubled 3,036 breaks.
  let broke = true;
  for (let i = 0; i < text.length;) {
    if (text[i] === '<') {
      const close = text.indexOf('>', i);
      const tag = close < 0 ? text.slice(i) : text.slice(i, close + 1);
      if (MATH_STEP_RE.test(text.slice(i)) && !broke) { out += '<br>'; broke = true; }
      if (/^<br\s*\/?>$/i.test(tag)) {
        if (!broke) { out += tag; broke = true; }
      } else {
        out += tag;
      }
      i += tag.length;
      continue;
    }
    if (MATH_STEP_RE.test(text.slice(i)) && !broke) { out += '<br>'; broke = true; }
    const deduce = MATH_DEDUCE_RE.exec(text.slice(i));
    if (deduce && depth === 0) {
      out += ',<br>' + deduce[0].slice(1).replace(/^\s+/, '');
      broke = false;
      i += deduce[0].length;
      continue;
    }
    const ch = text[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (broke && /\s/.test(ch)) { i++; continue; }   // no leading space on a line
    out += ch;
    broke = false;
    i++;
    if (ch !== '.' || depth > 0) continue;
    if (/(?:^|[\s(>])tr$/i.test(out.slice(0, -1))) continue;   // a page citation, not a stop
    const rest = text.slice(i);
    const gap = /^\s+/.exec(rest);
    if (!gap) continue;
    const next = rest.slice(gap[0].length);
    if (!next) continue;
    const first = next[0];
    // Not before an opening bracket: "…bằng nhau. (SGK tr. 5)" is a citation
    // belonging to the sentence it follows, not a line of its own.
    if (!(_mathIsUpper(first) || /[0-9]/.test(first) || next.startsWith('<b'))) continue;
    out += '<br>';
    broke = true;
    i += gap[0].length;
  }
  return out.replace(/(?:<br\s*\/?>\s*)+$/i, '');
}

function mathSolutionSteps(source) {
  // 🔑 marks the start of EACH reasoning row in the banks, so once the rows are
  // rejoined there is one in the middle of the text too — strip them all, not
  // just the leading one, or 1,359 explanations print a key emoji mid-paragraph.
  const text = String(source == null ? '' : source).replace(/🔑\s*/gu, '').trim();
  if (!text) return [];

  const marks = [];
  MATH_SECTION_RE.lastIndex = 0;
  let m;
  while ((m = MATH_SECTION_RE.exec(text))) {
    marks.push({ title: m[1].trim(), start: m.index, bodyStart: m.index + m[0].length });
  }
  // No label at all — the older banks store a single 🔑 sentence. One box.
  if (!marks.length) return [{ title: '', body: mathLineBreaks(text) }];

  const out = [];
  const preamble = text.slice(0, marks[0].start).trim();
  if (preamble) out.push({ title: '', body: mathLineBreaks(preamble) });
  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
    const body = text.slice(mark.bodyStart, end).trim();
    if (body) out.push({ title: mark.title, body: mathLineBreaks(body) });
  });
  return out;
}

// Turn every stored explanation into the same worked-solution layout. The
// source banks already separate distractor notes with <br>; the first part,
// however, often contains several calculations in one dense paragraph. This
// presentation splits that reasoning into numbered, vertically spaced steps
// while keeping every original detail and every wrong-answer explanation.
function mathExplanationHTML(source, q) {
  const rows = String(source == null ? '' : source)
    .split(/<br\s*\/?\s*>/i).map(row => row.trim()).filter(Boolean);
  // The <br>s inside the reasoning are line breaks, not section boundaries:
  // "Bước 1 — …<br>Bước 2 — …<br>Bước 3 — Kết luận…" is ONE worked example and
  // belongs in one card. Rejoin every non-✗ row and let the labels decide the
  // sections, or a three-step calculation arrives as three cards — one of which
  // was just the words "Bước 2 —".
  const reasoning = [];
  const mistakes = [];

  rows.forEach(row => {
    if (/^\s*✗/u.test(row)) mistakes.push(row.replace(/^\s*✗\s*/u, ''));
    else reasoning.push(row);
  });
  const solution = mathSolutionSteps(reasoning.join('<br>'));

  // No generated "Quy tắc cần dùng" and no generated "Kết luận" any more.
  // The rule was picked by keyword-matching the topic and stem, and the words
  // it matched on overlap: "dãy tỉ số bằng NHAU" hit the triangle-congruence
  // rule, "TỈ LỆ thức" hit the percentages rule. A confidently-worded rule that
  // belongs to another chapter is worse than no rule — the child is being
  // taught the wrong thing first, above the correct explanation. What the bank
  // stored was always right; only what this function invented was wrong.
  const worked = solution.length ? `
    <section class="math-worked" aria-label="Lời giải">
      <div class="math-explain-title">Cách giải</div>
      <ul class="math-solution-steps">
        ${solution.map(part => `<li>${part.title
          ? `<div class="math-step-title">${mathEsc(part.title)}</div>` : ''
        }<div>${mathRich(part.body)}</div></li>`).join('')}
      </ul>
    </section>` : '';
  const errors = mistakes.length ? `
    <section class="math-mistakes" aria-label="Giải thích các phương án sai">
      <div class="math-explain-title">Vì sao các đáp án khác sai?</div>
      <ul>${mistakes.map(note => `<li>${mathRich(note)}</li>`).join('')}</ul>
    </section>` : '';
  return `<div class="math-explanation-layout">${worked}${errors}</div>`;
}

// ---- typed answers ----
// Some questions ask the child to COMPUTE, not just recognise — and there the
// phone keyboard is the wrong tool twice over: it cannot type √, an exponent
// or a fraction bar, and it slides up over the very question being asked.
//
// So the tab draws its own pad and never focuses an input. The answer is a
// plain string in JS, painted through mathFormula() — the same renderer that
// draws the question — so "2⁷" in the answer box looks like "2⁷" in the sum.
// Nothing on screen is focusable, so iOS has no reason to raise a keyboard.
const MATH_TYPED_PER_ROUND = 3;
const MATH_KEYPAD_ROWS = [
  ['7', '8', '9', '⌫'],
  ['4', '5', '6', '/'],
  ['1', '2', '3', '−'],
  [',', '0', '(', ')']
];
// Plain character → superscript, for the ^ key. Inverted from the table the
// renderer already uses rather than written out again: anything mathSuper can
// draw, the keypad can type, and the two cannot drift apart. Letters matter as
// much as digits here — Toán 7 is full of xⁿ and aᵐ⁺ⁿ.
const MATH_TO_SUP = {};
for (const sup in MATH_SUPERSCRIPTS) MATH_TO_SUP[MATH_SUPERSCRIPTS[sup]] = sup;

let _mathTyped = { raw: '', sup: false, part: 0, values: [] };

function mathTypedReset() { _mathTyped = { raw: '', sup: false, part: 0, values: [] }; }
function mathTypedRaw() { return _mathTyped.raw; }
function mathTypedSup() { return _mathTyped.sup; }
function mathHasAnswerParts(q) { return !!q && Array.isArray(q.answerParts) && q.answerParts.length > 0; }
function mathIsTyped(q) { return !!q && (q.type === 'calc' || mathHasAnswerParts(q)); }
function mathIsWritten(q) { return !!q && q.type === 'written' && !mathHasAnswerParts(q); }

// Toán 4 types into REAL inputs, so an iPad raises its own number pad and the
// child can put the caret back in the middle of a number to fix one digit —
// which the in-app keypad cannot do, because its box is a div with a drawn
// caret that only ever appends and backspaces.
//
// Deliberately NOT every question with answer boxes. Toán 7's source exams
// share this renderer, and they need glyphs no phone keyboard has (xⁿ, −, ×);
// their boxes are also labelled steps of ONE worked problem, answered in
// order. Toán 4's four boxes are four independent sums, filled in any order.
function math4FreeEntry(q) { return !!q && q.grade === 4 && mathHasAnswerParts(q); }

// Every one of the 500 Toán 4 answers is a plain whole number of at most six
// digits, so anything else arriving from a hardware keyboard or a paste is a
// typo the child cannot see is wrong until the paper is marked.
const MATH4_ANSWER_MAX = 12;
function math4Clean(value) {
  return String(value == null ? '' : value).replace(/[^0-9]/g, '').slice(0, MATH4_ANSWER_MAX);
}

function math4El(i) {
  return (typeof document !== 'undefined' && document.getElementById)
    ? document.getElementById('mathPart' + i) : null;
}

// What is IN the box, or null when there is no box of this question's on
// screen to read.
//
// The `data-q` check is what makes that "of this question's". renderMathQuestion
// builds its HTML string while the PREVIOUS question's inputs are still in the
// document, so without the stamp the next question would start with the last
// one's answers and a live check button.
function math4DomValue(q, i) {
  const el = math4El(i);
  if (!el || typeof el.value !== 'string' || !el.getAttribute) return null;
  if (String(el.getAttribute('data-q') || '') !== String(q && q.id || '')) return null;
  return math4Clean(el.value);
}

// The box on screen is the answer — not a shadow copy of it.
//
// It used to be the copy, and the copy could fall behind: a value reaching a
// field without firing `input` (iOS restoring a form after discarding the tab
// is the everyday way that happens) left every box visibly full while the
// stored copy stayed empty, so the check button never came back on and the
// child could not hand in a finished question. Reading the fields removes the
// possibility of the two disagreeing rather than patching one cause of it.
// The stored copy is still kept, and still answers when there is no field to
// read: a marked question, or Node.
function math4Values(q) {
  return q.answerParts.map((part, i) => {
    const dom = math4DomValue(q, i);
    return dom !== null ? dom : math4Clean(_mathTyped.values[i]);
  });
}

function math4AllFilled(q) {
  if (!math4FreeEntry(q)) return false;
  // Iterate answerParts, never _mathTyped.values: filling box 4 first leaves
  // values sparse, and Array#every SKIPS holes — it would call this complete.
  return math4Values(q).every(v => v !== '');
}

// Put the check button back in step with the boxes. Called on every keystroke
// and again whenever the child touches a box, so even if something did get
// past the two above, the next tap on any box heals it.
function mathPartSync() {
  const st = _mathQuiz;
  const q = st && st.questions[st.idx];
  if (!st || st.answers[st.idx] !== null || !math4FreeEntry(q)) return false;
  const ok = math4AllFilled(q);
  const btn = (typeof document !== 'undefined' && document.getElementById)
    ? document.getElementById('mathSubmitBtn') : null;
  if (btn) btn.disabled = !ok;
  return ok;
}

// "^" is a mode, not a character: press it and the digits that follow land as
// real superscripts. That keeps backspace honest — one tap removes one glyph
// the child can see — and stores the same characters the rest of the tab
// already knows how to draw.
function mathKeyPress(k) {
  const st = _mathTyped;
  if (k === '⌫') {
    st.raw = st.raw.slice(0, -1);
    // Leaving the exponent behind would make the next digit a superscript of
    // nothing, which the child cannot see coming.
    if (st.sup && !MATH_SUPERSCRIPTS[st.raw.slice(-1)]) st.sup = false;
    return;
  }
  if (k === '^') { st.sup = !st.sup; return; }
  if (st.sup && MATH_TO_SUP[k]) { st.raw += MATH_TO_SUP[k]; return; }
  if (st.sup) st.sup = false;      // a symbol the exponent cannot hold
  st.raw += k;
}

// Compare on meaning, not on keystrokes: school writes 0,75 where JS writes
// 0.75, and a maths key prints U+2212 where a keyboard prints a hyphen.
function mathNormalize(s) {
  let t = String(s == null ? '' : s);
  t = t.replace(MATH_SUP_RE, run =>
    '^' + Array.from(run).map(ch => MATH_SUPERSCRIPTS[ch] || ch).join(''));
  return t.replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[−–—]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .toLowerCase();
}

// Deliberately NOT clever about fractions: -6/8 is wrong for -3/4 because rút
// gọn is the skill being tested. Whatever else counts is listed in accept[] by
// the author, who knows what the question is for.
function mathGrade(q, val) {
  const got = mathNormalize(val);
  if (!got) return false;
  const want = [q.gradeAnswer == null ? q.answer : q.gradeAnswer]
    .concat(q.accept || []).map(mathNormalize);
  if (want.indexOf(got) !== -1) return true;
  const n = Number(got);
  if (got !== '' && !isNaN(n)) {
    return want.some(w => w !== '' && !isNaN(Number(w)) && Number(w) === n);
  }
  return false;
}

function mathIsCorrect(q, ans) {
  if (mathHasAnswerParts(q)) {
    return Array.isArray(ans) && ans.length === q.answerParts.length
      && q.answerParts.every((part, i) => mathGrade(part, ans[i]));
  }
  if (mathIsWritten(q)) return ans === true;
  // A supplied source paper contains one multiple-choice item whose computed
  // answer is absent from all four options. Let the child inspect the source
  // note without losing a point for an error in the original paper.
  if (q && q.sourceIssue) return ans !== null;
  return mathIsTyped(q) ? mathGrade(q, ans) : ans === q.correct;
}

function mathTypedBoxHTML(value, state) {
  const raw = value == null ? _mathTyped.raw : value;
  return `<div class="math-answer-box ${state || ''}">` +
    (raw ? `<span class="math-formula">${mathFormula(raw)}</span>`
         : `<span class="math-answer-placeholder">Đáp án của con…</span>`) +
    (state ? '' : `<span class="math-caret"></span>`) + `</div>`;
}

// One box, as a real text input. type="text" rather than type="number": a
// number input hides what it considers invalid behind an empty .value, spins
// on a stray scroll, and on iOS gives a keyboard with e and − on it.
// inputmode="numeric" is what actually raises the number pad.
function math4InputHTML(q, i) {
  const v = _mathTyped.values[i];
  return `<input class="math-answer-input" id="mathPart${i}" type="text" ` +
    `inputmode="numeric" pattern="[0-9]*" autocomplete="off" autocorrect="off" ` +
    `autocapitalize="off" spellcheck="false" maxlength="${MATH4_ANSWER_MAX}" ` +
    `placeholder="Đáp án của con…" aria-label="Đáp án phép tính ${i + 1}" ` +
    `data-q="${mathEsc(q && q.id || '')}" value="${mathEsc(v == null ? '' : v)}" ` +
    `oninput="mathPartInput(${i}, this.value)" onchange="mathPartInput(${i}, this.value)" ` +
    `onfocus="mathPartSync()">`;
}

function mathAnswerPartsHTML(q, answer) {
  const finished = Array.isArray(answer);
  const values = finished ? answer : _mathTyped.values;
  const free = !finished && math4FreeEntry(q);
  const active = Math.min(_mathTyped.part, q.answerParts.length - 1);
  return `<div class="math-answer-parts${free ? ' free' : ''}">` + q.answerParts.map((part, i) => {
    const hasValue = (values[i] || '') !== '';
    // Free entry has no "current" box — the child chooses one by tapping it,
    // and :focus-within draws the ring, so no state has to be kept in step.
    const isActive = !free && !finished && i === active;
    const state = finished ? (mathGrade(part, values[i]) ? 'correct' : 'wrong') : (hasValue ? 'filled' : '');
    const box = free
      ? math4InputHTML(q, i)
      : (isActive
        ? `<div id="mathAnswerSlot">${mathTypedBoxHTML()}</div>`
        : mathTypedBoxHTML(hasValue ? values[i] : '', state || 'pending'));
    const correction = finished && !mathGrade(part, values[i])
      ? `<div class="math-part-correct">Đáp án: <span class="math-formula">${mathFormula(part.answer)}</span></div>` : '';
    // "Sửa" exists only because the keypad can type into one box at a time.
    // A real input is edited by tapping it.
    const edit = !free && !finished && hasValue
      ? `<button type="button" class="math-part-edit" onclick="mathEditAnswerPart(${i})">Sửa</button>` : '';
    return `<div class="math-answer-part ${isActive ? 'active' : ''}">
      <div class="math-part-label"><span>${i + 1}</span>${mathEsc(part.label)}</div>
      ${box}${edit}${correction}
    </div>`;
  }).join('') + `</div>`;
}

// Typing must NOT re-render. renderMathQuestion() replaces the whole screen,
// which drops focus and drops the iPad keyboard in the middle of a number —
// so only the stored value and the submit button change here, exactly as
// mathKey() does for the in-app keypad.
function mathPartInput(index, value) {
  const st = _mathQuiz;
  const q = st && st.questions[st.idx];
  if (!st || st.answers[st.idx] !== null || !math4FreeEntry(q)) return '';
  if (!Number.isInteger(index) || index < 0 || index >= q.answerParts.length) return '';
  const clean = math4Clean(value);
  _mathTyped.values[index] = clean;
  _mathTyped.part = index;
  const el = (typeof document !== 'undefined' && document.getElementById)
    ? document.getElementById('mathPart' + index) : null;
  // Write back ONLY when something was dropped. Assigning .value moves the
  // caret to the end, and keeping the caret where the child put it is the
  // entire reason this is an input.
  if (el && el.value !== clean) {
    const after = String(el.value == null ? '' : el.value).length -
      (el.selectionEnd == null ? 0 : el.selectionEnd);
    el.value = clean;
    if (el.setSelectionRange) {
      const at = Math.max(0, Math.min(clean.length, clean.length - after));
      try { el.setSelectionRange(at, at); } catch (e) {}
    }
  }
  mathPartSync();
  return clean;
}

// The right answer, for a review card. A multi-box question has no single
// `answer` — Toán 4 keeps one per box — and printing `q.answer` there rendered
// an empty green tick next to every missed question, which is the one place a
// child most needs to see the number they were reaching for.
function mathAnswerHTML(q) {
  if (mathHasAnswerParts(q)) {
    return q.answerParts.map(p =>
      `<span class="math-answer-line">${mathEsc(p.label)} = <b class="math-formula">${mathFormula(p.answer)}</b></span>`
    ).join('');
  }
  return `<b class="math-formula">${mathFormula(q.answer)}</b>`;
}

function mathEditAnswerPart(index) {
  const st = _mathQuiz;
  const q = st && st.questions[st.idx];
  if (!st || st.answers[st.idx] !== null || !mathHasAnswerParts(q)) return;
  if (!Number.isInteger(index) || index < 0 || index >= _mathTyped.values.length) return;
  _mathTyped.part = index;
  _mathTyped.raw = _mathTyped.values[index] || '';
  _mathTyped.values = _mathTyped.values.slice(0, index);
  _mathTyped.sup = false;
  renderMathQuestion();
}

function mathKeypadHTML(q) {
  const extra = (q && q.keys || []).map(k =>
    `<button class="math-key math-key-sym${k === '^' ? ' math-key-pow' : ''}${k === '^' && _mathTyped.sup ? ' active' : ''}" onclick="mathKey('${k}')">` +
    (k === '^' ? 'x<sup>n</sup>' : mathEsc(k)) + `</button>`).join('');
  const rows = MATH_KEYPAD_ROWS.map(row =>
    `<div class="math-key-row">` + row.map(k =>
      `<button class="math-key${k === '⌫' ? ' math-key-del' : ''}" onclick="mathKey('${k}')">${mathEsc(k)}</button>`
    ).join('') + `</div>`).join('');
  return `<div class="math-keypad">` +
    (extra ? `<div class="math-key-row math-key-context">${extra}</div>` : '') +
    rows + `</div>`;
}

// Repaint just the answer box and the ^ key rather than the whole screen: a
// full re-render on every keystroke throws away the button's :active flash,
// which is the only feedback a child gets that the tap landed.
function mathKey(k) {
  mathKeyPress(k);
  const slot = document.getElementById('mathAnswerSlot');
  if (slot) slot.innerHTML = mathTypedBoxHTML();
  const pow = document.querySelector('.math-key-pow');
  if (pow) pow.className = 'math-key math-key-sym math-key-pow' + (_mathTyped.sup ? ' active' : '');
  const btn = document.getElementById('mathSubmitBtn');
  if (btn) btn.disabled = !_mathTyped.raw;
}

function mathTier(pct) { return pct === 100 ? 'perfect' : pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'weak'; }
function mathTierEmoji(pct) { return pct === 100 ? '⭐' : pct >= 80 ? '✅' : pct >= 60 ? '👍' : '📝'; }

// Học kì 1 dùng chương 1..5, học kì 2 dùng chương 6..10, nên một câu hỏi tự
// nói nó thuộc học kì nào. Các hàm dưới đây trả về ngân hàng của học kì ĐANG
// mở; mathBankAll() dùng cho việc tra id (lịch sử, drill câu sai) vì một câu
// có thể được tra khi đang đứng ở học kì khác.
function mathSemester() { return _mathView === 'hk2' ? 2 : 1; }
function _mathHk1Bank() { return (typeof MATH_QUESTIONS !== 'undefined') ? MATH_QUESTIONS : []; }
function _mathHk2Bank() { return (typeof MATH_QUESTIONS_HK2 !== 'undefined') ? MATH_QUESTIONS_HK2 : []; }
function mathBank() {
  return mathSemester() === 2 ? _mathHk2Bank() : _mathHk1Bank();
}
function mathBankAll() { return _mathHk1Bank().concat(_mathHk2Bank()); }
// Gói "Ôn tập chương 2&3 · Lũy thừa" (js/math-luythua.js) — nằm ngoài ngân
// hàng 5 chương để các pin đếm câu theo chương không phải đổi theo.
function mathLtBank() {
  return (typeof MATH_LT_QUESTIONS !== 'undefined') ? MATH_LT_QUESTIONS : [];
}
// ---- Toán 4 ----
// Ngân hàng riêng, KHÔNG trộn vào mathBankAll(): đây là môn khác, và mọi thứ
// đếm theo chương của Toán 7 (lịch sử, "dạng toán cần ôn", drill câu sai) sẽ
// sai ngay nếu 500 câu lớp 4 lọt vào đó.
function math4Bank() {
  return (typeof MATH4_QUESTIONS !== 'undefined' && Array.isArray(MATH4_QUESTIONS)) ? MATH4_QUESTIONS : [];
}
function math4Types() {
  return (typeof MATH4_TYPES !== 'undefined' && Array.isArray(MATH4_TYPES)) ? MATH4_TYPES : [];
}
function math4Ready() { return math4Bank().length > 0 && math4Types().length > 0; }

function mathChapters() {
  if (mathSemester() === 2) return (typeof MATH_CHAPTERS_HK2 !== 'undefined') ? MATH_CHAPTERS_HK2 : [];
  return (typeof MATH_CHAPTERS !== 'undefined') ? MATH_CHAPTERS : [];
}
function mathLessons() {
  if (mathSemester() === 2) return (typeof MATH_LESSONS_HK2 !== 'undefined') ? MATH_LESSONS_HK2 : [];
  return (typeof MATH_LESSONS !== 'undefined') ? MATH_LESSONS : [];
}
function mathById(id) {
  // An empty id must never match anything. Before the exam banks were stamped
  // (_mathStampExamIds), an exam question had no `id` at all, so a history
  // entry holding `undefined` — or `null`, which is what `undefined` becomes
  // after a round trip through localStorage — matched `q.id === undefined` on
  // the FIRST question of the FIRST exam. "Dạng toán cần ôn" then showed a
  // child a question they had never seen, wearing their own miss count.
  // The stamping is the fix; this line is the net under it.
  if (id === undefined || id === null || id === '') return null;
  const pre = /^(g4t[1-5]-\d+):pre:(\d+)$/.exec(String(id));
  if (pre) {
    const source = math4Bank().find(q => q.id === pre[1]);
    return source ? math4BuildPreQuestion(source, Number(pre[2])) : null;
  }
  const practice = mathBankAll().find(q => q.id === id);
  if (practice) return practice;
  const lt = mathLtBank().find(q => q.id === id);
  if (lt) return lt;
  for (const exam of mathExamsAll()) {
    const found = exam.questions.find(q => q.id === id);
    if (found) return found;
  }
  return null;
}
function mathChapterQuestions(ch) {
  // A chapter number is unique across both semesters (1..5 vs 6..10), so a
  // named chapter can be answered from the full bank; only "ôn tổng hợp"
  // (ch = 0) has to stay inside the semester the child is standing in.
  if (ch) return mathBankAll().filter(q => q.ch === ch);
  return mathBank();
}

function mathShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- gợi ý: định nghĩa các khái niệm câu hỏi đang dùng ----
// Chỉ Chương 3 và 4 — hai chương mà một câu hỏi thường bắc lên hai, ba định
// nghĩa cùng lúc ("tia phân giác của một góc bẹt"), nên quên một chữ là mất
// câu hỏi dù phép tính chỉ là 180 : 2.
//
// Khớp theo `topic` TRƯỚC (ngân hàng đã tự gán nhãn khái niệm cho từng câu),
// rồi mới dò thuật ngữ trong đề bài. Không gắn tay từng câu: một câu được
// viết lại vẫn tự khớp đúng.
const MATH_HINT_CHAPTERS = [3, 4];
const MATH_HINT_MAX = 4;          // gợi ý, không phải cả trang lý thuyết

// Một vài câu dùng cùng nhãn chủ đề nhưng kiểm tra hai lỗi hoàn toàn khác
// nhau. Ví dụ “Trường hợp không hợp lệ” có thể là g-g-g, hoặc có thể là
// hai cạnh + một góc KHÔNG xen giữa. Dò một từ chung không đủ an toàn cho
// các câu này, nên các ngoại lệ được nêu rõ và kiểm tra bằng test.
const MATH_HINT_OVERRIDES = {
  'm3-25': ['Dấu hiệu nhận biết hai đường thẳng song song', 'Hai góc so le trong', 'Hai đường thẳng song song (a ∥ b)'],
  'm3-26': ['Tính chất hai đường thẳng song song', 'Hai góc đồng vị', 'Hai đường thẳng song song (a ∥ b)'],
  'm4-14': ['Vì sao không có trường hợp g-g-g'],
  'm4-15': ['Trường hợp cạnh – góc – cạnh (c-g-c)', 'Hai tam giác bằng nhau'],
  'm4-24': ['Trường hợp cạnh – góc – cạnh (c-g-c)', 'Hai tam giác bằng nhau'],
  'm4-28': ['Trường hợp góc – cạnh – góc (g-c-g)', 'Tam giác vuông bằng nhau', 'Tam giác vuông', 'Hai tam giác bằng nhau'],
  'm4-29': ['Vì sao không có trường hợp g-g-g', 'Tam giác vuông bằng nhau', 'Tam giác vuông']
};

function mathGlossary() {
  return (typeof MATH_GLOSSARY !== 'undefined') ? MATH_GLOSSARY : [];
}

function mathHintsFor(q) {
  if (!q || MATH_HINT_CHAPTERS.indexOf(q.ch) === -1) return [];
  const glossary = mathGlossary();
  const override = MATH_HINT_OVERRIDES[q.id];
  if (override) {
    return override.map(name => glossary.find(e => e.ch === q.ch && e.t === name)).filter(Boolean);
  }
  const topic = String(q.topic || '').toLowerCase();
  const text = String(q.q || '').toLowerCase();
  const scored = [];
  glossary.forEach(e => {
    if (e.ch !== q.ch) return;
    const keys = e.m || [];
    // Chủ đề luôn hơn chữ tình cờ xuất hiện trong câu; trong cùng một nguồn,
    // cụm dài/cụ thể hơn thắng cụm ngắn. Nhờ vậy “quan hệ vuông góc và song
    // song” không bị từ chung “song song” chen lên trước.
    let score = 0;
    keys.forEach(k => {
      const key = String(k).toLowerCase();
      if (!key) return;
      if (topic === key) score = Math.max(score, 400 + key.length);
      else if (topic.includes(key)) score = Math.max(score, 300 + key.length);
      else if (text.includes(key)) score = Math.max(score, 100 + key.length);
    });
    if (score) scored.push({ e: e, score: score });
  });
  // Chủ đề trước, rồi giữ nguyên thứ tự trong từ điển để danh sách không nhảy.
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MATH_HINT_MAX).map(x => x.e);
}

// Đóng lại giữa các câu: mở sẵn thì hết là gợi ý, thành đáp án bày ra.
let _mathHintOpen = false;
function toggleMathHint() {
  _mathHintOpen = !_mathHintOpen;
  renderMathQuestion();
}

// exam = đang làm đề thi thử. Đề thi là để bé TỰ làm: một bảng định nghĩa mở
// sẵn ngay dưới câu hỏi thì điểm số không còn nói lên bé nhớ được gì, và cái
// bé cần biết trước hôm thi thật — mình còn quên chỗ nào — cũng mất luôn.
function mathHintHTML(q, exam) {
  if (exam) return '';
  const hints = mathHintsFor(q);
  if (!hints.length) return '';
  if (!_mathHintOpen) {
    return `<button class="math-hint-btn" onclick="toggleMathHint()">
        💡 Gợi ý · ${hints.length} khái niệm liên quan <span class="math-hint-caret">›</span>
      </button>`;
  }
  // Hình trước, chữ sau: với hình học, câu định nghĩa chỉ đọc được khi trong
  // đầu đã có sẵn cái hình mà nó đang mô tả.
  const items = hints.map(e => `
      <div class="math-hint-item">
        <div class="math-hint-term">${mathEsc(e.t)}</div>
        ${typeof mathFigureHTML === 'function' ? mathFigureHTML(e.f) : ''}
        <div class="math-hint-def">${mathRich(e.d)}</div>
      </div>`).join('');
  return `<div class="math-hint-open">
      <button class="math-hint-btn open" onclick="toggleMathHint()">
        💡 Gợi ý <span class="math-hint-caret">⌄</span>
      </button>
      <div class="math-hint-body">${items}</div>
    </div>`;
}

// ---- history ----
function mathHistory() {
  if (typeof appState === 'undefined' || !appState) return [];
  if (!Array.isArray(appState.mathHistory)) appState.mathHistory = [];
  return appState.mathHistory;
}

// Hai môn dùng chung một mảng lịch sử (một lần ghi, một lần đồng bộ), nên
// mọi chỗ ĐẾM lượt phải nói rõ mình đang đếm môn nào. Lượt cũ không có
// `grade` — chúng đều là Toán 7.
function math4History() { return mathHistory().filter(h => h && h.grade === 4); }
function math7History() { return mathHistory().filter(h => !h || h.grade !== 4); }

function saveMathSession(session) {
  if (typeof appState === 'undefined' || !appState) return;
  const list = mathHistory();
  list.unshift(session);
  if (list.length > MATH_HISTORY_CAP) list.length = MATH_HISTORY_CAP;
  if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    // saveUserData sheds old history itself now (halving, bounded — see
    // js/app.js). A quota error must not escape: finishMathQuiz has already
    // added the coins in memory, and an old pop-one-line-and-retry loop here
    // did hundreds of full re-stringifies — a hard freeze at "see result".
    try { saveUserData(currentUser, appState); }
    catch (e) {
      if (typeof showToast === 'function') showToast('⚠️ Bộ nhớ máy đầy — kết quả chưa được lưu');
    }
  }
}

// ---- home ----
// ---- the menu ----------------------------------------------------------
// Three levels, because two different subjects live in this tab and flattening
// them put "Đề thi Toán 7" next to "Math Wars" as if they were the same kind
// of thing:
//
//   home  ├─ 📘 Toán 7 ──┬─ Học kì 1 ─┬─ 🧮 Luyện tập
//         │              │            ├─ 📘 Lý thuyết
//         │              │            └─ 📝 Đề thi
//         │              ├─ Học kì 2 (sắp có)
//         │              └─ 🕘 Lịch sử
//         └─ ⚔️ Math Wars ─┬─ ⚔️ Luyện tập
//                          └─ 📊 Thống kê
//
// _mathView is where the child is; _mathSubTab only means anything inside HK1.
function renderMathHome() {
  const screen = document.getElementById('mathHubScreen');
  if (!screen) return;
  // Tapping the Math tab while a round is running used to repaint the menu
  // over it: the DOM went, the clock kept ticking, and the round "finished"
  // into a screen the child had already left. Redraw the round instead.
  if (typeof isWarsActive === 'function' && isWarsActive()) {
    if (typeof renderWars === 'function') { renderWars(); return; }
  }
  // Same for a cửu chương round. Its clock is only thirty seconds, so the
  // window in which a repaint could destroy the round is short — and that is
  // precisely why it would be missed in testing and hit a child.
  if (typeof isMathTablesActive === 'function' && isMathTablesActive()) {
    if (typeof renderMathTables === 'function') { renderMathTables(); return; }
  }
  // Same for a round or a đề thi in progress. Tapping the Math tab painted the
  // menu on top of it: the questions vanished but _mathQuiz stayed alive, so
  // the next tab change asked "con đang làm dở bài Toán" about work the child
  // could no longer see. Redraw the question instead.
  if (_mathQuiz) { renderMathQuestion(); return; }
  if (_mathView === 'wars') {
    screen.innerHTML = mathHeaderHTML('MATH WARS', 'Tính nhẩm ngược đồng hồ',
      'Cộng – trừ – nhân – chia, ' + (typeof warsLengthLabel === 'function' ? warsLengthLabel() : '5 phút') + ' mỗi trận.', 'openMathSection(\'home\')')
      + (typeof renderWarsHomeHTML === 'function' ? renderWarsHomeHTML() : '');
    return;
  }
  if (_mathView === 'fight') {
    screen.innerHTML = mathHeaderHTML('ĐẤU TOÁN', 'Thách bạn bè',
      '20 câu tính nhẩm trong 5 phút — ai đúng nhiều hơn thì thắng.', 'openMathSection(\'home\')')
      + '<div class="phrases-wrap" id="mfRoot"></div>';
    if (typeof MathFight !== 'undefined') MathFight.open();
    return;
  }
  if (_mathView === 'history') {
    screen.innerHTML = mathHeaderHTML('TOÁN', 'Lịch sử làm bài',
      'Mọi lượt luyện tập và đề thi đã nộp.', `openMathSection('${_mathHistoryBack}')`)
      + `<div class="phrases-wrap">${renderMathHistoryHTML()}</div>`;
    return;
  }
  if (_mathView === 'toan4') { screen.innerHTML = renderToan4MenuHTML(); return; }
  if (_mathView === 'cuuchuong') {
    screen.innerHTML = (typeof renderMathTablesMenuHTML === 'function')
      ? renderMathTablesMenuHTML()
      : renderToan4MenuHTML();
    return;
  }
  if (_mathView === 'hk1' || _mathView === 'hk2') {
    const hk2 = _mathView === 'hk2';
    const body = _mathSubTab === 'lessons' ? renderMathLessonsHTML()
      : _mathSubTab === 'exams' ? renderMathExamsHTML()
      : renderMathPracticeHTML();
    screen.innerHTML = mathHeaderHTML(hk2 ? 'TOÁN 7 · HỌC KÌ 2' : 'TOÁN 7 · HỌC KÌ 1', 'Ôn công thức Toán 7',
      hk2 ? 'Chương VI đến X — tỉ lệ, đa thức, xác suất, tam giác, hình khối.'
          : '5 chương trọng tâm — chọn đúng công thức, nhớ lâu hơn học vẹt.', 'openMathSection(\'toan7\')')
      + `<div class="grammar-subtabs" role="tablist">
      <button class="grammar-subtab ${_mathSubTab === 'practice' ? 'active' : ''}" role="tab"
              onclick="switchMathSubTab('practice')">🧮 Luyện tập</button>
      <button class="grammar-subtab ${_mathSubTab === 'lessons' ? 'active' : ''}" role="tab"
              onclick="switchMathSubTab('lessons')">📘 Lý thuyết</button>
      <button class="grammar-subtab ${_mathSubTab === 'exams' ? 'active' : ''}" role="tab"
              onclick="switchMathSubTab('exams')">📝 Đề thi</button>
    </div>
    <div class="phrases-wrap">${body}</div>`;
    return;
  }
  if (_mathView === 'toan7') { screen.innerHTML = renderToan7MenuHTML(); return; }
  screen.innerHTML = renderMathMenuHTML();
}

// One header shape for every level, carrying the back arrow that leaves it.
function mathHeaderHTML(kicker, title, sub, back) {
  return `
    <header class="nav-hub-header math${back ? ' with-back' : ''}">
      ${back ? `<button class="math-back-btn" onclick="${back}">‹</button>` : ''}
      <span class="nav-hub-kicker">${mathEsc(kicker)}</span>
      <h1>${mathEsc(title)}</h1>
      <p>${mathEsc(sub)}</p>
    </header>`;
}

// Đấu Toán ships hidden and an admin opens it per child. The flag rides home
// on the coin-grant sync (functions/api/coins.js) and is cached here; the
// server refuses the endpoints regardless, so this only decides whether the
// card is worth showing.
function mathFightUnlocked() {
  return !!(typeof appState !== 'undefined' && appState && appState.allowMathFight);
}

function renderMathMenuHTML() {
  const runs = math7History().length;
  const g4 = math4History().length;
  const wars = (typeof warsHistory === 'function') ? warsHistory().length : 0;
  return mathHeaderHTML('TOÁN', 'Chọn phần muốn học', 'Ôn kiến thức Toán 7, hoặc luyện tính nhẩm.', '')
    + `<div class="phrases-wrap">
      <button class="phrases-cta math-section-cta" onclick="openMathSection('toan7')">
        <span class="phrases-cta-icon">📘</span>
        <span class="phrases-cta-text"><strong>Toán 7</strong><small>Công thức, lý thuyết và đề thi theo học kì${runs ? ` · ${runs} lượt đã làm` : ''}</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
      <button class="phrases-cta math-section-cta" onclick="openMathSection('toan4')">
        <span class="phrases-cta-icon">📗</span>
        <span class="phrases-cta-text"><strong>Toán 4</strong><small>Đề ôn theo mẫu đề thi lớp 4${g4 ? ` · ${g4} lượt đã làm` : ''}</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
      <button class="phrases-cta math-section-cta wars" onclick="openMathSection('wars')">
        <span class="phrases-cta-icon">⚔️</span>
        <span class="phrases-cta-text"><strong>Math Wars</strong><small>Tính nhẩm cộng – trừ – nhân – chia${wars ? ` · ${wars} trận` : ''}</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
      ${mathFightUnlocked() ? `<button class="phrases-cta math-section-cta fight" onclick="openMathSection('fight')">
        <span class="phrases-cta-icon">🥊</span>
        <span class="phrases-cta-text"><strong>Đấu Toán</strong><small>Thách bạn bè · 20 câu trong 5 phút · thắng ăn xu</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>` : ''}
    </div>`;
}

function renderToan7MenuHTML() {
  const runs = math7History().length;
  const owed = (typeof retryOwedBannerHTML === 'function') ? retryOwedBannerHTML('math') : '';
  return mathHeaderHTML('TOÁN 7', 'Chọn học kì', 'Công thức, lý thuyết và đề thi theo từng học kì.', 'openMathSection(\'home\')')
    + `<div class="phrases-wrap">
      ${owed}
      <button class="phrases-cta" onclick="openMathSection('hk1')">
        <span class="phrases-cta-icon">①</span>
        <span class="phrases-cta-text"><strong>Học kì 1</strong><small>${mathBank().length} câu · Luyện tập, Lý thuyết, Đề thi</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
      ${(typeof MATH_QUESTIONS_HK2 !== 'undefined' && MATH_QUESTIONS_HK2.length) ? `
      <button class="phrases-cta" onclick="openMathSection('hk2')">
        <span class="phrases-cta-icon">②</span>
        <span class="phrases-cta-text"><strong>Học kì 2</strong><small>${MATH_QUESTIONS_HK2.length} câu · Luyện tập, Lý thuyết, Đề thi</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>` : `
      <button class="phrases-cta locked" disabled aria-disabled="true">
        <span class="phrases-cta-icon">②</span>
        <span class="phrases-cta-text"><strong>Học kì 2</strong><small>Sắp có — đang soạn nội dung</small></span>
        <span class="phrases-cta-arrow">🔒</span>
      </button>`}
      <button class="phrases-cta" onclick="openMathSection('history')">
        <span class="phrases-cta-icon">🕘</span>
        <span class="phrases-cta-text"><strong>Lịch sử làm bài</strong><small>${runs ? `${runs} lượt đã làm · thống kê và câu hay sai` : 'Chưa có lượt nào'}</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
    </div>`;
}

// ---- Toán 4 · Mix + Pre ----------------------------------------------------
// Both buttons make one balanced ten-question paper. Mix keeps the original
// written worksheet; Pre turns one randomly chosen part into four tap answers.
function renderToan4MenuHTML() {
  const runs = math4History().length;
  const mixBest = math4Best(MATH4_MIX_SET);
  const preBest = math4Best(MATH4_PRE_SET);
  const bank = math4Bank().length;
  const types = math4Types();
  const ready = math4Ready();
  const owed = (typeof retryOwedBannerHTML === 'function') ? retryOwedBannerHTML('math') : '';
  const list = types.map(t => `<li>${mathEsc(t.title)} — ${t.count} câu</li>`).join('');
  return mathHeaderHTML('TOÁN 4', 'Đề ôn theo mẫu đề thi',
    'Năm dạng bài của Phần 2, rút từ ngân hàng ' + (bank || 500) + ' câu.', 'openMathSection(\'home\')')
    + `<div class="phrases-wrap">
      ${owed}
      <div class="phrases-hero">
        <div class="phrases-hero-icon">📗</div>
        <h1>Ôn Toán 4</h1>
        <p class="phrases-sub">Mỗi lượt <b>${MATH4_QUIZ_SIZE} câu</b>: ${MATH4_PER_TYPE} câu cho mỗi dạng, xếp theo đúng thứ tự tờ đề.</p>
      </div>
      ${ready ? `<button class="phrases-cta" onclick="startMath4Mix()">
        <span class="phrases-cta-icon">📝</span>
        <span class="phrases-cta-text"><strong>Mix</strong><small>Nhập đáp án · ${MATH4_QUIZ_SIZE} câu · ${types.length} dạng${mixBest !== null ? ` · Tốt nhất: ${mixBest}%` : ''}</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>` : `<button class="phrases-cta locked" disabled aria-disabled="true">
        <span class="phrases-cta-icon">📝</span>
        <span class="phrases-cta-text"><strong>Mix</strong><small>Đang tải ngân hàng câu hỏi…</small></span>
        <span class="phrases-cta-arrow">🔒</span>
      </button>`}
      ${ready ? `<button class="phrases-cta" onclick="startMath4Pre()">
        <span class="phrases-cta-icon">✓</span>
        <span class="phrases-cta-text"><strong>Pre</strong><small>Chọn 1 trong 4 đáp án · ${MATH4_QUIZ_SIZE} câu · thưởng 50 xu khi đúng 100%${preBest !== null ? ` · Tốt nhất: ${preBest}%` : ''}</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>` : `<button class="phrases-cta locked" disabled aria-disabled="true">
        <span class="phrases-cta-icon">✓</span>
        <span class="phrases-cta-text"><strong>Pre</strong><small>Đang tải ngân hàng câu hỏi…</small></span>
        <span class="phrases-cta-arrow">🔒</span>
      </button>`}
      <button class="phrases-cta" onclick="openMathSection('cuuchuong')">
        <span class="phrases-cta-icon">🔢</span>
        <span class="phrases-cta-text"><strong>Bảng cửu chương</strong><small>Nhân và chia · 6 bài · ${typeof TABLES_QUESTIONS !== 'undefined' ? TABLES_QUESTIONS : 10} câu ngược đồng hồ</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
      ${list ? `<div class="math-g4-types"><h3 class="topic-detail-list-title">Đề ôn gồm</h3><ul>${list}</ul></div>` : ''}
      <button class="phrases-cta" onclick="openMathSection('history')">
        <span class="phrases-cta-icon">🕘</span>
        <span class="phrases-cta-text"><strong>Lịch sử làm bài</strong><small>${runs ? `${runs} lượt đã làm` : 'Chưa có lượt nào'}</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
    </div>`;
}

function math4Best(set) {
  const runs = math4History().filter(h => h.total && (!set || h.g4set === set));
  if (!runs.length) return null;
  return Math.max(...runs.map(h => Math.round(h.score / h.total * 100)));
}

// Rút MATH4_PER_TYPE câu cho MỖI dạng rồi xếp theo thứ tự dạng — không xáo
// chung cả 500 câu. Một tờ đề mà bốc trúng năm câu đổi đơn vị và không câu
// nào có lời văn thì không còn kiểm tra được thứ nó định kiểm tra.
function math4PickQuestions() {
  const bank = math4Bank();
  const types = math4Types();
  const order = types.length ? types.map(t => t.t) : [1, 2, 3, 4, 5];
  const picked = [];
  for (const t of order) {
    const pool = bank.filter(q => q.t === t);
    if (!pool.length) continue;
    picked.push(...mathShuffle(pool).slice(0, Math.min(MATH4_PER_TYPE, pool.length)));
  }
  return picked;
}

// Make three believable, distinct numeric alternatives without changing the
// bank. Every Toán 4 answer is an integer; the nearby values catch arithmetic
// slips while ×10/÷10 catches a missing zero in unit conversion.
function math4ChoiceOptions(answer) {
  const raw = String(answer == null ? '' : answer).trim();
  const n = Number(raw);
  if (!Number.isFinite(n)) return mathShuffle([raw, raw + '0', '0' + raw, raw + '1']);
  const digits = Math.max(1, String(Math.abs(Math.trunc(n))).length);
  const place = Math.pow(10, Math.max(0, digits - 2));
  const candidates = [
    n - 1, n + 1, n - 10, n + 10,
    n - place, n + place, n * 10, Math.trunc(n / 10),
    n - 100, n + 100
  ];
  const wrong = [];
  for (const value of mathShuffle(candidates)) {
    const text = String(Math.max(0, Math.trunc(value)));
    if (text !== raw && wrong.indexOf(text) === -1) wrong.push(text);
    if (wrong.length === 3) break;
  }
  for (let value = 0; wrong.length < 3; value++) {
    const text = String(value);
    if (text !== raw && wrong.indexOf(text) === -1) wrong.push(text);
  }
  return mathShuffle([raw].concat(wrong));
}

function math4BuildPreQuestion(source, forcedPartIndex) {
  if (!source || !Array.isArray(source.answerParts) || !source.answerParts.length) return null;
  const partIndex = Number.isInteger(forcedPartIndex)
    ? Math.max(0, Math.min(source.answerParts.length - 1, forcedPartIndex))
    : Math.floor(Math.random() * source.answerParts.length);
  const part = source.answerParts[partIndex];
  const answer = String(part.answer);
  const options = math4ChoiceOptions(answer);
  return Object.assign({}, source, {
    id: `${source.id}:pre:${partIndex}`,
    sourceId: source.id,
    answerPartIndex: partIndex,
    choicePrompt: part.label,
    answer,
    options,
    correct: options.indexOf(answer),
    answerParts: undefined,
    workNote: undefined,
  });
}

function math4PickPreQuestions() {
  return math4PickQuestions().map(q => math4BuildPreQuestion(q)).filter(Boolean);
}

function startMath4Mix() {
  _mathHintOpen = false;
  if (typeof retryGate === 'function' && retryGate('math')) return;
  const questions = math4PickQuestions();
  if (!questions.length) return;
  mathTypedReset();
  _mathQuiz = {
    chapter: 'g4-mix',
    grade: 4,
    g4set: MATH4_MIX_SET,
    label: 'Toán 4 · Mix',
    questions: questions,
    idx: 0,
    answers: questions.map(() => null)
  };
  // Cả tờ đề chỉ được chấm khi nộp, và thanh điều hướng nằm ngay dưới ngón
  // tay suốt mười câu — giống đề thi Toán 7, thanh đó đi chỗ khác trong lúc
  // bé làm bài. Muốn ra vẫn ra được bằng nút ✕, nhưng phải trả lời câu hỏi.
  mathLockScreen(true);
  renderMathQuestion();
}

function startMath4Pre() {
  _mathHintOpen = false;
  if (typeof retryGate === 'function' && retryGate('math')) return;
  const questions = math4PickPreQuestions();
  if (!questions.length) return;
  mathTypedReset();
  _mathQuiz = {
    chapter: 'g4-pre',
    grade: 4,
    g4set: MATH4_PRE_SET,
    label: 'Toán 4 · Pre',
    questions,
    idx: 0,
    answers: questions.map(() => null)
  };
  mathLockScreen(true);
  renderMathQuestion();
}

function openMathSection(v) {
    // Same rule inside the Math tab itself: tapping "back" mid-fight is still
    // walking out on the other child.
    if (v !== 'fight' && typeof MathFight !== 'undefined' && MathFight.isFighting && MathFight.isFighting()) {
        if (!confirm('Con đang đấu toán với bạn.\nThoát bây giờ là XỬ THUA và mất tiền cược.\n\nVẫn thoát?')) return;
        if (MathFight.forfeitNow) MathFight.forfeitNow();
    }
  const known = ['home', 'toan7', 'toan4', 'cuuchuong', 'hk1', 'hk2', 'history', 'wars', 'fight'];
  if (v === 'fight' && !mathFightUnlocked()) v = 'home';
  // Remember the level the child came from BEFORE moving, so ‹ out of the
  // history list lands back on Toán 7 or Toán 4 — whichever opened it.
  if (v === 'history' && (_mathView === 'toan7' || _mathView === 'toan4')) _mathHistoryBack = _mathView;
  if (v === 'toan7' || v === 'toan4') _mathHistoryBack = v;
  _mathView = (known.indexOf(v) === -1) ? 'home' : v;
  // Leaving Math Wars must stop its clock, or it keeps ticking behind a screen
  // the child has walked away from and "finishes" a round they are not in.
  if (_mathView !== 'wars' && typeof abandonWars === 'function' && typeof isWarsActive === 'function'
      && isWarsActive()) abandonWars();
  // And the same for a cửu chương round: thirty seconds is short enough that a
  // clock left running behind another screen would score the round before the
  // child noticed they had left it.
  if (_mathView !== 'cuuchuong' && typeof abandonMathTables === 'function'
      && typeof isMathTablesActive === 'function' && isMathTablesActive()) abandonMathTables();
  // Same reason as the wars clock above: a fight left running behind another
  // screen would keep polling and pulsing at a DOM the child has walked away
  // from. Leaving the tab stops its timers; the server still owns the result.
  if (_mathView !== 'fight' && typeof MathFight !== 'undefined') MathFight.leave();
  renderMathHome();
}

// Kept as the way in from anywhere: 'history' now names a VIEW of its own
// rather than a tab inside Học kì 1, so it moves the child up a level.
function switchMathSubTab(tab) {
  if (tab === 'history') { openMathSection('history'); return; }
  _mathSubTab = (tab === 'lessons' || tab === 'exams') ? tab : 'practice';
  if (_mathView !== 'hk1' && _mathView !== 'hk2') _mathView = 'hk1';
  renderMathHome();
}

// ---- practice view ----
function renderMathPracticeHTML() {
  const bank = mathBank();
  const owed = (typeof retryOwedBannerHTML === 'function') ? retryOwedBannerHTML('math') : '';

  // Gói lũy thừa + căn đứng ngay dưới "Ôn tổng hợp": một lượt = trọn bộ câu.
  const ltBank = mathSemester() === 2 ? [] : mathLtBank();
  const ltBest = ltBank.length ? mathBestFor((typeof MATH_LT_CHAPTER !== 'undefined') ? MATH_LT_CHAPTER : 'lt12') : null;
  const ltCard = !ltBank.length ? '' : `
    <button class="phrases-cta" onclick="startMathLtQuiz()">
      <span class="phrases-cta-icon">🔢</span>
      <span class="phrases-cta-text">
        <strong>${(typeof MATH_LT_LABEL !== 'undefined') ? MATH_LT_LABEL : 'Ôn tập chương 1&2 · Lũy thừa & Căn bậc hai'}</strong>
        <small>${ltBank.length} câu — công thức lũy thừa + tự tính căn bậc hai${ltBest !== null ? ` · Tốt nhất: ${ltBest}%` : ''}</small>
      </span>
      <span class="phrases-cta-arrow">›</span>
    </button>`;

  const chapterCards = mathChapters().map(c => {
    const n = mathChapterQuestions(c.num).length;
    const best = mathBestFor(c.num);
    return `
      <button class="phrases-cta" onclick="startMathQuiz(${c.num})">
        <span class="phrases-cta-icon">${c.icon}</span>
        <span class="phrases-cta-text">
          <strong>Chương ${c.num} · ${mathEsc(c.title)}</strong>
          <small>${n} câu công thức${best !== null ? ` · Tốt nhất: ${best}%` : ''}</small>
        </span>
        <span class="phrases-cta-arrow">›</span>
      </button>`;
  }).join('');

  return `
    ${owed}
    <div class="phrases-hero">
      <div class="phrases-hero-icon">🧮</div>
      <h1>Luyện công thức</h1>
      <p class="phrases-sub">Mỗi lượt <b>${MATH_QUIZ_SIZE} câu</b>: tự nhập kết quả hoặc chọn đáp án đúng. ${bank.length} câu trên tất cả 5 chương.</p>
    </div>
    <button class="phrases-cta" onclick="startMathQuiz(0)">
      <span class="phrases-cta-icon">🎲</span>
      <span class="phrases-cta-text"><strong>Ôn tổng hợp</strong><small>${MATH_QUIZ_SIZE} câu trộn cả 5 chương</small></span>
      <span class="phrases-cta-arrow">›</span>
    </button>
    ${ltCard}
    ${chapterCards}
    ${renderMathWrongPanelHTML()}`;
}

function mathBestFor(ch) {
  // Practice runs only — an exam scored 21/25 is not a chapter's 10-question best.
  const runs = mathHistory().filter(h => h.chapter === ch && h.total && !h.examId);
  if (!runs.length) return null;
  return Math.max(...runs.map(h => Math.round(h.score / h.total * 100)));
}

// ---- đề thi view ----
// Đề tự soạn trước, đề thi thật của các trường xếp sau — cùng một thứ tự ở
// cả hai học kì, để chỗ đứng của "đề thật" trong danh sách không đổi.
//
// Bốn hàm nhỏ thay vì một hàm nhận TÊN biến: các ngân hàng khai báo bằng
// `const` ở đầu file script, mà `const` cấp cao nhất KHÔNG trở thành thuộc
// tính của globalThis — tra theo tên sẽ luôn ra rỗng và danh sách đề trống
// trơn. Phải nhắc thẳng tên biến, có `typeof` chắn vì ngân hàng nạp lười.

// Only MATH_SOURCE_EXAMS ships per-question ids ("s1-1"); the other three
// banks — 1,108 questions across HK1 Exam 1..10, HK2 Exam 1..10 and the 30
// đề thật HK2 — carry none. An id is not decoration: finishMathQuiz stores
// `wrong: [...ids]`, mathById reads that list back for "Dạng toán cần ôn",
// and retryAdd('math', …) drops any question whose id is empty, so without
// one a missed đề-thi question is both mis-shown and never re-drilled.
//
// So stamp one on, derived from the exam's own id and the question's place
// in the paper: stable across reloads (nothing random, nothing time-based),
// unique because the 55 exam ids are unique across all four banks, and it
// never overwrites an id a bank already wrote.
//
// It runs from the four accessors below rather than at parse time because
// the banks are LAZY-LOADED (js/lazy-data.js SCREEN_FILES.mathHubScreen):
// when math.js is parsed they do not exist yet. The WeakSet makes it a
// one-shot pass per bank array — the accessors are called on every render.
const _mathStampedExams = new WeakSet();
function _mathStampExamIds(exams) {
  if (!Array.isArray(exams) || !exams.length || _mathStampedExams.has(exams)) return exams;
  _mathStampedExams.add(exams);
  for (const exam of exams) {
    if (!exam || !Array.isArray(exam.questions)) continue;
    const base = String(exam.id == null ? '' : exam.id);
    if (!base) continue;
    exam.questions.forEach((q, i) => {
      if (q && (q.id === undefined || q.id === null || q.id === '')) q.id = `${base}-q${i + 1}`;
    });
  }
  return exams;
}
function _mathHk1Exams() { return _mathStampExamIds((typeof MATH_EXAMS !== 'undefined' && Array.isArray(MATH_EXAMS)) ? MATH_EXAMS : []); }
function _mathHk1Source() { return _mathStampExamIds((typeof MATH_SOURCE_EXAMS !== 'undefined' && Array.isArray(MATH_SOURCE_EXAMS)) ? MATH_SOURCE_EXAMS : []); }
function _mathHk2Exams() { return _mathStampExamIds((typeof MATH_EXAMS_HK2 !== 'undefined' && Array.isArray(MATH_EXAMS_HK2)) ? MATH_EXAMS_HK2 : []); }
function _mathHk2Source() { return _mathStampExamIds((typeof MATH_SOURCE_EXAMS_HK2 !== 'undefined' && Array.isArray(MATH_SOURCE_EXAMS_HK2)) ? MATH_SOURCE_EXAMS_HK2 : []); }
function mathExams() {
  return mathSemester() === 2
    ? _mathHk2Exams().concat(_mathHk2Source())
    : _mathHk1Exams().concat(_mathHk1Source());
}
function mathExamsAll() {
  return _mathHk1Exams().concat(_mathHk1Source(), _mathHk2Exams(), _mathHk2Source());
}

function mathExamBest(id) {
  const runs = mathHistory().filter(h => h.examId === id && h.total);
  if (!runs.length) return null;
  return Math.max(...runs.map(h => Math.round(h.score / h.total * 100)));
}

function renderMathExamsHTML() {
  const exams = mathExams();
  const cards = exams.map(e => {
    const best = mathExamBest(e.id);
    return `
      <button class="phrases-cta" onclick="startMathExam('${e.id}')">
        <span class="phrases-cta-icon">📝</span>
        <span class="phrases-cta-text">
          <strong>${mathEsc(e.title)}</strong>
          <small>${e.school ? `${mathEsc(e.school)} · ` : ''}${e.questions.length} câu · Không giới hạn thời gian${best !== null ? ` · Tốt nhất: ${best}%` : ''}</small>
        </span>
        <span class="phrases-cta-arrow">›</span>
      </button>`;
  }).join('');
  return `
    <div class="phrases-hero">
      <div class="phrases-hero-icon">📝</div>
      <h1>Đề thi thử học kì ${mathSemester()}</h1>
      <p class="phrases-sub">${mathSemester() === 2
        ? 'Mười đề tự soạn đứng trước, rồi tới các đề <b>thật của các trường</b> năm 2025–2026 — hình đều được vẽ lại cho nét.'
        : '<b>HK1 1–5</b> được chép từ đề trường năm 2025–2026, giữ nguyên thứ tự câu và hình.'} Không giới hạn thời gian; dùng nút ✏️ khi cần nháp nhé!</p>
    </div>
    ${cards || '<div class="phrases-cat-row"><span>Đề thi đang được cập nhật…</span></div>'}`;
}

function startMathExam(id) {
  if (typeof retryGate === 'function' && retryGate('math')) return;
  const exam = mathExams().find(e => e.id === id);
  if (!exam || !exam.questions.length) return;
  mathTypedReset();
  _mathQuiz = {
    chapter: 0,
    examId: exam.id,
    label: exam.title,
    // Đề order on purpose — a real paper is not shuffled, and easy-to-hard
    // pacing is part of what the mock is teaching.
    questions: exam.questions.slice(),
    idx: 0,
    answers: exam.questions.map(() => null)
  };
  mathLockScreen(true);
  renderMathQuestion();
}

// ---- lịch sử view ----
// A run is either practice (chapter rounds / mixed) or an exam (has examId).
// The page answers a parent's three questions at a glance — how much, how
// well, best ever — then lets the child drill into the list two ways at once:
// by kind (Luyện tập / Đề thi) and by result tier.
function mathHistoryFiltered() {
  const list = _mathHistoryBack === 'toan4' ? math4History() : math7History();
  return list.filter(h => {
    if (_mathHistoryType === 'practice' && h.examId) return false;
    if (_mathHistoryType === 'exam' && !h.examId) return false;
    if (_mathHistoryFilter === 'all') return true;
    return mathTier(Math.round(h.score / h.total * 100)) === _mathHistoryFilter;
  });
}

function mathHistoryStats(list) {
  if (!list.length) return null;
  const pcts = list.map(h => (h.total ? Math.round(h.score / h.total * 100) : 0));
  return {
    runs: list.length,
    avg: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
    best: Math.max(...pcts)
  };
}

function mathHistoryWhen(ts) {
  try {
    return new Date(ts).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}

// ---- questions to review: which ones, and how often ----
// "20%" three times over says a child is struggling but not with WHAT. Counting
// how many times each question has been missed across every past run does, and
// the list doubles as the shortest possible revision sheet.
function mathWrongAggregate() {
  const counts = new Map();
  mathHistory().forEach(s => (s.wrong || []).forEach(id => {
    counts.set(id, (counts.get(id) || 0) + 1);
  }));
  const out = [];
  counts.forEach((misses, id) => {
    const q = mathById(id);
    if (q) out.push({ q, misses });
  });
  out.sort((a, b) => b.misses - a.misses || String(a.q.id).localeCompare(String(b.q.id)));
  return out;
}

function mathWrongSkillLabel(q) {
  const topic = String(q && q.topic || '').trim();
  if (topic && !/^(?:I|II)\.|\b(?:Câu|Bài)\s*\d/i.test(topic)) return topic;
  const chapters = {
    1: 'Số hữu tỉ và tỉ lệ',
    2: 'Số thực và căn bậc hai',
    3: 'Góc và đường thẳng',
    4: 'Tam giác',
    5: 'Dữ liệu và biểu đồ',
    6: 'Hình khối'
  };
  return chapters[q && q.ch] || 'Ôn tập tổng hợp';
}

// Admin analytics uses the same human topic labels as the child's local
// wrong-answer panel, but stores a stable ASCII key so labels can be improved
// later without splitting one skill into two database groups.
function mathAnalyticsSlug(value) {
  return String(value || 'general').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'general';
}

function mathSkillSummaries(st) {
  const groups = new Map();
  st.questions.forEach((q, i) => {
    const label = mathWrongSkillLabel(q);
    const key = 'math' + (q && q.grade === 4 ? '4' : '7') + '.' + mathAnalyticsSlug(label);
    const row = groups.get(key) || {
      skillKey: key, skillLabel: label, attempts: 0, correct: 0,
      wrong: 0, skipped: 0, wrongRefs: []
    };
    row.attempts++;
    const answer = st.answers[i];
    if (answer === null || answer === 'revealed') row.skipped++;
    else if (mathIsCorrect(q, answer)) row.correct++;
    else {
      row.wrong++;
      if (q.id != null && row.wrongRefs.length < 20) row.wrongRefs.push(String(q.id));
    }
    groups.set(key, row);
  });
  return Array.from(groups.values());
}

function mathWrongSkillAggregate(wrong) {
  const groups = new Map();
  (wrong || mathWrongAggregate()).forEach(({ q, misses }) => {
    const label = mathWrongSkillLabel(q);
    const current = groups.get(label) || { label, misses: 0, questions: 0 };
    current.misses += misses;
    current.questions++;
    groups.set(label, current);
  });
  return Array.from(groups.values())
    .sort((a, b) => b.misses - a.misses || b.questions - a.questions || a.label.localeCompare(b.label));
}

function startMathWrongPractice() {
  const wrong = mathWrongAggregate();
  if (!wrong.length) return;
  const owed = (typeof retryCount === 'function') ? retryCount('math') : 0;
  if (owed && typeof startMathRetry === 'function') { startMathRetry(); return; }
  const questions = wrong.slice(0, MATH_QUIZ_SIZE).map(x => x.q);
  _mathHintOpen = false;
  mathTypedReset();
  _mathQuiz = {
    chapter: 0,
    label: 'Luyện câu hay sai',
    questions,
    idx: 0,
    answers: questions.map(() => null)
  };
  renderMathQuestion();
}

function renderMathWrongPanelHTML() {
  const wrong = mathWrongAggregate();
  if (!wrong.length) return '';
  const skills = mathWrongSkillAggregate(wrong);
  const totalMisses = wrong.reduce((sum, item) => sum + item.misses, 0);
  const chips = skills.slice(0, 8).map(skill => `
    <div class="math-review-chip">
      <span>${mathEsc(skill.label)}</span><strong>${skill.misses}×</strong>
    </div>`).join('');
  const rows = wrong.slice(0, 15).map(({ q, misses }) => `
    <div class="math-wrong-row">
      <span class="math-wrong-count">${misses}×</span>
      <div class="math-wrong-main">
        <div class="math-wrong-q math-formula">${mathFormula(q.q)}</div>
        <div class="math-wrong-a">✅ <b class="math-formula">${mathFormula(q.answer)}</b></div>
      </div>
    </div>`).join('');
  const more = wrong.length > 15
    ? `<div class="math-wrong-more">… và ${wrong.length - 15} câu nữa</div>` : '';
  const owed = (typeof retryCount === 'function' ? retryCount('math') : 0);
  return `
    <section class="math-wrong-panel math-review-card" aria-labelledby="mathReviewTitle">
      <div class="math-review-head">
        <svg class="math-review-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5v14h16M7 8l4 4 3-3 5 6"/><circle cx="7" cy="8" r="1"/><circle cx="11" cy="12" r="1"/><circle cx="14" cy="9" r="1"/><circle cx="19" cy="15" r="1"/>
        </svg>
        <div><h2 id="mathReviewTitle">Dạng toán cần ôn</h2>
          <p>Câu hay sai · ${wrong.length} câu · ${totalMisses} lần sai</p></div>
        <span class="math-review-total">${wrong.length}</span>
      </div>
      <div class="math-review-chips">${chips}</div>
      ${skills.length > 8 ? `<div class="math-wrong-more">… và ${skills.length - 8} dạng toán khác</div>` : ''}
      <button type="button" class="math-review-cta" onclick="startMathWrongPractice()">
        <span aria-hidden="true">↻</span>
        ${owed ? `Luyện câu đang sai (${owed})` : `Luyện lại câu hay sai (${Math.min(wrong.length, MATH_QUIZ_SIZE)})`}
      </button>
      <details class="math-review-details">
        <summary>Xem chi tiết ${Math.min(wrong.length, 15)} câu hay sai</summary>
        <div class="math-wrong-list">${rows}</div>${more}
      </details>
      ${owed ? `<div class="math-wrong-note">Còn <b>${owed}</b> câu cần làm đúng để mở khoá lượt luyện mới.</div>` : ''}
    </section>`;
}

function renderMathHistoryHTML() {
  const all = mathHistory();
  if (!all.length) {
    return `
      <div class="phrases-hero">
        <div class="phrases-hero-icon">🕘</div>
        <h1>Chưa có kết quả nào</h1>
        <p class="phrases-sub">Làm một lượt <b>Luyện tập</b> hoặc một <b>Đề thi</b> là kết quả sẽ hiện ở đây.</p>
      </div>
      <button class="phrases-cta" onclick="switchMathSubTab('practice')">
        <span class="phrases-cta-icon">🧮</span>
        <span class="phrases-cta-text"><strong>Bắt đầu luyện tập</strong><small>10 câu đầu tiên</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>`;
  }

  const list = mathHistoryFiltered();
  const stats = mathHistoryStats(list);
  const typeTabs = [['all', 'Tất cả'], ['practice', '🧮 Luyện tập'], ['exam', '📝 Đề thi']].map(([t, lbl]) =>
    `<button class="grammar-subtab ${_mathHistoryType === t ? 'active' : ''}"
             onclick="setMathHistoryType('${t}')">${lbl}</button>`).join('');
  const tierTabs = Object.keys(MATH_TIER_LABELS).map(t =>
    `<button class="grammar-subtab ${_mathHistoryFilter === t ? 'active' : ''}"
             onclick="setMathHistoryFilter('${t}')">${MATH_TIER_LABELS[t]}</button>`).join('');

  const statsHTML = stats ? `
    <div class="math-hist-stats">
      <div class="math-hist-stat"><strong>${stats.runs}</strong><span>lượt làm</span></div>
      <div class="math-hist-stat"><strong>${stats.avg}%</strong><span>trung bình</span></div>
      <div class="math-hist-stat"><strong>${stats.best}%</strong><span>tốt nhất</span></div>
    </div>` : '';

  const rows = list.slice(0, 40).map(h => {
    const pct = h.total ? Math.round(h.score / h.total * 100) : 0;
    const tier = mathTier(pct);
    return `
      <div class="math-hist-row">
        <span class="math-hist-emoji">${mathTierEmoji(pct)}</span>
        <div class="math-hist-main">
          <div class="math-hist-title">${h.examId ? '<span class="math-hist-badge">Đề thi</span> ' : ''}${mathEsc(h.label)}</div>
          <div class="math-hist-bar"><div class="math-hist-fill tier-${tier}" style="width:${pct}%"></div></div>
        </div>
        <div class="math-hist-side">
          <strong>${h.score}/${h.total}</strong>
          <span>${pct}% · ${mathHistoryWhen(h.date)}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="phrases-hero">
      <div class="phrases-hero-icon">🕘</div>
      <h1>Lịch sử làm bài</h1>
      <p class="phrases-sub">Mỗi lượt luyện tập và mỗi đề thi đã nộp đều được ghi lại ở đây.</p>
    </div>
    ${statsHTML}
    ${renderMathWrongPanelHTML()}
    <div class="grammar-subtabs math-hist-tabs">${typeTabs}</div>
    <div class="grammar-subtabs math-hist-tabs">${tierTabs}</div>
    <div class="math-hist-list">${rows || '<div class="phrases-cat-row"><span>Chưa có lượt nào khớp bộ lọc này</span></div>'}</div>`;
}

function setMathHistoryFilter(tier) { _mathHistoryFilter = tier; renderMathHome(); }
function setMathHistoryType(t) { _mathHistoryType = t; renderMathHome(); }

// ---- lessons view ----
function renderMathLessonsHTML() {
  const rows = mathLessons().map(l => `
    <button class="phrases-cta" onclick="openMathLesson('${mathEsc(l.key)}')">
      <span class="phrases-cta-icon">${l.icon}</span>
      <span class="phrases-cta-text"><strong>${mathEsc(l.title)}</strong><small>Công thức cần nhớ</small></span>
      <span class="phrases-cta-arrow">›</span>
    </button>`).join('');
  return `
    <div class="phrases-hero">
      <div class="phrases-hero-icon">📘</div>
      <h1>Lý thuyết</h1>
      <p class="phrases-sub">Công thức của từng chương, viết đầy đủ để ôn trước khi luyện tập.</p>
    </div>
    ${rows}`;
}

function openMathLesson(key) {
  const l = mathLessons().find(x => x.key === key);
  const screen = document.getElementById('mathHubScreen');
  if (!l || !screen) return;
  // Same markup as the Word form / Exam lesson views. Inventing class names
  // here is how this shipped unreadable the first time: "grammar-lesson-card"
  // looked plausible and had no styles at all.
  screen.innerHTML = `
    <div class="exam-lesson-detail">
      <button class="exam-back-btn" onclick="renderMathHome()">←</button>
      <h1 class="exam-lesson-detail-title">${l.icon} ${mathEsc(l.title)}</h1>
      <div class="exam-lesson-content math-lesson-body">${mathRich(l.content)}</div>
      <button class="grammar-next-btn" onclick="startMathQuizForLesson('${mathEsc(l.key)}')">Luyện chương này →</button>
    </div>`;
  screen.scrollTop = 0;
  if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
}

function startMathQuizForLesson(key) {
  const l = mathLessons().find(x => x.key === key);
  startMathQuiz(l ? l.chapter : 0);
}

// ---- quiz ----
// chapter 0 = mixed revision across all five chapters.
function startMathQuiz(chapter) {
  _mathHintOpen = false;
  if (typeof retryGate === 'function' && retryGate('math')) return;
  const pool = mathChapterQuestions(chapter);
  if (!pool.length) return;
  // Draw the typed questions on purpose. Left to a plain shuffle they are a
  // handful among fifty, so most rounds would never ask the child to compute
  // anything — recognising the formula would go on being the whole tab.
  const size = Math.min(MATH_QUIZ_SIZE, pool.length);
  const typed = mathShuffle(pool.filter(mathIsTyped)).slice(0, Math.min(MATH_TYPED_PER_ROUND, size));
  const mcq = mathShuffle(pool.filter(q => !mathIsTyped(q))).slice(0, size - typed.length);
  const picked = mathShuffle(typed.concat(mcq));
  mathTypedReset();
  _mathQuiz = {
    chapter: chapter,
    questions: picked,
    idx: 0,
    answers: picked.map(() => null)
  };
  renderMathQuestion();
}

// Ôn tập chương 1&2 — 20 câu công thức lũy thừa + 20 bài tự tính căn.
// Cả gói trong MỘT lượt (chỉ xáo thứ tự): mục tiêu là thuộc trọn bảng,
// nên không rút 10 câu ngẫu nhiên như lượt của các chương.
function startMathLtQuiz() {
  _mathHintOpen = false;
  if (typeof retryGate === 'function' && retryGate('math')) return;
  const pool = mathLtBank();
  if (!pool.length) return;
  mathTypedReset();
  _mathQuiz = {
    chapter: (typeof MATH_LT_CHAPTER !== 'undefined') ? MATH_LT_CHAPTER : 'lt12',
    label: (typeof MATH_LT_LABEL !== 'undefined') ? MATH_LT_LABEL : 'Ôn tập chương 1&2 · Lũy thừa & Căn bậc hai',
    questions: mathShuffle(pool),
    idx: 0,
    answers: pool.map(() => null)
  };
  renderMathQuestion();
}

function mathQuizLabel(chapter) {
  if (chapter === 'g4-mix') return 'Toán 4 · Mix';
  if (chapter === 'g4-pre') return 'Toán 4 · Pre';
  if (!chapter) return 'Ôn tổng hợp';
  const c = mathChapters().find(x => x.num === chapter);
  return c ? `Chương ${c.num} · ${c.title}` : `Chương ${chapter}`;
}

// The board's pinned strip shows the question the student is actually on, so
// they never have to memorize it while writing rough work.
function mathCurrentQuestion() {
  return _mathQuiz ? _mathQuiz.questions[_mathQuiz.idx] : null;
}

function renderMathQuestion() {
  const screen = document.getElementById('mathHubScreen');
  const st = _mathQuiz;
  if (!screen || !st) return;
  const q = st.questions[st.idx];
  const ans = st.answers[st.idx];
  const written = mathIsWritten(q);
  const revealed = written && (ans === 'revealed' || typeof ans === 'boolean');
  const answered = ans !== null && ans !== 'revealed';
  const total = st.questions.length;

  const ok = mathIsCorrect(q, ans);

  let body;
  if (written) {
    body = !revealed
      ? `<div class="math-written-help">Làm bài vào giấy hoặc bảng nháp, sau đó xem đáp án để tự đối chiếu.</div>
         <button class="grammar-next-btn" onclick="revealMathWritten()">Xem đáp án và lời giải</button>`
      : `<div class="grammar-explanation math-written-solution">${mathExplanationHTML(q.explanation, q)}</div>`
        + (ans === 'revealed'
          ? `<div class="math-written-grade"><p>Con tự đối chiếu bài làm:</p>
               <button class="grammar-next-btn math-self-good" onclick="gradeMathWritten(true)">✓ Con làm đúng</button>
               <button class="grammar-next-btn math-self-review" onclick="gradeMathWritten(false)">↻ Con cần xem lại</button>
             </div>`
          : `<button class="grammar-next-btn" onclick="nextMathQuestion()">${st.idx + 1 < total ? 'Câu tiếp →' : 'Xem kết quả'}</button>`);
  } else if (mathIsTyped(q)) {
    if (mathHasAnswerParts(q)) {
      // Toán 4 says it twice otherwise: the stem is already "Đặt tính rồi
      // tính:" and the note under it "Đặt tính ra bảng nháp rồi nhập kết quả
      // của từng phép tính." The ✏️ in the quiz header opens the same board,
      // so the whole banner is a second copy of what is already on screen.
      body = (math4FreeEntry(q) ? '' : `<div class="math-written-help math-board-prompt">
          <button type="button" class="math-open-board" onclick="openMathBoard()">✏️ Mở bảng nháp</button>
          <span>${mathEsc(q.workNote || 'Làm bài trên bảng nháp, rồi nhập từng kết quả cuối cùng.')}</span>
        </div>`)
        + mathAnswerPartsHTML(q, answered ? ans : null)
        + (answered ? '' : (math4FreeEntry(q)
          // No keypad: the boxes are real inputs and the iPad brings its own.
          ? `<button class="grammar-next-btn" id="mathSubmitBtn" ${math4AllFilled(q) ? '' : 'disabled'}
                  onclick="submitMathTyped()">${q.answerParts.length > 1 ? 'Kiểm tra tất cả' : 'Kiểm tra'}</button>`
          : `${mathKeypadHTML(q)}
          <button class="grammar-next-btn" id="mathSubmitBtn" ${_mathTyped.raw ? '' : 'disabled'}
                  onclick="submitMathTyped()">${_mathTyped.part + 1 < q.answerParts.length ? 'Lưu kết quả này →' : 'Kiểm tra tất cả'}</button>`));
    } else {
      body = answered
        // What the child typed, then the right answer if it differed — the same
        // shape every other tab uses to close a question.
        ? mathTypedBoxHTML(ans, ok ? 'correct' : 'wrong') +
          (ok ? '' : `<div class="math-answer-right">✅ <b class="math-formula">${mathFormula(q.answer)}</b></div>`)
        : `<div id="mathAnswerSlot">${mathTypedBoxHTML()}</div>
           ${mathKeypadHTML(q)}
           <button class="grammar-next-btn" id="mathSubmitBtn" ${_mathTyped.raw ? '' : 'disabled'}
                   onclick="submitMathTyped()">Kiểm tra</button>`;
    }
  } else {
    body = `<div class="grammar-options">` + q.options.map((opt, i) => {
      let cls = 'grammar-option';
      if (answered) {
        if (q.sourceIssue && i === ans) cls += ' source-issue';
        else if (i === q.correct) cls += ' correct';
        else if (i === ans) cls += ' wrong';
      }
      return `
      <button class="${cls}" ${answered ? '' : `onclick="answerMathQuestion(${i})"`}>
        <span class="grammar-option-letter">${'ABCD'[i]}</span>
        <span class="grammar-option-text math-formula">${mathFormula(opt)}</span>
      </button>`;
    }).join('') + `</div>`;
  }

  const explain = !written && answered ? `
    <div class="grammar-explanation ${ok ? 'correct' : 'wrong'}">
      ${mathExplanationHTML(q.explanation, q)}
    </div>
    <button class="grammar-next-btn" onclick="nextMathQuestion()">${st.idx + 1 < total ? 'Câu tiếp →' : 'Xem kết quả'}</button>` : '';

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="mathQuizQuit()">✕</button>
        <span class="grammar-quiz-progress">${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${(st.idx) / total * 100}%"></div></div>
        <button class="math-board-fab" type="button" title="Bảng nháp" onclick="openMathBoard()">✏️</button>
      </div>
      <div class="phrases-cat-row math-topic-badge">${mathEsc(q.topic || mathQuizLabel(st.chapter))}</div>
      <div class="grammar-question-text">${mathFormula(q.q)}</div>
      ${q.choicePrompt ? `<div class="math4-pre-prompt">${mathFormula(q.choicePrompt)}</div>` : ''}
      ${typeof mathQuestionFigureHTML === 'function' ? mathQuestionFigureHTML(q.fig) : ''}
      ${mathHintHTML(q, !!st.examId)}
      ${body}
      ${explain}
    </div>`;
  screen.scrollTop = 0;
}

function revealMathWritten() {
  const st = _mathQuiz;
  if (!st || !mathIsWritten(st.questions[st.idx]) || st.answers[st.idx] !== null) return;
  st.answers[st.idx] = 'revealed';
  renderMathQuestion();
}

function gradeMathWritten(ok) {
  const st = _mathQuiz;
  if (!st || !mathIsWritten(st.questions[st.idx]) || st.answers[st.idx] !== 'revealed') return;
  st.answers[st.idx] = !!ok;
  if (typeof petCheerAnswer === 'function') petCheerAnswer(!!ok);
  renderMathQuestion();
}

function answerMathQuestion(i) {
  const st = _mathQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  st.answers[st.idx] = i;
  const ok = mathIsCorrect(q, i);
  // The debt is filed once, at the end — retryAdd() takes the whole set of
  // missed questions, the same way every other tab feeds the drill.
  if (typeof petCheerAnswer === 'function') petCheerAnswer(ok);
  renderMathQuestion();
}

function submitMathTyped() {
  const st = _mathQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  // Toán 4: the child fills the boxes in whatever order they like and one
  // press marks the whole question, so there is no per-box save step.
  if (math4FreeEntry(q)) {
    // Read the boxes, not the copy — this is what the child can see, and it
    // is what must be marked even if the copy fell behind.
    const vals = math4Values(q);
    if (vals.some(v => v === '')) return;   // an empty box is not an answer
    _mathTyped.values = vals.slice();
    st.answers[st.idx] = vals;
    if (typeof petCheerAnswer === 'function') petCheerAnswer(mathIsCorrect(q, st.answers[st.idx]));
    renderMathQuestion();
    return;
  }
  const raw = mathTypedRaw();
  if (!raw) return;                       // an empty box is not an answer
  if (mathHasAnswerParts(q)) {
    _mathTyped.values[_mathTyped.part] = raw;
    if (_mathTyped.part + 1 < q.answerParts.length) {
      _mathTyped.part++;
      _mathTyped.raw = '';
      _mathTyped.sup = false;
      renderMathQuestion();
      return;
    }
    st.answers[st.idx] = _mathTyped.values.slice();
    if (typeof petCheerAnswer === 'function') petCheerAnswer(mathIsCorrect(q, st.answers[st.idx]));
  } else {
    st.answers[st.idx] = raw;
    if (typeof petCheerAnswer === 'function') petCheerAnswer(mathGrade(q, raw));
  }
  renderMathQuestion();
}

function nextMathQuestion() {
  _mathHintOpen = false;
  const st = _mathQuiz;
  if (!st) return;
  mathTypedReset();
  if (st.idx + 1 < st.questions.length) { st.idx++; renderMathQuestion(); }
  else finishMathQuiz();
}

function mathPerfectBonus(chapter, score, total) {
  if (!(total > 0 && score === total)) return 0;
  if (chapter === 'g4-pre') return MATH4_PRE_PERFECT_BONUS;
  if (chapter === 'g4-mix') return MATH4_MIX_PERFECT_BONUS;
  return 0;
}

function finishMathQuiz() {
  if (typeof mathBoardCloseForSession === 'function') mathBoardCloseForSession();
  if (typeof mathBoardReset === 'function') mathBoardReset();
  const st = _mathQuiz;
  const screen = document.getElementById('mathHubScreen');
  if (!st || !screen) return;
  mathLockScreen(false);   // the paper is over: the score is banked, let them move
  const total = st.questions.length;
  const score = st.answers.reduce((s, a, i) => s + (mathIsCorrect(st.questions[i], a) ? 1 : 0), 0);
  const pct = Math.round(score / total * 100);

  // Coins for the pet shop. Half the English rate: a maths question is one
  // pick from four formulas, not a word produced from nothing.
  //
  // The combo bonus is banked HERE and nowhere else. Maths already cheered
  // every answer through petCheerAnswer — which pops "+N 🪙" on each streak —
  // but never called petComboBonus(), so that promise was never paid out and
  // the unclaimed total rode along into whichever English practice came next.
  const perfectBonus = mathPerfectBonus(st.chapter, score, total);
  const coinsEarned = score * MATH_COINS_PER_CORRECT
    + (typeof petComboBonus === 'function' ? petComboBonus() : 0)
    + perfectBonus;
  if (typeof appState !== 'undefined' && appState) {
    appState.coins = (appState.coins || 0) + coinsEarned;
  }

  const wrong = st.questions
    .map((q, i) => ({ q, a: st.answers[i] }))
    .filter(x => !mathIsCorrect(x.q, x.a));

  // Banked before the session is saved, so one write persists both.
  saveMathSession({
    date: Date.now(), chapter: st.chapter, label: st.label || mathQuizLabel(st.chapter),
    examId: st.examId || undefined,
    // Toán 4 và Toán 7 dùng chung mảng lịch sử này. `grade` là thứ duy nhất
    // phân biệt chúng ở mọi nơi về sau — bộ đếm lượt, danh sách lịch sử,
    // dòng gửi lên máy chủ và nhiệm vụ hằng ngày.
    grade: st.grade || undefined,
    g4set: st.g4set || undefined,
    score: score, total: total,
    // Which questions were missed, not just how many — that is what makes a
    // "câu hay sai" list possible at all. Every bank is stamped by now, but an
    // id-less question must drop out rather than be written as `undefined`:
    // JSON turns that into `null`, and a history full of nulls is a miss count
    // pinned on whichever question happens to answer to an empty id.
    wrong: wrong.map(x => x.q.id).filter(id => id !== undefined && id !== null && id !== ''),
    skills: mathSkillSummaries(st),
  });
  if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }
  // Push it to the server now, like every other tab. Without this the session
  // sat in localStorage until some OTHER tab finished a practice and flushed
  // the queue — so a child who only did maths showed up as inactive.
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

  // Owe back everything missed before a new practice opens (js/retrydrill.js).
  const retryable = wrong.filter(x => !mathIsWritten(x.q) && !mathHasAnswerParts(x.q));
  if (retryable.length && typeof retryAdd === 'function') retryAdd('math', retryable.map(x => x.q));
  const wrongHTML = wrong.map(x => `
    <div class="grammar-review-item">
      <div class="grammar-review-q">${mathFormula(x.q.q)}</div>
      ${x.q.choicePrompt ? `<div class="math4-pre-prompt compact">${mathFormula(x.q.choicePrompt)}</div>` : ''}
      <div class="grammar-review-a">✅ ${mathAnswerHTML(x.q)}</div>
      <div class="grammar-review-explain">${mathExplanationHTML(x.q.explanation, x.q)}</div>
    </div>`).join('');

  _mathQuiz = null;
  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-result-card">
        <div class="grammar-result-emoji">${mathTierEmoji(pct)}</div>
        <h2>${score}/${total} · ${pct}%</h2>
        <p>${mathEsc(st.label || mathQuizLabel(st.chapter))}</p>
      </div>
      ${typeof petRewardCardHTML === 'function'
        ? petRewardCardHTML(score, total, coinsEarned, MATH_COINS_PER_CORRECT)
        : (coinsEarned ? `<div class="grammar-result-coins">+${coinsEarned} 🪙</div>` : '')}
      ${perfectBonus ? `
        <div class="math-perfect-bonus" role="status">
          <span class="math-perfect-bonus__title">Thưởng đúng 100%</span>
          <strong>+${perfectBonus} xu</strong>
          <span>${mathEsc(st.label || mathQuizLabel(st.chapter))}</span>
        </div>` : ''}
      ${wrong.length ? `<h3 class="topic-detail-list-title">Cần xem lại (${wrong.length})</h3>${wrongHTML}` : ''}
      <button class="grammar-next-btn" onclick="renderMathHome()">Xong</button>
    </div>`;
  screen.scrollTop = 0;
}

function mathQuizQuestions() { return _mathQuiz ? _mathQuiz.questions : []; }
function isMathQuizActive() { return !!_mathQuiz; }
function abandonMathQuiz() {
  if (typeof mathBoardCloseForSession === 'function') mathBoardCloseForSession();
  if (typeof mathBoardReset === 'function') mathBoardReset();
  _mathQuiz = null;
  mathLockScreen(false);
}

// SILENT teardown for a profile change. abandonMathQuiz() already drops the
// paper, wipes the scratch pad and puts the bottom bar back — but it is only
// reached from switchScreen's confirm(), which switchUser() does not go
// through. So A's đề thi survived: isMathQuizActive() answered B's every tab
// tap with "Con đang làm dở bài Toán", and the study checkpoint wrote A's
// questions into localStorage under B's name.
//
// The view is reset too, because _mathView is where the tab reopens: B landed
// inside A's Toán 4 / lịch sử / Đấu Toán rather than on the Maths home.
function mathForgetProfile() {
  abandonMathQuiz();
  if (typeof mathTablesForgetProfile === 'function') { try { mathTablesForgetProfile(); } catch (e) {} }
  if (typeof mathTypedReset === 'function') { try { mathTypedReset(); } catch (e) {} }
  _mathHintOpen = false;
  _mathRetryOptions = [];
  _mathRetryPicked = null;
  _mathRetryTyped = false;
  _mathView = 'home';
  _mathSubTab = 'practice';
  _mathHistoryBack = 'toan7';
  _mathHistoryFilter = 'all';
  _mathHistoryType = 'all';
}

// A đề thi is a whole sitting of work that is scored only when it ends, and
// the bottom bar sits under the thumb for all 25 questions. The confirm() in
// switchScreen is a net, not a lock — so the bar goes away while a paper is
// open, exactly as Đấu Toán hides it during a live match. Every exit runs back
// through abandonMathQuiz() or finishMathQuiz(), so the bar can never be left
// hidden with nothing to come back to.
function mathLockScreen(locked) {
  if (typeof document === 'undefined') return;
  const nav = document.getElementById('bottomNav');
  if (nav) nav.style.display = locked ? 'none' : '';
}

function mathQuizAnswered() {
  const st = _mathQuiz;
  return st ? st.answers.filter(a => a !== null).length : 0;
}

// The ✕ on the question card used to bin the round on a single tap — one
// stray touch at question 20 of a paper and the whole sitting was gone, with
// nothing saved and nothing asked. Ask, but only when there is work to lose.
function mathQuizQuit() {
  const st = _mathQuiz;
  if (st) {
    const done = mathQuizAnswered();
    if (done && typeof confirm === 'function') {
      const what = st.examId ? 'bài thi' : 'bài luyện tập';
      if (!confirm(`Con đang làm dở ${what} — đã làm ${done}/${st.questions.length} câu.\n`
        + 'Ra bây giờ thì phần đã làm sẽ mất và KHÔNG được tính điểm.\n\nVẫn ra chứ?')) return;
    }
  }
  abandonMathQuiz();
  renderMathHome();
}

// js/retrydrill.js — six tabs share one implementation, and it defaults to a
// text box because for Word form that IS the lesson: a word guessed right by
// elimination comes back as typing, so the form has to be produced.
//
// A formula is the opposite. Nobody types "xᵐ · xⁿ = xᵐ⁺ⁿ", and the skill
// being drilled is telling the real formula from three plausible fakes. So
// the maths drill re-asks the question exactly as it was first shown: same
// options, same order, chosen not typed.
let _mathRetryOptions = [];
let _mathRetryPicked = null;
let _mathRetryTyped = false;

function mathRetryInputHTML(q) {
  // A typed question comes back typed — re-asking it as a choice would hand
  // the child the answer they failed to produce.
  if (mathIsTyped(q)) {
    mathTypedReset();
    _mathRetryTyped = true;
    return `<div id="mathAnswerSlot">${mathTypedBoxHTML()}</div>
      ${mathKeypadHTML(q)}
      <button class="grammar-next-btn" id="mathSubmitBtn" disabled
              onclick="submitRetryAnswer()">Kiểm tra</button>`;
  }
  _mathRetryTyped = false;
  _mathRetryOptions = q.options || [];
  _mathRetryPicked = null;
  return `<div class="grammar-options">` + _mathRetryOptions.map((opt, i) => `
      <button class="grammar-option" onclick="mathRetryPick(${i})">
        <span class="grammar-option-letter">${'ABCD'[i]}</span>
        <span class="grammar-option-text math-formula">${mathFormula(opt)}</span>
      </button>`).join('') + `</div>`;
}

function mathRetryPick(i) {
  _mathRetryPicked = _mathRetryOptions[i];
  if (typeof submitRetryAnswer === 'function') submitRetryAnswer();
}

if (typeof defineRetryDrill === 'function') defineRetryDrill({
  key: 'math',
  screenId: 'mathHubScreen',
  noun: 'câu',
  resolve: (id) => mathById(id),
  idOf: (q) => q.id,
  answerText: (q) => q.answer,
  inputHTML: (q) => mathRetryInputHTML(q),
  readAnswer: () => _mathRetryTyped ? mathTypedRaw() : _mathRetryPicked,
  valueText: (v) => String(v == null ? '' : v),
  grade: (v, q) => mathIsTyped(q)
    ? mathGrade(q, v)
    : String(v == null ? '' : v).trim() === String(q.answer).trim(),
  // The FIGURE comes too. Stamping ids on the exam banks let those questions
  // into this drill for the first time, and 86 of them say "Cho hình vẽ…" —
  // with the picture dropped they cannot be answered at all, and the owed-drill
  // gate blocks every new maths practice until one of them is. Render the
  // question the way the live quiz does (see renderMathQuestion) rather than a
  // second, thinner copy of it.
  promptHTML: (q) => `<div class="grammar-question-text">${mathFormula(q.q)}</div>`
    + (q.choicePrompt ? `<div class="math4-pre-prompt">${mathFormula(q.choicePrompt)}</div>` : '')
    + (typeof mathQuestionFigureHTML === 'function' ? mathQuestionFigureHTML(q.fig) : ''),
  explainHTML: (q) => `<div class="grammar-review-explain">${mathExplanationHTML(q.explanation, q)}</div>`,
  home: () => renderMathHome(),
});

function mathRetryCount() { return (typeof retryCount === 'function' ? retryCount('math') : 0); }
function startMathRetry() { return (typeof startRetryDrill === 'function' ? startRetryDrill('math') : undefined); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mathBank, mathLtBank, mathChapters, mathLessons, mathById, mathChapterQuestions,
    renderMathHome, switchMathSubTab, openMathLesson,
    startMathQuiz, startMathLtQuiz, answerMathQuestion, nextMathQuestion, finishMathQuiz,
    isMathQuizActive, abandonMathQuiz, mathForgetProfile, mathQuizLabel, mathCurrentQuestion, mathTier, mathEsc, mathFormula, mathRich, mathExplanationHTML,
    mathTypedReset, mathTypedRaw, mathTypedSup, mathKeyPress, mathKey, mathIsTyped, mathIsWritten,
    mathHasAnswerParts, mathAnswerPartsHTML, mathEditAnswerPart, mathAnswerHTML,
    math4FreeEntry, math4Clean, math4AllFilled, math4Values, math4DomValue,
    math4InputHTML, mathPartInput, mathPartSync, MATH4_ANSWER_MAX,
    mathNormalize, mathGrade, mathIsCorrect, mathKeypadHTML, mathTypedBoxHTML,
    submitMathTyped, revealMathWritten, gradeMathWritten, mathQuizQuestions, saveMathSession,
    mathExams, mathExamBest, startMathExam, renderMathExamsHTML,
    mathQuizQuit, mathQuizAnswered, mathLockScreen,
    renderMathHistoryHTML, mathHistoryFiltered, mathHistoryStats, mathHistoryWhen,
    setMathHistoryFilter, setMathHistoryType, renderMathPracticeHTML,
    mathWrongAggregate, mathWrongSkillLabel, mathWrongSkillAggregate,
    renderMathWrongPanelHTML, startMathWrongPractice,
    mathGlossary, mathHintsFor, mathHintHTML, toggleMathHint, MATH_HINT_CHAPTERS,
    openMathSection, renderMathMenuHTML, renderToan7MenuHTML, mathHeaderHTML,
    math4Bank, math4Types, math4Ready, math4History, math7History, math4Best,
    math4PickQuestions, math4PickPreQuestions, math4ChoiceOptions, math4BuildPreQuestion,
    startMath4Mix, startMath4Pre, renderToan4MenuHTML, mathPerfectBonus,
    MATH_QUIZ_SIZE, MATH_TYPED_PER_ROUND, MATH4_QUIZ_SIZE, MATH4_PER_TYPE,
    MATH4_MIX_SET, MATH4_PRE_SET, MATH_COINS_PER_CORRECT,
    MATH4_MIX_PERFECT_BONUS, MATH4_PRE_PERFECT_BONUS,
  };
}
