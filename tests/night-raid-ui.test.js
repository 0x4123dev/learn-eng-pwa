const { suite, test, assert } = require('./harness');
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),css=read('css/styles.css'),ui=read('js/night-raid.js'),game=read('js/night-raid-game.js'),sw=read('sw.js');

suite('night raid: app integration',()=>{
  test('one dedicated screen and four ordered scripts ship in the app shell',()=>{
    assert.truthy(html.includes('id="nightRaidScreen"'));
    const order=['night-raid-rules.js','night-raid-art.js','night-raid-game.js','night-raid.js'].map(x=>html.indexOf(x));
    assert.truthy(order.every(n=>n>=0));
    assert.truthy(order.every((n,i)=>i===0||order[i-1]<n));
  });
  test('all Night Raid scripts work offline',()=>{
    for(const file of ['night-raid-rules.js','night-raid-art.js','night-raid-game.js','night-raid.js'])assert.truthy(sw.includes("'/js/"+file+"'"));
  });
  test('Arena exposes the game only through its feature-gated card',()=>{
    const arena=read('js/petbattle.js');
    assert.truthy(arena.includes("st.allowBot ? _pbNightRaidCard() : ''"));
    assert.truthy(arena.includes('onclick="openNightRaid()"'));
  });
  test('Night Raid remains inside the Arena navigation group',()=>{
    assert.truthy(read('js/app.js').includes("nightRaidScreen: 'arena'"));
  });
  test('win/loss ends as a popup over the live battlefield, not a page swap',()=>{
    // The final frame (breach or retreat) stays as the backdrop; a game-style
    // banner popup drops in over it. The old full page survives only as the
    // fallback for paths where the battle DOM is already gone.
    assert.truthy(ui.includes("document.querySelector('#nrBattleRoot .nr-canvas-wrap')"));
    assert.truthy(ui.includes('nr-result-pop'));
    assert.truthy(ui.includes('nr-pop-banner'));
    assert.truthy(ui.includes('renderResultPage'),'fallback page renderer must survive');
    for(const token of ['nr-result-pop','nr-pop-scrim','nr-pop-card','nrBannerDrop','nrStarPop','nr-auto-command.hidden'])assert.truthy(css.includes(token),token);
  });
  test('Phase 2 includes defense reports and deterministic replay UI',()=>{
    assert.truthy(ui.includes("api('reports'"));
    assert.truthy(ui.includes('nrShowReports()'));
    assert.truthy(ui.includes('nrReplayReport('));
    assert.truthy(game.includes('playReplay(commands,speed=1)'));
  });
  test('builder uses the equipped castle skin, coin upgrades and power totals',()=>{
    for(const token of ['isometric-home-board-skin-pad.webp','nrEquippedCastle','paintEquippedCastle()','nrToggleBuilderGrid()','TỔNG DAM','TỔNG DEF'])assert.truthy(ui.includes(token)||css.includes(token),token);
    for(const token of ['nr-island-board','nr-builder-scoreboard','nr-equipped-castle','nr-build-art'])assert.truthy(css.includes(token),token);
    assert.truthy(ui.includes('<img id="nrEquippedCastle"'),'builder castle must be a composited image, not a large live canvas on iOS');
    assert.truthy(ui.includes("canvas.toDataURL('image/png')"),'equipped skin is rasterized once with transparency');
    assert.falsy(ui.includes('<canvas id="nrEquippedCastle"'),'visible builder canvas causes black GPU bands on Safari');
  });
  test('builder is a pannable full-screen home with shop drag and free placement',()=>{
    for(const token of ['nr-builder-world','nr-builder-map','nr-builder-shop-fab','nr-free-grid','nr-build-grid-cell'])assert.truthy(ui.includes(token)||css.includes(token),token);
    for(const token of ['nrBeginBuildDrag','nrDropBuildItem','grid-template-columns:repeat(12','setupBuilderGestures','setBuilderZoom','nrBeginPlacedDrag','chụm hai ngón'])assert.truthy(ui.includes(token)||css.includes(token),token);
    assert.falsy(ui.includes('Chó bảo vệ khu'));
  });
  test('builder supports app-level pinch zoom, visible shop and free item repositioning',()=>{
    for(const token of ['nr-builder-zoom','nrZoomBuilder','touch-action:none','nr-builder-shop-fab','movePlacedItem','Math.max(.4,Math.min(1.65','zoom 40–165%'])assert.truthy(ui.includes(token)||css.includes(token),token);
    assert.truthy(ui.includes("pointerdown=\"nrBeginPlacedDrag"));
    assert.truthy(css.includes('top:calc(78px + env(safe-area-inset-top))'));
  });

  test('shop can swipe horizontally and confirms coin purchases before placement',()=>{
    for(const token of ['allowHorizontalScroll','buildPurchasePlan','showBuildPurchase','nrConfirmBuildPurchase','nr-purchase-dialog'])assert.truthy(ui.includes(token)||css.includes(token),token);
    assert.truthy(css.includes('touch-action:pan-x'),'shop cards must preserve native horizontal swiping');
    assert.truthy(ui.includes("if(!confirmed){showBuildPurchase(plan);return;}"),'placement must pause before spending coins');
  });

  test('daily production UI shows pet power, countdowns and collect controls',()=>{
    for(const token of ['nr-pet-power-card','nr-production-badge','startProductionTicker','nr-collect-all','nrGridCell','localCollect'])assert.truthy(ui.includes(token)||css.includes(token),token);
    for(const asset of ['img/night-raid/training-barracks.png','img/night-raid/rice-field.png'])assert.truthy(fs.existsSync(path.join(root,asset)),asset);
  });
  test('the placement grid closes after a purchased or moved building is dropped',()=>{
    assert.truthy(ui.includes('function settleBuilderPlacement()'));
    assert.truthy(ui.includes('builderEditing=false;builderShopOpen=false'));
    assert.truthy(ui.includes("classList.remove('editing','dragging','shop-open')"));
    assert.truthy(ui.includes('target=>{buildCell(+target.dataset.gx,+target.dataset.gy);settleBuilderPlacement();}'));
  });
  test('iOS image callouts are blocked and drag work is frame-coalesced',()=>{
    for(const token of ['oncontextmenu="return false"','-webkit-touch-callout:none','setPointerCapture','requestAnimationFrame(paint)','translate3d(','dropTarget?.classList.remove'])assert.truthy(ui.includes(token)||css.includes(token),token);
    assert.falsy(ui.includes("querySelectorAll('.nr-build-grid-cell.drag-over')"));
  });
  test('phone shop opens as an unobscured top sheet',()=>{
    for(const token of ['top:calc(150px + env(safe-area-inset-top))','max-height:min(55dvh,460px)','transform-origin:top right','.nr-builder.shop-open .nr-builder-zoom'])assert.truthy(css.includes(token),token);
    assert.truthy(css.includes('.nr-builder-shop-fab{z-index:50}'));
  });
  test('battle has one charge button and draws the exact owned soldier count',()=>{
    assert.truthy(ui.includes('onclick="nrChargeArmy()"'));
    assert.truthy(ui.includes('Pet dẫn ${target.attackerSoldiers} lính cùng xông vào'));
    assert.truthy(game.includes('class AutoBattle'));
    assert.truthy(game.includes('drawClashSpark'));
    assert.truthy(game.includes('Choreo.build(this.result,target,this.soldierCount'));
    assert.truthy(game.includes('target.attackerSoldiers'));
    assert.truthy(ui.includes('QUÂN TA · ${target.attackerSoldiers} LÍNH'));
    assert.falsy(game.includes('for(let i=0;i<18;i++)'));
    assert.falsy(ui.includes('nr-unit-tray'));
  });
  test('armored dog is a small canvas squad leader and marches with the formation',()=>{
    assert.truthy(game.includes("'img/night-raid/pet-soldiers-'"));
    for(const file of ['pet-soldiers-small-v2.webp','pet-soldiers-large-v2.webp'])assert.truthy(sw.includes("'/img/night-raid/"+file+"'"));
    for(const token of ['raidPetDescriptor','drawPetLeader','actors.sort(','pet:raidPetDescriptor()'])assert.truthy(ui.includes(token)||game.includes(token),token);
    assert.falsy(ui.includes('raidPetMarkup'));
    assert.falsy(ui.includes("nr-raid-pet battle"));
    for(const token of ['drawStepContact','drawStrideSprite','swap=moving&&phase<0','a.step,a.moving,motion',"this.reduce?.38:1","this.reduce?.009:.022"])assert.truthy(game.includes(token),token);
    assert.truthy(css.includes('filter:none!important'),'iOS castle canvas must not use a GPU drop-shadow rectangle');
  });
  test('battle defenders use the same polished 3D assets as the home builder',()=>{
    const art=read('js/night-raid-art.js');
    for(const id of ['pebble-pup','wood-fence','stone-wall','spike-trap','water-cannon'])assert.truthy(art.includes("'"+id+"'"),id);
    assert.truthy(art.includes('preloadDefenses'));
    assert.truthy(art.includes("img/night-raid/'+id+'.webp"));
    assert.truthy(game.includes('NightRaidArt.preloadDefenses'));
  });
});

