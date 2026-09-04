# Gỡ hai chế độ bot — kế hoạch cài đặt

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gỡ "Luyện tập với máy" ở Arena và "cướp nhà bot" trong Cướp Đêm, để cờ `allow_bot` chỉ còn nghĩa "được chơi trước"; xóa luôn nhánh in xu cục bộ của trận bot.

**Architecture:** Cả hai chế độ chạy hoàn toàn ở máy bé (`js/petbattlebot.js`, `js/petbattle.js`, `js/night-raid.js`), không có endpoint riêng, nên đây là việc xóa mã client, cập nhật danh sách script và precache, rồi sửa các test đang khẳng định điều ngược lại. `trainingTarget` ở `js/night-raid-rules.js` giữ lại vì là snapshot mặc định của mô phỏng và được test dùng.

**Tech Stack:** Vanilla JS, Node 22 (`npm test` chạy `tests/run-all.js`, harness `tests/harness.js` với `suite/test/assert`), `tests/domshim.js` cho test màn hình.

**Spec:** `docs/superpowers/specs/2026-09-04-daily-task-farm-design.md`, mục 3.9.

**Nhánh:** `feat/daily-task-farm` tách từ `master` (đã tạo). Mọi lệnh chạy trong worktree hiện tại. Stage bằng đường dẫn rõ, không dùng `git add -A`.

---

## Bản đồ file

| File | Việc |
|---|---|
| `tests/no-bot-modes.test.js` | Mới. Test bảo vệ: hai chế độ bot không còn trong mã. |
| `js/petbattlebot.js` | Xóa. |
| `js/petbattle.js` | Xóa thẻ luyện tập trong lobby, `startBotBattle`, `finishBotBattle`, nhánh `result.practice`, chuỗi `practice*`, export. |
| `index.html`, `sw.js` | Bỏ `js/petbattlebot.js`. |
| `js/night-raid.js` | Xóa `makeBotTarget`, `scoutBot`, `nrScoutBot`, hai nút "Chơi thử với Bot", nhãn BOT NGẪU NHIÊN, nhánh `!online` của `finishRaid`, nhánh bot của `resultActionsHTML`; `scout(target)` chỉ nhận nhà thật. |
| `admin.html`, `functions/api/admin/user-flags.js` | Đổi nhãn và chú thích cờ thành "Chơi trước". |
| `tests/bot-practice.test.js` | Xóa. |
| `tests/cups.test.js`, `tests/teammates.test.js`, `tests/battle-hit-logic.test.js`, `tests/castle-collision.test.js`, `tests/field-rules.test.js` | Bỏ các test về bot luyện tập. |
| `tests/night-raid-ui.test.js`, `tests/night-raid-screens.test.js`, `tests/home-yard-layout.test.js` | Vào màn trinh sát qua danh sách nhà thật thay cho `scoutBot`. |

---

### Task 1: Test bảo vệ "không còn chế độ bot"

**Files:**
- Create: `tests/no-bot-modes.test.js`

- [ ] **Step 1: Viết test (sẽ đỏ)**

