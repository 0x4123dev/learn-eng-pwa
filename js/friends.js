// friends.js — 👥 Friends section of the Profile screen.
// Invite by exact username, accept/decline invites, and see each friend's
// learning card. Deliberately NO chat and no user search: a child can only
// connect with someone whose exact name they already know.

let _friendsData = null;      // { friends, incoming, outgoing }
let _friendsBusy = false;
let _friendsMsg = '';
let _friendsLinking = false;

function frEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _frToken() {
  try {
    if (typeof EngAuth === 'undefined' || typeof currentUser === 'undefined') return null;
    return EngAuth.tokenFor(currentUser);
  } catch (e) { return null; }
}

async function _frApi(path, opts) {
  const token = _frToken();
  if (!token) return { ok: false, status: 0, data: null, offline: true };
  try {
    return await EngAuth.api(path, Object.assign({ token }, opts || {}));
  } catch (e) {
    return { ok: false, status: 0, data: null, offline: true };
  }
}

// ---- data ----
async function loadFriends() {
  const r = await _frApi('friends');
  if (r.ok && r.data) _friendsData = r.data;
  else if (r.offline) _friendsData = null;
  return _friendsData;
}

async function inviteFriend() {
  const input = document.getElementById('friendInviteInput');
  const name = input ? input.value.trim() : '';
  if (!name || _friendsBusy) return;
  _friendsBusy = true;
  const r = await _frApi('friends', { method: 'POST', body: { username: name } });
  _friendsBusy = false;
  if (r.offline) _friendsMsg = '⚠️ Cần mạng để kết bạn';
  else if (r.ok) {
    _friendsMsg = r.data && r.data.status === 'accepted'
      ? '🎉 Đã thành bạn bè!'
      : '✅ Đã gửi lời mời tới ' + name;
    if (input) input.value = '';
  } else _friendsMsg = '❌ ' + ((r.data && r.data.error) || 'Không gửi được lời mời');
  await loadFriends();
  renderFriendsSection();
}

async function respondFriend(friendshipId, accept) {
  if (_friendsBusy) return;
  _friendsBusy = true;
  const r = await _frApi('friends/respond', { method: 'POST', body: { friendshipId, accept: !!accept } });
  _friendsBusy = false;
  _friendsMsg = r.ok ? (accept ? '🎉 Đã thêm bạn mới!' : 'Đã từ chối lời mời') : '❌ Không thực hiện được';
  await loadFriends();
  renderFriendsSection();
}

// ---- rendering ----
// A friend's pet, drawn with the same rig as our own (level unknown to us
// server-side, so the friendly default look is used until they battle).
function _frPetFace(level) {
  try {
    if (typeof petDogSVG === 'function' && typeof getDogStage === 'function') {
      const stage = getDogStage(level || 1);
      return petDogSVG({ stageCss: stage.stageCss, size: 40, level: level || 1, stageMinLevel: stage.minLevel });
    }
  } catch (e) {}
  return '<span style="font-size:28px">🐶</span>';
}

