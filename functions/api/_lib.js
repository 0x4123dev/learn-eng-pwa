// Shared helpers for the Pages Functions API (auth, hashing, D1, JSON).
// Files/dirs starting with "_" are NOT routed by Pages — safe for shared modules.
// Uses Web Crypto (available in both the Workers runtime and Node 18 for seeding).

const enc = new TextEncoder();
const PBKDF2_ITERS = 100000;
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

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
  const full = { ...payload, exp: Date.now() + TOKEN_TTL_MS };
  const body = b64urlFromString(JSON.stringify(full));
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
  if (payload.exp && Date.now() > payload.exp) return null;
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
export function bearer(request) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  const url = new URL(request.url);
  return url.searchParams.get('token');
}
export async function requireAuth(request, env) {
  const secret = await getAuthSecret(env);
  if (!secret) return null;
  return verifyToken(bearer(request), secret);
}

// ---- JSON responses ----
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
export function err(message, status = 400) {
  return json({ error: message }, status);
}
