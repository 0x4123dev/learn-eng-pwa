const { suite, test, assert } = require('./harness');
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),css=require('./css-all').readAllCss(),ui=read('js/night-raid.js'),sw=read('sw.js');

// js/night-raid.js is the Nông trại tab: the learner's own home and farm.
// The raid — scouting, battles, reports, shields, swords, the armory, the
// Arena that hosted it — was cut in September 2026. These tests cover what
// stayed: the yard, the pet, the parade, the builder, the shop, the farm.
suite('farm: app integration',()=>{
  test('one dedicated screen; the rules ship in the app shell and the farm code rides the farm lazy group',()=>{
    assert.truthy(html.includes('id="nightRaidScreen"'));
    // Daily Task reads NightRaidRules on Home, so the rules stay eager. The
    // screen's own code is the `farm` group (js/lazy-data.js GROUP_FILES).
    assert.truthy(html.includes('js/night-raid-rules.js'));
    const lazy=require('../js/lazy-data.js');
    const farm=lazy.GROUP_FILES.farm;
    assert.truthy(Array.isArray(farm)&&farm.includes('js/night-raid.js'),'js/night-raid.js is farm-group code');
    assert.truthy(farm.includes('js/farm-art-manifest.js'),'the farm art manifest lands with it');
    assert.equal(lazy.SCREEN_GROUPS.nightRaidScreen,'farm');
    for(const f of farm)assert.falsy(html.includes('src="'+f+'"'),f+' must not also be an eager script');
    assert.equal(lazy.GROUP_FILES.arena,undefined,'the Arena group is gone');
  });
  test('the farm works offline',()=>{
    for(const file of ['night-raid-rules.js','night-raid.js','farm-art-manifest.js'])assert.truthy(sw.includes("'/js/"+file+"'"),file);
    for(const file of ['night-raid-art.js','night-raid-game.js','night-raid-phaser.js','phaser.min.js','armory.js','petbattle.js'])assert.falsy(sw.includes("'/js/"+file+"'"),file+' was cut and must not be precached');
  });
  test('the farm is a bottom-nav tab that goes back to Home',()=>{
    assert.truthy(/data-nav-key="farm"[^>]*onclick="openNightRaid\(\)"|onclick="openNightRaid\(\)"[^>]*data-nav-key="farm"/.test(html),'index.html has the Nông trại nav button');
    assert.truthy(read('js/app.js').includes("nightRaidScreen: 'farm'"),'the screen belongs to the farm nav group');
    assert.truthy(ui.includes("switchScreen('homeScreen')"),'close() lands on Home');
    assert.falsy(ui.includes('petBattleScreen')||ui.includes('renderPetBattle'),'the Arena is not a destination any more');
    assert.falsy(ui.includes('setNav(')||ui.includes('bottomNav'),'a tab never hides the bottom bar');
  });
  test('the raid is gone from the farm module',()=>{
    for(const token of ['NightRaidGame','NightRaidArt','NightRaidRuins','NightRaidPhaser','Phaser','Armory','CastleSkins','GhostOffering','petbattle',
      "api('start'","api('finish'","api('friends'","api('targets'","api('reports'","api('shield'",
      'isRaiding','abandonRaid','confirmLeaveRaid','retryPendingFinish','claimVerified','showLiveTargets','showReports','replayReport','lockChip','combatPower','trainingTarget',
      'nightRaidPending','nightRaidClaimed','nightRaidTicketCount','nightRaidRewardToday','nightRaidRouteLevel','nightRaidStars','nightRaidHistory'])
      assert.falsy(ui.includes(token),'raid code survived: '+token);
    for(const copy of ['Cướp Đêm','CƯỚP ĐÊM','cướp','TIẾN QUÂN','TẤN CÔNG','NHẬT KÝ','VŨ KHÍ','KHIÊN ĐÊM','CASTLE NIGHT RAID'])
      assert.falsy(ui.includes(copy),'raid copy survived: '+copy);
    assert.truthy(ui.includes("title:'Nhà của bạn'")&&ui.includes("kicker:'NÔNG TRẠI'"),'the screen is named for what it is');
    for(const kept of ['function openNightRaid()','function closeNightRaid()','forgetProfile,mountYardScene,unmountYardScene','refreshHome,syncHome','function adoptServerCoins(','appState.nightRaidWalletSynced'])
      assert.truthy(ui.includes(kept),'kept: '+kept);
    const globals=(ui.match(/^function (nr[A-Z][A-Za-z]*)\(/gm)||[]).map(x=>x.replace(/^function |\($/g,''));
    for(const g of globals){
      const handler=g.replace(/^nr/,'');
      const called=new RegExp('nr'+handler+'\\(').test(ui.slice(0,ui.indexOf('function openNightRaid')));
      // Compatibility shims for older cached markup, the verify layer
      // (nrShowBuilder) and the castle pad (wired with addEventListener).
      assert.truthy(called||['nrShowBuilder','nrSelectZone','nrBuildCell','nrSetDogLane','nrCleanYard','nrBeginCastleDrag'].includes(g),g+' is exported but nothing in the markup calls it');
    }
  });
  test('the yard pet atlas survives being handed to CSS as a variable',()=>{
    // A RELATIVE url() inside a CSS custom property is resolved against the
    // stylesheet that CONSUMES it, not the page — so `img/night-raid/x.png`
    // became `/css/img/night-raid/x.png`, 404'd, and the patrolling dog was
    // invisible while every other check looked healthy. Root-absolute only.
    const m = ui.match(/walk=`([^`]*pet-walk[^`]*)`/);
    assert.truthy(m, 'the yard pet atlas url must be built in one place');
    assert.truthy(m[1].startsWith('/img/'), 'the atlas url must be root-absolute, got: ' + m[1]);
    assert.truthy(css.includes('var(--nr-pet-walk)'), 'the sprite still reads the walk variable');
    assert.truthy(css.includes('var(--nr-pet-actions)'), 'the sprite still reads the action variable');
    for (const atlas of ['pet-walk-small-v1.webp', 'pet-walk-large-v1.webp','pet-actions-small-v2.webp','pet-actions-large-v2.webp']) {
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
    assert.truthy(ui.includes('x1:x+cw*(size+.22)+PET_BODY.halfW'),'collision width follows 1x1 or 2x2 footprint');
    assert.truthy(ui.includes('y1:y+ch*(size+.18)+PET_BODY.height'),'collision height follows 1x1 or 2x2 footprint');
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
  test('the yard pet runs errands, and the mess is the child\'s to clear',()=>{
    // A dog that only paces is a screensaver. Now and then it walks to the
    // rice or the pond, squats, and leaves something behind.
    assert.truthy(ui.includes("cell.type!=='rice-field'&&cell.type!=='fish-pond'"),
      'errands follow the movable 2x2 rice field and fish pond');
    assert.truthy(ui.includes("cell.type==='rice-field'?'pee':'poop'"),'rice means pee and the pond means poop');
    assert.truthy(ui.includes('state.squatUntil'),'it must stop walking to do its business');
    assert.truthy(ui.includes("if(state.errand?.kind==='poop')dropYardPoop(state.errand)"));
    assert.truthy(ui.includes('spawnPetBusinessEffect(map,state.mode,state)'));
    assert.truthy(ui.includes('I&#39;m peeing'),'the dog says what it is doing during the pee animation');
    assert.truthy(css.includes('.nr-pet-event-label{'),'the pee speech bubble is clearly styled above the dog');
    assert.truthy(/\.nr-pet-event\{[^}]*z-index:10/.test(css),'the dog cannot cover its peeing speech bubble');
    assert.truthy(/\.nr-pet-event-label\{[^}]*bottom:76px/.test(css),'the bubble clears the dog body instead of sitting on its face');
    // The two traps this feature can fall into, both found by walking every
    // spot on a built-up yard before shipping:
    assert.truthy(ui.includes('&&!petBlockedAt(rects,s.x,s.y)'),
      'a spot inside a building can never be reached, so it must be filtered out');
    assert.truthy(ui.includes('now>state.errandUntil'),
      'an errand it cannot reach must be abandoned, or the dog presses into a wall forever');
    assert.truthy(ui.includes('PET_BODY.height+1, what:'),
      'the rice spot must sit past the solid box, not inside the crop');
    // Clearing up: same pay as the chore at home, from the same constants.
    assert.truthy(ui.includes('POOP_CLEAN_COINS'));
    assert.truthy(ui.includes('POOP_CLEAN_XP'));
    assert.truthy(ui.includes('function cleanYardPoop(id)'));
    assert.truthy(ui.includes('data-nr-clean'),'the tidy-up button lives on the yard screen');
    assert.truthy(ui.includes('nrCleanYard()'));
    assert.truthy(ui.includes('appState.nightRaidPoops'),'the mess survives leaving the screen');
    // Each poop is a real button, so a child can tap the mess itself too.
    assert.truthy(ui.includes('class="nr-yard-poop"'));
    assert.truthy(ui.includes("aria-label=\"Dọn phân chó\""));
    for (const rule of ['.nr-yard-poops{', '.nr-yard-poop{', '@keyframes nr-poop-drop'])
      assert.truthy(css.includes(rule), rule);
    assert.truthy(ui.includes('yardPoopSpots,'),'the spots stay checkable from outside');
    assert.falsy(ui.includes("what:'bãi cỏ'"),'bathroom actions belong only at their requested destinations');
    assert.truthy(ui.includes('const activeBounds=state.errand?'),'an errand may leave the normal castle patrol rectangle');
  });
  test('the yard pet pauses, barks, rests and scratches with real action sprites',()=>{
    for(const token of ['choosePetIdle','mode===\'bark\'','mode===\'rest\'','mode===\'scratch\'','data-mode="walk"','--nr-pet-actions'])assert.truthy(ui.includes(token)||css.includes(token),token);
    // Balance, not literals: pacing was the whole personality and it read as a
    // screensaver. Barking and resting must together outweigh walking, so the
    // weights are checked as weights and stay free to be re-tuned.
    const roll=ui.match(/roll<\.(\d+)\?'bark':roll<\.(\d+)\?'rest'/);
    assert.truthy(roll,'bark and rest must be the first two draws');
    const bark=+roll[1]/100, rest=+roll[2]/100 - +roll[1]/100;
    assert.truthy(bark+rest>=.7,'barking and resting should be most of what it does, got '+((bark+rest)*100)+'%');
    const dur=ui.match(/mode==='idle'\?(\d+):state\.mode==='bark'\?(\d+):state\.mode==='rest'\?(\d+):(\d+)/);
    assert.truthy(dur,'each mood needs its own dwell time');
    assert.truthy(+dur[3]>=5000,'a rest must actually look like a rest, got '+dur[3]+'ms');
    assert.falsy(ui.includes('nr-pet-bark')||css.includes('nr-pet-bark'),'bark sprite must not get a stray white sound mark');
    for(const asset of ['pet-actions-small-v2.webp','pet-actions-large-v2.webp'])assert.truthy(fs.existsSync(path.join(root,'img/night-raid',asset)),asset);
    // Short strolls between moods, and a walking pace a puppy could keep.
    const gap=ui.match(/nextCasual=now\+(\d+)\+Math\.random\(\)\*(\d+)/);
    assert.truthy(gap,'the gap between moods must be a random range');
    assert.truthy(+gap[1]+ +gap[2] <= 4000,'a walk bout longer than four seconds is pacing again, got '+(+gap[1]+ +gap[2])+'ms');
    const speed=ui.match(/vx:([\d.]+),vy:([\d.]+)/);
    assert.truthy(speed && +speed[1]<=4,'the dog was sprinting; walking pace is about half that, got '+(speed&&speed[1]));
    // Slowing the walk doubled every errand, so it must aim at the closest
    // destination and be given time to get there.
    assert.truthy(ui.includes('for(const sp of spots){const d=Math.hypot'),'errands go to the nearest spot');
    assert.truthy(/YARD_ERRAND_TIMEOUT_MS=(\d+)/.test(ui)&&+ui.match(/YARD_ERRAND_TIMEOUT_MS=(\d+)/)[1]>=25000,
      'at walking pace a far corner takes ~30s, so the old 14s deadline could never be met');
    assert.truthy(css.includes('@media(prefers-reduced-motion:reduce)'),'ambient actions must respect reduced motion');
  });
  test('produced soldiers parade on the home lawn in their real count',()=>{
    assert.truthy(ui.includes('function yardArmyHtml()'),'the home builds a squad from the saved barracks stock');
    assert.truthy(ui.includes('appState.nightRaidLayout?.soldiers||0'),'zero stock renders no decorative soldiers');
    assert.truthy(ui.includes('armySlots(count).map'),'one DOM soldier is rendered for each real soldier');
    assert.truthy(ui.includes("data-mode=\"march\""),'the squad begins as an ordered marching formation');
    for(const mode of ["state.mode='attention'","state.mode='rest'","state.mode='march'"])
      assert.truthy(ui.includes(mode),mode);
    assert.truthy(ui.includes('armyClearAt(petBlockedRects()'),'the formation turns rather than walking through a bought building');
    assert.truthy(ui.includes('function advanceArmyLane(state,slots,dt)'),'lane changes have an explicit walking interpolation');
    assert.truthy(ui.includes('5.2*dt')&&ui.includes('state.targetY'),'vertical movement is time-based rather than a one-frame teleport');
    assert.falsy(ui.includes('state.y=alternatives[Math.floor(Math.random()*alternatives.length)]'),'collision handling must never jump directly to a distant lane');
    assert.truthy(ui.includes('startArmyParade(petPatrolRoot)')&&ui.includes('startArmyParade(activeMap)'),'the parade starts against the explicit visible map in both habitats');
    assert.truthy(css.includes("raider-actions-v3.webp"),'the home parade reuses the complete ten-soldier action atlas');
    assert.truthy(css.includes("raider-walk-v4.webp"),'marching uses the complete ten-soldier locomotion atlas');
    assert.truthy(css.includes('aspect-ratio:1.5'),'soldier boxes preserve the authored 3:2 frame instead of squashing the body');
    assert.falsy(css.includes('aspect-ratio:2.25'),'the old wide, flattened soldier frame must not return');
    assert.truthy(css.includes('.nr-home-soldier::after{'),'a separate contact shadow seats each raised soldier on the grass');
    assert.truthy(css.includes('drop-shadow(0 .48cqw .28cqw'),'the sprite body has a deeper layered shadow for readable 3D separation');
    assert.truthy(ui.includes("%6"),'the six authored gait frames all play');
    // The parade is decorative now, but a parade whose atlases were deleted
    // with the battle draws ten empty shadows. The two sheets it reads must
    // ship and be precached like every other yard asset.
    for(const atlas of ['raider-actions-v3.webp','raider-walk-v4.webp']){
      assert.truthy(fs.existsSync(path.join(root,'img/night-raid/animation',atlas)),'img/night-raid/animation/'+atlas+' is missing — the parade CSS reads it');
      assert.truthy(sw.includes("'/img/night-raid/animation/"+atlas+"'"),atlas+' must be precached for the offline parade');
    }
    assert.truthy(css.includes('.nr-yard-army[data-mode="attention"]'),'attention has a visually distinct pose');
    assert.truthy(css.includes('.nr-yard-army[data-mode="rest"]'),'rest has a visually distinct pose');
    assert.truthy(css.includes('@media(prefers-reduced-motion:reduce)'),'the squad can stand still for reduced-motion users');
  });
  test('marching soldiers leave a restrained footprint trail',()=>{
    assert.truthy(ui.includes('data-nr-army-trail'),'the squad needs a trail layer beneath it');
    assert.truthy(ui.includes('spawnArmyTrail(trail,state,slots,t)'),'march ticks plant prints at current positions');
    assert.truthy(ui.includes('while(layer.childElementCount>34)'),'the ambient trail stays bounded');
    assert.truthy(css.includes('.nr-army-print{'),'soldier prints have their own visual');
    assert.truthy(css.includes('@keyframes nr-army-print-fade'),'soldier prints fade from the lawn');
    assert.truthy(css.includes('.nr-army-dust{'),'soldier heels kick up a restrained dust puff');
    assert.truthy(css.includes('@keyframes nr-army-dust-puff'),'dust expands and fades in place');
    assert.truthy(css.includes('.nr-army-print,.nr-army-dust{display:none}'),'reduced motion removes decorative trails');
  });
  test('the compact home HUD shows the soldier count and the coins, and no combat score',()=>{
    assert.truthy(/nr-builder-power soldiers[\s\S]*nr-builder-power coins/.test(ui));
    assert.falsy(ui.includes('nr-builder-power damage')||ui.includes('nr-builder-power defense'),'DAM/DEF went with the battle');
    assert.falsy(css.includes('.nr-builder-power.soldiers{display:none}'),'phones must not hide the real soldier count');
  });
  test('Home shows the evolving dog; the castle yard is a scene any host can mount',()=>{
    const home=read('js/home.js');
    assert.falsy(home.includes('NightRaid.mountYardScene'),'Home must never replace the close-up dog with a castle yard');
    assert.truthy(home.includes("stage_el.classList.remove('yard-mode')"),'the old full-yard stage mode must be removed');
    assert.truthy(home.includes('<div class="pet-wrapper">')&&home.includes('${petArtHTML}'),
      'Home must render the live SVG dog and its level accessories');
    assert.truthy(ui.includes('function mountYardScene(host,opts)'),'one walk, mounted where it is asked for');
    assert.truthy(ui.includes('isometric-home-board-unified-gate-v3.webp'),'the mini yard uses the rectangular yard, not the old square board');
    assert.truthy(ui.includes("paintEquippedCastle('nrMiniCastle')"),'the mini yard paints the castle');
    assert.truthy(ui.includes('style="${mapStyle}"'),'castle uses the saved map anchor in the mini yard too');
    assert.truthy(ui.includes('function yardBuildingsHtml()'),'the mini yard paints the real bought-building layout');
    assert.truthy(ui.includes('+yardBuildingsHtml()+yardPetHtml'),'farms, barracks and defenses mount under the living actors');
    assert.truthy(ui.includes("res.data?.home?.layout"),'the yard refreshes the authoritative server home');
    assert.truthy(ui.includes("skipRefresh:true"),'the server refresh remounts once without a request loop');
    assert.truthy(css.includes('.nr-mini-map .nr-home-layout{pointer-events:none}'),'visible buildings do not steal host gestures');
    assert.truthy(css.includes('.nr-mini-map .nr-home-layout em{display:none}'),'the mini yard hides construction-tier bubbles');
    assert.truthy(css.includes('.nr-mini-map .nr-yard-pet{width:clamp(34px,10cqw,64px)}'),'the mini-yard pet stays proportional to farms and defenses');
    assert.truthy(ui.includes('function startPetPatrol(map)')&&ui.includes('startPetPatrol(activeMap)'),'the patrol is explicitly attached to the newly rendered visible map');
    assert.truthy(ui.includes("document.querySelector('.screen.active .nr-builder-map')"),'visibility resume may only discover a map inside the active screen');
    assert.falsy(ui.includes("petPatrolRoot||document.querySelector('.nr-builder-map')"),'a stale hidden dog must never steal the farm timer');
    assert.truthy(css.includes('aspect-ratio:4/3'),'the yard must preserve the source art ratio');
    assert.truthy(css.includes('.nr-mini-map>.nr-equipped-castle{left:calc(var(--nr-castle-x,50)*1%)'),'castle feet follow the same coordinate system as the paving');
    // Several rules target the keep; the one that positions it is the one that
    // reads the paving coordinates.
    const castleRule=(css.match(/\.nr-builder-map>\.nr-equipped-castle\{[^}]*--nr-castle-x[^}]*\}/)||[''])[0];
    assert.truthy(castleRule.includes('filter:none!important'),'castle stays shadow-free at rest and on Home');
    assert.truthy(/transform:translate\(-50%,-100%\)/.test(castleRule),'the keep stands on the bottom centre of its own ground');
    assert.truthy(/left:calc\(var\(--nr-castle-x/.test(castleRule),'castle feet follow the paving coordinates');
    // The land grid paints at z-index 6. Below it, white cell borders were drawn
    // straight across the stonework and the keep read as a see-through sketch.
    const zOf=rule=>Number((rule.match(/z-index:(\d+)/)||[])[1]);
    const gridZ=zOf((css.match(/\.nr-free-grid\{[^}]*\}/)||[''])[0]);
    assert.truthy(zOf(castleRule)>gridZ,`castle z-index ${zOf(castleRule)} must beat the grid's ${gridZ}`);
    assert.truthy(css.includes('.nr-builder-map.castle-dragging>.nr-equipped-castle{cursor:grabbing;opacity:.84;filter:none!important}'),'dragging must not bring the black shadow back');
    assert.truthy(ui.includes('yardPetHtml({showName:false})'),'the yard omits the moving dog name from markup');
    assert.truthy(ui.includes('preloadPetAtlases(sprite)'),'idle sprites load before the first stop');
    assert.truthy(ui.includes("pet.dataset.atlas=walking||!actionsReady?'walk':'actions'"),'the walk frame remains visible while the action atlas is loading');
    assert.truthy(css.includes('.nr-yard-pet-sprite::before,.nr-yard-pet-sprite::after'),'walk and idle atlases remain mounted together');
  });
  test('the six icon controls form one compact vertical rail in portrait and fake landscape',()=>{
    // The rail's overrides live in css/night-raid.css, right before the farm docks.
    const compact = css.slice(css.indexOf('/* Compact icon rail:'), css.indexOf('/* Square farm docks hug the straight edges'));
    assert.truthy(compact.length > 500, 'the final compact rail overrides must stay together');
    assert.truthy(compact.includes('grid-template-columns:48px'), 'the four navigation actions stack in one column');
    assert.truthy(compact.includes('.nr-builder-shop-fab{top:calc(330px'), 'SHOP sits directly under the four navigation icons');
    assert.truthy(compact.includes('.nr-builder-rotate{top:calc(384px'), 'rotate follows SHOP');
    assert.truthy(compact.includes('.nr-builder-edit{top:calc(438px'), 'edit follows rotate');
    assert.truthy(compact.includes('.nr-builder-nav-btn>span,.nr-builder-shop-fab>span,.nr-builder-rotate>span,.nr-builder-edit>span'), 'rail labels are visually clipped, not drawn over the map');
    assert.truthy(compact.includes('.nr-shop-tabs button{width:44px;height:44px'), 'shop category icons keep a safe touch target');
    // Packed along the short edge: all seven 44px controls end inside 375px.
    assert.truthy(compact.includes('.nr-builder.rotated .nr-builder-nav{left:auto;right:14px;top:14px'), 'the rotated rail begins at the top right');
    assert.truthy(compact.includes('.nr-builder.rotated .nr-builder-edit{top:314px}'), 'the last rotated icon remains on screen');
    assert.truthy(css.includes('.nr-builder.rotated .nr-builder-hud{left:14px;right:96px'),
      'the stat rail must stop short of the buttons, or SHOP sits on the coin counter');
    assert.truthy(css.includes('.nr-builder-zoom,\n.nr-home-level {\n    display: none !important;'),
      'the zoom rail and house-level plaque must not occupy the playfield');
  });
  test('the compact rail is hidden behind an ellipsis and can be collapsed again',()=>{
    assert.truthy(ui.includes("builderMenuOpen?'menu-open':'menu-closed'"), 'builder renders an explicit rail state');
    assert.truthy(ui.includes("builderMenuOpen?'‹':'•••'"), 'one control opens and collapses the rail');
    assert.truthy(css.includes('.nr-builder.menu-closed .nr-builder-nav'), 'closed state hides the navigation actions');
    assert.truthy(css.includes('.nr-builder.menu-closed .nr-builder-menu-toggle{top:calc(114px'), 'ellipsis occupies the first rail slot');
  });
  test('entering the home always restores a visible iPad menu control',()=>{
    assert.truthy(ui.includes("builderMenuOpen=false;builderRotated=false;if(typeof switchScreen"),
      'a previous phone-style rotation must not survive leaving and re-entering the home');
    assert.truthy(ui.includes("matchMedia('(min-width: 701px)').matches"),
      'the synthetic 90-degree rotation is guarded from tablet viewports');
    assert.truthy(css.includes('@media(min-width:701px){\n    .nr-builder-rotate{display:none!important}'),
      'iPad uses its real device orientation instead of the phone-only rotate control');
    assert.truthy(css.includes('.nr-builder-edit{top:calc(384px + env(safe-area-inset-top))}'),
      'the tablet rail closes the space left by the removed rotate control');
  });
  test('builder shows one castle asset, coin upgrades and the soldier count',()=>{
    for(const token of ['isometric-home-board-frame-v4.webp','nrEquippedCastle','paintEquippedCastle()','nrToggleBuilderGrid()','nr-builder-power soldiers','nr-builder-power coins'])assert.truthy(ui.includes(token)||css.includes(token),token);
    for(const token of ['nr-equipped-castle','nr-build-art'])assert.truthy(css.includes(token),token);
    assert.truthy(ui.includes('<img id="nrEquippedCastle"'),'builder castle must be a composited image, not a large live canvas on iOS');
    assert.truthy(ui.includes("src=\"img/night-raid/home-castle.webp\""),'the one castle asset is the image itself');
    assert.falsy(ui.includes("canvas.toDataURL")||ui.includes('trimmedCanvasUrl'),'no castle-skin rasteriser survives: the skins went with the Arena');
    assert.falsy(ui.includes('<canvas id="nrEquippedCastle"'),'visible builder canvas causes black GPU bands on Safari');
    assert.truthy(fs.existsSync(path.join(root,'img/night-raid/home-castle.webp'))&&sw.includes("'/img/night-raid/home-castle.webp'"),'the castle ships and is precached');
  });
  test('builder is a pannable full-screen home with shop drag and free placement',()=>{
    for(const token of ['nr-builder-world','nr-builder-map','nr-builder-shop-fab','nr-free-grid','nr-build-grid-cell'])assert.truthy(ui.includes(token)||css.includes(token),token);
    for(const token of ['nrBeginBuildDrag','nrDropBuildItem','grid-template-columns:repeat(12','setupBuilderGestures','setBuilderZoom','nrBeginPlacedDrag','chụm hai ngón'])assert.truthy(ui.includes(token)||css.includes(token),token);
    assert.falsy(ui.includes('Chó bảo vệ khu'));
  });
  test('builder supports pinch zoom without a permanent zoom rail, plus shop and free item repositioning',()=>{
    for(const token of ['touch-action:none','nr-builder-shop-fab','movePlacedItem','builderZoomBounds','chụm hai ngón để thu phóng'])assert.truthy(ui.includes(token)||css.includes(token),token);
    assert.truthy(ui.includes('ESTATE_MIN_ZOOM=.03,ESTATE_MAX_ZOOM=4'),'pinch zoom must range from distant estate to close inspection');
    assert.truthy(css.includes('.nr-builder-zoom,\n.nr-home-level {\n    display: none !important;'),'the +/- rail and house-level text stay hidden');
    assert.truthy(css.includes('endless-meadow-tile-v2.jpg')&&css.includes('background-repeat:repeat'),'space inside and beyond the fence must use the same endless grass texture');
    assert.truthy(ui.includes("plane.className='nr-world-plane'")&&ui.includes('plane.appendChild(map)'),'the meadow and estate must stay inside one real camera plane while zooming and panning');
    assert.truthy(ui.includes('setBuilderZoom(builderZoom)'),'persisted zoom must be re-clamped on open and rotation');
    assert.truthy(ui.includes("pointerdown=\"nrBeginPlacedDrag"));
    assert.truthy(css.includes('.nr-builder-hud{position:absolute')&&css.includes('top:10px'),'the app owns the safe area once; the HUD stays at the top of its screen');
  });

  test('the equipped castle drags only in edit mode and the real pet patrols it',()=>{
    for(const token of ['beginCastleDrag','castleCell','footprintFor','nr-pet-patrol','yardPetHtml({showName:false})','pet-walk-${pet.atlas}-v1.webp','startPetPatrol','data-nr-yard-pet','dataset.x','state.vx*=-1','--nr-castle-x'])assert.truthy(ui.includes(token)||css.includes(token),token);
    for(const asset of ['pet-walk-small-v1.webp','pet-walk-large-v1.webp'])assert.truthy(fs.existsSync(path.join(root,'img/night-raid',asset)),asset);
    assert.truthy(css.includes('.nr-builder.editing .nr-builder-map>.nr-equipped-castle'),'castle drag must require SỬA');
    assert.truthy(css.includes('@media(prefers-reduced-motion:reduce)'),'pet patrol must respect reduced motion');
  });

  test('shop can swipe horizontally and confirms coin purchases before placement',()=>{
    for(const token of ['allowHorizontalScroll','buildPurchasePlan','showBuildPurchase','nrConfirmBuildPurchase','nr-purchase-dialog'])assert.truthy(ui.includes(token)||css.includes(token),token);
    assert.truthy(css.includes('touch-action:pan-x'),'shop cards must preserve native horizontal swiping');
    assert.truthy(ui.includes("if(!confirmed){showBuildPurchase(plan);return;}"),'placement must pause before spending coins');
  });

  test('daily production UI shows pet power, countdowns and collect controls',()=>{
    for(const token of ['nr-production-badge','startProductionTicker','nr-collect-all','nrGridCell','localCollect'])assert.truthy(ui.includes(token)||css.includes(token),token);
    for(const asset of ['img/night-raid/training-barracks.webp','img/night-raid/rice-field.webp','img/night-raid/tomato-field.webp','img/night-raid/fish-pond.webp','img/night-raid/isometric-home-board-frame-v4.webp','img/night-raid/endless-meadow-tile-v2.jpg'])assert.truthy(fs.existsSync(path.join(root,asset)),asset);
    assert.truthy(sw.includes("'/img/night-raid/isometric-home-board-frame-v4.webp'")&&sw.includes("'/img/night-raid/endless-meadow-tile-v2.jpg'"),'the unified estate remains available offline');
  });
  test('the inactive production summary takes no estate space',()=>{
    assert.truthy(css.includes('.nr-collect-all:disabled{display:none}'),'only an actionable harvest control is visible');
  });
  test('the placement grid closes after a purchased or moved building is dropped',()=>{
    assert.truthy(ui.includes('function settleBuilderPlacement()'));
    assert.truthy(ui.includes('builderEditing=false;builderShopOpen=false'));
    assert.truthy(ui.includes("classList.remove('editing','dragging','shop-open')"));
    assert.truthy(ui.includes('target=>{buildCell(+target.dataset.gx,+target.dataset.gy,false,+target.dataset.zone||0);settleBuilderPlacement();}'));
  });
  test('iOS image callouts are blocked and drag work is frame-coalesced',()=>{
    for(const token of ['oncontextmenu="return false"','-webkit-touch-callout:none','setPointerCapture','requestAnimationFrame(paint)','translate3d(','dropTarget?.classList.remove'])assert.truthy(ui.includes(token)||css.includes(token),token);
    assert.falsy(ui.includes("querySelectorAll('.nr-build-grid-cell.drag-over')"));
  });
  test('phone shop opens as an unobscured top sheet',()=>{
    for(const token of ['top:calc(150px + env(safe-area-inset-top))','max-height:min(55dvh,460px)','transform-origin:top right'])assert.truthy(css.includes(token),token);
    assert.truthy(css.includes('.nr-builder-shop-fab{z-index:50}'));
  });
  test('production timers hide behind the art until the building is tapped',()=>{
    // The countdown used to sit permanently over the rice field / barracks.
    // Now it only shows when READY (to collect) or for 4s after a tap — and
    // tapping a ready producer collects it on the spot.
    assert.truthy(css.includes('white-space:nowrap;pointer-events:none;display:none}'),'badge hidden by default');
    assert.truthy(css.includes('.nr-production-badge.ready,.nr-production-badge.shown{display:block}'));
    assert.truthy(ui.includes("badge.classList.add('shown')"));
    assert.truthy(ui.includes('if(cellReady(cell)&&cell.uid)return collectResources(cell.uid)'),'tapping a task-day barracks or timed producer collects');
  });
  test('moving a building requires pressing SỬA first',()=>{
    // The grid only shows in edit mode, placed items refuse to drag outside
    // it, and outside edit mode buildings are transparent to touches so a
    // finger on them pans the island instead of grabbing anything.
    assert.truthy(ui.includes('nr-builder-edit'));
    assert.truthy(ui.includes('nrToggleBuilderGrid()'),'the SỬA fab flips edit mode');
    assert.truthy(ui.includes('function beginPlacedDrag(event,gx,gy,layer,zone){if(!builderEditing)return;'));
    assert.truthy(css.includes('.nr-builder:not(.editing):not(.nr-home-stage) .nr-build-grid-cell'));
    assert.truthy(css.includes('.nr-builder.editing .nr-build-grid-cell>i'),'grid markers show only while editing');
  });
  test('dragging a farm reveals square snap docks tight around the castle',()=>{
    assert.truthy(ui.includes('NightRaidRules.FARM_PLOT_DOCKS.map'),'all legal docks are rendered from the shared rule');
    assert.truthy(ui.includes("map.classList.add('farm-dragging')"),'the placement guide appears for the duration of the drag');
    assert.truthy(ui.includes('NightRaidRules.nearestFarmPlotDock(rawX,rawY)'),'the plot snaps instead of keeping an arbitrary meadow coordinate');
    assert.truthy(css.includes('.nr-estate-map.farm-dragging .nr-farm-dock{opacity:1'),'dock guides become visible');
    for(const style of ['stone','hedge','clover'])assert.truthy(fs.existsSync(path.join(root,`img/farm/farm-plot-${style}.webp`)),style+' green plot asset ships');
    assert.falsy(css.includes(".nr-farm-surface::before"),'the rejected brown furrow overlay stays removed');
  });
  test('the old home entry point redirects to the editable builder',()=>{
    // There is only one Night Raid home now: the builder. Keeping the legacy
    // function as an alias prevents old callers from reviving the overlapping
    // four-button read-only screen.
    const home=ui.slice(ui.indexOf('function renderHome('),ui.indexOf('function totalPaid('));
    assert.truthy(home.includes('return renderBuilder()'));
    assert.falsy(home.includes('nr-home-stage'));
    assert.falsy(home.includes('nr-home-fabs'));
  });
  test('the builder offers a landscape rotate that never breaks panning',()=>{
    // iOS cannot lock orientation from a web app, so NGANG rotates the whole
    // builder 90deg in CSS; pan deltas are remapped so dragging still follows
    // the finger. The bottom bar is the app's, and the farm leaves it alone.
    assert.truthy(ui.includes('nrRotateBuilder'));
    assert.truthy(ui.includes('builderRotated'));
    assert.truthy(css.includes('.nr-builder.rotated'));
    assert.truthy(css.includes('rotate(90deg) translateY(-100%)'));
    assert.truthy(ui.includes('viewport.scrollLeft=builderGesture.left-dy'),'rotated pan must swap axes');
    assert.falsy(ui.includes('setNav('),'a tab must not hide the bottom bar in any orientation');
  });
});

suite('farm: mobile UX and accessibility',()=>{
  test('phone, iPad, landscape, safe area and dynamic viewport contracts exist',()=>{
    for(const token of ['100dvh','safe-area-inset-top','min-width:768px','overscroll-behavior'])assert.truthy(css.includes(token),token);
  });
  test('controls are touch sized and keyboard focus is visible',()=>{
    assert.truthy(css.includes('min-height:48px')||css.includes('min-height:52px'));
    assert.truthy(css.includes(':focus-visible'));
  });
  test('reduced motion and hidden tabs reduce work',()=>{
    assert.truthy(css.includes('prefers-reduced-motion:reduce'));
    assert.truthy(ui.includes('if(document.hidden'),'timers stop while the tab is hidden');
  });
  test('live status stays in DOM',()=>{
    assert.truthy(ui.includes('aria-live="polite"'));
    assert.truthy(ui.includes('role="status"'));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
