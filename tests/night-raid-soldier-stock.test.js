// Kho lính sau khi bỏ trần và bỏ tiêu hao.
//
// Luật mới, do phụ huynh chốt:
//   - nuôi bao nhiêu lính cũng được, KHÔNG còn trần 10;
//   - cướp đêm KHÔNG còn tiêu lính, thắng hay thua cũng giữ nguyên quân;
//   - bãi cỏ chỉ vẽ tối đa ARMY_DISPLAY_CAP con cho đỡ rối, còn HUD trên đầu
//     màn hình vẫn hiện SỐ THẬT, cùng tổng DAM và DEF.
//
// Ba lỗi cũ đã ăn mất lính của bé và đều được chốt lại ở đây:
//   1. trận đánh bot trừ sạch kho lính ngay trên máy;
//   2. finish.js trừ tiếp một lần nữa trên máy chủ;
//   3. PUT /night-raid/home lấy min(kho cũ, số client gửi), nên một client cũ
//      kéo tụt kho lính và nuốt luôn mẻ vừa thu hoạch.
'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const NR = loadModule('js/night-raid-rules.js');

const homeHandler = () => loadModule('functions/api/night-raid/home.js');
const collectHandler = () => loadModule('functions/api/night-raid/collect.js');

const READY = 1;                       // đã tới hạn từ lâu
const barracks = (n, readyAt) => Array.from({ length: n }, (_, i) => ({
    type: 'training-barracks', gx: i * 8, gy: 0, tier: 1,
    uid: 'p-barracks-' + i, readyAt,
}));

async function seed(world, user, soldiers, readyAt) {
    // Create the empty home, fund its server mirror, then buy the two
    // barracks through the same explicit operation used by the builder.
    await world.call(homeHandler().onRequestPut, {
        url: '/api/night-raid/home', method: 'PUT', token: user.token,
        body: { layout: { cells: [], soldiers: 0, dogLane: 2 }, dogLevel: 5, coins: 16000 },
    });
    let r;
    for (const cell of barracks(2, readyAt)) {
        const row = world.db.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').get(user.uid);
        const layout = NR.normalizeLayout(JSON.parse(row.layout_json));
        layout.cells.push(cell);
        r = await world.call(homeHandler().onRequestPut, {
            url: '/api/night-raid/home', method: 'PUT', token: user.token,
            body: { layout, dogLevel: 5,
                barracksPurchase: { uid: cell.uid, gx: cell.gx, gy: cell.gy } },
        });
        assert.truthy(r.ok, 'seed thất bại: ' + JSON.stringify(r.data));
    }
    // Kho lính KHÔNG bao giờ đến từ client — kể cả ở lần PUT đầu tiên của một
    // nhà mới, vốn là đúng chỗ hở mà cái trần 10 lính cũ đang bịt: một acc
    // chưa từng mở Cướp Đêm PUT soldiers: 1000000 là thắng mọi nhà. Fixture
    // nào cần sẵn quân thì đặt thẳng vào DB, đúng như collect.js làm.
    if (soldiers) {
        const row = world.db.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').get(user.uid);
        const stored = JSON.parse(row.layout_json);
        stored.soldiers = soldiers;
        world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?')
            .run(JSON.stringify(stored), user.uid);
    }
    return r;
}
// Trại Huấn Luyện KHÔNG còn chạy theo đồng hồ 24 h: nó trả một lính cho mỗi
// NGÀY bé làm xong hết nhiệm vụ (js/farm-rules.js barracksReady). PUT /home
// đóng dấu lastDay = số ngày hiện tại, nên muốn thử thu hoạch thì phải thêm
// một ngày đã hoàn thành vào daily_task_rewards — hạ readyAt không còn tác
// dụng gì với trại nữa.
function makeReady(world, uid) {
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    world.db.prepare('INSERT OR IGNORE INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (?, ?, 200, 1)')
        .run(uid, today);
}
function storedSoldiers(world, uid) {
    const row = world.db.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').get(uid);
    return NR.normalizeLayout(JSON.parse(row.layout_json)).soldiers;
}

