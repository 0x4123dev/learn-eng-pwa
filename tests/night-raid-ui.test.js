const { suite, test, assert } = require('./harness');
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),css=read('css/styles.css'),ui=read('js/night-raid.js'),game=read('js/night-raid-game.js'),phaser=read('js/night-raid-phaser.js'),sw=read('sw.js');

suite('night raid: app integration',()=>{
  test('one dedicated screen and five ordered Night Raid scripts ship in the app shell',()=>{
    assert.truthy(html.includes('id="nightRaidScreen"'));
    const order=['night-raid-rules.js','night-raid-art.js','night-raid-game.js','night-raid-phaser.js','night-raid.js'].map(x=>html.indexOf(x));
    assert.truthy(order.every(n=>n>=0));
    assert.truthy(order.every((n,i)=>i===0||order[i-1]<n));
  });
  test('all Night Raid scripts work offline',()=>{
    for(const file of ['night-raid-rules.js','night-raid-art.js','night-raid-game.js','night-raid-phaser.js','phaser.min.js','night-raid.js'])assert.truthy(sw.includes("'/js/"+file+"'"));
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
    for(const token of ['nr-result-pop','nr-pop-scrim','nr-pop-card','nr-pop-body','nrBannerDrop','nrStarPop','nr-auto-command.hidden'])assert.truthy(css.includes(token),token);
    // The banner hangs above the card edge, so the card itself must never
    // scroll-clip — the overflow belongs to .nr-pop-body.
    assert.truthy(ui.includes('nr-pop-body'));
    const cardRule=css.slice(css.indexOf('.nr-pop-card{'),css.indexOf('}',css.indexOf('.nr-pop-card{')));
    assert.falsy(/overflow/.test(cardRule),'.nr-pop-card must not clip its own banner');
    const bodyRule=css.slice(css.indexOf('.nr-pop-body{'),css.indexOf('}',css.indexOf('.nr-pop-body{')));
    assert.truthy(/overflow-y:auto/.test(bodyRule),'long content scrolls inside the body instead');
  });
  test('Phase 2 includes defense reports and deterministic replay UI',()=>{
    assert.truthy(ui.includes("api('reports'"));
    assert.truthy(ui.includes('nrShowReports()'));
    assert.truthy(ui.includes('nrReplayReport('));
    assert.truthy(game.includes('playReplay(commands,speed=1)'));
  });
  test('builder uses the equipped castle skin, coin upgrades and power totals',()=>{
    for(const token of ['isometric-home-board-skin-pad.webp','nrEquippedCastle','paintEquippedCastle()','nrToggleBuilderGrid()','nr-builder-power damage','nr-builder-power defense'])assert.truthy(ui.includes(token)||css.includes(token),token);
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
    for(const token of ['nr-builder-zoom','nrZoomBuilder','touch-action:none','nr-builder-shop-fab','movePlacedItem','builderZoomBounds','chụm 2 ngón thu phóng'])assert.truthy(ui.includes(token)||css.includes(token),token);
    // The zoom floor is dynamic: a pinch can never shrink the island smaller
    // than the viewport, which used to strand it in a corner of empty green.
    assert.truthy(ui.includes('Math.max(viewport.clientWidth,viewport.clientHeight)/base'),'min zoom must cover the viewport');
    assert.truthy(ui.includes('setBuilderZoom(builderZoom)'),'persisted zoom must be re-clamped on open and rotation');
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
  test('production timers hide behind the art until the building is tapped',()=>{
    // The countdown used to sit permanently over the rice field / barracks.
    // Now it only shows when READY (to collect) or for 4s after a tap — and
    // tapping a ready producer collects it on the spot.
    assert.truthy(css.includes('white-space:nowrap;pointer-events:none;display:none}'),'badge hidden by default');
    assert.truthy(css.includes('.nr-production-badge.ready,.nr-production-badge.shown{display:block}'));
    assert.truthy(ui.includes("badge.classList.add('shown')"));
    assert.truthy(ui.includes('return collectResources(cell.uid)'),'tapping a ready producer collects');
  });
  test('moving a building requires pressing SỬA first',()=>{
    // The grid only shows in edit mode, placed items refuse to drag outside
    // it, and outside edit mode buildings are transparent to touches so a
    // finger on them pans the island instead of grabbing anything.
    assert.truthy(ui.includes('nr-builder-edit'));
    assert.truthy(ui.includes('nrToggleBuilderGrid()'),'the SỬA fab flips edit mode');
    assert.truthy(ui.includes('function beginPlacedDrag(event,gx,gy,layer){if(!builderEditing)return;'));
    assert.truthy(css.includes('.nr-builder:not(.editing):not(.nr-home-stage) .nr-build-grid-cell'));
    assert.truthy(css.includes('.nr-builder.editing .nr-build-grid-cell>i'),'grid markers show only while editing');
  });
  test('the home screen is the same island stage as the builder',()=>{
    // Full-screen board with the equipped castle and placed buildings as the
    // background, the builder's DAM/DEF/LINH/coin chips, and the actions as
    // SHOP-style fabs floating on top. Read-only: nothing drags here.
    const home=ui.slice(ui.indexOf('function renderHome('),ui.indexOf('// Scouting IS the battlefield'));
    assert.truthy(home.includes('nr-home-stage'));
    assert.truthy(home.includes('nr-builder-world'),'home reuses the pannable island world');
    assert.truthy(home.includes('nr-builder-hud'),'home shows the builder power chips');
    for(const fab of ['nrScoutBot()','nrShowLiveTargets()','nrShowBuilder()','nrShowReports()'])assert.truthy(home.includes(fab),fab);
    assert.truthy(css.includes('.nr-home-fab'),'fabs share the SHOP button look');
    assert.falsy(home.includes('nrBeginPlacedDrag'),'home buildings must not drag');
    assert.truthy(css.includes('.nr-home-stage .nr-placed{pointer-events:none}'),'panning must work over buildings');
  });
  test('the builder offers a landscape rotate that never breaks panning',()=>{
    // iOS cannot lock orientation from a web app, so NGANG rotates the whole
    // builder 90deg in CSS; pan deltas are remapped so dragging still follows
    // the finger, and the app nav hides while the sideways stage is up.
    assert.truthy(ui.includes('nrRotateBuilder'));
    assert.truthy(ui.includes('builderRotated'));
    assert.truthy(css.includes('.nr-builder.rotated'));
    assert.truthy(css.includes('rotate(90deg) translateY(-100%)'));
    assert.truthy(ui.includes('viewport.scrollLeft=builderGesture.left-dy'),'rotated pan must swap axes');
    assert.truthy(ui.includes('setNav(builderRotated)'),'the nav would cover the sideways stage');
  });
  test('one TIẾN QUÂN on the scout screen goes straight into the fight',()=>{
    // The scout screen is a full-screen island (like the home builder) with a
    // single charge button; the battle screen has no second button and the
    // army marches on its own.
    assert.truthy(ui.includes('nr-scout-stage'));
    assert.truthy(ui.includes('id="nrStartRaid"'));
    assert.truthy(ui.includes('<span>TIẾN QUÂN</span>'));
    assert.falsy(ui.includes('nrChargeButton'),'the battle screen must not ask again');
    assert.truthy(ui.includes("if(view==='battle'&&game&&game.charge)chargeArmy()"),'battle auto-charges');
    // The fight happens IN PLACE in the scout world — no screen swap. Phaser
    // replaces only the preview canvas after the user commits to TIEN QUAN.
    const raidBlock=ui.slice(ui.indexOf('async function startRaid'),ui.indexOf('function updateHud'));
    assert.falsy(raidBlock.includes('r.innerHTML'),'startRaid must not rebuild the screen');
    assert.truthy(raidBlock.includes("getElementById('nrScoutCanvas')"),'the scout canvas anchors the in-place swap');
    assert.truthy(raidBlock.includes('canvas.replaceWith(phaserHost)'),'only the battle renderer is replaced');
    assert.truthy(raidBlock.includes('new NightRaidPhaser.AutoBattle'),'TIEN QUAN uses the Phaser renderer');
    assert.truthy(ui.includes('data-nr-pop-host'),'the result popup needs a fixed host over the pannable world');
    assert.truthy(game.includes('class AutoBattle'));
    assert.truthy(game.includes('drawClashSpark'));
    assert.truthy(game.includes('Choreo.build(this.result,target,this.soldierCount'));
    assert.truthy(game.includes('target.attackerSoldiers'));
    assert.falsy(game.includes('for(let i=0;i<18;i++)'));
    assert.falsy(ui.includes('nr-unit-tray'));
  });
  test('Phaser units walk with a real gait, planted footprints and battle audio',()=>{
    // The torso stays stable while the leg crop swaps each half-step —
    // the old side-to-side "cardboard wobble" must not come back.
    assert.truthy(phaser.includes('setCrop'),'two-part stride sprite');
    assert.truthy(phaser.includes('lower.flipX=swap?!flip:flip'),'legs must swap each half-step');
    assert.falsy(phaser.includes('x=pose.x+stride'),'no side-to-side wobble slide');
    assert.truthy(phaser.includes('paintTrail'),'planted footprints pass');
    assert.truthy(/Math\.floor\(T\/STEP\)\*STEP/.test(phaser),'prints quantised to the step grid, not sliding with the sprite');
    assert.truthy(phaser.includes("u.kind==='pet'"),'pet leaves paw prints, soldiers boot prints');
    // Sound is synthesized (no assets), created only after the TIEN QUAN gesture.
    assert.truthy(phaser.includes('AudioContext'),'synthesized battle sound');
    for(const cue of ['warCry','launch(kind)','impactShot','demolish','breach','retreat','step()'])assert.truthy(phaser.includes(cue),cue);
    assert.truthy(phaser.includes('this.reduce?null:new RaidAudio'),'reduced effects stay silent');
    // Buildings break for real: towers tremble, tip over and land as rubble.
    assert.truthy(phaser.includes('tw.fallAt'),'towers topple on the choreo schedule');
    assert.truthy(phaser.includes("event.type==='demolish'"),'collapse bursts rubble and smoke');
    // One shared depth space so units walk behind far buildings.
    assert.truthy(phaser.includes('setDepth(tower.y)')||phaser.includes('setDepth(tw.y)'),'towers depth-sort by ground y');
    // Choreo places towers from the defender's real 12x12 grid, matching the builder.
    const choreo=read('js/night-raid-choreo.js');
    assert.truthy(choreo.includes('cellAnchor'),'towers project from home grid cells');
    assert.truthy(choreo.includes('left:144, top:200, size:512, cells:12'),'projection matches .nr-free-grid (18%/25%/64% of 800)');
  });
  test('Phaser is lazy, renderer-only and falls back without changing battle rules',()=>{
    assert.falsy(html.includes('src="js/phaser.min.js"'),'the 1 MB engine must not block initial app load');
    assert.truthy(phaser.includes("script.src='js/phaser.min.js'"));
    assert.truthy(phaser.includes('NightRaidRules.resolveAutoBattle'));
    assert.truthy(phaser.includes('NightRaidChoreo.build'));
    assert.truthy(ui.includes("console.warn('Night Raid Phaser fallback'"));
    assert.truthy(ui.includes('new NightRaidGame.AutoBattle(canvas,target,options)'),'Canvas fallback must remain');
    assert.truthy(css.includes('.nr-phaser-battle'));
  });
  test('enemy DEF is a secret until the attack begins',()=>{
    // Scout overlays show only OUR army; the number first appears on the
    // battle HUD, and the targets API no longer ships it to the list at all.
    const scoutBlock=ui.slice(ui.indexOf('function scout('),ui.indexOf('async function startRaid'));
    assert.falsy(scoutBlock.includes('NHÀ ĐỊCH'),'scout screen must not name the enemy stat');
    assert.falsy(scoutBlock.includes('target.defense'),'scout screen must not read the enemy DEF');
    assert.truthy(scoutBlock.includes('nr-scout-secret'));
    assert.truthy(ui.includes('Nhà cấp ${t.homeLevel} · ${esc(t.difficulty)}'),'target list shows difficulty, not DEF');
    const targetsApi=read('functions/api/night-raid/targets.js');
    assert.falsy(/defense:full\.defense/.test(targetsApi),'targets payload must not carry the exact DEF');
    const battleBlock=ui.slice(ui.indexOf('async function startRaid'),ui.indexOf('function updateHud'));
    assert.truthy(battleBlock.includes("def.hidden=false"),'attacking is how the child earns the number');
    assert.truthy(battleBlock.includes('nrScoutSecret'),'the secret pill leaves once the fight starts');
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
