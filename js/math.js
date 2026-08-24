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
const MATH_TIER_LABELS = { all: 'Tất cả', perfect: '⭐ Hoàn hảo', great: '✅ Tốt', ok: '👍 Khá', weak: '📝 Cần ôn' };

let _mathQuiz = null;          // { chapter, questions:[], idx, answers:[] }
let _mathSubTab = 'practice';  // chỉ có nghĩa bên trong Học kì 1: 'practice' | 'exams' | 'lessons'
let _mathView = 'home';        // 'home' | 'toan7' | 'hk1' | 'history' | 'wars'
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
    const power = /^([−-]?(?:\([^()]*\)|\|[^|]+\||\d+(?:[.,]\d+)?|[A-Za-z]+))\s*(?:mũ|\^)\s*\(([^()]*)\)/i
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

    out += escapeText ? mathEsc(s[i]) : s[i];
    i++;
  }
  return out;
}

function mathFormula(s) {
  return _mathTypeset(s, true);
}

// Explanations carry a deliberately tiny trusted tag set. Typeset only the
// text between those tags so <b>/<br> survive and generated maths spans never
// get parsed a second time.
function mathRich(html) {
  return String(html == null ? '' : html)
    .split(/(<\/?(?:b|br|i|strong|u)\s*\/?\s*>)/i)
    .map(part => /^<\/?(?:b|br|i|strong|u)\s*\/?\s*>$/i.test(part)
      ? part : _mathTypeset(part, false))
    .join('');
}

function mathSolutionSteps(source) {
  return String(source == null ? '' : source)
    .replace(/^\s*🔑\s*/u, '')
    .split(/(?:\.\s+|;\s+|,\s+(?=(?:suy ra|nên|do đó|từ đó|vậy|ta được)\b))/i)
    .map(step => step.trim())
    .filter(Boolean);
}