suite('kho lính: không còn trần', () => {
    test('normalizeLayout giữ nguyên số lính lớn, chỉ chặn rác', () => {
        assert.equal(NR.normalizeLayout({ cells: [], soldiers: 250 }).soldiers, 250);
        assert.equal(NR.normalizeLayout({ cells: [], soldiers: 0 }).soldiers, 0);
        assert.equal(NR.normalizeLayout({ cells: [], soldiers: -5 }).soldiers, 0);
        assert.equal(NR.normalizeLayout({ cells: [], soldiers: 'bậy' }).soldiers, 0);
        assert.equal(NR.normalizeLayout({ cells: [], soldiers: Infinity }).soldiers, NR.SOLDIER_SANITY_CAP);
        assert.truthy(NR.SOLDIER_SANITY_CAP > 1000, 'chặn rác không được thành luật chơi');
    });

    test('mỗi lính vẫn cộng đúng 20 DAM, kể cả khi vượt xa 10', () => {
        // Chữ ký sau khi master bỏ đồng đội: (layout, dogLevel, soldierCount?, swordCount?)
        const base = NR.combatPower({ cells: [], soldiers: 0 }, 10);
        for (const n of [4, 10, 25, 300]) {
            const army = NR.combatPower({ cells: [], soldiers: n }, 10);
            assert.equal(army.soldiers, n, `${n} lính phải được tính đủ`);
            assert.equal(army.damage - base.damage, n * 20, `${n} lính phải cộng ${n * 20} DAM`);
            assert.equal(army.defense, base.defense, 'lính không đổi DEF');
        }
    });

    test('thu hoạch trên máy chủ chạy tiếp khi đã quá 10 lính', async () => {
        const world = createWorld();
        const user = await world.createUser({ allowBot: true });
        await seed(world, user, 10, READY);
        makeReady(world, user.uid);
        assert.equal(storedSoldiers(world, user.uid), 10);

        const r = await world.call(collectHandler().onRequestPost,
            { url: '/api/night-raid/collect', method: 'POST', token: user.token, body: {} });
        assert.truthy(r.ok, JSON.stringify(r.data));
        assert.equal(r.data.collectedSoldiers, 2, 'hai trại phải ra hai lính');
        assert.equal(r.data.soldiers, 12, 'kho phải vượt qua mốc 10 cũ');
        assert.equal(storedSoldiers(world, user.uid), 12, 'và phải nằm lại trong DB');
    });
});

