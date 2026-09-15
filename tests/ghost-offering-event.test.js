const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const ui = read('js/ghost-offering-event.js'), api = read('functions/api/ghost-offering.js');
const arena = read('js/petbattle.js'), css = require('./css-all').readAllCss(), html = read('index.html'), sw = read('sw.js');
const event = require('../js/ghost-offering-event.js');

suite('Mid-Autumn gift picking: the final 25 Sep 2026 event', () => {
  test('the one-off window opens at 22:00 GMT+7 and closes at local midnight', () => {
    const before = event.localWindow(Date.UTC(2026, 8, 25, 14, 59, 59));
    const open = event.localWindow(Date.UTC(2026, 8, 25, 15, 0, 0));
    const last = event.localWindow(Date.UTC(2026, 8, 25, 16, 59, 59));
    const next = event.localWindow(Date.UTC(2026, 8, 25, 17, 0, 0));
    assert.falsy(before.open); assert.truthy(open.open); assert.truthy(last.open); assert.falsy(next.open);
    assert.equal(open.closesAt - open.opensAt, 2 * 60 * 60 * 1000);
    assert.equal(open.eventDate, '2026-09-25');
    assert.equal(before.nextOpensAt, Date.UTC(2026, 8, 25, 15, 0, 0));
    assert.truthy(next.ended, 'the final night does not silently become a daily event');
    assert.equal(next.eventDate, '2026-09-25');
    assert.truthy(ui.includes('Mở 25/09/2026 lúc 22:00'));
    // Ngày giờ nay chỉ có MỘT nguồn; API đọc đúng nguồn ấy chứ không giữ bản sao.
    // tests/ghost-offering-schedule.test.js chốt chính con số của nguồn đó.
    const schedule = require('../js/ghost-offering-schedule.js');
    assert.equal(open.opensAt, schedule.OPENS_AT, 'màn hình của bé và lịch chung phải trùng');
    assert.equal(open.eventDate, schedule.EVENT_DATE);
    assert.truthy(api.includes("from '../../js/ghost-offering-schedule.js'"),
      'API phải đọc lịch chung, không được chép lại ngày');
  });
  test('every Arena account can inspect the event while bot-on retains all-day QA play', () => {
    assert.truthy(arena.includes("typeof GhostOfferingEvent !== 'undefined' ? GhostOfferingEvent.cardHTML()"));
    assert.falsy(arena.includes("st.allowBot && typeof GhostOfferingEvent"), 'bot-off users also see the event card');
    assert.truthy(arena.includes('GhostOfferingEvent.cardHTML()'));
    assert.truthy(api.includes("SELECT allow_bot FROM users WHERE id=?"));
    assert.truthy(api.includes('botPreviewWindow()'), 'bot-on accounts can play-test before 22:00');
    assert.truthy(api.includes('preview ? botPreviewWindow() : eventWindow()'), 'bot-off users receive the real locked/open window instead of a 403');
    assert.truthy(api.includes("if (!preview && !window.open) return err('Event is not open', 403)"), 'bot-off rewards remain server-locked before 22:00');
    assert.truthy(api.includes('preview ? previewClaimKey(window.eventDate, sessionId) : window.eventDate'), 'public rewards share one calendar-day table');
    assert.truthy(ui.includes('SỰ KIỆN TRUNG THU'));
    assert.truthy(ui.includes('<strong>Hái Quà – Cướp Hằng Nga</strong>'), 'the banner names the seasonal event');
    assert.truthy(ui.includes('>HÁI QUÀ</button>'), 'the banner action names the gift-picking game');
    assert.falsy(/BOT-ON|TEST MODE|TEST 24\/7/.test(ui), 'test-only labels stay out of the child UI');
    assert.falsy(ui.includes('global.currentUser'), 'top-level let currentUser is not a window property');
    assert.falsy(ui.includes('global.appState'), 'top-level let appState is not a window property');
    assert.truthy(ui.includes("typeof currentUser!=='undefined'"));
    assert.truthy(ui.includes('HÁI QUÀ – CƯỚP HẰNG NGA'), 'the event screen uses the requested Mid-Autumn name');
    assert.falsy(ui.includes('CƯỚP CÔ HỒN'), 'the former ghost-event language is gone');
  });
  test('a local or temporarily offline bot-off profile stays inside the locked preview', () => {
    assert.truthy(ui.includes('function localPreviewState'), 'the full scene has a local locked state');
    assert.truthy(ui.includes('state=localPreviewState();'), 'the scene renders before waiting for server authentication');
    const openBody = ui.slice(ui.indexOf('async function enter(mode)'), ui.indexOf('function close()'));
    assert.falsy(openBody.includes('return close()'), 'a failed preview request can never throw the child back to Arena');
    assert.falsy(openBody.includes("visualAlert('Không tải được event')"), 'view-only mode does not show a false fatal error');
    assert.truthy(ui.includes('Bé cần học đủ bài hôm nay được giao mới tham gia được.'), 'the locked scene explains the daily-learning requirement');
    assert.truthy(css.includes('.go-lock .go-study-rule'), 'the second rule sits below the opening-time line');
  });
  test('the exact Mid-Autumn inventory and rewards are fixed on both sides', () => {
    assert.equal(event._items.filter(x => x.type === 'hangnga').length, 1);
    assert.equal(event._items.filter(x => x.type === 'cuoi').length, 1);
    assert.equal(event._items.filter(x => x.type === 'mooncake').length, 4);
    const lanterns = event._items.filter(x => x.type === 'lantern');
    assert.equal(lanterns.length, 16);
    assert.equal(lanterns.filter(x => x.y === 51).length, 8, 'first lantern row stays evenly populated');
    assert.equal(lanterns.filter(x => x.y === 58).length, 8, 'second lantern row stays evenly populated');
    assert.equal(event._items.find(x => x.id === 'hangnga').reward, 200);
    assert.equal(event._items.find(x => x.id === 'cuoi').reward, 150, 'Chú Cuội is exactly three quarters of Hằng Nga');
    assert.equal(event._items.reduce((n, x) => n + x.reward, 0), 710);
    for (const token of ["hangnga: 200", "cuoi: 150", "mooncake1: 50", "mooncake4: 50", "lantern1: 10", "lantern16: 10"])
      assert.truthy(api.includes(token), token);
  });
  test('server claims are idempotent and the reward rides the grant pipeline', () => {
    assert.truthy(api.includes('INSERT OR IGNORE INTO ghost_offering_claims'));
    assert.truthy(api.includes('PRIMARY KEY (user_id,event_date,item_id)'));
    assert.truthy(api.includes('PRIMARY KEY (event_date,item_id)'), 'the public table permits only one winner per physical offering');
    assert.truthy(api.includes('result.meta && result.meta.changes'));
    // The reward is a coin_grants IOU paid through the receipt-protected
    // POST /api/coins claim (executed coverage: tests/money-server.test.js) —
    // never a direct wallet write that the next syncHome could overwrite.
    assert.truthy(api.includes('INSERT INTO coin_grants'),
      'an award mints an IOU, not a raid-wallet write');
    assert.falsy(api.includes('night_raid_homes.lootable_coins+excluded.lootable_coins'),
      'no direct wallet credit — that mirror was silently undone by syncHome');
    assert.truthy(ui.includes('EngAuth.refreshFlags('),
      'the client collects the prize through the receipt-protected claim');
    assert.falsy(ui.includes('previousCoins+reward'),
      'no hand-credited wallet — the grant pipeline is the single payer');
    assert.falsy(ui.includes('Number.isFinite(serverCoins)'),
      'a null or stale Night Raid wallet can never overwrite the account balance');
    assert.truthy(read('db/012-ghost-offering-event.sql').includes('PRIMARY KEY (user_id, event_date, item_id)'));
  });
  test('every bot-on entry starts a fresh isolated round', () => {
    assert.truthy(api.includes('crypto.randomUUID()'), 'GET creates a new preview session');
    assert.truthy(api.includes('previewClaimKey(window.eventDate, sessionId)'), 'claims are scoped to that round');
    assert.truthy(api.includes("const sessionId = String(body.sessionId || '')"), 'POST requires the issued round id');
    assert.truthy(ui.includes('body:{itemId:id,sessionId:state.sessionId,humanTest:!!state.humanTest}'), 'the client claims only inside its current round and preserves its room type');
    assert.truthy(ui.includes("breakSessionId!==w.sessionId"), 'rope-break progress also resets for the new table');
    assert.falsy(api.includes('DELETE FROM ghost_offering_claims'), 'opening a new round never corrupts another tab');
  });
  test('one accessible cast button drives a straight-line swing, cast and retract loop', () => {
    for (const token of ['go-cast-btn', "mode:'swing'", "mode='extend'", "mode='retract'", 'requestAnimationFrame', 'cancelAnimationFrame']) assert.truthy(ui.includes(token), token);
    assert.truthy(ui.includes('Math.sin(rad)*actor.length'), 'the hook follows the current straight aiming vector');
    assert.truthy(ui.includes('getBoundingClientRect'), 'collision is measured against the rendered offering');
    assert.truthy(ui.includes("actor.length<=actor.idleLength){actor.length=actor.idleLength;finishUserCast(actor)"), 'the haul must reach the dog before finishing');
    assert.truthy(ui.includes("actor.mode='claiming';claim(id)"), 'only the finished haul calls the reward endpoint');
    assert.falsy(ui.includes('pointermove'), 'gifts are no longer dragged directly');
    assert.truthy(css.includes('min-height:58px'), 'the primary action exceeds a 44px touch target');
    assert.truthy(css.includes('touch-action:manipulation'), 'tapping does not trigger document gestures');
    assert.truthy(css.includes(':focus-visible'), 'keyboard focus remains visible');
    assert.truthy(css.includes('prefers-reduced-motion:reduce'), 'decorative motion can be disabled');
  });
  test('a bot hook cannot pass through a lantern to reach a mooncake behind it', () => {
    const hit=event._rayFirstCollision({x:50,y:100},{x:50,y:10},[
      {item:{id:'lantern1'},x:50,y:62,rx:8,ry:8},
      {item:{id:'mooncake1'},x:50,y:22,rx:10,ry:10},
    ]);
    assert.equal(hit.item.id,'lantern1','the first physical offering on the ray wins');
    assert.truthy(ui.includes('qaBotFirstCollision(actor,intended,available)'), 'QA bot resolves collision before requesting its server lock');
  });
  test('the two-person QA button is visible only to bot-on accounts', () => {
    const previous=global.appState;
    global.appState={allowBot:true};
    assert.truthy(event.cardHTML().includes('go-human-test-btn'));
    assert.truthy(event.cardHTML().includes('ĐẤU TEST 2 NGƯỜI'));
    global.appState={allowBot:false};
    assert.falsy(event.cardHTML().includes('go-human-test-btn'));
    global.appState=previous;
    assert.truthy(typeof event.openHumanTest==='function');
    assert.truthy(ui.includes("if(humanTest&&!currentState()?.allowBot)return"), 'the entry function repeats the client permission check');
    assert.truthy(css.includes('.go-human-test-btn')&&css.includes('min-height:54px'), 'the secondary QA action stays compact but touch-safe');
  });
  test('an off-axis lantern does not block a bot hook aimed at a mooncake', () => {
    const hit=event._rayFirstCollision({x:50,y:100},{x:50,y:10},[
      {item:{id:'lantern1'},x:76,y:62,rx:8,ry:8},
      {item:{id:'mooncake1'},x:50,y:22,rx:10,ry:10},
    ]);
    assert.equal(hit.item.id,'mooncake1');
    assert.truthy(ui.includes('itemStageGeometry(item)'), 'the rope aims at the rendered image centre rather than its CSS anchor edge');
  });
  test('valuable offerings feel heavier and require the promised repeated hooks', () => {
    assert.truthy(ui.includes('THROW_SPEED=260'), 'the outgoing rope is slowed to half the previous speed');
    assert.truthy(ui.includes('EMPTY_RETRACT_SPEED=130'), 'the return rope is half as fast as the outgoing rope');
    assert.truthy(ui.includes('BREAKS_REQUIRED={hangnga:2,cuoi:2,mooncake:1,lantern:0}'), 'lantern succeeds immediately, mooncake breaks once, and both characters break twice');
    assert.truthy(ui.includes('PULL_SPEED={hangnga:32.5,cuoi:38,mooncake:47.5,lantern:130}'), 'Hằng Nga is heaviest, Cuội is smaller, mooncakes are heavy, and lanterns stay quick');
    assert.truthy(ui.includes('function snapRope'), 'a failed heavy haul has a distinct recovery path');
    assert.truthy(ui.includes('breakProgress[id]=(breakProgress[id]||0)+1'), 'each break advances that exact offering');
    assert.truthy(ui.includes('returnSnappedItem(id)'), 'a snapped offering visibly retreats to the table');
    assert.truthy(ui.includes("actor.mode='snap-retract'"), 'the severed dog-side rope retracts as its own readable state');
    assert.truthy(ui.includes('data-go-snap-rope="near"') && ui.includes('data-go-snap-rope="far"'), 'the broken rope is rendered as two separated pieces');
    assert.truthy(ui.includes('data-go-rope-base="user"') && ui.includes('data-go-snap-base="near"'), 'the rope has a shaded core under its braided strands');
    assert.equal((ui.match(/data-go-rope-fray="(?:near|far)"/g)||[]).length, 4, 'both frayed ends are rendered and positioned');
    assert.truthy(css.includes('.go-stage.rope-broke'), 'rope failure has visible feedback in addition to text');
    assert.truthy(css.includes('.go-rope-fray'), 'the snapped ends visibly fray');
    assert.truthy(css.includes('.go-item.snapping-back'), 'the offering visibly recoils to the altar');
    assert.truthy(css.includes('.go-stage.hauling-heavy .go-dog-strain-art'), 'the dog visibly strains while pulling heavy gifts');
    assert.truthy(ui.includes('function snapNearDogLength'), 'heavy offerings only break near the dog');
    assert.truthy(ui.includes('(actor.hitLength-actor.idleLength)*.18'), 'only about the final fifth of the haul remains at a break');
    assert.falsy(ui.includes('actor.hitLength*.72'), 'the old mid-route break point is gone');
  });
  test('the cast uses a three-prong grapple and the user dog reacts to effort and rewards', () => {
    assert.equal((ui.match(/data-go-prong="(?:left|middle|right)"/g)||[]).length, 3, 'the SVG grappling hook has exactly three visible prongs');
    assert.truthy(css.includes('.go-grapple-prong'), 'the iron hook is styled as an authored SVG asset');
    assert.truthy(ui.includes('go-dog-strain-art') && ui.includes("dogArt('sad')"), 'heavy hauling uses a dedicated strained dog drawing');
    assert.truthy(ui.includes('go-dog-happy-art') && ui.includes('function celebrateDog'), 'a successful haul uses a dedicated happy dog drawing');
    assert.truthy(ui.includes('celebrateDog();await flyCoinsToJar(item)'), 'the dog celebrates exactly when an awarded item arrives');
    assert.truthy(css.includes('@keyframes go-dog-reward') && css.includes('.go-dog-sparkles'), 'the received-item pose flashes and sparkles without text');
  });
  test('reward and failure feedback stay visual instead of covering the playfield with text', () => {
    assert.truthy(ui.includes('function flyCoinsToJar'), 'captured rewards fly toward the wallet');
    assert.truthy(ui.includes('go-coin-jar') && css.includes('.go-coin-flight'), 'the wallet has a jar target and animated coin sprites');
    assert.falsy(ui.includes('<p class="go-help">'), 'the redundant reward sentence is gone');
    const announceBody = ui.slice(ui.indexOf('function announce'), ui.indexOf('function visualAlert'));
    assert.falsy(announceBody.includes('showToast'), 'ordinary hits, misses and snaps remain screen-reader-only');
    assert.truthy(ui.includes("visualAlert('Chưa thể cướp món này')"), 'real errors still have visible feedback');
  });
  test('the event fills the Arena content box on every device', () => {
    assert.truthy(ui.includes("screen.classList.add('go-event-active')"));
    assert.truthy(ui.includes("screen.classList.remove('go-event-active')"));
    assert.truthy(css.includes('.pet-battle-screen.go-event-active{padding:0!important;overflow:hidden'), 'lobby padding cannot leave a blank footer');
    assert.truthy(css.includes('.go-topbar{top:8px}'), 'the app-owned safe area is not counted twice');
    assert.truthy(ui.includes('function isActive(){return active;}'), 'navigation can detect a running event before leaving it');
    assert.truthy(ui.includes("screen.style.removeProperty('overflow')"), 'closing removes any stale Arena scroll lock');
    assert.truthy(ui.includes('screen.scrollTop=0;screen.scrollLeft=0'), 'the restored Arena starts at a valid scroll position');
    const renderBody=arena.slice(arena.indexOf('function renderPetBattle()'),arena.indexOf('// ---- battle history'));
    // Anchor without the empty parens: refreshPetBattle takes a `light`
    // argument now, and indexOf returning -1 silently sliced the WRONG body —
    // the assertion below then passed or failed on unrelated code.
    const refreshStart=arena.indexOf('async function refreshPetBattle(');
    assert.truthy(refreshStart!==-1,'refreshPetBattle must exist to be guarded');
    const refreshBody=arena.slice(refreshStart,arena.indexOf('function pbFmtCountdown'));
    assert.truthy(renderBody.includes('GhostOfferingEvent.isActive && GhostOfferingEvent.isActive()) return'),
      'an old Arena render cannot eject the first event visit');
    assert.truthy(refreshBody.includes('GhostOfferingEvent.isActive && GhostOfferingEvent.isActive()) return _pbState'),
      'a polling response already in flight cannot overwrite the event scene');
  });
  test('bot-on preview visibly simulates competitors without spending user rewards', () => {
    for (const token of ["BOT_NAMES=['Milo','Luna']", 'go-online', "classList.add('scored')", 'updateBot']) assert.truthy(ui.includes(token), token);
    const updateBotBody = ui.slice(ui.indexOf('function updateBot'), ui.indexOf('function showBotScore'));
    assert.falsy(updateBotBody.includes('claim('), 'visual bots never call the reward endpoint');
    assert.falsy(ui.includes('data-go-bot-score'), 'simulated rewards use a coin glint, not another text bubble');
    assert.truthy(api.includes('ghost_offering_world_claims'), 'real concurrent users share one authoritative offering inventory');
  });
  test('the 22:00 public room contains real bot-off users only', () => {
    const worker=read('battle-worker/src/index.js');
    const schedule = require('../js/ghost-offering-schedule.js');
    assert.equal(schedule.roomIdFor({ preview: false }), schedule.EVENT_DATE,
      'all public users join the same date room');
    assert.truthy(api.includes('GhostOfferingSchedule.roomIdFor({ preview, humanTest })'),
      'the API derives the room instead of concatenating its own');
    assert.truthy(worker.includes("GhostOfferingSchedule.roomIdFor({ preview: !!profile.allow_bot, humanTest: isHumanTest })"),
      'bot-off sockets cannot enter either QA bot room');
    for (const [preview, humanTest, want] of [[false, false, schedule.publicRoomId()],
                                              [true, false, schedule.qaRoomId()],
                                              [true, true, schedule.humanTestRoomId()]]) {
      assert.equal(schedule.roomIdFor({ preview, humanTest }), want);
    }
    assert.truthy(ui.includes('if(state.preview&&!state.humanTest)startQaBots(t)'),
      'simulated bot sockets are created only in bot-on preview');
    assert.truthy(ui.includes('function peopleOnlyRoom(){return !!state&&(!state.preview||state.humanTest);}'));
    assert.truthy(ui.includes("stage?.classList.add('people-only')"));
    assert.truthy(css.includes('.go-stage.people-only .go-bot:not(.remote-player){visibility:hidden'),
      'public players never see the local Milo/Luna stand-ins');
    assert.truthy(ui.includes('(peopleOnlyRoom()&&!actor.remote)'),
      'cosmetic bots cannot move or cast in the public room');
  });
  test('the authored 3D scene and new transparent offerings ship offline', () => {
    // Both ride the Arena lazy group (js/lazy-data.js GROUP_FILES.arena),
    // in that order: the event before the lobby that draws its card.
    const arena = require('../js/lazy-data.js').GROUP_FILES.arena;
    assert.truthy(arena.indexOf('js/ghost-offering-event.js') > -1 && arena.indexOf('js/ghost-offering-event.js') < arena.indexOf('js/petbattle.js'));
    assert.falsy(html.includes('ghost-offering-event.js'), 'the event must not block the first paint');
    for (const asset of ['mid-autumn-courtyard-v1.webp','hang-nga-v1.webp','chu-cuoi-v1.webp','mooncake-v1.webp','carp-lantern-v1.webp']) {
      assert.truthy(fs.existsSync(path.join(root, 'img/ghost-offering', asset)), asset + ' exists');
      assert.truthy(sw.includes("'/img/ghost-offering/" + asset + "'"), asset + ' precached');
    }
    for (const asset of ['hang-nga-v1.webp','chu-cuoi-v1.webp','mooncake-v1.webp','carp-lantern-v1.webp']) {
      // Lossless WebP (VP8L): byte 20 is the 0x2f signature, and bit 4 of
      // byte 24 is alpha_is_used — the WebP twin of PNG colour type 6.
      const webp = fs.readFileSync(path.join(root, 'img/ghost-offering', asset));
      assert.equal(webp.toString('latin1', 12, 16), 'VP8L', asset + ' is lossless, so its alpha edges are untouched');
      assert.equal(webp[20], 0x2f, asset + ' has the VP8L signature');
      assert.equal((webp[24] >> 4) & 1, 1, asset + ' is true RGBA, never a baked checkerboard');
      assert.truthy(ui.includes(asset), asset + ' is used by the game');
    }
    assert.truthy(sw.includes("'/js/ghost-offering-event.js'"));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
