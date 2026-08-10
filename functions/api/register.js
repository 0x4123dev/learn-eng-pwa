import { pbkdf2Hex, randomHex, signToken, getAuthSecret, json, err } from './_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const username = String(body.username || '').trim();
  const passcode = String(body.passcode || '');

  if (username.length < 2 || username.length > 30) return err('Username must be 2–30 characters');
  // Letters of ANY language (this is a Vietnamese app: Nhật, Bé Na, Đạt…),
  // digits, space, dot, underscore, hyphen. \w alone is ASCII-only and was
  // rejecting every accented name with a 400.
  if (!/^[\p{L}\p{M}\p{N} ._\-]+$/u.test(username)) return err('Username has invalid characters');
  if (passcode.length < 4 || passcode.length > 32) return err('Passcode must be 4–32 characters');

  const secret = await getAuthSecret(env);
  if (!secret) return err('Server not configured', 500);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
    .bind(username).first();
  if (existing) return err('Username already taken', 409);

  const salt = randomHex(16);
  const hash = await pbkdf2Hex(passcode, salt);
  const res = await env.DB.prepare(
    'INSERT INTO users (username, passcode_hash, salt, role) VALUES (?, ?, ?, ?)'
  ).bind(username, hash, salt, 'user').run();

  const uid = res.meta.last_row_id;
  const token = await signToken({ uid, role: 'user', username }, secret);
  return json({ token, user: { id: uid, username, role: 'user' } });
}
