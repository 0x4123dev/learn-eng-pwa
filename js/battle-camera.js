// battle-camera.js — the window onto the long battlefield.
//
// The v2 world is 2000px wide but only 800px are on screen, so the opponent
// starts out of sight and has to be scouted. This module owns where that
// window sits and nothing else.
//
// It is PURELY presentation. Camera position never enters a turn payload, the
// relay, the history, or any physics call — two players can be looking at
// completely different parts of the field and the battle still resolves
// identically on both phones. That separation is the whole reason a camera is
// safe to add to a deterministic lockstep game.
//
// No DOM here either: it takes numbers and returns numbers, so the awkward
// parts (dead zones, clamping, gesture arbitration) are testable in Node.

const CAM_DEADZONE_LO = 0.35;      // keep the followed point inside the middle
const CAM_DEADZONE_HI = 0.65;      // third of the screen
const CAM_LOOKAHEAD = 0.20;        // lead the shot by a fifth of a screen
const CAM_EASE = 0.14;             // per 60Hz tick, toward the target
const CAM_SNAP_PX = 0.6;           // close enough — stop easing and settle

// Gesture arbitration thresholds, in CSS pixels, judged before any conversion
// to world units. A child aiming must never accidentally scroll the field, and
// a child scouting must never accidentally re-aim.
const TAP_MS = 250;
const TAP_SLOP_PX = 8;
const PAN_START_PX = 12;
const PAN_RATIO = 1.25;            // |dx| must beat |dy| by this to count as a pan

function BattleCamera(opts) {
  opts = opts || {};
  const rules = opts.rules || {};
  this.worldW = rules.worldW || 800;
  this.viewW = rules.viewW || 800;
  this.maxX = Math.max(0, this.worldW - this.viewW);
  this.reducedMotion = !!opts.reducedMotion;
  this.x = 0;
  this.targetX = 0;
  this.mode = 'turn-focus';        // turn-focus | manual | fire-follow | impact-hold
  this.holdUntil = 0;
}

BattleCamera.prototype.clamp = function (x) {
  // isFinite(null) is TRUE in JavaScript (null coerces to 0), and so is
  // isFinite('') — a loose check would silently snap the camera to the left
  // edge instead of ignoring the junk. Demand an actual number.
  if (typeof x !== 'number' || !isFinite(x)) return this.x;
  return Math.max(0, Math.min(this.maxX, x));
};

// A single-screen world (v1) has nowhere to pan: the camera is a no-op there.
BattleCamera.prototype.isPannable = function () { return this.maxX > 0; };

BattleCamera.prototype.centreOn = function (worldX) {
  return this.clamp(worldX - this.viewW / 2);
};

// Frame a fixed point — used at the start of a turn and by the anchor buttons.
BattleCamera.prototype.focusOn = function (worldX, opts) {
  this.targetX = this.centreOn(worldX);
  this.mode = (opts && opts.mode) || 'turn-focus';
  // Reduced motion cuts instead of gliding; so does an explicit jump.
  if (this.reducedMotion || (opts && opts.instant)) this.x = this.targetX;
  return this.targetX;
};

// Manual scouting always wins: it cancels any automatic follow immediately, so
// the camera never fights the finger that is dragging it.
BattleCamera.prototype.panBy = function (dxWorld) {
  this.mode = 'manual';
  this.x = this.clamp(this.x + dxWorld);
  this.targetX = this.x;
  return this.x;
};

// Track a moving point (the volley) while keeping it inside a dead zone, so a
// shell drifting near the middle does not make the whole world twitch.
BattleCamera.prototype.follow = function (worldX, velocityX) {
  if (this.mode === 'manual') return this.targetX;      // the child took over
  this.mode = 'fire-follow';
  const screenX = worldX - this.x;
  const lo = this.viewW * CAM_DEADZONE_LO;
  const hi = this.viewW * CAM_DEADZONE_HI;
  const lead = (velocityX || 0) >= 0 ? this.viewW * CAM_LOOKAHEAD : -this.viewW * CAM_LOOKAHEAD;
  if (screenX < lo) this.targetX = this.clamp(worldX - lo + lead);
  else if (screenX > hi) this.targetX = this.clamp(worldX - hi + lead);
  if (this.reducedMotion) this.x = this.targetX;
  return this.targetX;
};