function mathRuleForQuestion(q) {
  const topic = String(q && q.topic || '');
  const stem = String(q && q.q || '');
  const text = `${topic} ${stem}`.toLowerCase();

  if (/√|căn bậc hai/.test(text))
    return 'Căn bậc hai số học của a ≥ 0 là số không âm có bình phương bằng a. Tính biểu thức dưới dấu căn trước, rồi mới lấy căn.';
  if (/giá trị tuyệt đối|\|[^|]+\|/.test(text))
    return 'Giá trị tuyệt đối là khoảng cách đến 0 nên luôn không âm: số âm đổi thành số đối, số không âm giữ nguyên.';
  if (/lũy thừa|luỹ thừa|mũ|[⁰¹²³⁴⁵⁶⁷⁸⁹ˣⁿᵐ]/.test(text))
    return 'Đưa các lũy thừa về cùng cơ số. Khi nhân thì cộng số mũ, khi chia thì trừ số mũ; hai lũy thừa cùng cơ số bằng nhau thì các số mũ bằng nhau.';
  if (/chuyển vế|tìm x|tìm số.*x/.test(text))
    return 'Muốn tìm x, chuyển hạng tử sang vế kia và đổi dấu, sau đó thực hiện cùng một phép tính hợp lệ trên hai vế.';
  if (/phần trăm|%|giảm giá|tỉ lệ/.test(text))
    return 'Đổi tỉ lệ phần trăm p% thành p/100. Muốn tìm giá trị của một phần, lấy tổng nhân với tỉ lệ tương ứng.';
  if (/số đối/.test(text))
    return 'Số đối của a là −a; hai số đối có tổng bằng 0. Chỉ đổi dấu, không đảo tử và mẫu.';
  if (/số thực|số vô tỉ|thập phân/.test(text))
    return 'Số hữu tỉ viết được dưới dạng phân số và có dạng thập phân hữu hạn hoặc vô hạn tuần hoàn; số vô tỉ có dạng thập phân vô hạn không tuần hoàn.';
  if (/phân số|số hữu tỉ|\d+\s*\/\s*\d+/.test(text))
    return 'Với phân số, quy đồng trước khi cộng hoặc trừ; khi nhân thì nhân tử với tử, mẫu với mẫu; khi chia thì nhân với phân số nghịch đảo.';
  if (/làm tròn/.test(text))
    return 'Giữ chữ số ở hàng cần làm tròn rồi xét chữ số ngay bên phải: từ 5 trở lên thì tăng 1, nhỏ hơn 5 thì giữ nguyên.';
  if (/kề bù/.test(text))
    return 'Hai góc kề bù có tổng số đo bằng 180°, nên góc chưa biết bằng 180° trừ góc đã biết.';
  if (/đối đỉnh/.test(text))
    return 'Hai góc đối đỉnh thì bằng nhau; góc kề với chúng tạo thành một cặp kề bù có tổng 180°.';
  if (/tia phân giác/.test(text))
    return 'Tia phân giác chia một góc thành hai góc bằng nhau, mỗi góc bằng một nửa góc ban đầu.';
  if (/tiên đề euclid/.test(text))
    return 'Qua một điểm nằm ngoài một đường thẳng, chỉ có một đường thẳng song song với đường thẳng đã cho.';
  if (/c-c-c|c-g-c|g-c-g|bằng nhau|cạnh huyền|trường hợp không hợp lệ/.test(text))
    return 'Đối chiếu các cạnh và góc tương ứng theo đúng thứ tự đỉnh, rồi chọn đúng trường hợp bằng nhau của hai tam giác.';
  if (/đường trung trực/.test(text))
    return 'Điểm nằm trên đường trung trực của một đoạn thẳng thì cách đều hai đầu mút; chiều đảo lại cũng đúng.';
  if (/tổng ba góc|tam giác cân|tam giác vuông|góc ngoài/.test(text))
    return 'Tổng ba góc trong một tam giác bằng 180°. Tam giác cân có hai góc ở đáy bằng nhau; tam giác vuông có hai góc nhọn phụ nhau.';
  if (/song song|so le trong|đồng vị|vuông góc/.test(text))
    return 'Xác định đúng vị trí các góc. Với hai đường thẳng song song, góc so le trong và đồng vị bằng nhau, còn hai góc trong cùng phía bù nhau.';
  if (/biểu đồ|dữ liệu|thống kê/.test(text))
    return 'Đọc đúng đại lượng, đơn vị và mốc dữ liệu; sau đó so sánh hoặc tính từ các số liệu đã cho, không suy đoán từ hình thức biểu đồ.';
  if (/định lí|giả thiết|kết luận/.test(text))
    return 'Tách rõ điều đề bài cho là giả thiết và điều cần suy ra là kết luận, rồi đối chiếu đúng nội dung định lí.';
  return 'Đọc lần lượt dữ kiện, xác định quy tắc phù hợp, thực hiện phép biến đổi và kiểm tra kết quả với yêu cầu của đề.';
}

function mathConclusionForQuestion(q) {
  if (!q || q.answer == null || String(q.answer).trim() === '') return '';
  return '<strong>Kết luận:</strong> đáp án đúng là <b>' + String(q.answer).trim() + '</b>.';
}

