// Shared helpers for the Pages Functions API (auth, hashing, D1, JSON).
// Files/dirs starting with "_" are NOT routed by Pages — safe for shared modules.
// Uses Web Crypto (available in both the Workers runtime and Node 18 for seeding).

const enc = new TextEncoder();
const PBKDF2_ITERS = 100000;
// Sessions do NOT expire. A child should never be asked to sign in again — a
// forgotten passcode on a device that was working yesterday is a support call
// a seven-year-old cannot make, and the 90-day clock this used to run meant
// every account hit that wall eventually, all at once, months after anyone
// remembered setting it up.
//
// What replaces expiry as the revocation path is `requireAuth` below: it
// re-reads the user row on EVERY authenticated request, so `disabled = 1` in
// the admin console cuts an account off within one request, and a deleted user
// stops working immediately. That is a better switch than a timer — it is
// immediate, it is per-account, and somebody can actually reach for it.
//
// verifyToken ignores `exp` entirely rather than merely stopping stamping it,
// so the tokens already out there stop expiring too. Otherwise every existing
// child would still have hit the old 90-day wall once, which is the exact
// thing this removes.

// ---- encoding ----
export function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
export function randomHex(nBytes) {
  const a = new Uint8Array(nBytes);
  crypto.getRandomValues(a);
  return toHex(a);
}
function b64urlFromBytes(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromString(str) {
  return b64urlFromBytes(enc.encode(str));
}
function stringFromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ---- password hashing (PBKDF2-SHA256) ----
export async function pbkdf2Hex(password, saltStr) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(String(password)), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(String(saltStr)), iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return toHex(new Uint8Array(bits));
}
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- token (HMAC-SHA256 signed) ----
async function hmacB64(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return b64urlFromBytes(new Uint8Array(sig));
}
export async function signToken(payload, secret) {
  const body = b64urlFromString(JSON.stringify({ ...payload }));
  const sig = await hmacB64(body, secret);
  return body + '.' + sig;
}
export async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = await hmacB64(body, secret);
  if (!timingSafeEqual(sig, expect)) return null;
  let payload;
  try { payload = JSON.parse(stringFromB64url(body)); } catch (e) { return null; }
  // `exp` is deliberately not checked — see the note above signToken. Old
  // tokens still carry one; it is ignored so they keep working for good.
  return payload;
}

// ---- D1 config (auth secret) ----
let _cachedSecret = null;
export async function getAuthSecret(env) {
  if (_cachedSecret) return _cachedSecret;
  const row = await env.DB.prepare('SELECT value FROM config WHERE key = ?').bind('auth_secret').first();
  _cachedSecret = row ? row.value : null;
  return _cachedSecret;
}

// ---- request auth ----
// HEADER ONLY. A `?token=` fallback used to live here, and it was a quiet
// leak: this token IS the account, it does not expire (see signToken above),
// and a query string is the one part of a request that gets written down
// everywhere — Cloudflare request logs, analytics, any intermediate proxy,
// Referer headers, a screenshotted address bar. Anyone reading those logs
// could replay it against every /api/* route, for good.
//
// Nothing needed it: js/auth.js (api()), admin.html and js/night-raid.js all
// send `Authorization: Bearer …`, and no caller anywhere in the repo built a
// REST URL with a token in it.
//
// The ONE place a token still travels in a URL is the battle Worker's
// WebSocket handshake (js/battlelink.js, js/ghost-offering-link.js →
// battle-worker/src/index.js). A browser cannot set headers on a WebSocket
// upgrade, so that exception is forced by the platform, not chosen — and it
// is confined to that separate Worker origin. It deliberately does NOT come
// back here: the REST API accepts the header and only the header.
export function bearer(request) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
// A valid signature is not enough: the account behind it must still exist and
// still be enabled.
//
// This costs one indexed primary-key lookup per authenticated request, and it
// is what makes the admin's disable switch real. Tokens do not expire, so this
// row read is now the ONLY revocation path there is: without it, an account
// disabled today would keep full access forever. The same lookup also closes a
// quieter hole: a token for a DELETED user used to keep working.
export async function requireAuth(request, env) {
  const secret = await getAuthSecret(env);
  if (!secret) return null;
  const payload = await verifyToken(bearer(request), secret);
  if (!payload || !payload.uid) return null;
  const row = await env.DB.prepare('SELECT id, role, disabled FROM users WHERE id = ?')
    .bind(payload.uid).first();
  if (!row || row.disabled) return null;
  // The ROLE comes from the row, never from the token. Otherwise an admin
  // demoted to 'user' would keep admin powers for the life of their token.
  return Object.assign({}, payload, { role: row.role });
}

// ---- device identity ----
// How many accounts one device may create. A family iPad legitimately holds a
// child and a parent profile; a third is where "another profile" stops being a
// household and starts being a farm of throwaway opponents.
export const MAX_ACCOUNTS_PER_DEVICE = 2;

// The client generates this once and keeps it in localStorage. It is an opaque
// random string — NOT a fingerprint, NOT an IP. Both alternatives were
// rejected on purpose: fingerprinting a children's app is not acceptable, and
// an IP cap would lock out siblings and classmates on one home or school
// network, who are precisely the users this app exists for. Clearing storage
// resets it; the 3-day friendship delay is what covers that case.
export function normalizeDeviceId(v) {
  const id = String(v == null ? '' : v).trim();
  // Opaque and bounded. Anything else is a client that is not ours.
  return /^[A-Za-z0-9_-]{8,64}$/.test(id) ? id : null;
}

// ---- JSON responses ----
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
// `extra` carries machine-readable detail alongside the human message — e.g.
// the challenge endpoint returns readyAt so the client can count down instead
// of just repeating a sentence the child cannot act on.
export function err(message, status = 400, extra = null) {
  return json(Object.assign({ error: message }, extra || {}), status);
}
