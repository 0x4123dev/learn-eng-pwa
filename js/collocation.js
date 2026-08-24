// collocation.js — 🧩 Collocation practice (PTNK chuyên Anh style), a
// sub-tab of the Phrases screen. Five original question formats mirror the
// PTNK paper: double-blank pair MCQ, single-blank MCQ, typed with first
// letter shown, open one-word cloze, and key-word transformation.
// Data lives in js/collocation-data.js (COLLOCATION_QUESTIONS).

let _colQuiz = null;   // { questions:[], idx, answers:[] }

const COLLOC_TYPE_META = {
  pair: { icon: '🧩', label: 'Double blank · chọn cặp từ' },
  mcq: { icon: '🔤', label: 'Collocation · chọn từ đúng' },
  letter: { icon: '✏️', label: 'Gõ từ (cho chữ cái đầu)' },
  open: { icon: '💭', label: 'Gõ 1 từ (open cloze)' },
  transform: { icon: '🔁', label: 'Viết lại câu (key word)' },
};

function collocBank() {
  return (typeof COLLOCATION_QUESTIONS !== 'undefined') ? COLLOCATION_QUESTIONS : [];
}

function colEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Explanations are trusted build-time HTML restricted to <br> and <b>
// (enforced by scripts/build-collocation.js + tests) — rendered raw.

