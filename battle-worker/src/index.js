// eng-pwa-battle — WebSocket relay for pet battles.
//
// One Durable Object per battle: both players' sockets land in the same room,
// so a shot, an aiming nudge or an emote reaches the other phone in ~50ms
// instead of waiting for the next poll. The room is a RELAY, not a referee —
// D1 (via the Pages API) stays the source of truth for HP, ammo and results,
// so a dropped socket can never corrupt a battle. Clients still POST their
// turn to /api/battle/turn; the socket just makes the opponent see it now.
//
// Uses the WebSocket Hibernation API: an idle room costs nothing while
// keeping both connections open.

import GhostOfferingSchedule from '../../js/ghost-offering-schedule.js';

const enc = new TextEncoder();

// ---- token verification (mirrors functions/api/_lib.js) ----
function b64urlToString(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function b64urlFromBytes(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expect = b64urlFromBytes(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body))));
  if (!timingSafeEqual(sig, expect)) return null;
  let payload;
  try { payload = JSON.parse(b64urlToString(body)); } catch (e) { return null; }
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

let _secret = null;
async function authSecret(env) {
  if (_secret) return _secret;
  const row = await env.DB.prepare('SELECT value FROM config WHERE key = ?').bind('auth_secret').first();
  _secret = row ? row.value : null;
  return _secret;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

export default {
  // GET /room/<battleId>?token=…   (WebSocket upgrade)
  //
  // The token rides in the query string because a browser WebSocket handshake
  // cannot set an Authorization header. It is the same account token the REST
  // API uses, so it must not linger: this Worker verifies the signature here
  // and then DELETES `token` from the URL before forwarding to the Durable
  // Object, so the room never sees it. The Pages API (functions/api/_lib.js
  // `bearer()`) does NOT accept `?token=` at all — a token scraped from a log
  // of this Worker cannot be replayed against /api/*.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const m = url.pathname.match(/^\/room\/(\d+)$/);
    const offering = url.pathname.match(/^\/offering\/([A-Za-z0-9_-]{1,64})$/);
    if (!m && !offering) return new Response('Not found', { status: 404, headers: CORS });
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426, headers: CORS });
    }

    const secret = await authSecret(env);
    if (!secret) return new Response('Server not configured', { status: 500, headers: CORS });

    const payload = await verifyToken(url.searchParams.get('token'), secret);
    if (!payload || !payload.uid) return new Response('Unauthorized', { status: 401, headers: CORS });

    if (offering) {
      const profile = await env.DB.prepare('SELECT username, allow_bot FROM users WHERE id=?')
        .bind(payload.uid).first();
      if (!profile) return new Response('Forbidden', { status: 403, headers: CORS });
      const botParam = url.searchParams.get('bot');
      const botId = botParam === null ? null : Number(botParam);
      if (botParam !== null && (!profile.allow_bot || !Number.isInteger(botId) || botId < 0 || botId > 1)) {
        return new Response('Invalid QA bot', { status: 403, headers: CORS });
      }
      // Window and room names come from js/ghost-offering-schedule.js, the same
      // file the Pages API and the child's screen read. This Worker ships on a
      // separate `wrangler deploy`, so a local copy of the date here would let
      // one half of the event move without the other.
      if (!profile.allow_bot && !GhostOfferingSchedule.eventWindow().open) {
        return new Response('Event is locked', { status: 403, headers: CORS });
      }
      const humanTestRoom = GhostOfferingSchedule.humanTestRoomId();
      const isHumanTest = offering[1] === humanTestRoom;
      if (isHumanTest && (!profile.allow_bot || botParam !== null)) return new Response('Human QA only', { status: 403, headers: CORS });
      const expectedRoom = GhostOfferingSchedule.roomIdFor({ preview: !!profile.allow_bot, humanTest: isHumanTest });
      if (offering[1] !== expectedRoom) return new Response('Wrong event room', { status: 409, headers: CORS });
      const id = env.GHOST_OFFERING_ROOM.idFromName('offering-' + expectedRoom);
      const fwd = new URL(request.url);
      fwd.searchParams.set('uid', String(payload.uid));
      fwd.searchParams.set('name', botId === 0 ? 'Milo' : botId === 1 ? 'Luna' : String(profile.username || 'Player').slice(0, 20));
      fwd.searchParams.set('actor', botId === null ? `user-${payload.uid}` : `bot-${payload.uid}-${botId}`);
      fwd.searchParams.delete('token');
      return env.GHOST_OFFERING_ROOM.get(id).fetch(new Request(fwd.toString(), request));
    }

    const battleId = Number(m[1]);

    // Only the two players of a live battle may enter the room.
    const battle = await env.DB.prepare(
      'SELECT challenger_id, opponent_id, status FROM battles WHERE id = ?'
    ).bind(battleId).first();
    if (!battle) return new Response('No such battle', { status: 404, headers: CORS });
    if (battle.challenger_id !== payload.uid && battle.opponent_id !== payload.uid) {
      return new Response('Forbidden', { status: 403, headers: CORS });
    }
    if (battle.status !== 'active' && battle.status !== 'invited') {
      return new Response('Battle is over', { status: 409, headers: CORS });
    }

    const id = env.BATTLE_ROOM.idFromName('battle-' + battleId);
    const stub = env.BATTLE_ROOM.get(id);
    // Pass the verified identity on; the room never trusts the client for it.
    const fwd = new URL(request.url);
    fwd.searchParams.set('uid', String(payload.uid));
    fwd.searchParams.delete('token');
    return stub.fetch(new Request(fwd.toString(), request));
  },
};