```js
// tests/no-bot-modes.test.js — the two bot modes are gone for good.
//
// allow_bot used to mean "may practice against a bot" (Arena) and "may raid a
// training bot home" (Cướp Đêm). Both were pure client code that let a child
// play without a real friend — and the raid branch printed coins into the
// local wallet. The flag now means only "gets the farm and Cướp Đêm first".
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));

suite('no bot modes: the Arena has no practice-vs-bot', () => {
  test('js/petbattlebot.js is deleted and nothing loads it', () => {
    assert.falsy(exists('js/petbattlebot.js'), 'js/petbattlebot.js must be deleted');
    assert.falsy(read('index.html').includes('petbattlebot.js'), 'index.html still loads the bot');
    assert.falsy(read('sw.js').includes('petbattlebot.js'), 'sw.js still precaches the bot');
  });

  test('js/petbattle.js has no practice entry point, result screen or strings', () => {
    const src = read('js/petbattle.js');
    for (const banned of ['startBotBattle', 'finishBotBattle', 'pb-practice-btn', 'pb-practice-card',
      'result.practice', 'botSetGame', 'botOnPlayerTurnDone', 'practiceBtn', 'practiceAgain', 'practiceNote']) {
      assert.falsy(src.includes(banned), 'js/petbattle.js still mentions ' + banned);
    }
  });
});

suite('no bot modes: Cướp Đêm raids real houses only', () => {
  const ui = read('js/night-raid.js');
  test('the bot target factory and its buttons are gone', () => {
    for (const banned of ['makeBotTarget', 'scoutBot', 'nrScoutBot', 'Chơi thử với Bot', 'botMode',
      'BOT NGẪU NHIÊN', 'Tìm nhà bot khác']) {
      assert.falsy(ui.includes(banned), 'js/night-raid.js still mentions ' + banned);
    }
  });
  test('the local coin path of an offline raid is gone', () => {
    // finishRaid used to pay up to 120 xu a day straight into appState.coins
    // for beating a bot. Every raid now settles through /api/night-raid/finish.
    const fn = ui.slice(ui.indexOf('function finishRaid('), ui.indexOf('function finishRaid(') + 600);
    assert.falsy(/appState\.coins\s*=/.test(fn), 'finishRaid must not touch the wallet');
    assert.falsy(fn.includes("kind:'bot'"), 'finishRaid must not write a bot history row');
    assert.truthy(fn.includes('finishOnline(target,state,commands)'), 'every raid settles online');
  });
  test('the rules module still exports trainingTarget for the simulator and its tests', () => {
    const R = require(path.join(ROOT, 'js', 'night-raid-rules.js'));
    assert.equal(typeof R.trainingTarget, 'function');
  });
});

suite('no bot modes: the flag is early access, not a bot switch', () => {
  test('admin copy no longer calls the flag "Bot on"', () => {
    assert.falsy(read('admin.html').includes('Bot on'), 'admin.html still labels the flag "Bot on"');
    assert.falsy(read('functions/api/admin/user-flags.js').includes('practice vs bot'),
      'user-flags.js still describes the flag as practice vs bot');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node tests/no-bot-modes.test.js`
Expected: FAIL — "js/petbattlebot.js must be deleted", "js/petbattle.js still mentions startBotBattle", "js/night-raid.js still mentions makeBotTarget", "admin.html still labels the flag".

- [ ] **Step 3: Commit test**

```bash
git add tests/no-bot-modes.test.js
git commit -m "test(bot): guard that both bot modes stay removed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Gỡ "Luyện tập với máy" ở Arena

**Files:**
- Delete: `js/petbattlebot.js`
- Modify: `js/petbattle.js:126-140` (chuỗi EN), `js/petbattle.js:279-284` (chuỗi VI), `js/petbattle.js:1005-1010` (thẻ luyện tập), `js/petbattle.js:1308-1376` (hai hàm), `js/petbattle.js:1378`, `js/petbattle.js:1449`
- Modify: `index.html:608`, `sw.js:128`

- [ ] **Step 1: Xóa file bot và hai dòng nạp nó**

```bash
git rm -q js/petbattlebot.js
```

Trong `index.html` xóa dòng:
```html
    <script src="js/petbattlebot.js"></script>
```
Trong `sw.js` xóa dòng:
```js
  '/js/petbattlebot.js',
```

- [ ] **Step 2: Xóa thẻ luyện tập trong lobby**

Trong `js/petbattle.js`, hàm render lobby (quanh dòng 1005), xóa nguyên khối:
```js
    ${st.allowBot ? `
      <div class="pb-practice-card">
        <button class="pb-btn primary pb-practice-btn" onclick="startBotBattle()">${pbT('practiceBtn')}</button>
        <div class="pb-practice-sub">${pbT('practiceSub')}</div>
      </div>` : ''}