suite('kho lính: cướp đêm không còn tiêu lính', () => {
    test('máy chủ không còn trừ lính của bên tấn công', () => {
        const finish = read('functions/api/night-raid/finish.js');
        assert.falsy(/soldierLayout\.soldiers\s*=\s*Math\.max\(0,\s*soldierLayout\.soldiers\s*-/.test(finish),
            'finish.js vẫn trừ lính khỏi nhà bên tấn công');
        assert.falsy(/UPDATE night_raid_homes SET layout_json=\?,updated_at=\? WHERE user_id=\?'\)\.bind\(JSON\.stringify\(soldierLayout\)/.test(finish),
            'finish.js vẫn ghi đè layout để trừ lính');
    });

    test('máy của bé không còn trừ lính sau trận đánh bot', () => {
        const ui = read('js/night-raid.js');
        assert.falsy(/soldiers\s*-\s*soldiersUsed/.test(ui), 'trận bot vẫn trừ lính');
        assert.falsy(/soldiers=Math\.max\(0,appState\.nightRaidLayout\.soldiers-/.test(ui), 'trận bot vẫn trừ lính');
    });
});

suite('kho lính: chỉ thu hoạch mới đổi được', () => {
    // Đây là lỗi đã thật sự ăn mất lính của acc Z: bé thu hoạch xong, một
    // client cũ PUT lên số lính thấp hơn, máy chủ lấy min() và mẻ vừa thu
    // hoạch biến mất không dấu vết.
    test('một client cũ không kéo tụt được kho lính', async () => {
        const world = createWorld();
        const user = await world.createUser({ allowBot: true });
        await seed(world, user, 6, Date.now() + 3600000);
        assert.equal(storedSoldiers(world, user.uid), 6);

        const stale = await world.call(homeHandler().onRequestPut, {
            url: '/api/night-raid/home', method: 'PUT', token: user.token,
            body: { layout: { cells: barracks(2, Date.now() + 3600000), soldiers: 0, dogLane: 2 }, teammates: [] },
        });
        assert.truthy(stale.ok);
        assert.equal(storedSoldiers(world, user.uid), 6, 'PUT không được đổi kho lính');
        assert.equal(NR.normalizeLayout(stale.data.layout).soldiers, 6, 'và phải trả về số thật cho client');
    });

    test('nhà mới toanh cũng không được khai sẵn quân — lần PUT đầu tiên là 0', async () => {
        // Merge "lính không giới hạn" (89781322) đổi min(kho cũ, client) thành
        // "giữ kho cũ nếu đã có nhà", nên nhánh CHƯA có nhà tin thẳng số client
        // gửi, mà normalizeLayout chỉ chặn ở SOLDIER_SANITY_CAP = 1e6.
        const world = createWorld();
        const user = await world.createUser({ allowBot: true });
        const r = await world.call(homeHandler().onRequestPut, {
            url: '/api/night-raid/home', method: 'PUT', token: user.token,
            body: { layout: { cells: [], soldiers: 1000000, dogLane: 2 }, teammates: [] },
        });
        assert.truthy(r.ok, JSON.stringify(r.data));
        assert.equal(storedSoldiers(world, user.uid), 0, 'nhà mới bắt đầu với 0 lính');
        assert.equal(NR.normalizeLayout(r.data.layout).soldiers, 0, 'và client được trả về số thật');
        // Và DAM không được vọt lên trần vì một con số client tự khai.
        const layout = NR.normalizeLayout(JSON.parse(
            world.db.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').get(user.uid).layout_json));
        assert.equal(NR.combatPower(layout, 1, layout.soldiers).damage,
            NR.combatPower({ cells: [], soldiers: 0 }, 1, 0).damage, 'không có quân trời cho');
    });

    test('client cũng không tự nâng kho lính lên được', async () => {
        const world = createWorld();
        const user = await world.createUser({ allowBot: true });
        await seed(world, user, 3, Date.now() + 3600000);
        const cheat = await world.call(homeHandler().onRequestPut, {
            url: '/api/night-raid/home', method: 'PUT', token: user.token,
            body: { layout: { cells: barracks(2, Date.now() + 3600000), soldiers: 999, dogLane: 2 }, teammates: [] },
        });
        assert.truthy(cheat.ok);
        assert.equal(storedSoldiers(world, user.uid), 3, 'chỉ collect mới được cộng lính');
    });
});

suite('kho lính: bãi cỏ giới hạn hiển thị, HUD hiện số thật', () => {
    test('bãi cỏ vẽ nhiều nhất ARMY_DISPLAY_CAP con lính', () => {
        assert.equal(NR.ARMY_DISPLAY_CAP, 10);
        for (const n of [0, 1, 10, 11, 40, 500]) {
            assert.equal(NR.armySlots(n).length, Math.min(n, NR.ARMY_DISPLAY_CAP),
                `${n} lính chỉ được vẽ tối đa ${NR.ARMY_DISPLAY_CAP} con`);
        }
    });

    test('HUD hiện số lính thật chứ không phải số con vẽ được, kèm DAM và DEF', () => {
        const ui = read('js/night-raid.js');
        assert.falsy(ui.includes('${power.soldiers}/10'), 'HUD vẫn còn mẫu "n/10" của thời có trần');
        assert.truthy(ui.includes('<small>LÍNH</small><strong>${power.soldiers}</strong>'),
            'HUD phải hiện đúng số lính đang có');
        assert.truthy(ui.includes('<small>DAM</small><strong>${power.damage}</strong>'), 'HUD phải còn tổng DAM');
        assert.truthy(ui.includes('<small>DEF</small><strong>${power.defense}</strong>'), 'HUD phải còn tổng DEF');
        // Nhãn trợ năng của bãi cỏ nói cả hai con số khi chúng khác nhau.
        assert.truthy(ui.includes('data-total="${total}"'), 'bãi cỏ phải mang theo tổng số lính thật');
    });

    test('màn đánh cũng chỉ vẽ tối đa ngần ấy con', () => {
        for (const f of ['js/night-raid-game.js', 'js/night-raid-phaser.js', 'js/night-raid-choreo.js']) {
            assert.truthy(/ARMY_DISPLAY_CAP/.test(read(f)), `${f} không giới hạn số lính vẽ ra`);
        }
    });

    test('không file nào còn dùng trần MAX_SOLDIERS cũ', () => {
        for (const f of ['js/night-raid-rules.js', 'js/night-raid.js', 'js/night-raid-game.js',
            'js/night-raid-phaser.js', 'js/night-raid-choreo.js',
            'functions/api/night-raid/collect.js', 'functions/api/night-raid/finish.js',
            'functions/api/night-raid/home.js']) {
            assert.falsy(read(f).includes('MAX_SOLDIERS'), `${f} vẫn còn MAX_SOLDIERS`);
        }
        assert.equal(NR.MAX_SOLDIERS, undefined, 'hằng số trần cũ phải biến mất khỏi rules');
    });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
