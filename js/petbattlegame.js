// petbattlegame.js — the artillery duel itself: canvas rendering, aiming,
// the 4-barrel volley and replaying the opponent's shots.
// All physics/terrain/wind come from battlecalc.js and the shared seed, so
// both phones draw exactly the same battle from just (angle, power, shots).

const PB_HEARTS = 5;

// The battle borrows the arena's string table and its 🇬🇧/🇻🇳 choice, so one
// flag governs the whole flow and the parity test covers these strings too.
// In Node (tests) neither exists; the key comes back and nothing renders.
const gT = (k, vars) => (typeof pbT === 'function' ? pbT(k, vars) : k);
const gLang = () => (typeof _pbLang !== 'undefined' ? _pbLang : 'en');

// Pure presentation helpers: HP remains server-authoritative, while these
// convert it into readable Gunbound-style house damage and heart segments.
function pbHouseDamageStage(hp) {
  const safe = Math.max(0, Math.min(100, Number(hp) || 0));
  if (safe <= 0) return 4;
  if (safe <= 25) return 3;
  if (safe <= 50) return 2;
  if (safe <= 75) return 1;
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
  this.terrain = C.buildTerrain(this.seed);
  const spawns = C.spawnPoints(this.terrain);
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
  this.impactParticles = [];
  this.houseImpacts = [];
  this._lastHitCount = 0;
  this.reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

// ---- realtime events (all no-ops when the link is unavailable) ----
// A turn relayed by the room — replay it now instead of waiting for a poll.
PetBattleGame.prototype.onLiveTurn = function (turn) {
  if (this.finished || !turn) return;
  if (turn.turn_no <= (this._seenTurn || 0)) return;      // already played
  this._seenTurn = turn.turn_no;
  this.onSeenTurn(turn.turn_no);
  if (turn.user_id !== this.view.me.id && !this.busy) {
    this.foeAiming = null;
    this._replay(turn);
  }
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

PetBattleGame.prototype.roundNo = function () {
  return Math.min(this.calc.BATTLE_ROUNDS, Math.ceil(this.turnNo / 2));
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
  if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
  if (this._aimTimer) clearTimeout(this._aimTimer);
  this._effectTimers.forEach(timer => clearTimeout(timer));
  this._raf = null;
  this._aimTimer = null;
  this._effectTimers = [];
};

// ---- layout ----
PetBattleGame.prototype.render = function () {
  const v = this.view, C = this.calc;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const maxShots = C.maxShotsThisTurn(this.myAmmo);
  this.shots = Math.max(1, Math.min(this.shots, Math.max(1, maxShots)));

  if (!this._shellReady) {
    const hearts = side => `<div class="pb-hearts" id="pbHearts${side}" aria-hidden="true">
      ${Array.from({ length: PB_HEARTS }, () => '<span class="pb-heart">♥</span>').join('')}
    </div>`;
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
      <div class="pb-hud">
        <div class="pb-hud-side">
          <div class="pb-hud-name" id="pbMeName">${esc(v.me.name || gT('gMe'))}</div>
          <div class="pb-hp" id="pbHpTrackMe" role="progressbar" aria-labelledby="pbMeName pbHpMeText"
               aria-valuemin="0" aria-valuemax="100">
            <div class="pb-hp-fill me" id="pbHpMe"></div>
          </div>
          <div class="pb-hp-value" id="pbHpMeText"></div>
          ${hearts('Me')}
          <div class="pb-hud-ammo" id="pbAmmoMe">${this.myAmmo} 💩</div>
          <div class="pb-hud-level">LV.${Math.max(1, Number(v.me.level) || 1)}</div>
        </div>
        <div class="pb-hud-mid">
          <div class="pb-round" id="pbRound"></div>
          <div class="pb-wind" id="pbWind"></div>
          <div class="pb-link" id="pbLink" role="status" aria-live="polite"></div>
        </div>
        <div class="pb-hud-side right">
          <div class="pb-hud-name" id="pbFoeName">${esc(v.foe.name || gT('gFoe'))}</div>
          <div class="pb-hp" id="pbHpTrackFoe" role="progressbar" aria-labelledby="pbFoeName pbHpFoeText"
               aria-valuemin="0" aria-valuemax="100">
            <div class="pb-hp-fill foe" id="pbHpFoe"></div>
          </div>
          <div class="pb-hp-value" id="pbHpFoeText"></div>
          ${hearts('Foe')}
          <div class="pb-hud-ammo" id="pbAmmoFoe">${this.foeAmmo} 💩</div>
          <div class="pb-hud-level">LV.${Math.max(1, Number(v.foe.level) || 1)}</div>
        </div>
      </div>
      <div class="pb-field-shell">
        <canvas id="pbCanvas" class="pb-canvas" width="${C.FIELD_W}" height="${C.FIELD_H}" tabindex="0"
                role="img" aria-label="${esc(gT('gCanvasAria'))}" aria-describedby="pbCanvasHelp">
          ${esc(gT('gCanvasFallback'))}
        </canvas>
        <div class="pb-field-readout" aria-hidden="true">
          <span><small>${esc(gT('gAngle'))}</small><b id="pbFieldAngle">45°</b></span>
          <span><small>${esc(gT('gPower'))}</small><b id="pbFieldPower">60</b></span>
        </div>
        <div class="pb-drag-hint" id="pbDragHint" aria-hidden="true">${esc(gT('gDragHint'))}</div>
      </div>
      <p class="pb-sr-only" id="pbCanvasHelp">${esc(gT('gCanvasHelp'))}</p>
      <div class="pb-banner" id="pbBanner" role="status" aria-live="polite" aria-atomic="true"></div>
      <div class="pb-controls" id="pbControls" aria-label="${esc(gT('gControlsAria'))}">
        <div class="pb-aim-instruction">
          <span class="pb-aim-hand" aria-hidden="true">☝</span>
          <span><strong>${esc(gT('gAimTitle'))}</strong><small>${esc(gT('gAimSub'))}</small></span>
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
  const hp = (side, value) => {
    const safe = Math.max(0, Math.min(100, value));
    const fill = this._el(side === 'Me' ? 'pbHpMe' : 'pbHpFoe');
    const track = this._el(side === 'Me' ? 'pbHpTrackMe' : 'pbHpTrackFoe');
    if (fill) fill.style.width = safe + '%';
    if (track) track.setAttribute('aria-valuenow', String(safe));
    text(side === 'Me' ? 'pbHpMeText' : 'pbHpFoeText', safe + ' HP');
    const hearts = this._el(side === 'Me' ? 'pbHeartsMe' : 'pbHeartsFoe');
    if (hearts && typeof hearts.querySelectorAll === 'function') {
      const fills = pbHeartFills(safe);
      hearts.querySelectorAll('.pb-heart').forEach((heart, i) => {
        heart.style.setProperty('--heart-fill', (fills[i] || 0) + '%');
      });
    }
  };

  hp('Me', this.myHp);
  hp('Foe', this.foeHp);
  text('pbAmmoMe', this.myAmmo + ' 💩');
  text('pbAmmoFoe', this.foeAmmo + ' 💩');
  text('pbRound', gT('gRound', { n: this.roundNo(), total: C.BATTLE_ROUNDS }));
  const wind = this.wind();
  text('pbWind', '💨 ' + (wind > 0 ? '→' : wind < 0 ? '←' : '·') + ' ' + Math.abs(wind));
  text('pbBanner', this.banner);
  text('pbFieldAngle', Math.round(this.angle) + '°');
  text('pbFieldPower', Math.round(this.power));
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
  const dragHint = this._el('pbDragHint');
  if (dragHint) dragHint.hidden = !this.myTurn || this.busy;
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
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * this.canvas.width / rect.width;
    const y = (event.clientY - rect.top) * this.canvas.height / rect.height;
    const startX = this.mePos.x + this.meFacing * 16;
    const startY = this.mePos.y - 34;
    const forward = (x - startX) * this.meFacing;
    if (forward < 4) return;
    const distance = Math.hypot(forward, startY - y);
    this.angle = Math.max(10, Math.min(80, Math.atan2(startY - y, forward) * 180 / Math.PI));
    this.power = Math.max(10, Math.min(100, (distance - 46) / .58));
    this._updateUi(this.calc.maxShotsThisTurn(this.myAmmo));
    this.draw();
    _pbBroadcastAim(this);
  };
  this.canvas.addEventListener('pointerdown', event => {
    if (!this.myTurn || this.busy) return;
    this._draggingAim = true;
    if (this.canvas.setPointerCapture) this.canvas.setPointerCapture(event.pointerId);
    aimAt(event);
  });
  this.canvas.addEventListener('pointermove', event => { if (this._draggingAim) aimAt(event); });
  const stop = () => { this._draggingAim = false; };
  this.canvas.addEventListener('pointerup', stop);
  this.canvas.addEventListener('pointercancel', stop);
  this.canvas.addEventListener('keydown', event => {
    if (!this.myTurn || this.busy) return;
    const key = event.key;
    if (key === ' ' || key.startsWith('Arrow')) event.preventDefault();
    if (key === ' ') { this.fire(); return; }
    if (key === 'ArrowLeft') this.angle = Math.max(10, this.angle - 1);
    else if (key === 'ArrowRight') this.angle = Math.min(80, this.angle + 1);
    else if (key === 'ArrowDown') this.power = Math.max(10, this.power - 2);
    else if (key === 'ArrowUp') this.power = Math.min(100, this.power + 2);
    else return;
    this._updateUi(this.calc.maxShotsThisTurn(this.myAmmo));
    this.draw();
    _pbBroadcastAim(this);
  });
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
  const ctx = this.ctx, C = this.calc;
  if (!ctx) return;
  const W = C.FIELD_W, H = C.FIELD_H;

  // Layered arcade sky: readable silhouettes and a stronger Gunbound mood.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#4568dc');
  sky.addColorStop(0.52, '#8dc7ff');
  sky.addColorStop(1, '#e8f7df');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,244,180,.88)';
  ctx.beginPath(); ctx.arc(W * .78, 68, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  for (const cloud of [[110,72,1],[360,112,.72],[650,82,.9]]) {
    ctx.save(); ctx.translate(cloud[0], cloud[1]); ctx.scale(cloud[2], cloud[2]);
    ctx.beginPath(); ctx.arc(-28, 0, 18, 0, Math.PI * 2); ctx.arc(0, -8, 25, 0, Math.PI * 2);
    ctx.arc(31, 2, 17, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = 'rgba(61,89,148,.22)';
  ctx.beginPath(); ctx.moveTo(0, 280);
  for (let x = 0; x <= W; x += 80) ctx.lineTo(x, 190 + ((x / 80) % 2 ? 48 : 0));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();

  // Wind ribbons make the round modifier readable without staring at the HUD.
  const wind = this.wind();
  if (wind !== 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.46)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const y = 48 + i * 33;
      const x = wind > 0 ? 28 + i * 86 : W - 28 - i * 86;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sign(wind) * (20 + Math.abs(wind) * 1.4), y); ctx.stroke();
    }
    ctx.restore();
  }

  // terrain
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x < W; x++) ctx.lineTo(x, this.terrain[x]);
  ctx.lineTo(W, H);
  ctx.closePath();
  const ground = ctx.createLinearGradient(0, 250, 0, H);
  ground.addColorStop(0, '#75c95e');
  ground.addColorStop(1, '#3d8d3f');
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

  // The pet lives inside a defensive house. House wear follows real HP.
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
      angle: this.foeAiming.angle, power: this.foeAiming.power, wind: this.wind(),
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

  // shadow, walls and roof
  ctx.fillStyle = 'rgba(22,31,50,.28)';
  ctx.beginPath(); ctx.ellipse(0, 4, 51, 9, 0, 0, Math.PI * 2); ctx.fill();

  // At zero HP the shelter is gone: only rubble and the pet remain outdoors.
  if (damage >= 4) {
    ctx.fillStyle = '#6f3f35';
    for (const piece of [[-42,-9,25,12],[0,-7,30,14],[34,-10,22,11],[-20,-20,18,12]]) {
      ctx.save(); ctx.translate(piece[0], piece[1]); ctx.rotate(piece[0] * .012);
      ctx.fillRect(-piece[2] / 2, -piece[3] / 2, piece[2], piece[3]); ctx.restore();
    }
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -31, -72, 62, 68);
    ctx.fillStyle = 'rgba(15,23,42,.86)'; ctx.beginPath(); ctx.roundRect(-25, -89, 50, 20, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.save(); if (facing < 0) ctx.scale(-1, 1);
    ctx.fillText('LV.' + Math.max(1, Number(level) || 1), 0, -75); ctx.restore();
    ctx.restore();
    return;
  }
  const wall = ctx.createLinearGradient(-42, -56, 42, 0);
  wall.addColorStop(0, damage >= 3 ? '#9a6254' : '#f0a65b');
  wall.addColorStop(1, damage >= 2 ? '#b56a4a' : '#d97945');
  ctx.fillStyle = wall;
  ctx.fillRect(-43, -58, 86, 58);
  // Continuous soot means every damaging hit changes the house, even before
  // it crosses one of the larger crack/scorch milestones.
  ctx.fillStyle = `rgba(43,25,30,${(wear * .28).toFixed(3)})`;
  ctx.fillRect(-43, -58, 86, 58);
  ctx.strokeStyle = '#6f3f35'; ctx.lineWidth = 3; ctx.strokeRect(-43, -58, 86, 58);
  ctx.fillStyle = damage >= 3 ? '#743d45' : '#b84c57';
  ctx.beginPath(); ctx.moveTo(-52, -57); ctx.lineTo(0, -91); ctx.lineTo(52, -57); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6b3340'; ctx.lineWidth = 4; ctx.stroke();

  // window and the pet safely framed inside it
  ctx.fillStyle = damage >= 4 ? '#251f27' : '#dff6ff';
  ctx.fillRect(-27, -55, 54, 45);
  ctx.save(); ctx.beginPath(); ctx.rect(-25, -53, 50, 41); ctx.clip();
  if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -25, -61, 50, 54);
  ctx.restore();
  ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.strokeRect(-27, -55, 54, 45);
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -55); ctx.lineTo(0, -10); ctx.stroke();

  ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(-25, -107, 50, 19, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '900 11px sans-serif'; ctx.textAlign = 'center';
  ctx.save(); if (facing < 0) ctx.scale(-1, 1);
  ctx.fillText('LV.' + Math.max(1, Number(level) || 1), 0, -93); ctx.restore();

  // side cannon uses the same angle as the visible aiming guide
  const rad = angle * Math.PI / 180;
  ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(0, -34, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(Math.cos(-rad) * 31, -34 + Math.sin(-rad) * 31);
  ctx.stroke();

  // deterministic damage marks; no random flicker between clients.
  if (damage >= 1) {
    ctx.strokeStyle = '#5b352f'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-35, -48); ctx.lineTo(-26, -39); ctx.lineTo(-34, -29);
    ctx.moveTo(34, -20); ctx.lineTo(24, -27); ctx.lineTo(30, -38); ctx.stroke();
  }
  if (damage >= 2) {
    ctx.fillStyle = 'rgba(45,35,35,.55)';
    ctx.beginPath(); ctx.arc(-30, -9, 8, 0, Math.PI * 2); ctx.arc(31, -49, 6, 0, Math.PI * 2); ctx.fill();
  }
  if (damage >= 3) {
    ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-11, -51); ctx.lineTo(7, -28); ctx.moveTo(12, -52); ctx.lineTo(-6, -31); ctx.stroke();
    ctx.fillStyle = 'rgba(31,41,55,.46)';
    ctx.beginPath(); ctx.arc(28, -82, 11, 0, Math.PI * 2); ctx.arc(36, -96, 8, 0, Math.PI * 2); ctx.fill();
  }
  if (damage >= 4) {
    ctx.fillStyle = '#3f2930';
    ctx.beginPath(); ctx.moveTo(-52, -57); ctx.lineTo(-20, -77); ctx.lineTo(-6, -58); ctx.closePath(); ctx.fill();
  }
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
    terrain: this.terrain, from, facing, angle, power, wind: this.wind(),
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
  return this.flying.length > 0 || (this.blasts || []).length > 0 || this.impactParticles.length > 0 || this.houseImpacts.length > 0 || this.emotes.some(e => !e.static);
};

