// Realtime transport for the shared Ghost Offering table. The Durable Object
// arbitrates item locks; the Pages API remains the final authority for coins.
(function (global) {
  'use strict';
  // js/hosting.js picks the Worker for the host the page is served from.
  const WS_BASE = (typeof Hosting !== 'undefined') ? Hosting.battleWsBase()
    : (global.BATTLE_WS_URL || 'wss://eng-pwa-battle.minhdoanh.workers.dev');

  function GhostOfferingLink(opts) {
    this.roomId = String(opts.roomId || 'daily');
    this.token = opts.token || '';
    this.botId = opts.botId === 0 || opts.botId === 1 ? opts.botId : null;
    this.onMessage = opts.onMessage || function () {};
    this.onModeChange = opts.onModeChange || function () {};
    this.ws = null;
    this.mode = 'connecting';
    this.closed = false;
    this.retries = 0;
  }
  GhostOfferingLink.prototype.start = function () { this._open(); };
  GhostOfferingLink.prototype._open = function () {
    if (this.closed || !this.token || typeof WebSocket === 'undefined') return this._mode('offline');
    let ws;
    // WHY THE TOKEN IS IN THE URL HERE (see js/battlelink.js for the long
    // version). A browser WebSocket handshake cannot carry an Authorization
    // header, so the URL is the only channel available. This exception is
    // confined to the battle Worker origin: functions/api/_lib.js `bearer()`
    // no longer accepts `?token=`, so the REST API cannot be reached with a
    // token scraped out of a request log. The worker verifies the signature
    // and deletes `token` from the URL before forwarding to the room.
    try { ws = new WebSocket(`${WS_BASE}/offering/${encodeURIComponent(this.roomId)}?token=${encodeURIComponent(this.token)}${this.botId===null?'':`&bot=${this.botId}`}`); }
    catch (_) { return this._mode('offline'); }
    this.ws = ws;
    ws.onopen = () => { this.retries = 0; this._mode('live'); };
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (_) { return; } if (m && m.t) this.onMessage(m); };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
    ws.onclose = () => {
      this.ws = null;
      if (this.closed) return;
      if (++this.retries <= 4) setTimeout(() => this._open(), 700 * this.retries);
      else this._mode('offline');
    };
  };
  GhostOfferingLink.prototype._mode = function (mode) { if (this.mode !== mode) { this.mode = mode; this.onModeChange(mode); } };
  GhostOfferingLink.prototype._send = function (m) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    try { this.ws.send(JSON.stringify(m)); return true; } catch (_) { return false; }
  };
  GhostOfferingLink.prototype.grab = function (itemId) { return this._send({ t: 'offering-grab', itemId }); };
  GhostOfferingLink.prototype.progress = function (itemId, angle, length, phase, x, y, haul) {
    return this._send({ t: 'offering-progress', itemId, angle, length, phase, x, y, haul });
  };
  GhostOfferingLink.prototype.release = function (itemId, reason) { return this._send({ t: 'offering-release', itemId, reason }); };
  GhostOfferingLink.prototype.claimed = function (itemId) { return this._send({ t: 'offering-claimed', itemId }); };
  GhostOfferingLink.prototype.close = function () {
    this.closed = true;
    if (this.ws) { try { this.ws.close(); } catch (_) {} this.ws = null; }
  };

  global.GhostOfferingLink = GhostOfferingLink;
  if (typeof module !== 'undefined' && module.exports) module.exports = { GhostOfferingLink, WS_BASE };
})(typeof window !== 'undefined' ? window : globalThis);
