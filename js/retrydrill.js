// retrydrill.js — one rule, six tabs: you owe back everything you got wrong.
//
// A child who misses a question, scores 8/10 and moves straight to the next
// practice collects a long tail of things they never actually learned. So in
// every quiz tab, each missed item is owed back and no new practice opens
// until the debt is cleared.
//
// This engine exists because the rule was about to be written six times. Six
// copies means six places to fix the next bug in it — and this session has
// already spent hours on bugs that were exactly that: a second copy of a rule.
// Each tab supplies a small config; the queue, the persistence, the gate, the
// hold-to-peek hint and the verdict screen are all here, once.
//
// Two things make a hard gate fair, and both are engine behaviour:
//
//   1. The debt PERSISTS (appState.<key>Retry), so closing the app is not a
//      way out. That is only acceptable because…
//   2. …the drill always offers the answer. The 👁 button shows it while held
//      and hides it on release, so a child who cannot recall it can look, let
//      go, and type it from memory. Without that, a persisted gate could trap
//      them on one item forever.

const RETRY_DRILLS = Object.create(null);

// cfg: {
//   key         'wf'                      → appState.wfRetry
//   screenId    'wordformScreen'          → where the drill draws
//   noun        'câu' | 'từ'              → "còn N câu"
//   resolve(id) → item | null             → the bank IS the source of truth
//   idOf(item)  → string
//   answerText(item) → string             → what the 👁 button reveals
//   promptHTML(item) → html               → the question, above the input
//   explainHTML(item) → html              → optional extra in the verdict
//   inputHTML() → html                    → optional; defaults to one text box
//   readAnswer() → any                    → optional; defaults to that box's value
//   valueText(v) → string                 → optional; how to echo what was typed
//   grade(v, item) → bool
//   home()                                → back to the tab's home screen
// }
function defineRetryDrill(cfg) { RETRY_DRILLS[cfg.key] = cfg; }
function retryCfg(key) { return RETRY_DRILLS[key] || null; }

// ---- the owed queue ----
// Stored as IDs, never as copies of the item: the bank stays the single source
// of the wording, the translation and the accepted answers, so a data fix
// reaches an item a child already owes.
function _retryStore(key) { return key + 'Retry'; }

function retryList(key) {
  const cfg = retryCfg(key);
  if (!cfg || typeof appState === 'undefined' || !appState) return [];
  const raw = Array.isArray(appState[_retryStore(key)]) ? appState[_retryStore(key)] : [];
  const out = [], seen = Object.create(null);
  for (const id of raw) {
    const k = String(id == null ? '' : id);
    if (!k || seen[k]) continue;
    // An item dropped from the bank must not wedge the gate shut forever.
    let item = null;
    try { item = cfg.resolve(k); } catch (e) { item = null; }
    if (item) { out.push(item); seen[k] = 1; }
  }
  return out;
}
function retryCount(key) { return retryList(key).length; }

function _retrySave(key, items) {
  const cfg = retryCfg(key);
  if (!cfg || typeof appState === 'undefined' || !appState) return;
  appState[_retryStore(key)] = items.map(i => String(cfg.idOf(i)));
  if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    try { saveUserData(currentUser, appState); } catch (e) {}
  }
}
function retryAdd(key, items) {
  const cfg = retryCfg(key);
  if (!cfg) return;
  const merged = retryList(key).slice();
  const have = Object.create(null);
  merged.forEach(i => { have[String(cfg.idOf(i))] = 1; });
  (items || []).forEach(i => {
    if (!i) return;
    const id = String(cfg.idOf(i) == null ? '' : cfg.idOf(i));
    if (id && !have[id]) { merged.push(i); have[id] = 1; }
  });
  _retrySave(key, merged);
}
function retryClear(key, id) {
  const cfg = retryCfg(key);
  if (!cfg) return;
  const k = String(id == null ? '' : id).toLowerCase();
  _retrySave(key, retryList(key).filter(i => String(cfg.idOf(i)).toLowerCase() !== k));
}

