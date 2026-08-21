const { suite, test, assert } = require('./harness');
const R = require('../js/night-raid-rules.js');

suite('night raid: one deterministic combat mode', () => {
  test('ships five core raiders and three night scenes', () => {
    assert.equal(R.RAIDERS.length, 5);
    assert.equal(R.SCENES.length, 3);
    assert.equal(R.RULES_VERSION, 2);
  });

  test('every shop item is bought with coins and contributes power or production', () => {
    for (const defense of R.DEFENSES) {
      assert.truthy(defense.price >= 1000, defense.id + ' must cost at least 1000 coins');
      assert.truthy(defense.attack > 0 || defense.defense > 0 || defense.producer);
    }
  });

  test('barracks and rice use the approved daily economy limits',()=>{
    const barracks=R.defenseById('training-barracks'),rice=R.defenseById('rice-field');
    assert.equal(barracks.price,4000);assert.equal(barracks.maxOwned,2);assert.equal(barracks.yield,1);
    assert.equal(rice.price,2000);assert.equal(rice.maxOwned,4);assert.equal(rice.yield,200);
    assert.equal(barracks.productionMs,24*60*60*1000);assert.equal(R.MAX_SOLDIERS,10);
  });

  test('pet power is visible and every collected soldier adds exactly 20 DAM',()=>{
    const pet=R.petPower(10),base=R.combatPower({cells:[],soldiers:0},10,[]),army=R.combatPower({cells:[],soldiers:4},10,[]);
    assert.deepEqual(pet,{level:10,damage:40,defense:60});
    assert.equal(army.damage-base.damage,80);assert.equal(army.soldierDamage,80);assert.equal(army.defense,base.defense);
  });

  test('production metadata survives moves and owned limits are enforced',()=>{
    const cells=[];for(let i=0;i<4;i++)cells.push({type:'rice-field',gx:i,gy:0,uid:'rice-id-'+i,readyAt:1234});cells.push({type:'rice-field',gx:5,gy:0,uid:'rice-id-5',readyAt:1234});
    cells.push({type:'training-barracks',gx:0,gy:1,uid:'barracks-1',readyAt:5678},{type:'training-barracks',gx:1,gy:1,uid:'barracks-2',readyAt:5678},{type:'training-barracks',gx:2,gy:1,uid:'barracks-3',readyAt:5678});
    const layout=R.normalizeLayout({cells,soldiers:99});
    assert.equal(layout.cells.filter(c=>c.type==='rice-field').length,4);assert.equal(layout.cells.filter(c=>c.type==='training-barracks').length,2);assert.equal(layout.soldiers,10);
    assert.equal(layout.cells[0].uid,'rice-id-0');assert.equal(layout.cells[0].readyAt,1234);
  });

  test('one-button battle follows the visible DAM greater than DEF rule', () => {
    const target=R.trainingTarget(5);
    assert.truthy(R.resolveAutoBattle(target,target.defense+1).won);
    assert.falsy(R.resolveAutoBattle(target,target.defense).won);
    assert.falsy(R.resolveAutoBattle(target,target.defense-1).won);
  });

  test('upgrading a cannon raises DAM while upgrading a wall raises DEF', () => {
    const base=R.combatPower({dogLane:2,cells:[]},1,[]);
    const cannon=R.combatPower({dogLane:2,cells:[{type:'water-cannon',lane:0,col:1,tier:2}]},1,[]);
    const wall=R.combatPower({dogLane:2,cells:[{type:'stone-wall',lane:0,col:1,tier:2}]},1,[]);
    assert.truthy(cannon.damage>base.damage);
    assert.truthy(wall.defense>base.defense);
  });

  test('all twenty training homes use legal five-lane layouts', () => {
    for (let level = 1; level <= 20; level++) {
      const target = R.trainingTarget(level);
      assert.equal(target.id, 'training-' + level);
      for (const cell of target.layout.cells) {
        assert.truthy(cell.lane >= 0 && cell.lane < R.LANES);
        assert.truthy(cell.col >= 1 && cell.col <= R.COLS);
        assert.truthy(R.defenseById(cell.type));
      }
    }
  });

  test('layout normalization removes junk and layer collisions', () => {
    const layout = R.normalizeLayout({ dogLane:99, cells:[
      {type:'wood-fence',lane:0,col:2},
      {type:'stone-wall',lane:0,col:2},
      {type:'spike-trap',lane:0,col:2},
      {type:'dragon',lane:2,col:3},
    ]});
    assert.equal(layout.cells.length, 2, 'one stand plus one floor trap');
    assert.equal(layout.dogLane, 4);
  });

  test('free builder preserves a bounded twelve by twelve visual grid', () => {
    const layout=R.normalizeLayout({cells:[
      {type:'wood-fence',gx:11,gy:11,tier:1},
      {type:'stone-wall',gx:11,gy:11,tier:1},
      {type:'spike-trap',gx:99,gy:99,tier:1},
    ]});
    assert.equal(R.BUILD_GRID,12);
    assert.equal(layout.cells.length,2,'one stand plus one floor per visual tile');
    assert.equal(layout.cells[0].gx,11);
    assert.equal(layout.cells[0].gy,11);
    assert.equal(layout.cells[0].lane,4);
    assert.equal(layout.cells[0].col,8);
  });

  test('deployment spends budget and rejects overspend', () => {
    const state = R.createState(R.trainingTarget(1));
    assert.truthy(R.deploy(state, 'bomb-rat', 2).ok);
    assert.equal(state.budget, state.startBudget - 10);
    state.budget = 0;
    assert.equal(R.deploy(state, 'mouse', 0).reason, 'budget');
  });

  test('the same snapshot and commands replay identically', () => {
    const target = R.trainingTarget(3);
    const commands = [];
    for (let i = 0; i < 8; i++) commands.push({at:i * 900,unitId:i % 2 ? 'goblin' : 'bomb-rat',lane:i % 5});
    assert.deepEqual(R.simulate(target, commands), R.simulate(target, commands));
  });

  test('command normalization bounds time, lane, count and ids', () => {
    const list = R.normalizeCommands([
      {at:-10,unitId:'mouse',lane:-8},
      {at:999999,unitId:'bat',lane:99},
      {at:20,unitId:'dragon',lane:2},
    ]);
    assert.equal(list.length, 2);
    assert.equal(list[0].at, 0);
    assert.equal(list[0].lane, 0);
    assert.equal(list[1].at, R.RAID_MS);
    assert.equal(list[1].lane, 4);
  });

  test('castle skins cannot change home power', () => {
    const target = R.trainingTarget(8);
    const a = R.homeLevel(target.layout, target.dogLevel, target.teammates);
    const b = R.homeLevel({...target.layout, castleSkin:'royal'}, target.dogLevel, target.teammates);
    assert.equal(a, b);
  });

  test('stars only reward a successful raid', () => {
    assert.equal(R.trainingStars({status:'lost'}), 0);
    assert.equal(R.trainingStars({status:'won',budget:25,timeMs:80000}), 3);
    assert.equal(R.trainingStars({status:'won',budget:2,timeMs:100000}), 1);
  });
});