```
Dòng `${_pbHistoryPanel()}` ngay sau vẫn giữ. Thẻ `${st.allowBot ? _pbNightRaidCard() : ''}` ở trên **giữ nguyên**: cờ vẫn mở Cướp Đêm.

- [ ] **Step 3: Xóa hai hàm và nhánh practice**

Xóa từ dòng chú thích `// ---- 🤖 practice vs bot (admin-unlocked, entirely local) ----` đến hết hàm `finishBotBattle` (kết thúc ngay trước chú thích `// Battle over: BOTH players are paid`).

Trong `finishPetBattle`, xóa dòng đầu:
```js
  if (result && result.practice) return finishBotBattle(result);   // practice pays nothing
```

Trong khối export cuối file, xóa dòng:
```js
    startBotBattle, finishBotBattle,
```

- [ ] **Step 4: Xóa chuỗi practice ở cả hai ngôn ngữ**

Khối EN (quanh dòng 132), xóa 5 dòng:
```js
    practiceBtn: '🤖 Practice vs bot', practiceSub: 'Full 20 shots · no waiting · no reward',
    practiceTitle: '🤖 Practice', practiceOver: 'Practice over',
    practiceWin: 'You beat the bot! 🎉', practiceLose: 'The bot won this one 💪',
    practiceNote: 'Practice earns no coins or cups — beat a friend for those! 🏆',
    practiceAgain: '🤖 Play again',
```
Khối VI (quanh dòng 279), xóa 5 dòng:
```js
    practiceBtn: '🤖 Luyện tập với máy', practiceSub: 'Đủ 20 đạn · không phải chờ · không có thưởng',
    practiceTitle: '🤖 Luyện tập', practiceOver: 'Hết trận luyện tập',
    practiceWin: 'Bé thắng máy rồi! 🎉', practiceLose: 'Máy thắng trận này 💪',
    practiceNote: 'Luyện tập không có xu và cúp — thắng bạn bè mới có nhé! 🏆',
    practiceAgain: '🤖 Chơi lại',
```
`cupPracticeTease` **giữ** ở cả hai khối: `tests/cups.test.js` kiểm mọi chuỗi bậc cúp có đủ hai ngôn ngữ.

- [ ] **Step 5: Xóa và sửa test cũ**

```bash
git rm -q tests/bot-practice.test.js
```

`tests/cups.test.js`: xóa hai test `'a practice battle never reaches the award'` và `'the practice result path awards nothing at all'` (khoảng dòng 159–170), và test `'practice shows the same ladder as a promise, but earns nothing'` (khoảng dòng 339–344).

`tests/teammates.test.js`: xóa nguyên `suite('teammates: practice against the bot', ...)` (khoảng dòng 510–532) và test `'practice still never charges'` (khoảng dòng 609–615).

`tests/battle-hit-logic.test.js`: xóa test `'the bot also refuses to fire on empty'` (khoảng dòng 246–249).

`tests/castle-collision.test.js`: xóa test `'the practice bot can still find a hit against a solid castle'` (khoảng dòng 312–320).

`tests/field-rules.test.js` dòng 265: đổi chú thích
```js
        // The bot's own coarse grid from js/petbattlebot.js — 5° and 5 power.
```
thành
```js
        // A coarse 5° × 5-power grid, the resolution a child's thumb reaches.
```
Test đó không nạp file bot, giữ nguyên phần còn lại.

- [ ] **Step 6: Chạy test liên quan**

Run: `node tests/no-bot-modes.test.js`
Expected: suite Arena PASS; suite Cướp Đêm và suite cờ vẫn FAIL (làm ở Task 3, 4).

Run: `node tests/cups.test.js && node tests/teammates.test.js && node tests/battle-hit-logic.test.js && node tests/castle-collision.test.js && node tests/field-rules.test.js && node tests/gen-app-integrity.test.js && node tests/extra-coverage.test.js`
Expected: tất cả PASS. `extra-coverage` kiểm mọi `js/*.js` có trong `sw.js` và ngược lại, nên nếu quên một trong hai dòng ở Step 1 sẽ đỏ ở đây.