// A signed-in child with no server token used to be told to sign in, with no
// hint why. Explain the actual reason and offer the one action that fixes it.
function _frLinkHelpHTML() {
  const st = (typeof EngAuth !== 'undefined' && EngAuth.linkStatus) ? EngAuth.linkStatus() : { reason: 'unknown' };
  const reason = _friendsLinking ? 'linking' : st.reason;
  const msg = {
    linking: '⏳ Đang kết nối tài khoản…',
    'bad-passcode': '🔑 Tên này đã có tài khoản trên máy chủ với <b>mật mã khác</b>. Nhập đúng mật mã của tài khoản đó để nối máy nhé.',
    'no-passcode': '🔑 Hồ sơ này chưa có mật mã. Tạo lại hồ sơ có mật mã để dùng tính năng bạn bè.',
    offline: '📶 Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé.',
    server: '⚠️ Máy chủ đang bận. Thử lại sau một chút nhé.',
    rejected: '⚠️ Máy chủ chưa nhận tên hồ sơ này'
      + (st.detail ? ': <b>' + frEsc(st.detail) + '</b>' : '')
      + '. <i>Mật mã không phải vấn đề ở đây</i> — thử lại sau khi cập nhật app nhé.',
    unknown: '🔗 Chưa nối hồ sơ này với máy chủ. Bấm “Kết nối” để bắt đầu.',
  }[reason] || 'Chưa nối được tài khoản. Thử lại nhé.';

  // A passcode box only helps when the passcode is the problem. Offering one
  // for a name the server refused made the child type 1111 over and over.
  const needsCode = reason === 'bad-passcode' || reason === 'unknown' || reason === 'no-passcode';
  return `
    <div class="friend-link-card">
      <div class="friend-link-msg">${msg}</div>
      ${needsCode ? `
        <div class="friend-invite-box">
          <input id="friendLinkCode" class="friend-invite-input" type="tel" inputmode="numeric"
                 maxlength="4" placeholder="Mật mã 4 số" autocomplete="off"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();relinkFriendsAccount();}">
          <button class="friend-invite-btn" onclick="relinkFriendsAccount()">Kết nối</button>
        </div>` : `
        <button class="friend-invite-btn" onclick="retryFriendsLink()">Thử lại</button>`}
      ${_friendsMsg ? `<div class="friend-msg">${frEsc(_friendsMsg)}</div>` : ''}
    </div>`;
}

// Retry with the passcode already stored on this device.
async function retryFriendsLink() {
  if (_friendsLinking) return;
  _friendsLinking = true; _friendsMsg = '';
  renderFriendsSection();
  const pass = (typeof appState !== 'undefined' && appState) ? appState.passcode : null;
  let res = { reason: 'no-passcode' };
  try { res = await EngAuth.syncAccount(currentUser, pass); } catch (e) {}
  _friendsLinking = false;
  if (res && res.ok) { _friendsMsg = ''; await loadFriends(); }
  renderFriendsSection();
}

// Link using a passcode the user types (server account has a different one).
async function relinkFriendsAccount() {
  if (_friendsLinking) return;
  const input = document.getElementById('friendLinkCode');
  const code = input ? input.value.trim() : '';
  if (!/^\d{4}$/.test(code)) { _friendsMsg = 'Mật mã phải gồm 4 chữ số'; renderFriendsSection(); return; }
  _friendsLinking = true; _friendsMsg = '';
  renderFriendsSection();
  let res = { reason: 'server' };
  try { res = await EngAuth.relinkAccount(currentUser, code); } catch (e) {}
  _friendsLinking = false;
  if (res && res.ok) {
    _friendsMsg = '✅ Đã nối tài khoản!';
    await loadFriends();
  } else if (res && res.reason === 'bad-passcode') {
    _friendsMsg = '❌ Mật mã chưa đúng';
  } else {
    _friendsMsg = '❌ Chưa nối được, thử lại nhé';
  }
  renderFriendsSection();
}

