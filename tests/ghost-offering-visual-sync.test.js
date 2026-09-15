// 50 multiplayer synchronization cases for the Ghost Offering shared screen.
// Every case compares the authoritative event received by independent viewers,
// so a regression cannot make user B see a different rope/item state from C.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.join(__dirname, '..');
const workerSrc = fs.readFileSync(path.join(root, 'battle-worker/src/index.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(root, 'js/ghost-offering-event.js'), 'utf8');
const cssSrc = require('./css-all').readAllCss();
const ALL_ITEMS = [
  'hangnga', 'cuoi',
  'mooncake1', 'mooncake2', 'mooncake3', 'mooncake4',
  'lantern1', 'lantern2', 'lantern3', 'lantern4', 'lantern5', 'lantern6', 'lantern7', 'lantern8',
];

function loadRoomClass() {
  let src = workerSrc.slice(workerSrc.indexOf('const OFFERING_ITEMS'));
  src = src.replace('export class GhostOfferingRoom', 'class GhostOfferingRoom') + '\nthis.GhostOfferingRoom=GhostOfferingRoom;';
  const context = { TextDecoder, URL, Response, console };
  vm.createContext(context);
  vm.runInContext(src, context);
  return context.GhostOfferingRoom;
}

class SyncSocket {
  constructor(uid, name) {
    this.attachment = { uid, name, actorId: `user-${uid}`, itemId: null };
    this.messages = [];
  }
  deserializeAttachment() { return this.attachment; }
  serializeAttachment(value) { this.attachment = value; }
  send(raw) { this.messages.push(JSON.parse(raw)); }
  take(type) { return this.messages.filter(message => message.t === type); }
  last(type) { return this.take(type).slice(-1)[0]; }
  clear() { this.messages.length = 0; }
  close() { this.closed = true; }
}

function fixture(size = 3) {
  const identities = [[101, 'An'], [202, 'Binh'], [303, 'Chi'], [404, 'Dung']];
  const sockets = identities.slice(0, size).map(([uid, name]) => new SyncSocket(uid, name));
  const values = new Map();
  const storage = {
    get: async key => values.get(key),
    put: async (key, value) => values.set(key, value),
    delete: async key => values.delete(key),
  };
  const state = { sockets, storage, getWebSockets: () => state.sockets };
  const Room = loadRoomClass();
  return { room: new Room(state, {}), state, sockets, values };
}

function sameLast(viewers, type, message) {
  const snapshots = viewers.map(viewer => viewer.last(type));
  snapshots.forEach(snapshot => assert.truthy(snapshot, `${type} must reach every viewer`));
  snapshots.slice(1).forEach(snapshot => assert.deepEqual(snapshot, snapshots[0], 'viewers must receive identical state'));
  if (message) assert.deepEqual(snapshots[0], message, 'remote view must match the actor state');
  return snapshots[0];
}

async function grab(room, actor, itemId) {
  await room.webSocketMessage(actor, JSON.stringify({ t: 'offering-grab', itemId }));
  assert.equal(actor.last('offering-granted').itemId, itemId);
}

suite('ghost offering realtime: 50 shared-screen synchronization cases', () => {
  // Cases 1-14: A casts toward every offering. B and C must render the exact
  // same extending rope, hook position, actor identity and locked item.
  ALL_ITEMS.forEach((itemId, index) => {
    test(`sync ${String(index + 1).padStart(2, '0')}/50: A extend ${itemId} is identical for B and C`, async () => {
      const { room, sockets: [a, b, c] } = fixture();
      await grab(room, a, itemId);
      sameLast([b, c], 'offering-locked', {
        t: 'offering-locked', itemId, uid: 101, actorId: 'user-101', name: 'An',
      });
      const angle = -52 + index * 8;
      const length = Number((0.18 + index * 0.04).toFixed(2));
      await room.webSocketMessage(a, JSON.stringify({ t: 'offering-progress', itemId, angle, length, phase: 'extend' }));
      sameLast([b, c], 'offering-progress', {
        t: 'offering-progress', itemId, uid: 101, actorId: 'user-101', name: 'An', angle, length, phase: 'extend',
      });
    });
  });

  // Cases 15-28: reverse direction. B is now the actor; A and C must see the
  // same retract state and the item attached to the same hook coordinates.
  ALL_ITEMS.forEach((itemId, index) => {
    test(`sync ${String(index + 15).padStart(2, '0')}/50: B retract ${itemId} is identical for A and C`, async () => {
      const { room, sockets: [a, b, c] } = fixture();
      await grab(room, b, itemId);
      sameLast([a, c], 'offering-locked', {
        t: 'offering-locked', itemId, uid: 202, actorId: 'user-202', name: 'Binh',
      });
      const angle = 52 - index * 8;
      const length = Number((0.82 - index * 0.04).toFixed(2));
      await room.webSocketMessage(b, JSON.stringify({ t: 'offering-progress', itemId, angle, length, phase: 'retract' }));
      sameLast([a, c], 'offering-progress', {
        t: 'offering-progress', itemId, uid: 202, actorId: 'user-202', name: 'Binh', angle, length, phase: 'retract',
      });
    });
  });

  // Cases 29-33: every mooncake/Cuội snap is visible to both observers and frees
  // the same item, preventing the old instant-teleport/reappearing-food bug.
  [1, 2, 3, 4, 5].forEach((number, index) => {
    const itemId = number === 5 ? 'cuoi' : `mooncake${number}`;
    test(`sync ${String(index + 29).padStart(2, '0')}/50: snapped ${itemId} breaks and returns for both viewers`, async () => {
      const { room, sockets: [a, b, c] } = fixture();
      await grab(room, a, itemId);
      await room.webSocketMessage(a, JSON.stringify({ t: 'offering-progress', itemId, angle: 18, length: .24, phase: 'retract' }));
      await room.webSocketMessage(a, JSON.stringify({ t: 'offering-release', itemId, reason: 'snap' }));
      sameLast([b, c], 'offering-released', {
        t: 'offering-released', itemId, uid: 101, actorId: 'user-101', reason: 'snap',
      });
      assert.equal(a.attachment.itemId, null, 'server lock clears at the same snap frame');
      await grab(room, b, itemId);
      assert.equal(b.attachment.itemId, itemId, 'returned food can be hooked again');
    });
  });

  // Cases 34-41: a successful lantern claim disappears for both viewers and is
  // persisted in the shared room inventory for late joiners.
  Array.from({ length: 8 }, (_, index) => `lantern${index + 1}`).forEach((itemId, index) => {
    test(`sync ${String(index + 34).padStart(2, '0')}/50: claimed ${itemId} disappears for B and C`, async () => {
      const { room, state, sockets: [a, b, c] } = fixture();
      await grab(room, a, itemId);
      await room.webSocketMessage(a, JSON.stringify({ t: 'offering-claimed', itemId }));
      sameLast([b, c], 'offering-claimed', {
        t: 'offering-claimed', itemId, uid: 101, actorId: 'user-101',
      });
      assert.contains(await state.storage.get('claimed'), itemId, 'late viewers restore the same removed item');
      await room.webSocketMessage(b, JSON.stringify({ t: 'offering-grab', itemId }));
      assert.equal(b.last('offering-denied').claimed, true);
    });
  });

  // Cases 42-50: boundaries, contention and lifecycle events which previously
  // caused one screen to keep a stale rope, lock or player count.
  test('sync 42/50: Hằng Nga snap reason and release frame match for B and C', async () => {
    const { room, sockets: [a, b, c] } = fixture();
    await grab(room, a, 'hangnga');
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-release', itemId: 'hangnga', reason: 'snap' }));
    sameLast([b, c], 'offering-released', { t: 'offering-released', itemId: 'hangnga', uid: 101, actorId: 'user-101', reason: 'snap' });
    assert.truthy(uiSrc.includes("bot.classList.add('remote-snapped')"), 'both viewers show the tired dog and broken-rope recovery');
    assert.truthy(cssSrc.includes('.go-bot.remote-snapped .go-bot-sweat'), 'remote snap visibly keeps the sweat state');
  });

  test('sync 43/50: ordinary miss releases the same item on B and C', async () => {
    const { room, sockets: [a, b, c] } = fixture();
    await grab(room, a, 'lantern1');
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-release', itemId: 'lantern1', reason: 'release' }));
    sameLast([b, c], 'offering-released', { t: 'offering-released', itemId: 'lantern1', uid: 101, actorId: 'user-101', reason: 'release' });
  });

  test('sync 44/50: disconnect removes A rope and lock identically for B and C', async () => {
    const { room, sockets: [a, b, c] } = fixture();
    await grab(room, a, 'lantern2');
    await room.webSocketClose(a);
    sameLast([b, c], 'offering-released', { t: 'offering-released', itemId: 'lantern2', uid: 101, actorId: 'user-101' });
    sameLast([b, c], 'offering-presence', { t: 'offering-presence', left: 101, actorId: 'user-101', name: 'An', peers: 2 });
  });

  test('sync 45/50: socket error removes A rope and lock identically for B and C', async () => {
    const { room, sockets: [a, b, c] } = fixture();
    await grab(room, a, 'lantern3');
    await room.webSocketError(a);
    sameLast([b, c], 'offering-released', { t: 'offering-released', itemId: 'lantern3', uid: 101, actorId: 'user-101' });
    assert.truthy(a.closed, 'failed socket closes after shared cleanup');
  });

  test('sync 46/50: maximum angle and rope length clamp identically on B and C', async () => {
    const { room, sockets: [a, b, c] } = fixture();
    await grab(room, a, 'lantern4');
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-progress', itemId: 'lantern4', angle: 999, length: 999, phase: 'extend' }));
    sameLast([b, c], 'offering-progress', { t: 'offering-progress', itemId: 'lantern4', uid: 101, actorId: 'user-101', name: 'An', angle: 70, length: 1, phase: 'extend' });
  });

  test('sync 47/50: minimum angle and rope length clamp identically on B and C', async () => {
    const { room, sockets: [a, b, c] } = fixture();
    await grab(room, a, 'lantern5');
    await room.webSocketMessage(a, JSON.stringify({ t: 'offering-progress', itemId: 'lantern5', angle: -999, length: -999, phase: 'retract' }));
    sameLast([b, c], 'offering-progress', { t: 'offering-progress', itemId: 'lantern5', uid: 101, actorId: 'user-101', name: 'An', angle: -70, length: 0, phase: 'retract' });
  });

  test('sync 48/50: spoofed progress never appears on either observer screen', async () => {
    const { room, sockets: [a, b, c] } = fixture();
    await grab(room, a, 'lantern6');
    await room.webSocketMessage(b, JSON.stringify({ t: 'offering-progress', itemId: 'lantern6', angle: 20, length: .4, phase: 'extend' }));
    assert.equal(a.take('offering-progress').length, 0);
    assert.equal(c.take('offering-progress').length, 0);
  });

  test('sync 49/50: same-item race produces one shared lock identity', async () => {
    const { room, sockets: [a, b, c] } = fixture();
    await Promise.all([
      room.webSocketMessage(a, JSON.stringify({ t: 'offering-grab', itemId: 'lantern7' })),
      room.webSocketMessage(b, JSON.stringify({ t: 'offering-grab', itemId: 'lantern7' })),
    ]);
    const winner = a.attachment.itemId ? a : b;
    const loser = winner === a ? b : a;
    assert.equal(winner.attachment.itemId, 'lantern7');
    assert.equal(loser.attachment.itemId, null);
    assert.equal(c.take('offering-locked').length, 1, 'neutral viewer sees only the authoritative winner');
    assert.equal(c.last('offering-locked').uid, winner.attachment.uid);
  });

  test('sync 50/50: simultaneous different pulls remain attributable on every screen', async () => {
    const { room, sockets: [a, b, c, d] } = fixture(4);
    await grab(room, a, 'mooncake1');
    await grab(room, b, 'lantern8');
    a.clear(); b.clear(); c.clear(); d.clear();
    await Promise.all([
      room.webSocketMessage(a, JSON.stringify({ t: 'offering-progress', itemId: 'mooncake1', angle: -22, length: .61, phase: 'retract' })),
      room.webSocketMessage(b, JSON.stringify({ t: 'offering-progress', itemId: 'lantern8', angle: 31, length: .37, phase: 'extend' })),
    ]);
    assert.deepEqual(c.take('offering-progress'), d.take('offering-progress'), 'two neutral viewers render the same two ropes in the same order');
    assert.deepEqual(c.take('offering-progress').map(message => [message.uid, message.itemId, message.phase]), [
      [101, 'mooncake1', 'retract'], [202, 'lantern8', 'extend'],
    ]);
    assert.deepEqual(a.last('offering-progress'), c.take('offering-progress')[1], 'A sees B exactly as C sees B');
    assert.deepEqual(b.last('offering-progress'), c.take('offering-progress')[0], 'B sees A exactly as C sees A');
    assert.truthy(uiSrc.includes('setRemoteHaulEffects(actor,m.itemId,actor.remotePhase)'), 'remote retract activates the same heavy-haul expression');
    assert.truthy(uiSrc.includes('showRemoteDogCelebration(actor)'), 'remote claim activates the same happy expression');
    assert.truthy(cssSrc.includes('.go-bot.remote-hauling-heavy .go-bot-sweat') && cssSrc.includes('.go-bot.remote-celebrate .go-bot-dog-happy'));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
