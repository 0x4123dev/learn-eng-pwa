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
    const m = ui.match(/walk=`([^`]*pet-walk[^`]*)`/);
    assert.truthy(m, 'the yard pet atlas url must be built in one place');
    assert.truthy(m[1].startsWith('/img/'), 'the atlas url must be root-absolute, got: ' + m[1]);
    assert.truthy(css.includes('var(--nr-pet-walk)'), 'the sprite still reads the walk variable');
    assert.truthy(css.includes('var(--nr-pet-actions)'), 'the sprite still reads the action variable');
    for (const atlas of ['pet-walk-small-v1.png', 'pet-walk-large-v1.png','pet-actions-small-v2.png','pet-actions-large-v2.png']) {
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
    for (const rule of ['.nr-yard-poops{', '.nr-yard-poop{', '.nr-yard-clean{', '@keyframes nr-poop-drop'])
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
    for(const asset of ['pet-actions-small-v2.png','pet-actions-large-v2.png'])assert.truthy(fs.existsSync(path.join(root,'img/night-raid',asset)),asset);
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
    assert.truthy(css.includes("raider-actions-v2.webp"),'the home parade reuses the authored animated soldier atlas');
    assert.truthy(css.includes("raider-walk-v3.png"),'marching uses the dedicated six-frame locomotion atlas');
    assert.truthy(css.includes('aspect-ratio:1.5'),'soldier boxes preserve the authored 3:2 frame instead of squashing the body');
    assert.falsy(css.includes('aspect-ratio:2.25'),'the old wide, flattened soldier frame must not return');
    assert.truthy(css.includes('.nr-home-soldier::after{'),'a separate contact shadow seats each raised soldier on the grass');
    assert.truthy(css.includes('drop-shadow(0 .48cqw .28cqw'),'the sprite body has a deeper layered shadow for readable 3D separation');
    assert.truthy(ui.includes("%6"),'the six authored gait frames all play');
    assert.truthy(sw.includes("'/img/night-raid/animation/raider-actions-v2.webp'"),'the homepage parade remains visible offline');
    assert.truthy(sw.includes("'/img/night-raid/animation/raider-walk-v3.png'"),'the walk cycle remains visible offline');
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
  test('the compact home HUD keeps soldier count between defense and coins',()=>{
    assert.truthy(/nr-builder-power damage[\s\S]*nr-builder-power defense[\s\S]*nr-builder-power soldiers[\s\S]*nr-builder-power coins/.test(ui));
    assert.falsy(css.includes('.nr-builder-power.soldiers{display:none}'),'phones must not hide the real soldier count');
  });
  test('Home shows the evolving dog; the castle yard moves to the Arena header',()=>{
    const home=read('js/home.js');
    const arena=read('js/petbattle.js');
    assert.falsy(home.includes('NightRaid.mountYardScene'),'Home must never replace the close-up dog with a castle yard');
    assert.truthy(home.includes("stage_el.classList.remove('yard-mode')"),'the old full-yard stage mode must be removed');
    assert.truthy(home.includes('<div class="pet-wrapper">')&&home.includes('${petArtHTML}'),
      'Home must render the live SVG dog and its level accessories');
    assert.truthy(arena.includes('id="pbArenaYard"')&&arena.includes('NightRaid.mountYardScene(host'),
      'the same living castle yard belongs in the Arena header');
    assert.truthy(arena.includes('onclick="pbShowDogInfo()"')&&arena.includes('aria-modal="true"'),
      'Arena info opens the accessible dog power dialog');
    assert.falsy(arena.includes('class="pb-arena-pet-id"'),'the redundant dog name/level box must not cover the garden');
    assert.falsy(arena.includes('pbArenaZoom')||arena.includes('_pbBindArenaYardZoom'),'Arena keeps one stable camera without pinch or button zoom');
    assert.truthy(ui.includes('function mountYardScene(host,opts)'),'one walk, mounted where it is asked for');
    assert.truthy(ui.includes('isometric-home-board-unified-gate-v3.webp'),'Arena uses the rectangular yard, not the old square board');
    assert.truthy(ui.includes("paintEquippedCastle('nrMiniCastle')"),'Arena paints the equipped castle skin');
    assert.truthy(ui.includes('style="${mapStyle}"'),'castle uses the saved map anchor in Arena too');
    assert.truthy(ui.includes('function yardBuildingsHtml()'),'Arena paints the real bought-building layout');
    assert.truthy(ui.includes('+yardBuildingsHtml()+yardPetHtml'),'farms, barracks and defenses mount under the living actors');
    assert.truthy(ui.includes("res.data?.home?.layout"),'homepage refreshes the authoritative server home');
    assert.truthy(ui.includes("skipRefresh:true"),'the server refresh remounts once without a request loop');
    assert.truthy(css.includes('.nr-mini-map .nr-home-layout{pointer-events:none}'),'visible buildings do not steal header gestures');
    assert.truthy(css.includes('.nr-mini-map .nr-home-layout em{display:none}'),'Arena header hides construction-tier bubbles');
    assert.truthy(css.includes('.nr-mini-map .nr-yard-pet{width:clamp(34px,10cqw,64px)}'),'Arena pet stays proportional to farms and defenses');
    assert.truthy(ui.includes('function startPetPatrol(map)')&&ui.includes('startPetPatrol(activeMap)'),'the patrol is explicitly attached to the newly rendered visible map');
    assert.truthy(ui.includes("document.querySelector('.screen.active .nr-builder-map')"),'visibility resume may only discover a map inside the active screen');
    assert.falsy(ui.includes("petPatrolRoot||document.querySelector('.nr-builder-map')"),'a stale hidden Arena dog must never steal the Night Raid timer');
    assert.truthy(css.includes('.pb-arena-pet-hero'),'Arena gives the moved yard a bounded header card');
    assert.truthy(css.includes('.pb-arena-info'),'the dog information target is visually explicit');
    assert.falsy(css.includes('.pb-arena-zoom')||css.includes('--pb-yard-zoom'),'removed Arena zoom leaves no stale controls or transform variables');
    assert.truthy(css.includes("url('../img/night-raid/castle-grounds-river-mountains-v2.webp')"),'Arena continues into a matching river-and-mountain landscape outside the estate');
    assert.truthy(css.includes('.pb-arena-yard .nr-mini-map>.nr-board-art{clip-path:polygon('),'Arena masks the cream studio backdrop around the garden art');
    assert.truthy(css.includes('mix-blend-mode:darken'),'remaining pale source pixels blend into the endless meadow instead of showing as white seams');
    assert.truthy(arena.includes('class="pb-arena-info"')&&arena.includes('<svg viewBox="0 0 24 24" aria-hidden="true">'),'Arena uses a polished vector information icon instead of a plain text glyph');
    assert.truthy(css.includes('aspect-ratio:4/3'),'the yard must preserve the source art ratio');
    assert.truthy(css.includes('.nr-mini-map>.nr-equipped-castle{left:calc(var(--nr-castle-x,50)*1%)'),'castle feet follow the same coordinate system as the paving');
    // Pinning that whole declaration verbatim meant any change to the castle —
    // its size, its stacking — failed here for no reason. These are the parts
    // that carry meaning.
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
    assert.truthy(ui.includes('yardPetHtml({showName:false})'),'homepage omits the moving dog name from markup');
    assert.truthy(ui.includes('preloadPetAtlases(sprite)'),'idle sprites load before the first stop');
    assert.truthy(ui.includes("pet.dataset.atlas=walking||!actionsReady?'walk':'actions'"),'the walk frame remains visible while the action atlas is loading');
    assert.truthy(css.includes('.nr-yard-pet-sprite::before,.nr-yard-pet-sprite::after'),'walk and idle atlases remain mounted together');
    // The flag has to arrive through a call the app already makes.
    assert.truthy(read('functions/api/coins.js').includes('bot: !!(me && me.allow_bot)'));
    assert.truthy(read('js/auth.js').includes('appState.allowBot = !!r.data.flags.bot'));
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
    for(const token of ['isometric-home-board-frame-v4.png','nrEquippedCastle','paintEquippedCastle()','nrToggleBuilderGrid()','nr-builder-power damage','nr-builder-power defense'])assert.truthy(ui.includes(token)||css.includes(token),token);
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
    for(const token of ['nr-builder-zoom','nrZoomBuilder','touch-action:none','nr-builder-shop-fab','movePlacedItem','builderZoomBounds','chụm hai ngón để thu phóng'])assert.truthy(ui.includes(token)||css.includes(token),token);
    assert.truthy(ui.includes('ESTATE_MIN_ZOOM=.03,ESTATE_MAX_ZOOM=4'),'pinch zoom must range from distant estate to close inspection');
    assert.truthy(css.includes('endless-meadow-tile-v2.jpg')&&css.includes('background-repeat:repeat'),'space inside and beyond the fence must use the same endless grass texture');
    assert.truthy(ui.includes("plane.className='nr-world-plane'")&&ui.includes('plane.appendChild(map)'),'the meadow and estate must stay inside one real camera plane while zooming and panning');
    assert.truthy(ui.includes('setBuilderZoom(builderZoom)'),'persisted zoom must be re-clamped on open and rotation');
    assert.truthy(ui.includes("pointerdown=\"nrBeginPlacedDrag"));
    assert.truthy(css.includes('.nr-builder-hud{position:absolute')&&css.includes('top:10px'),'the app owns the safe area once; the battle HUD stays at the top of its screen');
    assert.truthy(css.includes('.nr-home-stage>.nr-home-fabs')&&css.includes('top:66px;display:flex'),'home actions form a compact top row instead of a middle-screen rail');
  });

  test('the equipped castle drags only in edit mode and the real pet patrols it',()=>{
    for(const token of ['beginCastleDrag','castleCell','footprintFor','nr-pet-patrol','yardPetHtml()','pet-walk-${pet.atlas}-v1.png','startPetPatrol','data-nr-yard-pet','dataset.x','state.vx*=-1','--nr-castle-x'])assert.truthy(ui.includes(token)||css.includes(token),token);
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
    for(const asset of ['img/night-raid/training-barracks.png','img/night-raid/rice-field.png','img/night-raid/tomato-field.png','img/night-raid/fish-pond.png','img/night-raid/isometric-home-board-frame-v4.png','img/night-raid/endless-meadow-tile-v2.jpg'])assert.truthy(fs.existsSync(path.join(root,asset)),asset);
    assert.truthy(sw.includes("'/img/night-raid/isometric-home-board-frame-v4.png'")&&sw.includes("'/img/night-raid/endless-meadow-tile-v2.jpg'"),'the unified estate remains available offline');
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
    assert.truthy(phaser.includes("raider-walk-v3.png"),'six-frame raider walk atlas');
    assert.truthy(phaser.includes("pet-actions-'+petAtlas+'-v2.webp"),'breed action atlas');
    assert.truthy(phaser.includes("actor.sprite.setTexture(p.texture,p.prefix+p.frame)"),'runtime swaps between walk and action frames');
    assert.truthy(phaser.includes("texture='nr-squad-walk'"),'moving soldiers use the dedicated walk cycle');
    assert.truthy(phaser.includes('squadWalkAnchors'),'walk frames share a stable torso anchor instead of teleporting sideways');
    assert.truthy(phaser.includes('squadActionAnchors'),'the march-to-attack texture swap preserves the same anchor');
    assert.truthy(phaser.includes('actor.height*1.32'),'walk and attack keep one display width');
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
  test('generated battle-only atlases stay lazy while the home parade remains offline',()=>{
    const files=['pet-actions-small-v2.webp','pet-actions-large-v2.webp','defense-damage-v2.webp','economy-damage-v2.webp','castle-damage-a-v2.webp','castle-damage-b-v2.webp'];
    assert.truthy(fs.existsSync(path.join(root,'img/night-raid/animation','raider-actions-v2.webp')));
    assert.truthy(fs.existsSync(path.join(root,'img/night-raid/animation','raider-walk-v3.png')),'the dedicated walk atlas ships with the app');
    assert.truthy(sw.includes("'/img/night-raid/animation/raider-actions-v2.webp'"),'the atlas now used on Home is part of the offline shell');
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
    for(const token of ["loadAsset('squadWalk'","img=moving&&walk?walk:actions","(state==='engage'||state==='loot')?4+"])assert.truthy(game.includes(token),token);
    for(const token of ['SQUAD_WALK_ANCHORS','SQUAD_ACTION_ANCHORS',"w=h*1.32","-w*(.5+anchor)"])assert.truthy(game.includes(token),token);
    assert.truthy(css.includes('filter:none!important'),'iOS castle canvas must not use a GPU drop-shadow rectangle');
  });
  test('battle defenders use the same polished 3D assets as the home builder',()=>{
    const art=read('js/night-raid-art.js');
    for(const id of ['pebble-pup','wood-fence','stone-wall','spike-trap','water-cannon'])assert.truthy(art.includes("'"+id+"'"),id);
    assert.truthy(art.includes('preloadDefenses'));
    assert.truthy(art.includes("img/night-raid/'+id+'.webp"));
    assert.truthy(game.includes('NightRaidArt.preloadDefenses'));
  });
  test('a shielded castle hides DEF everywhere the number would show',()=>{
    const ui=read('js/night-raid.js');
    assert.truthy(ui.includes("target.shielded?'🛡️ KHIÊN':target.defense"));
    assert.equal((ui.match(/\(state\.shielded\|\|target\.shielded\)\?'🛡️ KHIÊN'/g)||[]).length,2);
    assert.truthy(ui.includes("report.result.shielded?'🛡️ KHIÊN ĐÃ CHẶN'"));
    assert.truthy(ui.includes("report.result.shielded?'🛡️ KHIÊN':(report.result.defense||'?')"));
    assert.truthy(ui.includes("lockChip(homeShieldUntil,'KHIÊN ĐÊM ĐANG BẬT"));
    assert.truthy(ui.includes("homeShieldUntil>Date.now()?'':lockChip(homeLockedUntil"));
    for(const f of ['js/night-raid-game.js','js/night-raid-phaser.js'])assert.truthy(read(f).includes("target.shielded?'Khiên Đêm':this.result.defense"),f);
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
  test('a bot raid fields exactly the soldiers the child produced — none are lent',()=>{
    // Bot practice used to add a floor of 4 free soldiers on top of the real
    // stock. The HUD then read 6 against a bot and 2 against a real home for
    // the same army, and a parent counting soldiers could not tell where the
    // other four went. Both modes now show the produced count.
    const botBlock=ui.slice(ui.indexOf('function makeBotTarget'),ui.indexOf('function scoutBot'));
    assert.falsy(/attackerSoldiers\s*=/.test(botBlock),'the bot target must not set its own soldier count');
    assert.equal((ui.match(/4\+Math\.max\(0,mine\.soldiers\)/g)||[]).length,0,'no soldier floor may come back');
    assert.falsy(/\d\s*\+\s*Math\.max\(0,\s*(mine|army)\.soldiers\)/.test(ui),'no lending in any shape');
    // scout() is what fills the number in, from the honest produced count.
    assert.truthy(ui.includes('target.attackerSoldiers=Number.isFinite(+target.attackerSoldiers)'),
      'scout must fall back to the produced count when the target carries none');
    // Không còn trừ lính sau trận: lính là quân thường trực.
    assert.falsy(/soldiers\s*-\s*soldiersUsed/.test(ui),'trận đánh bot vẫn đang trừ lính khỏi kho');
  });
  test('the castle has structural stages, persistent crater and projectile trails',()=>{
    const art=read('js/night-raid-art.js');
    assert.truthy(art.includes('const damage=ratio<=0?4'));
    assert.truthy(art.includes('Deep crater'));
    assert.truthy(art.includes('drawProjectile'));
  });
  test('all castle renderers stay free of the artificial black ground shadow',()=>{
    const art=read('js/night-raid-art.js');
    const skins=read('js/castle-skins.js');
    const arena=read('js/petbattlegame.js');
    assert.falsy(art.includes("ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(0,4,98,15"));
    assert.falsy(skins.includes("ctx.fillStyle='rgba(15,23,42,.18)'; ctx.beginPath(); ctx.ellipse(w/2,h-12"));
    assert.falsy(arena.includes("ctx.fillStyle = 'rgba(15,23,42,.34)'"));
    assert.truthy(css.includes('.nr-equipped-castle{filter:none!important;box-shadow:none!important}'));
  });
});

suite('night raid: the fight is framed, the board keeps its shape, the feet do not slide',()=>{
  const phaserSrc=read('js/night-raid-phaser.js'),choreo=read('js/night-raid-choreo.js');
  test('TIẾN QUÂN fits the whole 800-board to the screen and the Phaser camera frames the fight inside it',()=>{
    // Scout opens fitted (not at the home zoom, which showed a third of the
    // board with the castle cut off), TIẾN QUÂN re-fits, and the world
    // camera centres on the enemy field rather than on the child's own keep.
    assert.truthy(ui.includes('function scoutFitZoom(base)'));
    assert.truthy(ui.includes('builderZoom=scoutFitZoom(mapBase)'),'scout opens at the fit zoom');
    assert.truthy(ui.includes('function frameBattleWorld()'));
    const raidBlock=ui.slice(ui.indexOf('async function startRaid'),ui.indexOf('function updateHud'));
    assert.truthy(raidBlock.includes('frameBattleWorld();'),'the tap re-frames the board before Phaser loads');
    assert.truthy(ui.includes("scoutMap?{left:20,top:23,width:60,height:60}:castleFootprint(appState.nightRaidLayout)"),'scout centres on the field, not the home castle cell');
    // The real camera lives in Phaser: a pure frame function plus smoothing.
    assert.truthy(phaserSrc.includes('function cameraFrame(ch,T)'));
    assert.truthy(phaserSrc.includes('cam.setZoom(this.cam.zoom);cam.centerOn(this.cam.x,this.cam.y)'));
    assert.truthy(phaserSrc.includes('scene.cameras.main.setBounds(0,0,SIZE,SIZE)'),'the view never leaves the board');
    assert.truthy(phaserSrc.includes('1-Math.exp(-dtMs/CAMERA_TAU_MS)'),'frame-rate independent smoothing');
    assert.falsy(phaserSrc.includes('zoomTo(1.065'),'the token zoom nudge is gone; the camera does the push-in');
  });
  test('the scout/battle board stays square across the tap, and the raid keeps its own zoom bucket',()=>{
    assert.truthy(ui.includes("aspect=map.classList.contains('nr-scout-map')?1:.75"),'setBuilderZoom must not force the 4:3 estate height on the 800x800 board');
    assert.truthy(ui.includes('map.style.height=Math.round(base*aspect*newZoom)'));
    assert.truthy(ui.includes('builderZoomByView[viewKey(view)]=builderZoom'));
    assert.truthy(css.includes('.nr-scout-canvas{position:absolute;inset:0;width:100%;height:100%'));
  });
  test('legs, dust and boot sounds follow ground covered; swings follow the blow schedule; death is a tween',()=>{
    assert.truthy(choreo.includes('function odometer(unit, t)'));
    assert.truthy(choreo.includes("ease = 'ramp'"),'every march segment ramps');
    assert.truthy(phaserSrc.includes('C.odometer(u,T)/(actor.pet?STRIDE*1.15:STRIDE)'),'walk phase from distance, not wall time');
    assert.truthy(phaserSrc.includes('frame=Math.floor(cycle*squadWalkCols)%squadWalkCols'));
    assert.falsy(/Math\.floor\(\(T\+actor\.index\*91\)\/\(rushing\?82:112\)\)/.test(phaserSrc),'the wall-clock leg cycle must not return');
    assert.truthy(phaserSrc.includes('const step=Math.floor(p.cycle*2);if(step!==actor.dustTick)'),'dust on foot-down only');
    assert.truthy(phaserSrc.includes('if(since<120){frame=5;strike=1-since/120;}')&&phaserSrc.includes('else if(next<200){frame=4;'),'wind-up before the hit, contact after it');
    assert.falsy(phaserSrc.includes('/190)%2'),'no 190 ms frame flip unrelated to the blows');
    assert.truthy(phaserSrc.includes('const fp=clamp((T-u.fallAt)/300,0,1);')&&phaserSrc.includes('angle=(actor.index%2?1:-1)*16*fp'),'300 ms hop/tip/squash on death');
    assert.falsy(phaserSrc.includes("if(pose.state==='fallen')y+=5;"),'no y+=5 teleport onto the fallen frame');
    assert.truthy(phaserSrc.includes('function separate(points'),'a separation pass keeps the gate crowd apart');
    assert.truthy(phaserSrc.includes('this.castleBack')&&phaserSrc.includes('castleStageAt(T)')&&phaserSrc.includes('castlePlace(stage)'),'the ruin crossfades and is placed by per-frame anchors');
    assert.truthy(phaserSrc.includes("event.type==='gatehit'"),'blows on the door spark');
  });
  test('polish: status pill speaks Vietnamese, the popup coin is a stroke icon on one line, a lost /finish is retried',()=>{
    assert.truthy(ui.includes("status.textContent='Đang dàn quân…'"));
    assert.falsy(ui.includes('Phaser…'),'the engine name must not leak into the status pill');
    assert.truthy(css.includes('.nr-result-pop .nr-reward svg,.nr-result-pop .nr-result-crest svg{fill:none;stroke:currentColor'));
    assert.truthy(css.includes('.nr-result-pop .nr-reward svg{width:22px;height:22px;flex:0 0 auto}'));
    assert.truthy(css.includes('.nr-result-pop .nr-reward{font-size:16px;padding:8px 14px;white-space:nowrap}'));
    // /start wrote the row (the visit is spent); a failed /finish used to lose
    // the result for good. The raidId is kept and asked about on the next open.
    assert.truthy(ui.includes('rememberPendingRaid(target.raidId)'));
    assert.truthy(ui.includes('async function retryPendingFinish()'));
    assert.truthy(ui.includes('retryPendingFinish().catch(()=>{})'),'open() retries');
    const fin=ui.slice(ui.indexOf('async function finishOnline'),ui.indexOf('async function finishOnline')+900);
    assert.truthy(fin.includes('clearPendingRaid(target.raidId);claimVerified(target.raidId,verified)'),'a verified finish clears the pending raid and claims exactly once');
    assert.truthy(read('js/app.js').includes('appState.nightRaidPending'),'the field is part of the saved state');
  });
});
