// petbattlegame.js — the artillery duel itself: canvas rendering, aiming,
// the 4-barrel volley and replaying the opponent's shots.
// All physics/terrain/wind come from battlecalc.js and the shared seed, so
// both phones draw exactly the same battle from just (angle, power, shots).

const PB_HEARTS = 5;

// The battlefield is drawn twice as tall as the world is deep. The extra
// height is pure SKY above the play area — the simulation still lives in a
// 450px world, so no physics, terrain or replay changes — and it buys room to
// watch a high lob arc instead of losing it off the top of the frame.
const PB_SKY_EXTRA = 450;
const PB_CASTLE_HALF_W = 70;
const PB_CASTLE_HEIGHT = 122;

// Aim bounds, shared by the drag handler, the arrow keys and the manual
// controls — three ways to set one number, so they must agree or a slider
// could reach an angle a drag cannot.
const PB_ANGLE_MIN = 10, PB_ANGLE_MAX = 80;
const PB_POWER_MIN = 10, PB_POWER_MAX = 100;

// The battle borrows the arena's string table and its 🇬🇧/🇻🇳 choice, so one
// flag governs the whole flow and the parity test covers these strings too.
// In Node (tests) neither exists; the key comes back and nothing renders.
const gT = (k, vars) => (typeof pbT === 'function' ? pbT(k, vars) : k);
const gLang = () => (typeof _pbLang !== 'undefined' ? _pbLang : 'en');

// Pure presentation helpers: HP remains server-authoritative, while these
// convert it into readable castle damage and heart segments.
//
// SIX stages, because a four-stage ladder meant a 100→99 hit changed nothing on
// screen: the child landed a shot and the castle looked untouched until a
// quarter of the HP was gone. Exactly 100 is the only pristine state now, so
// the very first damaging poop always breaks something visible.
//   100 → 0 · 76-99 → 1 · 51-75 → 2 · 26-50 → 3 · 1-25 → 4 · 0 → 5
function pbHouseDamageStage(hp) {
  const safe = Math.max(0, Math.min(100, Number(hp) || 0));
  if (safe <= 0) return 5;
  if (safe <= 25) return 4;
  if (safe <= 50) return 3;
  if (safe <= 75) return 2;
  if (safe < 100) return 1;
  return 0;
}

function pbHeartFills(hp) {
  const safe = Math.max(0, Math.min(100, Number(hp) || 0));
  return Array.from({ length: PB_HEARTS }, (_, i) =>
    Math.max(0, Math.min(100, (safe - i * 20) * 5)));
}

function PetBattleGame(opts) {
  this.view = opts.view;                 // battleView() from the server
  this.mount = opts.mount;
  this.sendTurn = opts.sendTurn || (() => Promise.resolve(null));
  this.onSeenTurn = opts.onSeenTurn || (() => {});
  this.onFinish = opts.onFinish || (() => {});
  this.link = opts.link || null;          // realtime relay (may be null)

  // In Node the rules come from the module; in the browser from the
  // BattleCalc namespace (top-level const is not on window).
  const C = (typeof BattleCalc !== 'undefined' && BattleCalc.FIELD_W)
    ? BattleCalc
    : require('./battlecalc.js');
  this.calc = C;

  this.seed = this.view.seed >>> 0;
  // Geometry comes from the version SNAPSHOTTED on the battle, not from
  // whatever this build prefers — otherwise two phones on different app
  // versions would draw different terrain from the same seed mid-match.
  this.rules = C.fieldRules ? C.fieldRules(this.view.fieldVersion) : null;
  this.terrain = C.buildTerrain(this.seed, this.rules);
  const spawns = C.spawnPoints(this.terrain, this.rules);
  // The challenger always stands on the left, for both viewers.
  this.mePos = this.view.iAmChallenger ? spawns[0] : spawns[1];
  this.foePos = this.view.iAmChallenger ? spawns[1] : spawns[0];
  this.meFacing = this.view.iAmChallenger ? 1 : -1;

  this.angle = 45;
  this.power = 60;
  this.shots = 1;
  this.busy = false;                     // an animation is playing
  this.finished = false;
  this.turnNo = this.view.turnNo || 1;
  this.myTurn = !!this.view.myTurn;
  this.myHp = this.view.me.hp;
  this.foeHp = this.view.foe.hp;
  this.myAmmo = this.view.me.ammo;
  this.foeAmmo = this.view.foe.ammo;
  this.craters = [];
  this.flying = [];                      // shells being animated
  this.banner = '';
  this.linkMode = this.link ? this.link.mode : 'polling';
  this.foeAiming = null;                  // live "đang ngắm…" from the opponent
  this.emotes = [];                       // floating emoji reactions
  this.foeHere = false;
  this._raf = null;
  this._aimTimer = null;
  this._effectTimers = [];
  this._destroyed = false;
  this._shellReady = false;
  this._draggingAim = false;
  this.reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  // The window onto the world. On v1 it cannot move, so nothing changes there.
  this.camera = (typeof BattleCamera === 'function')
    ? new BattleCamera({ rules: this.rules, reducedMotion: this.reducedMotion })
    : null;
  if (this.camera) this.camera.focusOn(this.mePos.x, { instant: true });
  this._panPointer = null;
  this.impactParticles = [];
  this.castleDebris = [];
  this.houseImpacts = [];
  this._lastHitCount = 0;
  this.sceneRenderer = null;
}

// ---- realtime events (all no-ops when the link is unavailable) ----
// A turn relayed by the room — replay it now instead of waiting for a poll.
PetBattleGame.prototype.onLiveTurn = function (turn) {
  if (this.finished || !turn) return;
  if (turn.turn_no <= (this._seenTurn || 0)) return;      // already played
  this._seenTurn = turn.turn_no;
  this.onSeenTurn(turn.turn_no);
  if (turn.user_id !== this.view.me.id) this._queueTurn(turn);
};

// A turn used to be marked seen and then dropped if it arrived while an
// animation was running — the poll cursor had already moved past it, so it was
// gone for good and the opponent's shot simply never played. Queue instead.
PetBattleGame.prototype._queueTurn = function (turn) {
  if (!Array.isArray(this._turnQueue)) this._turnQueue = [];
  if (this._turnQueue.some(t => t.turn_no === turn.turn_no)) return;   // exactly once
  this._turnQueue.push(turn);
  this._turnQueue.sort((a, b) => a.turn_no - b.turn_no);
  this._drainTurns();
};

PetBattleGame.prototype._drainTurns = function () {
  if (this.finished || this.busy) return;                 // wait for a safe boundary
  const next = (this._turnQueue || []).shift();
  if (!next) return;
  this.foeAiming = null;
  this._replay(next);
};
PetBattleGame.prototype.onOpponentAim = function (m) {
  if (this.finished || this.myTurn) return;
  this.foeAiming = { angle: +m.angle || 0, power: +m.power || 0, shots: m.shots || 1, at: Date.now() };
  if (this._aimTimer) clearTimeout(this._aimTimer);
  const aimAt = this.foeAiming.at;
  this._aimTimer = setTimeout(() => {
    if (this.foeAiming && this.foeAiming.at === aimAt) {
      this.foeAiming = null;
      this.draw();
    }
  }, this.reducedMotion ? 0 : 4000);
  this.draw();
};
PetBattleGame.prototype.onEmote = function (e) {
  this._addEmote(e, this.foePos.x, this.foePos.y - 90);
};
PetBattleGame.prototype.onPresence = function (m) {
  this.foeHere = (m.peers || 0) > 1;
  this._updateLinkPill();
};
PetBattleGame.prototype.onLinkMode = function (mode) {
  this.linkMode = mode;
  this._updateLinkPill();
};
PetBattleGame.prototype._updateLinkPill = function () {
  const el = this._el('pbLink');
  if (!el) return;
  const live = this.linkMode === 'live';
  const connecting = this.linkMode === 'connecting';
  const className = 'pb-link ' + (live ? 'live' : connecting ? 'connecting' : 'slow');
  const label = live
    ? (this.foeHere ? gT('gLive') : gT('gWaitPeer'))
    : connecting ? gT('gConnecting') : gT('gSlow');
  if (el.className !== className) el.className = className;
  if (el.textContent !== label) el.textContent = label;
};
PetBattleGame.prototype.sendEmote = function (e) {
  if (this.link) this.link.sendEmote(e);
  this._addEmote(e, this.mePos.x, this.mePos.y - 90);
};
PetBattleGame.prototype._addEmote = function (e, x, y) {
  const emote = { e, t: 0, life: 90, x, y, static: this.reducedMotion };
  this.emotes.push(emote);
  if (!this.reducedMotion) { this._requestFrame(); return; }
  this.draw();
  const timer = setTimeout(() => {
    if (this._destroyed) return;
    this.emotes = this.emotes.filter(item => item !== emote);
    this.draw();
  }, 1000);
  this._effectTimers.push(timer);
};