// Hold on a struck castle long enough to read the damage before moving on.
BattleCamera.prototype.holdOn = function (worldX, ms, now) {
  this.targetX = this.centreOn(worldX);
  this.mode = 'impact-hold';
  this.holdUntil = (now || 0) + (ms || 0);
  if (this.reducedMotion) this.x = this.targetX;
  return this.targetX;
};

BattleCamera.prototype.isHolding = function (now) {
  return this.mode === 'impact-hold' && (now || 0) < this.holdUntil;
};

// Ease toward the target. `k` is elapsed time in 60Hz ticks, the same unit the
// game's step() uses, so camera travel is refresh-rate independent too.
BattleCamera.prototype.update = function (k) {
  if (this.reducedMotion) { this.x = this.targetX; return this.x; }
  const step = Math.min(1, CAM_EASE * (typeof k === 'number' && isFinite(k) && k > 0 ? k : 1));
  const dx = this.targetX - this.x;
  // Snap the last sub-pixel rather than easing toward it forever.
  if (Math.abs(dx) <= CAM_SNAP_PX) this.x = this.targetX;
  else this.x += dx * step;
  return this.x;
};

// "Settled" means arrived, not merely close: the final update() snaps, so a
// caller that stops at "close enough" would leave the world a sliver off.
BattleCamera.prototype.settled = function () {
  return this.x === this.targetX;
};

// ---- coordinate conversion ----
BattleCamera.prototype.toWorldX = function (viewportX) { return viewportX + this.x; };
BattleCamera.prototype.toScreenX = function (worldX) { return worldX - this.x; };
BattleCamera.prototype.isVisible = function (worldX, margin) {
  const s = this.toScreenX(worldX);
  const m = margin || 0;
  return s >= -m && s <= this.viewW + m;
};
// -1 = off to the left, 1 = off to the right, 0 = on screen. Drives the edge
// beacon that tells a child which way the opponent is.
BattleCamera.prototype.offscreenSide = function (worldX) {
  const s = this.toScreenX(worldX);
  if (s < 0) return -1;
  if (s > this.viewW) return 1;
  return 0;
};

// The visible slice of the world, for culling. One viewport of margin either
// side so something entering the screen is already drawn.
BattleCamera.prototype.visibleRange = function (margin) {
  const m = (margin === undefined) ? 80 : margin;
  return {
    from: Math.max(0, Math.floor(this.x - m)),
    to: Math.min(this.worldW - 1, Math.ceil(this.x + this.viewW + m)),
  };
};

// Where the viewport sits on a minimap of a given pixel width.
BattleCamera.prototype.minimap = function (widthPx) {
  const w = widthPx || 100;
  return {
    left: (this.x / this.worldW) * w,
    width: (this.viewW / this.worldW) * w,
    markerAt: (worldX) => (worldX / this.worldW) * w,
  };
};

// ---- gesture arbitration ----
// Decides what a pointer gesture MEANT, from timing and distance alone. Kept
// out of the DOM so the rules can be tested exhaustively rather than by hand.
//   'aim'  — a tap, or a drag that began on the aim handle
//   'pan'  — a decisively horizontal drag
//   'none' — not enough movement to decide yet
function classifyGesture(g) {
  const dx = g.dx || 0, dy = g.dy || 0;
  const dt = g.dt || 0;
  const moved = Math.hypot(dx, dy);
  if (g.onHandle) return 'aim';                       // grabbing the guide always aims
  if (Math.abs(dx) >= PAN_START_PX && Math.abs(dx) >= PAN_RATIO * Math.abs(dy)) return 'pan';
  if (g.released && dt <= TAP_MS && moved <= TAP_SLOP_PX) return 'aim';
  if (g.released) return moved <= TAP_SLOP_PX ? 'aim' : 'none';
  return 'none';
}

if (typeof window !== 'undefined') {
  window.BattleCamera = BattleCamera;
  window.classifyGesture = classifyGesture;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BattleCamera, classifyGesture,
    CAM_DEADZONE_LO, CAM_DEADZONE_HI, CAM_LOOKAHEAD, CAM_EASE,
    TAP_MS, TAP_SLOP_PX, PAN_START_PX, PAN_RATIO,
  };
}