// Turn every stored explanation into the same worked-solution layout. The
// source banks already separate distractor notes with <br>; the first part,
// however, often contains several calculations in one dense paragraph. This
// presentation splits that reasoning into numbered, vertically spaced steps
// while keeping every original detail and every wrong-answer explanation.
function mathExplanationHTML(source, q) {
  const rows = String(source == null ? '' : source)
    .split(/<br\s*\/?\s*>/i).map(row => row.trim()).filter(Boolean);
  const solution = [];
  const mistakes = [];

  rows.forEach(row => {
    if (/^\s*✗/u.test(row)) mistakes.push(row.replace(/^\s*✗\s*/u, ''));
    else solution.push(...mathSolutionSteps(row));
  });

  const detailedSolution = solution.slice();
  if (q) {
    detailedSolution.unshift('<strong>Quy tắc cần dùng:</strong> ' + mathRuleForQuestion(q));
    const conclusion = mathConclusionForQuestion(q);
    if (conclusion) detailedSolution.push(conclusion);
  }

  const worked = detailedSolution.length ? `
    <section class="math-worked" aria-label="Lời giải từng bước">
      <div class="math-explain-title">Cách giải</div>
      <ol class="math-solution-steps">
        ${detailedSolution.map(step => `<li><div>${mathRich(step)}</div></li>`).join('')}
      </ol>
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

function mathAnswerPartsHTML(q, answer) {
  const finished = Array.isArray(answer);
  const values = finished ? answer : _mathTyped.values;
  const active = Math.min(_mathTyped.part, q.answerParts.length - 1);
  return `<div class="math-answer-parts">` + q.answerParts.map((part, i) => {
    const hasValue = i < values.length;
    const isActive = !finished && i === active;
    const state = finished ? (mathGrade(part, values[i]) ? 'correct' : 'wrong') : (hasValue ? 'filled' : '');
    const box = isActive
      ? `<div id="mathAnswerSlot">${mathTypedBoxHTML()}</div>`
      : mathTypedBoxHTML(hasValue ? values[i] : '', state || 'pending');
    const correction = finished && !mathGrade(part, values[i])
      ? `<div class="math-part-correct">Đáp án: <span class="math-formula">${mathFormula(part.answer)}</span></div>` : '';
    const edit = !finished && hasValue
      ? `<button type="button" class="math-part-edit" onclick="mathEditAnswerPart(${i})">Sửa</button>` : '';
    return `<div class="math-answer-part ${isActive ? 'active' : ''}">
      <div class="math-part-label"><span>${i + 1}</span>${mathEsc(part.label)}</div>
      ${box}${edit}${correction}
    </div>`;
  }).join('') + `</div>`;
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

function mathBank() {
  return (typeof MATH_QUESTIONS !== 'undefined') ? MATH_QUESTIONS : [];
}
// Gói "Ôn tập chương 2&3 · Lũy thừa" (js/math-luythua.js) — nằm ngoài ngân
// hàng 5 chương để các pin đếm câu theo chương không phải đổi theo.
function mathLtBank() {
  return (typeof MATH_LT_QUESTIONS !== 'undefined') ? MATH_LT_QUESTIONS : [];
}
function mathChapters() {
  return (typeof MATH_CHAPTERS !== 'undefined') ? MATH_CHAPTERS : [];
}
function mathLessons() {
  return (typeof MATH_LESSONS !== 'undefined') ? MATH_LESSONS : [];
}
function mathById(id) {
  const practice = mathBank().find(q => q.id === id);
  if (practice) return practice;
  const lt = mathLtBank().find(q => q.id === id);
  if (lt) return lt;
  for (const exam of mathExams()) {
    const found = exam.questions.find(q => q.id === id);
    if (found) return found;
  }
  return null;
}
function mathChapterQuestions(ch) {
  return ch ? mathBank().filter(q => q.ch === ch) : mathBank();
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

function saveMathSession(session) {
  if (typeof appState === 'undefined' || !appState) return;
  const list = mathHistory();
  list.unshift(session);
  if (list.length > MATH_HISTORY_CAP) list.length = MATH_HISTORY_CAP;
  if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    saveUserData(currentUser, appState);
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
    screen.innerHTML = mathHeaderHTML('TOÁN 7', 'Lịch sử làm bài',
      'Mọi lượt luyện tập và đề thi đã nộp.', 'openMathSection(\'toan7\')')
      + `<div class="phrases-wrap">${renderMathHistoryHTML()}</div>`;
    return;
  }
  if (_mathView === 'hk1') {
    const body = _mathSubTab === 'lessons' ? renderMathLessonsHTML()
      : _mathSubTab === 'exams' ? renderMathExamsHTML()
      : renderMathPracticeHTML();
    screen.innerHTML = mathHeaderHTML('TOÁN 7 · HỌC KÌ 1', 'Ôn công thức Toán 7',
      '5 chương trọng tâm — chọn đúng công thức, nhớ lâu hơn học vẹt.', 'openMathSection(\'toan7\')')
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
  const runs = mathHistory().length;
  const wars = (typeof warsHistory === 'function') ? warsHistory().length : 0;
  return mathHeaderHTML('TOÁN', 'Chọn phần muốn học', 'Ôn kiến thức Toán 7, hoặc luyện tính nhẩm.', '')
    + `<div class="phrases-wrap">
      <button class="phrases-cta math-section-cta" onclick="openMathSection('toan7')">
        <span class="phrases-cta-icon">📘</span>
        <span class="phrases-cta-text"><strong>Toán 7</strong><small>Công thức, lý thuyết và đề thi theo học kì${runs ? ` · ${runs} lượt đã làm` : ''}</small></span>
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
  const runs = mathHistory().length;
  const owed = (typeof retryOwedBannerHTML === 'function') ? retryOwedBannerHTML('math') : '';
  return mathHeaderHTML('TOÁN 7', 'Chọn học kì', 'Tập 1 đã có đủ; tập 2 đang được soạn.', 'openMathSection(\'home\')')
    + `<div class="phrases-wrap">
      ${owed}
      <button class="phrases-cta" onclick="openMathSection('hk1')">
        <span class="phrases-cta-icon">①</span>
        <span class="phrases-cta-text"><strong>Học kì 1</strong><small>${mathBank().length} câu · Luyện tập, Lý thuyết, Đề thi</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
      <button class="phrases-cta locked" disabled aria-disabled="true">
        <span class="phrases-cta-icon">②</span>
        <span class="phrases-cta-text"><strong>Học kì 2</strong><small>Sắp có — đang soạn nội dung</small></span>
        <span class="phrases-cta-arrow">🔒</span>
      </button>
      <button class="phrases-cta" onclick="openMathSection('history')">
        <span class="phrases-cta-icon">🕘</span>
        <span class="phrases-cta-text"><strong>Lịch sử làm bài</strong><small>${runs ? `${runs} lượt đã làm · thống kê và câu hay sai` : 'Chưa có lượt nào'}</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
    </div>`;
}

