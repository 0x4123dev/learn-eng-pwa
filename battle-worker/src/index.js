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
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const m = url.pathname.match(/^\/room\/(\d+)$/);
    if (!m) return new Response('Not found', { status: 404, headers: CORS });
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426, headers: CORS });
    }

    const battleId = Number(m[1]);
    const secret = await authSecret(env);
    if (!secret) return new Response('Server not configured', { status: 500, headers: CORS });

    const payload = await verifyToken(url.searchParams.get('token'), secret);
    if (!payload || !payload.uid) return new Response('Unauthorized', { status: 401, headers: CORS });

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
