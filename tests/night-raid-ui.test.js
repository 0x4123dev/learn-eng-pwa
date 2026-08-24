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
  test('a sealed castle shows a live countdown everywhere it can be met',()=>{
    // The child must never meet a castle that silently refuses to be attacked:
    // wherever a sealed home appears, the same chip says when to come back.
    for(const token of ['nr-lock-chip','data-nr-lock-until','data-nr-lock-time'])assert.truthy(ui.includes(token),token);
    assert.truthy(ui.includes('function lockChip('),'one chip renderer, three screens');
    assert.truthy(ui.includes('updateLockTimers()'),'the chips tick on the existing one-second beat');
    assert.truthy(ui.includes("lockChip(homeLockedUntil"),'my own home shows how long it stays protected');
    assert.truthy(ui.includes("lockChip(t.lockedUntil"),'each target card carries its own clock');
    assert.truthy(ui.includes("lockChip(target.lockedUntil"),'the scout screen replaces TIẾN QUÂN with the clock');
    assert.truthy(ui.includes("id=\"nrStartRaid\" ${locked?'disabled hidden':''}"),'a sealed castle cannot be charged');
    assert.truthy(ui.includes('start.data.locked'),'a server-side seal is reported, not swallowed');
    // When the clock runs out the castle is handed back without a reload.
    assert.truthy(ui.includes("fab.disabled=false;fab.hidden=false"),'expiry re-arms the charge button');
    for(const rule of ['.nr-lock-chip','.nr-target-card.locked'])assert.truthy(css.includes(rule),rule);
  });
  test('the yard pet atlas survives being handed to CSS as a variable',()=>{
    // A RELATIVE url() inside a CSS custom property is resolved against the
    // stylesheet that CONSUMES it, not the page — so `img/night-raid/x.png`
    // became `/css/img/night-raid/x.png`, 404'd, and the patrolling dog was
    // invisible while every other check looked healthy. Root-absolute only.
    const m = ui.match(/asset=`([^`]*pet-walk[^`]*)`/);
    assert.truthy(m, 'the yard pet atlas url must be built in one place');
    assert.truthy(m[1].startsWith('/img/'), 'the atlas url must be root-absolute, got: ' + m[1]);
    assert.truthy(css.includes('var(--nr-pet-atlas)'), 'the sprite still reads the variable');
    for (const atlas of ['pet-walk-small-v1.png', 'pet-walk-large-v1.png']) {
      assert.truthy(fs.existsSync(path.join(root, 'img/night-raid', atlas)), atlas + ' missing on disk');
      assert.truthy(sw.includes("'/img/night-raid/" + atlas + "'"), atlas + ' must be cached for offline');
    }
  });
  test('the yard pet walks around buildings instead of through them',()=>{
    // The patrol used to know only a rectangle, so it strolled straight
    // through rice fields and cannons. It now reads the same 12x12 yard grid
    // the child builds on — and THAT is the drift risk this test guards:
    // if .nr-free-grid moves in CSS, the dog's idea of "solid" goes stale.
    assert.truthy(ui.includes('function petBlockedRects()'));
    assert.truthy(ui.includes('petBlockedAt(state.blocked,nx,ny)'),'each step must be tested before it is taken');
    assert.truthy(ui.includes('now-state.blockedAt>1000'),'the yard changes while the child builds');
    const yard = ui.match(/const PET_YARD=\{left:(\d+),top:(\d+),width:(\d+),height:(\d+)\}/);
    assert.truthy(yard,'the yard geometry must be one named constant');
    const grid = css.match(/\.nr-free-grid\{left:(\d+)%;width:(\d+)%;top:(\d+)%;height:(\d+)%\}/);
    assert.truthy(grid,'the last .nr-free-grid rule must stay machine-readable');
    assert.equal(yard[1], grid[1], 'PET_YARD.left must match .nr-free-grid');
    assert.equal(yard[2], grid[3], 'PET_YARD.top must match .nr-free-grid');
    assert.equal(yard[3], grid[2], 'PET_YARD.width must match .nr-free-grid');
    assert.equal(yard[4], grid[4], 'PET_YARD.height must match .nr-free-grid');
    // Everything placed is solid, traps included — a dog strolling over a
    // spike trap reads as "walking through" just as much as a wall does.
    assert.truthy(ui.includes('if(!def)continue'));
    assert.falsy(ui.includes('if(!def||def.trap)continue'),'traps must not be walkable any more');
    // The dog is a sprite drawn translate(-50%,-100%) from its feet, so a
    // point test let the body cross a wall while the feet cleared it. The
    // boxes are inflated by the body, which is what the child actually sees.
    assert.truthy(ui.includes('const PET_BODY={halfW:2.4,height:5.4}'));
    assert.truthy(ui.includes('x0:x-cw*.45-PET_BODY.halfW'));
    assert.truthy(ui.includes('y1:y+ch*1.25+PET_BODY.height'));
    // Reversing in place locked the dog into a shudder against a wall, so it
    // slides: each axis is tried on its own before giving up on both.
    assert.truthy(ui.includes('else if(!petBlockedAt(state.blocked,nx,state.y)){state.x=nx;state.vy*=-1;}'));
    assert.truthy(ui.includes('else if(!petBlockedAt(state.blocked,state.x,ny)){state.y=ny;state.vx*=-1;}'));
    assert.truthy(ui.includes('yardBlockedRects:petBlockedRects'),'the geometry stays checkable from outside');
  });
  test('the yard pet leaves paw prints and kicks up dust',()=>{
    // A dog that leaves nothing behind reads as sliding over the grass. The
    // prints are planted where the paw fell and fade there, exactly like the
    // battle trail — but as self-deleting DOM nodes, because a canvas the size
    // of the yard would cost ~30MB on a phone at 2x.
    assert.truthy(ui.includes('data-nr-pet-trail'),'the trail needs its own layer under the dog');
    assert.truthy(ui.includes('function spawnPetTrail(layer,state,now)'));
    assert.truthy(ui.includes('spawnPetTrail(trail,state,now)'),'the walk loop must actually spawn them');
    assert.truthy(ui.includes("addEventListener('animationend'"),'every node deletes itself');
    assert.truthy(ui.includes('while(layer.childElementCount>26)'),
      'a backgrounded tab never fires animationend, so the layer must be capped');
    // Left and right paws either side of the line walked, turned to face it.
    assert.truthy(ui.includes('state.printSide=state.printSide===1?-1:1'));
    assert.truthy(ui.includes('Math.atan2(state.vy*ratio,state.vx)'),
      'cqw and cqh are different pixel sizes, so the angle must be worked out in pixels');
    for (const rule of ['.nr-pet-trail{', '.nr-pet-print{', '.nr-pet-dust{',
                        '@keyframes nr-pet-print-fade', '@keyframes nr-pet-dust-puff'])
      assert.truthy(css.includes(rule), rule);
    assert.truthy(/@media\(prefers-reduced-motion:reduce\)\{\.nr-pet-print,\.nr-pet-dust\{display:none\}\}/.test(css),
      'a child who asked for less motion gets no trail at all');
    // The trail must never paint over the paw that made it.
    const trailRule = css.slice(css.indexOf('.nr-pet-trail{'), css.indexOf('}', css.indexOf('.nr-pet-trail{')));
    assert.truthy(trailRule.includes('z-index:1'), 'the trail sits under the dog');
  });
  test('fake landscape keeps every control the same size and on screen',()=>{
    // Rotating the stage 90deg swaps the axes, so the portrait offsets stacked
    // four buttons down the phone's SHORT edge and pushed SỬA off it, while
    // env(safe-area-inset-*) pointed at the wrong sides entirely.
    const block = css.slice(css.indexOf('.nr-builder.rotated{'), css.indexOf('@media(max-height:420px)'));
    assert.truthy(block.length > 200, 'the rotated layout must live in one readable block');
    assert.truthy(/width:66px;height:66px/.test(block), 'every rail control is one size');
    for (const control of ['.nr-builder-shop-fab', '.nr-builder-zoom', '.nr-builder-rotate', '.nr-builder-edit'])
      assert.truthy(block.includes('.nr-builder.rotated ' + control), control + ' must be re-anchored when rotated');
    // Packed along the short edge: last button ends well inside a 375px phone.
    const tops = [...block.matchAll(/\.nr-builder\.rotated \.nr-builder-(?:shop-fab|zoom|rotate|edit)\{top:(\d+)px/g)].map(m => +m[1]);
    assert.equal(tops.length, 4, 'all four rail controls need an explicit slot');
    assert.truthy(Math.max(...tops) + 66 <= 340, 'the rail must fit the narrow edge of a phone');
    assert.truthy(block.includes('.nr-builder.rotated .nr-builder-hud{left:14px;right:96px'),
      'the stat rail must stop short of the buttons, or SHOP sits on the coin counter');
    assert.truthy(block.includes('.nr-builder.rotated .nr-home-level{position:fixed'),
      'the house badge must stay on screen when the map is scrolled');
  });
  test('Phase 2 includes defense reports and deterministic replay UI',()=>{
    assert.truthy(ui.includes("api('reports'"));
    assert.truthy(ui.includes('nrShowReports()'));
    assert.truthy(ui.includes('nrReplayReport('));
    assert.truthy(game.includes('playReplay(commands,speed=1)'));
  });
  test('builder uses the equipped castle skin, coin upgrades and power totals',()=>{
    for(const token of ['isometric-home-board-expanded-v2.webp','nrEquippedCastle','paintEquippedCastle()','nrToggleBuilderGrid()','nr-builder-power damage','nr-builder-power defense'])assert.truthy(ui.includes(token)||css.includes(token),token);
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
    assert.truthy(ui.includes('Math.max(viewport.clientWidth/base,viewport.clientHeight/baseHeight)'),'min zoom must cover the 4:3 map viewport');
    assert.truthy(ui.includes('baseHeight=base*.75'),'builder map must preserve its rectangular 4:3 world');
    assert.truthy(ui.includes('setBuilderZoom(builderZoom)'),'persisted zoom must be re-clamped on open and rotation');
    assert.truthy(ui.includes("pointerdown=\"nrBeginPlacedDrag"));
    assert.truthy(css.includes('top:calc(78px + env(safe-area-inset-top))'));
  });

  test('the equipped castle drags only in edit mode and the real pet patrols it',()=>{
    for(const token of ['beginCastleDrag','castlePos','nr-castle-yard','nr-pet-patrol','yardPetHtml()','pet-walk-${pet.atlas}-v1.png','startPetPatrol','data-nr-yard-pet','dataset.x','state.vx*=-1','--nr-castle-x'])assert.truthy(ui.includes(token)||css.includes(token),token);
    for(const asset of ['pet-walk-small-v1.png','pet-walk-large-v1.png'])assert.truthy(fs.existsSync(path.join(root,'img/night-raid',asset)),asset);
    assert.truthy(css.includes('.nr-builder.editing .nr-builder-map>.nr-equipped-castle'),'castle drag must require SỬA');
    assert.truthy(css.includes('@media(prefers-reduced-motion:reduce)'),'pet patrol must respect reduced motion');
    for(const token of ['devicePixelRatio','ctx.setTransform','imageSmoothingQuality=\'high\''])assert.truthy(ui.includes(token),token);
  });

  test('shop can swipe horizontally and confirms coin purchases before placement',()=>{
    for(const token of ['allowHorizontalScroll','buildPurchasePlan','showBuildPurchase','nrConfirmBuildPurchase','nr-purchase-dialog'])assert.truthy(ui.includes(token)||css.includes(token),token);
    assert.truthy(css.includes('touch-action:pan-x'),'shop cards must preserve native horizontal swiping');
    assert.truthy(ui.includes("if(!confirmed){showBuildPurchase(plan);return;}"),'placement must pause before spending coins');
  });

  test('daily production UI shows pet power, countdowns and collect controls',()=>{
    for(const token of ['nr-pet-power-card','nr-production-badge','startProductionTicker','nr-collect-all','nrGridCell','localCollect'])assert.truthy(ui.includes(token)||css.includes(token),token);
    for(const asset of ['img/night-raid/training-barracks.png','img/night-raid/rice-field.png','img/night-raid/tomato-field.png','img/night-raid/fish-pond.png','img/night-raid/isometric-home-board-expanded-v2.webp'])assert.truthy(fs.existsSync(path.join(root,asset)),asset);
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
  test('Phaser units walk and attack with real animation frames, planted footprints and battle audio',()=>{
    // Production atlases now supply distinct paw/leg, weapon, hit and fallen
    // poses; the old deformation of one still image must not come back.
    assert.truthy(phaser.includes("raider-actions-v2.webp"),'raider action atlas');
    assert.truthy(phaser.includes("pet-actions-'+petAtlas+'-v2.webp"),'breed action atlas');
    assert.truthy(phaser.includes("actor.sprite.setFrame(actor.prefix+frame)"),'runtime swaps true frames');
    assert.truthy(phaser.includes("pose.state==='engage'"),'attack frames follow combat state');
    assert.truthy(phaser.includes("pose.state==='fallen'"),'fallen frame follows casualty state');
    assert.falsy(phaser.includes('setCrop'),'no split-body fake stride');
    assert.falsy(phaser.includes('x=pose.x+stride'),'no side-to-side wobble slide');
    assert.truthy(phaser.includes('paintTrail'),'planted footprints pass');
    assert.truthy(/Math\.floor\(T\/STEP\)\*STEP/.test(phaser),'prints quantised to the step grid, not sliding with the sprite');
    assert.truthy(phaser.includes("u.kind==='pet'"),'pet leaves paw prints, soldiers boot prints');
    // Sound is synthesized (no assets), created only after the TIEN QUAN gesture.
    assert.truthy(phaser.includes('AudioContext'),'synthesized battle sound');
    for(const cue of ['warCry','launch(kind)','impactShot','demolish','breach','retreat','step()'])assert.truthy(phaser.includes(cue),cue);
    assert.truthy(phaser.includes('this.reduce?null:new RaidAudio'),'reduced effects stay silent');
    // Buildings break for real using authored damaged/ruined silhouettes.
    assert.truthy(phaser.includes('tw.fallAt'),'towers topple on the choreo schedule');
    assert.truthy(phaser.includes('defense-damage-v2.webp'));
    assert.truthy(phaser.includes('economy-damage-v2.webp'));
    assert.truthy(phaser.includes('d.sprite.setFrame(d.prefix+stage)'));
    assert.truthy(phaser.includes('castle-damage-a-v2.webp'));
    assert.truthy(phaser.includes('castle-damage-b-v2.webp'));
    assert.truthy(phaser.includes('this.castle.setFrame(this.castleFrames.prefix+stage)'));
    assert.truthy(phaser.includes("event.type==='demolish'"),'collapse bursts rubble and smoke');
    // One shared depth space so units walk behind far buildings.
    assert.truthy(phaser.includes('setDepth(tower.y)')||phaser.includes('setDepth(tw.y)'),'towers depth-sort by ground y');
    // Choreo places towers from the defender's real 12x12 grid, matching the builder.
    const choreo=read('js/night-raid-choreo.js');
    assert.truthy(choreo.includes('cellAnchor'),'towers project from home grid cells');
    assert.truthy(choreo.includes('left:144, top:200, size:512, cells:12'),'projection matches .nr-free-grid (18%/25%/64% of 800)');
  });
  test('every generated Night Raid atlas is present and kept lazy',()=>{
    const files=['raider-actions-v2.webp','pet-actions-small-v2.webp','pet-actions-large-v2.webp','defense-damage-v2.webp','economy-damage-v2.webp','castle-damage-a-v2.webp','castle-damage-b-v2.webp'];
    for(const file of files){
      assert.truthy(fs.existsSync(path.join(root,'img/night-raid/animation',file)),file);
      assert.falsy(sw.includes("'/img/night-raid/animation/"+file+"'"),file+' must not bloat app install; runtime fetch cache owns it');
    }
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
  test('bot raids field 4 test soldiers plus the real barracks stock',()=>{
    // Practice against bots must always show a readable squad with the dog:
    // a 4-soldier test floor, with produced soldiers joining on top, capped
    // at the squad limit. Only the bot target carries this — online raids
    // against real homes keep the honest produced count.
    const botBlock=ui.slice(ui.indexOf('function makeBotTarget'),ui.indexOf('function scoutBot'));
    assert.truthy(botBlock.includes('target.attackerSoldiers=Math.min(NightRaidRules.MAX_SOLDIERS,4+Math.max(0,mine.soldiers))'),'bot squad = 4 + produced, capped');
    assert.equal((ui.match(/4\+Math\.max\(0,mine\.soldiers\)/g)||[]).length,1,'the test floor exists exactly once — on the bot target only');
    // The free test soldiers are never charged back to the barracks stock.
    assert.truthy(ui.includes("soldiersUsed=Math.min(NightRaidRules.MAX_SOLDIERS,appState.nightRaidLayout?.soldiers||0)")||ui.includes('appState.nightRaidLayout.soldiers=Math.max(0,appState.nightRaidLayout.soldiers-soldiersUsed)'),'deduction stays based on real stock');
  });
  test('the castle has structural stages, persistent crater and projectile trails',()=>{
    const art=read('js/night-raid-art.js');
    assert.truthy(art.includes('const damage=ratio<=0?4'));
    assert.truthy(art.includes('Deep crater'));
    assert.truthy(art.includes('drawProjectile'));
  });
});