function openMathSection(v) {
    // Same rule inside the Math tab itself: tapping "back" mid-fight is still
    // walking out on the other child.
    if (v !== 'fight' && typeof MathFight !== 'undefined' && MathFight.isFighting && MathFight.isFighting()) {
        if (!confirm('Con đang đấu toán với bạn.\nThoát bây giờ là XỬ THUA và mất tiền cược.\n\nVẫn thoát?')) return;
        if (MathFight.forfeitNow) MathFight.forfeitNow();
    }
  const known = ['home', 'toan7', 'hk1', 'history', 'wars', 'fight'];
  if (v === 'fight' && !mathFightUnlocked()) v = 'home';
  _mathView = (known.indexOf(v) === -1) ? 'home' : v;
  // Leaving Math Wars must stop its clock, or it keeps ticking behind a screen
  // the child has walked away from and "finishes" a round they are not in.
  if (_mathView !== 'wars' && typeof abandonWars === 'function' && typeof isWarsActive === 'function'
      && isWarsActive()) abandonWars();
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
  _mathView = 'hk1';
  renderMathHome();
}

// ---- practice view ----
function renderMathPracticeHTML() {
  const bank = mathBank();
  const owed = (typeof retryOwedBannerHTML === 'function') ? retryOwedBannerHTML('math') : '';

  // Gói lũy thừa + căn đứng ngay dưới "Ôn tổng hợp": một lượt = trọn bộ câu.
  const ltBank = mathLtBank();
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
      <p class="phrases-sub">Mỗi lượt <b>${MATH_QUIZ_SIZE} câu</b> trắc nghiệm: chọn công thức ĐÚNG trong 4 lựa chọn. ${bank.length} câu trên tất cả 5 chương.</p>
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
function mathExams() {
  const source = (typeof MATH_SOURCE_EXAMS !== 'undefined' && Array.isArray(MATH_SOURCE_EXAMS))
    ? MATH_SOURCE_EXAMS : [];
  const practice = (typeof MATH_EXAMS !== 'undefined' && Array.isArray(MATH_EXAMS))
    ? MATH_EXAMS : [];
  return practice.concat(source);
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
      <h1>Đề thi thử học kì 1</h1>
      <p class="phrases-sub"><b>HK1 1–5</b> được chép từ đề trường năm 2025–2026, giữ nguyên thứ tự câu và hình. Không giới hạn thời gian; dùng nút ✏️ khi cần nháp nhé!</p>
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
  renderMathQuestion();
}

// ---- lịch sử view ----
// A run is either practice (chapter rounds / mixed) or an exam (has examId).
// The page answers a parent's three questions at a glance — how much, how
// well, best ever — then lets the child drill into the list two ways at once:
// by kind (Luyện tập / Đề thi) and by result tier.
function mathHistoryFiltered() {
  return mathHistory().filter(h => {
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
    const key = 'math7.' + mathAnalyticsSlug(label);
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
      body = `<div class="math-written-help math-board-prompt">
          <button type="button" class="math-open-board" onclick="openMathBoard()">✏️ Mở bảng nháp</button>
          <span>${mathEsc(q.workNote || 'Làm bài trên bảng nháp, rồi nhập từng kết quả cuối cùng.')}</span>
        </div>`
        + mathAnswerPartsHTML(q, answered ? ans : null)
        + (answered ? '' : `${mathKeypadHTML(q)}
          <button class="grammar-next-btn" id="mathSubmitBtn" ${_mathTyped.raw ? '' : 'disabled'}
                  onclick="submitMathTyped()">${_mathTyped.part + 1 < q.answerParts.length ? 'Lưu kết quả này →' : 'Kiểm tra tất cả'}</button>`);
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
        <button class="grammar-back-btn" onclick="abandonMathQuiz(); renderMathHome()">✕</button>
        <span class="grammar-quiz-progress">${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${(st.idx) / total * 100}%"></div></div>
        <button class="math-board-fab" type="button" title="Bảng nháp" onclick="openMathBoard()">✏️</button>
      </div>
      <div class="phrases-cat-row math-topic-badge">${mathEsc(q.topic || mathQuizLabel(st.chapter))}</div>
      <div class="grammar-question-text">${mathFormula(q.q)}</div>
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

function finishMathQuiz() {
  if (typeof mathBoardCloseForSession === 'function') mathBoardCloseForSession();
  if (typeof mathBoardReset === 'function') mathBoardReset();
  const st = _mathQuiz;
  const screen = document.getElementById('mathHubScreen');
  if (!st || !screen) return;
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
  const coinsEarned = score * MATH_COINS_PER_CORRECT
    + (typeof petComboBonus === 'function' ? petComboBonus() : 0);
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
    score: score, total: total,
    // Which questions were missed, not just how many — that is what makes a
    // "câu hay sai" list possible at all.
    wrong: wrong.map(x => x.q.id),
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
      <div class="grammar-review-q">${mathEsc(x.q.q)}</div>
      <div class="grammar-review-a">✅ <b class="math-formula">${mathFormula(x.q.answer)}</b></div>
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
  promptHTML: (q) => `<div class="grammar-question-text">${mathFormula(q.q)}</div>`,
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
    isMathQuizActive, abandonMathQuiz, mathQuizLabel, mathCurrentQuestion, mathTier, mathEsc, mathFormula, mathRich, mathExplanationHTML,
    mathTypedReset, mathTypedRaw, mathTypedSup, mathKeyPress, mathKey, mathIsTyped, mathIsWritten,
    mathHasAnswerParts, mathAnswerPartsHTML, mathEditAnswerPart,
    mathNormalize, mathGrade, mathIsCorrect, mathKeypadHTML, mathTypedBoxHTML,
    submitMathTyped, revealMathWritten, gradeMathWritten, mathQuizQuestions,
    mathExams, mathExamBest, startMathExam, renderMathExamsHTML,
    renderMathHistoryHTML, mathHistoryFiltered, mathHistoryStats, mathHistoryWhen,
    setMathHistoryFilter, setMathHistoryType, renderMathPracticeHTML,
    mathWrongAggregate, mathWrongSkillLabel, mathWrongSkillAggregate,
    renderMathWrongPanelHTML, startMathWrongPractice,
    mathGlossary, mathHintsFor, mathHintHTML, toggleMathHint, MATH_HINT_CHAPTERS,
    openMathSection, renderMathMenuHTML, renderToan7MenuHTML, mathHeaderHTML,
    MATH_QUIZ_SIZE, MATH_TYPED_PER_ROUND,
  };
}
