import { pbkdf2Hex, randomHex, signToken, getAuthSecret, json, err, normalizeDeviceId, MAX_ACCOUNTS_PER_DEVICE } from './_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const username = String(body.username || '').trim();
  const passcode = String(body.passcode || '');

  // The app itself lets a child create a profile with ANY non-empty name, so
  // the server must not be stricter: a profile named "Z" was created locally,
  // then refused here forever — and the Friends tab asked for a passcode,
  // which could never fix a name. One rule, mirrored in EngAuth.validUsername.
  if (username.length < 1 || username.length > 30) return err('Username must be 1–30 characters');
  // Letters of ANY language (this is a Vietnamese app: Nhật, Bé Na, Đạt…),
  // digits, space, dot, underscore, hyphen. \w alone is ASCII-only and was
  // rejecting every accented name with a 400.
  if (!/^[\p{L}\p{M}\p{N} ._\-]+$/u.test(username)) return err('Username has invalid characters');
  if (passcode.length < 4 || passcode.length > 32) return err('Passcode must be 4–32 characters');

  // One device may create only MAX_ACCOUNTS_PER_DEVICE accounts. Without this,
  // a throwaway opponent is always one "new profile" away, and the trophy
  // cabinet — the thing the whole app points at — can be filled without
  // learning anything.
  //
  // Checked BEFORE the username is taken and before any hashing work, so a
  // blocked signup neither consumes a name nor costs a PBKDF2 round.
  const deviceId = normalizeDeviceId(body.deviceId);
  if (!deviceId) {
    return err('Cần cập nhật app rồi thử lại nhé (thiếu mã thiết bị)', 400, { code: 'device_missing' });
  }
  const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE device_id = ?')
    .bind(deviceId).first();
  if ((used?.n || 0) >= MAX_ACCOUNTS_PER_DEVICE) {
    return err(
      `Máy này đã tạo đủ ${MAX_ACCOUNTS_PER_DEVICE} tài khoản rồi. Hãy đăng nhập bằng tài khoản đã có nhé!`,
      403, { code: 'device_limit', max: MAX_ACCOUNTS_PER_DEVICE });
  }

  const secret = await getAuthSecret(env);
  if (!secret) return err('Server not configured', 500);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
    .bind(username).first();
  if (existing) return err('Username already taken', 409);

  const salt = randomHex(16);
  const hash = await pbkdf2Hex(passcode, salt);
  const res = await env.DB.prepare(
    'INSERT INTO users (username, passcode_hash, salt, role, device_id) VALUES (?, ?, ?, ?, ?)'
  ).bind(username, hash, salt, 'user', deviceId).run();

  const uid = res.meta.last_row_id;
  const token = await signToken({ uid, role: 'user', username }, secret);
  return json({ token, user: { id: uid, username, role: 'user' } });
}
