// friends.js — 👥 Friends section of the Profile screen.
// Invite by exact username, accept/decline invites, and see each friend's
// learning card. Deliberately NO chat and no user search: a child can only
// connect with someone whose exact name they already know.

let _friendsData = null;      // { friends, incoming, outgoing }
let _friendsBusy = false;
let _friendsMsg = '';

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

function renderFriendsSection() {
  const el = document.getElementById('friendsSection');
  if (!el) return;

  if (!_frToken()) {
    el.innerHTML = `<div class="friends-empty">Đăng nhập (có mạng) để kết bạn và thi đấu cùng bạn bè nhé!</div>`;
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
  loadFriends().then(() => renderFriendsSection()).catch(() => {});
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderFriendsSection, initFriendsSection, loadFriends, inviteFriend,
    respondFriend, openFriendActivity, frEsc,
    _setFriendsData: (d) => { _friendsData = d; },
    _getFriendsData: () => _friendsData,
  };
}
