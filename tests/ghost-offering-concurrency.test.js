const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm'), child = require('child_process');
const root = path.join(__dirname, '..');
const workerSrc = fs.readFileSync(path.join(root, 'battle-worker/src/index.js'), 'utf8');
const apiSrc = fs.readFileSync(path.join(root, 'functions/api/ghost-offering.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(root, 'js/ghost-offering-event.js'), 'utf8');
const linkMod = require('../js/ghost-offering-link.js');
const eventMod = require('../js/ghost-offering-event.js');

function loadRoomClass() {
  let src = workerSrc.slice(workerSrc.indexOf('const OFFERING_ITEMS'));
  src = src.replace('export class GhostOfferingRoom', 'class GhostOfferingRoom') + '\nthis.GhostOfferingRoom=GhostOfferingRoom;';
  const context = { TextDecoder, URL, Response, console };
  vm.createContext(context); vm.runInContext(src, context);
  return context.GhostOfferingRoom;
}
class FakeSocket {
  constructor(uid, name, actorId) { this.attachment = { uid, name, actorId: actorId || `user-${uid}`, itemId: null }; this.messages = []; }
  deserializeAttachment() { return this.attachment; }
  serializeAttachment(v) { this.attachment = v; }
  send(raw) { this.messages.push(JSON.parse(raw)); }
  take(type) { return this.messages.filter(m => m.t === type); }
}
function roomFixture() {
  const sockets = [new FakeSocket(101, 'An'), new FakeSocket(202, 'Binh')];
  const values = new Map();
  const storage = { get: async k => values.get(k), put: async (k,v) => values.set(k,v), delete: async k => values.delete(k) };
  const state = { sockets, storage, getWebSockets: () => state.sockets };
  const Room = loadRoomClass();
  return { room: new Room(state, {}), state, a: sockets[0], b: sockets[1] };
}

suite('ghost offering realtime: two-user concurrency', () => {
  test('simultaneous grabs of the same chicken produce exactly one lock owner', async () => {
    const { room, a, b } = roomFixture();
    await Promise.all([
      room.webSocketMessage(a, JSON.stringify({ t: 'offering-grab', itemId: 'chicken1' })),
      room.webSocketMessage(b, JSON.stringify({ t: 'offering-grab', itemId: 'chicken1' })),
    ]);
    const grants = a.take('offering-granted').length + b.take('offering-granted').length;
    const denials = a.take('offering-denied').length + b.take('offering-denied').length;
    assert.equal(grants, 1); assert.equal(denials, 1);
    assert.equal([a, b].filter(s => s.attachment.itemId === 'chicken1').length, 1);
  });

  test('A pulling a chicken is broadcast to B with trusted A identity and motion', async () => {
    const { room, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-grab', itemId: 'chicken2' }));
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-progress', itemId: 'chicken2', angle: 21, length: .42 }));
    const locked = b.take('offering-locked')[0], progress = b.take('offering-progress')[0];
    assert.deepEqual([locked.itemId, locked.uid, locked.name], ['chicken2', 101, 'An']);
    assert.deepEqual([progress.itemId, progress.uid, progress.angle, progress.length], ['chicken2', 101, 21, .42]);
    assert.falsy(a.take('offering-progress').length, 'sender does not receive its own echo');
  });

  test('B offering moves toward B dog on A screen, never toward A local dog', async () => {
    const { room, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t:'offering-grab', itemId:'chicken1' }));
    await room.webSocketMessage(a, JSON.stringify({ t:'offering-progress', itemId:'chicken1', angle:19, length:.48, phase:'retract', x:.413, y:.527, haul:.62 }));
    const progress=b.take('offering-progress').slice(-1)[0];
    assert.deepEqual([progress.x,progress.y,progress.haul],[.413,.527,.62]);
    const snapshot=await room._snapshot(b,202);
    assert.deepEqual([snapshot.locks[0].x,snapshot.locks[0].y,snapshot.locks[0].haul],[.413,.527,.62], 'late join gets the same haul progress');
    const remoteDog={x:100,y:800},offering={x:500,y:300};
    const hooked=eventMod._remotePathPoint(remoteDog,offering,1,46),mid=eventMod._remotePathPoint(remoteDog,offering,.5,46),nearDog=eventMod._remotePathPoint(remoteDog,offering,0,46);
    assert.deepEqual([hooked.x,hooked.y],[500,300], 'the hook starts exactly on the offering');
    assert.truthy(mid.x<hooked.x&&nearDog.x<mid.x, 'as haul decreases, the gift travels left toward remote B dog');
    assert.truthy(Math.hypot(nearDog.x-remoteDog.x,nearDog.y-remoteDog.y)<Math.hypot(mid.x-remoteDog.x,mid.y-remoteDog.y));
    assert.truthy(uiSrc.includes('haul=Number.isFinite(m.haul)?m.haul:legacyHaul'));
    assert.falsy(uiSrc.includes('targetX=hasPoint?m.x*hookGame.width:null'), 'sender screen coordinate is never reused as the receiver destination');
    assert.truthy(uiSrc.includes("if(m.t==='offering-locked'")&&uiSrc.includes('remoteTarget=target'), 'the receiver remembers its own path from gift to remote dog');
    assert.truthy(uiSrc.includes('performance.now()-lastProgressAt>50'), 'motion updates at roughly 20fps instead of the old 10fps');
  });

  test('server clamps forged coordinates and haul progress', async () => {
    const { room, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t:'offering-grab', itemId:'fruit2' }));
    await room.webSocketMessage(a, JSON.stringify({ t:'offering-progress', itemId:'fruit2', angle:0, length:.5, x:9, y:-4, haul:7 }));
    const progress=b.take('offering-progress').slice(-1)[0];
    assert.deepEqual([progress.x,progress.y,progress.haul],[1,0,1]);
  });

  test('socket preserves throw/pull phases and the snap reason for every viewer', async () => {
    const { room, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t:'offering-grab', itemId:'chicken2' }));
    await room.webSocketMessage(a, JSON.stringify({ t:'offering-progress', itemId:'chicken2', angle:12, length:.5, phase:'extend' }));
    assert.equal(b.take('offering-progress').slice(-1)[0].phase, 'extend');
    await room.webSocketMessage(a, JSON.stringify({ t:'offering-release', itemId:'chicken2', reason:'snap' }));
    assert.equal(b.take('offering-released').slice(-1)[0].reason, 'snap');
  });

  test('B joining mid-haul receives A exact current frame and current altar inventory', async () => {
    const { room, state, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t:'offering-grab', itemId:'chicken2' }));
    await room.webSocketMessage(a, JSON.stringify({ t:'offering-progress', itemId:'chicken2', angle:27, length:.63, phase:'retract' }));
    await room.webSocketMessage(b, JSON.stringify({ t:'offering-grab', itemId:'fruit1' }));
    await room.webSocketMessage(b, JSON.stringify({ t:'offering-claimed', itemId:'fruit1' }));
    const late=new FakeSocket(303,'Chi'),snapshot=await room._snapshot(late,303);
    assert.deepEqual(snapshot.players.map(p=>p.actorId),['user-101','user-202'], 'a late player sees everybody already waiting, even when they are not casting');
    assert.deepEqual(snapshot.claimed,['fruit1'],'B starts with gifts already taken removed from the altar');
    assert.deepEqual(snapshot.locks,[{itemId:'chicken2',uid:101,actorId:'user-101',name:'An',angle:27,length:.63,phase:'retract'}], 'B enters at A current rope frame, not frame zero');
    assert.equal(snapshot.peers,state.sockets.length-1);
    assert.truthy(uiSrc.includes("onRealtimeMessage(Object.assign({t:'offering-progress'},lock))"), 'client paints the snapshot motion immediately after the lock');
    assert.truthy(uiSrc.includes('snapshot:true')&&uiSrc.includes('if(!m.snapshot)'), 'already claimed gifts disappear without replaying an old celebration');
  });

  test('B cannot spoof progress for an item locked by A', async () => {
    const { room, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-grab', itemId: 'pig' }));
    await room.webSocketMessage(b, JSON.stringify({ t: 'offering-progress', itemId: 'pig', angle: 50, length: .1 }));
    assert.equal(a.take('offering-progress').length, 0);
    assert.equal(b.attachment.itemId, null);
  });

  test('B may lock a different gift while A is pulling a chicken', async () => {
    const { room, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-grab', itemId: 'chicken3' }));
    await room.webSocketMessage(b, JSON.stringify({ t: 'offering-grab', itemId: 'fruit1' }));
    assert.equal(a.attachment.itemId, 'chicken3');
    assert.equal(b.attachment.itemId, 'fruit1');
    assert.equal(a.take('offering-locked').slice(-1)[0].itemId, 'fruit1');
  });

  test('rope snap releases the gift so B can acquire it immediately', async () => {
    const { room, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-grab', itemId: 'chicken4' }));
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-release', itemId: 'chicken4', reason: 'snap' }));
    await room.webSocketMessage(b, JSON.stringify({ t: 'offering-grab', itemId: 'chicken4' }));
    assert.equal(a.attachment.itemId, null); assert.equal(b.attachment.itemId, 'chicken4');
    assert.equal(b.take('offering-granted').length, 1);
  });

  test('disconnect releases A lock and announces it to B', async () => {
    const { room, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-grab', itemId: 'fruit2' }));
    await room.webSocketClose(a);
    const released = b.take('offering-released').slice(-1)[0];
    assert.deepEqual([released.itemId, released.uid], ['fruit2', 101]);
  });

  test('server clamps motion and rejects unknown inventory ids', async () => {
    const { room, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-grab', itemId: 'fruit3' }));
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-progress', itemId: 'fruit3', angle: 999, length: 99 }));
    const p = b.take('offering-progress')[0]; assert.deepEqual([p.angle, p.length], [70, 1]);
    await room.webSocketMessage(b, JSON.stringify({ t: 'offering-grab', itemId: 'admin-gift' }));
    assert.equal(b.attachment.itemId, null);
  });

  test('a claimed chicken stays unavailable to a player who joins the active QA round later', async () => {
    const { room, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-grab', itemId: 'chicken5' }));
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-claimed', itemId: 'chicken5' }));
    await room.webSocketMessage(b, JSON.stringify({ t: 'offering-grab', itemId: 'chicken5' }));
    assert.equal(b.take('offering-denied').slice(-1)[0].claimed, true);
    assert.equal(b.attachment.itemId, null);
  });

  test('A award settles in place without redrawing or reconnecting the shared altar', () => {
    const claimBody=uiSrc.slice(uiSrc.indexOf('async function claim(id)'),uiSrc.indexOf('function announce'));
    assert.truthy(claimBody.includes('realtimeLink?.claimed(id)'));
    assert.truthy(claimBody.includes('claiming=false;settleClaim(id,!!res.data.awarded)'));
    assert.falsy(claimBody.includes('render()'), 'claiming a gift must not replace the scene and flash every sprite');
    assert.falsy(claimBody.includes('startRealtime()'), 'the existing socket must stay alive so B late join sees claimed gifts');
    assert.truthy(uiSrc.includes("el.classList.remove('hooked','remote-locked','coin-claimed')"), 'only the claimed item is settled after its coin flight');
    assert.truthy(uiSrc.includes("actor.mode='swing'"), 'the same hook actor returns to idle without recreating the game');
  });

  test('the QA table resets only after the final socket leaves', async () => {
    const { room, state, a, b } = roomFixture();
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-grab', itemId: 'fruit8' }));
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-claimed', itemId: 'fruit8' }));
    state.sockets = [a, b]; await room.webSocketClose(a);
    assert.deepEqual(await state.storage.get('claimed'), ['fruit8'], 'B still sees A claimed fruit');
    state.sockets = [b]; await room.webSocketClose(b);
    assert.equal(await state.storage.get('claimed'), undefined, 'empty room starts a fresh QA round next time');
  });

  test('D1 has a global unique key as final protection when sockets race or drop', () => {
    assert.truthy(apiSrc.includes('ghost_offering_world_claims'));
    assert.truthy(apiSrc.includes('PRIMARY KEY (event_date,item_id)'));
    assert.truthy(apiSrc.includes('INSERT OR IGNORE INTO ghost_offering_world_claims'));
    assert.truthy(apiSrc.includes('SELECT item_id FROM ghost_offering_world_claims WHERE event_date=?'));
  });

  test('the checked-in SQLite migration rejects the second winner atomically', () => {
    const migration = fs.readFileSync(path.join(root, 'db/012-ghost-offering-event.sql'), 'utf8');
    const sql = `${migration}\nINSERT OR IGNORE INTO ghost_offering_world_claims VALUES('2026-08-27','chicken1',101,50,1); SELECT changes(); INSERT OR IGNORE INTO ghost_offering_world_claims VALUES('2026-08-27','chicken1',202,50,2); SELECT changes(); SELECT user_id FROM ghost_offering_world_claims WHERE event_date='2026-08-27' AND item_id='chicken1';`;
    const out = child.execFileSync('sqlite3', [':memory:'], { input: sql, encoding: 'utf8' }).trim().split(/\s+/);
    assert.deepEqual(out.slice(-3), ['1', '0', '101'], 'first insert wins, second insert changes zero rows');
  });

  test('clients cannot split the crowd by inventing a different room id', () => {
    assert.truthy(workerSrc.includes("if (offering[1] !== expectedRoom) return new Response('Wrong event room'"));
    assert.truthy(workerSrc.includes("idFromName('offering-' + expectedRoom)"));
    // Relay và API cùng đọc js/ghost-offering-schedule.js, nên không thể lệch
    // phòng nữa — trước đây mỗi bên giữ một bản sao ngày và deploy riêng nhau.
    const schedule = require('../js/ghost-offering-schedule.js');
    assert.truthy(apiSrc.includes('GhostOfferingSchedule.roomIdFor({ preview, humanTest })'));
    assert.truthy(workerSrc.includes("import GhostOfferingSchedule from '../../js/ghost-offering-schedule.js'"),
      'the relay uses the same final room as the API');
    assert.truthy(workerSrc.includes('GhostOfferingSchedule.humanTestRoomId()'));
    assert.truthy(workerSrc.includes('!GhostOfferingSchedule.eventWindow().open'), 'public sockets are accepted only during the final two-hour window');
    assert.truthy(workerSrc.includes("GhostOfferingSchedule.roomIdFor({ preview: !!profile.allow_bot, humanTest: isHumanTest })"), 'both QA modes stay outside the public table');
    assert.equal(new Set([schedule.publicRoomId(), schedule.qaRoomId(), schedule.humanTestRoomId()]).size, 3);
    assert.truthy(workerSrc.includes("if (isHumanTest && (!profile.allow_bot || botParam !== null))"), 'bot-off users and simulated bot sockets cannot enter the human QA room');
  });

  test('the playfield waits for the lock and renders the remote rope pull', () => {
    assert.truthy(uiSrc.includes("actor.mode='await-lock'"), 'collision pauses until the room grants ownership');
    assert.truthy(uiSrc.includes("realtimeLink.grab(hit.dataset.goItem)"));
    assert.truthy(uiSrc.includes(':not(.remote-locked)'), 'B cannot collide with A locked chicken');
    assert.truthy(uiSrc.includes("m.t==='offering-progress'"));
    assert.truthy(uiSrc.includes('actor.remote=true') && uiSrc.includes('paintActor'), 'A uses a visible dog, hook and rope on B screen');
    assert.truthy(uiSrc.includes("realtimeLink?.release(id,'snap')"), 'a broken rope frees the item');
    assert.truthy(uiSrc.includes('realtimeLink?.claimed(id)'), 'a successful award removes the shared item');
  });

  test('one bot-on account can create two independent QA socket players', async () => {
    const main=new FakeSocket(101,'Tester','user-101'),milo=new FakeSocket(101,'Milo','bot-101-0'),luna=new FakeSocket(101,'Luna','bot-101-1');
    const values=new Map(),state={sockets:[main,milo,luna],getWebSockets(){return this.sockets;},storage:{get:async k=>values.get(k),put:async(k,v)=>values.set(k,v),delete:async k=>values.delete(k)}};
    const Room=loadRoomClass(),room=new Room(state,{});
    await Promise.all([
      room.webSocketMessage(milo,JSON.stringify({t:'offering-grab',itemId:'chicken1'})),
      room.webSocketMessage(luna,JSON.stringify({t:'offering-grab',itemId:'fruit1'})),
    ]);
    assert.deepEqual([milo.attachment.itemId,luna.attachment.itemId],['chicken1','fruit1']);
    assert.deepEqual(main.take('offering-locked').map(m=>m.actorId).sort(),['bot-101-0','bot-101-1']);
  });

  test('QA bot sockets are server-gated and autonomous, not cosmetic animation', () => {
    assert.truthy(workerSrc.includes("!profile.allow_bot") && workerSrc.includes("return new Response('Invalid QA bot'"));
    assert.truthy(uiSrc.includes('startQaBots(t)') && uiSrc.includes('bot.link.grab(item.id)'));
    assert.truthy(uiSrc.includes("bot.link.progress(bot.itemId,angle,length,'extend',") && uiSrc.includes("bot.link.progress(bot.itemId,angle,length,'retract',"));
    assert.truthy(uiSrc.includes("bot.link.release(item.id,'snap')") && uiSrc.includes('bot.link.claimed(item.id)'));
  });

  test('real-player rooms keep peers visible and never start Milo or Luna', () => {
    assert.truthy(uiSrc.includes('if(state.preview&&!state.humanTest)startQaBots(t)'));
    assert.truthy(uiSrc.includes("(m.players||[]).forEach(player=>remoteActor"), 'late join reconstructs every waiting peer');
    assert.truthy(uiSrc.includes('remoteActor(m.joined,m.name,m.actorId)'), 'a later player appears without simultaneous tapping');
    assert.truthy(uiSrc.includes("releaseRemoteActor(m.left,null,m.actorId||`user-${m.left}`,true)"), 'only a real disconnect removes a waiting dog');
    assert.truthy(uiSrc.includes("peopleOnlyRoom()&&!forceLeave"), 'finishing one cast does not make the remote player disappear');
    assert.truthy(workerSrc.includes('players, locks, claimed'), 'snapshot carries identities, motion and the remaining table together');
  });

  test('presence leave carries the same actor identity used to remove the remote dog', () => {
    assert.truthy(workerSrc.includes("left: att.uid, actorId: att.actorId, name: att.name, peers"));
    assert.truthy(uiSrc.includes("container.classList.add('remote-player')"));
    assert.truthy(uiSrc.includes("container.classList.remove('remote-player')"));
  });

  test('QA bot rope aims at the actual offering and remote snap stays visible', () => {
    assert.truthy(uiSrc.includes('target=itemStageGeometry(item)'));
    assert.truthy(uiSrc.includes('qaBotFirstCollision(actor,intended,available)'), 'the bot cannot pass through a closer offering');
    assert.truthy(uiSrc.includes('Math.atan2(targetX-anchor.x,anchor.y-targetY)'), 'angle derives from the selected item coordinate');
    assert.truthy(workerSrc.includes("reason: msg.reason === 'snap' ? 'snap' : 'release'"), 'socket preserves the break reason');
    assert.truthy(uiSrc.includes("if(m.reason==='snap')snapRemoteActor(m)"));
    assert.truthy(uiSrc.includes('data-go-bot-snap=') && uiSrc.includes('returnSnappedItem(m.itemId)'), 'viewer draws two rope pieces and sends the food back');
  });
});

function FakeWS(url) { this.url=url; this.readyState=0; this.sent=[]; FakeWS.last=this; }
FakeWS.prototype.open=function(){this.readyState=1;this.onopen&&this.onopen();};
FakeWS.prototype.send=function(raw){this.sent.push(JSON.parse(raw));};
FakeWS.prototype.recv=function(m){this.onmessage&&this.onmessage({data:JSON.stringify(m)});};
FakeWS.prototype.close=function(){this.readyState=3;};

suite('ghost offering realtime: browser transport', () => {
  test('connects to the shared offering room and sends only shaped actions', () => {
    global.WebSocket=FakeWS; const received=[];
    const l=new linkMod.GhostOfferingLink({roomId:'2026-08-27',token:'signed',onMessage:m=>received.push(m)});
    l.start(); assert.truthy(FakeWS.last.url.includes('/offering/2026-08-27?token=signed'));
    FakeWS.last.open(); l.grab('chicken1'); l.progress('chicken1',20,.5); l.release('chicken1','snap');
    assert.deepEqual(FakeWS.last.sent.map(m=>m.t),['offering-grab','offering-progress','offering-release']);
    FakeWS.last.recv({t:'offering-locked',itemId:'chicken2',uid:2}); assert.equal(received.length,1); l.close();
  });
  test('transport includes normalized haul progress when the renderer supplies it', () => {
    global.WebSocket=FakeWS;
    const l=new linkMod.GhostOfferingLink({roomId:'qa-human-2026-08-27',token:'signed'});l.start();FakeWS.last.open();
    l.progress('chicken1',20,.5,'retract',.41,.53,.62);
    assert.deepEqual(FakeWS.last.sent[0],{t:'offering-progress',itemId:'chicken1',angle:20,length:.5,phase:'retract',x:.41,y:.53,haul:.62});l.close();
  });
  test('a QA bot opens its own socket identity without exposing it to normal users', () => {
    global.WebSocket=FakeWS;
    const l=new linkMod.GhostOfferingLink({roomId:'qa-2026-08-27',token:'signed',botId:1});l.start();
    assert.truthy(FakeWS.last.url.includes('/offering/qa-2026-08-27?token=signed&bot=1'));l.close();
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