// ---- the gate ----
// Called at the top of every "start a practice" function. Returns true when it
// has taken over, so the caller returns immediately. The rule lives HERE and
// not only in the disabled buttons: a stale DOM node, a queued tap or an old
// results screen still on screen must all hit the same check.
function retryGate(key, message) {
  const n = retryCount(key);
  if (!n) return false;
  const cfg = retryCfg(key);
  if (typeof showToast === 'function') {
    const noun = (cfg && cfg.noun) || 'câu';
    showToast(message || ('✍️ Luyện lại ' + n + ' ' + noun + ' sai trước đã nhé!'));
  }
  startRetryDrill(key);
  return true;
}

// The banner that replaces a locked practice button with a reason and a way
// out. A disabled control with no explanation reads as a broken app.
function retryOwedBannerHTML(key) {
  const n = retryCount(key);
  if (!n) return '';
  const cfg = retryCfg(key);
  const noun = (cfg && cfg.noun) || 'câu';
  return `
    <div class="unit-owed-banner locked">
      <div class="unit-owed-text">✍️ Bé có <b>${n} ${noun} sai</b> cần gõ lại trước khi luyện bài mới.</div>
      <button class="unit-owed-btn" onclick="startRetryDrill('${key}')">Luyện ngay →</button>
    </div>`;
}
// The same debt stated on a results screen, right after a practice.
function retryResultBannerHTML(key, wrongNow) {
  const n = retryCount(key);
  if (!n) return '';
  const cfg = retryCfg(key);
  const noun = (cfg && cfg.noun) || 'câu';
  return `
    <div class="unit-owed-banner">
      <b>❌ ${wrongNow} ${noun} sai</b> trong bài này.
      Bé cần gõ lại <b>${n} ${noun}</b> trước khi luyện bài mới.
    </div>`;
}
function retryResultCtaHTML(key) {
  const n = retryCount(key);
  if (!n) return '';
  const cfg = retryCfg(key);
  const noun = (cfg && cfg.noun) || 'câu';
  return `<button class="phrases-cta-secondary phrases-review-btn"
            onclick="startRetryDrill('${key}')">✍️ Luyện lại ${n} ${noun} sai</button>`;
}

// ---- the drill ----
let _retryDrill = null;   // { key, queue, idx, revealed, answered, fixed, missed }

function startRetryDrill(key) {
  const cfg = retryCfg(key);
  if (!cfg) return;
  const owed = retryList(key);
  if (!owed.length) { try { cfg.home(); } catch (e) {} return; }
  if (typeof cfg.onOpen === 'function') { try { cfg.onOpen(); } catch (e) {} }
  _retryDrill = { key, queue: owed.slice(), idx: 0, revealed: false, answered: null, fixed: 0, missed: 0 };
  renderRetryDrill();
}
function abandonRetryDrill() { _retryDrill = null; }

// The ✕ on the drill card. It used to bin the drill on a single tap while
// the bottom bar asked first (js/app.js switchScreen) — the same exit, two
// answers. Nothing owed is lost by leaving (each fix is persisted as it
// lands), but the child's place in the queue is, so ask the way every other
// exit does and let Cancel keep the item on screen exactly as it was.
function quitRetryDrill(key) {
  const st = _retryDrill;
  if (st && st.key === key && typeof confirm === 'function') {
    const cfg = retryCfg(key);
    const noun = (cfg && cfg.noun) || 'câu';
    if (!confirm('Con đang luyện lại ' + noun + ' sai — còn ' + st.queue.length + ' ' + noun + '.\n'
      + 'Ra bây giờ thì lần sau vẫn phải luyện tiếp.\n\nVẫn ra chứ?')) return false;
  }
  abandonRetryDrill();
  retryGoHome(key);
  return true;
}

// SILENT teardown for a profile change. The drill is a queue of the words THIS
// child owes (js/wrong-priority.js), so it is the previous child's homework by
// definition — and it survived, because the only clears are retryGoHome() and
// switchScreen's confirm(). switchScreen's Toán guard reads retryDrillKey()
// and asked B "Con đang làm dở bài Toán" about A's drill, and
// _busyWithTimedActivity() reads isRetryDrillActive(), so B was never offered
// the app update either.
function retryDrillForgetProfile() {
  abandonRetryDrill();
}
function isRetryDrillActive() { return !!_retryDrill; }
function retryDrillKey() { return _retryDrill ? _retryDrill.key : null; }

