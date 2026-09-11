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

// The aim preview shows the first few points of the arc and stops. Drawing the
// whole flight path traced the shell onto the opponent's castle, which told a
// child exactly where it would land and left nothing to judge — the game aimed
// for them.
//
// The dots are spaced by DISTANCE, not by frame index: at full power a shell
// covers ~37px per frame, so five evenly-indexed dots stretched across the
// entire field and gave the landing away just as badly. Five dots, 55px apart,
// stay a short tracer off the barrel whatever the power.
const PB_AIM_PREVIEW_POINTS = 5;
const PB_AIM_PREVIEW_GAP = 55;
const PB_CASTLE_HALF_W = 70;
const PB_CASTLE_HEIGHT = 122;

// The castle art below is hand-drawn against a 70x122 box across five damage
// stages. Rather than redraw all of that geometry for the bigger v4 fortress,
// the whole drawing is SCALED from the active ruleset — so the picture and the
// hitbox cannot drift apart, which is how v2 shipped a wall you could hit for
// zero damage.
function pbCastleScale(rules) {
  const c = rules && rules.castle;
  if (!c) return { sx: 1, sy: 1 };
  return { sx: c.halfW / PB_CASTLE_HALF_W, sy: c.height / PB_CASTLE_HEIGHT };
}

// Where hired đồng đội stand inside the keep, in the SAME native 70x122 space
// the art is authored in — the squad is drawn inside the already-scaled
// context, so measuring against the larger v4 box would scale them twice and
// hang the planks out in open sky.
//
// Placed against real masonry, not a tidy grid: each tower (x ±32..70) takes
// two storeys, the keep (x ±33, y -111..-57) takes the crow's nest. Nobody
// stands over the arched kennel window, so the dog is never covered.
const PB_LEDGE_SLOTS = [
  { x: -51, y: -30 },
  { x:  51, y: -30 },
  { x: -51, y: -62 },
  { x:  51, y: -62 },
  { x:   0, y: -88 },
];

function pbLedgeSpots(count) {
  const n = Math.max(0, Math.min(PB_LEDGE_SLOTS.length, Math.trunc(Number(count) || 0)));
  return PB_LEDGE_SLOTS.slice(0, n).map(slot => ({ x: slot.x, y: slot.y }));
}

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
  const TEAM = (typeof BattleTeam !== 'undefined' && BattleTeam.TEAM_ROSTER)
    ? BattleTeam
    : require('./battle-teammates.js');
  this.team = TEAM;

  this.seed = this.view.seed >>> 0;
  // Geometry comes from the version SNAPSHOTTED on the battle, not from
  // whatever this build prefers — otherwise two phones on different app
  // versions would draw different terrain from the same seed mid-match.
  this.rules = C.fieldRules ? C.fieldRules(this.view.fieldVersion) : null;
  this.minAngle = this.rules && this.rules.highArc ? 35 : PB_ANGLE_MIN;
  this.terrain = C.buildTerrain(this.seed, this.rules, this.view.backgroundId);
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
  // Hired đồng đội are passive for the whole battle. Normalised on arrival: the foe's list
  // came off another device and must never be trusted for length or contents.
  this.myCharges = TEAM.buildCharges(this.view.me.hires);
  this.foeCharges = TEAM.buildCharges(this.view.foe.hires);
  // A castle repairs up to ITS OWN ceiling, which food raises.
  this.myMaxHp = TEAM.startingHp(this.view.me.level);
  this.foeMaxHp = TEAM.startingHp(this.view.foe.level);
  this.myAmmo = this.view.me.ammo;
  this.foeAmmo = this.view.foe.ammo;
  this.craters = [];
  this.flying = [];                      // shells being animated
  this.banner = '';
  this.hireOpen = false;
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
  this.projectileSmoke = [];
  this.castleDebris = [];
  this.houseImpacts = [];
  this.castleHoles = [];
  this._lastHitCount = 0;
  this.sceneRenderer = null;
  if (typeof CastleSkins !== 'undefined' && CastleSkins.preload) {
    CastleSkins.preload(() => {
      if (!this._destroyed && this.ctx && this.canvas) {
        this.draw();
        this._requestFrame();
      }
    });
  }
  pbPreloadMateImages(() => {
    if (!this._destroyed && this.ctx && this.canvas) {
      this.draw();
      this._requestFrame();
    }
  });
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
  if (typeof window !== 'undefined' && window.addEventListener && !this._orientationHandler) {
    this._orientationHandler = () => {
      const landscape = window.matchMedia && window.matchMedia('(orientation: landscape)').matches;
      const tip = this._el('pbRotateTip');
      if (tip && landscape) tip.hidden = true;
      setTimeout(() => { if (!this._destroyed) this.draw(); }, 120);
    };
    window.addEventListener('orientationchange', this._orientationHandler);
    window.addEventListener('resize', this._orientationHandler);
  }
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
  if (typeof window !== 'undefined' && window.removeEventListener && this._orientationHandler) {
    window.removeEventListener('orientationchange', this._orientationHandler);
    window.removeEventListener('resize', this._orientationHandler);
  }
  this._orientationHandler = null;
};

