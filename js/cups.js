// cups.js — 🏆 the trophy cabinet.
//
// One cup per battle WON against a real friend. Five cups fuse into a ruby
// cup, five ruby cups into a diamond cup — so the shelf never turns into an
// unreadable row of ninety identical trophies, and there is always a next
// milestone in view.
//
// A cup is awarded on one path only, in finishPetBattle: a trophy has to mean
// a real friend was beaten, or it means nothing at all.

const CUP_MERGE = 5;                       // cups per ruby, rubies per diamond
const CUP_TIERS = ['basic', 'ruby', 'diamond'];

// Look of each tier. `worth` is in basic cups, used for the lifetime total.
const CUP_LOOK = {
  basic:   { icon: '🏆', size: 34, worth: 1,  cls: 'cup-basic' },
  ruby:    { icon: '🏆', size: 44, worth: CUP_MERGE, cls: 'cup-ruby' },
  diamond: { icon: '🏆', size: 56, worth: CUP_MERGE * CUP_MERGE, cls: 'cup-diamond' },
};

function cupState() {
  if (typeof appState === 'undefined' || !appState) return { basic: 0, ruby: 0, diamond: 0, won: 0 };
  if (!appState.cups || typeof appState.cups !== 'object') {
    appState.cups = { basic: 0, ruby: 0, diamond: 0, won: 0 };
  }
  const c = appState.cups;
  // Coerce THEN default: `Math.trunc('x' || 0)` is NaN, because a non-empty
  // string is truthy. A NaN here would poison the shelf and every total.
  const num = (v) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.max(0, n) : 0; };
  for (const k of CUP_TIERS) c[k] = num(c[k]);
  c.won = num(c.won);
  return c;
}

function _cupSave() {
  try {
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
      saveUserData(currentUser, appState);
    }
  } catch (e) {}
}

// Awarded ONLY for a real win against a friend.
function awardCup(n) {
  const c = cupState();
  const add = Math.max(1, Math.trunc(n || 1));
  c.basic += add;
  c.won += add;
  _cupSave();
  return c;
}

// Total in basic-cup units — the honest lifetime score, whatever has been
// merged away. Merging must never make the number go down.
function cupTotalValue(c) {
  const s = c || cupState();
  return CUP_TIERS.reduce((n, t) => n + s[t] * CUP_LOOK[t].worth, 0);
}

function canMergeCups(tier, c) {
  const s = c || cupState();
  if (tier === 'basic') return s.basic >= CUP_MERGE;
  if (tier === 'ruby') return s.ruby >= CUP_MERGE;
  return false;                            // diamond is the top of the ladder
}

// 5 basic → 1 ruby, 5 ruby → 1 diamond. One step per tap, so the child sees
// each fusion happen.
function mergeCups(tier) {
  const c = cupState();
  if (!canMergeCups(tier, c)) return null;
  if (tier === 'basic') { c.basic -= CUP_MERGE; c.ruby += 1; }
  else if (tier === 'ruby') { c.ruby -= CUP_MERGE; c.diamond += 1; }
  else return null;
  _cupSave();
  return c;
}

// What to show under each shelf: how many more until the next fusion.
function cupProgress(tier, c) {
  const s = c || cupState();
  if (tier === 'diamond') return { have: s.diamond, need: 0, ready: false, top: true };
  const have = s[tier];
  // Once there are five, the answer is "you can merge now" — not "0 more".
  return { have, need: have >= CUP_MERGE ? 0 : CUP_MERGE - have, ready: have >= CUP_MERGE, top: false };
}

// ---- selling ----
// A cup can be traded for coins: 500 per basic-cup of worth, so a ruby pays
// 5x and a diamond 25x. Selling removes the trophy but NEVER touches `won` —
// the lifetime win count is history, and because reconciliation only adds
// cups when the server knows MORE wins than `won`, a sold cup can never be
// resurrected by a sync.
const CUP_SELL_PRICE = 500;                // coins per basic-cup of worth

