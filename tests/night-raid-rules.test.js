const { suite, test, assert } = require('./harness');
const R = require('../js/night-raid-rules.js');

suite('home & farm rules: the layout grammar', () => {
  test('the battle simulation is gone from the shared rulebook', () => {
    // functions/api/_night-raid.js imports this file, so what is not here
    // cannot be scored anywhere. The raid was cut in September 2026.
    for (const gone of ['RAIDERS','SCENES','RULES_VERSION','combatPower','petPower','swordBonus','SWORD_DAMAGE','trainingTarget','resolveAutoBattle','createState','deploy','tick','simulate','normalizeCommands','trainingStars','makeRng','raiderById'])
      assert.equal(R[gone], undefined, gone + ' must not survive the cut');
    for (const kept of ['normalizeLayout','homeLevel','itemById','defenseById','footprintFor','rectsOverlap','armySlots','nearestFarmPlotDock'])
      assert.equal(typeof R[kept], 'function', kept + ' is what the builder and the server still share');
    assert.truthy(Object.isFrozen(R), 'a plain frozen UMD object — no import/export syntax, the server require()s it');
  });

  test('every shop item is bought with coins and either decorates the yard or produces', () => {
    for (const defense of R.DEFENSES) {
      assert.truthy(defense.price >= 2000, defense.id + ' must cost at least 2000 coins — prices were doubled 2026-09-03 so a house is a real saving goal, not an afternoon');
      assert.truthy(defense.attack > 0 || defense.defense > 0 || defense.producer);
      assert.truthy(defense.name && defense.name.vi, defense.id + ' needs a Vietnamese name for the shop card');
    }
  });
  test('castle defense prices rise above the 2000-xu Pebble Pup in requested 1000-xu steps', () => {
    assert.equal(R.itemById('pebble-pup').price, 2000);
    assert.equal(R.itemById('wood-fence').price, 3000);
    assert.equal(R.itemById('stone-wall').price, 5000);
    assert.equal(R.itemById('spike-trap').price, 3000);
    assert.equal(R.itemById('water-cannon').price, 5000);
  });

  test('barracks and rice use the approved daily economy limits',()=>{
    const barracks=R.defenseById('training-barracks'),rice=R.defenseById('rice-field');
    assert.equal(barracks.price,8000);assert.equal(barracks.maxOwned,10);assert.equal(barracks.yield,1);
    assert.equal(rice.price,6000);assert.equal(rice.maxOwned,4);assert.equal(rice.buyMax,1);assert.equal(rice.yield,100);
    for(const id of ['tomato-field','fish-pond']){
      const farm=R.defenseById(id);
      assert.truthy(farm,id);assert.equal(farm.price,rice.price);assert.equal(farm.yield,100);assert.equal(farm.productionMs,rice.productionMs);assert.equal(farm.maxOwned,4);
    }
    assert.equal(barracks.perTaskDay,true);assert.equal(barracks.productionMs,undefined);
    // Không còn trần kho lính; 10 chỉ là số con lính vẽ trên bãi cỏ.
    assert.equal(R.ARMY_DISPLAY_CAP,10);assert.equal(R.MAX_SOLDIERS,undefined);
  });

  test('soldiers are a stock the layout carries, bounded only by the sanity cap',()=>{
    assert.equal(R.normalizeLayout({cells:[],soldiers:4}).soldiers,4);
    assert.equal(R.normalizeLayout({cells:[],soldiers:-3}).soldiers,0);
    assert.equal(R.normalizeLayout({cells:[],soldiers:'abc'}).soldiers,0);
    assert.equal(R.normalizeLayout({cells:[],soldiers:1e12}).soldiers,R.SOLDIER_SANITY_CAP);
  });

  test('production metadata survives moves and owned limits are enforced',()=>{
    const cells=[];for(let i=0;i<4;i++)cells.push({type:'rice-field',gx:i,gy:0,uid:'rice-id-'+i,readyAt:1234});cells.push({type:'rice-field',gx:5,gy:0,uid:'rice-id-5',readyAt:1234});
    cells.push({type:'training-barracks',gx:0,gy:1,uid:'barracks-1',readyAt:5678},{type:'training-barracks',gx:1,gy:1,uid:'barracks-2',readyAt:5678},{type:'training-barracks',gx:2,gy:1,uid:'barracks-3',readyAt:5678});
    const layout=R.normalizeLayout({cells,soldiers:99});  // 99 lính là hợp lệ: kho không có trần
    assert.equal(layout.cells.filter(c=>c.type==='rice-field').length,4);assert.equal(layout.cells.filter(c=>c.type==='training-barracks').length,3);assert.equal(layout.soldiers,99);
    assert.equal(layout.cells[0].uid,'rice-id-0');assert.equal(layout.cells[0].readyAt,1234);
  });

  test('the castle is three cells square and always lands fully inside the grid',()=>{
    // The footprint used to be the literal 2 in six different files. It is one
    // constant now, and these checks read it rather than a copy of it.
    const size=R.CASTLE_SIZE,last=R.BUILD_GRID-size;
    assert.equal(size,3,'the keep is three cells square');
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

  test('upgrading a building raises the home level; a bought tier is never lost', () => {
    const base=R.homeLevel({dogLane:2,cells:[]},1);
    const wall=R.homeLevel({dogLane:2,cells:[{type:'pebble-pup',gx:0,gy:0,tier:1}]},1);
    const wall2=R.homeLevel({dogLane:2,cells:[{type:'pebble-pup',gx:0,gy:0,tier:2}]},1);
    const wall3=R.homeLevel({dogLane:2,cells:[{type:'pebble-pup',gx:0,gy:0,tier:3}]},1);
    assert.truthy(wall>base&&wall2>wall&&wall3>wall2,'each tier is worth more (below the level-50 cap)');
    assert.equal(R.normalizeLayout({cells:[{type:'stone-wall',gx:0,gy:0,tier:3}]}).cells[0].tier,3);
    assert.equal(R.normalizeLayout({cells:[{type:'stone-wall',gx:0,gy:0,tier:9}]}).cells[0].tier,3,'tiers stop at 3');
  });

  test('a legacy lane/col cell without gx/gy still lands on the free grid', () => {
    const layout = R.normalizeLayout({ cells:[{type:'wood-fence',lane:4,col:8},{type:'pebble-pup',lane:0,col:1}] });
    assert.equal(layout.cells.length, 2);
    for (const cell of layout.cells) {
      assert.truthy(cell.gx >= 0 && cell.gx < R.BUILD_GRID && cell.gy >= 0 && cell.gy < R.BUILD_GRID, 'mapped onto the 12x12 grid');
      assert.truthy(cell.lane >= 0 && cell.lane < R.LANES && cell.col >= 1 && cell.col <= R.COLS, 'and keeps a legal lane/col pair for older readers');
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

  test('castle skins cannot change the home level', () => {
    const layout = { cells:[{type:'stone-wall',gx:0,gy:0,tier:2},{type:'water-cannon',gx:2,gy:0,tier:1}] };
    const a = R.homeLevel(layout, 12);
    const b = R.homeLevel({...layout, castleSkin:'royal'}, 12);
    assert.equal(a, b);
  });

});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