// Hold to peek, release to hide.
//
// This must NOT re-render: a child half-way through typing who reaches for the
// hint would otherwise have the input rebuilt underneath them and lose what
// they had already typed. It touches only the two nodes that change.
function setRetryReveal(on) {
  const st = _retryDrill;
  if (!st) return;
  st.revealed = !!on;
  const box = document.getElementById('retryReveal');
  const btn = document.getElementById('retryPeekBtn');
  if (box) box.className = 'unit-retry-reveal' + (st.revealed ? '' : ' hidden');
  if (btn) {
    btn.setAttribute('aria-pressed', st.revealed ? 'true' : 'false');
    btn.className = 'unit-peek-btn' + (st.revealed ? ' on' : '');
  }
}

function _retryDefaultInputHTML() {
  return `<div class="wf-text-wrap">
      <input type="text" id="retryInput" class="wf-text-input" enterkeyhint="go"
             placeholder="Gõ cả từ hoàn chỉnh…" autocomplete="off" autocapitalize="off" spellcheck="false"
             onkeydown="if(event.key==='Enter'){event.preventDefault();submitRetryAnswer();}">
      <button class="wf-text-submit" onclick="submitRetryAnswer()">Check</button>
    </div>`;
}
function _retryDefaultRead() {
  const el = document.getElementById('retryInput');
  return el ? el.value : '';
}