// Messages we relay. Anything else is dropped — this keeps the room a
// narrow, predictable channel (and there is deliberately no free text).
const RELAY_TYPES = new Set(['turn', 'aim', 'emote', 'hello', 'bye']);
const EMOTES = new Set(['👍', '😮', '🎉', '😅', '🔥']);

export class BattleRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const uid = Number(url.searchParams.get('uid')) || 0;
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernation API: the room can sleep between turns without dropping
    // the sockets, so an idle battle costs nothing.
    this.state.acceptWebSocket(server, ['uid:' + uid]);
    server.serializeAttachment({ uid });

    // Tell the newcomer who else is already here, and announce them.
    const others = this.state.getWebSockets().filter(ws => ws !== server);
    try {
      server.send(JSON.stringify({ t: 'presence', peers: others.length, you: uid }));
    } catch (e) {}
    this._broadcast(server, { t: 'presence', peers: others.length + 1, joined: uid });

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); }
    catch (e) { return; }
    if (!msg || !RELAY_TYPES.has(msg.t)) return;

    const att = ws.deserializeAttachment() || {};
    const from = att.uid || 0;

    // Only ever forward a known shape — never echo arbitrary client data.
    let out = null;
    if (msg.t === 'turn') {
      out = {
        t: 'turn', from,
        turnNo: Math.trunc(+msg.turnNo || 0),
        angle: +msg.angle || 0,
        power: +msg.power || 0,
        shots: Math.max(0, Math.min(4, Math.trunc(+msg.shots || 0))),
        damage: Math.max(0, Math.trunc(+msg.damage || 0)),
      };
    } else if (msg.t === 'aim') {
      // Live "đang ngắm…" — cheap and frequent, so keep it tiny.
      out = { t: 'aim', from, angle: +msg.angle || 0, power: +msg.power || 0, shots: Math.trunc(+msg.shots || 1) };
    } else if (msg.t === 'emote') {
      if (!EMOTES.has(msg.e)) return;          // emoji-only: no free text, ever
      out = { t: 'emote', from, e: msg.e };
    } else if (msg.t === 'hello') {
      out = { t: 'hello', from, name: String(msg.name || '').slice(0, 20) };
    } else if (msg.t === 'bye') {
      out = { t: 'bye', from };
    }
    if (out) this._broadcast(ws, out);
  }

  webSocketClose(ws) {
    const att = ws.deserializeAttachment() || {};
    this._broadcast(ws, { t: 'presence', peers: Math.max(0, this.state.getWebSockets().length - 1), left: att.uid });
  }
  webSocketError(ws) {
    try { ws.close(1011, 'error'); } catch (e) {}
  }

  _broadcast(except, obj) {
    const data = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(data); } catch (e) {}
    }
  }
}

const OFFERING_ITEMS = new Set([
  'hangnga', 'cuoi',
  'mooncake1', 'mooncake2', 'mooncake3', 'mooncake4',
  'lantern1', 'lantern2', 'lantern3', 'lantern4',
  'lantern5', 'lantern6', 'lantern7', 'lantern8',
]);

// Authoritative transient lock manager for the shared offering table. A
// socket attachment is durable across hibernation and records at most one
// held item. Durable Object events are serialized, so simultaneous grabs for
// one chicken have exactly one winner.
export class GhostOfferingRoom {
  constructor(state, env) { this.state = state; this.env = env; }

  async _claimed() {
    const ids = await this.state.storage.get('claimed');
    return new Set(Array.isArray(ids) ? ids.filter(id => OFFERING_ITEMS.has(id)) : []);
  }
  async _saveClaimed(ids) { await this.state.storage.put('claimed', [...ids]); }
  async _snapshot(except, uid) {
    const peers = this.state.getWebSockets().filter(ws => ws !== except);
    const players = peers.map(ws => { const a = ws.deserializeAttachment() || {}; return { uid: a.uid, actorId: a.actorId, name: a.name }; });
    const locks = peers.map(ws => {
      const a = ws.deserializeAttachment() || {};
      if (!a.itemId) return null;
      return { itemId: a.itemId, uid: a.uid, actorId: a.actorId, name: a.name,
        angle: Number.isFinite(a.angle) ? a.angle : 0,
        length: Number.isFinite(a.length) ? a.length : 0,
        phase: a.phase === 'retract' ? 'retract' : 'extend',
        ...(Number.isFinite(a.haul) ? { haul: a.haul } : {}),
        ...(Number.isFinite(a.x) && Number.isFinite(a.y) ? { x: a.x, y: a.y } : {}) };
    }).filter(Boolean);
    return { t: 'offering-state', you: uid, peers: this.state.getWebSockets().length - 1,
      players, locks, claimed: [...await this._claimed()] };
  }