PetBattleGame.prototype._requestFrame = function () {
  if (this._destroyed || this._raf !== null) return;
  if (typeof requestAnimationFrame !== 'function') {
    this.step();
    this.draw();
    return;
  }
  this._raf = requestAnimationFrame(() => {
    this._raf = null;
    if (this._destroyed) return;
    this.step();
    this.draw();
    if (this._hasActiveAnimation()) this._requestFrame();
  });
};

// Advance every animation by one frame.
PetBattleGame.prototype.step = function () {
  const C = this.calc;
  this.blasts = (this.blasts || []).filter(b => (b.t += 1) < b.life);
  this.impactParticles = this.impactParticles.filter(p => {
    p.t += 1; p.x += p.vx; p.y += p.vy; p.vy += .16;
    return p.t < p.life;
  });
  this.houseImpacts = this.houseImpacts.filter(hit => (hit.t += 1) < hit.life);
  this.emotes = this.emotes.filter(e => e.static || (e.t += 1) < e.life);
  if (!this.flying.length) return;
  let allDone = true;
  for (const f of this.flying) {
    if (f.i < f.points.length - 1) {
      f.tick = (f.tick || 0) + 1;
      if (f.tick % 2 === 0) f.i += 1;                                   // half-speed, readable flight
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
          this.houseImpacts.push({ x: f.target.x, y: f.target.y - 43, t: 0, life: this.reducedMotion ? 1 : 34 });
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
      terrain: this.terrain, from, facing, angle: a, power, wind: this.wind(),
    });
    const bulletDamage = C.damageAt(sim.hit, target, level);
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

// ---- my turn ----
PetBattleGame.prototype.fire = function () {
  if (!this.myTurn || this.busy || this.finished) return;
  const C = this.calc;
  const shots = Math.max(1, Math.min(C.maxShotsThisTurn(this.myAmmo), this.shots));
  if (shots <= 0) return;
  this.busy = true;
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
    this._logTurn(true, aim, damage);
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
  this.busy = true;
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
    if (t.user_id !== myId && !this.busy) this._replay(t);
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
function _pbGameSetShots(n) { const g = _pbCurrentGame(); if (g) { g.shots = +n; g.render(); _pbBroadcastAim(g); } }
function _pbGameFire() { const g = _pbCurrentGame(); if (g) g.fire(); }
function _pbGameEmote(e) { const g = _pbCurrentGame(); if (g) g.sendEmote(e); }
function _pbCurrentGame() { return (typeof _pbGame !== 'undefined') ? _pbGame : null; }

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