// ---- lenient grading (shared idea with Rewrite: case/space/punct-insensitive,
// apostrophes optional so "she's" ≡ "shes" ≡ "she is" via accept variants) ----
function _colNorm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/'/g, '')
    .replace(/[.,!?;:"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function _colAnswerCorrect(input, q) {
  const u = _colNorm(input);
  if (!u) return false;
  const targets = [q.answer].concat(q.accept || []);
  return targets.some(t => _colNorm(t) === u);
}

// First-letter hint for "letter" questions: "c_______" style.
function _colLetterHint(answer) {
  const w = String(answer || '');
  if (!w) return '';
  return w[0] + ' _'.repeat(Math.max(0, w.length - 1));
}

function collocHistoryList() {
  return ((typeof appState !== 'undefined' && appState && appState.collocHistory) || []);
}

// What to say when the answer is revealed.
//
// "___ an effort" is answered with "make", but the lesson is "make an effort";
// the word alone teaches nothing. Collocation questions carry no phrase field,
// so the English collocation is taken from the head of the vi gloss —
// "make an effort — nỗ lực, cố gắng" — everything before the dash.
//
// Two cases the naive read gets wrong:
//   • 25 glosses are pure Vietnamese with no English head. Speaking those
//     would point an English voice at Vietnamese text, so they fall back to
//     the answer itself.
//   • A pair question fills two gaps but its gloss documents only the first,
//     so any answer half the collocation does not already contain is appended
//     and spoken after it.
const COL_VN_CHARS = /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

function collocSpokenPhrase(q) {
  if (!q) return '';
  const answer = String(q.answer || '');
  const head = String(q.vi || '').split(/\s[—–-]\s/)[0].trim();
  if (!head || COL_VN_CHARS.test(head) || !/[a-z]/i.test(head)) return answer;

  const lower = head.toLowerCase();
  const extra = answer.split('/').map(s => s.trim()).filter(Boolean)
    .filter(p => !lower.includes(p.toLowerCase()));
  return extra.length ? head + '/ ' + extra.join('/ ') : head;
}

// ---- follow-up: proving the collocation was understood, not guessed ----
// Picking "conclusive/ resign" out of four is a 1-in-4 shot, and the child who
// guessed right looks exactly like the child who knew. So every question is
// followed by ONE screen carrying TWO questions about the answer just given:
// what the collocation MEANS, and WHY those words go together — four usage
// claims, of which exactly one is true.
//
// Options live in js/collocation-followups.js, keyed by question id. Built the
// same way as the Word form checks (js/wordform-followups.js).
const COL_FOLLOW_PARTS = ['m', 'r'];
const COL_FOLLOW_TITLES = { m: 'Nghĩa của cụm từ', r: 'Vì sao đáp án đúng là vậy?' };

// The collocation being taught. The bank documents it at the head of `vi`
// ("make an effort — nỗ lực, cố gắng"); 25 glosses are pure Vietnamese and
// fall back to the answer, exactly as collocSpokenPhrase does.
function collocPhrase(q) {
  if (!q) return '';
  const head = String(q.vi || '').split(/\s[—–-]\s/)[0].trim();
  if (!head || COL_VN_CHARS.test(head) || !/[a-z]/i.test(head)) return String(q.answer || '');
  return head;
}

// The sentence with its blank(s) filled in — what the child should have
// written. A pair question has two gaps and an answer of "first/ second";
// a transform question's gap is in `frame`, not in `q`.
function collocFilledParts(q) {
  const src = (q.type === 'transform') ? String(q.frame || q.q || '') : String(q.q || '');
  return { src, fills: String(q.answer || '').split('/').map(s => s.trim()).filter(Boolean) };
}

function collocFollowupQuestion(base) {
  if (!base || typeof COLLOCATION_FOLLOWUPS === 'undefined') return null;
  const f = COLLOCATION_FOLLOWUPS[base.id];
  if (!f) return null;
  const ok = (b) => b && Array.isArray(b.o) && b.o.length === 4 &&
                    typeof b.c === 'number' && b.c >= 0 && b.c < 4;
  if (!ok(f.m) || !ok(f.r)) return null;
  const phrase = collocPhrase(base);
  return {
    id: 'colu-' + base.id,
    baseId: base.id,
    followup: true,
    type: base.type,
    phrase,
    answer: base.answer,
    vi: base.vi,
    explanation: base.explanation,
    m: { q: 'What is the meaning of "' + phrase + '"?', options: f.m.o, correct: f.m.c },
    r: { q: 'Vì sao đáp án đúng là "' + base.answer + '"?', options: f.r.o, correct: f.r.c },
  };
}

// [question, check, question, check, …]. A question with no follow-up data is
// left on its own rather than dropped: a gap costs the check, not the question.
function colExpandFollowups(qs) {
  const out = [];
  qs.forEach(q => {
    out.push(q);
    const f = collocFollowupQuestion(q);
    if (f) out.push(f);
  });
  return out;
}

function colFollowScore(q, ans) {
  let score = 0;
  COL_FOLLOW_PARTS.forEach(k => { if (ans && ans[k] === q[k].correct) score++; });
  return score;
}
function colFollowDone(ans) {
  return !!ans && COL_FOLLOW_PARTS.every(k => ans[k] !== null && ans[k] !== undefined);
}

function collocSkillSummaries(st) {
  const rows = {};
  const add = (key, label, ok, ref) => {
    const row = rows[key] || (rows[key] = { skillKey:key, skillLabel:label, attempts:0, correct:0, wrong:0, skipped:0, wrongRefs:[] });
    row.attempts++;
    if (ok === null) row.skipped++;
    else if (ok) row.correct++;
    else { row.wrong++; if (row.wrongRefs.length < 20) row.wrongRefs.push(String(ref || '')); }
  };
  st.questions.forEach((q, i) => {
    const answer = st.answers[i];
    if (q.followup) {
      add('collocation.understanding.meaning', 'Hiểu nghĩa collocation',
        answer && answer.m !== null && answer.m !== undefined ? answer.m === q.m.correct : null, q.baseId);
      add('collocation.understanding.reason', 'Hiểu lý do chọn đáp án',
        answer && answer.r !== null && answer.r !== undefined ? answer.r === q.r.correct : null, q.baseId);
      return;
    }
    const meta = COLLOC_TYPE_META[q.type] || { label:'Collocation tổng hợp' };
    const answered = answer && (answer.choice !== undefined || String(answer.value || '').trim());
    add('collocation.form.' + (q.type || 'general'), meta.label,
      answered ? !!answer.isCorrect : null, q.id);
  });
  return Object.keys(rows).map(k => rows[k]);
}

// ---- home view (returned as HTML string; phrases.js injects it) ----
function renderCollocHome() {
  const bank = collocBank();
  const counts = {};
  bank.forEach(q => { counts[q.type] = (counts[q.type] || 0) + 1; });
  const typeRows = Object.keys(COLLOC_TYPE_META).map(t =>
    `<div class="phrases-cat-row"><span>${COLLOC_TYPE_META[t].icon} ${COLLOC_TYPE_META[t].label}</span><strong>${counts[t] || 0}</strong></div>`
  ).join('');

  const hist = collocHistoryList();
  let best = 0;
  hist.forEach(h => { if (h.total) best = Math.max(best, Math.round(h.score / h.total * 100)); });
  const histRows = hist.slice(0, 8).map(h => {
    const pct = h.total ? Math.round(h.score / h.total * 100) : 0;
    let when = '';
    try { when = new Date(h.date).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    return `<div class="phrases-cat-row"><span>${pct === 100 ? '⭐' : pct >= 60 ? '✅' : '📝'} ${h.score}/${h.total} · ${pct}%</span><strong>${when}</strong></div>`;
  }).join('');

  return `
      <div class="phrases-hero">
        <div class="phrases-hero-icon">🧩</div>
        <h1>Collocation</h1>
        <p class="phrases-sub">Luyện collocation kiểu đề chuyên Anh PTNK — ${bank.length} câu gồm 5 dạng: cặp từ đôi, trắc nghiệm, gõ từ, open cloze và viết lại câu.${best ? ` Best: <b>${best}%</b>` : ''}</p>
      </div>

      <button class="phrases-cta" onclick="startCollocPractice(20)">
        <span class="phrases-cta-icon">🧩</span>
        <span class="phrases-cta-text"><strong>Practice</strong><small>20 câu ngẫu nhiên, trộn 5 dạng</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>

      <button class="phrases-cta" onclick="startCollocPractice(10)">
        <span class="phrases-cta-icon">⚡</span>
        <span class="phrases-cta-text"><strong>Quick</strong><small>10 câu ngẫu nhiên</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>

      <details class="phrases-cats-wrap">
        <summary>📖 Lý thuyết: 5 loại collocation trong đề chuyên</summary>
        <div class="colloc-lesson">${collocLessonHTML()}</div>
      </details>

      <details class="phrases-cats-wrap">
        <summary>Question types</summary>
        <div class="phrases-cats">${typeRows}</div>
      </details>

      ${histRows ? `<details class="phrases-cats-wrap" open><summary>Recent results</summary><div class="phrases-cats">${histRows}</div></details>` : ''}`;
}

function collocLessonHTML() {
  return `
    <div class="colloc-lesson-item"><b>1. Verb + Noun</b> — động từ "bắt cặp" cố định với danh từ: <b>make</b> a decision (KHÔNG dùng do), <b>draw</b> a conclusion, <b>keep</b> a low profile, <b>raise</b> awareness. Mẹo: học theo động từ gốc (make/do/take/have/pay/catch…).</div>
    <div class="colloc-lesson-item"><b>2. Adjective + Noun</b> — tính từ đi riêng với danh từ: <b>heavy</b> rain (không dùng strong), <b>conclusive</b> proof, <b>sheer</b> luck, <b>vivid</b> imagination. Đề PTNK hay cho dạng 2 chỗ trống: cả cặp phải cùng đúng.</div>
    <div class="colloc-lesson-item"><b>3. Phrasal verbs</b> — động từ + tiểu từ đổi nghĩa hoàn toàn: come up with (nghĩ ra), put up with (chịu đựng), turn down (từ chối), fall through (đổ bể). Học theo NGHĨA, không dịch từng từ.</div>
    <div class="colloc-lesson-item"><b>4. Verb/Adj + Preposition</b> — giới từ cố định: rely <b>on</b>, accuse sb <b>of</b>, capable <b>of</b>, fed up <b>with</b>, immune <b>to</b>. Dạng open cloze (gõ 1 từ) trong đề thi gần như luôn có vài câu giới từ.</div>
    <div class="colloc-lesson-item"><b>5. Fixed phrases &amp; idioms</b> — cụm cố định không đổi được từ nào: make ends meet, out of the question, taken aback, come to terms with, part and parcel. Dạng viết lại câu (key word transformation) lấy điểm ở đây.</div>
    <div class="colloc-lesson-item">🎯 <b>Chiến thuật PTNK:</b> với câu 2 chỗ trống, thử từng đáp án vào CẢ HAI chỗ — chỉ cần 1 chỗ sai là loại cả cặp. Với viết lại câu: giữ nguyên key word, đếm 3–8 từ.</div>`;
}

// ---- practice flow ----
// A collocation question is typed when it has no options: letter, open and
// transform (200 of the 500). pair and mcq are chosen from four.
//
// Left to chance the mix swung widely, so a practice is BUILT to a fixed
// ratio instead: 1 typed in 10, 2 in 20.
const COL_TYPED_SHARE = 0.1;
const colIsTyped = (q) => !(q && Array.isArray(q.options) && q.options.length);

// How many of an n-question practice must be typed. Never more than the bank
// holds, and — once there is room — never zero. The availableTyped > 0 guard
// matters: without it an empty typed pool still demanded one, the slice
// returned nothing, and the practice came up a question SHORT.
function colTypedTarget(n, availableTyped) {
  const want = Math.round(n * COL_TYPED_SHARE);
  const floor = (n >= 2 && availableTyped > 0) ? 1 : 0;
  return Math.max(floor, Math.min(want, availableTyped, n));
}

function _colShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startCollocPractice(n) {
  if (typeof retryGate === 'function' && retryGate('col')) return;
  const bank = collocBank();
  if (!bank.length) return;
  const size = Math.min(n || 20, bank.length);
  const typed = bank.filter(colIsTyped);
  const choice = bank.filter(q => !colIsTyped(q));
  const wantTyped = colTypedTarget(size, typed.length);
  // Drawn from each pool separately — that is what makes the count exact —
  // then shuffled together so the typing is not bunched at the end.
  // Each question drags its understanding check along right behind it. The
  // practice button still promises the number of COLLOCATION questions — that
  // is what a child counts — so the size above is left alone.
  const questions = colExpandFollowups(_colShuffle(
    _colShuffle(typed).slice(0, wantTyped)
      .concat(_colShuffle(choice).slice(0, size - wantTyped))
  ));
  _colQuiz = { questions, idx: 0, answers: new Array(questions.length).fill(null) };
  renderCollocQuestion();
}

function abandonCollocPractice() { _colQuiz = null; }
function isCollocActive() { return !!_colQuiz; }

// The header is identical on both kinds of screen, so it is written once.
function colQuizHeaderHTML(st) {
  const total = st.questions.length;
  return `
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="abandonCollocPractice(); renderPhrasesHome()">✕</button>
        <span class="grammar-quiz-progress">🧩 ${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${Math.round(st.idx / total * 100)}%"></div></div>
      </div>`;
}

// The check asks about a sentence that has already scrolled away, so it comes
// back with its blank(s) filled — next to what the child actually wrote.
function collocFollowRecapHTML(st, q) {
  const base = st.questions[st.idx - 1];
  if (!base || base.id !== q.baseId) return '';
  const wrap = (s) => (typeof tapwordsWrap === 'function') ? tapwordsWrap(s) : colEsc(s);
  const { src, fills } = collocFilledParts(base);
  let at = 0;
  const sentence = wrap(src).replace(/_{2,}/g,
    () => `<b class="col-recap-answer">${colEsc(fills[at++] || '')}</b>`);

  const ans = st.answers[st.idx - 1];
  let line = '';
  if (ans) {
    const given = String(ans.value || '');
    line = ans.isCorrect
      ? `<div class="wf-recap-you ok">✅&nbsp;Bé trả lời đúng: <b>${colEsc(q.answer)}</b></div>`
      : `<div class="wf-recap-you bad">❌&nbsp;Bé trả lời: <s>${given ? colEsc(given) : '(bỏ trống)'}</s> · Đúng: <b>${colEsc(q.answer)}</b></div>`;
  }
  return `
      <div class="wf-follow-recap">
        <div class="wf-recap-label">Câu vừa rồi</div>
        <div class="wf-recap-q">${sentence}</div>
        ${line}
      </div>`;
}

// One screen, two questions — the second withheld until the first is answered.
// Eight options at once is a wall to a nine-year-old, and side by side each
// question hints at the other.
function renderCollocFollowup() {
  const screen = document.getElementById('phrasesScreen');
  const st = _colQuiz;
  if (!screen || !st) return;
  const q = st.questions[st.idx];
  const ans = st.answers[st.idx] || { m: null, r: null };
  const total = st.questions.length;
  if (typeof twPrefetch === 'function') twPrefetch(q.phrase, [], q.explanation, q.answer);
  const done = colFollowDone(ans);

  const block = (key, stepNo) => {
    const part = q[key];
    const picked = ans[key];
    const shown = picked !== null && picked !== undefined;
    const opts = part.options.map((opt, i) => {
      let cls = 'grammar-option';
      if (shown) {
        if (i === part.correct) cls += ' correct';
        else if (i === picked) cls += ' wrong';
      }
      return `<button class="${cls}" onclick="answerCollocFollowup('${key}',${i})">
        <span class="grammar-option-letter">${String.fromCharCode(65 + i)}</span>
        <span class="grammar-option-text">${colEsc(opt)}</span>
      </button>`;
    }).join('');

    let note = '';
    if (shown) {
      const ok = picked === part.correct;
      // The meaning check explains itself; the reason check hands back the
      // bank's own 🔑 note, which is richer than any option can be.
      //
      // `vi` normally already reads "a matter of time — chỉ là vấn đề thời
      // gian", so restating the phrase in front of it printed the collocation
      // twice in one line.
      const viHead = String(q.vi || '').toLowerCase().indexOf(String(q.phrase).toLowerCase()) === 0;
      const body = key !== 'm'
        ? q.explanation
        : (viHead
            ? `<b>${colEsc(q.phrase)}</b>${colEsc(q.vi.slice(q.phrase.length))}`
            : `<b>${colEsc(q.phrase)}</b> = ${colEsc(part.options[part.correct])}. ${colEsc(q.vi)}`);
      note = `<div class="grammar-explanation ${ok ? 'correct' : 'wrong'}">
        <div>${ok ? '✅&nbsp;' : `❌ Đáp án đúng: <b>${String.fromCharCode(65 + part.correct)}</b>. `}${body}</div>
      </div>`;
    }
    return `
      <div class="wf-follow-block${shown ? ' answered' : ''}">
        <div class="wf-follow-step"><span class="wf-follow-step-no">${stepNo}</span>${COL_FOLLOW_TITLES[key]}</div>
        <div class="wf-follow-q">${colEsc(part.q)}</div>
        <div class="grammar-options">${opts}</div>
        ${note}
      </div>`;
  };

  const step2 = (ans.m === null || ans.m === undefined)
    ? `<div class="wf-follow-locked">🔒 Trả lời câu 1 để mở câu 2</div>`
    : block('r', '2');

  screen.innerHTML = `
    <div class="phrases-wrap">
      ${colQuizHeaderHTML(st)}
      <div class="grammar-question-card wf-follow-card">
        <div class="grammar-question-tag wf-follow-tag">🧠 Hiểu đáp án · ${colEsc(q.phrase)}</div>
        ${collocFollowRecapHTML(st, q)}
        ${block('m', '1')}
        ${step2}
        ${done ? `<button class="grammar-next-btn" onclick="nextCollocQuestion()">${st.idx + 1 < total ? 'Next →' : 'See results'}</button>` : ''}
      </div>
    </div>`;
}

function answerCollocFollowup(key, i) {
  const st = _colQuiz;
  if (!st) return;
  const q = st.questions[st.idx];
  if (!q || !q.followup || COL_FOLLOW_PARTS.indexOf(key) === -1) return;
  if (st.answers[st.idx] === null) st.answers[st.idx] = { m: null, r: null };
  const ans = st.answers[st.idx];
  if (ans[key] !== null && ans[key] !== undefined) return;     // the first answer stands
  // Step 2 is not on screen until step 1 is answered; a queued tap must not
  // walk past that either.
  if (key === 'r' && (ans.m === null || ans.m === undefined)) return;
  ans[key] = i;
  if (typeof petCheerAnswer === 'function') petCheerAnswer(i === q[key].correct);
  renderCollocFollowup();
}

function renderCollocQuestion() {
  const screen = document.getElementById('phrasesScreen');
  const st = _colQuiz;
  if (!screen || !st) return;
  const q = st.questions[st.idx];
  if (q && q.followup) { renderCollocFollowup(); return; }
  // Warm this question's words now: they become tappable once answered.
  if (typeof twPrefetch === 'function') twPrefetch(q.q, q.options || [], q.explanation, q.answer);
  const ans = st.answers[st.idx];
  const answered = ans !== null;
  const total = st.questions.length;
  // Speak the correct answer once, the moment it is revealed. Pair answers
  // ("conclusive/ resign") are spoken as their two words, in order.
  if (answered && st._spokenIdx !== st.idx) {
    st._spokenIdx = st.idx;
    if (typeof speakAnswer === 'function') speakAnswer(collocSpokenPhrase(q), { auto: true });
  }
  const meta = COLLOC_TYPE_META[q.type] || COLLOC_TYPE_META.mcq;
  const isMcq = q.type === 'pair' || q.type === 'mcq';

  // After answering, every English word becomes tappable (voice + nghĩa).
  const wrap = (s) => (answered && typeof tapwordsWrap === 'function') ? tapwordsWrap(s) : colEsc(s);

  let qHtml = wrap(q.q).replace(/___/g, '<span class="phrases-blank">_____</span>');
  let body = '';

  if (isMcq) {
    const opts = q.options.map((opt, i) => {
      let cls = 'grammar-option';
      if (answered) {
        if (i === q.correct) cls += ' correct';
        else if (i === ans.choice) cls += ' wrong';
      }
      // No disabled attr: it would swallow taps on the words inside;
      // answerCollocChoice ignores repeat answers itself.
      return `<button class="${cls}" onclick="answerCollocChoice(${i})">
        <span class="grammar-option-letter">${String.fromCharCode(65 + i)}</span>
        <span class="grammar-option-text">${wrap(opt)}</span>
      </button>`;
    }).join('');
    body = `<div class="grammar-options">${opts}</div>`;
  } else {
    if (q.type === 'letter') {
      qHtml += `<div class="colloc-hint">Gợi ý: <b>${colEsc(_colLetterHint(q.answer))}</b></div>`;
    }
    if (q.type === 'transform') {
      qHtml = `<div class="colloc-transform-src">${wrap(q.q)}</div>
        <div class="colloc-keyword">Key word: <b>${colEsc(q.keyword || '')}</b> (giữ nguyên, 3–8 từ)</div>
        <div class="colloc-frame">${wrap(q.frame || '').replace(/___/g, '<span class="phrases-blank">_____</span>')}</div>`;
    }
    if (!answered) {
      body = `<div class="wf-text-wrap">
        <input type="text" id="colTextInput" class="wf-text-input" autofocus enterkeyhint="go"
               placeholder="${q.type === 'transform' ? 'Gõ phần còn thiếu…' : 'Gõ 1 từ…'}"
               autocomplete="off" autocapitalize="off" spellcheck="false"
               onkeydown="if(event.key==='Enter'){event.preventDefault();submitCollocText();}">
        <button class="wf-text-submit" onclick="submitCollocText()">Check</button>
      </div>`;
    } else {
      body = `<div class="wf-text-answer ${ans.isCorrect ? 'correct' : 'wrong'}">
        <span class="wf-text-answer-label">Your answer:</span>
        <span class="wf-text-answer-value">${ans.value ? colEsc(ans.value) : '<em>(blank)</em>'}</span>
      </div>`;
    }
  }

  let explain = '';
  if (answered) {
    explain = `<div class="grammar-explanation ${ans.isCorrect ? 'correct' : 'wrong'}">
      <div class="phrases-vi">📘 ${colEsc(q.vi)}</div>
      ${ans.isCorrect ? '' : `<div class="colloc-correct-answer">❌ Đáp án đúng: <b>${wrap(q.answer)}</b></div>`}
      <div>${q.explanation}</div>
    </div>
    ${answerGateHTML(collocSpokenPhrase(q), 'nextCollocQuestion()', st.idx + 1 < total ? 'Next →' : 'See results')}`;
  }

  screen.innerHTML = `
    <div class="phrases-wrap">
      ${colQuizHeaderHTML(st)}
      <div class="grammar-question-card">
        <div class="grammar-question-tag">${meta.icon} ${meta.label}</div>
        <div class="grammar-question-text">${qHtml}</div>
        ${body}
        ${explain}
      </div>
    </div>`;

  if (!answered && !isMcq) {
    const inp = document.getElementById('colTextInput');
    if (inp) { try { inp.focus(); } catch (e) {} }  // synchronous: keeps the tap gesture so the mobile keyboard opens
  }
}

function answerCollocChoice(i) {
  const st = _colQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  // A check screen has no options of its own — its taps go through
  // answerCollocFollowup. Without this guard a stale node or a queued tap
  // reads q.options[i] of undefined, and the answer it writes would overwrite
  // the check's own two-part answer.
  if (!q || q.followup || !Array.isArray(q.options)) return;
  st.answers[st.idx] = { choice: i, value: q.options[i], isCorrect: i === q.correct };
  if (typeof petCheerAnswer === 'function') petCheerAnswer(i === q.correct);
  renderCollocQuestion();
}

function submitCollocText() {
  const st = _colQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  if (!q || q.followup) return;                 // see answerCollocChoice
  const inp = document.getElementById('colTextInput');
  const raw = inp ? inp.value : '';
  st.answers[st.idx] = { value: raw.trim(), isCorrect: _colAnswerCorrect(raw, q) };
  if (typeof petCheerAnswer === 'function') petCheerAnswer(st.answers[st.idx].isCorrect);
  renderCollocQuestion();
}

function nextCollocQuestion() {
  const st = _colQuiz;
  if (!st) return;
  if (st.idx + 1 < st.questions.length) { st.idx++; renderCollocQuestion(); }
  else finishCollocPractice();
}

// The score alone cannot separate a child who knows the collocations from one
// whose guesses landed, so the result screen reports the two checks separately.
function colUnderstandCardHTML(fu) {
  if (!fu || !fu.count) return '';
  const row = (icon, label, got) => {
    const pct = Math.round((got / fu.count) * 100);
    return `<div class="wf-understand-row">
      <span class="wf-understand-label">${icon} ${label}</span>
      <span class="wf-understand-bar"><i style="width:${pct}%"></i></span>
      <b class="wf-understand-num">${got}/${fu.count}</b>
    </div>`;
  };
  return `
    <div class="wf-understand-card">
      <div class="wf-understand-title">🧠 Hiểu bài</div>
      ${row('💡', 'Nghĩa của cụm từ', fu.m)}
      ${row('📐', 'Lý do đáp án đúng', fu.r)}
    </div>`;
}

function finishCollocPractice() {
  const st = _colQuiz;
  if (!st) return;
  // A check screen is worth TWO points, so the denominator counts points, not
  // screens: 20 collocations plus their two checks each is 60. Reporting 20/40
  // for a practice the child answered 60 things in would read as a bug, and
  // would make the percentage wrong.
  let total = 0;
  let score = 0;
  const wrong = [];
  const fu = { count: 0, m: 0, r: 0 };
  let baseCount = 0;
  st.questions.forEach((q, i) => {
    const a = st.answers[i];
    if (q.followup) {
      total += COL_FOLLOW_PARTS.length;
      score += colFollowScore(q, a);
      fu.count++;
      COL_FOLLOW_PARTS.forEach(k => { if (a && a[k] === q[k].correct) fu[k]++; });
      return;
    }
    baseCount++;
    total++;
    if (a && a.isCorrect) score++;
    else wrong.push(q);
  });
  const pct = total ? Math.round(score / total * 100) : 0;
  // "Perfect! 🎉" over a missed check would be a lie the child can see: the
  // card right above it says 0/1.
  const checksMissed = COL_FOLLOW_PARTS.length * fu.count - fu.m - fu.r;

  // Shared systems: coins, streak, history, server sync (see feature-sync tests).
  const coinsEarned = score * 5 + (typeof petComboBonus === 'function' ? petComboBonus() : 0);
  if (typeof appState !== 'undefined' && appState) {
    appState.coins = (appState.coins || 0) + coinsEarned;
    if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }
    if (!Array.isArray(appState.collocHistory)) appState.collocHistory = [];
    let date = 0;
    try { date = Date.now(); } catch (e) {}
    appState.collocHistory.unshift({ score, total, date, fu, skills: collocSkillSummaries(st) });
    if (appState.collocHistory.length > 300) appState.collocHistory.length = 300;
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
      try { saveUserData(currentUser, appState); } catch (e) {}
    }
    // Owe every missed question back (after the coins are banked, so a
    // mistake never feels like it took away what was just earned).
    if (wrong.length && typeof retryAdd === 'function') retryAdd('col', wrong);
  }
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

  const twrap = (s) => (typeof tapwordsWrap === 'function') ? tapwordsWrap(s) : colEsc(s);
  const reviewHtml = wrong.map(q => `
      <div class="grammar-review-item wrong">
        <div class="grammar-review-q">${twrap(q.q)}</div>
        <div class="grammar-review-a">✅ <b>${twrap(q.answer)}</b> — ${colEsc(q.vi)}</div>
      </div>`).join('');

  const screen = document.getElementById('phrasesScreen');
  if (screen) {
    screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderPhrasesHome()">‹</button>
        <span class="grammar-quiz-progress">${pct === 100 ? '⭐' : pct >= 60 ? '✅' : '📝'} Collocation · ${score}/${total} (${pct}%)</span>
      </div>
      ${typeof rewardCelebrationHTML === 'function'
        ? rewardCelebrationHTML(score, total, coinsEarned)
        : `<div class="unit-reward-card"><div class="unit-reward-coins">+${coinsEarned} 🪙</div></div>`}
      ${colUnderstandCardHTML(fu)}
      <div class="phrases-section-title">${wrong.length ? 'Câu cần xem lại · ' + wrong.length
        : (checksMissed ? 'Các câu collocation đều đúng 👍' : 'Perfect! 🎉')}</div>
      ${reviewHtml}
      <button class="phrases-cta-secondary phrases-review-btn" onclick="startCollocPractice(${baseCount})">🔁 Practice again</button>
    </div>`;
  }
  if (typeof fireRewardCelebration === 'function') fireRewardCelebration(coinsEarned, pct);
  _colQuiz = null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    collocBank, renderCollocHome, collocLessonHTML, startCollocPractice,
    answerCollocChoice, submitCollocText, nextCollocQuestion, finishCollocPractice,
    isCollocActive, abandonCollocPractice,
    _colNorm, _colAnswerCorrect, _colLetterHint, collocSpokenPhrase,
    collocPhrase, collocFilledParts, collocFollowupQuestion, colExpandFollowups,
    colFollowScore, colFollowDone, answerCollocFollowup, renderCollocFollowup,
    colUnderstandCardHTML,
  };
}

// ---- owed questions: every question missed must be typed back ----
// Shared engine in js/retrydrill.js; this only describes a collocation item.
if (typeof defineRetryDrill === 'function') defineRetryDrill({
  key: 'col',
  screenId: 'phrasesScreen',
  noun: 'câu',
  resolve: (id) => collocBank().find(q => String(q.id) === String(id)) || null,
  idOf: (q) => q.id,
  answerText: (q) => q.answer,
  grade: (v, q) => _colAnswerCorrect(v, q),
  promptHTML: (q) => `<div class="grammar-question-text">${colEsc(q.q).replace('___', '<b class="wf-retry-gap">___</b>')}</div>`,
  explainHTML: (q) => `<div class="grammar-review-explain">📘 ${colEsc(q.vi || '')}<br>💡 ${q.explanation || ''}</div>`,
  home: () => renderCollocHome(),
});
function colRetryCount() { return (typeof retryCount === 'function' ? retryCount('col') : 0); }
