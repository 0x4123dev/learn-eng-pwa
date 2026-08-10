// battlelink.js — the battle transport. Prefers a WebSocket room (≈50ms,
// live aiming + emotes) and falls back to HTTP polling when the socket is
// unavailable (offline, blocked, or the worker is down). The game itself
// never knows which one it is using.
//
// Server side: battle-worker/src/index.js (Durable Object relay).
// D1 stays the source of truth — the socket only makes the opponent SEE a
// turn immediately; the authoritative POST to /api/battle/turn still happens.

// The battle Worker's URL. After `cd battle-worker && npx wrangler@3 deploy`,
// wrangler prints the real workers.dev host — put it here (or set
// window.BATTLE_WS_URL before this script loads to override at runtime).
// Until it is correct the socket simply fails and BattleLink falls back to
// polling, so battles keep working either way.
const BATTLE_WS_BASE = (typeof window !== 'undefined' && window.BATTLE_WS_URL)
  || 'wss://eng-pwa-battle.minhdoanh.workers.dev';
const BL_RECONNECT_MS = 1500;
const BL_MAX_RETRIES = 4;

function BattleLink(opts) {
  this.battleId = opts.battleId;
  this.token = opts.token;
  this.onRemoteTurn = opts.onRemoteTurn || function () {};
  this.onAim = opts.onAim || function () {};
  this.onEmote = opts.onEmote || function () {};
  this.onPresence = opts.onPresence || function () {};
  this.onModeChange = opts.onModeChange || function () {};
  this.pollFn = opts.pollFn || function () { return Promise.resolve(null); };

  this.mode = 'connecting';     // 'live' | 'polling' | 'connecting'
  this.ws = null;
  this.retries = 0;
  this.closed = false;
  this._pollTimer = null;
  this._lastAimSent = 0;
}

BattleLink.prototype.start = function () {
  this._openSocket();
  // Polling always runs as a safety net, but slowly while the socket is up.
  this._startPolling();
};

BattleLink.prototype._openSocket = function () {
  if (this.closed || typeof WebSocket === 'undefined' || !this.token) {
    this._setMode('polling');
    return;
  }
  let ws;
  try {
    ws = new WebSocket(`${BATTLE_WS_BASE}/room/${this.battleId}?token=${encodeURIComponent(this.token)}`);
  } catch (e) {
    this._setMode('polling');
    return;
  }
  this.ws = ws;

  ws.onopen = () => {
    this.retries = 0;
    this._setMode('live');
  };
  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (!m || !m.t) return;
    if (m.t === 'turn') this.onRemoteTurn(m);
    else if (m.t === 'aim') this.onAim(m);
    else if (m.t === 'emote') this.onEmote(m);
    else if (m.t === 'presence') this.onPresence(m);
  };
  ws.onclose = () => {
    this.ws = null;
    if (this.closed) return;
    if (this.retries < BL_MAX_RETRIES) {
      this.retries++;
      this._setMode('connecting');
      setTimeout(() => this._openSocket(), BL_RECONNECT_MS * this.retries);
    } else {
      this._setMode('polling');    // give up on the socket, keep playing
    }
  };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
};

BattleLink.prototype._setMode = function (mode) {
  if (this.mode === mode) return;
  this.mode = mode;
  this.onModeChange(mode);
  this._startPolling();            // re-time the safety net for the new mode
};

BattleLink.prototype.isLive = function () { return this.mode === 'live'; };

// Safety net: 1s when we have no socket, 6s when we do (just to catch up on
// anything the relay missed, e.g. a turn sent while a phone was asleep).
BattleLink.prototype._startPolling = function () {
  if (this._pollTimer) clearTimeout(this._pollTimer);
  if (this.closed) return;
  const tick = () => {
    if (this.closed) return;
    Promise.resolve(this.pollFn()).catch(() => {}).then(() => {
      if (this.closed) return;
      this._pollTimer = setTimeout(tick, this.isLive() ? 6000 : 1000);
    });
  };
  this._pollTimer = setTimeout(tick, this.isLive() ? 6000 : 1000);
};

BattleLink.prototype._send = function (obj) {
  if (!this.ws || this.ws.readyState !== 1) return false;
  try { this.ws.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
};

// A fired turn: relayed instantly AND posted to the API by the caller.
BattleLink.prototype.sendTurn = function (turn) {
  return this._send({ t: 'turn', turnNo: turn.turnNo, angle: turn.angle, power: turn.power, shots: turn.shots, damage: turn.damage });
};

// Live aiming — throttled so a dragged slider can't flood the room.
BattleLink.prototype.sendAim = function (angle, power, shots) {
  const now = Date.now();
  if (now - this._lastAimSent < 120) return false;
  this._lastAimSent = now;
  return this._send({ t: 'aim', angle, power, shots });
};

BattleLink.prototype.sendEmote = function (e) {
  return this._send({ t: 'emote', e });
};

BattleLink.prototype.close = function () {
  this.closed = true;
  if (this._pollTimer) { clearTimeout(this._pollTimer); this._pollTimer = null; }
  if (this.ws) {
    try { this._send({ t: 'bye' }); this.ws.close(); } catch (e) {}
    this.ws = null;
  }
};

if (typeof window !== 'undefined') window.BattleLink = BattleLink;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BattleLink, BATTLE_WS_BASE, BL_RECONNECT_MS, BL_MAX_RETRIES };
}
