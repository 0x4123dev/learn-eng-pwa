// wrong-priority.js — one silent rule, seven tabs: what you got wrong comes
// back until you have got it right five times in a row.
//
// A child who misses a question and then happens not to meet it again for a
// month has not learned it. So every practice that draws questions at random
// first reaches for the ones THIS child has missed before — up to half the
// practice — and keeps doing so until each has been answered right five times
// running. Then the question goes back to plain random, as if never missed.
//
// The child is never told. No badge, no counter, no "review" label: a practice
// simply happens to contain the things they need. This is deliberately unlike
// the owed-back drill in js/retrydrill.js, which is loud on purpose (it locks
// new practice until a miss is retyped). The two are independent, and a right
// answer inside that drill does NOT count here. Only real practices do.
//
// One implementation, because the rule was about to be written seven times.
// Each tab supplies its pool and how an item is identified; the store, the
// draw and the bookkeeping live here.

const PRIO_GRADUATE = 5;   // right answers in a row before an item is released

// ---- the store: appState.wrongPrio[key][id] = { s, w, t } ----
//   s  right answers in a row so far (0..4)
//   w  times missed, ever — ordering only
//   t  when it was last answered — ordering only
// IDs, never copies of the item: the bank stays the single source of wording
// and accepted answers, so a data fix reaches an item the child still meets.
function _prioRoot() {
  if (typeof appState === 'undefined' || !appState) return null;
  const cur = appState.wrongPrio;
  if (!cur || typeof cur !== 'object' || Array.isArray(cur)) appState.wrongPrio = {};
  return appState.wrongPrio;
}
function prioStore(key) {
  const root = _prioRoot();
  if (!root) return null;
  const k = String(key);
  if (!root[k] || typeof root[k] !== 'object' || Array.isArray(root[k])) root[k] = {};
  return root[k];
}
function prioStreak(key, id) {
  const store = prioStore(key);
  if (!store) return null;
  const e = store[String(id)];
  return e ? (e.s | 0) : null;
}
function _prioSave() {
  if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    try { saveUserData(currentUser, appState); } catch (e) {}
  }
}

// ---- bookkeeping ----
// Called once at the end of a REAL practice with the ids answered right and
// the ids answered wrong. What counts as wrong (an unanswered question, say)
// is each tab's own business: it passes the same list it owes back.
function prioRecord(key, correctIds, wrongIds, now) {
  const store = prioStore(key);
  if (!store) return;
  const t = (typeof now === 'number') ? now : Date.now();
  const norm = ids => (Array.isArray(ids) ? ids : [])
    .map(id => String(id == null ? '' : id)).filter(Boolean);
  const wrong = norm(wrongIds);
  const missed = Object.create(null);
  wrong.forEach(id => { missed[id] = 1; });
  norm(correctIds).forEach(id => {
    if (missed[id]) return;                       // reported both ways: wrong wins
    const e = store[id];
    if (!e) return;                               // never missed → nothing to track
    e.s = (e.s | 0) + 1;
    e.t = t;
    if (e.s >= PRIO_GRADUATE) delete store[id];   // released: plain random again
  });
  wrong.forEach(id => {
    const e = store[id];
    if (e) { e.s = 0; e.w = (e.w | 0) + 1; e.t = t; }
    else store[id] = { s: 0, w: 1, t };
  });
  // Now, not at the tab's next save: several finish functions save BEFORE
  // they reach this line, and a reload right after must not lose a streak.
  _prioSave();
}

// ---- the draw ----
function _prioShuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function _prioOpts(opts) {
  return {
    idOf: (opts && typeof opts.idOf === 'function')
      ? opts.idOf
      : (item => (item && item.id != null) ? item.id : undefined),
    rand: (opts && typeof opts.rand === 'function') ? opts.rand : Math.random,
  };
}

// The forced part only: up to floor(n/2) items of `pool` this child has
// missed before, most in need first. Tabs that split the remainder themselves
// (Word form and Collocation keep a typed / multiple-choice share) call this
// and draw the rest from `pool` minus the result.
//
// Only items IN THE POOL are candidates: a word missed in HK1 never leaks into
// an HK2 practice, a Unit 3 miss never turns up while practising Unit 5.
function prioForced(key, pool, n, opts) {
  const list = Array.isArray(pool) ? pool : [];
  const want = Math.min(Number(n) || 0, list.length);
  const cap = Math.floor(want / 2);
  if (cap <= 0) return [];
  const store = prioStore(key);
  if (!store) return [];
  const { idOf, rand } = _prioOpts(opts);
  const seen = Object.create(null);
  const cands = [];
  list.forEach(item => {
    let id;
    try { id = idOf(item); } catch (e) { id = undefined; }
    const k = String(id == null ? '' : id);
    if (!k || seen[k]) return;
    const e = store[k];
    if (!e) return;
    seen[k] = 1;
    cands.push({ item, s: e.s | 0, w: e.w | 0, t: Number(e.t) || 0, r: rand() });
  });
  // Least progress first, then most missed, then longest unseen. The random
  // tiebreak stops the same order coming back verbatim every practice.
  cands.sort((a, b) => (a.s - b.s) || (b.w - a.w) || (a.t - b.t) || (a.r - b.r));
  return cands.slice(0, cap).map(c => c.item);
}

// The whole draw: the forced part plus a random fill from the rest of the
// pool, shuffled together so position gives nothing away. Surplus candidates
// beyond the cap stay in the pool and may be drawn by chance like anything
// else — the cap limits what is FORCED, not what randomness brings.
// With nothing tracked (or no profile) this is exactly shuffle-and-take-n.
function prioPick(key, pool, n, opts) {
  const list = Array.isArray(pool) ? pool : [];
  const want = Math.min(Number(n) || 0, list.length);
  if (want <= 0) return [];
  const { rand } = _prioOpts(opts);
  const forced = prioForced(key, list, want, opts);
  const taken = new Set(forced);
  const rest = _prioShuffle(list.filter(item => !taken.has(item)), rand).slice(0, want - forced.length);
  return forced.length ? _prioShuffle(forced.concat(rest), rand) : rest;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRIO_GRADUATE, prioStore, prioStreak, prioRecord, prioForced, prioPick };
}
