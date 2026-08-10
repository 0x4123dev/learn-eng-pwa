// petbattlegame.js — the artillery duel itself: canvas rendering, aiming,
// the 4-barrel volley and replaying the opponent's shots.
// All physics/terrain/wind come from battlecalc.js and the shared seed, so
// both phones draw exactly the same battle from just (angle, power, shots).

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
  this._destroyed = false;
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
};
PetBattleGame.prototype.onEmote = function (e) {
  this.emotes.push({ e, t: 0, life: 90, x: this.foePos.x, y: this.foePos.y - 90 });
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
  const el = document.getElementById('pbLink');
  if (!el) return;
  const live = this.linkMode === 'live';
  el.className = 'pb-link ' + (live ? 'live' : 'slow');
  el.textContent = live ? (this.foeHere ? '⚡ Trực tiếp' : '⚡ Đang chờ bạn…') : '🐢 Chậm';
};
PetBattleGame.prototype.sendEmote = function (e) {
  if (this.link) this.link.sendEmote(e);
  this.emotes.push({ e, t: 0, life: 90, x: this.mePos.x, y: this.mePos.y - 90 });
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
  this.loop();
};

PetBattleGame.prototype.destroy = function () {
  this._destroyed = true;
  if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
  this._raf = null;
};

// ---- layout ----
PetBattleGame.prototype.render = function () {
  const v = this.view, C = this.calc;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const maxShots = C.maxShotsThisTurn(this.myAmmo);
  this.shots = Math.max(1, Math.min(this.shots, Math.max(1, maxShots)));

  const barrels = [1, 2, 3, 4].map(n => `
    <button class="pb-barrel ${this.shots === n ? 'on' : ''}" ${n > maxShots ? 'disabled' : ''}
            onclick="_pbGameSetShots(${n})">${n} tia</button>`).join('');

  this.mount.innerHTML = `
    <div class="pb-game">
      <div class="pb-hud">
        <div class="pb-hud-side">
          <div class="pb-hud-name">${esc(v.me.name || 'Bé')}</div>
          <div class="pb-hp"><div class="pb-hp-fill me" id="pbHpMe" style="width:${this.myHp}%"></div></div>
          <div class="pb-hud-ammo" id="pbAmmoMe">${this.myAmmo} 🚀</div>
        </div>
        <div class="pb-hud-mid">
          <div class="pb-round">Vòng ${this.roundNo()}/${C.BATTLE_ROUNDS}</div>
          <div class="pb-wind">💨 ${this.wind() > 0 ? '→' : this.wind() < 0 ? '←' : '·'} ${Math.abs(this.wind())}</div>
          <div class="pb-link ${this.linkMode === 'live' ? 'live' : 'slow'}" id="pbLink">${
            this.linkMode === 'live' ? (this.foeHere ? '⚡ Trực tiếp' : '⚡ Đang chờ bạn…') : '🐢 Chậm'}</div>
        </div>
        <div class="pb-hud-side right">
          <div class="pb-hud-name">${esc(v.foe.name || 'Bạn')}</div>
          <div class="pb-hp"><div class="pb-hp-fill foe" id="pbHpFoe" style="width:${this.foeHp}%"></div></div>
          <div class="pb-hud-ammo" id="pbAmmoFoe">${this.foeAmmo} 🚀</div>
        </div>
      </div>
      <canvas id="pbCanvas" class="pb-canvas" width="${C.FIELD_W}" height="${C.FIELD_H}"></canvas>
      <div class="pb-banner" id="pbBanner">${esc(this.banner)}</div>
      <div class="pb-controls" id="pbControls">
        <div class="pb-slider-row">
          <label>Góc <b id="pbAngleVal">${Math.round(this.angle)}°</b></label>
          <input type="range" id="pbAngle" min="10" max="80" value="${Math.round(this.angle)}"
                 oninput="_pbGameSetAngle(this.value)">
        </div>
        <div class="pb-slider-row">
          <label>Lực <b id="pbPowerVal">${Math.round(this.power)}</b></label>
          <input type="range" id="pbPower" min="10" max="100" value="${Math.round(this.power)}"
                 oninput="_pbGameSetPower(this.value)">
        </div>
        <div class="pb-barrels">${barrels}</div>
        <button class="pb-fire" id="pbFire" onclick="_pbGameFire()" ${this.myTurn && !this.busy ? '' : 'disabled'}>
          ${this.myTurn ? '🔥 BẮN!' : '⏳ Chờ bạn ấy…'}
        </button>
        <div class="pb-emotes">
          ${['👍', '😮', '🎉', '😅', '🔥'].map(e =>
            `<button class="pb-emote" onclick="_pbGameEmote('${e}')">${e}</button>`).join('')}
        </div>
      </div>
    </div>`;
  this.canvas = document.getElementById('pbCanvas');
  this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
  this._cachePets();
};

// The real pets (with their earned outfits) drawn into images once.
PetBattleGame.prototype._cachePets = function () {
  const mk = (stage, level) => {
    if (typeof petDogSVG !== 'function' || typeof Image === 'undefined') return null;
    const svg = petDogSVG({ stageCss: stage, size: 76, level: level, mood: 'happy' });
    const img = new Image();
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

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#bfe6ff');
  sky.addColorStop(1, '#e8f8e0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // terrain
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x < W; x++) ctx.lineTo(x, this.terrain[x]);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = '#7cc36a';
  ctx.fill();
  ctx.strokeStyle = '#5aa84c';
  ctx.lineWidth = 3;
  ctx.stroke();

  // craters (cosmetic in v1)
  ctx.fillStyle = 'rgba(90,70,40,0.35)';
  for (const c of this.craters) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.r, c.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // pets
  this._drawPet(this.mePos, this.meImg, this.meFacing);
  this._drawPet(this.foePos, this.foeImg, -this.meFacing);

  // shells in flight
  for (const f of this.flying) {
    const p = f.points[f.i];
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, f.size, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b3d';
    ctx.fill();
    ctx.strokeStyle = '#c73e12';
    ctx.lineWidth = 2;
    ctx.stroke();
    // little smoke trail
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let k = 1; k <= 4; k++) {
      const q = f.points[Math.max(0, f.i - k * 3)];
      if (q) { ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, f.size - k), 0, Math.PI * 2); ctx.fill(); }
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
};