// Uncapped: a duel where both sides fire one poop at a time runs 20 rounds.
PetBattleGame.prototype.roundNo = function () {
  return Math.max(1, Math.ceil(this.turnNo / 2));
};
PetBattleGame.prototype.wind = function () {
  return this.calc.windForRound(this.seed, this.roundNo());
};
PetBattleGame.prototype.waitingForOpponent = function () {
  return !this.finished && !this.myTurn;
};

PetBattleGame.prototype.start = function () {
  this.render();
};

PetBattleGame.prototype.destroy = function () {
  this._destroyed = true;
  this._turnQueue = [];
  if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
  if (this._aimTimer) clearTimeout(this._aimTimer);
  this._effectTimers.forEach(timer => clearTimeout(timer));
  this._raf = null;
  this._aimTimer = null;
  this._effectTimers = [];
  if (this.sceneRenderer) this.sceneRenderer.destroy();
  this.sceneRenderer = null;
};

// ---- layout ----
PetBattleGame.prototype.render = function () {
  const v = this.view, C = this.calc;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const maxShots = C.maxShotsThisTurn(this.myAmmo);
  this.shots = Math.max(1, Math.min(this.shots, Math.max(1, maxShots)));

  if (!this._shellReady) {
    const barrels = [1, 2, 3, 4].map(n => `
      <button class="pb-barrel" type="button" data-pb-shots="${n}"
              aria-label="${esc(gT('gLoadAria', { n }))}" onclick="_pbGameSetShots(${n})">
        <span class="pb-poop-stack" aria-hidden="true">${Array.from({ length: n }, () => '<i>💩</i>').join('')}</span>
        <span>${esc(gT('gShots', { n }))}</span>
      </button>`).join('');

    this.mount.innerHTML = `
      <div class="pb-game">
      <div class="pb-turn-callout" id="pbTurnCallout" role="status" aria-live="polite">
        <span class="pb-turn-dot" aria-hidden="true"></span><span id="pbTurnText"></span>
        <div class="pb-lang pb-game-lang" role="group" aria-label="Language">
          <button class="pb-flag ${gLang() === 'en' ? 'on' : ''}" type="button"
                  onclick="_pbGameSetLang('en')" aria-pressed="${gLang() === 'en'}">🇬🇧<span>EN</span></button>
          <button class="pb-flag ${gLang() === 'vi' ? 'on' : ''}" type="button"
                  onclick="_pbGameSetLang('vi')" aria-pressed="${gLang() === 'vi'}">🇻🇳<span>VI</span></button>
        </div>
      </div>
      <div class="pb-field-shell">
        <canvas id="pbSceneCanvas" class="pb-scene-canvas" width="${C.FIELD_W}" height="${C.FIELD_H + PB_SKY_EXTRA}"
                aria-hidden="true"></canvas>
        <canvas id="pbCanvas" class="pb-canvas" width="${C.FIELD_W}" height="${C.FIELD_H + PB_SKY_EXTRA}" tabindex="0"
                role="img" aria-label="${esc(gT('gCanvasAria'))}" aria-describedby="pbCanvasHelp">
          ${esc(gT('gCanvasFallback'))}
        </canvas>
        <!-- Wind and both health bars repeated ON the battlefield. The HUD
             above scrolls out of reach on a tall screen, and wind is the one
             number that decides a shot — a child should never have to look
             away from the field to read it. -->
        <!-- Removing the two pet panels took HP, ammo and level off the
             screen-reader path with them, so this strip is NOT aria-hidden:
             it is the only place that information now lives. Progressbar
             semantics on each side keep the HP readable as a value. -->
        <!-- Everything mid-shot lives here. No level: each castle already
             wears its own LV badge, so repeating it twice on one screen was
             just clutter. -->
        <div class="pb-field-status" role="group" aria-label="${esc(gT('gFieldStatusAria'))}">
          <span class="pb-fs-side me" id="pbFieldMe" role="progressbar"
                aria-valuemin="0" aria-valuemax="100" aria-label="${esc(v.me.name || gT('gMe'))}">
            <span class="pb-fs-nums"><b id="pbFieldHpMe">100</b><em id="pbFieldAmmoMe">0 💩</em></span>
            <i class="pb-fs-bar"><u></u></i>
          </span>
          <span class="pb-fs-mid">
            <span class="pb-fs-wind" id="pbFieldWind">💨 · 0</span>
            <span class="pb-link" id="pbLink" role="status" aria-live="polite"></span>
          </span>
          <span class="pb-fs-side foe" id="pbFieldFoe" role="progressbar"
                aria-valuemin="0" aria-valuemax="100" aria-label="${esc(v.foe.name || gT('gFoe'))}">
            <span class="pb-fs-nums"><b id="pbFieldHpFoe">100</b><em id="pbFieldAmmoFoe">0 💩</em></span>
            <i class="pb-fs-bar"><u></u></i>
          </span>
        </div>
        <button class="pb-beacon left" id="pbBeaconL" type="button" hidden
                aria-label="${esc(gT('gGoFoe'))}" onclick="_pbGameAnchor('foe')">◀</button>
        <button class="pb-beacon right" id="pbBeaconR" type="button" hidden
                aria-label="${esc(gT('gGoFoe'))}" onclick="_pbGameAnchor('foe')">▶</button>
        <button class="pb-follow-btn" id="pbFollowBtn" type="button" hidden
                onclick="_pbGameFollow()">${esc(gT('gFollowShot'))}</button>
      </div>
      <!-- The world moves; this ribbon stays put and says where you are. -->
      <div class="pb-camera-bar" id="pbCameraBar">
        <div class="pb-minimap" id="pbMinimap" role="img" aria-label="${esc(gT('gMinimapAria'))}">
          <i class="pb-mini-window" id="pbMiniWindow"></i>
          <i class="pb-mini-mark me" id="pbMiniMe"></i>
          <i class="pb-mini-mark foe" id="pbMiniFoe"></i>
          <i class="pb-mini-mark shot" id="pbMiniShot" hidden></i>
        </div>
        <div class="pb-anchors" role="group" aria-label="${esc(gT('gAnchorsAria'))}">
          <button type="button" class="pb-anchor" onclick="_pbGameAnchor('me')">${esc(gT('gGoMe'))}</button>
          <button type="button" class="pb-anchor" onclick="_pbGameAnchor('centre')">${esc(gT('gGoCentre'))}</button>
          <button type="button" class="pb-anchor" onclick="_pbGameAnchor('foe')">${esc(gT('gGoFoe'))}</button>
        </div>
      </div>
      <p class="pb-sr-only" id="pbCanvasHelp">${esc(gT('gCanvasHelp'))}</p>
      <div class="pb-banner" id="pbBanner" role="status" aria-live="polite" aria-atomic="true"></div>
      <div class="pb-controls" id="pbControls" aria-label="${esc(gT('gControlsAria'))}">
        <div class="pb-aim-instruction">
          <span class="pb-aim-hand" aria-hidden="true">☝</span>
          <span><strong>${esc(gT('gAimTitle'))}</strong><small>${esc(gT('gAimSub'))}</small></span>
        </div>
        <!-- Dragging is quick but coarse. These give a child an exact number
             to dial in after a near miss, without fighting a fingertip. -->
        <div class="pb-aim-manual" role="group" aria-label="${esc(gT('gManualAria'))}">
          <div class="pb-aim-row">
            <span class="pb-aim-name">↗ ${esc(gT('gAngle'))}</span>
            <button class="pb-step" type="button" id="pbAngleDown"
                    aria-label="${esc(gT('gAngleLess'))}" onclick="_pbGameNudge('angle', -1)">−</button>
            <output class="pb-aim-val" id="pbAngleVal" for="pbAngle">45°</output>
            <button class="pb-step" type="button" id="pbAngleUp"
                    aria-label="${esc(gT('gAngleMore'))}" onclick="_pbGameNudge('angle', 1)">+</button>
          </div>
          <input type="range" class="pb-aim-slider" id="pbAngle" min="10" max="80" step="1" value="45"
                 aria-label="${esc(gT('gAngle'))}" oninput="_pbGameSetAngle(this.value)">
          <div class="pb-aim-row">
            <span class="pb-aim-name">⚡ ${esc(gT('gPower'))}</span>
            <button class="pb-step" type="button" id="pbPowerDown"
                    aria-label="${esc(gT('gPowerLess'))}" onclick="_pbGameNudge('power', -1)">−</button>
            <output class="pb-aim-val" id="pbPowerVal" for="pbPower">60</output>
            <button class="pb-step" type="button" id="pbPowerUp"
                    aria-label="${esc(gT('gPowerMore'))}" onclick="_pbGameNudge('power', 1)">+</button>
          </div>
          <input type="range" class="pb-aim-slider" id="pbPower" min="10" max="100" step="1" value="60"
                 aria-label="${esc(gT('gPower'))}" oninput="_pbGameSetPower(this.value)">
        </div>
        <div class="pb-barrels" role="group" aria-label="${esc(gT('gShotsAria'))}">${barrels}</div>
        <button class="pb-fire" id="pbFire" type="button" onclick="_pbGameFire()">
          <span class="pb-fire-icon" aria-hidden="true"></span>
          <span class="pb-fire-copy"><strong id="pbFireTitle"></strong><small id="pbFireHint"></small></span>
        </button>
        <div class="pb-emotes" role="group" aria-label="${esc(gT('gEmotesAria'))}">
          ${['👍', '😮', '🎉', '😅', '🔥'].map(e =>
            `<button class="pb-emote" type="button" aria-label="${esc(gT('gEmoteAria', { e }))}" onclick="_pbGameEmote('${e}')">${e}</button>`).join('')}
        </div>
      </div>
      </div>`;
    this.canvas = this._el('pbCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    const sceneCanvas = this._el('pbSceneCanvas');
    if (sceneCanvas && typeof BattleSceneRenderer === 'function') {
      const R = this.rules || C.FIELD_RULES[1];
      this.sceneRenderer = new BattleSceneRenderer({
        canvas: sceneCanvas,
        sceneId: this.view.backgroundId,
        worldW: R.worldW,
        viewW: R.viewW,
        viewH: R.viewH,
        reducedMotion: this.reducedMotion,
      });
      this.sceneRenderer.start();
    }
    this._bindAimControls();
    this._cachePets();
    this._shellReady = true;
  }

  this._updateUi(maxShots);
  this.draw();
};

PetBattleGame.prototype._el = function (id) {
  if (this.mount && typeof this.mount.querySelector === 'function') {
    const local = this.mount.querySelector('#' + id);
    if (local) return local;
  }
  return typeof document !== 'undefined' ? document.getElementById(id) : null;
};

PetBattleGame.prototype._updateUi = function (maxShots) {
  const C = this.calc;
  const text = (id, value) => {
    const el = this._el(id);
    const next = String(value);
    if (el && el.textContent !== next) el.textContent = next;
  };
  text('pbBanner', this.banner);
  // the on-field repeat of wind and health
  const fw = this.wind();
  text('pbFieldWind', '💨 ' + (fw > 0 ? '→' : fw < 0 ? '←' : '·') + ' ' + Math.abs(fw));
  text('pbFieldHpMe', Math.max(0, Math.round(this.myHp)));
  text('pbFieldHpFoe', Math.max(0, Math.round(this.foeHp)));
  text('pbFieldAmmoMe', Math.max(0, this.myAmmo) + ' 💩');
  text('pbFieldAmmoFoe', Math.max(0, this.foeAmmo) + ' 💩');
  const bar = (sel, value) => {
    const el = this.mount && this.mount.querySelector ? this.mount.querySelector(sel) : null;
    if (el) el.style.width = Math.max(0, Math.min(100, value)) + '%';
  };
  bar('.pb-fs-side.me .pb-fs-bar u', this.myHp);
  bar('.pb-fs-side.foe .pb-fs-bar u', this.foeHp);
  const announce = (id, value) => {
    const el = this._el(id);
    if (el) el.setAttribute('aria-valuenow', String(Math.max(0, Math.min(100, Math.round(value)))));
  };
  announce('pbFieldMe', this.myHp);
  announce('pbFieldFoe', this.foeHp);
  // The manual controls must follow a drag, a keypress or an opponent's turn,
  // never argue with them.
  text('pbAngleVal', Math.round(this.angle) + '°');
  text('pbPowerVal', Math.round(this.power));
  const angleEl = this._el('pbAngle'); if (angleEl) angleEl.value = Math.round(this.angle);
  const powerEl = this._el('pbPower'); if (powerEl) powerEl.value = Math.round(this.power);
  const aimLocked = !this.myTurn || this.busy;
  for (const id of ['pbAngle', 'pbPower', 'pbAngleDown', 'pbAngleUp', 'pbPowerDown', 'pbPowerUp']) {
    const el = this._el(id); if (el) el.disabled = aimLocked;
  }
  text('pbTurnText', this.myTurn ? gT('gYourTurn') : gT('gFoeTurn'));

  const fire = this._el('pbFire');
  if (fire) {
    fire.disabled = !this.myTurn || this.busy;
    fire.setAttribute('aria-label', this.myTurn ? gT('gFireAria') : gT('gWaitAria'));
  }
  text('pbFireTitle', this.myTurn ? gT('gFire') : gT('gWaiting'));
  text('pbFireHint', this.myTurn ? gT('gFireHint') : gT('gWaitHint'));
  const callout = this._el('pbTurnCallout');
  if (callout) callout.classList.toggle('waiting', !this.myTurn);
  const controls = this._el('pbControls');
  if (controls) controls.setAttribute('aria-busy', this.busy ? 'true' : 'false');
  if (this.mount && typeof this.mount.querySelectorAll === 'function') {
    this.mount.querySelectorAll('[data-pb-shots]').forEach(btn => {
      const n = +(btn.getAttribute('data-pb-shots') || 0);
      btn.disabled = n > maxShots;
      btn.classList.toggle('on', this.shots === n);
      btn.setAttribute('aria-pressed', this.shots === n ? 'true' : 'false');
    });
  }
  this._updateLinkPill();
};

// Direct manipulation keeps the aiming model visible: drag the guide on the
// battlefield, or use arrow keys for precise accessible adjustments.
PetBattleGame.prototype._bindAimControls = function () {
  if (!this.canvas || typeof this.canvas.addEventListener !== 'function') return;
  const aimAt = (event) => {
    if (!this.myTurn || this.busy || this.finished) return;
    if (!event) return;
    const rect = this.canvas.getBoundingClientRect();
    // The canvas shows a window onto the world, so a tap is a VIEWPORT
    // coordinate and has to be shifted by the camera before it means anything.
    const viewX = (event.clientX - rect.left) * this.canvas.width / rect.width;
    const x = this.camera ? this.camera.toWorldX(viewX) : viewX;
    // The canvas carries PB_SKY_EXTRA of sky above the world, so a pointer y
    // has to come back down into world space before it means anything.
    const y = (event.clientY - rect.top) * this.canvas.height / rect.height - PB_SKY_EXTRA;
    const startX = this.mePos.x + this.meFacing * 16;
    const startY = this.mePos.y - 34;
    const forward = (x - startX) * this.meFacing;
    if (forward < 4) return;
    const distance = Math.hypot(forward, startY - y);
    this.angle = Math.max(PB_ANGLE_MIN, Math.min(PB_ANGLE_MAX, Math.atan2(startY - y, forward) * 180 / Math.PI));
    this.power = Math.max(PB_POWER_MIN, Math.min(PB_POWER_MAX, (distance - 46) / .58));
    this._updateUi(this.calc.maxShotsThisTurn(this.myAmmo));
    this.draw();
    _pbBroadcastAim(this);
  };
  // A gesture starts undecided. Only once it is clearly a horizontal drag does
  // it become a camera pan, and only once it is clearly a tap does it aim —
  // so scouting the field can never nudge the angle, and aiming can never
  // scroll the world out from under the finger.
  this.canvas.addEventListener('pointerdown', event => {
    if (this._panPointer !== null) return;                 // ignore extra touches
    this._panPointer = event.pointerId;
    this._gesture = {
      startX: event.clientX, startY: event.clientY,
      at: (typeof performance !== 'undefined' ? performance.now() : 0),
      kind: 'pending',
    };
    if (this.canvas.setPointerCapture) this.canvas.setPointerCapture(event.pointerId);
  });

  this.canvas.addEventListener('pointermove', event => {
    const g = this._gesture;
    if (!g || event.pointerId !== this._panPointer) return;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;

    if (g.kind === 'pending' && typeof classifyGesture === 'function') {
      const verdict = classifyGesture({ dx, dy, dt: 0, onHandle: false });
      if (verdict === 'pan' && this.camera && this.camera.isPannable()) g.kind = 'pan';
    }

    if (g.kind === 'pan') {
      // Drag the world with the finger, in world units.
      const rect = this.canvas.getBoundingClientRect();
      const scale = this.canvas.width / Math.max(1, rect.width);
      const moved = (event.clientX - (g.lastX === undefined ? g.startX : g.lastX)) * scale;
      this.camera.panBy(-moved);
      g.lastX = event.clientX;
      this._followCancelled = true;
      this.draw();
      return;
    }
    if (g.kind === 'aim' || this._draggingAim) aimAt(event);
  });

  const endGesture = (event) => {
    const g = this._gesture;
    if (!g || (event && event.pointerId !== this._panPointer)) return;
    const dx = event ? event.clientX - g.startX : 0;
    const dy = event ? event.clientY - g.startY : 0;
    const dt = (typeof performance !== 'undefined' ? performance.now() : 0) - g.at;
    if (g.kind === 'pending' && typeof classifyGesture === 'function') {
      if (classifyGesture({ dx, dy, dt, released: true }) === 'aim') aimAt(event);
    }
    this._gesture = null;
    this._panPointer = null;
    this._draggingAim = false;
  };
  this.canvas.addEventListener('pointerup', endGesture);
  this.canvas.addEventListener('pointercancel', endGesture);
  this.canvas.addEventListener('keydown', event => {
    if (!this.myTurn || this.busy) return;
    const key = event.key;
    if (key === ' ' || key.startsWith('Arrow')) event.preventDefault();
    if (key === ' ') { this.fire(); return; }
    // Camera anchors, so swipe is never the only way to navigate.
    if (this.camera && this.camera.isPannable()) {
      const view = (this.rules || {}).viewW || 800;
      if (key === 'a' || key === 'A') { this.camera.panBy(-view * 0.2); this._followCancelled = true; this.draw(); return; }
      if (key === 'd' || key === 'D') { this.camera.panBy(view * 0.2); this._followCancelled = true; this.draw(); return; }
      if (key === 'Home') { this.cameraAnchor('me'); return; }
      if (key === 'c' || key === 'C') { this.cameraAnchor('centre'); return; }
      if (key === 'End') { this.cameraAnchor('foe'); return; }
      if (key === 'Escape') { this._followCancelled = true; return; }
    }
    if (key === 'ArrowLeft') this.angle = Math.max(PB_ANGLE_MIN, this.angle - 1);
    else if (key === 'ArrowRight') this.angle = Math.min(PB_ANGLE_MAX, this.angle + 1);
    else if (key === 'ArrowDown') this.power = Math.max(PB_POWER_MIN, this.power - 2);
    else if (key === 'ArrowUp') this.power = Math.min(PB_POWER_MAX, this.power + 2);
    else return;
    this._updateUi(this.calc.maxShotsThisTurn(this.myAmmo));
    this.draw();
    _pbBroadcastAim(this);
  });
};

// A shell is stopped by the castle it is flying AT, never by the one it was
// fired from — otherwise the muzzle, which sits inside its own walls, would
// block every shot at frame one.
PetBattleGame.prototype._blockersFor = function (from) {
  if (!this.rules || !this.rules.castle) return null;
  return [from === this.mePos ? this.foePos : this.mePos];
};

// The camera has to be looking at the shooter BEFORE the shell leaves the
// barrel, or a child who scouted the far end of the field fires into a screen
// showing somewhere else entirely. Defers the launch until the world has
// finished sliding back.
PetBattleGame.prototype._afterCameraReaches = function (worldX, run) {
  const cam = this.camera;
  this._followCancelled = false;                 // a new volley is worth watching
  if (!cam || !cam.isPannable()) { run(); return; }
  cam.focusOn(worldX, { mode: 'turn-focus' });
  if (cam.settled()) { run(); return; }          // already there, or reduced motion
  this._pendingLaunch = run;
  this._requestFrame();
};

// Labelled jumps: My dog / Centre / Opponent. Available as buttons AND keys,
// so a child who cannot swipe accurately is never stuck.
PetBattleGame.prototype.cameraAnchor = function (which) {
  if (!this.camera) return;
  const R = this.rules || {};
  const centre = (R.worldW || 800) / 2;
  const x = which === 'foe' ? this.foePos.x : which === 'centre' ? centre : this.mePos.x;
  this._followCancelled = true;                 // an explicit jump beats follow
  this.camera.focusOn(x, { mode: 'manual' });
  this._requestFrame();
  this.draw();
};

// Called every frame: keep the volley in view unless the child took over.
PetBattleGame.prototype._updateCamera = function (k) {
  const cam = this.camera;
  if (!cam || !cam.isPannable()) return;
  const now = (typeof performance !== 'undefined') ? performance.now() : 0;

  if (this.flying.length && !this._followCancelled) {
    // Follow the CENTROID of the volley, not one shell, so four poops do not
    // yank the camera between them.
    let sx = 0, sv = 0, n = 0;
    for (const f of this.flying) {
      const i = Math.min(f.i, f.points.length - 1);
      const p = f.points[i];
      const prev = f.points[Math.max(0, i - 1)];
      if (!p) continue;
      sx += p.x; sv += (p.x - (prev ? prev.x : p.x)); n++;
    }
    if (n) cam.follow(sx / n, sv / n);
  } else if (!cam.isHolding(now) && cam.mode === 'fire-follow' && !this.flying.length) {
    // Rest where the poop LANDED. Settling back on "whoever shoots next" swung
    // the world away from my own castle the instant an incoming shot hit it —
    // the child was dragged back to the opponent before they could see their
    // own damage. Firing brings the camera home on its own, so nothing is lost
    // by staying put.
    const restAt = (typeof this._lastImpactX === 'number') ? this._lastImpactX
      : (this.myTurn ? this.mePos.x : this.foePos.x);
    cam.focusOn(restAt, { mode: 'turn-settle' });
  }
  cam.update(k);
};

// Minimap, beacons and the Follow-shot control live in the DOM above the
// canvas, so they stay put while the world moves underneath.
PetBattleGame.prototype._updateCameraUi = function () {
  const cam = this.camera;
  const wrap = this._el('pbMinimap');
  if (!cam || !wrap) return;
  if (!cam.isPannable()) { wrap.hidden = true; return; }
  wrap.hidden = false;

  const width = wrap.clientWidth || 200;
  const m = cam.minimap(width);
  const win = this._el('pbMiniWindow');
  if (win) { win.style.left = m.left + 'px'; win.style.width = Math.max(8, m.width) + 'px'; }
  const me = this._el('pbMiniMe'); if (me) me.style.left = m.markerAt(this.mePos.x) + 'px';
  const foe = this._el('pbMiniFoe'); if (foe) foe.style.left = m.markerAt(this.foePos.x) + 'px';
  const shot = this._el('pbMiniShot');
  if (shot) {
    const f = this.flying[0];
    const p = f && f.points[Math.min(f.i, f.points.length - 1)];
    shot.hidden = !p;
    if (p) shot.style.left = m.markerAt(p.x) + 'px';
  }
  // Which way is the opponent, when they are off screen?
  const side = cam.offscreenSide(this.foePos.x);
  const beaconL = this._el('pbBeaconL'), beaconR = this._el('pbBeaconR');
  if (beaconL) beaconL.hidden = side !== -1;
  if (beaconR) beaconR.hidden = side !== 1;
  const follow = this._el('pbFollowBtn');
  if (follow) follow.hidden = !(this._followCancelled && this.flying.length > 0);
};

// The real pets (with their earned outfits) drawn into images once.
PetBattleGame.prototype._cachePets = function () {
  const mk = (stage, level) => {
    if (typeof petDogSVG !== 'function' || typeof Image === 'undefined') return null;
    const svg = petDogSVG({ stageCss: stage, size: 76, level: level, mood: 'happy' });
    const img = new Image();
    img.onload = () => this.draw();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return img;
  };
  this.meImg = mk(this.view.me.stage, this.view.me.level);
  this.foeImg = mk(this.view.foe.stage, this.view.foe.level);
};

// ---- drawing ----
PetBattleGame.prototype.draw = function () {
  const camX = this.camera ? this.camera.x : 0;
  if (this.sceneRenderer) this.sceneRenderer.setCamera(camX);
  if (this.ctx && this.canvas) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  if (this.ctx) { this.ctx.save(); this.ctx.translate(-camX, PB_SKY_EXTRA); }
  this._drawWorld();
  if (this.ctx) this.ctx.restore();
  this._updateCameraUi();
};

PetBattleGame.prototype._drawWorld = function () {
  const ctx = this.ctx, C = this.calc;
  if (!ctx) return;
  const R = this.rules || C.FIELD_RULES[1];
  const W = R.worldW, H = R.worldH;
  const VIEW = R.viewW;
  // Only the slice under the camera is worth painting; on a 2000px world that
  // is 60% of the pixels skipped every frame.
  const vis = this.camera ? this.camera.visibleRange(120) : { from: 0, to: W - 1 };

  // The image scene lives on its own canvas below this one. Wind remains on
  // the gameplay layer because it communicates deterministic match state.
  const cam = this.camera ? this.camera.x : 0;

  // Wind ribbons stay pinned to the viewport: they report this round's wind,
  // so they must be readable wherever the camera happens to be looking.
  const wind = this.wind();
  if (wind !== 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.46)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const y = 48 + i * 33;
      const x = cam + (wind > 0 ? 28 + i * 86 : VIEW - 28 - i * 86);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sign(wind) * (20 + Math.abs(wind) * 1.4), y); ctx.stroke();
    }
    ctx.restore();
  }

  // terrain
  ctx.beginPath();
  ctx.moveTo(vis.from, H);
  for (let x = vis.from; x <= vis.to; x++) ctx.lineTo(x, this.terrain[x]);
  ctx.lineTo(vis.to, H);
  ctx.closePath();
  const scene = typeof BattleScenes !== 'undefined' ? BattleScenes.getBattleScene(this.view.backgroundId) : null;
  const ground = ctx.createLinearGradient(0, 250, 0, H);
  ground.addColorStop(0, scene ? scene.palette.ground : '#75c95e');
  ground.addColorStop(1, '#304f3a');
  ctx.fillStyle = ground;
  ctx.fill();
  ctx.strokeStyle = '#b7ef78';
  ctx.lineWidth = 4;
  ctx.stroke();

  // craters (cosmetic in v1)
  ctx.fillStyle = 'rgba(90,70,40,0.35)';
  for (const c of this.craters) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.r, c.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The pet lives inside a defensive castle. Structural wear follows real HP.
  const meAim = this.angle;
  const foeAim = this.foeAiming ? this.foeAiming.angle : 45;
  this._drawHouse(this.mePos, this.meImg, this.meFacing, this.myHp, meAim, '#38bdf8', this.view.me.level);
  this._drawHouse(this.foePos, this.foeImg, -this.meFacing, this.foeHp, foeAim, '#fb7185', this.view.foe.level);

  // A bright, anchored guide makes angle and power visible on the battlefield.
  if (this.myTurn && !this.busy && !this.flying.length) {
    this._drawTrajectoryPreview(this.mePos, this.meFacing, this.angle, this.power);
    this._drawAimGuide(this.mePos, this.meFacing, this.angle, this.power, '#fde047', false);
  }

  // shells in flight
  for (const f of this.flying) {
    const p = f.points[f.i];
    if (!p) continue;
    // The ammunition is intentionally silly and large enough to follow.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((f.i * .08) * (f.spin || 1));
    ctx.font = `900 ${Math.max(20, f.size * 4)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(46,24,16,.45)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
    ctx.fillText('💩', 0, 0);
    ctx.restore();
    // Warm dust puffs make the slow flight path easy to track.
    ctx.fillStyle = 'rgba(120,78,46,0.34)';
    for (let k = 1; k <= 4; k++) {
      const q = f.points[Math.max(0, f.i - k * 4)];
      if (q) { ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, 6 - k), 0, Math.PI * 2); ctx.fill(); }
    }
  }

  // the opponent's live aim — a faint ghost arc while they line up a shot
  if (this.foeAiming && !this.myTurn && !this.flying.length) {
    const ghost = C.simulateShot({
      terrain: this.terrain, from: this.foePos, facing: -this.meFacing,
      angle: this.foeAiming.angle, power: this.foeAiming.power, wind: this.wind(), rules: this.rules,
      blockers: [this.mePos],
    });
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = 'rgba(220,60,60,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ghost.points.forEach((p, i) => { if (i % 3 === 0) ctx.lineTo(p.x, p.y); });
    ctx.stroke();
    ctx.setLineDash([]);
    this._drawAimGuide(this.foePos, -this.meFacing, this.foeAiming.angle,
      this.foeAiming.power, '#fb7185', true);
  }

  // floating emoji reactions
  for (const em of this.emotes) {
    const k = em.t / em.life;
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.font = `${28 + k * 10}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(em.e, em.x, em.y - k * 40);
    ctx.globalAlpha = 1;
  }

  // explosions
  for (const e of (this.blasts || [])) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * (1 - e.t / e.life), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,${140 + Math.round(80 * e.t / e.life)},60,${1 - e.t / e.life})`;
    ctx.fill();
  }

  for (const p of this.impactParticles) {
    const fade = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0, fade);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.size * fade), 0, Math.PI * 2); ctx.fill();
  }
  // Large masonry fragments sell structural damage much better than sparks.
  for (const piece of this.castleDebris) {
    const fade = Math.max(0, 1 - piece.t / piece.life);
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(piece.x, piece.y); ctx.rotate(piece.rotation);
    ctx.fillStyle = piece.color; ctx.strokeStyle = '#4b3433'; ctx.lineWidth = 1.5;
    ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
    ctx.strokeRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h); ctx.restore();
  }
  for (const hit of this.houseImpacts) {
    const k = hit.t / hit.life;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.strokeStyle = '#fff7ae'; ctx.lineWidth = 7 - k * 4;
    ctx.beginPath(); ctx.arc(hit.x, hit.y, 12 + k * 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#7c2d12'; ctx.font = '900 19px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('💩 HIT!', hit.x, hit.y - 38 - k * 12); ctx.restore();
  }
  ctx.globalAlpha = 1;
};

PetBattleGame.prototype._drawHouse = function (pos, img, facing, hp, angle, accent, level) {
  const ctx = this.ctx;
  const damage = pbHouseDamageStage(hp);
  const wear = 1 - Math.max(0, Math.min(100, Number(hp) || 0)) / 100;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  if (facing < 0) ctx.scale(-1, 1);

  const round = (x, y, w, h, r) => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  };
  const stone = ctx.createLinearGradient(-PB_CASTLE_HALF_W, -PB_CASTLE_HEIGHT, PB_CASTLE_HALF_W, 0);
  stone.addColorStop(0, damage >= 4 ? '#826b68' : '#e3b56f');
  stone.addColorStop(.48, damage >= 3 ? '#aa7863' : '#c98b56');
  stone.addColorStop(1, damage >= 2 ? '#805447' : '#9b5d43');
  const dark = '#3a2d32';
  const mortar = 'rgba(83,55,48,.58)';

  // A broad shadow makes the 140px silhouette feel planted, not pasted on.
  ctx.fillStyle = 'rgba(15,23,42,.34)';
  ctx.beginPath(); ctx.ellipse(0, 5, 78, 12, 0, 0, Math.PI * 2); ctx.fill();

  const rubble = damage >= 5
    ? [[-60,-8,31,15,-.18],[-33,-17,26,16,.21],[-4,-8,38,17,-.09],[30,-13,31,18,.16],[59,-7,27,14,-.22],[-48,-29,20,15,.12],[42,-31,24,16,-.12]]
    : damage >= 4
      ? [[-58,-7,26,13,-.16],[-24,-8,22,12,.18],[22,-7,28,13,-.11],[58,-9,24,14,.2],[44,-25,18,12,-.2]]
      : damage >= 3
        ? [[-59,-7,22,12,-.14],[54,-8,25,13,.18],[-39,-15,18,11,.22]]
        : damage >= 2
          ? [[49,-8,25,13,.18],[18,-8,19,11,-.12]]
          : damage >= 1 ? [[56,-8,26,14,.2],[39,-15,18,12,-.18]] : [];

  // At zero HP the castle is truly gone: big masonry chunks remain while the
  // dog stands in first air, so destruction reads even with motion disabled.
  if (damage >= 5) {
    for (const piece of rubble) {
      ctx.save(); ctx.translate(piece[0], piece[1]); ctx.rotate(piece[4]);
      ctx.fillStyle = piece[0] % 2 ? '#9b6953' : '#c18b61';
      round(-piece[2] / 2, -piece[3] / 2, piece[2], piece[3], 3); ctx.fill();
      ctx.strokeStyle = '#5e4039'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -37, -88, 74, 82);
    ctx.fillStyle = 'rgba(15,23,42,.88)'; round(-29, -111, 58, 23, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.save(); if (facing < 0) ctx.scale(-1, 1);
    ctx.fillText('LV.' + Math.max(1, Number(level) || 1), 0, -95); ctx.restore();
    ctx.restore();
    return;
  }

  // Foundation and main curtain wall. At critical damage the middle is no
  // longer painted at all: two jagged wall remnants replace one dark overlay.
  ctx.fillStyle = '#68483f'; round(-PB_CASTLE_HALF_W, -18, PB_CASTLE_HALF_W * 2, 18, 4); ctx.fill();
  if (damage < 4) {
    ctx.fillStyle = stone; round(-64, -67, 128, 58, 5); ctx.fill();
    ctx.strokeStyle = '#65473e'; ctx.lineWidth = 3; ctx.stroke();
  } else {
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(-64, -9); ctx.lineTo(-64, -67); ctx.lineTo(-47, -74); ctx.lineTo(-35, -50);
    ctx.lineTo(-19, -56); ctx.lineTo(-11, -27); ctx.lineTo(1, -20); ctx.lineTo(1, -9); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(30, -9); ctx.lineTo(30, -34); ctx.lineTo(42, -45); ctx.lineTo(49, -27);
    ctx.lineTo(64, -32); ctx.lineTo(64, -9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#583d38'; ctx.lineWidth = 3; ctx.stroke();
  }

  // Left tower survives longest; its broken stage has a genuinely missing
  // upper half rather than a cosmetic crack drawn on top.
  ctx.fillStyle = stone;
  if (damage < 3) {
    round(-70, -96, 38, 88, 5); ctx.fill(); ctx.strokeStyle = '#65473e'; ctx.lineWidth = 3; ctx.stroke();
    for (const x of [-69, -56, -43]) { ctx.fillRect(x, -109, 10, 16); }
  } else {
    ctx.beginPath(); ctx.moveTo(-70,-8); ctx.lineTo(-70,-63); ctx.lineTo(-59,-72);
    ctx.lineTo(-51,-55); ctx.lineTo(-42,-61); ctx.lineTo(-32,-45); ctx.lineTo(-32,-8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#583d38'; ctx.lineWidth = 3; ctx.stroke();
  }

  // The forward/right tower loses a 38×42px bite on the FIRST hit. This is
  // deliberately large enough to read on a 320px phone screen.
  ctx.fillStyle = stone;
  if (damage === 0) {
    round(32, -96, 38, 88, 5); ctx.fill(); ctx.strokeStyle = '#65473e'; ctx.lineWidth = 3; ctx.stroke();
    for (const x of [33, 46, 59]) ctx.fillRect(x, -109, 10, 16);
  } else if (damage < 4) {
    ctx.beginPath();
    ctx.moveTo(32,-8); ctx.lineTo(32,-57); ctx.lineTo(42,-65); ctx.lineTo(49,-55);
    ctx.lineTo(58,-68); ctx.lineTo(70,-57); ctx.lineTo(70,-8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#583d38'; ctx.lineWidth = 3; ctx.stroke();
    // Exposed black interior below the jagged edge; above it stays transparent
    // so the missing tower chunk changes the outer silhouette against the sky.
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(35,-55); ctx.lineTo(42,-65); ctx.lineTo(49,-55);
    ctx.lineTo(58,-68); ctx.lineTo(67,-57); ctx.lineTo(67,-43); ctx.lineTo(35,-43); ctx.closePath(); ctx.fill();
  }

  // Central keep gives the castle its recognisable crown. Stage two removes
  // the whole right crown and leaves a stepped, broken profile.
  if (damage < 2) {
    ctx.fillStyle = stone; round(-33, -111, 66, 54, 5); ctx.fill();
    ctx.strokeStyle = '#65473e'; ctx.lineWidth = 3; ctx.stroke();
    for (const x of [-31, -11, 10]) ctx.fillRect(x, -123, 14, 15);
  } else if (damage < 4) {
    ctx.fillStyle = stone;
    ctx.beginPath(); ctx.moveTo(-33,-57); ctx.lineTo(-33,-111); ctx.lineTo(-18,-123);
    ctx.lineTo(-5,-105); ctx.lineTo(8,-112); ctx.lineTo(17,-89); ctx.lineTo(10,-71); ctx.lineTo(24,-57); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#583d38'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(12,-76); ctx.lineTo(17,-89); ctx.lineTo(24,-74);
    ctx.lineTo(24,-59); ctx.lineTo(12,-59); ctx.closePath(); ctx.fill();
  }

  // Stone courses reinforce scale without visual noise.
  ctx.strokeStyle = mortar; ctx.lineWidth = 1.5;
  if (damage < 4) {
    for (const y of [-53, -34, -16]) { ctx.beginPath(); ctx.moveTo(-62, y); ctx.lineTo(62, y); ctx.stroke(); }
    for (const x of [-45, -18, 18, 45]) { ctx.beginPath(); ctx.moveTo(x, -66); ctx.lineTo(x, -10); ctx.stroke(); }
  }

  // Arched kennel window. At critical damage the dog is outdoors between the
  // standing wall remnants; otherwise it remains visibly protected inside.
  if (damage < 4) {
    ctx.fillStyle = '#172033';
    ctx.beginPath(); ctx.arc(0, -63, 30, Math.PI, 0); ctx.lineTo(30, -13); ctx.lineTo(-30, -13); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(0, -62, 27, Math.PI, 0); ctx.lineTo(27, -14); ctx.lineTo(-27, -14); ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#bfe7f4'; ctx.fillRect(-28, -65, 56, 53);
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -31, -75, 62, 68);
    ctx.restore();
    ctx.strokeStyle = accent; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, -63, 30, Math.PI, 0); ctx.lineTo(30, -13); ctx.lineTo(-30, -13); ctx.closePath(); ctx.stroke();
  } else if (img && img.complete && img.naturalWidth) {
    ctx.drawImage(img, -34, -82, 68, 75);
  }

  // Soot scales continuously, while missing geometry communicates milestones.
  ctx.fillStyle = `rgba(38,27,33,${(wear * .24).toFixed(3)})`;
  if (damage < 4) ctx.fillRect(-64, -67, 128, 58);

  // Cannon remains aligned with the deterministic 34px muzzle used by physics.
  const rad = angle * Math.PI / 180;
  ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(0, -34, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#172033'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(Math.cos(-rad) * 34, -34 + Math.sin(-rad) * 34); ctx.stroke();
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.stroke();

  // Persistent fractures are thick, branched and high-contrast. They never
  // substitute for the missing wall pieces above; they explain the collapse.
  if (damage >= 2) {
    ctx.strokeStyle = '#3e2c2e'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-23,-101); ctx.lineTo(-12,-87); ctx.lineTo(-20,-73);
    ctx.moveTo(42,-52); ctx.lineTo(29,-43); ctx.lineTo(38,-29); ctx.lineTo(27,-18); ctx.stroke();
  }
  if (damage >= 3) {
    ctx.fillStyle = '#30262c';
    ctx.beginPath(); ctx.moveTo(-64,-48); ctx.lineTo(-51,-60); ctx.lineTo(-38,-48);
    ctx.lineTo(-45,-31); ctx.lineTo(-61,-27); ctx.closePath(); ctx.fill();
  }

  for (const piece of rubble) {
    ctx.save(); ctx.translate(piece[0], piece[1]); ctx.rotate(piece[4]);
    ctx.fillStyle = piece[0] > 0 ? '#b47a59' : '#cf9865';
    round(-piece[2] / 2, -piece[3] / 2, piece[2], piece[3], 3); ctx.fill();
    ctx.strokeStyle = '#5e4039'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }

  // Level badge floats above the crown and remains readable at every stage.
  ctx.fillStyle = accent; round(-30, -149, 60, 23, 9); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
  ctx.save(); if (facing < 0) ctx.scale(-1, 1);
  ctx.fillText('LV.' + Math.max(1, Number(level) || 1), 0, -133); ctx.restore();
  ctx.restore();
};

PetBattleGame.prototype._drawAimGuide = function (pos, facing, angle, power, color, ghost) {
  const ctx = this.ctx;
  const rad = angle * Math.PI / 180;
  const startX = pos.x + facing * 16;
  const startY = pos.y - 34;
  const length = 46 + Math.max(10, Math.min(100, power)) * .58;
  const endX = startX + Math.cos(rad) * length * facing;
  const endY = startY - Math.sin(rad) * length;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalAlpha = ghost ? .58 : 1;
  ctx.strokeStyle = 'rgba(15,23,42,.5)'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.setLineDash(ghost ? [7, 6] : []);
  ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(endX, endY, ghost ? 6 : 9, 0, Math.PI * 2); ctx.fill();
  if (!ghost) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(endX, endY, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(15,23,42,.88)';
    // roundRect is Safari 16.4+ / Chrome 99+. This runs inside draw(), which
    // runs every frame, so on an older phone one TypeError would kill the
    // whole battle rather than just this label. Square corners are fine.
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(endX - 25, endY - 37, 50, 22, 8);
    else ctx.rect(endX - 25, endY - 37, 50, 22);
    ctx.fill();
  }
  ctx.fillStyle = ghost ? '#0f172a' : '#fff'; ctx.font = '900 14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(Math.round(angle) + '°', endX, endY - 21);
  ctx.restore();
};

PetBattleGame.prototype._drawTrajectoryPreview = function (from, facing, angle, power) {
  const shot = this.calc.simulateShot({
    terrain: this.terrain, from, facing, angle, power, wind: this.wind(), rules: this.rules,
    blockers: this._blockersFor(from),
  });
  const ctx = this.ctx;
  ctx.save();
  for (let i = 10; i < shot.points.length; i += 13) {
    const p = shot.points[i];
    if (!p || p.y < 8) continue;
    const fade = Math.max(.18, 1 - i / Math.max(1, shot.points.length));
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x, p.y, i % 26 === 0 ? 4 : 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,.65)'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
};

PetBattleGame.prototype._hasActiveAnimation = function () {
  if (this._pendingLaunch) return true;          // keep ticking until it fires
  // A travelling camera counts: the frame loop must keep running until the
  // world has finished sliding, or a pan would freeze halfway.
  const camMoving = !!(this.camera && this.camera.isPannable() && !this.camera.settled());
  return camMoving || this.flying.length > 0 || (this.blasts || []).length > 0 || this.impactParticles.length > 0 || this.castleDebris.length > 0 || this.houseImpacts.length > 0 || this.emotes.some(e => !e.static);
};

PetBattleGame.prototype._requestFrame = function () {
  if (this._destroyed || this._raf !== null) return;
  if (typeof requestAnimationFrame !== 'function') {
    this.step();
    this.draw();
    return;
  }
  this._raf = requestAnimationFrame((now) => {
    this._raf = null;
    if (this._destroyed) return;
    const t = (typeof now === 'number') ? now
      : (typeof performance !== 'undefined' ? performance.now() : 0);
    const last = this._lastFrameAt;
    this._lastFrameAt = t;
    const k = last ? (t - last) / 16.667 : 1;
    this.step(k);
    this._updateCamera(k);
    if (this._pendingLaunch && (!this.camera || this.camera.settled())) {
      const launch = this._pendingLaunch;
      this._pendingLaunch = null;
      launch();
    }
    this.draw();
    if (this._hasActiveAnimation()) this._requestFrame();
    else this._lastFrameAt = 0;                    // next burst starts fresh
  });
};

// Advance every animation by one frame.
// `k` is elapsed time expressed in 60Hz ticks, so every duration below stays
// tuned in the units it was written in while the PACE no longer depends on the
// display: a 120Hz iPhone was running the whole battle at double speed, which
// is the opposite of the slow readable flight this is meant to have. Clamped
// so returning from a backgrounded tab does not teleport a shell.
PetBattleGame.prototype.step = function (k) {
  const C = this.calc;
  k = (typeof k === 'number' && isFinite(k) && k > 0) ? Math.min(3, k) : 1;
  this.blasts = (this.blasts || []).filter(b => (b.t += k) < b.life);
  this.impactParticles = this.impactParticles.filter(p => {
    p.t += k; p.x += p.vx * k; p.y += p.vy * k; p.vy += .16 * k;
    return p.t < p.life;
  });
  this.castleDebris = this.castleDebris.filter(piece => {
    piece.t += k; piece.x += piece.vx * k; piece.y += piece.vy * k;
    piece.vy += .2 * k; piece.rotation += piece.spin * k;
    return piece.t < piece.life;
  });
  this.houseImpacts = this.houseImpacts.filter(hit => (hit.t += k) < hit.life);
  this.emotes = this.emotes.filter(e => e.static || (e.t += k) < e.life);
  if (!this.flying.length) return;
  let allDone = true;
  for (const f of this.flying) {
    if (f.i < f.points.length - 1) {
      f.tick = (f.tick || 0) + k;
      // one path point per two 60Hz ticks — the original readable pace
      while (f.tick >= 2 && f.i < f.points.length - 1) { f.tick -= 2; f.i += 1; }
      allDone = false;
    }
    else if (!f.done) {
      f.done = true;
      if (f.hit) {
        this.blasts.push({ x: f.hit.x, y: f.hit.y, r: C.blastRadius(f.level), t: 0, life: this.reducedMotion ? 1 : 22 });
        this.craters.push({ x: f.hit.x, y: f.hit.y, r: C.blastRadius(f.level) * 0.8 });
        if (!this.reducedMotion) {
          const colors = ['#fff7ae', '#ffb020', '#ff5b36', '#5b3924'];
          for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            const speed = 1.6 + (i % 5) * .62;
            this.impactParticles.push({
              x: f.hit.x, y: f.hit.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 1.3,
              t: 0, life: 22 + (i % 4) * 4, size: 5 - (i % 3), color: colors[i % colors.length],
            });
          }
        }
        if (f.damage > 0) {
          this.houseImpacts.push({ x: f.target.x, y: f.target.y - 62, t: 0, life: this.reducedMotion ? 1 : 34 });
          if (!this.reducedMotion) {
            const masonry = ['#e0ae6b', '#bd7954', '#8b5a4c', '#5b4140'];
            for (let i = 0; i < 14; i++) {
              const side = i % 2 ? 1 : -1;
              this.castleDebris.push({
                x: f.target.x + side * (8 + i % 4), y: f.target.y - 62 - (i % 3) * 5,
                vx: side * (1.1 + (i % 5) * .38), vy: -2.2 - (i % 4) * .55,
                rotation: i * .47, spin: side * (.045 + (i % 3) * .018),
                w: 8 + (i % 4) * 3, h: 6 + (i % 3) * 3,
                color: masonry[i % masonry.length], t: 0, life: 34 + (i % 5) * 5,
              });
            }
          }
        }
      }
    }
  }
  if (allDone && this.flying.every(f => f.done)) {
    const pending = this._pendingResolve;
    this.flying = [];
    this._pendingResolve = null;
    if (pending) pending();
  }
};

// Fire a volley locally and return the damage it deals to `target`.
PetBattleGame.prototype._launch = function (from, facing, angle, power, shots, level, target) {
  const C = this.calc;
  const angles = C.volleyAngles(angle, shots, this.seed, this.turnNo);
  let damage = 0;
  this._lastHitCount = 0;
  this.flying = angles.map(a => {
    const sim = C.simulateShot({
      terrain: this.terrain, from, facing, angle: a, power, wind: this.wind(), rules: this.rules,
      blockers: [target],
    });
    const bulletDamage = C.damageAt(sim.hit, target, level, this.rules);
    damage += bulletDamage;
    if (bulletDamage > 0) this._lastHitCount += 1;
    return {
      points: sim.points, hit: sim.hit,
      i: this.reducedMotion ? Math.max(0, sim.points.length - 1) : 0, damage: bulletDamage, target,
      done: false, size: C.shellSize(level), level, spin: a % 2 ? 1 : -1,
    };
  });
  return Math.min(100, damage);
};

// One line per volley, kept so the child can replay the story of a battle
// afterwards ("vòng 3, bé bắn 4 tia ngược gió, trượt"). Recorded as the shot
// RESOLVES, so the HP figures are the ones that were really on screen.
PetBattleGame.prototype._logTurn = function (mine, aim, damage) {
  if (!Array.isArray(this.log)) this.log = [];
  if (this.log.length >= 40) return;                 // a battle is 10 turns; this is a guard
  this.log.push({
    mine: !!mine,
    round: this.roundNo(),
    turnNo: this.turnNo,
    shots: aim.shots,
    angle: aim.angle,
    power: aim.power,
    wind: this.wind(),
    damage: Math.max(0, Math.round(damage || 0)),
    myHp: this.myHp,
    foeHp: this.foeHp,
  });
};

// Out of poop: hand the turn over without animating anything. The server
// treats shots=0 as a skip and charges no ammo.
PetBattleGame.prototype._passTurn = function () {
  if (!this.myTurn || this.busy || this.finished) return;
  this.myTurn = false;
  this.sendTurn({ turnNo: this.turnNo, angle: this.angle, power: this.power, shots: 0, damage: 0 })
    .then((res) => { if (res && res.battle) this._applyServer(res.battle); })
    .catch(() => {});
  this.render();
};

// ---- my turn ----
PetBattleGame.prototype.fire = function () {
  if (!this.myTurn || this.busy || this.finished) return;
  const C = this.calc;
  // Math.max(1, …) used to fire a phantom poop on an empty clip. Now that a
  // battle runs until the ammo does, an empty turn must pass, not shoot.
  const maxShots = C.maxShotsThisTurn(this.myAmmo);
  if (maxShots <= 0) { this._passTurn(); return; }
  // Lock the turn NOW, before the camera travels, so a second tap during the
  // pan cannot fire twice.
  this.busy = true;
  // A child may have scouted anywhere on a 2000px field. Bring the world back
  // to their own castle first, THEN fire and follow the shell.
  this._afterCameraReaches(this.mePos.x, () => this._launchMyVolley(maxShots));
};

PetBattleGame.prototype._launchMyVolley = function (maxShots) {
  if (this.finished) { this.busy = false; return; }
  const C = this.calc;
  const shots = Math.max(1, Math.min(maxShots, this.shots));
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !this.reducedMotion) navigator.vibrate(18);
  this.myAmmo -= shots;
  const damage = this._launch(this.mePos, this.meFacing, this.angle, this.power, shots, this.view.me.level, this.foePos);

  const aim = { angle: Math.round(this.angle), power: Math.round(this.power), shots };

  this._pendingResolve = () => {
    const oldHouseStage = pbHouseDamageStage(this.foeHp);
    this.foeHp = Math.max(0, this.foeHp - damage);
    const houseWorsened = pbHouseDamageStage(this.foeHp) > oldHouseStage;
    const hitCount = Math.max(1, this._lastHitCount);
    this.banner = damage > 0
      ? gT('gHit', { n: hitCount, d: damage }) + (houseWorsened ? gT('gHouseWorse') : '')
      : gT('gMiss');
    this.myTurn = false;
    this.busy = false;
    this._lastImpactX = this.foePos.x;          // my shot landed over there
    this._logTurn(true, aim, damage);
    this._drainTurns();
    this.sendTurn({ turnNo: this.turnNo, angle: this.angle, power: this.power, shots, damage })
      .then((res) => { if (res && res.battle) this._applyServer(res.battle); })
      .catch(() => {});
    this.render();
  };
  this._requestFrame();
};

// ---- the opponent's turn, replayed from (angle, power, shots) ----
PetBattleGame.prototype._replay = function (turn) {
  const C = this.calc;
  this.turnNo = turn.turn_no;
  const shots = Math.max(0, Math.min(C.BARRELS, turn.shots || 0));
  if (shots === 0) {
    this.banner = gT('gSkip', { name: this.view.foe.name || gT('gFoe') });
    this.render();
    return;
  }
  // Same courtesy in reverse: swing to the OPPONENT's castle before their
  // shell leaves, so a child sees where the incoming poop is coming from
  // instead of a shell arriving from off-screen.
  this.busy = true;
  this._afterCameraReaches(this.foePos.x, () => this._launchFoeVolley(turn, shots));
};

PetBattleGame.prototype._launchFoeVolley = function (turn, shots) {
  if (this.finished) { this.busy = false; return; }
  const C = this.calc;
  this.foeAmmo = Math.max(0, this.foeAmmo - shots);
  const damage = this._launch(this.foePos, -this.meFacing, turn.angle, turn.power, shots, this.view.foe.level, this.mePos);
  this._pendingResolve = () => {
    const dealt = Math.max(damage, turn.damage || 0);
    const oldHouseStage = pbHouseDamageStage(this.myHp);
    this.myHp = Math.max(0, this.myHp - dealt);
    const houseWorsened = pbHouseDamageStage(this.myHp) > oldHouseStage;
    const hitCount = Math.max(1, this._lastHitCount);
    this.banner = dealt > 0
      ? gT('gHitMe', { n: hitCount, d: dealt }) + (houseWorsened ? gT('gHouseWorse') : '')
      : gT('gMissFoe');
    this.busy = false;
    this._lastImpactX = this.mePos.x;           // their shot landed on ME — stay here
    this._drainTurns();
    this._logTurn(false, { angle: Math.round(turn.angle || 0), power: Math.round(turn.power || 0), shots }, dealt);
    this.render();
  };
  this._requestFrame();
};

// ---- server state (polling transport) ----
PetBattleGame.prototype.onServerState = function (data) {
  if (this.finished || !data || !data.battle) return;
  const myId = this.view.me.id;
  for (const t of (data.turns || [])) {
    if (t.turn_no <= (this._seenTurn || 0)) continue;
    this._seenTurn = t.turn_no;
    this.onSeenTurn(t.turn_no);
    // A poll after a reconnect can return several unseen turns at once. The
    // old code replayed the first and silently discarded the rest.
    if (t.user_id !== myId) this._queueTurn(t);
  }
  this._applyServer(data.battle);
};

PetBattleGame.prototype._applyServer = function (b) {
  if (this.finished) return;
  // Server is authoritative for HP/turn; local animation just leads it slightly.
  this.myHp = b.me.hp;
  this.foeHp = b.foe.hp;
  this.myAmmo = b.me.ammo;
  this.foeAmmo = b.foe.ammo;
  this.turnNo = b.turnNo || this.turnNo;
  if (!this.busy) {
    this.myTurn = !!b.myTurn;
    this.render();
  }
  if (b.status === 'done') {
    this.finished = true;
    const won = b.winnerId === this.view.me.id;
    setTimeout(() => this.onFinish({
      won, myHp: this.myHp, foeHp: this.foeHp, foeName: this.view.foe.name,
      foeLevel: this.view.foe.level || 1,
      myLevel: this.view.me.level || 1,
      rounds: (this.log || []).slice(),
    }), 900);
  }
};

// ---- control hooks (inline onclick handlers talk to the live game) ----
function _pbBroadcastAim(g) {
  // Let the opponent watch us line up the shot (throttled inside BattleLink).
  if (g && g.link && g.myTurn) g.link.sendAim(g.angle, g.power, g.shots);
}
function _pbGameSetAngle(v) {
  const g = _pbCurrentGame();
  if (!g || !g.myTurn || g.busy || g.finished) return;
  const n = Number(v);
  if (!isFinite(n)) return;
  g.angle = Math.max(PB_ANGLE_MIN, Math.min(PB_ANGLE_MAX, n));
  g._updateUi(g.calc.maxShotsThisTurn(g.myAmmo));
  g.draw();
  _pbBroadcastAim(g);
}
function _pbGameSetPower(v) {
  const g = _pbCurrentGame();
  if (!g || !g.myTurn || g.busy || g.finished) return;
  const n = Number(v);
  if (!isFinite(n)) return;
  g.power = Math.max(PB_POWER_MIN, Math.min(PB_POWER_MAX, n));
  g._updateUi(g.calc.maxShotsThisTurn(g.myAmmo));
  g.draw();
  _pbBroadcastAim(g);
}
// One step per tap: the point of these buttons is the exact ±1 a fingertip
// cannot manage on a 320px slider.
function _pbGameNudge(which, delta) {
  const g = _pbCurrentGame();
  if (!g) return;
  if (which === 'angle') _pbGameSetAngle(g.angle + delta);
  else _pbGameSetPower(g.power + delta);
}

function _pbGameSetShots(n) { const g = _pbCurrentGame(); if (g) { g.shots = +n; g.render(); _pbBroadcastAim(g); } }
function _pbGameFire() { const g = _pbCurrentGame(); if (g) g.fire(); }
function _pbGameEmote(e) { const g = _pbCurrentGame(); if (g) g.sendEmote(e); }
function _pbCurrentGame() { return (typeof _pbGame !== 'undefined') ? _pbGame : null; }
function _pbGameAnchor(which) { const g = _pbCurrentGame(); if (g) g.cameraAnchor(which); }
function _pbGameFollow() {
  const g = _pbCurrentGame();
  if (!g) return;
  g._followCancelled = false;                    // hand the camera back to the shot
  g._requestFrame();
  g.draw();
}

// 🇬🇧/🇻🇳 mid-battle. Most of the text is baked into the shell markup, which is
// built once, so the language switch has to rebuild it — cheap, and it keeps
// the arena and the battle on one setting instead of two that can disagree.
function _pbGameSetLang(lang) {
  if (typeof pbSetLang === 'function') pbSetLang(lang);   // no-ops the arena render while a game is up
  const g = _pbCurrentGame();
  if (!g || g.finished) return;
  g._shellReady = false;
  g.render();
  g.draw();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PetBattleGame, pbHouseDamageStage, pbHeartFills };
}
