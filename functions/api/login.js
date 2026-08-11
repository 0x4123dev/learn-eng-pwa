import { pbkdf2Hex, timingSafeEqual, signToken, getAuthSecret, json, err } from './_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const username = String(body.username || '').trim();
  const passcode = String(body.passcode || '');
  if (!username || !passcode) return err('Missing username or passcode');

  const secret = await getAuthSecret(env);
  if (!secret) return err('Server not configured', 500);

  const user = await env.DB.prepare(
    'SELECT id, username, passcode_hash, salt, role, disabled FROM users WHERE username = ? COLLATE NOCASE'
  ).bind(username).first();
  if (!user) return err('Wrong username or passcode', 401);

  const hash = await pbkdf2Hex(passcode, user.salt);
  if (!timingSafeEqual(hash, user.passcode_hash)) return err('Wrong username or passcode', 401);

  // Checked AFTER the passcode, deliberately: answering "this account is
  // disabled" to any wrong guess would turn login into a way to discover which
  // usernames exist. Only the real owner learns why they cannot get in.
  if (user.disabled) {
    return err('Tài khoản này đã bị tạm khoá. Nhờ bố mẹ mở lại giúp nhé!', 403, { code: 'account_disabled' });
  }

  const token = await signToken({ uid: user.id, role: user.role, username: user.username }, secret);
  return json({ token, user: { id: user.id, username: user.username, role: user.role } });
}