- [ ] **Step 7: Commit**

```bash
git add js/petbattle.js index.html sw.js tests/cups.test.js tests/teammates.test.js tests/battle-hit-logic.test.js tests/castle-collision.test.js tests/field-rules.test.js
git commit -m "feat(arena): remove practice-vs-bot; allow_bot no longer opens a bot fight

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
(`git rm` đã stage hai file xóa.)

---

### Task 3: Gỡ cướp nhà bot trong Cướp Đêm

**Files:**
- Modify: `js/night-raid.js:104-125` (makeBotTarget, scoutBot), `:153-160` (scout), `:267-270` (finishRaid), `:276` (resultActionsHTML), `:1134-1160` (showLiveTargets, scoutLive), `:1235` (exports), `:1241` (nrScoutBot)
- Modify: `tests/night-raid-ui.test.js:575-600`, `tests/night-raid-screens.test.js`, `tests/home-yard-layout.test.js:143`

- [ ] **Step 1: Sửa test màn hình để vào trinh sát qua nhà thật**

Trong `tests/night-raid-screens.test.js`, ngay sau hàm `tap(el)`, thêm hai helper:

```js
// The bot road is gone. Reach the scout stage the way a child does: open the
// list of real houses (served by a stubbed API) and tap the first card.
function liveWorld(overrides) {
  overrides = overrides || {};
  const target = Object.assign(Rules.trainingTarget(3),
    { targetId: 42, name: 'Nhà Bin', homeLevel: 3, difficulty: 'vừa sức' });
  const api = (p) => {
    if (p === 'night-raid/friends') return Promise.resolve({ ok: true, data: { me: null, friends: [], ticketsLeft: 3 } });
    if (p === 'night-raid/targets') return Promise.resolve({ ok: true, data: { targets: [target], ticketsLeft: 3 } });
    return Promise.resolve({ ok: false, data: null });
  };
  const ctx = Object.assign({ EngAuth: { tokenFor: () => 'tok', api } }, overrides.ctx || {});
  const w = mount(Object.assign({}, overrides, { ctx }));
  return Object.assign(w, { target });
}
async function enterScout(w) {
  w.ctx.NightRaid.open();
  await w.ctx.NightRaid.showLiveTargets();
  w.ctx.NightRaid.scoutLive(0);
}
```

Rồi sửa từng test:

1. Test `'a bot fight opens scout AND arms the TIẾN QUÂN button'` (quanh dòng 154) đổi thành:
```js
  test('a live fight opens scout AND arms the TIẾN QUÂN button', async () => {
    const w = liveWorld();
    await enterScout(w);
    const btn = w.doc.getElementById('nrStartRaid');
    assert.truthy(btn, 'the TIẾN QUÂN button must exist');
    assert.falsy(btn.disabled, 'and be enabled');
    assert.truthy(typeof btn.onclick === 'function',
      'TIẾN QUÂN must be WIRED — a rendered but dead button is the bug');
  });
```

2. Test `'CƯỚP ĐÊM degrades to a bot offer when the server is unreachable'` (quanh dòng 207) đổi thành:
```js
  test('CƯỚP ĐÊM offers NO bot when the server is unreachable', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    return Promise.resolve(ctx.NightRaid.showLiveTargets()).then(() => {
      const html = doc.getElementById('nightRaidScreen').innerHTML;
      assert.falsy(html.includes('nrScoutBot()'), 'an offline child must not be handed a bot raid');
      assert.truthy(html.includes('Chưa tải được nhà người chơi'), 'and is told to try again later');
    });
  });
```

3. Test về camera (quanh dòng 248, `ctx.NightRaid.scoutBot();` rồi kiểm `nrStartRaid.onclick`): đổi phần mở thành
```js
    const w = liveWorld();
    await enterScout(w);
    assert.truthy(typeof w.doc.getElementById('nrStartRaid').onclick === 'function',
      'camera failure must never leave TIẾN QUÂN dead');
