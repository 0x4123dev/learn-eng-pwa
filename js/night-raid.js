// Castle Night Raid product UI. One combat mode, two target sources:
// local training homes (Phase 1) and server snapshots (Phase 2).
var NightRaid = (() => {
  'use strict';

  // The build screen opens at 60% of the board's own size. At 100% a phone
  // showed roughly a ninth of the 144 land cells and a child had to pan around
  // to find their own castle; at 60% the whole base is a short swipe wide and a
  // land cell is still about 61 x 48 css px, above the ~44px a fingertip needs.
  const BUILDER_START_ZOOM=.6;
  // Zooming out further is allowed to letterbox the board — on the build screen
  // seeing the edges of your land is useful, not a mistake.
  const BUILDER_MIN_ZOOM=.45;

  let game=null,previewGame=null,productionTicker=null,petPatrolTimer=null,petPatrolState=null,armyParadeTimer=null,armyParadeState=null,view='home',selectedBuild='wood-fence',builderEditing=false,builderShopOpen=false,builderDrag=null,builderScroll=null,builderScrollByView={home:null,builder:null},builderZoom=1,builderZoomByView={home:1,builder:BUILDER_START_ZOOM},builderRotated=false,builderGesture=null,builderSuppressClick=false,builderSuppressShopClick=false,pendingBuildPurchase=null,liveTargets=[],raidReports=[],homeLockedUntil=0;
  const VI={
    title:'Cướp Đêm Lâu Đài',home:'Nhà Cướp Đêm',raid:'CƯỚP ĐÊM',
    build:'Xây Nhà',live:'Nhà người chơi',back:'Quay lại',
  };
  const esc=value=>String(value==null?'':value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
  const svg=(name)=>{
    const p={moon:'<path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/>',castle:'<path d="M4 21V9l3 2V6l3 2V3h4v5l3-2v5l3-2v12H4Z"/><path d="M9 21v-5a3 3 0 0 1 6 0v5M7 13h2m6 0h2"/>',map:'<path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3V6Z"/><path d="M8 3v15m8-12v15"/>',hammer:'<path d="m14 5 5 5M12 7l5 5M4 20l9-9-4-4-5 5v8Z"/><path d="m13 3 8 8-3 3-8-8 3-3Z"/>',people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',play:'<path d="m8 5 11 7-11 7V5Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',coin:'<circle cx="12" cy="12" r="9"/><path d="M14.5 8.5c-.6-.5-1.4-.8-2.5-.8-1.6 0-2.7.8-2.7 2s1 1.7 2.7 2c1.7.4 2.7.8 2.7 2s-1.1 2.1-2.8 2.1c-1.2 0-2.2-.4-2.9-1M12 6v12"/>',shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'};
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${p[name]||p.info}</svg>`;
  };

  function root(){return document.getElementById('nightRaidScreen');}
  // Accounts created between the garden shipping and this fix already have that
  // bot base saved. It is recognisable: the exact set of buildings the seed
  // makes, every one at tier 1, and not a single farm or barracks — nothing a
  // child could arrive at by buying, since buying starts at the shop and the
  // shop sells producers too. Anything that fails that test is somebody's real
  // base and is left alone.
  function seededBaseSignature(cells){
    const counts={};
    for(const c of cells){
      const def=NightRaidRules.defenseById(c.type);
      if(!def||def.producer||(+c.tier||1)!==1)return null;
      counts[c.type]=(counts[c.type]||0)+1;
    }
    return Object.keys(counts).sort().map(k=>k+':'+counts[k]).join(',');
  }
  let _seedSignature=null;
  function dropSeededBase(layout){
    const cells=Array.isArray(layout&&layout.cells)?layout.cells:[];
    if(!cells.length)return layout;
    if(_seedSignature===null)_seedSignature=seededBaseSignature(NightRaidRules.normalizeLayout(NightRaidRules.trainingTarget(4).layout).cells)||'';
    if(!_seedSignature||seededBaseSignature(cells)!==_seedSignature)return layout;
    return Object.assign({},layout,{cells:[]});
  }
  function ensure(){
    if(typeof appState==='undefined'||!appState)return null;
    if(!Number.isFinite(+appState.nightRaidRouteLevel))appState.nightRaidRouteLevel=1;
    if(!appState.nightRaidStars||typeof appState.nightRaidStars!=='object')appState.nightRaidStars={};
    if(!Array.isArray(appState.nightRaidHistory))appState.nightRaidHistory=[];
    // A new account starts with an empty lawn and its castle. It used to be
    // handed trainingTarget(4) — a BOT's base, eleven walls, traps and pups it
    // never bought and 457 DEF it never earned. That was invisible while the
    // garden was admin-only; the moment the garden shipped to everyone, every
    // child opened the app to a fort someone else built.
    if(!appState.nightRaidLayout)appState.nightRaidLayout={cells:[]};
    appState.nightRaidLayout=NightRaidRules.normalizeLayout(dropSeededBase(appState.nightRaidLayout));
    if(!Number.isFinite(+appState.vaultCoins))appState.vaultCoins=0;
    if(!Array.isArray(appState.battleTeammates))appState.battleTeammates=[];
    if(appState.nightRaidRewardDate!==today()){appState.nightRaidRewardDate=today();appState.nightRaidRewardToday=0;appState.nightRaidTicketCount=0;}
    if(!Number.isFinite(+appState.nightRaidRewardToday))appState.nightRaidRewardToday=0;
    if(!Number.isFinite(+appState.nightRaidTicketCount))appState.nightRaidTicketCount=0;
    return appState;
  }
  function save(){try{if(typeof saveUserData==='function'&&typeof currentUser!=='undefined'&&currentUser)saveUserData(currentUser,appState);}catch(e){}}
  function shell(body,title=VI.title){return `<div class="nr-shell"><header class="nr-topbar"><button class="nr-icon-btn" type="button" onclick="closeNightRaid()" aria-label="Đóng Cướp Đêm">${svg('close')}</button><div><span class="nr-kicker">CASTLE NIGHT RAID</span><h1>${esc(title)}</h1></div><div class="nr-wallet" aria-label="Số xu hiện có">${svg('coin')}<strong data-nr-coins>${Math.max(0,Math.floor(+appState.coins||0))}</strong></div></header>${body}<div id="nrLive" class="sr-only" aria-live="polite"></div></div>`;}
  function cleanup(){if(game){game.destroy();game=null;}if(previewGame){previewGame.destroy();previewGame=null;}if(productionTicker){clearInterval(productionTicker);productionTicker=null;}if(petPatrolTimer){clearInterval(petPatrolTimer);petPatrolTimer=null;}if(armyParadeTimer){clearInterval(armyParadeTimer);armyParadeTimer=null;}}
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.hidden){if(petPatrolTimer){clearInterval(petPatrolTimer);petPatrolTimer=null;}if(armyParadeTimer){clearInterval(armyParadeTimer);armyParadeTimer=null;}}else if(view==='home'||view==='builder'){startPetPatrol();startArmyParade();}});
  function ownPower(){return NightRaidRules.combatPower(appState.nightRaidLayout,appState.dogLevel||1,appState.battleTeammates,appState.nightRaidLayout?.soldiers||0);}
  function raidPetDescriptor(){
    const level=Math.max(1,+appState.dogLevel||1),stage=typeof getDogStage==='function'?getDogStage(level):{stageCss:'chihuahua',minLevel:1,name:'Chihuahua'};
    const breeds=['chihuahua','pomeranian','beagle','corgi','bulldog','husky','retriever','shepherd','rottweiler','tibetan-mastiff'],breedIndex=Math.max(0,breeds.indexOf(stage.stageCss)),atlas=breedIndex<5?'small':'large',cell=breedIndex%5;
    return {level,name:appState.petName||stage.name,breed:stage.name,atlas,cell};
  }
  function makeBotTarget(){
    const mine=ownPower(),damage=mine.damage,targetRatio=.78+Math.random()*.34;
    const candidates=Array.from({length:20},(_,i)=>NightRaidRules.trainingTarget(i+1));
    candidates.sort((a,b)=>Math.abs(a.defense-damage*targetRatio)-Math.abs(b.defense-damage*targetRatio));
    const target={...candidates[0],id:'bot-'+Date.now(),botMode:true,title:{en:'Bot Patrol Home',vi:'Nhà Bot Tuần Tra'}};
    target.reward=Math.max(20,Math.min(60,20+Math.floor(target.defense/45)*10));
    // Bot practice only: 4 test soldiers always march with the dog, and the
    // real barracks stock joins ON TOP (capped at the squad limit). Online
    // raids against real homes keep the honest produced count.
    target.attackerSoldiers=Math.min(NightRaidRules.MAX_SOLDIERS,4+Math.max(0,mine.soldiers));
    return target;
  }
  function scoutBot(){return scout(1,makeBotTarget(),false);}

  function open(){ensure();cleanup();view='home';if(typeof switchScreen==='function')switchScreen('nightRaidScreen');renderHome();refreshHome();}
  function close(){cleanup();setNav(false);if(typeof switchScreen==='function')switchScreen('petBattleScreen');if(typeof renderPetBattle==='function')renderPetBattle();}
  function renderHome(){cleanup();setNav(false);view='home';applyViewZoom(view);ensure();const r=root();if(!r)return;
    // The Night Raid home IS the child's island, exactly like the builder:
    // full-screen board with the equipped castle and every placed building,
    // the same DAM/DEF/LINH/coin chips, and the actions as SHOP-style fabs
    // floating on top. Read-only: buildings do not drag here.
    const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout);appState.nightRaidLayout=layout;
    const homeLevel=NightRaidRules.homeLevel(layout,appState.dogLevel||1,appState.battleTeammates),power=ownPower(),skin=typeof CastleSkins!=='undefined'?CastleSkins.get(appState.petBattleCastleSkin):null,production=layout.cells.filter(c=>NightRaidRules.defenseById(c.type)?.producer),ready=production.filter(c=>c.readyAt<=Date.now()).length;
    const cellMap=new Map(layout.cells.map(c=>[gridKey(c),c]));
    const still=(cell,layer)=>{if(!cell)return'';const def=NightRaidRules.defenseById(cell.type),size=NightRaidRules.footprintFor(def);return `<img class="nr-placed ${layer} footprint-${size} ${def.producer?'producer '+def.id:''}" src="${buildAsset(def)}" draggable="false" alt="${esc(def.name.vi)} cấp ${cell.tier}" oncontextmenu="return false"><em>${cell.tier}</em>${productionBadge(cell)}`;};
    let grid='';for(let gy=0;gy<NightRaidRules.BUILD_GRID;gy++){for(let gx=0;gx<NightRaidRules.BUILD_GRID;gx++){const stand=cellMap.get(gx+':'+gy+':stand'),floor=cellMap.get(gx+':'+gy+':floor');if(!stand&&!floor)continue;grid+=`<div class="nr-build-grid-cell has-stand" data-gx="${gx}" data-gy="${gy}" style="grid-area:${gy+1}/${gx+1}">${still(floor,'floor')}${still(stand,'stand')}</div>`;}}
    const mapBase=builderMapBase(),mapSize=Math.round(mapBase*builderZoom),mapHeight=Math.round(mapBase*.75*builderZoom);
    r.innerHTML=shell(`<main class="nr-builder nr-home-stage"><section class="nr-builder-world" id="nrBuilderWorld" aria-label="Lâu đài của con. Kéo một ngón để di chuyển, chụm hai ngón để thu phóng."><div class="nr-builder-map" data-base-size="${mapBase}" style="width:${mapSize}px;height:${mapHeight}px"><img class="nr-board-art" src="img/night-raid/isometric-home-board-unified-gate-v3.webp" alt="Khu vườn lâu đài hình chữ nhật có cổng chính cho đội cướp tiến vào"><img id="nrEquippedCastle" class="nr-equipped-castle" src="img/night-raid/home-castle.webp" alt="${esc((skin&&skin.name.vi)||'Castle skin đang trang bị')}"><div class="nr-home-level"><span><small>CẤP NHÀ</small><strong>${homeLevel}</strong></span><span class="nr-skin-name">${esc((skin&&skin.name.vi)||'Thành Đá')}</span></div><div class="nr-free-grid" aria-hidden="true">${grid}</div></div></section><div class="nr-builder-hud"><button class="nr-builder-home" type="button" onclick="closeNightRaid()" aria-label="Đóng Cướp Đêm">${svg('close')}</button><div class="nr-builder-power damage"><small>DAM</small><strong>${power.damage}</strong></div><div class="nr-builder-power defense"><small>DEF</small><strong>${power.defense}</strong></div><div class="nr-builder-power soldiers"><small>LÍNH</small><strong>${power.soldiers}/10</strong></div><div class="nr-builder-power coins">${svg('coin')}<strong>${Math.max(0,Math.floor(+appState.coins||0))}</strong></div></div><button class="nr-yard-clean" type="button" data-nr-clean hidden onclick="nrCleanYard()" aria-label="Dọn phân chó trong sân">🗑️<span>DỌN PHÂN</span><b>0</b></button><div class="nr-home-fabs"><button class="nr-home-fab raid" type="button" onclick="nrScoutBot()">${svg('moon')}<span>CƯỚP ĐÊM</span></button><button class="nr-home-fab" type="button" onclick="nrShowLiveTargets()">${svg('people')}<span>NHÀ THẬT</span></button><button class="nr-home-fab" type="button" onclick="nrShowBuilder()">${svg('hammer')}<span>XÂY NHÀ</span></button><button class="nr-home-fab" type="button" onclick="nrShowReports()">${svg('shield')}<span>NHẬT KÝ</span></button></div>${production.length?`<button class="nr-collect-all ${ready?'ready':''}" type="button" onclick="nrCollectResources()" ${ready?'':'disabled'}>${svg('coin')}<span><strong>${ready?'THU HOẠCH '+ready:'ĐANG SẢN XUẤT'}</strong><small>${power.soldiers}/10 lính · ${production.length} công trình</small></span></button>`:''}<div class="nr-builder-tip" role="status">Kéo để xem · chụm 2 ngón thu phóng</div>${lockChip(homeLockedUntil,'NHÀ ĐANG ĐƯỢC BẢO VỆ · KHÔNG AI CƯỚP ĐƯỢC','home')}</main>`);
    paintEquippedCastle();centerBuilderWorld();setupBuilderGestures();startProductionTicker();
  }

    // Scouting IS the battlefield, and both look like the island home: the
  // opponent's board fills the whole screen inside the same pannable world,
  // the controls float as compact chips/fabs, and TIẾN QUÂN starts the fight
  // IN PLACE on this very canvas — no screen swap, the result popup drops
  // over the final frame. Enemy DEF stays hidden until the attack begins.
  function scout(level,targetOverride,online){cleanup();view='scout';const target=targetOverride||NightRaidRules.trainingTarget(level);const r=root();if(!r)return;
    const mine=ownPower();target.attackerDamage=target.attackerDamage||mine.damage;target.attackerDefense=target.attackerDefense||mine.defense;target.attackerSoldiers=Number.isFinite(+target.attackerSoldiers)?Math.max(0,Math.min(NightRaidRules.MAX_SOLDIERS,Math.trunc(+target.attackerSoldiers))):mine.soldiers;
    const name=(target.title&&target.title.vi)||target.name||'Nhà đối thủ',locked=!!lockLeft(target.lockedUntil);
    const mapBase=typeof innerWidth!=='undefined'&&innerWidth>=768?1500:1180,mapSize=Math.round(mapBase*builderZoom);
    r.innerHTML=shell(`<main class="nr-builder nr-scout-stage" id="nrBattleRoot"><section class="nr-builder-world" id="nrBuilderWorld" aria-label="Toàn cảnh lâu đài đối thủ. Kéo một ngón để di chuyển, chụm hai ngón để thu phóng."><div class="nr-builder-map nr-scout-map" data-base-size="${mapBase}" style="width:${mapSize}px;height:${mapSize}px"><canvas id="nrScoutCanvas" class="nr-scout-canvas" width="800" height="800" aria-label="Lâu đài đối thủ, pet đội trưởng và ${target.attackerSoldiers} lính đang dàn quân"></canvas></div></section><div class="nr-builder-hud"><button class="nr-builder-home" type="button" onclick="${online?'nrShowLiveTargets()':'nrHome()'}" aria-label="${online?'Chọn nhà khác':'Về màn Cướp Đêm'}">${svg('map')}</button><div class="nr-builder-power damage"><small>DAM TA</small><strong>${target.attackerDamage}</strong></div><div class="nr-builder-power soldiers"><small>LÍNH</small><strong>${target.attackerSoldiers}</strong></div><div class="nr-builder-power defense" id="nrScoutDef" hidden><small>DEF ĐỊCH</small><strong>?</strong></div></div><div class="nr-scout-name-pill">${svg('shield')}<span>${esc(name)}${target.botMode?' · BOT NGẪU NHIÊN':''}</span></div><div class="nr-home-fabs"><button class="nr-home-fab raid" type="button" id="nrStartRaid" ${locked?'disabled hidden':''}>${svg('moon')}<span>TIẾN QUÂN</span></button>${locked?lockChip(target.lockedUntil,'NHÀ VỪA BỊ PHÁ · CƯỚP LẠI SAU','scout'):''}</div><div class="nr-scout-secret" id="nrScoutSecret" ${locked?'hidden':''}>🔒 DEF nhà địch là bí mật — tiến quân mới biết!</div><div class="nr-battle-status" id="nrBattleStatus" role="status" hidden></div><div class="nr-pop-host" data-nr-pop-host></div></main>`);
    setNav(true);
    const canvas=document.getElementById('nrScoutCanvas');previewGame=new NightRaidGame.AutoBattle(canvas,target,{reduceEffects:true,pet:raidPetDescriptor()});previewGame.start();
    builderScroll=null;centerBuilderWorld();setupBuilderGestures();startProductionTicker();
    document.getElementById('nrStartRaid').onclick=()=>{const b=document.getElementById('nrStartRaid');if(b){b.disabled=true;b.classList.add('charging');}startRaid(target,!!online);};
  }

  async function startRaid(target,online){
    if(online&&!target.raidId){const start=await api('start',{method:'POST',body:{targetId:target.targetId}});if(start.ok&&start.data&&start.data.shielded){if(typeof showToast==='function')showToast('Khiên Đêm bật đội cướp trở lại — lượt vẫn còn nguyên');return showLiveTargets();}if(start.ok&&start.data&&start.data.locked){if(typeof showToast==='function')showToast('Nhà này vừa bị phá — còn '+productionTime(lockLeft(start.data.lockedUntil))+' nữa mới cướp lại được');return showLiveTargets();}if(!start.ok||!start.data||!start.data.raid){if(typeof showToast==='function')showToast(start.data&&start.data.error||'Không thể bắt đầu raid');return;}Object.assign(target,start.data.raid);}
    const canvas=document.getElementById('nrScoutCanvas');if(!canvas)return;
    view='battle';if(previewGame){previewGame.destroy();previewGame=null;}
    const army=ownPower();target.attackerDamage=target.attackerDamage||army.damage;target.attackerSoldiers=Number.isFinite(+target.attackerSoldiers)?Math.max(0,Math.min(NightRaidRules.MAX_SOLDIERS,Math.trunc(+target.attackerSoldiers))):army.soldiers;target.defense=target.defense||NightRaidRules.combatPower(target.layout,target.dogLevel,target.teammates).defense;
    // Attacking is how the child EARNS the number: the hidden DEF chip fills
    // in, the secret pill and the one button leave, the army marches here.
    const def=document.getElementById('nrScoutDef');if(def){def.hidden=false;const strong=def.querySelector('strong');if(strong)strong.textContent=target.defense;}
    document.getElementById('nrScoutSecret')?.remove();
    document.getElementById('nrStartRaid')?.closest('.nr-home-fabs')?.remove();
    const status=document.getElementById('nrBattleStatus');if(status){status.hidden=false;status.textContent='Đang chuẩn bị đội hình Phaser…';}
    const options={pet:raidPetDescriptor(),onUpdate:updateHud,onFinish:(state,commands)=>finishRaid(target,state,commands,online)};
    // Phaser is intentionally lazy: every other app screen and the scout
    // preview keep their existing lightweight Canvas renderer. Only the
    // committed TIEN QUAN result battle pays the engine download cost.
    let phaserHost=null;
    if(typeof NightRaidPhaser!=='undefined'){
      try{
        await NightRaidPhaser.ensureRuntime();
        if(view!=='battle'||!canvas.isConnected)return;
        phaserHost=document.createElement('div');phaserHost.id='nrPhaserBattle';phaserHost.className='nr-phaser-battle';
        canvas.replaceWith(phaserHost);game=new NightRaidPhaser.AutoBattle(phaserHost,target,options);await game.start();
      }catch(error){console.warn('Night Raid Phaser fallback',error);if(game){game.destroy();game=null;}if(phaserHost&&phaserHost.isConnected)phaserHost.replaceWith(canvas);}
    }
    // A blocked/unsupported runtime must never strand a paid raid: the old
    // renderer produces the same deterministic result and reward callback.
    if(!game){game=new NightRaidGame.AutoBattle(canvas,target,options);game.start();}
    if(status)status.textContent=`Pet và ${target.attackerSoldiers} lính đang tiến quân`;
    setTimeout(()=>{if(view==='battle'&&game&&game.charge)chargeArmy();},700);
  }
  function updateHud(state){const status=document.getElementById('nrBattleStatus'),battle=document.getElementById('nrBattleRoot');if(status)status.textContent=state.status==='ready'?`Pet và ${state.soldiers||0} lính đang tiến quân`:state.status==='fighting'?'Đang chém phá cổng thành!':state.status==='won'?'Đã phá được lâu đài!':'Đội hình buộc phải rút lui';if(battle){battle.classList.toggle('is-fighting',state.status==='fighting');battle.classList.toggle('is-won',state.status==='won');battle.classList.toggle('is-lost',state.status==='lost');}}
  function chargeArmy(){if(game&&game.charge()){announce('Chó đội trưởng dẫn toàn quân tiến lên');if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate([18,25,18]);}}
  function announce(text){const live=document.getElementById('nrLive');if(live)live.textContent=text;}
  // Scout and battle are full-screen stages: the app nav sits ABOVE them in
  // the stacking order and was burying the one TIEN QUAN button. Hide it the
  // way the speed game and lessons already do, restore it on every way out.
  function setNav(hidden){const nav=document.getElementById('bottomNav');if(nav)nav.style.display=hidden?'none':'';}
  function quit(){if(!game)return renderHome();if(confirm('Rút lui khỏi phi vụ này? Tiến trình trận sẽ không được tính.')){cleanup();renderHome();}}

  function finishRaid(target,state,commands,online){const stars=state.status==='won'?1+(state.margin>=25?1:0)+(state.margin>=60?1:0):0;let reward=0,loss=0;if(!online){const soldiersUsed=Math.min(NightRaidRules.MAX_SOLDIERS,appState.nightRaidLayout?.soldiers||0);if(soldiersUsed)appState.nightRaidLayout.soldiers=Math.max(0,appState.nightRaidLayout.soldiers-soldiersUsed);if(stars){const capLeft=Math.max(0,120-appState.nightRaidRewardToday);reward=Math.min(capLeft,target.reward||20);appState.nightRaidRewardToday+=reward;appState.coins=Math.max(0,+appState.coins||0)+reward;}else{loss=Math.min(20,Math.max(0,+appState.coins||0));appState.coins=Math.max(0,(+appState.coins||0)-loss);}appState.nightRaidHistory.unshift({kind:'bot',targetId:target.id,won:!!stars,stars,reward,loss,soldiersUsed,at:Date.now()});appState.nightRaidHistory=appState.nightRaidHistory.slice(0,100);save();syncHome();}
    if(online)return finishOnline(target,state,commands);
    setTimeout(()=>renderResult(target,state,stars,reward,false,loss),450);
  }
  // Game-style ending: the battlefield STAYS on screen — the child keeps the
  // final frame (breach or retreat) as the backdrop while a victory/defeat
  // popup drops in over it, the way the big mobile games end a fight. The old
  // full-page renderer survives below as the fallback for any path where the
  // battle DOM is already gone.
  function resultActionsHTML(online){return online?`<button class="nr-primary" type="button" onclick="nrShowLiveTargets()">Cướp nhà khác</button><button class="nr-secondary" type="button" onclick="nrHome()">Về nhà</button>`:`<button class="nr-primary" type="button" onclick="nrScoutBot()">Tìm nhà bot khác</button><button class="nr-secondary" type="button" onclick="nrHome()">Về nhà</button>`;}
  function renderResult(target,state,stars,reward,online,loss=0){cleanup();view='result';
    const wrap=document.querySelector('[data-nr-pop-host]')||document.querySelector('#nrBattleRoot .nr-canvas-wrap');
    if(!wrap)return renderResultPage(target,state,stars,reward,online,loss);
    const won=state.status==='won';
    const command=document.querySelector('#nrBattleRoot .nr-auto-command');if(command)command.classList.add('hidden');
    const status=document.getElementById('nrBattleStatus');if(status)status.remove();
    const old=document.getElementById('nrResultPop');if(old)old.remove();
    const pop=document.createElement('div');pop.id='nrResultPop';pop.className='nr-result-pop '+(won?'won':'lost');pop.setAttribute('role','dialog');pop.setAttribute('aria-modal','true');pop.setAttribute('aria-label','Kết quả Cướp Đêm');
    // The banner hangs above the card edge, so the card itself must never
    // clip (overflow lives on .nr-pop-body) — or the headline loses its top.
    pop.innerHTML=`<div class="nr-pop-scrim"></div><div class="nr-pop-card"><div class="nr-pop-banner">${won?'CHIẾN THẮNG!':'THẤT BẠI'}</div><div class="nr-pop-body"><div class="nr-result-crest">${svg(won?'castle':'shield')}</div>${won?`<div class="nr-result-stars" aria-label="${stars} sao">${[1,2,3].map(i=>`<i class="${i<=stars?'on':''}" style="animation-delay:${(.25+i*.18).toFixed(2)}s"></i>`).join('')}</div>`:''}<p>${won?'DAM quân ta cao hơn DEF đối thủ — lâu đài đã bị phá và kho xu đã được mang về!':'DEF đối thủ cao hơn DAM quân ta — cả đội rút lui để bảo toàn lực lượng.'}</p><div class="nr-result-score"><div><span>DAM QUÂN TA</span><strong>${state.damage||target.attackerDamage}</strong></div><b>${won?'>':'≤'}</b><div><span>DEF NHÀ ĐỊCH</span><strong>${state.defense||target.defense}</strong></div></div>${won?`<div class="nr-reward">${svg('coin')}<span>+${reward} xu đã cướp</span></div>`:`<div class="nr-loss">-${loss} xu phí hành quân</div>`}<div class="nr-result-actions">${resultActionsHTML(online)}</div></div></div>`;
    // Let the final frame breathe for a beat before the banner drops.
    setTimeout(()=>{if(view!=='result')return;wrap.appendChild(pop);announce(won?'Phá thành thành công':'Đội hình thất bại');if(won&&typeof createConfetti==='function'){try{createConfetti();}catch(e){}}},650);
  }
  function renderResultPage(target,state,stars,reward,online,loss=0){setNav(false);const r=root();if(!r)return;const won=state.status==='won';r.innerHTML=shell(`<main class="nr-result ${won?'won':'lost'}"><div class="nr-result-crest">${svg(won?'castle':'shield')}</div><span class="nr-label">KẾT QUẢ CƯỚP ĐÊM</span><h2>${won?'PHÁ THÀNH THÀNH CÔNG!':'ĐỘI HÌNH THẤT BẠI'}</h2><p>${won?'DAM của quân ta cao hơn DEF đối thủ. Lâu đài đã bị phá và kho xu đã được mang về.':'DEF đối thủ cao hơn DAM quân ta. Cả đội đã rút lui để bảo toàn lực lượng.'}</p><section class="nr-result-score"><div><span>DAM QUÂN TA</span><strong>${state.damage||target.attackerDamage}</strong></div><b>${won?'>':'≤'}</b><div><span>DEF NHÀ ĐỊCH</span><strong>${state.defense||target.defense}</strong></div></section>${won?`<div class="nr-result-stars" aria-label="${stars} sao">${[1,2,3].map(i=>`<i class="${i<=stars?'on':''}"></i>`).join('')}</div><div class="nr-reward">${svg('coin')}<span>+${reward} xu đã cướp</span></div>`:`<div class="nr-loss">-${loss} xu phí hành quân</div>`}<div class="nr-result-actions">${resultActionsHTML(online)}</div></main>`);}

  function totalPaid(def,tier){let n=0;for(let i=1;i<=tier;i++)n+=def.price*i;return n;}
  function buildAsset(def){return 'img/night-raid/'+(def.asset||def.id+'.webp');}
  function buildStatHtml(def){const parts=[];if(def.attack)parts.push(`<b class="damage">+${def.attack} DAM</b>`);if(def.defense)parts.push(`<b class="defense">+${def.defense} DEF</b>`);if(def.producer==='soldier')parts.push('<b class="producer">1 lính/ngày · +20 DAM</b>');if(def.producer==='coins')parts.push(`<b class="producer">+${def.yield} xu/ngày</b>`);return parts.join('');}
  function productionBadge(cell){const def=NightRaidRules.defenseById(cell.type);if(!def?.producer)return'';const ready=cell.readyAt<=Date.now(),label=def.producer==='coins'?`+${def.yield} XU`:'NHẬN LÍNH';return `<span class="nr-production-badge ${ready?'ready':''}" data-ready-at="${cell.readyAt}" data-ready-label="${label}" data-producer-uid="${esc(cell.uid||'')}">${ready?label:'24:00:00'}</span>`;}
  function placedHtml(cell,layer,gx,gy){if(!cell)return'';const def=NightRaidRules.defenseById(cell.type),size=NightRaidRules.footprintFor(def);return `<img class="nr-placed ${layer} footprint-${size} ${def.producer?'producer '+def.id:''}" src="${buildAsset(def)}" draggable="false" alt="${esc(def.name.vi)}, chiếm ${size} × ${size} ô, kéo để đổi vị trí" oncontextmenu="return false" onpointerdown="nrBeginPlacedDrag(event,${gx},${gy},'${layer}')"><em>${cell.tier}</em>${productionBadge(cell)}`;}
  const CASTLE_SIZE=NightRaidRules.CASTLE_SIZE;
  const CASTLE_HOME={gx:4,gy:1};
  // The art is anchored at the BOTTOM CENTRE of its footprint, so it stands on
  // the ground it occupies and towers upward the way a castle should.
  function castlePosition(layout){const clean=NightRaidRules.normalizeLayout(layout),p=clean.castleCell||CASTLE_HOME,G=NightRaidRules.BUILD_GRID;return{x:PET_YARD.left+(p.gx+CASTLE_SIZE/2)*PET_YARD.width/G,y:PET_YARD.top+(p.gy+CASTLE_SIZE)*PET_YARD.height/G,gx:p.gx,gy:p.gy};}
  // The footprint as a percentage box on the map, shared by the drag pad and
  // the dog's no-walk rectangle.
  function castleFootprint(layout){const clean=NightRaidRules.normalizeLayout(layout),p=clean.castleCell||CASTLE_HOME,G=NightRaidRules.BUILD_GRID,cw=PET_YARD.width/G,ch=PET_YARD.height/G;return{left:PET_YARD.left+p.gx*cw,top:PET_YARD.top+p.gy*ch,width:CASTLE_SIZE*cw,height:CASTLE_SIZE*ch,gx:p.gx,gy:p.gy};}
  function castleMapStyle(layout){const p=castlePosition(layout);return`--nr-castle-x:${p.x};--nr-castle-y:${p.y};`;}
  // Root-absolute on purpose. This URL is handed to CSS as a custom property,
  // and a RELATIVE url() inside one is resolved against the stylesheet that
  // consumes it — css/styles.css — so `img/...` became `/css/img/...` and 404'd,
  // leaving the yard pet invisible while every other check looked healthy.
  function yardPetHtml(opts={}){const pet=raidPetDescriptor(),walk=`/img/night-raid/pet-walk-${pet.atlas}-v1.png`,actions=`/img/night-raid/pet-actions-${pet.atlas}-v2.png`,name=opts.showName===false?'':`<span>${esc(pet.name)}</span>`;return `<div class="nr-pet-patrol" aria-label="${esc(pet.name)}, ${esc(pet.breed)}, pet cấp ${pet.level}, đang đi tuần quanh lâu đài"><div class="nr-pet-trail" data-nr-pet-trail aria-hidden="true"></div><div class="nr-yard-pet" data-nr-yard-pet data-x="0" data-y="0" data-mode="walk" data-atlas="walk"><div class="nr-yard-pet-sprite" data-row="${pet.cell}" style="--nr-pet-walk:url('${walk}');--nr-pet-actions:url('${actions}')" aria-hidden="true"></div><b class="nr-pet-say" data-nr-pet-say hidden></b>${name}</div></div>`;}
  function armySlots(count){const cols=Math.min(5,Math.max(1,Math.ceil(count/2))),gap=4.25,slots=[];for(let i=0;i<count;i++){const row=i>=cols?1:0,col=i%cols,rowCount=row?count-cols:Math.min(count,cols);slots.push({x:(col-(rowCount-1)/2)*gap+(row?gap*.48:0),y:row*4.2,row:i%6});}return slots;}
  function yardArmyHtml(){const count=Math.max(0,Math.min(NightRaidRules.MAX_SOLDIERS,Math.trunc(+appState.nightRaidLayout?.soldiers||0)));if(!count)return'';return `<div class="nr-yard-army" data-nr-yard-army data-mode="march" aria-label="Đội hình ${count} lính đang duyệt binh trên bãi cỏ">${armySlots(count).map((s,i)=>`<i class="nr-home-soldier" data-unit="${i}" data-row="${s.row}" style="--nr-slot-x:${s.x}%;--nr-slot-y:${s.y}%;--nr-unit-position:0% ${s.row*20}%"><b aria-hidden="true"></b></i>`).join('')}</div>`;}
  function yardBuildingsHtml(){const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),cellMap=new Map(layout.cells.map(c=>[c.gx+':'+c.gy+':'+(NightRaidRules.defenseById(c.type).trap?'floor':'stand'),c]));const still=(cell,layer)=>{if(!cell)return'';const def=NightRaidRules.defenseById(cell.type),size=NightRaidRules.footprintFor(def);return `<img class="nr-placed ${layer} footprint-${size} ${def.producer?'producer '+def.id:''}" src="${buildAsset(def)}" alt="" draggable="false"><em>${cell.tier}</em>`;};let grid='';for(let gy=0;gy<NightRaidRules.BUILD_GRID;gy++)for(let gx=0;gx<NightRaidRules.BUILD_GRID;gx++){const stand=cellMap.get(gx+':'+gy+':stand'),floor=cellMap.get(gx+':'+gy+':floor');if(stand||floor)grid+=`<div class="nr-build-grid-cell" style="grid-area:${gy+1}/${gx+1}">${still(floor,'floor')}${still(stand,'stand')}</div>`;}return `<div class="nr-free-grid nr-home-layout" aria-hidden="true">${grid}</div>`;}
  const petAtlasPreloads=new Map();
  function preloadPetAtlases(sprite){
    if(!sprite||typeof Image==='undefined')return;
    const pet=raidPetDescriptor(),urls={walk:`/img/night-raid/pet-walk-${pet.atlas}-v1.png`,actions:`/img/night-raid/pet-actions-${pet.atlas}-v2.png`};
    for(const [kind,url] of Object.entries(urls)){
      let image=petAtlasPreloads.get(url);
      if(!image){image=new Image();image.decoding='async';image.src=url;petAtlasPreloads.set(url,image);}
      const ready=()=>{if(sprite.isConnected)sprite.dataset[kind+'Ready']='1';};
      if(image.complete&&image.naturalWidth)ready();else image.addEventListener('load',ready,{once:true});
    }
  }
  function trimmedCanvasUrl(canvas,padding=8){const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return canvas.toDataURL('image/png');const {width,height}=canvas,data=ctx.getImageData(0,0,width,height).data;let left=width,top=height,right=-1,bottom=-1;for(let y=0;y<height;y++){for(let x=0;x<width;x++){if(data[(y*width+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}}if(right<left)return canvas.toDataURL('image/png');left=Math.max(0,left-padding);top=Math.max(0,top-padding);right=Math.min(width-1,right+padding);bottom=Math.min(height-1,bottom+padding);const out=document.createElement('canvas');out.width=right-left+1;out.height=bottom-top+1;out.getContext('2d',{alpha:true}).drawImage(canvas,left,top,out.width,out.height,0,0,out.width,out.height);return out.toDataURL('image/png');}
  function paintEquippedCastle(targetId='nrEquippedCastle'){const image=document.getElementById(targetId);if(!image)return;const board=image.closest('.nr-builder-map')?.querySelector('.nr-board-art');if(board){board.src='img/night-raid/isometric-home-board-unified-gate-v3.webp';board.alt='Khu vườn lâu đài hình chữ nhật có cổng chính cho đội cướp tiến vào';}const skin=appState.petBattleCastleSkin||'stone-keep',render=()=>{if(!image.isConnected)return;const logicalWidth=400,logicalHeight=340,quality=(typeof devicePixelRatio!=='undefined'&&devicePixelRatio>=2)?4:3,canvas=document.createElement('canvas');canvas.width=logicalWidth*quality;canvas.height=logicalHeight*quality;const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(quality,0,0,quality,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';NightRaidArt.drawCastle(ctx,logicalWidth/2,logicalHeight-16,skin,100,100,0);try{image.src=trimmedCanvasUrl(canvas,8*quality);}catch(_){image.src='img/night-raid/home-castle.webp';}};render();if(typeof CastleSkins!=='undefined'&&CastleSkins.preload)CastleSkins.preload(render);}
  function builderMapBase(){return 1600;}
  // The build screen opens at 60%: at 100% a phone showed nine of the 144 land
  // cells at a time and a child had to pan to find their own castle. At 60% a
  // land cell is still 61 x 48 css px — above the 44px a fingertip needs — and
  // the zoom buttons and pinch still reach 165%.
  const viewKey=v=>(v==='builder'?'builder':'home');
  function zoomFor(v){return builderZoomByView[viewKey(v)];}
  function applyViewZoom(v){builderZoom=zoomFor(v);builderScroll=builderScrollByView[viewKey(v)];}
  function gridKey(cell){return cell.gx+':'+cell.gy+':'+(NightRaidRules.defenseById(cell.type).trap?'floor':'stand');}
  function buildRect(cell){const def=NightRaidRules.defenseById(cell.type);return{gx:+cell.gx,gy:+cell.gy,size:NightRaidRules.footprintFor(def),layer:def.trap?'floor':'stand'};}
  function buildSpaceFree(layout,gx,gy,size,layer,ignoreCell,includeCastle=true){
    const G=NightRaidRules.BUILD_GRID,candidate={gx:+gx,gy:+gy,size:+size};
    if(candidate.gx<0||candidate.gy<0||candidate.gx+size>G||candidate.gy+size>G)return false;
    if(includeCastle&&layer==='stand'){
      const castle=layout.castleCell||CASTLE_HOME;
      if(NightRaidRules.rectsOverlap(candidate,{gx:+castle.gx,gy:+castle.gy,size:CASTLE_SIZE}))return false;
    }
    return !layout.cells.some(cell=>cell!==ignoreCell&&buildRect(cell).layer===layer&&NightRaidRules.rectsOverlap(candidate,buildRect(cell)));
  }
  function footprintOwner(layout,gx,gy,layer){return layout.cells.find(cell=>{const box=buildRect(cell);return box.layer===layer&&gx>=box.gx&&gx<box.gx+box.size&&gy>=box.gy&&gy<box.gy+box.size;})||null;}
  function castlePadStyle(box){return `left:${box.left.toFixed(3)}%;top:${box.top.toFixed(3)}%;width:${box.width.toFixed(3)}%;height:${box.height.toFixed(3)}%`;}
  function mountCastlePad(map,layout){
    const box=castleFootprint(layout);let pad=map.querySelector('.nr-castle-pad');
    if(!pad){
      map.insertAdjacentHTML('beforeend',`<div class="nr-castle-pad" role="button" tabindex="0" aria-label="Nhà chính ${CASTLE_SIZE} × ${CASTLE_SIZE} ô — kéo để chuyển chỗ" style="${castlePadStyle(box)}"></div>`);
      pad=map.querySelector('.nr-castle-pad');
      pad.addEventListener('pointerdown',beginCastleDrag);
    } else pad.setAttribute('style',castlePadStyle(box));
    return pad;
  }
  function rememberBuilderWorld(){const viewport=document.getElementById('nrBuilderWorld');if(viewport)keepScroll({left:viewport.scrollLeft,top:viewport.scrollTop});}
  function keepScroll(at){builderScroll=at;builderScrollByView[viewKey(view)]=at;}
  function decorateCastleYard(map,editable){if(!map||map.classList.contains('nr-scout-map'))return;const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),p=castlePosition(layout),castle=map.querySelector('#nrEquippedCastle');map.style.setProperty('--nr-castle-x',p.x);map.style.setProperty('--nr-castle-y',p.y);if(castle){castle.draggable=false;castle.setAttribute('oncontextmenu','return false');if(editable){castle.setAttribute('aria-label',(castle.alt||'Nhà chính')+', bật Sửa rồi kéo trên khu vườn');if(!map.querySelector('.nr-castle-move-hint'))castle.insertAdjacentHTML('afterend','<span class="nr-castle-move-hint" aria-hidden="true">KÉO NHÀ TRÊN VƯỜN</span>');}}
    // The castle art used to carry the drag itself, and could not be grabbed at
    // all: the building grid is painted OVER it, so a finger on the keep landed
    // on an empty land cell instead. The grab handle therefore lives above the
    // grid — and is sized to the castle's GROUND, not its artwork, so the towers
    // leaning over neighbouring cells never steal a tap meant for those cells.
    if(editable)mountCastlePad(map,layout);else map.querySelector('.nr-castle-pad')?.remove();if(!map.querySelector('.nr-pet-patrol'))map.insertAdjacentHTML('beforeend',yardPetHtml());if(view==='home'&&!map.querySelector('[data-nr-yard-army]'))map.insertAdjacentHTML('beforeend',yardArmyHtml());}
  // Where the dog may NOT walk. The yard grid is .nr-free-grid — left 12%,
  // top 42%, 76%x47% of the map, twelve cells each way — so every placed
  // building maps to a rectangle in the same percentage space the pet walks
  // in. Flat floor traps are stepped over rather than walked around; anything
  // that stands up is solid. Recomputed as the child builds.
  const PET_YARD={left:12,top:10,width:76,height:80};
  // The dog is a sprite, not a dot: it is drawn translate(-50%,-100%) from its
  // feet, so its body rises about 5.4% of the map above them and spreads 2.4%
  // either side. Testing only the feet is why it still LOOKED like it walked
  // through a wall — the feet cleared the box while the body crossed it.
  const PET_BODY={halfW:2.4,height:5.4};
  // Every so often the dog stops what it is doing, walks to the rice or the
  // pond, and does the matching business. Both are now movable 2 × 2 objects,
  // so destinations are derived from their saved grid coordinates.
  const YARD_POOP_MAX=4, YARD_POOP_MIN_GAP_MS=18000, YARD_POOP_SPREAD_MS=17000, YARD_SQUAT_MS=1700, YARD_ERRAND_TIMEOUT_MS=30000;
  function yardPoops(){
    if(!Array.isArray(appState.nightRaidPoops))appState.nightRaidPoops=[];
    return appState.nightRaidPoops;
  }
  // Where the dog considers worth a visit: pee only beside a rice field and
  // poop only beside the pond. If a destination is out of reach, that action
  // is skipped instead of happening on arbitrary grass.
  function yardPoopSpots(bounds){
    const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),G=NightRaidRules.BUILD_GRID;
    const cw=PET_YARD.width/G,ch=PET_YARD.height/G,spots=[];
    for(const cell of layout.cells){
      if(cell.type!=='rice-field'&&cell.type!=='fish-pond')continue;
      const size=NightRaidRules.footprintFor(cell.type);
      // Stand at the very edge of the crop, just past where the solid box
      // ends. Aiming at the middle of the field looked right and was wrong:
      // the dog may not walk into a building, so it would have trudged toward
      // a spot it could never reach and stood there forever.
      spots.push({x:PET_YARD.left+(cell.gx+size*.5)*cw,
                  y:PET_YARD.top+(cell.gy+size)*ch+PET_BODY.height+1, what:cell.type==='rice-field'?'ruộng':'ao',kind:cell.type==='rice-field'?'pee':'poop'});
    }
    // Whatever is left must be inside the walk AND actually standable, so a
    // crowded yard simply offers fewer errands instead of jamming the dog.
    const rects=petBlockedRects();
    const reachable=spots.filter(s=>s.x>PET_YARD.left&&s.x<PET_YARD.left+PET_YARD.width&&s.y>PET_YARD.top&&s.y<PET_YARD.top+PET_YARD.height
      &&!petBlockedAt(rects,s.x,s.y));
    return reachable;
  }

  function petBlockedRects(){
    const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),G=NightRaidRules.BUILD_GRID;
    const cw=PET_YARD.width/G,ch=PET_YARD.height/G,rects=[];
    for(const cell of layout.cells){
      const def=NightRaidRules.defenseById(cell.type);
      if(!def)continue;
      const size=NightRaidRules.footprintFor(def),x=PET_YARD.left+cell.gx*cw,y=PET_YARD.top+cell.gy*ch;
      // Two inflations, for two different reasons. The sprites are drawn
      // larger than their own cell, so the box grows to what the child sees
      // standing there; then it grows again by the dog's own body, so the
      // rectangle below is exactly where its FEET may not go.
      rects.push({
        x0:x-cw*.22-PET_BODY.halfW, x1:x+cw*(size+.22)+PET_BODY.halfW,
        y0:y-ch*.22,                y1:y+ch*(size+.18)+PET_BODY.height,
      });
    }
    const castle=layout.castleCell||CASTLE_HOME,x=PET_YARD.left+castle.gx*cw,y=PET_YARD.top+castle.gy*ch;
    rects.push({x0:x-cw*.25-PET_BODY.halfW,x1:x+cw*(CASTLE_SIZE+.25)+PET_BODY.halfW,y0:y-ch*.45,y1:y+ch*(CASTLE_SIZE+.25)+PET_BODY.height});
    return rects;
  }
  function petBlockedAt(rects,x,y){for(const r of rects)if(x>r.x0&&x<r.x1&&y>r.y0&&y<r.y1)return r;return null;}
  function armyClearAt(rects,x,y,slots){return slots.every(s=>!petBlockedAt(rects,x+s.x,y+s.y));}
  function placeArmyParade(army,state,now){army.dataset.mode=state.mode;army.style.setProperty('--nr-army-x',state.x.toFixed(2)+'%');army.style.setProperty('--nr-army-y',state.y.toFixed(2)+'%');army.style.setProperty('--nr-army-dir',state.dir);army.querySelectorAll('[data-unit]').forEach((unit,i)=>{const frame=state.mode==='march'?(Math.floor(now/155)+i%2)%4:state.mode==='attention'?4:0,row=Math.max(0,Math.min(5,+unit.dataset.row||0));unit.style.setProperty('--nr-unit-position',(frame*(100/7))+'% '+(row*20)+'%');});}
  function startArmyParade(){if(armyParadeTimer){clearInterval(armyParadeTimer);armyParadeTimer=null;}const map=petPatrolRoot||document.querySelector('.nr-builder-map'),army=map&&map.querySelector('[data-nr-yard-army]');if(!map||!army)return;const units=army.querySelectorAll('[data-unit]'),count=units.length;if(!count)return;const slots=armySlots(count),rects=petBlockedRects(),now=performance.now(),reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!armyParadeState)armyParadeState={x:28,y:82,dir:1,mode:'march',until:now+6800,last:now};const state=armyParadeState;
    if(!armyClearAt(rects,state.x,state.y,slots)){let found=null;for(const y of [82,74,66]){for(let x=22;x<=78;x+=4){if(armyClearAt(rects,x,y,slots)){found={x,y};break;}}if(found)break;}if(found){state.x=found.x;state.y=found.y;}}
    if(reduced){state.mode='attention';placeArmyParade(army,state,now);return;}
    placeArmyParade(army,state,now);armyParadeTimer=setInterval(()=>{if(document.hidden||!army.isConnected)return;const t=performance.now(),dt=Math.min(.22,(t-state.last)/1000);state.last=t;
      if(t>=state.until){if(state.mode==='march'){state.mode='attention';state.until=t+1800;}else if(state.mode==='attention'){state.mode='rest';state.until=t+2600;}else{state.mode='march';state.until=t+6200+Math.random()*2600;}}
      if(state.mode==='march'){let nx=state.x+state.dir*2.7*dt;if(nx<20||nx>80||!armyClearAt(petBlockedRects(),nx,state.y,slots)){state.dir*=-1;nx=state.x;const alternatives=[82,74,66].filter(y=>y!==state.y&&armyClearAt(petBlockedRects(),state.x,y,slots));if(alternatives.length)state.y=alternatives[Math.floor(Math.random()*alternatives.length)];}state.x=nx;}
      placeArmyParade(army,state,t);
    },120);
  }
  // The same yard, shrunk into somebody else's screen. The home habitat asked
  // for this scene, and duplicating the walk would have meant two dogs with
  // two personalities drifting apart — so the patrol simply learns to run
  // inside whatever element it is given.
  let petPatrolRoot=null,yardRefreshAt=0;
  async function refreshYardHabitat(host,opts){const now=Date.now();if(now-yardRefreshAt<12000)return;yardRefreshAt=now;const before=JSON.stringify(NightRaidRules.normalizeLayout(appState.nightRaidLayout)),res=await api('home');if(!res.ok||!res.data?.home?.layout)return;appState.nightRaidLayout=NightRaidRules.normalizeLayout(res.data.home.layout);const after=JSON.stringify(appState.nightRaidLayout);if(after===before)return;save();if(host.isConnected)mountYardScene(host,Object.assign({},opts,{skipRefresh:true}));}
  function mountYardScene(host,opts){
    if(!host)return null;
    ensure();
    const skin=typeof CastleSkins!=='undefined'?CastleSkins.get(appState.petBattleCastleSkin):null;
    const mapStyle=castleMapStyle(appState.nightRaidLayout);
    host.classList.add('nr-mini-yard');
    host.innerHTML=`<div class="nr-builder-map nr-mini-map" style="${mapStyle}">`
      +`<img class="nr-board-art" src="img/night-raid/isometric-home-board-unified-gate-v3.webp" alt="" draggable="false">`
      +`<img class="nr-equipped-castle" id="nrMiniCastle" src="img/night-raid/home-castle.webp" alt="${esc((skin&&skin.name.vi)||'Lâu đài')}" draggable="false">`
      +yardBuildingsHtml()+yardPetHtml({showName:false})+yardArmyHtml()+`</div>`;
    petPatrolRoot=host.querySelector('.nr-builder-map');
    // Paint the bought skin onto a transparent canvas. The fallback asset has
    // its own square background, which looked like a sticker and could never
    // line up with the paved castle pad underneath it.
    paintEquippedCastle('nrMiniCastle');
    petPatrolState=null;
    startPetPatrol();
    armyParadeState=null;
    startArmyParade();
    if(!(opts||{}).skipRefresh)refreshYardHabitat(host,opts);
    if((opts||{}).onTap)host.querySelector('[data-nr-yard-pet]')?.addEventListener('click',opts.onTap);
    return petPatrolRoot;
  }
  function unmountYardScene(){
    if(petPatrolTimer){clearInterval(petPatrolTimer);petPatrolTimer=null;}
    if(armyParadeTimer){clearInterval(armyParadeTimer);armyParadeTimer=null;}
    petPatrolRoot=null;petPatrolState=null;armyParadeState=null;
  }
  // The dog keeps to the MIDDLE of the yard rather than roaming it corner to
  // corner. Measured on the homepage yard, as a share of the map: the garden
  // runs full-bleed to the top of the screen and the page is viewport-fit=cover,
  // so a notched phone's status bar covers the top 19.7% of it — a dog up there
  // is behind the clock. Below 71% sit the dog's name, the XP bar and the Shop
  // buttons. It used to walk the whole yard and spent much of its time at
  // y 4.7-17%, where it simply could not be seen. The dog is anchored at its
  // paws and stands PET_SPRITE_H tall, so the band is measured from where its
  // head and feet end up, not from its anchor point.
  // Measured on the homepage garden, as a share of the map: the dog is 12.3
  // tall from its paws and its speech bubble adds another 7.5 above that
  // (6.1 for the bubble, 1.3 of gap). The band is set from the top of the
  // BUBBLE, not the top of the dog — a hungry dog is exactly the one that has a
  // bubble, and at the old bound it floated at 18.5%, just inside the strip the
  // status bar covers.
  const YARD_TOP_FURNITURE=22, YARD_BOTTOM_FURNITURE=71, PET_SPRITE_H=12.3, PET_SAY_H=7.5;
  function petPatrolBounds(){
    const left=PET_YARD.left,right=PET_YARD.left+PET_YARD.width;
    const inset=PET_YARD.width*.12;
    return{
      minX:left+inset,
      maxX:right-inset,
      minY:Math.max(PET_YARD.top+3,YARD_TOP_FURNITURE+PET_SPRITE_H+PET_SAY_H),
      maxY:Math.min(PET_YARD.top+PET_YARD.height-2,YARD_BOTTOM_FURNITURE-2),
    };
  }
  // A dog that leaves nothing behind reads as sliding over the grass rather
  // than walking on it. Prints are planted where the paw actually fell and
  // fade there; dust puffs kick up from the same spot. Both are plain DOM
  // nodes on CSS animations that delete themselves — at roughly five alive at
  // a time this is far cheaper than a map-sized canvas would be.
  const PET_PRINT_MS=190, PET_DUST_MS=300;
  function spawnPetTrail(layer,state,now){
    if(!layer)return;
    // Each node deletes itself on animationend, but a tab that is backgrounded
    // mid-animation never fires one. Cap the layer so a strange state can
    // never leave a thousand paw prints behind.
    while(layer.childElementCount>26)layer.firstElementChild.remove();
    // cqw and cqh are different pixel sizes (the yard is wider than it is
    // tall), so the direction the paw points must be worked out in pixels,
    // not in the percentage units the dog walks in.
    const box=layer.getBoundingClientRect(),ratio=box.height&&box.width?(box.height/100)/(box.width/100):1;
    const angle=Math.atan2(state.vy*ratio,state.vx)*180/Math.PI;
    if(now-(state.printAt||0)>=PET_PRINT_MS){
      state.printAt=now;state.printSide=state.printSide===1?-1:1;
      const print=document.createElement('i');
      print.className='nr-pet-print';
      print.style.cssText=`left:${state.x}%;top:${state.y}%;--nr-a:${angle.toFixed(1)}deg;--nr-side:${state.printSide*.34}cqw`;
      print.addEventListener('animationend',()=>print.remove(),{once:true});
      layer.appendChild(print);
    }
    if(now-(state.dustAt||0)>=PET_DUST_MS){
      state.dustAt=now;
      const dust=document.createElement('i');
      dust.className='nr-pet-dust';
      dust.style.cssText=`left:${(state.x-state.vx*.06).toFixed(2)}%;top:${state.y}%`;
      dust.addEventListener('animationend',()=>dust.remove(),{once:true});
      layer.appendChild(dust);
    }
  }
  function dropYardPoop(at){
    const list=yardPoops();
    if(list.length>=YARD_POOP_MAX)return;
    list.push({id:'nr-poop-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      x:+at.x.toFixed(2), y:+at.y.toFixed(2), born:Date.now()});
    appState.nightRaidPoops=list;save();
    paintYardPoops();
  }
  // The poops are their own layer so a repaint of the walk trail never wipes
  // them, and so the child can tap one directly as well as use the button.
  function paintYardPoops(){
    const wrap=document.querySelector('.nr-pet-patrol');if(!wrap)return;
    let layer=wrap.querySelector('[data-nr-poops]');
    if(!layer){layer=document.createElement('div');layer.className='nr-yard-poops';layer.dataset.nrPoops='';wrap.appendChild(layer);}
    const list=yardPoops();
    layer.innerHTML=list.map(p=>`<button type="button" class="nr-yard-poop" data-poop="${esc(p.id)}" style="left:${p.x}%;top:${p.y}%" aria-label="Dọn phân chó">💩</button>`).join('');
    layer.querySelectorAll('.nr-yard-poop').forEach(b=>b.onclick=e=>{e.stopPropagation();cleanYardPoop(b.dataset.poop);});
    const fab=document.querySelector('[data-nr-clean]');
    if(fab){fab.hidden=!list.length;const n=fab.querySelector('b');if(n)n.textContent=list.length;}
  }
  function cleanYardPoop(id){
    const list=yardPoops(),before=list.length;
    appState.nightRaidPoops=id?list.filter(p=>p.id!==id):[];
    const cleared=before-appState.nightRaidPoops.length;
    if(!cleared)return;
    // Same pay as tidying up at home, so the chore is worth the same wherever
    // the child does it.
    const coins=(typeof POOP_CLEAN_COINS==='number'?POOP_CLEAN_COINS:3)*cleared;
    const xp=(typeof POOP_CLEAN_XP==='number'?POOP_CLEAN_XP:10)*cleared;
    appState.coins=Math.max(0,(+appState.coins||0)+coins);
    appState.dogGrowthXP=(+appState.dogGrowthXP||0)+xp;
    if(typeof getDogLevel==='function')appState.dogLevel=getDogLevel(appState.dogGrowthXP);
    save();paintYardPoops();
    document.querySelectorAll('[data-nr-coins],.nr-builder-power.coins strong').forEach(el=>{el.textContent=Math.max(0,Math.floor(+appState.coins||0));});
    if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(30);
    if(typeof showToast==='function')showToast('✨ Dọn sạch! +'+coins+' 🪙 +'+xp+' XP');
    announce('Đã dọn '+cleared+' bãi phân cho chó');
  }
  function spawnPetBusinessEffect(map,kind,state){const effect=document.createElement('span');effect.className='nr-pet-event '+kind;effect.setAttribute('aria-hidden','true');effect.style.left=state.x+'%';effect.style.top=state.y+'%';effect.innerHTML='<i></i><b></b>'+(kind==='pee'?'<span class="nr-pet-event-label">I&#39;m peeing</span>':'');map.appendChild(effect);setTimeout(()=>effect.remove(),4200);}
  // A dog with an empty bowl does not trot around its garden. It lies down and
  // says so, and keeps saying so until it is fed — the old bubble flashed once
  // for 2.5s at the top of the stage, where a notched phone hid it behind the
  // status bar and a child who looked a second later saw nothing at all.
  // getPetMood lives on the home screen; the yard also mounts inside the raid,
  // where it does not, so this asks carefully and assumes a fed dog otherwise.
  const HUNGRY_MOODS={starving:1,hungry:1};
  function petIsHungry(){
    try{return typeof getPetMood==='function'&&!!HUNGRY_MOODS[getPetMood()];}catch(_){return false;}
  }
  function sayHungry(pet,hungry){
    const say=pet&&pet.querySelector('[data-nr-pet-say]');
    if(!say)return;
    if(!hungry){if(!say.hidden){say.hidden=true;say.textContent='';}return;}
    if(say.hidden){say.hidden=false;}
    const line="I'm hungry… 🍖";
    if(say.textContent!==line)say.textContent=line;
  }
  function choosePetIdle(state,now){const roll=Math.random();state.mode=roll<.38?'bark':roll<.76?'rest':roll<.90?'scratch':'idle';state.casualUntil=now+(state.mode==='idle'?1700:state.mode==='bark'?3400:state.mode==='rest'?6200:2600);state.frame=0;}
  function petActionFrame(state,now){if(state.mode==='walk'||state.mode==='seek')return state.frame;if(state.mode==='bark')return Math.floor(now/240)%2;if(state.mode==='rest')return 2;if(state.mode==='scratch')return Math.floor(now/260)%2?3:2;return 0;}
  function placePatrolPet(pet,sprite,state,now=performance.now()){const row=Math.max(0,Math.min(4,+sprite.dataset.row||0)),frame=Math.max(0,Math.min(3,petActionFrame(state,now))),walking=state.mode==='walk'||state.mode==='seek',actionsReady=sprite.dataset.actionsReady==='1';pet.dataset.x=state.x.toFixed(2);pet.dataset.y=state.y.toFixed(2);pet.dataset.mode=state.mode;pet.dataset.atlas=walking||!actionsReady?'walk':'actions';pet.style.transform=`translate3d(${state.x}cqw,${state.y}cqh,0) translate(-50%,-100%)`;sprite.style.setProperty('--nr-walk-position',`${state.frame*(100/3)}% ${row*25}%`);sprite.style.setProperty('--nr-action-position',`${frame*(100/3)}% ${row*25}%`);sprite.style.transform=`scaleX(${state.vx>0?-1:1})`;}
  function startPetPatrol(){if(petPatrolTimer){clearInterval(petPatrolTimer);petPatrolTimer=null;}const map=petPatrolRoot||document.querySelector('.nr-builder-map'),pet=map&&map.querySelector('[data-nr-yard-pet]'),sprite=pet&&pet.querySelector('.nr-yard-pet-sprite'),trail=map&&map.querySelector('[data-nr-pet-trail]');if(!map||!pet||!sprite)return;preloadPetAtlases(sprite);const bounds=petPatrolBounds(),reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches,started=performance.now();if(!petPatrolState)petPatrolState={x:bounds.minX+4,y:bounds.minY+4,vx:3.4,vy:1.15,frame:0,last:started,frameAt:0,mode:'walk',casualUntil:0,nextCasual:started+2200};const state=petPatrolState;state.mode=state.mode||'walk';state.nextCasual=state.nextCasual||started+2200;state.x=Math.max(bounds.minX,Math.min(bounds.maxX,state.x));state.y=Math.max(bounds.minY,Math.min(bounds.maxY,state.y));
    state.blocked=petBlockedRects();state.blockedAt=performance.now();paintYardPoops();
    // A dog that opens the screen standing inside a barn looks like a bug, so
    // walk it out to the first clear spot along the yard.
    for(let guard=0;guard<80&&petBlockedAt(state.blocked,state.x,state.y);guard++){
      state.x+=2.5;
      if(state.x>bounds.maxX){state.x=bounds.minX;state.y+=3;}
      if(state.y>bounds.maxY)state.y=bounds.minY;
    }state.last=performance.now();if(reduced){state.mode='idle';state.frame=0;}
    if(petIsHungry()){state.mode='rest';state.frame=0;state.errand=null;}
    sayHungry(pet,petIsHungry());
    placePatrolPet(pet,sprite,state);if(reduced)return;petPatrolTimer=setInterval(()=>{if(document.hidden||!pet.isConnected)return;const now=performance.now(),dt=Math.min(.2,(now-state.last)/1000);state.last=now;const nextBounds=petPatrolBounds();
      // Hungry: lie down where it stands, say so, and stop everything else —
      // no pacing, no errands, no wandering off to a rice field.
      const hungry=petIsHungry();
      sayHungry(pet,hungry);
      if(hungry){
        if(state.mode!=='rest'){state.mode='rest';state.frame=0;state.errand=null;state.casualUntil=now+1e9;}
        placePatrolPet(pet,sprite,state,now);
        return;
      }
      if(state.casualUntil>now+1e8){state.casualUntil=0;state.mode='walk';state.nextCasual=now+900;}
      // The yard changes while the child builds, so the solid boxes are re-read
      // about once a second rather than frozen when the walk started.
      if(!state.blocked||now-state.blockedAt>1000){state.blocked=petBlockedRects();state.blockedAt=now;}
      // --- errands ------------------------------------------------------
      // A dog that only ever paces looks like a screensaver. Now and then it
      // decides on an errand, walks over, squats, and leaves a mess for the
      // child to clear up.
      if(state.squatUntil){
        if(now<state.squatUntil){placePatrolPet(pet,sprite,state);return;}
        state.squatUntil=0;
        if(state.errand?.kind==='poop')dropYardPoop(state.errand);
        state.errand=null;state.nextErrand=now+YARD_POOP_MIN_GAP_MS+Math.random()*YARD_POOP_SPREAD_MS;
        state.mode='walk';state.nextCasual=now+1800+Math.random()*1400;
        const a=Math.random()*Math.PI*2;state.vx=Math.cos(a)*3.4;state.vy=Math.sin(a)*1.15;
      }
      // Calm behaviours are intentionally separated by several seconds so
      // the home feels alive without becoming a distracting screensaver.
      if(state.casualUntil){
        if(now<state.casualUntil){placePatrolPet(pet,sprite,state,now);return;}
        state.casualUntil=0;state.mode='walk';state.nextCasual=now+1800+Math.random()*1400;
      }
      if(!state.errand&&!state.squatUntil&&now>=state.nextCasual){choosePetIdle(state,now);placePatrolPet(pet,sprite,state,now);return;}
      if(!state.nextErrand)state.nextErrand=now+YARD_POOP_MIN_GAP_MS+Math.random()*YARD_POOP_SPREAD_MS;
      if(!state.errand&&now>=state.nextErrand&&yardPoops().length<YARD_POOP_MAX){
        const spots=yardPoopSpots(nextBounds);
        if(spots.length){
          // Head for the NEAREST spot, not a random one. Picking at random
          // sent the dog on 30-second treks across the yard once it walked at
          // a believable pace — long enough to time out before arriving, and
          // long enough to turn the whole walk into one endless commute. The
          // y difference counts for more because the yard is wider than tall.
          let pick=spots[0],best=Infinity;
          for(const sp of spots){const d=Math.hypot(sp.x-state.x,(sp.y-state.y)*2.6);if(d<best){best=d;pick=sp;}}
          state.errand=pick;state.errandUntil=now+YARD_ERRAND_TIMEOUT_MS;state.mode='seek';}
        else state.nextErrand=now+YARD_POOP_MIN_GAP_MS;
      }
      // Give up on an errand it cannot reach. Steering straight at a target
      // can wedge the dog against a building it has to go around, and a dog
      // pressed against a wall forever is worse than one that changes its
      // mind: verified by walking every spot on a built-up yard, where one
      // rice field could not be reached inside 900 steps.
      if(state.errand&&now>state.errandUntil){state.errand=null;state.mode='walk';state.nextErrand=now+YARD_POOP_MIN_GAP_MS;}
      if(state.errand){
        const ex=state.errand.x-state.x,ey=state.errand.y-state.y,far=Math.hypot(ex,ey);
        if(far<1.6){state.squatUntil=now+YARD_SQUAT_MS;state.mode=state.errand.kind;state.vx=state.vx>0?.001:-.001;state.vy=0;spawnPetBusinessEffect(map,state.mode,state);placePatrolPet(pet,sprite,state,now);return;}
        // Steer toward the errand at walking pace instead of teleporting.
        state.vx=(ex/far)*3.4;state.vy=(ey/far)*1.15;
      }
      const nx=state.x+state.vx*dt,ny=state.y+state.vy*dt;
      // Slide along whatever it met rather than simply reversing. Reversing
      // in place let the dog lock into a two-step shudder against a wall —
      // 82% of its steps went nowhere and it covered a third of the yard.
      // Trying each axis on its own keeps it walking the edge of a building
      // and out the far side.
      if(!petBlockedAt(state.blocked,nx,ny)){state.x=nx;state.y=ny;}
      else if(!petBlockedAt(state.blocked,nx,state.y)){state.x=nx;state.vy*=-1;}
      else if(!petBlockedAt(state.blocked,state.x,ny)){state.y=ny;state.vx*=-1;}
      else {state.vx*=-1;state.vy*=-1;}
      const activeBounds=state.errand?{minX:Math.min(nextBounds.minX,state.errand.x-1),maxX:Math.max(nextBounds.maxX,state.errand.x+1),minY:Math.min(nextBounds.minY,state.errand.y-1),maxY:Math.max(nextBounds.maxY,state.errand.y+1)}:nextBounds;
      if(state.x<=activeBounds.minX||state.x>=activeBounds.maxX){state.x=Math.max(activeBounds.minX,Math.min(activeBounds.maxX,state.x));state.vx*=-1;}if(state.y<=activeBounds.minY||state.y>=activeBounds.maxY){state.y=Math.max(activeBounds.minY,Math.min(activeBounds.maxY,state.y));state.vy*=-1;}if(now-state.frameAt>=155){state.frame=(state.frame+1)%4;state.frameAt=now;}spawnPetTrail(trail,state,now);placePatrolPet(pet,sprite,state,now);},90);}
  function centerBuilderWorld(){
    const viewport=document.getElementById('nrBuilderWorld');if(!viewport)return;
    decorateCastleYard(viewport.querySelector('.nr-builder-map'),view==='builder');
    startPetPatrol();startArmyParade();
    const saved=builderScroll?{left:builderScroll.left,top:builderScroll.top}:null;
    let placed=false;
    const place=()=>{
      if(!viewport.isConnected)return;
      const map=viewport.querySelector('.nr-builder-map');
      // The screen may still be laying out on the frame after a render — a
      // viewport of zero width would compute a scroll of zero and then REMEMBER
      // it, so every later visit opened on the corner of the land instead of on
      // the castle. Wait for a real size before deciding anything.
      if(!map||viewport.clientWidth<40){requestAnimationFrame(place);return;}
      placed=true;
      if(saved){viewport.scrollLeft=saved.left;viewport.scrollTop=saved.top;}
      else{
        // Open on the castle, not the middle of the land: the build screen now
        // starts zoomed out and a phone still shows about a third of the board,
        // so centring the map could leave a child looking at empty grass.
        const box=castleFootprint(appState.nightRaidLayout),w=map.offsetWidth,h=map.offsetHeight,
              cx=(box.left+box.width/2)/100*w,cy=(box.top+box.height/2)/100*h;
        viewport.scrollLeft=Math.max(0,Math.min(w-viewport.clientWidth,cx-viewport.clientWidth/2));
        viewport.scrollTop=Math.max(0,Math.min(h-viewport.clientHeight,cy-viewport.clientHeight/2));
      }
      keepScroll({left:viewport.scrollLeft,top:viewport.scrollTop});
    };
    // Try straight away — the map's size comes from an inline style, so it is
    // usually known already — and fall back to a frame later only if the screen
    // has not been laid out yet. Waiting unconditionally on a frame also meant
    // nothing was ever placed on a backgrounded tab, where rAF does not fire.
    place();
    if(!placed)requestAnimationFrame(place);
  }

  function renderBuilder(){cleanup();pendingBuildPurchase=null;view='builder';applyViewZoom(view);ensure();const r=root();if(!r)return;const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout);appState.nightRaidLayout=layout;const homeLevel=NightRaidRules.homeLevel(layout,appState.dogLevel||1,appState.battleTeammates),power=ownPower(),skin=typeof CastleSkins!=='undefined'?CastleSkins.get(appState.petBattleCastleSkin):null,production=layout.cells.filter(c=>NightRaidRules.defenseById(c.type)?.producer),ready=production.filter(c=>c.readyAt<=Date.now()).length;
    const cellMap=new Map(layout.cells.map(c=>[gridKey(c),c]));let grid='';for(let gy=0;gy<NightRaidRules.BUILD_GRID;gy++){for(let gx=0;gx<NightRaidRules.BUILD_GRID;gx++){const stand=cellMap.get(gx+':'+gy+':stand'),floor=cellMap.get(gx+':'+gy+':floor'),standOwner=footprintOwner(layout,gx,gy,'stand'),floorOwner=footprintOwner(layout,gx,gy,'floor'),castle=layout.castleCell||CASTLE_HOME,castleCovered=gx>=castle.gx&&gx<castle.gx+CASTLE_SIZE&&gy>=castle.gy&&gy<castle.gy+CASTLE_SIZE,covered=(standOwner&&!stand)||(floorOwner&&!floor)||castleCovered;grid+=`<button type="button" class="nr-build-grid-cell ${stand?'has-stand':''} ${floor?'has-floor':''} ${covered?'footprint-covered':''} ${castleCovered?'castle-covered':''}" data-gx="${gx}" data-gy="${gy}" onclick="nrGridCell(${gx},${gy})" ondragover="nrBuildDragOver(event)" ondrop="nrDropBuildItem(event,${gx},${gy})" aria-label="Ô đất hàng ${gy+1}, cột ${gx+1}${standOwner?', '+NightRaidRules.defenseById(standOwner.type).name.vi+' cấp '+standOwner.tier:''}${floorOwner?', có bẫy cấp '+floorOwner.tier:''}${castleCovered?', nhà chính':''}">${placedHtml(floor,'floor',gx,gy)}${placedHtml(stand,'stand',gx,gy)}<i aria-hidden="true"></i></button>`;}}
    const tray=NightRaidRules.DEFENSES.map(d=>`<button type="button" draggable="true" class="nr-build-item ${selectedBuild===d.id?'selected':''} ${(+appState.coins||0)<d.price?'unaffordable':''}" onclick="nrSelectBuild('${d.id}')" onpointerdown="nrBeginBuildDrag(event,'${d.id}')" ondragstart="nrNativeBuildDrag(event,'${d.id}')" aria-pressed="${selectedBuild===d.id}"><img class="nr-build-art" src="${buildAsset(d)}" alt=""><span class="nr-build-copy"><strong>${esc(d.name.vi)}</strong><small class="nr-item-stats">${buildStatHtml(d)}</small><span class="nr-coin-price">${svg('coin')} ${d.price} xu</span></span></button>`).join('');
    const mapBase=builderMapBase(),mapSize=Math.round(mapBase*builderZoom),mapHeight=Math.round(mapBase*.75*builderZoom);
    r.innerHTML=shell(`<main class="nr-builder ${builderEditing?'editing':''} ${builderShopOpen?'shop-open':''} ${builderRotated?'rotated':''}"><section class="nr-builder-world" id="nrBuilderWorld" aria-label="Khu đất lâu đài hình chữ nhật 4:3. Kéo một ngón để di chuyển, chụm hai ngón để thu phóng."><div class="nr-builder-map" data-base-size="${mapBase}" style="width:${mapSize}px;height:${mapHeight}px"><img class="nr-board-art" src="img/night-raid/isometric-home-board-unified-gate-v3.webp" alt="Khu vườn lâu đài hình chữ nhật có cổng chính cho đội cướp tiến vào"><img id="nrEquippedCastle" class="nr-equipped-castle" src="img/night-raid/home-castle.webp" alt="${esc((skin&&skin.name.vi)||'Castle skin đang trang bị')}"><div class="nr-home-level"><span><small>CẤP NHÀ</small><strong>${homeLevel}</strong></span><span class="nr-skin-name">${esc((skin&&skin.name.vi)||'Thành Đá')}</span></div><div class="nr-free-grid" role="grid" aria-label="Lưới xây dựng 12 nhân 12">${grid}</div></div></section><div class="nr-builder-hud"><button class="nr-builder-home" type="button" onclick="nrHome()" aria-label="Về màn Cướp Đêm">${svg('map')}</button><div class="nr-builder-power damage"><small>DAM</small><strong>${power.damage}</strong></div><div class="nr-builder-power defense"><small>DEF</small><strong>${power.defense}</strong></div><div class="nr-builder-power soldiers"><small>LÍNH</small><strong>${power.soldiers}/10</strong></div><div class="nr-builder-power coins">${svg('coin')}<strong>${Math.max(0,Math.floor(+appState.coins||0))}</strong></div></div><div class="nr-builder-zoom" role="group" aria-label="Thu phóng khu đất"><button type="button" onclick="nrZoomBuilder(-.15)" aria-label="Thu nhỏ khu đất">−</button><span data-nr-zoom>${Math.round(builderZoom*100)}%</span><button type="button" onclick="nrZoomBuilder(.15)" aria-label="Phóng to khu đất">+</button></div><button class="nr-builder-rotate ${builderRotated?'active':''}" type="button" onclick="nrRotateBuilder()" aria-pressed="${builderRotated}" aria-label="${builderRotated?'Trở về màn hình dọc':'Xoay ngang màn hình để nhìn nhà rõ hơn'}"><b>⟳</b><span>${builderRotated?'DỌC':'NGANG'}</span></button><button class="nr-builder-edit ${builderEditing?'active':''}" type="button" onclick="nrToggleBuilderGrid()" aria-pressed="${builderEditing}" aria-label="${builderEditing?'Xong — tắt lưới di chuyển':'Sửa nhà — hiện lưới để di chuyển công trình'}"><b>${builderEditing?'✓':'✎'}</b><span>${builderEditing?'XONG':'SỬA'}</span></button>${production.length?`<button class="nr-collect-all ${ready?'ready':''}" type="button" onclick="nrCollectResources()" ${ready?'':'disabled'}>${svg('coin')}<span><strong>${ready?'THU HOẠCH '+ready:'ĐANG SẢN XUẤT'}</strong><small>${power.soldiers}/10 lính · ${production.length} công trình</small></span></button>`:''}<div class="nr-builder-tip" role="status">${builderEditing?'Chạm ô để đặt · kéo vật đã xây để đổi chỗ':'Kéo để xem · chụm 2 ngón thu phóng'}</div><button class="nr-builder-shop-fab ${builderShopOpen?'active':''}" type="button" onclick="nrToggleBuildShop()" aria-expanded="${builderShopOpen}" aria-controls="nrBuildShop">${svg('hammer')}<span>${builderShopOpen?'ĐÓNG':'SHOP'}</span></button><section class="nr-build-shop ${builderShopOpen?'open':''}" id="nrBuildShop" aria-label="Cửa hàng công trình"><div class="nr-shop-heading"><div><span class="nr-label">CỬA HÀNG</span><strong>Vuốt ngang để xem · kéo vào đất để mua</strong></div><span>Tối đa 2 trại · 4 mỗi loại nông trại</span></div><div class="nr-build-tray" role="toolbar" aria-label="Công trình có thể mua bằng xu">${tray}</div></section></main>`);paintEquippedCastle();centerBuilderWorld();setupBuilderGestures();startProductionTicker();setNav(builderRotated);
  }
  function selectBuild(id){if(builderSuppressShopClick)return;if(NightRaidRules.defenseById(id)){rememberBuilderWorld();selectedBuild=id;builderEditing=true;builderShopOpen=false;renderBuilder();announce('Đã chọn vật phẩm. Chạm ô sáng để đặt.');}}
  function buildPurchasePlan(id,gx,gy){const def=NightRaidRules.defenseById(id);if(!def)return null;const size=NightRaidRules.footprintFor(def);gx=Math.max(0,Math.min(NightRaidRules.BUILD_GRID-size,Math.trunc(gx)));gy=Math.max(0,Math.min(NightRaidRules.BUILD_GRID-size,Math.trunc(gy)));const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),layer=def.trap?'floor':'stand',cell=footprintOwner(layout,gx,gy,layer),at=cell?layout.cells.indexOf(cell):-1,old=cell?NightRaidRules.defenseById(cell.type):null,owned=layout.cells.filter(c=>c.type===def.id).length;let cost=def.price,refund=0,title='Mua '+def.name.vi+'?',detail=def.producer==='soldier'?'Chiếm 4 ô · tạo 1 lính +20 DAM sau mỗi 24 giờ':def.producer==='coins'?`Chiếm 4 ô · thu hoạch ${def.yield} xu sau mỗi 24 giờ`:'Đặt tại hàng '+(gy+1)+', cột '+(gx+1);
    if(!cell&&!buildSpaceFree(layout,gx,gy,size,layer,null,true))return{error:size===2?'Cần một vùng trống 2 × 2 ô để đặt công trình':'Ô này đã có công trình'};
    if(cell&&(cell.gx!==gx||cell.gy!==gy||NightRaidRules.footprintFor(old)!==size))return{error:'Vùng đặt đang chồng lên công trình khác'};
    if(def.maxOwned&&owned>=def.maxOwned&&(!cell||cell.type!==def.id))return{error:'Chỉ được đặt tối đa '+def.maxOwned+' '+def.name.vi};
    if(cell&&cell.type===def.id){if(def.producer)return{error:def.name.vi+' đang sản xuất, không cần nâng cấp'};if(cell.tier>=3)return{error:def.name.vi+' đã đạt cấp tối đa'};cost=def.price*(cell.tier+1);title='Nâng '+def.name.vi+' lên cấp '+(cell.tier+1)+'?';detail='Công trình mạnh hơn ngay sau khi xác nhận';}
    else if(cell){refund=Math.floor(totalPaid(old,cell.tier)*.5);title='Đổi sang '+def.name.vi+'?';detail='Thu lại '+refund+' xu từ '+old.name.vi+' hiện tại';}
    const balance=Math.max(0,Math.floor(+appState.coins||0)),balanceAfter=balance+refund-cost;if(balanceAfter<0)return{error:'Chưa đủ '+cost+' xu để mua '+def.name.vi};return{id:def.id,def,gx,gy,layout,layer,at,cell,cost,refund,balance,balanceAfter,title,detail};}
  function showBuildPurchase(plan){pendingBuildPurchase={id:plan.id,gx:plan.gx,gy:plan.gy};document.querySelector('.nr-purchase-backdrop')?.remove();const builder=document.querySelector('.nr-builder');if(!builder)return;builder.insertAdjacentHTML('beforeend',`<div class="nr-purchase-backdrop" role="presentation" onclick="if(event.target===this)nrCancelBuildPurchase()" onkeydown="if(event.key==='Escape')nrCancelBuildPurchase()"><section class="nr-purchase-dialog" role="dialog" aria-modal="true" aria-labelledby="nrPurchaseTitle" aria-describedby="nrPurchaseDetail"><button class="nr-purchase-close" type="button" onclick="nrCancelBuildPurchase()" aria-label="Hủy mua">${svg('close')}</button><img src="${buildAsset(plan.def)}" alt=""><div class="nr-purchase-copy"><span class="nr-label">XÁC NHẬN MUA</span><h2 id="nrPurchaseTitle">${esc(plan.title)}</h2><p id="nrPurchaseDetail">${esc(plan.detail)}</p></div><div class="nr-purchase-price"><span>Giá${plan.refund?' sau hoàn xu':''}</span><strong>${svg('coin')}${Math.max(0,plan.cost-plan.refund)} xu</strong></div><div class="nr-purchase-balance"><span>Số dư hiện tại <b>${plan.balance}</b></span><span aria-hidden="true">→</span><span>Sau khi mua <b>${plan.balanceAfter}</b></span></div><div class="nr-purchase-actions"><button type="button" class="nr-purchase-cancel" onclick="nrCancelBuildPurchase()">Hủy</button><button type="button" class="nr-purchase-confirm" onclick="nrConfirmBuildPurchase()">Xác nhận mua</button></div></section></div>`);requestAnimationFrame(()=>document.querySelector('.nr-purchase-confirm')?.focus());}
  function cancelBuildPurchase(){pendingBuildPurchase=null;document.querySelector('.nr-purchase-backdrop')?.remove();document.querySelector('.nr-build-shop.open .nr-build-item.selected')?.focus();}
  function confirmBuildPurchase(){const pending=pendingBuildPurchase;if(!pending)return;pendingBuildPurchase=null;document.querySelector('.nr-purchase-backdrop')?.remove();selectedBuild=pending.id;buildCell(pending.gx,pending.gy,true);}
  function buildCell(gx,gy,confirmed){if(!confirmed&&builderSuppressClick){builderSuppressClick=false;return;}if(!builderEditing&&!confirmed)return;const plan=buildPurchasePlan(selectedBuild,gx,gy);if(!plan)return;if(plan.error){if(typeof showToast==='function')showToast(plan.error);return;}if(!confirmed){showBuildPurchase(plan);return;}const {def,layout,at,cell,cost,refund}=plan,lane=Math.round(plan.gy*4/(NightRaidRules.BUILD_GRID-1)),col=1+Math.round(plan.gx*7/(NightRaidRules.BUILD_GRID-1));
    if(cell&&cell.type===def.id){appState.coins-=cost;cell.tier++;}
    else if(cell){appState.coins=Math.max(0,(+appState.coins||0)+refund-cost);layout.cells[at]=newBuildCell(def,lane,col,plan.gx,plan.gy);}
    else{appState.coins-=cost;layout.cells.push(newBuildCell(def,lane,col,plan.gx,plan.gy));}
    rememberBuilderWorld();appState.nightRaidLayout=NightRaidRules.normalizeLayout(layout);builderEditing=false;builderShopOpen=false;save();syncHome();if(typeof showToast==='function')showToast('Đã mua '+def.name.vi+' · còn '+Math.floor(appState.coins)+' xu');announce('Đã mua '+def.name.vi);renderBuilder();}
  function toggleBuilderGrid(){builderEditing=!builderEditing;if(!builderEditing)builderShopOpen=false;renderBuilder();}
  function toggleBuildShop(){builderShopOpen=!builderShopOpen;builderEditing=false;renderBuilder();}
  function nativeBuildDrag(event,id){selectedBuild=id;builderEditing=true;event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('text/plain',id);document.querySelector('.nr-builder')?.classList.add('dragging');}
  function buildDragOver(event){event.preventDefault();event.currentTarget.classList.add('drag-over');}
  function settleBuilderPlacement(){builderEditing=false;builderShopOpen=false;const builder=document.querySelector('.nr-builder');builder?.classList.remove('editing','dragging','shop-open');document.querySelector('.nr-build-shop')?.classList.remove('open');}
  function dropBuildItem(event,gx,gy){event.preventDefault();selectedBuild=event.dataTransfer?.getData('text/plain')||selectedBuild;builderEditing=true;buildCell(gx,gy);settleBuilderPlacement();}
  function smoothBuilderDrag(event,imageSrc,onActivate,onDrop,allowHorizontalScroll){if(event.pointerType==='mouse'&&event.button!==0)return;event.stopPropagation();const source=event.currentTarget,pointerId=event.pointerId,startX=event.clientX,startY=event.clientY;let active=false,ghost=null,dropTarget=null,lastX=startX,lastY=startY,frame=0;const suppressShopClick=()=>{if(!allowHorizontalScroll)return;builderSuppressShopClick=true;setTimeout(()=>{builderSuppressShopClick=false;},320);};try{source.setPointerCapture(pointerId);}catch(_){}const paint=()=>{frame=0;if(!active||!ghost)return;ghost.style.transform=`translate3d(${lastX-42}px,${lastY-42}px,0) scale(1.04)`;const next=document.elementFromPoint(lastX,lastY)?.closest('.nr-build-grid-cell')||null;if(next!==dropTarget){dropTarget?.classList.remove('drag-over');dropTarget=next;dropTarget?.classList.add('drag-over');}};const move=e=>{if(e.pointerId!==pointerId)return;lastX=e.clientX;lastY=e.clientY;const dx=lastX-startX,dy=lastY-startY;if(!active&&allowHorizontalScroll&&Math.abs(dx)>7&&Math.abs(dx)>Math.abs(dy)*1.15){suppressShopClick();finish(e);return;}if(!active&&Math.hypot(dx,dy)<5)return;if(!active){active=true;onActivate();ghost=document.createElement('img');ghost.className='nr-build-drag-ghost';ghost.src=imageSrc;ghost.alt='';ghost.draggable=false;document.body.appendChild(ghost);source.classList.add('nr-drag-source');document.querySelector('.nr-builder')?.classList.add('dragging');if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(8);}e.preventDefault();if(!frame)frame=requestAnimationFrame(paint);};const finish=e=>{if(e.pointerId!==pointerId)return;if(frame){cancelAnimationFrame(frame);frame=0;}if(active)paint();dropTarget?.classList.remove('drag-over');ghost?.remove();source.classList.remove('nr-drag-source');document.querySelector('.nr-builder')?.classList.remove('dragging');try{source.releasePointerCapture(pointerId);}catch(_){}document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',finish);document.removeEventListener('pointercancel',finish);builderDrag=null;if(active)suppressShopClick();if(active&&dropTarget){e.preventDefault();onDrop(dropTarget);}};builderDrag={pointerId,source};document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);}
  function newBuildCell(def,lane,col,gx,gy){const cell={type:def.id,lane,col,gx,gy,tier:1};if(def.producer){cell.uid='p-'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);cell.readyAt=Date.now()+def.productionMs;}return cell;}
  function beginBuildDrag(event,id){const def=NightRaidRules.defenseById(id);if(!def)return;smoothBuilderDrag(event,buildAsset(def),()=>{selectedBuild=id;builderEditing=true;document.querySelector('.nr-builder')?.classList.add('editing');},target=>{buildCell(+target.dataset.gx,+target.dataset.gy);settleBuilderPlacement();},true);}
  // The floor is DYNAMIC: zooming out stops at the level where the island
  // still covers the whole viewport. A fixed 40% let a long pinch shrink the
  // map smaller than the screen — the island ended up pinned to a corner over
  // a sea of empty background with nothing left to drag back.
  function builderZoomBounds(viewport,map){
    const base=+map.dataset.baseSize||1600,baseHeight=base*.75;
    const cover=Math.max(viewport.clientWidth/base,viewport.clientHeight/baseHeight);
    // The home stage must keep the frame full of garden — a letterboxed yard
    // behind the pet looks broken. The builder is a map: seeing all of it, with
    // board edges showing, is the point.
    const min=view==='builder'?BUILDER_MIN_ZOOM:Math.min(1.65,Math.max(.4,cover));
    return {min,max:Math.max(1.65,min)};
  }
  function setBuilderZoom(next,clientX,clientY){const viewport=document.getElementById('nrBuilderWorld'),map=viewport?.querySelector('.nr-builder-map');if(!viewport||!map)return;const old=builderZoom,bounds=builderZoomBounds(viewport,map),newZoom=Math.max(bounds.min,Math.min(bounds.max,+next||1));if(Math.abs(newZoom-old)<.005)return;const rect=viewport.getBoundingClientRect(),cx=Number.isFinite(clientX)?clientX-rect.left:viewport.clientWidth/2,cy=Number.isFinite(clientY)?clientY-rect.top:viewport.clientHeight/2,anchorX=(viewport.scrollLeft+cx)/old,anchorY=(viewport.scrollTop+cy)/old,base=+map.dataset.baseSize||1600;builderZoom=newZoom;map.style.width=Math.round(base*newZoom)+'px';map.style.height=Math.round(base*.75*newZoom)+'px';viewport.scrollLeft=Math.max(0,anchorX*newZoom-cx);viewport.scrollTop=Math.max(0,anchorY*newZoom-cy);const label=document.querySelector('[data-nr-zoom]');if(label)label.textContent=Math.round(newZoom*100)+'%';keepScroll({left:viewport.scrollLeft,top:viewport.scrollTop});builderZoomByView[view==='builder'?'builder':'home']=builderZoom;}
  function zoomBuilder(delta){setBuilderZoom(builderZoom+(+delta||0));}
  // Fake landscape: iOS never lets a web app lock orientation, so the whole
  // builder rotates 90deg in CSS instead — the child turns the device and the
  // island fills the wide way. Pan deltas are re-mapped in the gesture code.
  function rotateBuilder(){builderRotated=!builderRotated;builderScroll=null;renderBuilder();announce(builderRotated?'Đã xoay ngang màn hình — xoay máy để xem':'Đã trở về màn hình dọc');}
  if(typeof window!=='undefined')window.addEventListener('resize',()=>{if(view==='builder')setBuilderZoom(builderZoom);});
  function setupBuilderGestures(){const viewport=document.getElementById('nrBuilderWorld');if(!viewport)return;
    // A zoom persisted on another device/orientation may now be below the
    // cover floor — re-clamp before the first gesture, not during it.
    setBuilderZoom(builderZoom);const points=new Map();const distance=()=>{const p=[...points.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);};const midpoint=()=>{const p=[...points.values()];return p.length<2?{x:0,y:0}:{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};};
    viewport.addEventListener('contextmenu',e=>e.preventDefault());viewport.addEventListener('dragstart',e=>{if(e.target.closest('img'))e.preventDefault();});
    viewport.addEventListener('pointerdown',e=>{if(e.target.closest('.nr-castle-pad,.nr-placed,.nr-build-shop,.nr-builder-shop-fab,.nr-builder-hud,.nr-builder-zoom,.nr-home-fabs,.nr-collect-all,.nr-builder-edit'))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});try{viewport.setPointerCapture(e.pointerId);}catch(_){}if(points.size===1)builderGesture={mode:'pan',x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,moved:false};else if(points.size===2){builderGesture={mode:'pinch',distance:distance(),zoom:builderZoom,mid:midpoint(),moved:true};builderSuppressClick=true;}},{passive:true});
    viewport.addEventListener('pointermove',e=>{if(!points.has(e.pointerId)||!builderGesture)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size>=2){const mid=midpoint(),ratio=distance()/Math.max(1,builderGesture.distance||distance());if(builderRotated)setBuilderZoom(builderGesture.zoom*ratio);else setBuilderZoom(builderGesture.zoom*ratio,mid.x,mid.y);builderSuppressClick=true;e.preventDefault();return;}if(builderGesture.mode==='pan'){const dx=e.clientX-builderGesture.x,dy=e.clientY-builderGesture.y;if(Math.hypot(dx,dy)>5){builderGesture.moved=true;builderSuppressClick=true;}if(builderRotated){viewport.scrollLeft=builderGesture.left-dy;viewport.scrollTop=builderGesture.top+dx;}else{viewport.scrollLeft=builderGesture.left-dx;viewport.scrollTop=builderGesture.top-dy;}keepScroll({left:viewport.scrollLeft,top:viewport.scrollTop});if(builderGesture.moved)e.preventDefault();}},{passive:false});
    const end=e=>{points.delete(e.pointerId);if(points.size===1){const p=[...points.values()][0];builderGesture={mode:'pan',x:p.x,y:p.y,left:viewport.scrollLeft,top:viewport.scrollTop,moved:true};}else if(!points.size){builderGesture=null;if(builderSuppressClick)setTimeout(()=>{builderSuppressClick=false;},160);}};viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
    // Producers keep their art clean: the countdown badge stays hidden until
    // the child taps a farm / pond / barracks. Read the real grid rectangle
    // so hit testing stays exact at every breakpoint and future expansion.
    viewport.addEventListener('click',e=>{
      if(builderSuppressClick||builderRotated||builderEditing)return;
      const grid=viewport.querySelector('.nr-free-grid');if(!grid)return;
      const rect=grid.getBoundingClientRect();
      const fx=(e.clientX-rect.left)/rect.width,fy=(e.clientY-rect.top)/rect.height;
      const gx=Math.floor(fx*NightRaidRules.BUILD_GRID),gy=Math.floor(fy*NightRaidRules.BUILD_GRID);
      if(gx<0||gy<0||gx>=NightRaidRules.BUILD_GRID||gy>=NightRaidRules.BUILD_GRID)return;
      const clean=NightRaidRules.normalizeLayout(appState.nightRaidLayout),cell=footprintOwner(clean,gx,gy,'stand');
      if(cell&&!NightRaidRules.defenseById(cell.type)?.producer)return;
      if(!cell)return;
      if(cell.readyAt<=Date.now()&&cell.uid)return collectResources(cell.uid);
      const badge=viewport.querySelector('.nr-build-grid-cell[data-gx="'+cell.gx+'"][data-gy="'+cell.gy+'"] .nr-production-badge');
      if(!badge)return;
      badge.classList.add('shown');clearTimeout(badge._hideTimer);badge._hideTimer=setTimeout(()=>badge.classList.remove('shown'),4000);
    });
    viewport.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();if(builderRotated)setBuilderZoom(builderZoom+(e.deltaY<0?.1:-.1));else setBuilderZoom(builderZoom+(e.deltaY<0?.1:-.1),e.clientX,e.clientY);},{passive:false});
  }
  function movePlacedItem(fromGx,fromGy,layer,toGx,toGy){fromGx=+fromGx;fromGy=+fromGy;toGx=+toGx;toGy=+toGy;settleBuilderPlacement();if(fromGx===toGx&&fromGy===toGy)return;const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),sameLayer=c=>(NightRaidRules.defenseById(c.type).trap?'floor':'stand')===layer,source=layout.cells.find(c=>c.gx===fromGx&&c.gy===fromGy&&sameLayer(c));if(!source)return;const size=NightRaidRules.footprintFor(source.type);toGx=Math.max(0,Math.min(NightRaidRules.BUILD_GRID-size,toGx));toGy=Math.max(0,Math.min(NightRaidRules.BUILD_GRID-size,toGy));if(!buildSpaceFree(layout,toGx,toGy,size,layer,source,true)){if(typeof showToast==='function')showToast(size===2?'Cần một vùng trống 2 × 2 ô':'Ô này đã có công trình');return;}source.gx=toGx;source.gy=toGy;source.lane=Math.round(toGy*4/(NightRaidRules.BUILD_GRID-1));source.col=1+Math.round(toGx*7/(NightRaidRules.BUILD_GRID-1));rememberBuilderWorld();appState.nightRaidLayout=NightRaidRules.normalizeLayout(layout);builderSuppressClick=false;save();syncHome();renderBuilder();announce('Đã chuyển công trình sang vị trí mới');}
  function beginPlacedDrag(event,gx,gy,layer){if(!builderEditing)return;event.preventDefault();const src=event.currentTarget.currentSrc||event.currentTarget.src;smoothBuilderDrag(event,src,()=>{},target=>{builderSuppressClick=true;movePlacedItem(gx,gy,layer,+target.dataset.gx,+target.dataset.gy);});}
  function beginCastleDrag(event){
    if(!builderEditing||(event.pointerType==='mouse'&&event.button!==0))return;
    event.preventDefault();event.stopPropagation();
    const pad=event.currentTarget,map=pad.closest('.nr-builder-map'),grid=map?.querySelector('.nr-free-grid');
    if(!map||!grid)return;
    const G=NightRaidRules.BUILD_GRID,MAX=G-CASTLE_SIZE;
    const pointerId=event.pointerId,startX=event.clientX,startY=event.clientY;
    const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),start=layout.castleCell||CASTLE_HOME;
    const cellAt=(clientX,clientY)=>{const rect=grid.getBoundingClientRect();return{
      cx:Math.floor((clientX-rect.left)/Math.max(1,rect.width)*G),
      cy:Math.floor((clientY-rect.top)/Math.max(1,rect.height)*G)};};
    // Keep the castle where it was grabbed rather than snapping its corner to
    // the finger — a four-cell keep that jumps two cells on touch is impossible
    // to place accurately.
    const first=cellAt(startX,startY),grabX=first.cx-start.gx,grabY=first.cy-start.gy;
    let gx=start.gx,gy=start.gy,moved=false,valid=true;
    try{pad.setPointerCapture(pointerId);}catch(_){}
    pad.classList.add('dragging');map.classList.add('castle-dragging');
    const paint=()=>{
      const preview=castlePosition({cells:layout.cells,castleCell:{gx,gy}});
      map.style.setProperty('--nr-castle-x',preview.x.toFixed(2));
      map.style.setProperty('--nr-castle-y',preview.y.toFixed(2));
      pad.setAttribute('style',castlePadStyle(castleFootprint({cells:layout.cells,castleCell:{gx,gy}}))+';');
      map.classList.toggle('castle-invalid',!valid);
    };
    const move=e=>{
      if(e.pointerId!==pointerId)return;
      if(Math.hypot(e.clientX-startX,e.clientY-startY)>4)moved=true;
      if(!moved)return;
      const at=cellAt(e.clientX,e.clientY);
      gx=Math.max(0,Math.min(MAX,at.cx-grabX));
      gy=Math.max(0,Math.min(MAX,at.cy-grabY));
      valid=buildSpaceFree(layout,gx,gy,CASTLE_SIZE,'stand',null,false);
      paint();e.preventDefault();
    };
    const finish=e=>{
      if(e.pointerId!==pointerId)return;
      document.removeEventListener('pointermove',move);
      document.removeEventListener('pointerup',finish);
      document.removeEventListener('pointercancel',finish);
      try{pad.releasePointerCapture(pointerId);}catch(_){}
      pad.classList.remove('dragging');map.classList.remove('castle-dragging','castle-invalid');
      if(!moved)return;
      if(!valid){gx=start.gx;gy=start.gy;valid=true;paint();decorateCastleYard(map,true);if(typeof showToast==='function')showToast(`Nhà chính cần một vùng trống ${CASTLE_SIZE} × ${CASTLE_SIZE} ô`);return;}
      layout.castleCell={gx,gy};
      appState.nightRaidLayout=NightRaidRules.normalizeLayout(layout);
      builderSuppressClick=true;setTimeout(()=>{builderSuppressClick=false;},160);
      save();syncHome();announce('Đã chuyển nhà chính trên khu vườn');
      rememberBuilderWorld();renderBuilder();
    };
    document.addEventListener('pointermove',move,{passive:false});
    document.addEventListener('pointerup',finish);
    document.addEventListener('pointercancel',finish);
  }
  function gridCell(gx,gy){const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),cell=footprintOwner(layout,gx,gy,'stand');if(cell&&NightRaidRules.defenseById(cell.type)?.producer&&cell.readyAt<=Date.now())return collectResources(cell.uid);buildCell(gx,gy);}
  // ---- raid lock countdowns -------------------------------------------
  // A breached home is sealed for 20 hours (server-side, see _night-raid.js).
  // Every place that can show that clock renders the same chip and lets the
  // one-second ticker below drive it, so the child sees exactly when to come
  // back instead of finding a castle that silently refuses to be attacked.
  const lockLeft=until=>Math.max(0,(+until||0)-Date.now());
  function lockChip(until,label,cls=''){
    if(!lockLeft(until))return '';
    return `<span class="nr-lock-chip ${cls}" data-nr-lock-until="${+until}" role="status">${svg('shield')}<span><small>${esc(label)}</small><b data-nr-lock-time>${productionTime(lockLeft(until))}</b></span></span>`;
  }
  function productionTime(ms){const total=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60;return[h,m,s].map(n=>String(n).padStart(2,'0')).join(':');}
  function updateProductionTimers(){let ready=0;document.querySelectorAll('.nr-production-badge[data-ready-at]').forEach(el=>{const left=+el.dataset.readyAt-Date.now(),isReady=left<=0;el.classList.toggle('ready',isReady);el.textContent=isReady?el.dataset.readyLabel:productionTime(left);if(isReady)ready++;});const all=document.querySelector('.nr-collect-all');if(all){all.disabled=!ready;all.classList.toggle('ready',!!ready);const strong=all.querySelector('strong');if(strong)strong.textContent=ready?'THU HOẠCH '+ready:'ĐANG SẢN XUẤT';}updateLockTimers();}
  // The lock chips tick on the same one-second beat. When one runs out the
  // castle becomes attackable again, so the chip leaves and whatever it was
  // guarding (the TIẾN QUÂN button, the target card) is handed back.
  function updateLockTimers(){
    document.querySelectorAll('[data-nr-lock-until]').forEach(el=>{
      const left=lockLeft(el.dataset.nrLockUntil);
      if(left>0){const time=el.querySelector('[data-nr-lock-time]');if(time)time.textContent=productionTime(left);return;}
      const card=el.closest('.nr-target-card');el.remove();
      if(card)card.classList.remove('locked');
      const fab=document.getElementById('nrStartRaid');if(fab){fab.disabled=false;fab.hidden=false;}
      const secret=document.getElementById('nrScoutSecret');if(secret)secret.hidden=false;
    });
  }
  function startProductionTicker(){updateProductionTimers();productionTicker=setInterval(updateProductionTimers,1000);}
  function localCollect(uid){const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),now=Date.now();let coins=0,soldiers=0;for(const cell of layout.cells){const def=NightRaidRules.defenseById(cell.type);if(!def?.producer||(uid&&cell.uid!==uid)||cell.readyAt>now)continue;if(def.producer==='coins'&&(+appState.coins||0)<100000){const gain=Math.min(def.yield,100000-(+appState.coins||0));appState.coins=Math.max(0,+appState.coins||0)+gain;coins+=gain;cell.readyAt=now+def.productionMs;}else if(def.producer==='soldier'&&layout.soldiers<NightRaidRules.MAX_SOLDIERS){layout.soldiers++;soldiers++;cell.readyAt=now+def.productionMs;}}appState.nightRaidLayout=layout;return{coins,soldiers};}
  async function collectResources(uid){const trigger=document.querySelector('.nr-collect-all');if(trigger)trigger.disabled=true;const synced=await syncHome(),res=synced&&synced.ok?await api('collect',{method:'POST',body:{uid:uid||''}}):{ok:false};let coins=0,soldiers=0;if(res.ok&&res.data){appState.nightRaidLayout=NightRaidRules.normalizeLayout(res.data.layout);appState.coins=Math.max(0,+res.data.coins||0);coins=+res.data.collectedCoins||0;soldiers=+res.data.collectedSoldiers||0;}else{const local=localCollect(uid);coins=local.coins;soldiers=local.soldiers;}
    if(!coins&&!soldiers){if(typeof showToast==='function')showToast((+appState.coins||0)>=100000?'Kho xu đã đầy':(appState.nightRaidLayout.soldiers||0)>=NightRaidRules.MAX_SOLDIERS?'Kho lính đã đầy 10/10':'Chưa có công trình sẵn sàng');if(view==='builder')renderBuilder();else if(view==='home')renderHome();return;}
    save();if(!res.ok)syncHome();if(typeof showToast==='function')showToast([coins?('+'+coins+' xu'):'',soldiers?('+'+soldiers+' lính'):''].filter(Boolean).join(' · ')+' đã thu hoạch');announce('Thu hoạch thành công');if(view==='builder')renderBuilder();else if(view==='home')renderHome();}
  function setDogLane(lane){appState.nightRaidLayout.dogLane=Math.max(0,Math.min(4,lane));save();syncHome();renderBuilder();}

  async function api(path,opts){if(typeof EngAuth==='undefined'||typeof currentUser==='undefined')return{ok:false,data:{error:'Chưa kết nối tài khoản'}};const token=EngAuth.tokenFor(currentUser);if(!token)return{ok:false,data:{error:'Đăng nhập để mở Phase 2'}};try{return await EngAuth.api('night-raid/'+path,Object.assign({token},opts||{}));}catch(e){return{ok:false,data:{error:'Không thể kết nối máy chủ'}};}}
  async function syncHome(){const res=await api('home',{method:'PUT',body:{layout:appState.nightRaidLayout,teammates:appState.battleTeammates,dogLevel:appState.dogLevel||1,castleSkin:appState.petBattleCastleSkin||'stone-keep',coins:appState.coins||0,vaultCoins:appState.vaultCoins||0}});if(res.ok&&res.data?.layout)appState.nightRaidLayout=NightRaidRules.normalizeLayout(res.data.layout);return res;}
  async function refreshHome(){const res=await api('home');if(!res.ok||!res.data)return;if(!res.data.home){syncHome();return;}homeLockedUntil=Math.max(0,+res.data.home.lockedUntil||0);appState.nightRaidLayout=NightRaidRules.normalizeLayout(res.data.home.layout);save();if(view==='home')renderHome();}
  async function showLiveTargets(){cleanup();setNav(false);view='live';const r=root();if(!r)return;r.innerHTML=shell(`<main class="nr-live-targets"><div class="nr-section-head compact"><button class="nr-back" type="button" onclick="nrHome()">${svg('people')}<span>${VI.back}</span></button><div><span class="nr-label">CƯỚP ĐÊM</span><h2>Nhà người chơi</h2><p>Đang tìm ba lâu đài cân bằng với nhà của con…</p></div></div><div class="nr-loading" role="status"><i></i><span>Đang trinh sát khu phố</span></div></main>`);const res=await api('targets');if(view!=='live')return;if(!res.ok){r.innerHTML=shell(`<main class="nr-live-targets"><div class="nr-section-head compact"><button class="nr-back" type="button" onclick="nrHome()">${svg('people')}<span>${VI.back}</span></button><div><span class="nr-label">CƯỚP ĐÊM</span><h2>Chưa thể tìm nhà thật</h2><p>${esc(res.data&&res.data.error||'Máy chủ chưa bật Cướp Đêm cho tài khoản này.')}</p></div></div><button class="nr-secondary nr-wide" onclick="nrScoutBot()">Chơi thử với Bot</button></main>`);return;}liveTargets=res.data.targets||[];r.innerHTML=shell(`<main class="nr-live-targets"><div class="nr-section-head compact"><button class="nr-back" type="button" onclick="nrHome()">${svg('people')}<span>${VI.back}</span></button><div><span class="nr-label">CƯỚP ĐÊM · ${res.data.ticketsLeft||0} LƯỢT</span><h2>Chọn một lâu đài</h2><p>So DAM quân ta với DEF của nhà trước khi quyết định tiến quân.</p></div></div><div class="nr-target-grid">${liveTargets.map((t,i)=>`<button type="button" class="nr-target-card ${lockLeft(t.lockedUntil)?'locked':''}" onclick="nrScoutLive(${i})">${lockChip(t.lockedUntil,'CÒN LẠI')}<span class="nr-target-art ${t.shieldClue?'shield-clue':''}">${svg('castle')}</span><span class="nr-target-copy"><strong>${esc(t.name)}</strong><small>Nhà cấp ${t.homeLevel} · ${esc(t.difficulty)}</small></span><span class="nr-target-go">›</span></button>`).join('')||'<p class="nr-empty">Chưa có nhà phù hợp. Hãy thử lại sau.</p>'}</div></main>`);startProductionTicker();}
  function scoutLive(index){const t=liveTargets[index];if(!t)return;scout(1,t,true);}
  async function finishOnline(target,state,commands){const res=await api('finish',{method:'POST',body:{raidId:target.raidId}});const verified=res.ok&&res.data&&res.data.result;if(!verified){announce('Kết quả đang chờ đồng bộ');return renderResult(target,state,0,0,true,0);}if(!appState.nightRaidClaimed?.[target.raidId]){if(!appState.nightRaidClaimed)appState.nightRaidClaimed={};appState.nightRaidClaimed[target.raidId]=true;if(verified.won)appState.coins=Math.max(0,+appState.coins||0)+Math.max(0,+verified.reward||0);else appState.coins=Math.max(0,(+appState.coins||0)-Math.max(0,+verified.loss||0));if(Number.isFinite(+verified.soldiers))appState.nightRaidLayout.soldiers=Math.max(0,+verified.soldiers);save();syncHome();}renderResult(target,Object.assign(state,{status:verified.won?'won':'lost',castleHp:verified.castleHp,damage:verified.damage,defense:verified.defense,margin:verified.margin}),verified.stars||0,verified.reward||0,true,verified.loss||0);}

  async function showReports(){cleanup();setNav(false);view='reports';const r=root();if(!r)return;r.innerHTML=shell(`<main class="nr-reports"><div class="nr-section-head compact"><button class="nr-back" type="button" onclick="nrHome()">${svg('shield')}<span>${VI.back}</span></button><div><span class="nr-label">PHASE 2 · PHÒNG THỦ OFFLINE</span><h2>Nhật ký phòng thủ</h2><p>Đang mở sổ trực đêm của lâu đài…</p></div></div><div class="nr-loading" role="status"><i></i><span>Đang tải các trận cướp</span></div></main>`);const res=await api('reports');if(view!=='reports')return;if(!res.ok){r.innerHTML=shell(`<main class="nr-reports"><div class="nr-section-head compact"><button class="nr-back" type="button" onclick="nrHome()">${svg('shield')}<span>${VI.back}</span></button><div><span class="nr-label">NHẬT KÝ PHÒNG THỦ</span><h2>Chưa thể mở nhật ký</h2><p>${esc(res.data&&res.data.error||'Hãy đăng nhập để xem nhà mình bị cướp ra sao.')}</p></div></div></main>`);return;}raidReports=res.data.reports||[];const unseen=raidReports.filter(x=>!x.seen).map(x=>x.id);r.innerHTML=shell(`<main class="nr-reports"><div class="nr-section-head compact"><button class="nr-back" type="button" onclick="nrHome()">${svg('shield')}<span>${VI.back}</span></button><div><span class="nr-label">PHASE 2 · ${unseen.length} BÁO CÁO MỚI</span><h2>Nhật ký phòng thủ</h2><p>Xem lại đường quân đã đi để sửa đúng lane còn yếu.</p></div></div><div class="nr-report-list">${raidReports.map((report,i)=>{const breached=!!report.result.won,when=report.finishedAt?new Date(report.finishedAt).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Gần đây';return `<article class="nr-report-card ${breached?'breached':'held'} ${report.seen?'':'new'}"><span class="nr-report-crest">${svg(breached?'castle':'shield')}</span><div><span class="nr-report-state">${breached?'TƯỜNG ĐÃ BỊ PHÁ':'PHÒNG THỦ THÀNH CÔNG'}</span><h3>${esc(report.attackerName||'Đội cướp bí ẩn')}</h3><p>${when} · Castle còn ${Math.max(0,Math.ceil(+report.result.castleHp||0))} HP</p></div><button class="nr-secondary" type="button" onclick="nrReplayReport(${i})">${svg('play')} Xem lại</button></article>`;}).join('')||'<div class="nr-empty-state">'+svg('moon')+'<h3>Đêm nay vẫn yên bình</h3><p>Khi có người ghé lâu đài, replay sẽ xuất hiện ở đây.</p></div>'}</div></main>`);if(unseen.length)api('reports',{method:'POST',body:{ids:unseen}});}

  function replayReport(index){setNav(false);const report=raidReports[index];if(!report||!report.snapshot)return;cleanup();view='replay';const r=root();if(!r)return;const breached=!!report.result.won;r.innerHTML=shell(`<main class="nr-replay"><div class="nr-section-head compact"><button class="nr-back" type="button" onclick="nrShowReports()">${svg('shield')}<span>Nhật ký</span></button><div><span class="nr-label">REPLAY TRẬN CƯỚP</span><h2>${esc(report.attackerName||'Đội cướp bí ẩn')}</h2><p>${breached?'Quân tấn công có DAM cao hơn DEF của nhà.':'Phòng thủ đã chặn được toàn bộ đội cướp.'}</p></div></div><section class="nr-replay-stage"><canvas id="nrReplayCanvas" width="1000" height="560" aria-label="Phát lại trận Cướp Đêm"></canvas><div class="nr-replay-status" id="nrReplayStatus" aria-live="polite">Đang phát lại</div></section><div class="nr-replay-summary"><span>${breached?'Tường bị phá':'Đã giữ thành'}</span><strong>DAM ${report.result.damage||'?'} · DEF ${report.result.defense||'?'}</strong></div></main>`);const canvas=document.getElementById('nrReplayCanvas');if((report.rulesVersion||1)>=2){report.snapshot.attackerDamage=report.result.damage;report.snapshot.defense=report.result.defense;game=new NightRaidGame.AutoBattle(canvas,report.snapshot,{onUpdate:state=>{const el=document.getElementById('nrReplayStatus');if(el)el.textContent=state.status==='fighting'?'Đang giao chiến':state.status==='won'?'Tường đã bị phá':'Phòng thủ thành công';}});game.start();setTimeout(()=>game&&game.charge&&game.charge(),450);}else{game=new NightRaidGame.Game(canvas,report.snapshot,{replay:true,allowPause:false,onUpdate:state=>{const el=document.getElementById('nrReplayStatus');if(el)el.textContent=state.status==='playing'?`Còn ${Math.max(0,Math.ceil((state.maxTimeMs-state.timeMs)/1000))} giây trước bình minh`:state.status==='won'?'Tường đã bị phá':'Lâu đài đã giữ được';}});game.playReplay(report.commands||[],2);}}

  return Object.freeze({mountYardScene,unmountYardScene,yardPoopSpots,yardBlockedRects:petBlockedRects,yardBlockedAt:petBlockedAt,yardBounds:petPatrolBounds,open,close,renderHome,scoutBot,showLiveTargets,scoutLive,startRaid,chargeArmy,quit,renderBuilder,selectBuild,buildCell,gridCell,cancelBuildPurchase,confirmBuildPurchase,setDogLane,toggleBuilderGrid,toggleBuildShop,rotateBuilder,beginBuildDrag,beginPlacedDrag,beginCastleDrag,zoomBuilder,nativeBuildDrag,buildDragOver,dropBuildItem,collectResources,showReports,replayReport,cleanYardPoop});
})();

function openNightRaid(){NightRaid.open();}
function closeNightRaid(){NightRaid.close();}
function nrHome(){NightRaid.renderHome();}
function nrScoutBot(){NightRaid.scoutBot();}
function nrShowLiveTargets(){NightRaid.showLiveTargets();}
function nrScoutLive(n){NightRaid.scoutLive(n);}
function nrChargeArmy(){NightRaid.chargeArmy();}
function nrQuitRaid(){NightRaid.quit();}
function nrShowBuilder(){NightRaid.renderBuilder();}
function nrSelectBuild(id){NightRaid.selectBuild(id);}
function nrBuildCell(lane,col){NightRaid.buildCell(lane,col);}
function nrGridCell(gx,gy){NightRaid.gridCell(gx,gy);}
function nrCancelBuildPurchase(){NightRaid.cancelBuildPurchase();}
function nrConfirmBuildPurchase(){NightRaid.confirmBuildPurchase();}
function nrSetDogLane(lane){NightRaid.setDogLane(lane);}
function nrToggleBuilderGrid(){NightRaid.toggleBuilderGrid();}
function nrToggleBuildShop(){NightRaid.toggleBuildShop();}
function nrBeginBuildDrag(event,id){NightRaid.beginBuildDrag(event,id);}
function nrNativeBuildDrag(event,id){NightRaid.nativeBuildDrag(event,id);}
function nrBuildDragOver(event){NightRaid.buildDragOver(event);}
function nrDropBuildItem(event,gx,gy){NightRaid.dropBuildItem(event,gx,gy);}
function nrBeginPlacedDrag(event,gx,gy,layer){NightRaid.beginPlacedDrag(event,gx,gy,layer);}
function nrBeginCastleDrag(event){NightRaid.beginCastleDrag(event);}
function nrZoomBuilder(delta){NightRaid.zoomBuilder(delta);}
function nrRotateBuilder(){NightRaid.rotateBuilder();}
function nrCollectResources(){NightRaid.collectResources();}
function nrShowReports(){NightRaid.showReports();}
function nrCleanYard(){NightRaid.cleanYardPoop();}
function nrReplayReport(index){NightRaid.replayReport(index);}
