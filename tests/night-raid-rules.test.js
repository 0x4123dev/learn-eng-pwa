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
    assert.equal(rice.price,2000);assert.equal(rice.maxOwned,4);assert.equal(rice.yield,100);
    for(const id of ['tomato-field','fish-pond']){
      const farm=R.defenseById(id);
      assert.truthy(farm,id);assert.equal(farm.price,rice.price);assert.equal(farm.yield,100);assert.equal(farm.productionMs,rice.productionMs);assert.equal(farm.maxOwned,4);
    }
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

  test('the castle is four cells square and always lands fully inside the grid',()=>{
    // The footprint used to be the literal 2 in six different files. It is one
    // constant now, and these checks read it rather than a copy of it.
    const size=R.CASTLE_SIZE,last=R.BUILD_GRID-size;
    assert.equal(size,4,'the keep is four cells square');
    const fits=cell=>cell.gx>=0&&cell.gy>=0&&cell.gx<=last&&cell.gy<=last;
    const centered=R.normalizeLayout({cells:[],castlePos:{x:44.25,y:35.5}});
    assert.truthy(fits(centered.castleCell),'a legacy percentage position must land on the grid');
    assert.deepEqual(R.normalizeLayout({cells:[],castleCell:{gx:-20,gy:90}}).castleCell,{gx:0,gy:last},
      'nonsense coordinates are pulled back to the nearest corner that still fits');
    assert.truthy(fits(R.normalizeLayout({cells:[]}).castleCell),'a brand-new base starts on the grid');
  });

  test('nothing may share the ground the castle stands on',()=>{
    // A base packed with buildings where the keep now sits: every one of them
    // has to be moved aside, not dropped, or a child loses what they bought.
    const size=R.CASTLE_SIZE,cells=[];
    for(let gy=0;gy<6;gy++)for(let gx=0;gx<6;gx++)cells.push({type:'wood-fence',gx,gy});
    cells.push({type:'training-barracks',gx:4,gy:1},{type:'rice-field',gx:5,gy:2});
    const out=R.normalizeLayout({castleCell:{gx:4,gy:1},cells}),C=out.castleCell;
    assert.equal(out.cells.length,cells.length,'a building was dropped instead of relocated');
    const under=out.cells.filter(c=>{const d=R.defenseById(c.type);
      return !d.trap&&R.rectsOverlap({gx:c.gx,gy:c.gy,size:R.footprintFor(d)},{gx:C.gx,gy:C.gy,size});});
    assert.deepEqual(under.map(c=>c.type+'@'+c.gx+','+c.gy),[],'these are standing inside the castle');
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
    assert.equal(layout.cells.length, 3, 'stand collisions relocate instead of deleting owned items');
    const stands=layout.cells.filter(c=>!R.defenseById(c.type).trap);
    assert.falsy(stands[0].gx===stands[1].gx&&stands[0].gy===stands[1].gy);
    assert.equal(layout.dogLane, 4);
  });

  test('free builder preserves a bounded twelve by twelve visual grid', () => {
    const layout=R.normalizeLayout({cells:[
      {type:'wood-fence',gx:11,gy:11,tier:1},
      {type:'stone-wall',gx:11,gy:11,tier:1},
      {type:'spike-trap',gx:99,gy:99,tier:1},
    ]});
    assert.equal(R.BUILD_GRID,12);
    assert.equal(layout.cells.length,3,'owned items move to the nearest free visual tile');
    assert.equal(layout.cells[0].gx,11);
    assert.equal(layout.cells[0].gy,11);
    assert.equal(layout.cells[0].lane,4);
    assert.equal(layout.cells[0].col,8);
  });

  test('farms, ponds and barracks reserve four cells without overlap',()=>{
    for(const id of ['rice-field','tomato-field','fish-pond','training-barracks'])assert.equal(R.footprintFor(id),2,id+' uses a 2x2 footprint');
    const layout=R.normalizeLayout({castleCell:{gx:5,gy:1},cells:[
      {type:'rice-field',gx:0,gy:0,uid:'rice-big-1'},
      {type:'fish-pond',gx:1,gy:1,uid:'pond-big-1'},
      {type:'training-barracks',gx:5,gy:1,uid:'barracks-big-1'},
    ]});
    const boxes=layout.cells.map(c=>({gx:c.gx,gy:c.gy,size:R.footprintFor(c.type)}));
    for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++)assert.falsy(R.rectsOverlap(boxes[a],boxes[b]),'large buildings must not overlap');
    for(const box of boxes)assert.falsy(R.rectsOverlap(box,{gx:5,gy:1,size:2}),'large buildings must not overlap the castle');
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