```
và thêm `async` vào hàm test.

4. Test `'the bottom bar stays hidden throughout Night Raid and returns only after X'` (quanh dòng 301): đổi thành
```js
  test('the bottom bar stays hidden throughout Night Raid and returns only after X', async () => {
    const w = liveWorld();
    const nav = w.doc.getElementById('bottomNav');
    w.ctx.NightRaid.open();
    assert.equal(nav.style.display, 'none', 'the Night Raid garden is already full-screen');
    await enterScout(w);
    assert.equal(nav.style.display, 'none', 'the raid stage must not have the bar over it');
    w.ctx.NightRaid.renderHome();
    assert.equal(nav.style.display, 'none', 'returning to the garden must not reveal the app nav');
    w.ctx.NightRaid.close();
    assert.truthy(nav.style.display !== 'none', 'X restores the app nav after leaving Night Raid');
  });
```

5. Test `'a bot raid is free to leave — nothing was written anywhere'` (quanh dòng 376): **xóa**. Test `'a committed raid on a real house asks before it is thrown away'` ngay trên đã phủ việc rời trận.

6. Test `'the raid stage wires its map button to the asking exit'` (quanh dòng 410): đổi phần mở thành
```js
  test('the raid stage wires its map button to the asking exit', async () => {
    const w = liveWorld();
    await enterScout(w);
    const home = w.doc.querySelector('.nr-builder-home');
```
phần còn lại giữ, thay `doc` bằng `w.doc`.

7. Nếu còn test nào khác gọi `scoutBot()` (grep `scoutBot` trong file), áp cùng cách: `liveWorld()` + `await enterScout(w)`.

- [ ] **Step 2: Sửa `tests/night-raid-ui.test.js`**

Thay nguyên `suite('night raid: only one combat loop', ...)` (từ dòng 575) bằng:

```js
suite('night raid: only one combat loop, and only against real houses',()=>{
  test('the UI reaches startRaid from the live list alone',()=>{
    assert.truthy(ui.includes('startRaid(target,true)'),'scout must start an ONLINE raid');
    assert.truthy(ui.includes('scout(t)'),'scoutLive hands the chosen house to scout');
    assert.falsy(ui.includes('makeBotTarget'));
    assert.falsy(ui.includes('nrScoutBot'));
    assert.falsy(ui.includes('20 Nhà Huấn Luyện'));
    assert.falsy(ui.includes('Nhà tiếp theo'));
    assert.falsy(ui.includes('startSiege'));
    assert.falsy(ui.includes('wavePlan'));
  });
  test('a raid fields exactly the soldiers the child produced — none are lent',()=>{
    const scoutBlock=ui.slice(ui.indexOf('function scout('),ui.indexOf('function scoutFitZoom'));
    assert.falsy(/attackerSoldiers\s*=\s*\d/.test(scoutBlock),'no fixed soldier count');
    assert.equal((ui.match(/4\+Math\.max\(0,mine\.soldiers\)/g)||[]).length,0,'no soldier floor may come back');
    assert.falsy(/\d\s*\+\s*Math\.max\(0,\s*(mine|army)\.soldiers\)/.test(ui),'no lending in any shape');
    assert.truthy(ui.includes('target.attackerSoldiers=Number.isFinite(+target.attackerSoldiers)'),
      'scout must fall back to the produced count when the target carries none');
    assert.falsy(/soldiers\s*-\s*soldiersUsed/.test(ui),'a raid must not consume soldiers');
  });
});
```
Nếu sau test này còn dòng nào của suite cũ (ví dụ kiểm `soldiersUsed`), xóa nốt cho tới `});` đóng suite.

- [ ] **Step 3: Sửa `tests/home-yard-layout.test.js:143`**

```js
        for (const way of ['renderBuilder', 'showLiveTargets', 'startRaid', 'nrShowBuilder']) {
```

- [ ] **Step 4: Chạy test, xác nhận đỏ đúng chỗ**

Run: `node tests/night-raid-screens.test.js`
Expected: FAIL ở `'CƯỚP ĐÊM offers NO bot...'` (`nrScoutBot()` còn trong HTML) và ở `liveWorld` (chưa lỗi khác). Test `'the UI reaches startRaid from the live list alone'` FAIL vì `makeBotTarget` còn.

- [ ] **Step 5: Xóa mã bot trong `js/night-raid.js`**

a. Xóa nguyên hai hàm `makeBotTarget` (từ `function makeBotTarget(){` tới `}` đóng, kể cả chú thích bên trong) và `scoutBot` (`function scoutBot(){return scout(1,makeBotTarget(),false);}`).

b. `scout`: đổi chữ ký và hai chỗ dùng cờ:
```js
  function scout(target){cleanup();view='scout';raidStage={online:true,committed:false};const r=root();if(!r)return;
```
(bỏ `const target=targetOverride||NightRaidRules.trainingTarget(level);`). Trong HTML của hàm, đổi
```js
aria-label="${online?'Chọn nhà khác':'Về màn Cướp Đêm'}"
```
thành
```js
aria-label="Chọn nhà khác"
```
và đổi
```js
<span>${esc(name)}${target.botMode?' · BOT NGẪU NHIÊN':''}</span>
```
thành
```js
<span>${esc(name)}</span>
```
Dòng gắn nút:
```js
    if(startBtn)startBtn.onclick=()=>{const b=document.getElementById('nrStartRaid');if(b){b.disabled=true;b.classList.add('charging');}startRaid(target,true);};
```

c. `scoutLive`:
```js
  function scoutLive(index){const t=liveTargets[index];if(!t)return;scout(t);}
```

d. `finishRaid` — thay nguyên hàm (ba dòng) bằng:
```js
  function finishRaid(target,state,commands){return finishOnline(target,state,commands);}
```
Tìm chỗ gọi `finishRaid(` (trong `startRaid`, quanh dòng 240) và bỏ tham số thứ tư `online` nếu có: `finishRaid(target,state,commands)`.

e. `resultActionsHTML`:
```js
  function resultActionsHTML(){return `<button class="nr-primary" type="button" onclick="nrShowLiveTargets()">Cướp nhà khác</button><button class="nr-secondary" type="button" onclick="nrHome()">Về nhà</button>`;}
```
Tìm mọi chỗ gọi `resultActionsHTML(online)` (trong `renderResult`, `renderResultPage`) và đổi thành `resultActionsHTML()`.

f. `showLiveTargets`: trong màn báo lỗi, thay
```js
<button class="nr-secondary nr-wide" onclick="nrScoutBot()">Chơi thử với Bot</button></main>`);return;}
```
bằng
```js
<p class="nr-empty">Chưa tải được nhà người chơi. Thử lại sau nhé.</p></main>`);return;}
```
Ở cuối danh sách, xóa nguyên
```js
<div class="nr-live-actions"><button class="nr-secondary nr-wide" type="button" onclick="nrScoutBot()">Chơi thử với Bot</button></div>
```

g. Export và wrapper: trong `return Object.freeze({...})` xóa `scoutBot,`; xóa dòng `function nrScoutBot(){NightRaid.scoutBot();}`.

h. Kiểm còn sót:
```bash
grep -n -E "makeBotTarget|scoutBot|nrScoutBot|botMode|Chơi thử với Bot|Tìm nhà bot|kind:'bot'" js/night-raid.js
```
Expected: không có dòng nào. Chú thích cũ ở đầu `renderHome` nói về bot ("the bot is the 'Chơi thử với Bot' button at the foot of it") sửa thành: `// CƯỚP ĐÊM opens the list of real houses; there is no bot road any more.`

- [ ] **Step 6: Chạy test**

Run: `node tests/no-bot-modes.test.js && node tests/night-raid-screens.test.js && node tests/night-raid-ui.test.js && node tests/home-yard-layout.test.js && node tests/night-raid-rules.test.js && node tests/night-raid-choreo.test.js`
Expected: suite Cướp Đêm trong `no-bot-modes` PASS; các file kia PASS. Chỉ suite "cờ" trong `no-bot-modes` còn FAIL.

- [ ] **Step 7: Commit**

```bash
git add js/night-raid.js tests/night-raid-screens.test.js tests/night-raid-ui.test.js tests/home-yard-layout.test.js
git commit -m "feat(night-raid): raids target real houses only; drop the bot home and its local coin path

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Cờ `allow_bot` đổi nghĩa thành "Chơi trước"

**Files:**
- Modify: `admin.html:887`, `functions/api/admin/user-flags.js:5-10`

- [ ] **Step 1: Đổi nhãn admin**

`admin.html` dòng 887, đổi
```js
`<span class="pill ${u.allow_bot?'on':'off'}">${u.allow_bot?'🤖 Bot on':'Active'}</span>`
```
thành
```js
`<span class="pill ${u.allow_bot?'on':'off'}">${u.allow_bot?'🌱 Chơi trước':'Active'}</span>`
```
Tìm thêm chữ "Bot" khác trên trang (`grep -n "Bot" admin.html`, bỏ qua `robots` và `bottom`) và đổi thành "Chơi trước" nếu là nhãn của cờ này.

- [ ] **Step 2: Đổi chú thích endpoint**

`functions/api/admin/user-flags.js` dòng 5–10, thay
```js
//   allowBot     — reveals the "practice vs bot" button in the child's arena.
```
bằng
```js
//   allowBot     — early access: opens Cướp Đêm and the farm for this child.
//                  (Historic name: it once revealed a practice-vs-bot button;
//                  both bot modes were removed 2026-09.)
```
và thay câu `practice battles bypass the ammo economy entirely, and clearing` bằng `early access is the admin's call, and clearing`.

- [ ] **Step 3: Chạy test**

Run: `node tests/no-bot-modes.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 4: Commit**

```bash
git add admin.html functions/api/admin/user-flags.js
git commit -m "chore(admin): allow_bot reads as early access, not a bot switch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Toàn bộ suite và bản kê verify

- [ ] **Step 1: Chạy toàn bộ suite**

Run: `npm test 2>&1 | tail -15`
Expected: dòng tổng kết không có FAIL. Nếu một test khác còn nhắc `petbattlebot`, `scoutBot` hay `startBotBattle`, sửa theo tinh thần Task 2–3 (bỏ phần bot, giữ phần luật) rồi chạy lại.

- [ ] **Step 2: Bản kê tính năng**

Run: `npm run verify -- --only=inventory 2>&1 | tail -20`
Expected: xanh. Mục `night-raid` và `pet-battle` trong `tests/verify/manifest.js` chỉ kê màn hình và route, không nhắc bot, nên không cần sửa. Nếu đỏ vì `js/petbattlebot.js` được kê ở đâu đó, bỏ dòng đó.

Run: `npm run verify -- --only=client 2>&1 | tail -20`
Expected: xanh. Mục `nightRaidScreen` kiểm chip DAM/DEF/LÍNH và nút `nrShowLiveTargets`, đều còn.

- [ ] **Step 3: Commit nếu có sửa thêm**

```bash
git status --porcelain
```
Nếu có file thay đổi, stage đúng các file đó và commit `test: settle the last bot-mode references`.

---

## Tự soát

- Spec 3.9, gạch đầu dòng 1 (Arena): Task 2. Gạch 2 (Cướp Đêm, kể cả nhánh in xu cục bộ và màn báo lỗi): Task 3. Gạch 3 (vé, kiếm, khiên giữ): không đụng `startRaid`/`finishOnline`. Gạch 4 (`trainingTarget` giữ): Task 1 kiểm export. Gạch 5 (không đụng server): không file nào trong `functions/api/night-raid`, `functions/api/battle` bị sửa.
- Tên hàm dùng xuyên các task: `scout(target)`, `scoutLive(index)`, `finishRaid(target,state,commands)`, `finishOnline(target,state,commands)`, `resultActionsHTML()`, `liveWorld()`, `enterScout(w)`.