function cupSellPrice(tier) {
  const look = CUP_LOOK[tier];
  return look ? CUP_SELL_PRICE * look.worth : 0;
}

function sellCup(tier) {
  const c = cupState();
  if (!CUP_LOOK[tier] || c[tier] <= 0) return null;
  c[tier] -= 1;
  appState.coins = Math.max(0, Math.trunc(Number(appState.coins) || 0)) + cupSellPrice(tier);
  _cupSave();
  return c;
}

// ---- server reconciliation ----
// The cabinet is local, the battles are not. On a fresh install the child has
// no cups but the server still knows every battle they won, so the shelf is
// rebuilt from that count.
//
// The rule is one-way ON PURPOSE: reconciling may only ADD cups. A server that
// is briefly behind (a battle just finished, another device has not synced)
// must never take a trophy off the shelf — under-counting is invisible and
// self-corrects, while deleting a diamond cup a child earned over 25 wins is
// not something an app gets to do on a hunch.
let _cupsReconciled = false;

function applyServerWins(serverWins) {
  const n = Math.max(0, Math.trunc(Number(serverWins) || 0));
  const c = cupState();
  if (!Number.isFinite(n) || n <= c.won) return c;      // never remove anything
  // Only the unseen wins become cups; merged ruby/diamond tiers are untouched,
  // so a rebuilt cabinet keeps whatever the child had already fused.
  c.basic += (n - c.won);
  c.won = n;
  _cupSave();
  return c;
}

async function reconcileCupsFromServer() {
  try {
    if (typeof EngAuth === 'undefined' || typeof currentUser === 'undefined') return null;
    const token = EngAuth.tokenFor(currentUser);
    if (!token) return null;                             // offline or unlinked: keep local
    const r = await EngAuth.api('me/wins', { token });
    if (!r || !r.ok || !r.data) return null;
    _cupsReconciled = true;
    return applyServerWins(r.data.wins);
  } catch (e) { return null; }                           // a failed sync must never clear cups
}

// ---- the cabinet (Profile → 🏆 Tủ cúp) ----
const CUP_NAME = { basic: 'Cúp vàng', ruby: 'Cúp ruby', diamond: 'Cúp kim cương' };

function _cupShelf(tier, c) {
  const look = CUP_LOOK[tier];
  const p = cupProgress(tier, c);
  const n = c[tier];

  // Draw at most ten; beyond that a ×N is easier to read than a wall of cups.
  const shown = Math.min(n, 10);
  const cups = n === 0
    ? `<div class="cup-slot empty">${'—'}</div>`
    : Array.from({ length: shown }, (_, i) =>
        `<span class="cup ${look.cls}" style="font-size:${look.size}px;animation-delay:${i * 0.05}s">${look.icon}</span>`
      ).join('') + (n > shown ? `<span class="cup-more">×${n}</span>` : '');

  const foot = p.top
    ? (n > 0 ? 'Đỉnh cao nhất! 👑' : `Gộp ${CUP_MERGE} cúp ruby để có 1 cúp kim cương`)
    : p.ready
      ? `<button class="cup-merge-btn" onclick="doMergeCups('${tier}')">
           ✨ Gộp ${CUP_MERGE} ${CUP_NAME[tier].toLowerCase()} → 1 ${CUP_NAME[tier === 'basic' ? 'ruby' : 'diamond'].toLowerCase()}
         </button>`
      : `Còn <b>${p.need}</b> ${CUP_NAME[tier].toLowerCase()} nữa là gộp được`;

  const sell = n > 0
    ? `<button class="cup-sell-btn" onclick="promptSellCup('${tier}')">🪙 Bán 1 — nhận ${cupSellPrice(tier)} xu</button>`
    : '';

  return `
    <div class="cup-shelf ${look.cls}-shelf">
      <div class="cup-shelf-head">
        <span class="cup-shelf-name">${CUP_NAME[tier]}</span>
        <b class="cup-shelf-count">${n}</b>
      </div>
      <div class="cup-row">${cups}</div>
      <div class="cup-shelf-foot">${foot}</div>
      ${sell}
    </div>`;
}