suite('night raid: mobile UX and accessibility',()=>{
  test('phone, iPad, landscape, safe area and dynamic viewport contracts exist',()=>{
    for(const token of ['100dvh','safe-area-inset-top','max-aspect-ratio:1/1','min-width:768px','overscroll-behavior'])assert.truthy(css.includes(token),token);
  });
  test('controls are touch sized and keyboard focus is visible',()=>{
    assert.truthy(css.includes('min-height:48px')||css.includes('min-height:52px'));
    assert.truthy(css.includes(':focus-visible'));
    assert.truthy(game.includes("event.key>='1'&&event.key<='5'"));
    assert.truthy(game.includes("event.code==='Space'"));
  });
  test('reduced motion and hidden tabs reduce work',()=>{
    assert.truthy(css.includes('prefers-reduced-motion:reduce'));
    assert.truthy(game.includes('!document.hidden'));
    assert.truthy(game.includes('now-this.lastNotify>=200'));
  });
  test('canvas provides instructions and live status stays in DOM',()=>{
    assert.truthy(game.includes("setAttribute('aria-label'"));
    assert.truthy(ui.includes('aria-live="polite"'));
    assert.truthy(ui.includes('role="status"'));
  });
});

suite('night raid: only one combat loop',()=>{
  test('UI exposes random bot and live targets through the same startRaid',()=>{
    assert.truthy(ui.includes('startRaid(target,online)'));
    assert.truthy(ui.includes('makeBotTarget()'));
    assert.truthy(ui.includes('nrScoutBot()'));
    assert.truthy(ui.includes('scout(1,t,true)'));
    assert.falsy(ui.includes('20 Nhà Huấn Luyện'));
    assert.falsy(ui.includes('Nhà tiếp theo'));
    assert.falsy(ui.includes('startSiege'));
    assert.falsy(ui.includes('wavePlan'));
  });
  test('the castle has structural stages, persistent crater and projectile trails',()=>{
    const art=read('js/night-raid-art.js');
    assert.truthy(art.includes('const damage=ratio<=0?4'));
    assert.truthy(art.includes('Deep crater'));
    assert.truthy(art.includes('drawProjectile'));
  });
});