PetBattleGame.prototype.enterLandscape = async function () {
  if (typeof document === 'undefined') return false;
  const game = this.mount && this.mount.querySelector ? this.mount.querySelector('.pb-game') : null;
  const fullscreenTarget = game || document.documentElement;
  let locked = false;

  // Orientation lock is accepted by Chromium only from a user gesture and,
  // on many phones, only after entering fullscreen. Both calls therefore stay
  // directly inside the button handler; failures are normal on iOS Safari.
  try {
    if (!document.fullscreenElement && fullscreenTarget && fullscreenTarget.requestFullscreen) {
      await fullscreenTarget.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch (e) {}
  try {
    if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
      locked = true;
    }
  } catch (e) {}

  const isLandscape = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(orientation: landscape)').matches : false;
  const tip = this._el('pbRotateTip');
  if (tip) tip.hidden = isLandscape || locked;
  return locked || isLandscape;
};

// ---- layout ----
PetBattleGame.prototype.render = function () {
  // A game can legitimately exist without a mount — the rules and the ability
  // state are useful on their own, and the tests drive a battle with no DOM at
  // all. Drawing is then simply a no-op rather than a crash.
  if (!this.mount) return;
  const v = this.view, C = this.calc;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const maxShots = C.maxShotsThisTurn(this.myAmmo);
  this.shots = Math.max(1, Math.min(this.shots, Math.max(1, maxShots)));

  if (!this._shellReady) {
    // A status chip per hired đồng đội. They are not buttons: every teammate
    // is active automatically and stays active until the battle ends.
    const squadChips = this._squadHTML();
    const barrels = [1, 2, 3, 4].map(n => `
      <button class="pb-barrel" type="button" data-pb-shots="${n}"
              aria-label="${esc(gT('gLoadAria', { n }))}" onclick="_pbGameSetShots(${n})">
        <span class="pb-poop-stack" aria-hidden="true">${Array.from({ length: n }, () => '<i>💩</i>').join('')}</span>
        <span>${esc(gT('gShots', { n }))}</span>
      </button>`).join('');

    this.mount.innerHTML = `
      <div class="pb-game">
      <div class="pb-game-topbar">
        <button class="pb-game-hire" id="pbHireButton" type="button" onclick="pbOpenBattleHire()"
                aria-label="${esc(gT('hireButtonAria'))}">
          <span aria-hidden="true">+</span><b>${esc(gT('hireButton'))}</b><small id="pbHireBalance">${Math.max(0, Number(typeof appState !== 'undefined' && appState ? appState.coins : 0) || 0).toLocaleString()} 🪙</small>
        </button>
        <div class="pb-turn-callout" id="pbTurnCallout" role="status" aria-live="polite">
          <span class="pb-turn-dot" aria-hidden="true"></span><span id="pbTurnText"></span>
          <div class="pb-lang pb-game-lang" role="group" aria-label="Language">
            <button class="pb-flag ${gLang() === 'en' ? 'on' : ''}" type="button"
                    onclick="_pbGameSetLang('en')" aria-pressed="${gLang() === 'en'}">🇬🇧<span>EN</span></button>
            <button class="pb-flag ${gLang() === 'vi' ? 'on' : ''}" type="button"
                    onclick="_pbGameSetLang('vi')" aria-pressed="${gLang() === 'vi'}">🇻🇳<span>VI</span></button>
          </div>
        </div>
        <button class="pb-landscape-btn" type="button" onclick="_pbGameLandscape()"
                aria-label="${esc(gT('gLandscapeAria'))}" title="${esc(gT('gLandscape'))}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="7" width="14" height="10" rx="2"></rect><path d="M8 4 5 7l3 3M16 20l3-3-3-3"></path></svg>
          <span>${esc(gT('gLandscape'))}</span>
        </button>
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
          <span><strong>${esc(gT('gAimTitle'))}</strong><small>${esc(this.rules && this.rules.highArc ? gT('gHighArcSub') : gT('gAimSub'))}</small></span>
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
          <input type="range" class="pb-aim-slider" id="pbAngle" min="${this.minAngle}" max="80" step="1" value="45"
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
        <div id="pbSquadSlot">${squadChips}</div>
        <div class="pb-emotes" role="group" aria-label="${esc(gT('gEmotesAria'))}">
          ${['👍', '😮', '🎉', '😅', '🔥'].map(e =>
            `<button class="pb-emote" type="button" aria-label="${esc(gT('gEmoteAria', { e }))}" onclick="_pbGameEmote('${e}')">${e}</button>`).join('')}
        </div>
      </div>
      <div class="pb-fire-dock">
        <button class="pb-fire" id="pbFire" type="button" onclick="_pbGameFire()">
          <span class="pb-fire-icon" aria-hidden="true"></span>
          <span class="pb-fire-copy"><strong id="pbFireTitle"></strong><small id="pbFireHint"></small></span>
        </button>
      </div>
      <div class="pb-rotate-tip" id="pbRotateTip" role="dialog" aria-modal="true" aria-labelledby="pbRotateTitle" hidden>
        <div class="pb-rotate-phone" aria-hidden="true"><i></i></div>
        <strong id="pbRotateTitle">${esc(gT('gRotateTitle'))}</strong>
        <span>${esc(gT('gRotateHint'))}</span>
        <button type="button" onclick="_pbGameCloseRotateTip()">${esc(gT('gRotateClose'))}</button>
      </div>
      <div class="pb-hire-layer" id="pbHireLayer" hidden></div>
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
  // Busy can change while the dialog is open (for example when a volley lands).
  // Refresh the footer so Confirm unlocks again at the next safe boundary.
  if (this.hireOpen && typeof _pbRefreshHireUi === 'function') _pbRefreshHireUi();
  this.draw();
};

PetBattleGame.prototype._squadHTML = function () {
  if (!(this.myCharges || []).length) return '';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div class="pb-squad" role="list" aria-label="${esc(gT('gSquadAria'))}">
    ${this.myCharges.map(c => {
      const avatar = pbMateAvatarURL(c.id, 38);
      return `<div class="pb-squad-chip active" role="listitem"
              aria-label="${esc(gT('gUse' + c.id.charAt(0).toUpperCase() + c.id.slice(1)))}">
        <img class="pb-squad-avatar" alt="" aria-hidden="true" src="${avatar}" loading="lazy" decoding="async">
        <span class="pb-squad-active" aria-hidden="true">∞</span>
      </div>`;
    }).join('')}
  </div>`;
};

PetBattleGame.prototype.applyBattleHires = function (battle) {
  if (!battle || !battle.me || !battle.foe) return false;
  const mine = this.team.normalizeHires(battle.me.hires);
  const theirs = this.team.normalizeHires(battle.foe.hires);
  const beforeMine = this.team.normalizeHires(this.view.me.hires);
  const beforeTheirs = this.team.normalizeHires(this.view.foe.hires);
  const changed = JSON.stringify(mine) !== JSON.stringify(beforeMine)
    || JSON.stringify(theirs) !== JSON.stringify(beforeTheirs);
  if (!changed) return false;
  this.view.me.hires = mine;
  this.view.foe.hires = theirs;
  this.myCharges = this.team.buildCharges(mine);
  this.foeCharges = this.team.buildCharges(theirs);
  const slot = this._el('pbSquadSlot');
  if (slot) slot.innerHTML = this._squadHTML();
  this.draw();
  return true;
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
  const windAbs=Math.abs(fw);
  const windStrength=windAbs>=14?'strong':windAbs>=7?'medium':windAbs>0?'light':'calm';
  const windLabel=gT('gWind'+windStrength.charAt(0).toUpperCase()+windStrength.slice(1));
  text('pbFieldWind','💨 '+(fw>0?'→':fw<0?'←':'·')+' '+windAbs+' · '+windLabel);
  const windEl=this._el('pbFieldWind');
  if (windEl && windEl.dataset.strength!==windStrength) windEl.dataset.strength=windStrength;
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
    this.angle = Math.max(this.minAngle, Math.min(PB_ANGLE_MAX, Math.atan2(startY - y, forward) * 180 / Math.PI));
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
    if (key === 'ArrowLeft') this.angle = Math.max(this.minAngle, this.angle - 1);
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
  // Only the world jolts on a damaging impact; the HUD and controls stay
  // fixed. The quickly decaying two-axis shake makes heavy masonry feel heavy
  // without moving the player's touch targets.
  let shakeX=0, shakeY=0;
  const impact=this.houseImpacts && this.houseImpacts[this.houseImpacts.length-1];
  if (impact && !this.reducedMotion) {
    const force=Math.max(0,1-impact.t/impact.life)*7*(impact.strength||1);
    shakeX=Math.sin(impact.t*2.7)*force;
    shakeY=Math.cos(impact.t*3.9)*force*.45;
  }
  if (this.ctx) {
    this.ctx.save();
    this.ctx.translate(-camX, PB_SKY_EXTRA);
    if (shakeX || shakeY) this.ctx.translate(shakeX,shakeY);
  }
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
  this._drawHouse(this.mePos, this.meImg, this.meFacing, this.myHp, meAim, '#38bdf8', this.view.me.level, this.myCharges, this.view.me.castleSkin);
  this._drawHouse(this.foePos, this.foeImg, -this.meFacing, this.foeHp, foeAim, '#fb7185', this.view.foe.level, this.foeCharges, this.view.foe.castleSkin);

  // A bright, anchored guide makes angle and power visible on the battlefield.
  if (this.myTurn && !this.busy && !this.flying.length) {
    this._drawTrajectoryPreview(this.mePos, this.meFacing, this.angle, this.power);
    this._drawAimGuide(this.mePos, this.meFacing, this.angle, this.power, '#fde047', false);
  }

  // Persistent smoke is painted before the ammunition so the projectile stays
  // crisp at the head of a soft, widening plume. Particles survive the impact
  // briefly, which gives the same readable shot history as a real shell trail.
  for (const smoke of this.projectileSmoke) {
    const age=Math.min(1,smoke.t/smoke.life), fade=Math.pow(1-age,1.45);
    const radius=smoke.size*(.72+age*.9);
    ctx.save(); ctx.globalAlpha=fade*(smoke.rocket ? .72 : .54);
    ctx.fillStyle=smoke.rocket?'#46505d':'#54463e';
    ctx.beginPath(); ctx.arc(smoke.x,smoke.y,radius,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=fade*.3; ctx.fillStyle=smoke.rocket?'#cbd5e1':'#b69a84';
    ctx.beginPath(); ctx.arc(smoke.x-radius*.22,smoke.y-radius*.26,radius*.52,0,Math.PI*2); ctx.fill();
    if (smoke.rocket && age < .24) {
      ctx.globalAlpha=(1-age/.24)*.75; ctx.fillStyle='#fb923c';
      ctx.beginPath(); ctx.arc(smoke.x,smoke.y,Math.max(1.5,radius*.28),0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // shells in flight
  for (const f of this.flying) {
    const p = f.points[f.i];
    if (!p) continue;
    // The ammunition is intentionally silly and large enough to follow.
    // A Pháo thủ's rocket flies the same arc but must NOT look like another
    // poop: it flew and dealt damage from the first build, and drawing 💩 for
    // it meant the child could not see the teammate had done anything.
    const prev = f.points[Math.max(0, f.i - 1)];
    ctx.save();
    ctx.translate(p.x, p.y);
    if (f.rocket) {
      // Nose-first along its own travel. This is purpose-drawn game art, not
      // a platform emoji whose shape and colour change between devices.
      ctx.rotate(Math.atan2(p.y - (prev ? prev.y : p.y), p.x - (prev ? prev.x : p.x)));
      _pbDrawRocketProjectile(ctx, f.size, f.i);
    } else {
      ctx.rotate((f.i * .08) * (f.spin || 1));
      _pbDrawPoopProjectile(ctx,f.size,f.i);
    }
    ctx.restore();
    // Trail: warm dust behind a poop, hot exhaust behind a rocket, so the two
    // are still tellable apart mid-flight when they overlap.
    for (let k = 1; k <= 6; k++) {
      const q = f.points[Math.max(0, f.i - k * 3)];
      if (!q) continue;
      ctx.fillStyle = f.rocket
        ? (k <= 2 ? `rgba(253,186,116,${.62 - k * .12})` : `rgba(226,232,240,${.42 - k * .07})`)
        : `rgba(255,221,143,${Math.max(.08,.46-k*.055)})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, f.rocket ? Math.max(2.5, 7 - k) : Math.max(2, 7-k*.7), 0, Math.PI * 2);
      ctx.fill();
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

  // Layered impact: expanding shockwave, hot fireball and white-hot core.
  // It reads against every arena palette and leaves particles/debris to carry
  // the motion after the central flash is gone.
  for (const e of (this.blasts || [])) {
    const k=Math.min(1,e.t/e.life), fade=1-k, radius=e.r*(.28+k*1.15);
    ctx.save();
    ctx.strokeStyle=`rgba(255,247,174,${fade*.9})`; ctx.lineWidth=Math.max(2,8-k*6);
    ctx.beginPath(); ctx.arc(e.x,e.y,radius,0,Math.PI*2); ctx.stroke();
    const fire=ctx.createRadialGradient(e.x-radius*.18,e.y-radius*.2,1,e.x,e.y,Math.max(2,radius*.78));
    fire.addColorStop(0,`rgba(255,255,255,${fade})`);
    fire.addColorStop(.22,`rgba(255,238,88,${fade*.96})`);
    fire.addColorStop(.58,`rgba(249,115,22,${fade*.9})`);
    fire.addColorStop(1,'rgba(127,29,29,0)');
    ctx.fillStyle=fire; ctx.beginPath(); ctx.arc(e.x,e.y,radius*.82,0,Math.PI*2); ctx.fill();
    ctx.restore();
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
    ctx.fillStyle = piece.color; ctx.strokeStyle = '#2b1b1d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-piece.w*.55,-piece.h*.28); ctx.lineTo(-piece.w*.12,-piece.h*.58);
    ctx.lineTo(piece.w*.55,-piece.h*.22); ctx.lineTo(piece.w*.36,piece.h*.55);
    ctx.lineTo(-piece.w*.48,piece.h*.38); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.36)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-piece.w*.36,-piece.h*.2); ctx.lineTo(piece.w*.24,-piece.h*.34); ctx.stroke(); ctx.restore();
  }
  for (const hit of this.houseImpacts) {
    const k = hit.t / hit.life;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.strokeStyle = '#fff7ae'; ctx.lineWidth = 8 - k * 5;
    ctx.beginPath(); ctx.arc(hit.x, hit.y, 12 + k * 34, 0, Math.PI * 2); ctx.stroke();
    // Twelve sharp rays connect the explosion to the castle break rather than
    // looking like a soft decorative bubble.
    ctx.strokeStyle=`rgba(255,129,45,${1-k})`; ctx.lineWidth=Math.max(1,4-k*3);
    for (let ray=0;ray<12;ray++) {
      const a=ray*Math.PI/6, inner=17+k*12, outer=35+k*38;
      ctx.beginPath(); ctx.moveTo(hit.x+Math.cos(a)*inner,hit.y+Math.sin(a)*inner);
      ctx.lineTo(hit.x+Math.cos(a)*outer,hit.y+Math.sin(a)*outer); ctx.stroke();
    }
    ctx.font = '900 20px sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin='round';
    ctx.strokeStyle='rgba(38,16,12,.82)'; ctx.lineWidth=5;
    ctx.strokeText('💩 HIT!', hit.x, hit.y - 43 - k * 14);
    ctx.fillStyle = '#fff7ae'; ctx.fillText('💩 HIT!', hit.x, hit.y - 43 - k * 14); ctx.restore();
  }
  ctx.globalAlpha = 1;
};

// ---- the hired squad, drawn as little characters ----
// Chibi proportions on purpose — a big head, small body and a bold dark
// outline are what make a 16px-tall figure on a phone still read as somebody,
// the way the units in a tower-defence game do. Flat blocks did not.
//
// Each is authored inside roughly a 30x34 box with its feet at y=0, in native
// castle space, and is drawn upright whichever way the castle faces.
const PB_MATE_INK = '#20232e';       // one dark ink for every outline

// Shared chibi body: boots, torso, arms, then a big round head. Colours differ
// per character; the silhouette does not, so they read as one squad.
function _pbChibi(ctx, o) {
  const ink = PB_MATE_INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ground shadow
  ctx.fillStyle = 'rgba(15,23,42,.28)';
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 3.2, 0, 0, Math.PI * 2); ctx.fill();

  // boots
  ctx.fillStyle = o.boot; ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.roundRect(-8, -7, 6.5, 7, 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(1.5, -7, 6.5, 7, 2); ctx.fill(); ctx.stroke();

  // torso — slightly barrel-shaped, wider at the shoulders
  ctx.fillStyle = o.body;
  ctx.beginPath();
  ctx.moveTo(-8.5, -8);
  ctx.quadraticCurveTo(-9.5, -19, -7, -21);
  ctx.lineTo(7, -21);
  ctx.quadraticCurveTo(9.5, -19, 8.5, -8);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // belt / trim
  ctx.fillStyle = o.trim;
  ctx.beginPath(); ctx.roundRect(-8.6, -12, 17.2, 3.4, 1.4); ctx.fill(); ctx.stroke();

  // arms
  ctx.fillStyle = o.body;
  ctx.beginPath(); ctx.roundRect(-12, -20, 4.6, 10, 2.3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(7.4, -20, 4.6, 10, 2.3); ctx.fill(); ctx.stroke();
  // hands
  ctx.fillStyle = o.skin;
  ctx.beginPath(); ctx.arc(-9.7, -10.2, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(9.7, -10.2, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // head — big, that is the whole trick
  ctx.fillStyle = o.skin;
  ctx.beginPath(); ctx.arc(0, -27.5, 8.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Helmet BEFORE the face: every brim sits at about y -27, so drawing it
  // afterwards painted straight over both eyes and left three blank faces.
  if (o.helmet) o.helmet(ctx, ink);

  // Eyes low on the head — under the brim, and low is what reads as "cute"
  // rather than "adult" at these proportions.
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.ellipse(-3.2, -24.6, 1.4, 1.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(3.2, -24.6, 1.4, 1.9, 0, 0, Math.PI * 2); ctx.fill();
  // glints, so the face is alive even at 16px on a phone
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-2.7, -25.4, .55, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3.7, -25.4, .55, 0, Math.PI * 2); ctx.fill();
  // a small smile
  ctx.strokeStyle = ink; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(0, -22.6, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  if (o.prop) o.prop(ctx, ink);
}

// Purpose-drawn poop ammunition. Unlike a platform emoji this keeps the same
// bold silhouette, gloss and outline on Android, iPhone and iPad, and remains
// readable over snow, storms and dark arenas.
function _pbDrawPoopProjectile(ctx,shellSize,frame) {
  const scale=Math.max(.9,Math.min(1.45,(Number(shellSize)||4)*.24));
  const pulse=1+Math.sin(frame*.45)*.035;
  ctx.save(); ctx.scale(scale*pulse,scale*pulse);
  ctx.shadowColor='rgba(255,214,102,.72)'; ctx.shadowBlur=11;
  ctx.fillStyle='rgba(255,244,190,.38)'; ctx.beginPath(); ctx.arc(0,0,15,0,Math.PI*2); ctx.fill();
  ctx.shadowColor='rgba(28,14,8,.58)'; ctx.shadowBlur=5; ctx.shadowOffsetY=3;
  const poop=ctx.createLinearGradient(-8,-14,10,12);
  poop.addColorStop(0,'#9a5b32'); poop.addColorStop(.5,'#6f351e'); poop.addColorStop(1,'#3f1e16');
  ctx.fillStyle=poop; ctx.strokeStyle='#24110d'; ctx.lineWidth=2.3; ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(-12,10); ctx.bezierCurveTo(-17,5,-13,0,-8,-1);
  ctx.bezierCurveTo(-12,-6,-6,-10,-2,-9);
  ctx.bezierCurveTo(-5,-13,1,-17,5,-14);
  ctx.bezierCurveTo(10,-11,8,-7,7,-6);
  ctx.bezierCurveTo(14,-5,15,1,10,3);
  ctx.bezierCurveTo(17,7,13,12,7,12); ctx.lineTo(-7,12);
  ctx.bezierCurveTo(-10,12,-12,11,-12,10); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Specular curl makes rotation and travel direction easy to perceive.
  ctx.strokeStyle='rgba(255,225,181,.75)'; ctx.lineWidth=2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-5,-5); ctx.quadraticCurveTo(1,-10,5,-7); ctx.stroke();
  ctx.fillStyle='#fff8e7'; ctx.beginPath(); ctx.arc(-4,2,2.2,0,Math.PI*2); ctx.arc(5,2,2.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1f130f'; ctx.beginPath(); ctx.arc(-3.5,2.4,1.1,0,Math.PI*2); ctx.arc(4.5,2.4,1.1,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// A compact, deterministic missile renderer for the Rocket Ranger. Keeping it
// in canvas makes every phone see the same silhouette and preserves the hot
// exhaust even when the projectile is only twenty pixels long on screen.
function _pbDrawRocketProjectile(ctx, shellSize, frame) {
  const scale = Math.max(.9, Math.min(1.35, (Number(shellSize) || 4) * .22));
  const flicker = frame % 2 ? 1.16 : .92;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.shadowColor = 'rgba(15,23,42,.55)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // Exhaust: white-hot core, orange flame, then a dark red outer lick.
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(-15, -5); ctx.lineTo(-26 * flicker, 0); ctx.lineTo(-15, 5); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.moveTo(-15, -3.6); ctx.lineTo(-23 * flicker, 0); ctx.lineTo(-15, 3.6); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff7ed';
  ctx.beginPath();
  ctx.moveTo(-15, -1.7); ctx.lineTo(-20 * flicker, 0); ctx.lineTo(-15, 1.7); ctx.closePath();
  ctx.fill();

  // Rear fins remain visible against both bright sky and dark storm arenas.
  ctx.fillStyle = '#1d4ed8';
  ctx.strokeStyle = '#172554';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-12, -5); ctx.lineTo(-18, -11); ctx.lineTo(-4, -6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-12, 5); ctx.lineTo(-18, 11); ctx.lineTo(-4, 6); ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Steel body, cobalt guidance band and orange armour-piercing nose.
  const body = ctx.createLinearGradient(0, -7, 0, 7);
  body.addColorStop(0, '#f8fafc');
  body.addColorStop(.52, '#cbd5e1');
  body.addColorStop(1, '#64748b');
  ctx.fillStyle = body;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(-15, -6, 25, 12, 5);
  else ctx.rect(-15, -6, 25, 12);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(-5, -6, 6, 12);
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(9, -6); ctx.quadraticCurveTo(20, -3, 24, 0); ctx.quadraticCurveTo(20, 3, 9, 6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.beginPath(); ctx.ellipse(5, -3.1, 7.5, 1.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const PB_MATE_ART = {
  // Pháo thủ — blue artillery helmet, rocket on the shoulder.
  gunner: function (ctx) {
    _pbChibi(ctx, {
      body: '#2f6fd0', trim: '#1b4a8f', boot: '#39434f', skin: '#f6cda6',
      helmet: (c, ink) => {
        c.fillStyle = '#1d4ed8'; c.strokeStyle = ink; c.lineWidth = 1.6;
        c.beginPath(); c.arc(0, -29, 8.9, Math.PI, 0); c.fill(); c.stroke();
        c.beginPath(); c.roundRect(-9.6, -29.6, 19.2, 3.2, 1.4); c.fill(); c.stroke();
        // little star, so the helmet is not just a dome
        c.fillStyle = '#fde047';
        c.beginPath(); c.arc(0, -33.4, 1.9, 0, Math.PI * 2); c.fill();
      },
      prop: (c, ink) => {
        // rocket tube across the body
        c.save();
        c.translate(2, -17); c.rotate(-0.28);
        c.fillStyle = '#6b7280'; c.strokeStyle = ink; c.lineWidth = 1.5;
        c.beginPath(); c.roundRect(-13, -2.6, 21, 5.2, 2.4); c.fill(); c.stroke();
        c.fillStyle = '#ef4444';
        c.beginPath(); c.moveTo(8, -2.8); c.lineTo(14.5, 0); c.lineTo(8, 2.8); c.closePath();
        c.fill(); c.stroke();
        c.restore();
      },
    });
  },

  // Kỹ sư — yellow hard hat, hammer raised.
  engineer: function (ctx) {
    _pbChibi(ctx, {
      body: '#f59e0b', trim: '#7c4a12', boot: '#39434f', skin: '#f6cda6',
      helmet: (c, ink) => {
        c.fillStyle = '#fbbf24'; c.strokeStyle = ink; c.lineWidth = 1.6;
        c.beginPath(); c.arc(0, -29.5, 8.9, Math.PI, 0); c.fill(); c.stroke();
        c.beginPath(); c.roundRect(-10.6, -30, 21.2, 3, 1.5); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(0, -38.2); c.lineTo(-1.6, -30); c.lineTo(1.6, -30);
        c.closePath(); c.fill(); c.stroke();
      },
      prop: (c, ink) => {
        c.save();
        c.translate(10.5, -12); c.rotate(0.5);
        c.strokeStyle = '#8b5a2b'; c.lineWidth = 2.8;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -13); c.stroke();
        c.fillStyle = '#9ca3af'; c.strokeStyle = ink; c.lineWidth = 1.5;
        c.beginPath(); c.roundRect(-5, -18.5, 10, 5.4, 1.6); c.fill(); c.stroke();
        c.restore();
      },
    });
  },

  // Vệ sĩ — green helm, tall tower shield planted in front.
  shield: function (ctx) {
    _pbChibi(ctx, {
      body: '#0f766e', trim: '#0b4f49', boot: '#39434f', skin: '#f6cda6',
      helmet: (c, ink) => {
        c.fillStyle = '#134e4a'; c.strokeStyle = ink; c.lineWidth = 1.6;
        c.beginPath(); c.arc(0, -29, 8.9, Math.PI, 0); c.fill(); c.stroke();
        c.beginPath(); c.roundRect(-9.4, -29.6, 18.8, 3.2, 1.4); c.fill(); c.stroke();
        // crest
        c.fillStyle = '#22d3ee';
        c.beginPath(); c.roundRect(-1.4, -37.5, 2.8, 8, 1.4); c.fill(); c.stroke();
      },
      prop: (c, ink) => {
        c.fillStyle = '#38bdf8'; c.strokeStyle = ink; c.lineWidth = 1.7;
        c.beginPath();
        c.moveTo(-17, -24); c.lineTo(-4.5, -24); c.lineTo(-4.5, -8);
        c.quadraticCurveTo(-10.8, -1.5, -17, -8);
        c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#e0f2fe';
        c.beginPath(); c.roundRect(-12.4, -21, 3, 11, 1.4); c.fill();
        c.fillStyle = '#0ea5e9';
        c.beginPath(); c.arc(-10.8, -15.5, 2.2, 0, Math.PI * 2); c.fill(); c.stroke();
      },
    });
  },
};

// One premium portrait source for Hire cards, status chips and castle posts.
// Keeping a single identity is more important than preserving the old tiny
// chibi once the child has paid to hire a recognisable character.
const PB_MATE_PORTRAITS = Object.freeze({
  gunner: 'img/battle-teammates/rocket-ranger.jpg',
  engineer: 'img/battle-teammates/castle-mechanic.jpg',
  shield: 'img/battle-teammates/royal-guard.jpg',
});

// The Hire panel and the castle must show the same person. These images are
// cached once for canvas use; the hand-drawn chibi remains only as a resilient
// fallback while an image is loading or when a browser refuses the asset.
const PB_MATE_IMAGE_CACHE = Object.create(null);
let PB_MATE_IMAGES_LOADING = false;
function pbPreloadMateImages(onReady) {
  if (typeof Image === 'undefined') return;
  const ids = Object.keys(PB_MATE_PORTRAITS);
  if (ids.every(id => PB_MATE_IMAGE_CACHE[id] && PB_MATE_IMAGE_CACHE[id].complete)) {
    if (typeof onReady === 'function') onReady();
    return;
  }
  if (PB_MATE_IMAGES_LOADING) return;
  PB_MATE_IMAGES_LOADING = true;
  let pending = ids.length;
  const settled = () => {
    pending -= 1;
    if (pending <= 0) {
      PB_MATE_IMAGES_LOADING = false;
      if (typeof onReady === 'function') onReady();
    }
  };
  for (const id of ids) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = settled;
    img.onerror = settled;
    img.src = PB_MATE_PORTRAITS[id];
    PB_MATE_IMAGE_CACHE[id] = img;
  }
}

function pbMateAvatarURL(id, size) {
  if (!PB_MATE_PORTRAITS[id] || typeof document === 'undefined') return '';
  return PB_MATE_PORTRAITS[id];
}

// One hired teammate on an interior ledge. Every teammate remains vivid
// because their passive ability lasts for the whole battle.
function pbDrawSquad(ctx, rules, charges, facing) {
  if (!ctx || !Array.isArray(charges) || !charges.length) return;
  const spots = pbLedgeSpots(charges.length);
  const cs = pbCastleScale(rules);
  const accents={gunner:'#3b82f6',engineer:'#f59e0b',shield:'#14b8a6'};
  for (let i = 0; i < spots.length; i++) {
    const charge = charges[i];
    const spot = spots[i];
    const draw = PB_MATE_ART[charge && charge.id];
    const portrait = PB_MATE_IMAGE_CACHE[charge && charge.id];
    if (!draw) continue;
    ctx.save();
    ctx.translate(spot.x, spot.y);
    // A luminous arched guard post puts every teammate visibly INSIDE the
    // castle instead of leaving a tiny character floating on brown masonry.
    const accent=accents[charge.id]||'#a78bfa';
    ctx.shadowColor=accent; ctx.shadowBlur=8;
    ctx.fillStyle='rgba(10,18,33,.88)'; ctx.strokeStyle=accent; ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.arc(0,-27,15,Math.PI,0); ctx.lineTo(15,2); ctx.lineTo(-15,2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(-5,-29,7,Math.PI*1.08,Math.PI*1.72); ctx.strokeStyle='rgba(255,255,255,.42)'; ctx.lineWidth=1.4; ctx.stroke();
    ctx.fillStyle='#6b4a3d'; ctx.fillRect(-17,0,34,5);
    ctx.fillStyle='#22c55e'; ctx.strokeStyle='#f0fdf4'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(11,-38,4,0,Math.PI*2); ctx.fill(); ctx.stroke();
    // Correct the castle mirror and its non-uniform scaling. The same premium
    // portrait used by Hire now fills this arched post, so the teammate is
    // recognisable even when the camera is zoomed out across the long world.
    ctx.scale(facing < 0 ? -1 : 1,cs.sx/cs.sy);
    if (portrait && portrait.complete && portrait.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect==='function') ctx.roundRect(-14,-43,28,39,6);
      else ctx.rect(-14,-43,28,39);
      ctx.clip();
      ctx.drawImage(portrait,-14,-43,28,39);
      ctx.restore();
      ctx.strokeStyle='#f8fafc'; ctx.lineWidth=1.8;
      ctx.beginPath();
      if (typeof ctx.roundRect==='function') ctx.roundRect(-14,-43,28,39,6);
      else ctx.rect(-14,-43,28,39);
      ctx.stroke();
    } else {
      ctx.scale(1.12,1.12);
      ctx.globalAlpha = 1;
      draw(ctx);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

// Remember a real impact in castle-local coordinates. Nearby hits merge into
// one larger/deeper cavity instead of stacking black circles, while a strict
// per-castle cap prevents a long battle from turning into visual noise.
PetBattleGame.prototype._recordCastleHole = function (target,hit,damage) {
  if (!target || !hit || damage <= 0) return;
  const side=Math.abs(target.x-this.mePos.x)<1?'me':'foe';
  const facing=side==='me'?this.meFacing:-this.meFacing;
  const cs=pbCastleScale(this.rules);
  let x=(hit.x-target.x)/Math.max(.001,cs.sx)*(facing<0?-1:1);
  let y=(hit.y-target.y)/Math.max(.001,cs.sy);
  x=Math.max(-55,Math.min(55,x)); y=Math.max(-103,Math.min(-24,y));
  // Keep the dog's doorway readable: a low centre impact bites into the wall
  // immediately beside it, matching the physical edge the projectile struck.
  if (Math.abs(x)<29 && y>-79) x=(hit.x>=target.x?1:-1)*38;
  const radius=Math.max(15,Math.min(27,14+damage*.42));
  const sameSide=this.castleHoles.filter(h => h.side===side);
  let hole=sameSide.find(h => Math.hypot(h.x-x,h.y-y)<Math.max(24,h.r+radius*.45));
  if (hole) {
    hole.x=(hole.x*hole.hits+x)/(hole.hits+1); hole.y=(hole.y*hole.hits+y)/(hole.hits+1);
    hole.hits+=1; hole.r=Math.min(32,Math.max(hole.r,radius)+3.5); hole.depth=Math.min(1,hole.depth+.2);
  } else {
    if (sameSide.length>=5) {
      hole=sameSide[0]; hole.x=x; hole.y=y; hole.r=radius; hole.hits=1; hole.depth=.58;
    } else this.castleHoles.push({side,x,y,r:radius,hits:1,depth:.58});
  }
};

// A layered jagged cavity: branching cracks sit under a scorched broken rim,
// then a radial black core and lower inner lip create visible wall thickness.
PetBattleGame.prototype._drawCastleHoles = function (pos,damage) {
  if (!this.ctx || damage>=4 || !Array.isArray(this.castleHoles) || !this.castleHoles.length) return;
  const side=Math.abs(pos.x-this.mePos.x)<1?'me':'foe', ctx=this.ctx;
  const holes=this.castleHoles.filter(h => h.side===side);
  for (let index=0;index<holes.length;index++) {
    const hole=holes[index]; let x=hole.x, y=hole.y;
    if (damage>=2 && x>4 && y<-54) y=-46;
    if (damage>=3) { x=Math.max(-42,Math.min(42,x)); y=Math.max(-46,y); }
    const r=hole.r;
    ctx.save(); ctx.translate(x,y); ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.strokeStyle='rgba(45,27,26,.88)'; ctx.lineWidth=2.5;
    const rays=6+Math.min(4,hole.hits);
    for (let ray=0;ray<rays;ray++) {
      const a=(ray/rays)*Math.PI*2+index*.37, inner=r*.75, outer=r*(1.3+(ray%3)*.2);
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);
      ctx.lineTo(Math.cos(a+.06)*outer*.72,Math.sin(a+.06)*outer*.72);
      ctx.lineTo(Math.cos(a-.04)*outer,Math.sin(a-.04)*outer); ctx.stroke();
    }
    ctx.beginPath();
    const teeth=14;
    for (let i=0;i<teeth;i++) {
      const a=i/teeth*Math.PI*2, jag=r*(.82+((i*7+hole.hits*3)%5)*.055);
      const px=Math.cos(a)*jag, py=Math.sin(a)*jag*(.88+hole.depth*.08);
      if (!i) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.closePath();
    const cavity=ctx.createRadialGradient(-r*.2,-r*.22,1,0,0,r);
    cavity.addColorStop(0,'#050609'); cavity.addColorStop(.5,'#171014');
    cavity.addColorStop(.76,'#3b2421'); cavity.addColorStop(1,'#8a4d34');
    ctx.fillStyle=cavity; ctx.fill(); ctx.strokeStyle='#241315'; ctx.lineWidth=3.5; ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,.8)'; ctx.beginPath(); ctx.ellipse(-r*.08,-r*.04,r*.56,r*.47,-.12,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,190,133,.52)'; ctx.lineWidth=2.4;
    ctx.beginPath(); ctx.arc(0,1,r*.68,.16*Math.PI,.84*Math.PI); ctx.stroke();
    ctx.restore();
  }
};

PetBattleGame.prototype._drawHouse = function (pos, img, facing, hp, angle, accent, level, charges, castleSkinId) {
  const ctx = this.ctx;
  const damage = pbHouseDamageStage(hp);
  const wear = 1 - Math.max(0, Math.min(100, Number(hp) || 0)) / 100;
  // Breeds visibly grow with level even inside the castle. Keep the range
  // gentle so the smallest Chihuahua and largest Mastiff both fit the door.
  const petScale = .84 + Math.max(0, Math.min(199, (Number(level) || 1) - 1)) / 199 * .22;
  const petReady = !!(img && img.complete && img.naturalWidth);
  const drawPet = (x, y, w, h) => {
    if (!petReady) return;
    const dw = w * petScale, dh = h * petScale;
    ctx.drawImage(img, x + (w - dw) / 2, y + h - dh, dw, dh);
  };
  ctx.save();
  ctx.translate(pos.x, pos.y);
  // Grow the whole hand-drawn castle to the ruleset's box. Everything below is
  // authored against 70x122 and needs no edits when the fortress grows.
  const _cs = pbCastleScale(this.rules);
  if (_cs.sx !== 1 || _cs.sy !== 1) ctx.scale(_cs.sx, _cs.sy);
  if (facing < 0) ctx.scale(-1, 1);

  const round = (x, y, w, h, r) => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  };
  const skin = (typeof CastleSkins !== 'undefined') ? CastleSkins.get(castleSkinId) : null;
  const palette = skin ? skin.colors : ['#e3b56f','#c98b56','#9b5d43','#65473e','#f97316','#bfe7f4'];
  const stone = ctx.createLinearGradient(-PB_CASTLE_HALF_W, -PB_CASTLE_HEIGHT, PB_CASTLE_HALF_W, 0);
  stone.addColorStop(0, damage >= 4 ? palette[3] : palette[0]);
  stone.addColorStop(.48, damage >= 3 ? palette[2] : palette[1]);
  stone.addColorStop(1, damage >= 2 ? palette[3] : palette[2]);
  const dark = '#211c2b';
  const mortar = palette[3];

  // Do not paint a black ground oval beneath a cosmetic skin. The same castle
  // art is reused on bright maps where that oval reads as a dirty stain.

  const rubble = damage >= 5
    ? [[-60,-8,31,15,-.18],[-33,-17,26,16,.21],[-4,-8,38,17,-.09],[30,-13,31,18,.16],[59,-7,27,14,-.22],[-48,-29,20,15,.12],[42,-31,24,16,-.12]]
    : damage >= 4
      ? [[-58,-7,26,13,-.16],[-24,-8,22,12,.18],[22,-7,28,13,-.11],[58,-9,24,14,.2],[44,-25,18,12,-.2]]
      : damage >= 3
        ? [[-59,-7,22,12,-.14],[54,-8,25,13,.18],[-39,-15,18,11,.22]]
        : damage >= 2
          ? [[49,-8,25,13,.18],[18,-8,19,11,-.12]]
      : damage >= 1 ? [[56,-8,26,14,.2],[39,-15,18,12,-.18]] : [];

  const premiumCastle = damage < 5 && typeof CastleSkins !== 'undefined'
    && CastleSkins.drawBattle && CastleSkins.drawBattle(ctx, skin ? skin.id : castleSkinId, damage);
  if (premiumCastle) {
    if (typeof this._drawCastleHoles==='function') this._drawCastleHoles(pos,damage);
    // The dog remains visibly housed inside the grand doorway until the
    // structure is critically broken, then stands exposed in first air.
    if (petReady) {
      if (damage < 4) drawPet(-24, -55, 48, 51);
      else drawPet(-34, -82, 68, 75);
    }

    // High-contrast broken edges explain the large transparent bites cut out
    // of the premium sprite. This stays readable on bright and dark arenas.
    if (damage >= 1) {
      ctx.strokeStyle = '#211827'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(29,-67); ctx.lineTo(39,-58); ctx.lineTo(48,-70); ctx.lineTo(59,-57); ctx.lineTo(72,-64);
      if (damage >= 2) { ctx.moveTo(2,-53); ctx.lineTo(15,-43); ctx.lineTo(28,-55); ctx.lineTo(41,-46); }
      if (damage >= 3) { ctx.moveTo(-76,-88); ctx.lineTo(-61,-76); ctx.lineTo(-48,-91); ctx.lineTo(-30,-78); }
      ctx.stroke();
    }
    if (damage >= 2) {
      ctx.strokeStyle = '#fff3'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-31,-94); ctx.lineTo(-18,-79); ctx.lineTo(-26,-63); ctx.moveTo(38,-47); ctx.lineTo(27,-35); ctx.lineTo(36,-20); ctx.stroke();
    }

    for (const piece of rubble) {
      ctx.save(); ctx.translate(piece[0],piece[1]); ctx.rotate(piece[4]);
      ctx.fillStyle = piece[0] > 0 ? palette[2] : palette[1];
      round(-piece[2]/2,-piece[3]/2,piece[2],piece[3],3); ctx.fill();
      ctx.strokeStyle = palette[3]; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }

    // Cannon keeps the deterministic centre muzzle used by the physics.
    const premiumRad = angle * Math.PI / 180;
    ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(0,-34,12,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#172033'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0,-34); ctx.lineTo(Math.cos(-premiumRad)*34,-34+Math.sin(-premiumRad)*34); ctx.stroke();
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();

    pbDrawSquad(ctx,this.rules,charges,facing);
    ctx.fillStyle = accent; round(-30,-157,60,23,9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(0,-141); ctx.scale(facing < 0 ? -1 : 1,_cs.sx/_cs.sy);
    ctx.fillText('LV.'+Math.max(1,Number(level)||1),0,0); ctx.restore();
    ctx.restore();
    return;
  }

  // At zero HP the castle is truly gone: big masonry chunks remain while the
  // dog stands in first air, so destruction reads even with motion disabled.
  if (damage >= 5) {
    for (const piece of rubble) {
      ctx.save(); ctx.translate(piece[0], piece[1]); ctx.rotate(piece[4]);
      ctx.fillStyle = piece[0] % 2 ? palette[2] : palette[1];
      round(-piece[2] / 2, -piece[3] / 2, piece[2], piece[3], 3); ctx.fill();
      ctx.strokeStyle = palette[3]; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    drawPet(-37, -88, 74, 82);
    ctx.fillStyle = 'rgba(15,23,42,.88)'; round(-29, -111, 58, 23, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.save(); if (facing < 0) ctx.scale(-1, 1);
    ctx.fillText('LV.' + Math.max(1, Number(level) || 1), 0, -95); ctx.restore();
    ctx.restore();
    return;
  }

  // Foundation and main curtain wall. At critical damage the middle is no
  // longer painted at all: two jagged wall remnants replace one dark overlay.
  ctx.fillStyle = palette[3]; round(-PB_CASTLE_HALF_W, -18, PB_CASTLE_HALF_W * 2, 18, 4); ctx.fill();
  if (damage < 4) {
    ctx.fillStyle = stone; round(-64, -67, 128, 58, 5); ctx.fill();
    ctx.strokeStyle = palette[3]; ctx.lineWidth = 3; ctx.stroke();
  } else {
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(-64, -9); ctx.lineTo(-64, -67); ctx.lineTo(-47, -74); ctx.lineTo(-35, -50);
    ctx.lineTo(-19, -56); ctx.lineTo(-11, -27); ctx.lineTo(1, -20); ctx.lineTo(1, -9); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(30, -9); ctx.lineTo(30, -34); ctx.lineTo(42, -45); ctx.lineTo(49, -27);
    ctx.lineTo(64, -32); ctx.lineTo(64, -9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = palette[3]; ctx.lineWidth = 3; ctx.stroke();
  }

  // Left tower survives longest; its broken stage has a genuinely missing
  // upper half rather than a cosmetic crack drawn on top.
  ctx.fillStyle = stone;
  if (damage < 3) {
    round(-70, -96, 38, 88, 5); ctx.fill(); ctx.strokeStyle = palette[3]; ctx.lineWidth = 3; ctx.stroke();
    for (const x of [-69, -56, -43]) { ctx.fillRect(x, -109, 10, 16); }
  } else {
    ctx.beginPath(); ctx.moveTo(-70,-8); ctx.lineTo(-70,-63); ctx.lineTo(-59,-72);
    ctx.lineTo(-51,-55); ctx.lineTo(-42,-61); ctx.lineTo(-32,-45); ctx.lineTo(-32,-8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = palette[3]; ctx.lineWidth = 3; ctx.stroke();
  }

  // The forward/right tower loses a 38×42px bite on the FIRST hit. This is
  // deliberately large enough to read on a 320px phone screen.
  ctx.fillStyle = stone;
  if (damage === 0) {
    round(32, -96, 38, 88, 5); ctx.fill(); ctx.strokeStyle = palette[3]; ctx.lineWidth = 3; ctx.stroke();
    for (const x of [33, 46, 59]) ctx.fillRect(x, -109, 10, 16);
  } else if (damage < 4) {
    ctx.beginPath();
    ctx.moveTo(32,-8); ctx.lineTo(32,-57); ctx.lineTo(42,-65); ctx.lineTo(49,-55);
    ctx.lineTo(58,-68); ctx.lineTo(70,-57); ctx.lineTo(70,-8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = palette[3]; ctx.lineWidth = 3; ctx.stroke();
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
    ctx.strokeStyle = palette[3]; ctx.lineWidth = 3; ctx.stroke();
    for (const x of [-31, -11, 10]) ctx.fillRect(x, -123, 14, 15);
  } else if (damage < 4) {
    ctx.fillStyle = stone;
    ctx.beginPath(); ctx.moveTo(-33,-57); ctx.lineTo(-33,-111); ctx.lineTo(-18,-123);
    ctx.lineTo(-5,-105); ctx.lineTo(8,-112); ctx.lineTo(17,-89); ctx.lineTo(10,-71); ctx.lineTo(24,-57); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = palette[3]; ctx.lineWidth = 3; ctx.stroke();
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

  if (typeof this._drawCastleHoles==='function') this._drawCastleHoles(pos,damage);

  // Arched kennel window. At critical damage the dog is outdoors between the
  // standing wall remnants; otherwise it remains visibly protected inside.
  if (damage < 4) {
    ctx.fillStyle = '#172033';
    ctx.beginPath(); ctx.arc(0, -63, 30, Math.PI, 0); ctx.lineTo(30, -13); ctx.lineTo(-30, -13); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(0, -62, 27, Math.PI, 0); ctx.lineTo(27, -14); ctx.lineTo(-27, -14); ctx.closePath(); ctx.clip();
    ctx.fillStyle = palette[5]; ctx.fillRect(-28, -65, 56, 53);
    drawPet(-31, -75, 62, 68);
    ctx.restore();
    ctx.strokeStyle = accent; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, -63, 30, Math.PI, 0); ctx.lineTo(30, -13); ctx.lineTo(-30, -13); ctx.closePath(); ctx.stroke();
  } else if (petReady) {
    drawPet(-34, -82, 68, 75);
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
    ctx.fillStyle = piece[0] > 0 ? palette[2] : palette[1];
    round(-piece[2] / 2, -piece[3] / 2, piece[2], piece[3], 3); ctx.fill();
    ctx.strokeStyle = palette[3]; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }

  // Skin ornaments are drawn after the masonry but before the squad/badge.
  // At heavy damage they disappear with the wall, so cosmetics never hide a
  // missing chunk or make a destroyed castle look intact.
  if (typeof CastleSkins !== 'undefined') CastleSkins.drawOrnaments(ctx, skin ? skin.id : castleSkinId, damage);

  // The hired squad, on their storeys inside the keep.
  pbDrawSquad(ctx, this.rules, charges, facing);

  // Level badge floats above the crown and remains readable at every stage.
  ctx.fillStyle = accent; round(-30, -149, 60, 23, 9); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(0, -133);
  // Type, not masonry: correct the mirror and the castle's slight non-uniform
  // scale so the numerals never come out stretched.
  ctx.scale(facing < 0 ? -1 : 1, _cs.sx / _cs.sy);
  ctx.fillText('LV.' + Math.max(1, Number(level) || 1), 0, 0);
  ctx.restore();
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
  let drawn = 0;
  let travelled = 0;
  let prev = shot.points[0];
  for (let i = 1; i < shot.points.length && drawn < PB_AIM_PREVIEW_POINTS; i++) {
    const p = shot.points[i];
    if (!p) continue;
    travelled += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
    if (travelled < PB_AIM_PREVIEW_GAP) continue;
    travelled = 0;
    // `p.y < 8` predates the taller canvas: the world is now drawn 450px down,
    // so a shell arcing above world-y 0 is still perfectly visible in the sky
    // band. Only cull what is genuinely off the top of the canvas.
    if (p.y < -PB_SKY_EXTRA + 8) continue;
    drawn++;
    // A dark halo + white ring + warm core stays readable on snow, lightning,
    // lava, clouds and night skies. Never fade below 82%: the old 18% tail was
    // effectively invisible on a phone, exactly where landing feedback matters.
    const major = drawn % 2 === 1;
    const radius = major ? 6.5 : 5;
    ctx.globalAlpha = Math.max(.82, 1 - i / Math.max(1, shot.points.length) * .18);
    ctx.fillStyle = 'rgba(15,23,42,.92)';
    ctx.beginPath(); ctx.arc(p.x, p.y, radius + 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x, p.y, radius + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = major ? '#facc15' : '#22d3ee';
    ctx.beginPath(); ctx.arc(p.x, p.y, radius - 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
};

PetBattleGame.prototype._hasActiveAnimation = function () {
  if (this._pendingLaunch) return true;          // keep ticking until it fires
  // A travelling camera counts: the frame loop must keep running until the
  // world has finished sliding, or a pan would freeze halfway.
  const camMoving = !!(this.camera && this.camera.isPannable() && !this.camera.settled());
  return camMoving || this.flying.length > 0 || (this.blasts || []).length > 0 || this.projectileSmoke.length > 0 || this.impactParticles.length > 0 || this.castleDebris.length > 0 || this.houseImpacts.length > 0 || this.emotes.some(e => !e.static);
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
  this.projectileSmoke = this.projectileSmoke.filter(smoke => {
    smoke.t+=k; smoke.x+=smoke.vx*k; smoke.y+=smoke.vy*k; smoke.size+=.025*k;
    return smoke.t<smoke.life;
  });
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
      const beforeSmokePoint=f.i;
      while (f.tick >= 2 && f.i < f.points.length - 1) { f.tick -= 2; f.i += 1; }
      f.smokeTravel=(f.smokeTravel||0)+Math.max(0,f.i-beforeSmokePoint);
      if (!this.reducedMotion && f.smokeTravel>=2 && this.projectileSmoke.length<180) {
        f.smokeTravel%=2;
        const point=f.points[f.i], phase=f.i+(f.rocket?17:3);
        if (point) this.projectileSmoke.push({
          x:point.x+Math.sin(phase*.73)*2.4, y:point.y+Math.cos(phase*.51)*1.8,
          vx:(this.wind?this.wind():0)*.004+Math.sin(phase)*.025,
          vy:f.rocket?-.075:-.045, size:(f.rocket?6.5:5.2)+(phase%4)*.55,
          t:0, life:(f.rocket?92:72)+(phase%5)*5, rocket:!!f.rocket,
        });
      }
      allDone = false;
    }
    else if (!f.done) {
      f.done = true;
      if (f.hit) {
        this.blasts.push({ x: f.hit.x, y: f.hit.y, r: C.blastRadius(f.level), t: 0, life: this.reducedMotion ? 1 : 22 });
        this.craters.push({ x: f.hit.x, y: f.hit.y, r: C.blastRadius(f.level) * 0.8 });
        if (!this.reducedMotion) {
          const colors = ['#fff7ae', '#ffb020', '#ff5b36', '#5b3924'];
          for (let i = 0; i < 26 && this.impactParticles.length < 78; i++) {
            const a = (i / 26) * Math.PI * 2;
            const speed = 2.1 + (i % 6) * .72;
            this.impactParticles.push({
              x: f.hit.x, y: f.hit.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 1.3,
              t: 0, life: 28 + (i % 5) * 4, size: 6.5 - (i % 4), color: colors[i % colors.length],
            });
          }
        }
        if (f.damage > 0) {
          const firstImpact=!this.houseImpacts.length;
          this._recordCastleHole(f.target,f.hit,f.damage);
          const impactX=Math.max(f.target.x-58,Math.min(f.target.x+58,f.hit.x));
          const impactY=Math.max(f.target.y-106,Math.min(f.target.y-22,f.hit.y));
          this.houseImpacts.push({ x:impactX, y:impactY, t:0, life:this.reducedMotion?1:42, strength:Math.min(1,.55+f.damage/25) });
          if (firstImpact && typeof navigator!=='undefined' && typeof navigator.vibrate==='function' && !this.reducedMotion) navigator.vibrate([28,18,46]);
          if (!this.reducedMotion) {
            const masonry = ['#e0ae6b', '#bd7954', '#8b5a4c', '#5b4140'];
            for (let i = 0; i < 22 && this.castleDebris.length < 48; i++) {
              const side = i % 2 ? 1 : -1;
              this.castleDebris.push({
                x: impactX + side * (4 + i % 5), y: impactY - (i % 4) * 4,
                vx: side * (2.3 + (i % 6) * .7), vy: -3.4 - (i % 5) * .72,
                rotation: i * .47, spin: side * (.075 + (i % 4) * .025),
                w: 11 + (i % 5) * 3.2, h: 8 + (i % 4) * 2.8,
                color: masonry[i % masonry.length], t: 0, life: 48 + (i % 6) * 5,
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
PetBattleGame.prototype._launch = function (from, facing, angle, power, shots, level, target, rocketCount) {
  const C = this.calc;
  // The damage itself is decided by BattleCalc.volleyShots, which the SERVER
  // re-runs from the battle row (functions/api/battle/turn.js) to check what
  // this device reports. Keeping the arithmetic in one place is what stops
  // the two from drifting; everything below is only the animation.
  const resolved = C.volleyShots({
    terrain: this.terrain, from, facing, angle, power, shots, level, target,
    wind: this.wind(), rules: this.rules, seed: this.seed, turnNo: this.turnNo,
    rocket: rocketCount, rocketDamage: d => this.team.rocketDamage(d),
  });
  let damage = 0;
  this._lastHitCount = 0;
  this.flying = [];
  resolved.forEach((shot, index) => {
    damage += shot.damage;
    if (shot.damage > 0) this._lastHitCount += 1;
    this.flying.push({
      points: shot.sim.points, hit: shot.sim.hit,
      i: this.reducedMotion ? Math.max(0, shot.sim.points.length - 1) : 0,
      damage: shot.damage, target, done: false, size: C.shellSize(level), level,
      spin: shot.rocket ? (index % 2 ? -1 : 1) : (shot.angle % 2 ? 1 : -1),
      rocket: shot.rocket || undefined,
    });
  });
  return Math.min(Number.isFinite(this.rules && this.rules.maxVolleyDamage) ? this.rules.maxVolleyDamage : 100, damage);
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
  this._applyMyTurnPassives();
  this.myTurn = false;
  this.sendTurn({ turnNo: this.turnNo, angle: this.angle, power: this.power, shots: 0, damage: 0 })
    .then((res) => { if (res && res.battle) this._applyServer(res.battle); })
    .catch(() => {});
  this.render();
};

// ---- my turn ----
// ---- hired đồng đội: always-on passives ----
PetBattleGame.prototype._mateCount = function (charges, id) {
  return (charges || []).filter(charge => charge.id === id).length;
};

PetBattleGame.prototype._applyMyTurnPassives = function () {
  this.myHp = this.team.applyRepairs(this.myHp, this.myMaxHp, this._mateCount(this.myCharges, 'engineer'));
};

PetBattleGame.prototype._applyFoeTurnPassives = function () {
  this.foeHp = this.team.applyRepairs(this.foeHp, this.foeMaxHp, this._mateCount(this.foeCharges, 'engineer'));
};

// Guards protect every incoming volley for the full battle. Multiple guards
// stack deterministically, just as duplicate hires occupy multiple ledges.
PetBattleGame.prototype._incomingDamage = function (raw) {
  const guards = this._mateCount(this.myCharges, 'shield');
  return guards ? this.team.shieldedDamage(raw, guards) : raw;
};

PetBattleGame.prototype._outgoingDamage = function (raw) {
  const guards = this._mateCount(this.foeCharges, 'shield');
  return guards ? this.team.shieldedDamage(raw, guards) : raw;
};

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
  this._applyMyTurnPassives();
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !this.reducedMotion) navigator.vibrate(18);
  this.myAmmo -= shots;
  const rocket = this._mateCount(this.myCharges, 'gunner');
  const raw = this._launch(this.mePos, this.meFacing, this.angle, this.power, shots, this.view.me.level, this.foePos, rocket);
  // Their Vệ sĩ eats part of every volley — resolved here so the number
  // shown, the number stored and the number relayed are all the same one.
  const damage = this._outgoingDamage(raw);

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
    // Captured BEFORE the drain: _drainTurns replays the opponent's turns and
    // _replay assigns this.turnNo from the row it is replaying, so reading it
    // afterwards sent the server a turn number from the PAST — and the server
    // now checks it.
    const myTurnNo = this.turnNo;
    this._drainTurns();
    this.sendTurn({ turnNo: myTurnNo, angle: this.angle, power: this.power, shots, damage, rawDamage: raw, abilities: [], rocket })
      .then((res) => { if (res && res.battle) this._applyServer(res.battle); })
      .catch(() => {});
    this.render();
  };
  this._requestFrame();
};

// ---- the opponent's turn, replayed from (angle, power, shots) ----
PetBattleGame.prototype._replay = function (turn) {
  const C = this.calc;
  // Only ever forwards. Reopening a battle resets _pbLastTurn to 0, so the
  // next poll hands back the WHOLE history and replaying it walked turnNo
  // back to 1 before _applyServer corrected it six seconds later.
  this.turnNo = Math.max(this.turnNo || 0, turn.turn_no);
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
  this._applyFoeTurnPassives();
  const rockets = this._mateCount(this.foeCharges, 'gunner');
  const damage = this._launch(this.foePos, -this.meFacing, turn.angle, turn.power, shots, this.view.foe.level, this.mePos, rockets);
  this._pendingResolve = () => {
    const dealt = this._incomingDamage(Math.max(damage, turn.damage || 0));
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
  this.applyBattleHires(b);
  this.turnNo = b.turnNo || this.turnNo;
  if (!this.busy) {
    this.myTurn = !!b.myTurn;
    this.render();
  }
  if (b.status === 'done') {
    this.finished = true;
    // A tie leaves winnerId null, and `won` is then false for BOTH children —
    // one battle used to end with two "Thua rồi" screens and two defeats
    // logged. The server labels it (functions/api/_battle.js battleView).
    const draw = !!b.draw || (!b.winnerId && b.status === 'done');
    const won = !draw && b.winnerId === this.view.me.id;
    setTimeout(() => this.onFinish({
      won, draw, myHp: this.myHp, foeHp: this.foeHp, foeName: this.view.foe.name,
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
  if (!g || !g.myTurn || g.busy || g.finished || g.hireOpen) return;
  const n = Number(v);
  if (!isFinite(n)) return;
  g.angle = Math.max(g.minAngle || PB_ANGLE_MIN, Math.min(PB_ANGLE_MAX, n));
  g._updateUi(g.calc.maxShotsThisTurn(g.myAmmo));
  g.draw();
  _pbBroadcastAim(g);
}
function _pbGameSetPower(v) {
  const g = _pbCurrentGame();
  if (!g || !g.myTurn || g.busy || g.finished || g.hireOpen) return;
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

function _pbGameSetShots(n) { const g = _pbCurrentGame(); if (g && !g.hireOpen) { g.shots = +n; g.render(); _pbBroadcastAim(g); } }
function _pbGameFire() { const g = _pbCurrentGame(); if (g && !g.hireOpen) g.fire(); }
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
function _pbGameLandscape() { const g = _pbCurrentGame(); return g ? g.enterLandscape() : Promise.resolve(false); }
function _pbGameCloseRotateTip() {
  const g = _pbCurrentGame();
  const tip = g && g._el ? g._el('pbRotateTip') : null;
  if (tip) tip.hidden = true;
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
  module.exports = { PetBattleGame, pbHouseDamageStage, pbHeartFills,
    pbCastleScale, pbLedgeSpots, PB_LEDGE_SLOTS, pbDrawSquad, PB_MATE_ART, PB_MATE_PORTRAITS,
    PB_MATE_IMAGE_CACHE, pbPreloadMateImages,
    pbMateAvatarURL };
}