function renderCupCabinet() {
  const el = document.getElementById('cupCabinet');
  if (!el) return;
  // First look at the cabinet in a session: ask the server what it remembers,
  // then redraw. Once per session — the shelf is not worth a request per view.
  if (!_cupsReconciled) {
    _cupsReconciled = true;
    reconcileCupsFromServer().then((c) => { if (c) renderCupCabinet(); }).catch(() => {});
  }
  const c = cupState();
  const total = cupTotalValue(c);

  if (!c.won) {
    el.innerHTML = `
      <div class="cup-empty">
        <div class="cup-empty-icon">🏆</div>
        <div>Chưa có cúp nào. Thắng một trận đấu với bạn bè để nhận cúp đầu tiên! ⚔️</div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="cup-total">
      <div><b>${c.won}</b><span>trận thắng</span></div>
      <div><b>${total}</b><span>giá trị cúp</span></div>
    </div>
    ${CUP_TIERS.map(t => _cupShelf(t, c)).join('')}`;
}

function doMergeCups(tier) {
  const before = cupTotalValue();
  if (!mergeCups(tier)) return;
  // Merging changes how cups LOOK, never what they are worth.
  if (typeof showToast === 'function') {
    showToast(tier === 'basic' ? '✨ Đã gộp thành 1 cúp ruby!' : '💎 Đã gộp thành 1 cúp kim cương!');
  }
  if (typeof createConfetti === 'function') { try { createConfetti(); } catch (e) {} }
  renderCupCabinet();
  return before === cupTotalValue();
}

// Selling asks first: the cup leaves the shelf for good, so the child must
// say "chắc chưa" out loud before any coin changes hands.
function promptSellCup(tier) {
  if (cupState()[tier] <= 0) return;
  const host = document.getElementById('cupCabinet');
  if (!host) return;
  document.querySelector('.cup-sell-backdrop')?.remove();
  const price = cupSellPrice(tier);
  host.insertAdjacentHTML('beforeend', `
    <div class="cup-sell-backdrop" role="presentation" onclick="if(event.target===this)cancelSellCup()" onkeydown="if(event.key==='Escape')cancelSellCup()">
      <section class="cup-sell-dialog" role="dialog" aria-modal="true" aria-labelledby="cupSellTitle">
        <div class="cup-sell-icon">🏆→🪙</div>
        <h3 id="cupSellTitle">Bán 1 ${CUP_NAME[tier].toLowerCase()}?</h3>
        <p>Con sẽ nhận <b>+${price} xu</b>, nhưng chiếc cúp sẽ rời khỏi tủ mãi mãi. Chắc chưa?</p>
        <div class="cup-sell-actions">
          <button type="button" class="cup-sell-cancel" onclick="cancelSellCup()">Thôi, giữ cúp</button>
          <button type="button" class="cup-sell-confirm" onclick="confirmSellCup('${tier}')">Bán lấy ${price} xu</button>
        </div>
      </section>
    </div>`);
  requestAnimationFrame?.(() => document.querySelector('.cup-sell-cancel')?.focus());
}

function cancelSellCup() {
  document.querySelector('.cup-sell-backdrop')?.remove();
}

function confirmSellCup(tier) {
  cancelSellCup();
  const price = cupSellPrice(tier);
  if (!sellCup(tier)) return;
  if (typeof showToast === 'function') showToast('🪙 +' + price + ' xu — con đang có ' + Math.floor(appState.coins) + ' xu');
  renderCupCabinet();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CUP_MERGE, CUP_TIERS, CUP_LOOK, CUP_NAME,
    cupState, awardCup, mergeCups, canMergeCups, cupTotalValue, cupProgress,
    cupSellPrice, sellCup, promptSellCup, cancelSellCup, confirmSellCup,
    renderCupCabinet, doMergeCups, _cupShelf,
    applyServerWins, reconcileCupsFromServer,
    _resetCupReconcile: () => { _cupsReconciled = false; },
  };
}