  async fetch(request) {
    const url = new URL(request.url);
    const uid = Number(url.searchParams.get('uid')) || 0;
    const name = String(url.searchParams.get('name') || 'Player').slice(0, 20);
    const actorId = String(url.searchParams.get('actor') || `user-${uid}`).slice(0, 40);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server, ['uid:' + uid]);
    server.serializeAttachment({ uid, name, actorId, itemId: null });
    this._send(server, await this._snapshot(server, uid));
    this._broadcast(server, { t: 'offering-presence', joined: uid, actorId, name, peers: this.state.getWebSockets().length - 1 });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); } catch (_) { return; }
    const att = ws.deserializeAttachment() || {};
    const itemId = String(msg && msg.itemId || '');
    if (!OFFERING_ITEMS.has(itemId)) return;

    if (msg.t === 'offering-grab') {
      const claimed = await this._claimed();
      if (claimed.has(itemId)) {
        this._send(ws, { t: 'offering-denied', itemId, claimed: true });
        return;
      }
      const owner = this.state.getWebSockets().find(other => {
        const a = other.deserializeAttachment() || {};
        return other !== ws && a.itemId === itemId;
      });
      if (owner || att.itemId) {
        this._send(ws, { t: 'offering-denied', itemId, owner: owner ? (owner.deserializeAttachment() || {}).uid : att.uid });
        return;
      }
      const next = { uid: att.uid, name: att.name, actorId: att.actorId, itemId, angle: 0, length: 0, phase: 'extend' };
      ws.serializeAttachment(next);
      this._send(ws, { t: 'offering-granted', itemId });
      this._broadcast(ws, { t: 'offering-locked', itemId, uid: att.uid, actorId: att.actorId, name: att.name });
      return;
    }
    if (att.itemId !== itemId) return;
    if (msg.t === 'offering-progress') {
      const angle = Math.max(-70, Math.min(70, Number(msg.angle) || 0));
      const length = Math.max(0, Math.min(1, Number(msg.length) || 0));
      const phase = msg.phase === 'extend' ? 'extend' : 'retract';
      const point = Number.isFinite(msg.x) && Number.isFinite(msg.y)
        ? { x: Math.max(0, Math.min(1, msg.x)), y: Math.max(0, Math.min(1, msg.y)) } : {};
      const haul = Number.isFinite(msg.haul) ? { haul: Math.max(0, Math.min(1, msg.haul)) } : {};
      ws.serializeAttachment({ uid: att.uid, name: att.name, actorId: att.actorId, itemId, angle, length, phase, ...point, ...haul });
      this._broadcast(ws, { t: 'offering-progress', itemId, uid: att.uid, actorId: att.actorId, name: att.name,
        angle, length, phase, ...point, ...haul });
    } else if (msg.t === 'offering-release') {
      ws.serializeAttachment({ uid: att.uid, name: att.name, actorId: att.actorId, itemId: null });
      this._broadcast(ws, { t: 'offering-released', itemId, uid: att.uid, actorId: att.actorId,
        reason: msg.reason === 'snap' ? 'snap' : 'release' });
    } else if (msg.t === 'offering-claimed') {
      const claimed = await this._claimed();
      claimed.add(itemId);
      await this._saveClaimed(claimed);
      ws.serializeAttachment({ uid: att.uid, name: att.name, actorId: att.actorId, itemId: null });
      this._broadcast(ws, { t: 'offering-claimed', itemId, uid: att.uid, actorId: att.actorId });
    }
  }

  async webSocketClose(ws) { await this._leave(ws); }
  async webSocketError(ws) { await this._leave(ws); try { ws.close(1011, 'error'); } catch (_) {} }
  async _leave(ws) {
    const att = ws.deserializeAttachment() || {};
    if (att.itemId) this._broadcast(ws, { t: 'offering-released', itemId: att.itemId, uid: att.uid, actorId: att.actorId });
    const peers = this.state.getWebSockets().filter(other => other !== ws).length;
    this._broadcast(ws, { t: 'offering-presence', left: att.uid, actorId: att.actorId, name: att.name, peers });
    // A bot-on QA table is a fresh round after everybody leaves. Public
    // claims still survive in D1 and are restored by the Pages API.
    if (peers === 0) await this.state.storage.delete('claimed');
  }
  _send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (_) {} }
  _broadcast(except, obj) {
    const data = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) if (ws !== except) try { ws.send(data); } catch (_) {}
  }
}