function renderFriendsSection() {
  const el = document.getElementById('friendsSection');
  if (!el) return;

  if (!_frToken()) {
    el.innerHTML = _frLinkHelpHTML();
    return;
  }
  if (!_friendsData) {
    el.innerHTML = `<div class="friends-empty">Đang tải danh sách bạn bè…</div>`;
    return;
  }

  const { friends, incoming, outgoing } = _friendsData;

  const invites = (incoming || []).map(i => `
    <div class="friend-row invite">
      <div class="friend-face">${_frPetFace(1)}</div>
      <div class="friend-info">
        <div class="friend-name">${frEsc(i.username)}</div>
        <div class="friend-meta">muốn kết bạn với bé</div>
      </div>
      <div class="friend-actions">
        <button class="friend-btn accept" onclick="respondFriend(${i.friendshipId}, true)">✓</button>
        <button class="friend-btn decline" onclick="respondFriend(${i.friendshipId}, false)">✕</button>
      </div>
    </div>`).join('');

  const list = (friends || []).map(f => {
    const s = f.summary || { sessions: 0, correct: 0, daysThisWeek: 0 };
    return `
    <div class="friend-row" onclick="openFriendActivity(${f.userId}, '${frEsc(f.username).replace(/'/g, '')}')">
      <div class="friend-face">${_frPetFace(1)}</div>
      <div class="friend-info">
        <div class="friend-name">${frEsc(f.username)}</div>
        <div class="friend-meta">📚 ${s.sessions} bài tuần này · ✅ ${s.correct} câu đúng · 📅 ${s.daysThisWeek}/7 ngày</div>
      </div>
      <div class="friend-go">›</div>
    </div>`;
  }).join('');

  const pending = (outgoing || []).map(o =>
    `<span class="friend-pending-chip">⏳ ${frEsc(o.username)}</span>`).join('');

  el.innerHTML = `
    <div class="friend-invite-box">
      <input id="friendInviteInput" class="friend-invite-input" type="text" maxlength="20"
             placeholder="Tên bạn (chính xác)…" autocomplete="off"
             onkeydown="if(event.key==='Enter'){event.preventDefault();inviteFriend();}">
      <button class="friend-invite-btn" onclick="inviteFriend()">Kết bạn</button>
    </div>
    ${_friendsMsg ? `<div class="friend-msg">${frEsc(_friendsMsg)}</div>` : ''}
    ${invites ? `<div class="friend-group-title">Lời mời (${incoming.length})</div>${invites}` : ''}
    ${list ? `<div class="friend-group-title">Bạn bè (${friends.length})</div>${list}`
           : `<div class="friends-empty">Chưa có bạn nào. Rủ bạn cùng học rồi thi đấu nhé! ⚔️</div>`}
    ${pending ? `<div class="friend-pending">Đang chờ: ${pending}</div>` : ''}`;
}

// Full 7-day card for one friend (summary only — never their answers).
async function openFriendActivity(friendId, name) {
  const el = document.getElementById('friendsSection');
  if (!el) return;
  el.innerHTML = `<div class="friends-empty">Đang tải hoạt động của ${frEsc(name)}…</div>`;
  const r = await _frApi('friends/activity?friendId=' + friendId);
  if (!r.ok || !r.data) {
    _friendsMsg = '❌ Không xem được hoạt động';
    renderFriendsSection();
    return;
  }
  const d = r.data;
  const t = d.totals || {};
  const skills = (d.bySkill || []).map(s => {
    const pct = s.total ? Math.round(s.correct / s.total * 100) : 0;
    return `<div class="friend-skill-row"><span>${frEsc(s.type)}</span><b>${s.sessions} bài · ${pct}%</b></div>`;
  }).join('');
  const days = (d.byDay || []).map(x =>
    `<div class="friend-day"><span>${frEsc(x.day.slice(5))}</span><b>${x.sessions}</b></div>`).join('');

  el.innerHTML = `
    <button class="friend-back" onclick="renderFriendsSection()">← Danh sách bạn bè</button>
    <div class="friend-card-head">
      ${_frPetFace(1)}
      <div>
        <div class="friend-name">${frEsc(d.user.username)}</div>
        <div class="friend-meta">7 ngày qua</div>
      </div>
    </div>
    <div class="friend-card-stats">
      <div><b>${t.sessions || 0}</b><span>bài học</span></div>
      <div><b>${t.correct || 0}</b><span>câu đúng</span></div>
      <div><b>${t.perfects || 0}</b><span>bài 10/10</span></div>
    </div>
    ${days ? `<div class="friend-group-title">Mỗi ngày</div><div class="friend-days">${days}</div>` : ''}
    ${skills ? `<div class="friend-group-title">Kỹ năng</div>${skills}` : ''}`;
}

// Called by renderProfile(): kicks off a refresh, renders what we have now.
function initFriendsSection() {
  renderFriendsSection();
  // No token yet? The login-time link may still be in flight, or it may have
  // failed silently — either way, try once here and report the outcome.
  if (!_frToken()) { retryFriendsLink(); return; }
  loadFriends().then(() => renderFriendsSection()).catch(() => {});
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderFriendsSection, initFriendsSection, loadFriends, inviteFriend,
    respondFriend, openFriendActivity, frEsc, retryFriendsLink, relinkFriendsAccount,
    _frLinkHelpHTML,
    _setFriendsData: (d) => { _friendsData = d; },
    _getFriendsData: () => _friendsData,
  };
}