function renderRetryDrill() {
  const st = _retryDrill;
  if (!st) return;
  const cfg = retryCfg(st.key);
  const screen = cfg && document.getElementById(cfg.screenId);
  if (!cfg || !screen) return;

  const done = st.answered;
  // While a verdict is on screen it is the item that produced it that must be
  // shown — a correct answer has already left the queue.
  const item = done ? done.item : st.queue[st.idx % st.queue.length];
  if (!item) { finishRetryDrill(); return; }

  const left = st.queue.length;
  const noun = cfg.noun || 'câu';
  const answer = String(cfg.answerText(item));

  const body = done
    // Same shape as every quiz in the app: what you typed, then the right
    // answer, then Next. The verdict belongs to the question that earned it and
    // is shown HERE — never carried onto the next item's screen.
    ? `<div class="wf-text-answer ${done.ok ? 'correct' : 'wrong'}">
         <span class="wf-text-answer-label">Bé gõ:</span>
         <span class="wf-text-answer-value">${done.shown ? retryEsc(done.shown) : '<em>(chưa gõ)</em>'}</span>
       </div>
       <div class="grammar-explanation ${done.ok ? 'correct' : 'wrong'}">
         <div>${done.ok
            ? '✅ Chính xác!'
            : '❌ Đáp án đúng: <b>' + retryEsc(answer) + '</b> · bé sẽ gặp lại ' + noun + ' này'}</div>
         ${typeof cfg.explainHTML === 'function' ? (cfg.explainHTML(item) || '') : ''}
       </div>
       <button class="grammar-next-btn" onclick="nextRetryQuestion()">${left > 0 ? 'Next →' : 'Xong!'}</button>`
    : `<div class="unit-retry-peek">
         <button class="unit-peek-btn" id="retryPeekBtn" type="button" aria-pressed="false"
                 oncontextmenu="return false"
                 onmousedown="setRetryReveal(true)" onmouseup="setRetryReveal(false)"
                 onmouseleave="setRetryReveal(false)"
                 ontouchstart="event.preventDefault(); setRetryReveal(true)"
                 ontouchend="setRetryReveal(false)" ontouchcancel="setRetryReveal(false)"
                 onkeydown="setRetryReveal(true)" onkeyup="setRetryReveal(false)"
                 onblur="setRetryReveal(false)">👁 Giữ để xem đáp án</button>
         ${typeof cfg.sayHTML === 'function' ? (cfg.sayHTML(item) || '') : ''}
       </div>
       <div class="unit-retry-reveal hidden" id="retryReveal">${retryEsc(answer)}</div>
       ${typeof cfg.inputHTML === 'function' ? cfg.inputHTML(item) : _retryDefaultInputHTML()}`;

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="quitRetryDrill('${st.key}')">✕</button>
        <span class="grammar-quiz-progress">✍️ Luyện ${noun} sai · còn ${left} ${noun}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill"
             style="width:${Math.round(st.fixed / Math.max(1, st.fixed + left) * 100)}%"></div></div>
      </div>
      <div class="grammar-question-card">
        ${cfg.promptHTML(item)}
        ${body}
      </div>
    </div>`;

  if (!done) {
    const inp = document.getElementById('retryInput');
    if (inp) { try { inp.focus(); } catch (e) {} }
  }
}

function retryGoHome(key) {
  const cfg = retryCfg(key);
  if (cfg) { try { cfg.home(); } catch (e) {} }
}

function submitRetryAnswer() {
  const st = _retryDrill;
  if (!st || st.answered || !st.queue.length) return;   // one answer per item
  const cfg = retryCfg(st.key);
  if (!cfg) return;
  const pos = st.idx % st.queue.length;
  const item = st.queue[pos];

  const value = (typeof cfg.readAnswer === 'function') ? cfg.readAnswer() : _retryDefaultRead();
  const ok = !!cfg.grade(value, item);
  const shown = (typeof cfg.valueText === 'function') ? cfg.valueText(value) : String(value || '').trim();

  st.answered = { item, ok, shown };
  if (typeof cfg.onAnswer === 'function') { try { cfg.onAnswer(item, ok); } catch (e) {} }
  if (typeof petCheerAnswer === 'function') petCheerAnswer(ok);

  if (ok) {
    st.queue.splice(pos, 1);
    st.fixed++;
    retryClear(st.key, cfg.idOf(item));    // persist now: progress survives a reload
  } else {
    st.missed++;
    // Back of the queue rather than pinning the child on one item — they meet
    // it again this session, just not immediately.
    st.queue.push(st.queue.splice(pos, 1)[0]);
  }
  if (st.idx >= st.queue.length) st.idx = 0;
  renderRetryDrill();                       // verdict for the item just answered
}

// Clearing the verdict is what moves on, so one is never still on screen when
// the next item appears.
function nextRetryQuestion() {
  const st = _retryDrill;
  if (!st) return;
  st.answered = null;
  st.revealed = false;
  if (!st.queue.length) { finishRetryDrill(); return; }
  renderRetryDrill();
}

function finishRetryDrill() {
  const st = _retryDrill;
  if (!st) return;
  const cfg = retryCfg(st.key);
  const fixed = st.fixed;
  const noun = (cfg && cfg.noun) || 'câu';
  _retryDrill = null;
  const screen = cfg && document.getElementById(cfg.screenId);
  if (!screen) return;
  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="retryGoHome('${cfg.key}')">‹</button>
        <span class="grammar-quiz-progress">✅ Đã luyện xong ${fixed} ${noun}</span>
      </div>
      <div class="unit-retry-done">
        <div class="unit-retry-done-emoji">🎉</div>
        <div class="unit-retry-done-title">Hết ${noun} sai rồi!</div>
        <div class="unit-retry-done-sub">Bé có thể luyện bài mới ngay bây giờ.</div>
      </div>
      <button class="phrases-cta-secondary phrases-review-btn" onclick="retryGoHome('${cfg.key}')">🏠 Về trang chính</button>
    </div>`;
  if (typeof createConfetti === 'function') { try { createConfetti(); } catch (e) {} }
}

function retryEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    defineRetryDrill, retryCfg, retryList, retryCount, retryAdd, retryClear,
    retryGate, retryOwedBannerHTML, retryResultBannerHTML, retryResultCtaHTML,
    startRetryDrill, abandonRetryDrill, quitRetryDrill, retryDrillForgetProfile, isRetryDrillActive, retryDrillKey,
    setRetryReveal, renderRetryDrill, submitRetryAnswer, nextRetryQuestion,
    finishRetryDrill, retryGoHome, retryEsc,
  };
}