PetBattleGame.prototype._drawPet = function (pos, img, facing) {
  const ctx = this.ctx;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  if (facing < 0) ctx.scale(-1, 1);
  // cart
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(-22, -12, 44, 14);
  ctx.fillStyle = '#5d4037';
  ctx.beginPath(); ctx.arc(-13, 2, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(13, 2, 7, 0, Math.PI * 2); ctx.fill();
  // barrel
  ctx.strokeStyle = '#455a64';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(Math.cos(-this.angle * Math.PI / 180) * 26, -18 + Math.sin(-this.angle * Math.PI / 180) * 26);
  ctx.stroke();
  // the pet itself
  if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -34, -78, 68, 73);
  ctx.restore();
};

PetBattleGame.prototype.loop = function () {
  if (this._destroyed) return;
  this.step();
  this.draw();
  if (typeof requestAnimationFrame === 'function') {
    this._raf = requestAnimationFrame(() => this.loop());
  }
};

// Advance every animation by one frame.
PetBattleGame.prototype.step = function () {
  const C = this.calc;
  this.blasts = (this.blasts || []).filter(b => (b.t += 1) < b.life);
  this.emotes = this.emotes.filter(e => (e.t += 1) < e.life);
  if (this.foeAiming && Date.now() - this.foeAiming.at > 4000) this.foeAiming = null;
  if (!this.flying.length) return;
  let allDone = true;
  for (const f of this.flying) {
    if (f.i < f.points.length - 1) { f.i += 2; allDone = false; }        // 2 sim steps/frame
    else if (!f.done) {
      f.done = true;
      if (f.hit) {
        this.blasts.push({ x: f.hit.x, y: f.hit.y, r: C.blastRadius(f.level), t: 0, life: 22 });
        this.craters.push({ x: f.hit.x, y: f.hit.y, r: C.blastRadius(f.level) * 0.8 });
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
  this.flying = angles.map(a => {
    const sim = C.simulateShot({
      terrain: this.terrain, from, facing, angle: a, power, wind: this.wind(),
    });
    damage += C.damageAt(sim.hit, target, level);
    return { points: sim.points, hit: sim.hit, i: 0, done: false, size: C.shellSize(level), level };
  });
  return Math.min(100, damage);
};

// ---- my turn ----
PetBattleGame.prototype.fire = function () {
  if (!this.myTurn || this.busy || this.finished) return;
  const C = this.calc;
  const shots = Math.max(1, Math.min(C.maxShotsThisTurn(this.myAmmo), this.shots));
  if (shots <= 0) return;
  this.busy = true;
  this.myAmmo -= shots;
  const damage = this._launch(this.mePos, this.meFacing, this.angle, this.power, shots, this.view.me.level, this.foePos);

  this._pendingResolve = () => {
    this.foeHp = Math.max(0, this.foeHp - damage);
    this.banner = damage > 0 ? `💥 Trúng! -${damage} HP` : '💨 Trượt rồi!';
    this.myTurn = false;
    this.busy = false;
    this.sendTurn({ turnNo: this.turnNo, angle: this.angle, power: this.power, shots, damage })
      .then((res) => { if (res && res.battle) this._applyServer(res.battle); })
      .catch(() => {});
    this.render();
  };
};

// ---- the opponent's turn, replayed from (angle, power, shots) ----
PetBattleGame.prototype._replay = function (turn) {
  const C = this.calc;
  this.turnNo = turn.turn_no;
  const shots = Math.max(0, Math.min(C.BARRELS, turn.shots || 0));
  if (shots === 0) {
    this.banner = `⏭️ ${this.view.foe.name || 'Bạn'} bỏ lượt`;
    this.render();
    return;
  }
  this.busy = true;
  this.foeAmmo = Math.max(0, this.foeAmmo - shots);
  const damage = this._launch(this.foePos, -this.meFacing, turn.angle, turn.power, shots, this.view.foe.level, this.mePos);
  this._pendingResolve = () => {
    this.myHp = Math.max(0, this.myHp - Math.max(damage, turn.damage || 0));
    this.banner = (turn.damage || damage) > 0 ? `💥 Bé trúng đạn! -${turn.damage || damage} HP` : '💨 Bạn ấy bắn trượt!';
    this.busy = false;
    this.render();
  };
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
  if (!g) return;
  g.angle = +v;
  const el = document.getElementById('pbAngleVal'); if (el) el.textContent = Math.round(g.angle) + '°';
  _pbBroadcastAim(g);
}
function _pbGameSetPower(v) {
  const g = _pbCurrentGame();
  if (!g) return;
  g.power = +v;
  const el = document.getElementById('pbPowerVal'); if (el) el.textContent = Math.round(g.power);
  _pbBroadcastAim(g);
}
function _pbGameSetShots(n) { const g = _pbCurrentGame(); if (g) { g.shots = +n; g.render(); _pbBroadcastAim(g); } }
function _pbGameFire() { const g = _pbCurrentGame(); if (g) g.fire(); }
function _pbGameEmote(e) { const g = _pbCurrentGame(); if (g) g.sendEmote(e); }
function _pbCurrentGame() { return (typeof _pbGame !== 'undefined') ? _pbGame : null; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PetBattleGame };
}
