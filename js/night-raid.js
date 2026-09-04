// Castle Night Raid product UI. One combat mode, two target sources:
// local training homes (Phase 1) and server snapshots (Phase 2).
var NightRaid = (() => {
  'use strict';

  // The build screen opens at 60% of the board's own size. At 100% a phone
  // showed roughly a ninth of the 144 land cells and a child had to pan around
  // to find their own castle; at 60% the whole base is a short swipe wide and a
  // land cell is still about 61 x 48 css px, above the ~44px a fingertip needs.
  const BUILDER_START_ZOOM=.6;
  // The fenced estate is one small place in a much larger meadow. Three per
  // cent makes the estate a distant speck; 400% lets children inspect
  // a single building. These broad safety rails feel free in normal use while
  // preventing Safari from allocating a map large enough to exhaust memory.
  const ESTATE_MIN_ZOOM=.03,ESTATE_MAX_ZOOM=4,WORLD_PLANE_SIZE=32768,MEADOW_TILE_SIZE=2048;

  let game=null,previewGame=null,ruinsShow=null,productionTicker=null,petPatrolTimer=null,petPatrolState=null,armyParadeTimer=null,armyParadeState=null,view='home',selectedBuild='wood-fence',builderEditing=false,builderShopOpen=false,builderDrag=null,builderScroll=null,builderScrollByView={home:null,builder:null,scout:null},builderZoom=1,builderZoomByView={home:1,builder:BUILDER_START_ZOOM,scout:1},builderRotated=false,builderGesture=null,builderSuppressClick=false,builderSuppressShopClick=false,pendingBuildPurchase=null,liveTargets=[],raidReports=[],homeLockedUntil=0,homeShieldUntil=0,builderZone=0,builderShopTab='defense';
  // What the last collect actually pulled out of the ground, so the screen can
  // offer to plant the same thing again. Task 11 wires the button up.
  let lastHarvest=[];
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
      const def=NightRaidRules.itemById(c.type);
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
    if(appState.nightRaidRewardDate!==today()){appState.nightRaidRewardDate=today();appState.nightRaidRewardToday=0;appState.nightRaidTicketCount=0;}
    if(!Number.isFinite(+appState.nightRaidRewardToday))appState.nightRaidRewardToday=0;
    if(!Number.isFinite(+appState.nightRaidTicketCount))appState.nightRaidTicketCount=0;
    return appState;
  }
  function save(){try{if(typeof saveUserData==='function'&&typeof currentUser!=='undefined'&&currentUser)saveUserData(currentUser,appState);}catch(e){}}
  function shell(body,title=VI.title){return `<div class="nr-shell"><header class="nr-topbar"><button class="nr-icon-btn" type="button" onclick="closeNightRaid()" aria-label="Đóng Cướp Đêm">${svg('close')}</button><div><span class="nr-kicker">CASTLE NIGHT RAID</span><h1>${esc(title)}</h1></div><div class="nr-wallet" aria-label="Số xu hiện có">${svg('coin')}<strong data-nr-coins>${Math.max(0,Math.floor(+appState.coins||0))}</strong></div></header>${body}<div id="nrLive" class="sr-only" aria-live="polite"></div></div>`;}
  // What is at stake on the raid stage right now. `committed` turns true the
  // moment TIẾN QUÂN goes through on a REAL house: functions/api/night-raid/
  // start.js has written the raid row by then, and start.js refuses a second
  // visit to the same home on the same date — so walking out from here burns
  // one of the three houses on offer tonight and pays nothing for it.
  let raidStage=null;
  function isRaiding(){return !!(raidStage&&raidStage.committed);}
  function abandonRaid(){raidStage=null;}
  // The raid is over and scored. Nothing is at stake any more, but keep the
  // `online` flag so the map button still goes back to the list of houses
  // rather than dumping the child at the Cướp Đêm home.
  function settleRaid(){if(raidStage)raidStage.committed=false;}
  function confirmLeaveRaid(){
    if(!isRaiding()||typeof confirm!=='function')return true;
    return confirm('Bỏ dở trận này?\n\nMáy chủ đã ghi nhận con vào nhà này — hôm nay con '
      + 'KHÔNG vào lại được nữa, và cũng KHÔNG nhận được xu nào.\n\nVẫn bỏ?');
  }

  function cleanup(){if(game){game.destroy();game=null;}if(previewGame){previewGame.destroy();previewGame=null;}destroyRuins();if(productionTicker){clearInterval(productionTicker);productionTicker=null;}if(petPatrolTimer){clearInterval(petPatrolTimer);petPatrolTimer=null;}if(armyParadeTimer){clearInterval(armyParadeTimer);armyParadeTimer=null;}petPatrolRoot=null;}
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.hidden){if(petPatrolTimer){clearInterval(petPatrolTimer);petPatrolTimer=null;}if(armyParadeTimer){clearInterval(armyParadeTimer);armyParadeTimer=null;}}else if(view==='home'||view==='builder'){const map=document.querySelector('.screen.active .nr-builder-map');startPetPatrol(map);startArmyParade(map);}});
  // Swords ride on appState.dailyTask (filled by js/daily-task.js from the
  // server); the server scores a raid from users.night_swords through this
  // same combatPower, so the HUD number is the number the fight is scored with.
  function ownSwords(){return Math.max(0,Math.trunc(+(appState.dailyTask?.swords?.count)||0));}
  function ownPower(){return NightRaidRules.combatPower(appState.nightRaidLayout,appState.dogLevel||1,appState.nightRaidLayout?.soldiers||0,ownSwords());}
  function raidPetDescriptor(){
    const level=Math.max(1,+appState.dogLevel||1),stage=typeof getDogStage==='function'?getDogStage(level):{stageCss:'chihuahua',minLevel:1,name:'Chihuahua'};
    const breeds=['chihuahua','pomeranian','beagle','corgi','bulldog','husky','retriever','shepherd','rottweiler','tibetan-mastiff'],breedIndex=Math.max(0,breeds.indexOf(stage.stageCss)),atlas=breedIndex<5?'small':'large',cell=breedIndex%5;
    return {level,name:appState.petName||stage.name,breed:stage.name,atlas,cell};
  }
  // The GET goes FIRST and the pending-finish sweep waits for it: refreshHome
  // adopts coins the server credited while the child was offline, and
  // retryPendingFinish ends in claimVerified() -> syncHome(), a PUT that would
  // otherwise push the stale wallet straight over them.
  function open(){ensure();cleanup();view='home';if(typeof switchScreen==='function')switchScreen('nightRaidScreen');renderHome();refreshHome().catch(()=>{}).then(()=>retryPendingFinish()).catch(()=>{});}
  function close(){if(!confirmLeaveRaid())return;abandonRaid();cleanup();setNav(false);if(typeof switchScreen==='function')switchScreen('petBattleScreen');if(typeof renderPetBattle==='function')renderPetBattle();}
  function renderHome(){cleanup();abandonRaid();setNav(true);view='home';applyViewZoom(view);ensure();const r=root();if(!r)return;
    // The Night Raid home IS the child's island, exactly like the builder:
    // full-screen board with the equipped castle and every placed building,
    // the same DAM/DEF/LINH/coin chips, and the actions as SHOP-style fabs
    // floating on top. Read-only: buildings do not drag here.
    // FOUR fabs, not five. NHÀ THẬT used to sit beside CƯỚP ĐÊM and open the
    // friends list while CƯỚP ĐÊM dropped the child straight into a bot fight
    // — two buttons for one idea, and the child is already standing in their
    // real house, so "NHÀ THẬT" named nothing.
    // CƯỚP ĐÊM opens the list of real houses; there is no bot road any more.
    const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout);appState.nightRaidLayout=layout;
    const homeLevel=NightRaidRules.homeLevel(layout,appState.dogLevel||1),power=ownPower(),skin=typeof CastleSkins!=='undefined'?CastleSkins.get(appState.petBattleCastleSkin):null,production=allCells(layout).filter(isProducing),ready=production.filter(cellReady).length;
    const cellMap=new Map(layout.cells.map(c=>[gridKey(c),c]));
    const still=(cell,layer)=>{if(!cell)return'';const def=NightRaidRules.itemById(cell.type),size=NightRaidRules.footprintFor(def);return `<img class="nr-placed ${layer} footprint-${size} ${def.producer?'producer '+def.id:''} ${def.kind?'farm-item '+def.kind:''}" src="${cellArt(cell,def)}" draggable="false" alt="${esc(def.name.vi)} cấp ${cell.tier}" oncontextmenu="return false">${def.kind?'':`<em>${cell.tier}</em>`}${productionBadge(cell)}`;};
    let grid='';for(let gy=0;gy<NightRaidRules.BUILD_GRID;gy++){for(let gx=0;gx<NightRaidRules.BUILD_GRID;gx++){const stand=cellMap.get(gx+':'+gy+':stand'),floor=cellMap.get(gx+':'+gy+':floor');if(!stand&&!floor)continue;grid+=`<div class="nr-build-grid-cell has-stand" data-gx="${gx}" data-gy="${gy}" style="grid-area:${gy+1}/${gx+1}">${still(floor,'floor')}${still(stand,'stand')}</div>`;}}
    const mapBase=builderMapBase(),mapSize=Math.round(mapBase*builderZoom),mapHeight=Math.round(mapBase*.75*builderZoom);
    r.innerHTML=shell(`<main class="nr-builder nr-home-stage ${anyWilted(layout)?'wilted':''}"><section class="nr-builder-world" id="nrBuilderWorld" aria-label="Lâu đài của con giữa đồng cỏ rộng. Kéo một ngón để di chuyển, chụm hai ngón để thu phóng thoải mái từ 3 đến 400 phần trăm."><div class="nr-builder-map nr-estate-map" data-base-size="${mapBase}" style="width:${mapSize}px;height:${mapHeight}px"><img class="nr-board-art" src="img/night-raid/isometric-home-board-frame-v4.png" alt="Hàng rào, cổng và cảnh quan bao quanh khu vườn lâu đài trên một thảm cỏ liền mạch"><img id="nrEquippedCastle" class="nr-equipped-castle" src="img/night-raid/home-castle.webp" alt="${esc((skin&&skin.name.vi)||'Castle skin đang trang bị')}"><div class="nr-home-level"><span><small>CẤP NHÀ</small><strong>${homeLevel}</strong></span><span class="nr-skin-name">${esc((skin&&skin.name.vi)||'Thành Đá')}</span></div><div class="nr-free-grid" aria-hidden="true">${grid}</div></div></section><div class="nr-builder-hud"><button class="nr-builder-home" type="button" onclick="closeNightRaid()" aria-label="Đóng Cướp Đêm">${svg('close')}</button><div class="nr-builder-power damage"><small>DAM</small><strong>${power.damage}</strong></div><div class="nr-builder-power defense"><small>DEF</small><strong>${power.defense}</strong></div><div class="nr-builder-power soldiers"><small>LÍNH</small><strong>${power.soldiers}</strong></div><div class="nr-builder-power coins">${svg('coin')}<strong>${Math.max(0,Math.floor(+appState.coins||0))}</strong></div></div>${taskBarHtml(layout)}<div class="nr-builder-zoom" role="group" aria-label="Thu phóng khu vườn thoải mái từ 3 đến 400 phần trăm"><button type="button" onclick="nrZoomBuilder(-.15)" aria-label="Thu nhỏ khu vườn">−</button><span data-nr-zoom>${Math.round(builderZoom*100)}%</span><button type="button" onclick="nrZoomBuilder(.15)" aria-label="Phóng to khu vườn">+</button></div><button class="nr-yard-clean" type="button" data-nr-clean hidden onclick="nrCleanYard()" aria-label="Dọn phân chó trong sân">🗑️<span>DỌN PHÂN</span><b>0</b></button><div class="nr-home-fabs"><button class="nr-home-fab raid" type="button" onclick="nrShowLiveTargets()">${svg('moon')}<span>CƯỚP ĐÊM</span></button><button class="nr-home-fab" type="button" onclick="nrShowBuilder()">${svg('hammer')}<span>XÂY NHÀ</span></button><button class="nr-home-fab" type="button" onclick="nrShowReports()">${svg('shield')}<span>NHẬT KÝ</span></button><button class="nr-home-fab armory" type="button" onclick="nrOpenArmory()" aria-label="Kho Khiên và Kiếm"><b class="nr-fab-emoji" aria-hidden="true">⚔️</b><span>VŨ KHÍ</span>${(appState.dailyTask&&Array.isArray(appState.dailyTask.pending)&&appState.dailyTask.pending.length)?`<i class="nr-fab-badge" aria-label="${appState.dailyTask.pending.length} phần thưởng chờ chọn">${appState.dailyTask.pending.length}</i>`:''}</button></div>${production.length?(anyWilted(layout)&&!ready?`<button class="nr-collect-all wilted" type="button" onclick="nrGoLearn()">${svg('coin')}<span><strong>VÀO HỌC ĐỂ CÂY TƯƠI</strong><small>cây héo không hái được · xong nhiệm vụ là tươi lại</small></span></button>`:`<button class="nr-collect-all ${ready?'ready':''}" type="button" onclick="nrCollectResources()" ${ready?'':'disabled'}>${svg('coin')}<span><strong>${ready?'THU HOẠCH '+ready:'ĐANG SẢN XUẤT'}</strong><small>${power.soldiers} lính · ${production.length} công trình</small></span></button>`):''}${replantHtml()}<div class="nr-builder-tip" role="status">Thu nhỏ để thấy đồng cỏ · kéo để khám phá</div>${lockChip(homeShieldUntil,'KHIÊN ĐÊM ĐANG BẬT · AI CƯỚP CŨNG THUA','home')}${homeShieldUntil>Date.now()?'':lockChip(homeLockedUntil,'NHÀ ĐANG ĐƯỢC BẢO VỆ · KHÔNG AI CƯỚP ĐƯỢC','home')}</main>`);
    paintEquippedCastle();centerBuilderWorld();setupBuilderGestures();startProductionTicker();
  }

    // Scouting IS the battlefield, and both look like the island home: the
  // opponent's board fills the whole screen inside the same pannable world,
  // the controls float as compact chips/fabs, and TIẾN QUÂN starts the fight
  // IN PLACE on this very canvas — no screen swap, the result popup drops
  // over the final frame. Enemy DEF stays hidden until the attack begins.
  function scout(target){cleanup();view='scout';raidStage={online:true,committed:false};const r=root();if(!r)return;
    const mine=ownPower();target.attackerDamage=target.attackerDamage||mine.damage;target.attackerDefense=target.attackerDefense||mine.defense;target.attackerSoldiers=Number.isFinite(+target.attackerSoldiers)?Math.max(0,Math.min(NightRaidRules.SOLDIER_SANITY_CAP,Math.trunc(+target.attackerSoldiers))):mine.soldiers;
    const name=(target.title&&target.title.vi)||target.name||'Nhà đối thủ',locked=!!lockLeft(target.lockedUntil);
    // Open on the WHOLE enemy board: at the home zoom the 1180px board showed
    // a third of itself, the castle cut off at the left edge and the muster
    // off-screen to the right. Fit it (see scoutFitZoom); pinch to inspect.
    const mapBase=typeof innerWidth!=='undefined'&&innerWidth>=768?1500:1180;builderScroll=null;builderZoom=scoutFitZoom(mapBase);const mapSize=Math.round(mapBase*builderZoom);
    r.innerHTML=shell(`<main class="nr-builder nr-scout-stage" id="nrBattleRoot"><section class="nr-builder-world" id="nrBuilderWorld" aria-label="Toàn cảnh lâu đài đối thủ. Kéo một ngón để di chuyển, chụm hai ngón để thu phóng."><div class="nr-builder-map nr-scout-map" data-base-size="${mapBase}" style="width:${mapSize}px;height:${mapSize}px"><canvas id="nrScoutCanvas" class="nr-scout-canvas" width="800" height="800" aria-label="Lâu đài đối thủ, pet đội trưởng và ${target.attackerSoldiers} lính đang dàn quân"></canvas></div></section><div class="nr-builder-hud"><button class="nr-builder-home" type="button" onclick="nrQuitRaid()" aria-label="Chọn nhà khác">${svg('map')}</button><div class="nr-builder-power damage"><small>DAM TA</small><strong>${target.attackerDamage}</strong></div><div class="nr-builder-power soldiers"><small>LÍNH</small><strong>${target.attackerSoldiers}</strong></div><div class="nr-builder-power defense" id="nrScoutDef" hidden><small>DEF ĐỊCH</small><strong>?</strong></div></div><div class="nr-scout-name-pill">${svg('shield')}<span>${esc(name)}</span></div><div class="nr-home-fabs"><button class="nr-home-fab raid" type="button" id="nrStartRaid" ${locked?'disabled hidden':''}>${svg('moon')}<span>TIẾN QUÂN</span></button>${locked?lockChip(target.lockedUntil,'NHÀ VỪA BỊ PHÁ · CƯỚP LẠI SAU','scout'):''}</div><div class="nr-scout-secret" id="nrScoutSecret" ${locked?'hidden':''}>🔒 DEF nhà địch là bí mật — tiến quân mới biết!</div><div class="nr-battle-status" id="nrBattleStatus" role="status" hidden></div><div class="nr-pop-host" data-nr-pop-host></div></main>`);
    setNav(true);
    // ARM THE BUTTON FIRST. Everything below is preview, camera and ticker —
    // decoration. When one of them threw, this line never ran and the child
    // was left tapping a dead TIẾN QUÂN; the raid was unplayable.
    const startBtn=document.getElementById('nrStartRaid');
    if(startBtn)startBtn.onclick=()=>{const b=document.getElementById('nrStartRaid');if(b){b.disabled=true;b.classList.add('charging');}startRaid(target,true);};
    const canvas=document.getElementById('nrScoutCanvas');
    try{previewGame=new NightRaidGame.AutoBattle(canvas,target,{reduceEffects:true,pet:raidPetDescriptor()});previewGame.start();}catch(e){console.warn('Night Raid preview',e);}
    builderScroll=null;centerBuilderWorld();setupBuilderGestures();startProductionTicker();
  }
  // The zoom at which the square 800-board fits the screen with a little
  // letterbox (94% of the short side, the long side capped at 80% so the HUD
  // chips and the status pill never cover the board). Castle AND muster are
  // on screen before the first step; the Phaser camera then does the
  // cinematic framing INSIDE this box (NightRaidPhaser.cameraFrame).
  function scoutFitZoom(base){const w=typeof innerWidth!=='undefined'&&innerWidth>0?innerWidth:390,h=typeof innerHeight!=='undefined'&&innerHeight>0?innerHeight:w*2;return Math.max(ESTATE_MIN_ZOOM,Math.min(ESTATE_MAX_ZOOM,Math.min(w,h*.8)*.94/Math.max(1,base)));}
  // TIẾN QUÂN re-frames the board even if the child pinched around while
  // scouting: the fight must start with the whole field in view.
  function frameBattleWorld(){const map=document.querySelector('#nrBuilderWorld .nr-scout-map');if(!map)return;builderScroll=null;builderZoom=scoutFitZoom(+map.dataset.baseSize||1180);setBuilderZoom(builderZoom);centerBuilderWorld();}

  // TIẾN QUÂN is disabled by its own onclick before the request leaves, and
  // the ONLY thing that ever switched it back on was updateLockTimers firing
  // on a [data-nr-lock-until] chip — which the live scout never renders. So a
  // child out of tickets (a 429, and the common case: the rows still invite
  // them to attack) was left staring at a dead grey button until they found
  // the small map icon. Every refusal hands it back now.
  function armStartButton(){const b=document.getElementById('nrStartRaid');if(b){b.disabled=false;b.classList.remove('charging');}}
  async function startRaid(target,online){
    if(online&&!target.raidId){
      // Push the wallet BEFORE the server snapshots it. A defeat costs
      // min(server mirror, loss) and the mirror is only as fresh as the last
      // PUT — a child who had just emptied their purse in the shop paid
      // nothing for losing, and the defender was handed coins out of a pile
      // that did not exist.
      try{await syncHome();}catch(e){/* offline: the raid can still be scored */}
      const start=await api('start',{method:'POST',body:{targetId:target.targetId}});
      if(start.ok&&start.data&&start.data.ruined&&!start.data.raid)return playRuinedRaid(target,start.data);
      if(!start.ok||!start.data||!start.data.raid){
        armStartButton();
        const data=start.data||{};
        // The server answers a house on cooldown with 409 {error, retryAt};
        // the old code looked for a `locked` key no handler has ever sent, so
        // this branch was dead and every refusal fell through to one toast.
        const retryAt=retryAtOf(data)||data.lockedUntil;
        if(retryAt&&lockLeft(retryAt)){if(typeof showToast==='function')showToast('Con phải chờ thêm '+productionTime(lockLeft(retryAt))+' nữa mới vào lại nhà này');return showLiveTargets();}
        if(typeof showToast==='function')showToast(data.error||'Không thể bắt đầu raid');
        return;
      }
      Object.assign(target,start.data.raid);rememberPendingRaid(target.raidId);}
    const canvas=document.getElementById('nrScoutCanvas');if(!canvas)return;
    view='battle';raidStage={online:!!online,committed:!!online};if(previewGame){previewGame.destroy();previewGame=null;}
    frameBattleWorld();
    const army=ownPower();target.attackerDamage=target.attackerDamage||army.damage;target.attackerSoldiers=Number.isFinite(+target.attackerSoldiers)?Math.max(0,Math.min(NightRaidRules.SOLDIER_SANITY_CAP,Math.trunc(+target.attackerSoldiers))):army.soldiers;target.defense=target.defense||NightRaidRules.combatPower(target.layout,target.dogLevel).defense;
    // Attacking is how the child EARNS the number: the hidden DEF chip fills
    // in, the secret pill and the one button leave, the army marches here.
    const def=document.getElementById('nrScoutDef');if(def){def.hidden=false;const strong=def.querySelector('strong');if(strong)strong.textContent=target.shielded?'🛡️ KHIÊN':target.defense;}
    document.getElementById('nrScoutSecret')?.remove();
    document.getElementById('nrStartRaid')?.closest('.nr-home-fabs')?.remove();
    const status=document.getElementById('nrBattleStatus');if(status){status.hidden=false;status.textContent='Đang dàn quân…';}
    const options={pet:raidPetDescriptor(),onUpdate:updateHud,onFinish:(state,commands)=>finishRaid(target,state,commands)};
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
        // start() decodes eight sprite sheets and boots Phaser, and the child
        // can hit the map button and confirm during it. cleanup() then called
        // destroy() on a `game` that was still null, so the instance created
        // on the line above was unreachable — an orphaned RAF loop rendering
        // forever into a detached host, one per abandoned raid.
        if(view!=='battle'){if(game){game.destroy();game=null;}return;}
      }catch(error){console.warn('Night Raid Phaser fallback',error);if(game){game.destroy();game=null;}if(phaserHost&&phaserHost.isConnected)phaserHost.replaceWith(canvas);}
    }
    // A blocked/unsupported runtime must never strand a paid raid: the old
    // renderer produces the same deterministic result and reward callback.
    // Same reason: without this the fallback renderer was built on a canvas
    // that had already been detached, while `view` was back on the target list.
    if(view!=='battle')return;
    if(!game){game=new NightRaidGame.AutoBattle(canvas,target,options);game.start();}
    if(status)status.textContent=`Pet và ${target.attackerSoldiers} lính đang tiến quân`;
    setTimeout(()=>{if(view==='battle'&&game&&game.charge)chargeArmy();},700);
  }
  function updateHud(state){const status=document.getElementById('nrBattleStatus'),battle=document.getElementById('nrBattleRoot');if(status)status.textContent=state.status==='ready'?`Pet và ${state.soldiers||0} lính đang tiến quân`:state.status==='fighting'?'Đang chém phá cổng thành!':state.status==='won'?'Đã phá được lâu đài!':'Đội hình buộc phải rút lui';if(battle){battle.classList.toggle('is-fighting',state.status==='fighting');battle.classList.toggle('is-won',state.status==='won');battle.classList.toggle('is-lost',state.status==='lost');}}
  function chargeArmy(){if(game&&game.charge()){announce('Chó đội trưởng dẫn toàn quân tiến lên');if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate([18,25,18]);}}
  function announce(text){const live=document.getElementById('nrLive');if(live)live.textContent=text;}
  // Night Raid is one full-screen game mode. Keep the app nav hidden from the
  // garden all the way through scouting, combat, reports and results; the X in
  // the Night Raid chrome is the single predictable exit. Restore the nav only
  // when close() hands control back to Arena.
  function setNav(hidden){const nav=document.getElementById('bottomNav');if(nav)nav.style.display=hidden?'none':'';}
  // The map button on the raid stage. It used to go straight to nrHome() /
  // nrShowLiveTargets(); this function existed with the right question in it
  // and NOTHING ever called it.
  function quit(){
    if(!confirmLeaveRaid())return;
    const online=!!(raidStage&&raidStage.online);
    abandonRaid();cleanup();
    if(online)return showLiveTargets();
    renderHome();
  }

  // Every raid is a raid on a real house, so every raid is scored by the
  // server: /api/night-raid/finish is the ONLY place coins move.
  function finishRaid(target,state,commands){return finishOnline(target,state,commands);}
  // Game-style ending: the battlefield STAYS on screen — the child keeps the
  // final frame (breach or retreat) as the backdrop while a victory/defeat
  // popup drops in over it, the way the big mobile games end a fight. The old
  // full-page renderer survives below as the fallback for any path where the
  // battle DOM is already gone.
  function resultActionsHTML(){return `<button class="nr-primary" type="button" onclick="nrShowLiveTargets()">Cướp nhà khác</button><button class="nr-secondary" type="button" onclick="nrHome()">Về nhà</button>`;}
  const foeName=t=>String((t&&t.title&&t.title.vi)||(t&&t.name)||'Nhà đối thủ');
  // Losing now MOVES the coins: /finish hands the defender what the attacker
  // dropped, and reports it as `defenderGain`. "-20 xu phí hành quân" alone hid
  // that — the xu went somewhere, and the somewhere has a name on it.
  const lossHTML=(loss,gain,target)=>`<div class="nr-loss">-${loss} xu phí hành quân${gain>0?`<small>${esc(foeName(target))} đã lấy ${gain} xu này.</small>`:''}</div>`;
  function renderResult(target,state,stars,reward,loss=0){cleanup();settleRaid();view='result';
    const wrap=document.querySelector('[data-nr-pop-host]')||document.querySelector('#nrBattleRoot .nr-canvas-wrap');
    if(!wrap)return renderResultPage(target,state,stars,reward,loss);
    const won=state.status==='won';
    const command=document.querySelector('#nrBattleRoot .nr-auto-command');if(command)command.classList.add('hidden');
    const status=document.getElementById('nrBattleStatus');if(status)status.remove();
    const old=document.getElementById('nrResultPop');if(old)old.remove();
    const pop=document.createElement('div');pop.id='nrResultPop';pop.className='nr-result-pop '+(won?'won':'lost');pop.setAttribute('role','dialog');pop.setAttribute('aria-modal','true');pop.setAttribute('aria-label','Kết quả Cướp Đêm');
    // The banner hangs above the card edge, so the card itself must never
    // clip (overflow lives on .nr-pop-body) — or the headline loses its top.
    pop.innerHTML=`<div class="nr-pop-scrim"></div><div class="nr-pop-card"><div class="nr-pop-banner">${won?'CHIẾN THẮNG!':'THẤT BẠI'}</div><div class="nr-pop-body"><div class="nr-result-crest">${svg(won?'castle':'shield')}</div>${won?`<div class="nr-result-stars" aria-label="${stars} sao">${[1,2,3].map(i=>`<i class="${i<=stars?'on':''}" style="animation-delay:${(.25+i*.18).toFixed(2)}s"></i>`).join('')}</div>`:''}<p>${won?'DAM quân ta cao hơn DEF đối thủ — lâu đài đã bị phá và kho xu đã được mang về!':((state.shielded||target.shielded)?'Nhà này đang bật Khiên Đêm — mạnh mấy cũng thua, cả đội mất 200 xu.':'DEF đối thủ cao hơn DAM quân ta — cả đội rút lui để bảo toàn lực lượng.')}</p><div class="nr-result-score"><div><span>DAM QUÂN TA</span><strong>${state.damage||target.attackerDamage}</strong></div><b>${won?'>':'≤'}</b><div><span>DEF NHÀ ĐỊCH</span><strong>${(state.shielded||target.shielded)?'🛡️ KHIÊN':(state.defense||target.defense)}</strong></div></div>${won?`<div class="nr-reward">${svg('coin')}<span>+${reward} xu đã cướp</span></div>`:lossHTML(loss,Math.max(0,+state.defenderGain||0),target)}<div class="nr-result-actions">${resultActionsHTML()}</div></div></div>`;
    // Let the final frame breathe for a beat before the banner drops.
    setTimeout(()=>{if(view!=='result')return;wrap.appendChild(pop);announce(won?'Phá thành thành công':'Đội hình thất bại');if(won&&typeof createConfetti==='function'){try{createConfetti();}catch(e){}}},650);
  }
  function renderResultPage(target,state,stars,reward,loss=0){settleRaid();setNav(true);const r=root();if(!r)return;const won=state.status==='won';r.innerHTML=shell(`<main class="nr-result ${won?'won':'lost'}"><div class="nr-result-crest">${svg(won?'castle':'shield')}</div><span class="nr-label">KẾT QUẢ CƯỚP ĐÊM</span><h2>${won?'PHÁ THÀNH THÀNH CÔNG!':'ĐỘI HÌNH THẤT BẠI'}</h2><p>${won?'DAM của quân ta cao hơn DEF đối thủ. Lâu đài đã bị phá và kho xu đã được mang về.':((state.shielded||target.shielded)?'Nhà này đang bật Khiên Đêm. Mạnh mấy cũng thua, cả đội mất 200 xu.':'DEF đối thủ cao hơn DAM quân ta. Cả đội đã rút lui để bảo toàn lực lượng.')}</p><section class="nr-result-score"><div><span>DAM QUÂN TA</span><strong>${state.damage||target.attackerDamage}</strong></div><b>${won?'>':'≤'}</b><div><span>DEF NHÀ ĐỊCH</span><strong>${(state.shielded||target.shielded)?'🛡️ KHIÊN':(state.defense||target.defense)}</strong></div></section>${won?`<div class="nr-result-stars" aria-label="${stars} sao">${[1,2,3].map(i=>`<i class="${i<=stars?'on':''}"></i>`).join('')}</div><div class="nr-reward">${svg('coin')}<span>+${reward} xu đã cướp</span></div>`:lossHTML(loss,Math.max(0,+state.defenderGain||0),target)}<div class="nr-result-actions">${resultActionsHTML()}</div></main>`);}

  // ---- "nhà đã tan hoang" -------------------------------------------------
  // POST /start answers 200 with {ruined:true,retryAt,castleSkin,name,
  // homeLevel} and NO raid when somebody robbed this house before us. Nothing
  // is charged: no ticket, no coin, either way. The wrong ending for that is a
  // red error toast — the child picked a house, tapped TIẾN QUÂN and is owed
  // the reason the night came to nothing. So the troops march in, find rubble
  // and turn around (js/night-raid-ruins.js draws it), and only then does a
  // result card drop, in the same family as CHIẾN THẮNG and THẤT BẠI.
  function destroyRuins(){if(ruinsShow){try{ruinsShow.destroy();}catch(e){}ruinsShow=null;}}
  function playRuinedRaid(target,data){
    view='ruined';raidStage={online:true,committed:false};
    if(previewGame){previewGame.destroy();previewGame=null;}
    // The same stage teardown TIẾN QUÂN does: the secret pill, the hidden DEF
    // chip and the one button all belong to a fight that will not happen.
    document.getElementById('nrScoutSecret')?.remove();
    document.getElementById('nrStartRaid')?.closest('.nr-home-fabs')?.remove();
    const status=document.getElementById('nrBattleStatus');if(status){status.hidden=false;status.textContent='Quân ta đang tiến vào…';}
    const host=document.getElementById('nrPhaserBattle')||document.getElementById('nrScoutCanvas');
    const done=()=>{if(view==='ruined')renderRuinedResult(target,data);};
    // The animation is a bonus, never the gate. A missing or throwing module
    // must still tell the child what happened and hand back the two buttons.
    if(host&&typeof NightRaidRuins!=='undefined'&&NightRaidRuins&&typeof NightRaidRuins.play==='function'){
      try{ruinsShow=NightRaidRuins.play(host,{castleSkin:data.castleSkin||target.castleSkin||'stone-keep',name:data.name||target.name,homeLevel:data.homeLevel||target.homeLevel},{onFinish:done});}
      catch(error){console.warn('Night Raid ruins',error);ruinsShow=null;done();}
    }else done();
  }
  // 0 xu won and 0 xu lost, said in as many words: a child who has just seen
  // their army walk home needs to be told, plainly, that it cost them nothing.
  function ruinedBodyHTML(target,data){
    const retryAt=retryAtOf(data),name=data.name||target.name||'Nhà này';
    return `<p>Có đội khác tới trước con. ${esc(name)} đã bị phá tan hoang và đang xây lại, nên quân ta quay về tay không — <b>không mất lượt nào, không mất xu nào</b>.</p>`
      +`<div class="nr-result-score nr-ruined-score"><div><span>CƯỚP ĐƯỢC</span><strong>0 xu</strong></div><b>·</b><div><span>BỊ MẤT</span><strong>0 xu</strong></div></div>`
      +(retryAt?`<p class="nr-ruined-when">Con quay lại nhà này được lúc <b>${esc(clockPhrase(retryAt))}</b>.</p>${lockChip(retryAt,'QUAY LẠI SAU','ruined')}`:'')
      +`<div class="nr-result-actions">${resultActionsHTML()}</div>`;
  }
  function renderRuinedResult(target,data){
    settleRaid();view='result';
    document.getElementById('nrBattleStatus')?.remove();
    // NOT cleanup(): the rubble the ruins scene painted is this card's
    // backdrop, exactly as the breached/retreat frame is for win and lose.
    if(productionTicker){clearInterval(productionTicker);productionTicker=null;}
    const wrap=document.querySelector('[data-nr-pop-host]');
    if(!wrap)return renderRuinedResultPage(target,data);
    document.getElementById('nrResultPop')?.remove();
    const pop=document.createElement('div');pop.id='nrResultPop';pop.className='nr-result-pop ruined';
    pop.setAttribute('role','dialog');pop.setAttribute('aria-modal','true');pop.setAttribute('aria-label','Nhà đã tan hoang');
    pop.innerHTML=`<div class="nr-pop-scrim"></div><div class="nr-pop-card"><div class="nr-pop-banner">NHÀ ĐÃ TAN HOANG</div><div class="nr-pop-body"><div class="nr-result-crest">${svg('castle')}</div>${ruinedBodyHTML(target,data)}</div></div>`;
    wrap.appendChild(pop);announce('Nhà đã tan hoang — con không mất xu nào');
    productionTicker=setInterval(updateLockTimers,1000);
  }
  function renderRuinedResultPage(target,data){
    settleRaid();setNav(true);const r=root();if(!r)return;
    r.innerHTML=shell(`<main class="nr-result ruined"><div class="nr-result-crest">${svg('castle')}</div><span class="nr-label">KẾT QUẢ CƯỚP ĐÊM</span><h2>NHÀ ĐÃ TAN HOANG</h2>${ruinedBodyHTML(target,data)}</main>`);
    productionTicker=setInterval(updateLockTimers,1000);
  }

  function totalPaid(def,tier){let n=0;for(let i=1;i<=tier;i++)n+=def.price*i;return n;}
  function buildAsset(def){return def.kind?NightRaidRules.farmRules.art(def.id):'img/night-raid/'+(def.asset||def.id+'.webp');}
  // The farm clock as last heard from the server (GET home, PUT home, collect).
  const farmDay=()=>Math.max(0,Math.trunc(+appState.farmDayCount||0));
  const farmCtx=()=>appState.farmCtx||null;
  function adoptFarmClock(data){if(!data)return;if(typeof data.dayCount==='number'&&Number.isFinite(data.dayCount))appState.farmDayCount=Math.max(0,Math.trunc(data.dayCount));if(data.ctx&&typeof data.ctx==='object')appState.farmCtx={today:String(data.ctx.today||''),doneYesterday:!!data.ctx.doneYesterday,doneToday:!!data.ctx.doneToday};}
  const isCropCell=cell=>NightRaidRules.farmRules.isCrop(cell);
  const isWiltedCell=cell=>NightRaidRules.farmRules.isWilted(cell,farmCtx());
  // Every cell on every board — the castle grid and each extra farm.
  const allCells=layout=>NightRaidRules.farmRules.allCells(layout);
  function cellArt(cell,def){return def.kind==='crop'?NightRaidRules.farmRules.spriteFor(cell,farmDay(),farmCtx()):buildAsset(def);}
  // Ready to collect right now: a ripe FRESH crop, a barracks with a new
  // task-day, or a field past its 24h clock.
  function cellReady(cell){const def=NightRaidRules.itemById(cell.type),F=NightRaidRules.farmRules;if(!def)return false;if(def.kind==='crop'){return F.progress(cell,farmDay()).ripe&&!F.isWilted(cell,farmCtx());}if(def.perTaskDay)return F.barracksReady(cell,farmDay());return !!def.producer&&cell.readyAt<=Date.now();}
  const isProducing=cell=>{const d=NightRaidRules.itemById(cell.type);return !!d&&(!!d.producer||d.kind==='crop');};
  // Any wilted plant on any board. It colours the screen and the task bar, but
  // it may replace the harvest button ONLY when there is genuinely nothing to
  // collect — `anyWilted(layout)&&!ready` in renderHome and renderBuilder.
  // The three coin fields run on their own 24h clock and a barracks on finished
  // task-days; none of them can wilt. On `anyWilted` alone, one wilted crop
  // anywhere — including on a private extra farm board the child is not even
  // looking at — hid THU HOẠCH on BOTH screens, so a ripe field could not be
  // collected from its own button, under copy saying nothing was harvestable.
  // Wilted crops are already left out of `ready` (see cellReady), so the two
  // conditions never disagree about the same plant.
  const anyWilted=layout=>allCells(layout).some(c=>isCropCell(c)&&isWiltedCell(c));
  // Which board the builder is editing: 0 = the castle grid, n = extra farm n.
  function zoneOf(layout,zone){const farms=layout.farms||[];zone=Math.max(0,Math.min(farms.length,Math.trunc(+zone||0)));return zone===0?{zone:0,cells:layout.cells,grid:NightRaidRules.BUILD_GRID,castle:true}:{zone,cells:farms[zone-1].cells,grid:NightRaidRules.farmRules.FARM_PLOT.size,castle:false};}
  function activeZone(layout){const z=zoneOf(layout,builderZone);builderZone=z.zone;return z;}
  const SHOP_TABS=[['defense','Phòng thủ'],['seeds','Hạt giống'],['farm','Nông trại'],['expand','Mở rộng']];
  function shopItems(tab){const F=NightRaidRules.farmRules;return tab==='defense'?NightRaidRules.DEFENSES:tab==='seeds'?F.CROPS:tab==='farm'?F.FARM_BUILDINGS:[];}
  function ownedCount(layout,id){return allCells(layout).filter(c=>c.type===id).length;}
  function shopCardHtml(d,layout){const capped=!!d.buyMax&&ownedCount(layout,d.id)>=d.buyMax,poor=(+appState.coins||0)<d.price;const stats=d.kind==='crop'?`<b class="producer">${d.days} ngày · +${d.yield} xu</b>`:d.kind==='farm'?`<b class="producer">Trang trí · ${d.footprint===2?'4 ô':'1 ô'}</b>`:buildStatHtml(d);
    return `<button type="button" draggable="${capped?'false':'true'}" class="nr-build-item ${selectedBuild===d.id?'selected':''} ${poor?'unaffordable':''} ${capped?'owned-max':''}" ${capped?'disabled':''} onclick="nrSelectBuild('${d.id}')" onpointerdown="nrBeginBuildDrag(event,'${d.id}')" ondragstart="nrNativeBuildDrag(event,'${d.id}')" aria-pressed="${selectedBuild===d.id}"><img class="nr-build-art" src="${buildAsset(d)}" alt=""><span class="nr-build-copy"><strong>${esc(d.name.vi)}</strong><small class="nr-item-stats">${capped?'<b class="producer">Mỗi loại 1 cái</b>':stats}</small><span class="nr-coin-price">${svg('coin')} ${d.price} xu</span></span></button>`;}
  function expandCardHtml(layout){const P=NightRaidRules.farmRules.FARM_PLOT,have=(layout.farms||[]).length,full=have>=P.max,poor=(+appState.coins||0)<P.price;return `<button type="button" class="nr-build-item nr-expand-item ${poor||full?'unaffordable':''}" ${full?'disabled':''} onclick="nrBuyFarmPlot()"><img class="nr-build-art" src="${buildAsset(P)}" alt=""><span class="nr-build-copy"><strong>${esc(P.name.vi)}</strong><small class="nr-item-stats"><b class="producer">Bàn cờ ${P.size}×${P.size} chỉ trồng cây · đã có ${have}/${P.max}</b></small><span class="nr-coin-price">${svg('coin')} ${P.price} xu</span></span></button>`;}
  function shopTabsHtml(zone){const tabs=SHOP_TABS.filter(([id])=>zone.zone===0||id!=='defense');return `<div class="nr-shop-tabs" role="tablist">${tabs.map(([id,label])=>`<button type="button" role="tab" class="${builderShopTab===id?'active':''}" aria-selected="${builderShopTab===id}" onclick="nrSelectShopTab('${id}')">${label}</button>`).join('')}</div>`;}
  function trayHtml(layout,zone){if(zone.zone>0&&builderShopTab==='defense')builderShopTab='seeds';if(builderShopTab==='expand')return expandCardHtml(layout);return shopItems(builderShopTab).map(d=>shopCardHtml(d,layout)).join('');}
  function zoneChipsHtml(layout){const farms=layout.farms||[];if(!farms.length)return'';const chips=[['LÂU ĐÀI',0]].concat(farms.map((f,i)=>['NÔNG TRẠI '+(i+1),i+1]));return `<div class="nr-zone-chips" role="tablist" aria-label="Chọn khu đất">${chips.map(([label,z])=>`<button type="button" role="tab" class="${builderZone===z?'active':''}" aria-selected="${builderZone===z}" onclick="nrSelectZone(${z})">${label}</button>`).join('')}</div>`;}
  // The one sentence every farm screen leads with: what today's tasks are
  // doing to the plants. Reads appState.dailyTask (kept fresh by
  // js/daily-task.js) and the wilt context the server sent.
  function taskBarHtml(layout){const s=(typeof DailyTask!=='undefined'&&DailyTask&&typeof DailyTask.state==='function')?DailyTask.state():(appState.dailyTask||null);const tasks=(s&&Array.isArray(s.tasks))?s.tasks:[],done=tasks.filter(t=>t&&t.done).length,allDone=tasks.length>0&&!!(s&&s.allDone),wilted=anyWilted(layout);
    const text=!tasks.length?'Hôm nay chưa có nhiệm vụ — cây đứng chờ':allDone?'Cây đã lớn hôm nay 🌱 · mai làm tiếp':wilted?`Cây đang héo 🥀 · xong ${tasks.length} nhiệm vụ là tươi lại`:`Hôm nay ${done}/${tasks.length} nhiệm vụ · xong hết là cây lớn thêm 1 ngày`;
    // While anything is wilted the child must ALWAYS have a way into the tasks
    // (spec 5.1.3). The harvest button only turns into VÀO HỌC ĐỂ CÂY TƯƠI when
    // nothing at all is ready, so a child with a ripe field and either no tasks
    // assigned or all of them already done was left looking at a dead garden
    // with no button to press. `wilted` keeps the CTA here in those two cases.
    const cta=(wilted||(!allDone&&tasks.length))?`<button type="button" class="nr-task-go" onclick="nrGoLearn()">Vào học</button>`:'';
    return `<div class="nr-task-bar ${allDone?'done':''} ${wilted?'wilted':''}" role="status"><span>${text}</span>${cta}</div>`;}
  // Out of Cướp Đêm and into the task list. A committed raid still asks first.
  function goLearn(){if(!confirmLeaveRaid())return;abandonRaid();cleanup();setNav(false);if(typeof DailyTask!=='undefined'&&DailyTask&&typeof DailyTask.open==='function')DailyTask.open();else if(typeof switchScreen==='function')switchScreen('dailyTaskScreen');}
  function selectShopTab(tab){if(!SHOP_TABS.some(([id])=>id===tab))return;builderShopTab=tab;builderShopOpen=true;rememberBuilderWorld();renderBuilder();}
  function selectZone(zone){rememberBuilderWorld();builderZone=Math.max(0,Math.trunc(+zone||0));builderEditing=false;renderBuilder();}
  function buyFarmPlot(confirmed){const P=NightRaidRules.farmRules.FARM_PLOT,layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),have=layout.farms.length,balance=Math.max(0,Math.floor(+appState.coins||0));
    if(have>=P.max){if(typeof showToast==='function')showToast('Con đã có đủ '+P.max+' nông trại riêng');return;}
    if(balance<P.price){if(typeof showToast==='function')showToast('Chưa đủ '+P.price+' xu để mua '+P.name.vi);return;}
    const plan={id:P.id,def:P,cost:P.price,refund:0,remove:false,balance,balanceAfter:balance-P.price,title:'Mua '+P.name.vi+' thứ '+(have+1)+'?',detail:`Một bàn cờ ${P.size}×${P.size} riêng, chỉ trồng cây và dựng công trình nông trại. Không bị cướp.`};
    if(!confirmed){showBuildPurchase(plan);return;}
    appState.coins=balance-P.price;layout.farms.push({cells:[]});appState.nightRaidLayout=NightRaidRules.normalizeLayout(layout);builderZone=layout.farms.length;builderShopTab='seeds';builderEditing=false;builderShopOpen=false;save();syncHome();if(typeof showToast==='function')showToast('Đã mua '+P.name.vi+' · còn '+Math.floor(appState.coins)+' xu');announce('Đã mua nông trại riêng');renderBuilder();}
  function buildStatHtml(def){const parts=[];if(def.attack)parts.push(`<b class="damage">+${def.attack} DAM</b>`);if(def.defense)parts.push(`<b class="defense">+${def.defense} DEF</b>`);if(def.producer==='soldier')parts.push('<b class="producer">1 lính/ngày · +20 DAM</b>');if(def.producer==='coins')parts.push(`<b class="producer">+${def.yield} xu/ngày</b>`);return parts.join('');}
  function productionBadge(cell){const def=NightRaidRules.itemById(cell.type);if(!def)return'';const F=NightRaidRules.farmRules;
    if(def.kind==='crop'){const p=F.progress(cell,farmDay()),wilted=F.isWilted(cell,farmCtx()),fresh=p.ripe&&!wilted;const label=wilted?'HÉO':p.ripe?`CHÍN · +${def.yield} XU`:`còn ${p.left} ngày`;return `<span class="nr-production-badge shown ${fresh?'ready':''} ${wilted?'wilted':''}" data-static-ready="${fresh?1:0}" data-producer-uid="${esc(cell.uid||'')}">${label}</span>`;}
    if(def.kind||!def.producer)return'';
    if(def.perTaskDay){const ready=F.barracksReady(cell,farmDay());return `<span class="nr-production-badge shown ${ready?'ready':''}" data-static-ready="${ready?1:0}" data-producer-uid="${esc(cell.uid||'')}">${ready?'NHẬN LÍNH':'chờ nhiệm vụ'}</span>`;}
    const ready=cell.readyAt<=Date.now(),label=`+${def.yield} XU`;return `<span class="nr-production-badge ${ready?'ready':''}" data-ready-at="${cell.readyAt}" data-ready-label="${label}" data-producer-uid="${esc(cell.uid||'')}">${ready?label:'24:00:00'}</span>`;}
  function placedHtml(cell,layer,gx,gy){if(!cell)return'';const def=NightRaidRules.itemById(cell.type),size=NightRaidRules.footprintFor(def);return `<img class="nr-placed ${layer} footprint-${size} ${def.producer?'producer '+def.id:''} ${def.kind?'farm-item '+def.kind:''}" src="${cellArt(cell,def)}" draggable="false" alt="${esc(def.name.vi)}, chiếm ${size} × ${size} ô, kéo để đổi vị trí" oncontextmenu="return false" onpointerdown="nrBeginPlacedDrag(event,${gx},${gy},'${layer}')">${def.kind?'':`<em>${cell.tier}</em>`}${productionBadge(cell)}`;}
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
  // Đội hình duyệt binh nằm trong NightRaidRules.armySlots: khoảng cách phải
  // lớn hơn bề ngang con lính, nếu không 4 lính chồng lên nhau thành 2.
  const armySlots=count=>NightRaidRules.armySlots(count);
  function yardArmyHtml(){const total=Math.max(0,Math.trunc(+appState.nightRaidLayout?.soldiers||0)),count=Math.min(NightRaidRules.ARMY_DISPLAY_CAP,total);if(!count)return'';return `<div class="nr-yard-army" data-nr-yard-army data-mode="march" data-total="${total}" aria-label="${total>count?`Đội hình ${total} lính đang duyệt binh, bãi cỏ hiện ${count} con`:`Đội hình ${count} lính đang duyệt binh trên bãi cỏ`}"><div class="nr-army-trail" data-nr-army-trail aria-hidden="true"></div>${armySlots(count).map((s,i)=>`<i class="nr-home-soldier" data-unit="${i}" data-row="${s.row}" style="--nr-slot-x:${s.x}%;--nr-slot-y:${s.y}%;--nr-unit-position:0% ${s.row*20}%"><b aria-hidden="true"></b></i>`).join('')}</div>`;}
  function yardBuildingsHtml(){const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),cellMap=new Map(layout.cells.map(c=>[c.gx+':'+c.gy+':'+(NightRaidRules.itemById(c.type).trap?'floor':'stand'),c]));const still=(cell,layer)=>{if(!cell)return'';const def=NightRaidRules.itemById(cell.type),size=NightRaidRules.footprintFor(def);return `<img class="nr-placed ${layer} footprint-${size} ${def.producer?'producer '+def.id:''} ${def.kind?'farm-item '+def.kind:''}" src="${cellArt(cell,def)}" alt="" draggable="false">${def.kind?'':`<em>${cell.tier}</em>`}`;};let grid='';for(let gy=0;gy<NightRaidRules.BUILD_GRID;gy++)for(let gx=0;gx<NightRaidRules.BUILD_GRID;gx++){const stand=cellMap.get(gx+':'+gy+':stand'),floor=cellMap.get(gx+':'+gy+':floor');if(stand||floor)grid+=`<div class="nr-build-grid-cell" style="grid-area:${gy+1}/${gx+1}">${still(floor,'floor')}${still(stand,'stand')}</div>`;}return `<div class="nr-free-grid nr-home-layout" aria-hidden="true">${grid}</div>`;}
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
  function paintEquippedCastle(targetId='nrEquippedCastle'){const image=document.getElementById(targetId);if(!image)return;const map=image.closest('.nr-builder-map'),board=map?.querySelector('.nr-board-art');if(board){const fullEstate=map.classList.contains('nr-estate-map');board.src=fullEstate?'img/night-raid/isometric-home-board-frame-v4.png':'img/night-raid/isometric-home-board-unified-gate-v3.webp';board.alt=fullEstate?'Hàng rào và cổng lâu đài trên một thảm cỏ liền mạch':'Khu vườn lâu đài hình chữ nhật có cổng chính cho đội cướp tiến vào';}const skin=appState.petBattleCastleSkin||'stone-keep',render=()=>{if(!image.isConnected)return;const logicalWidth=400,logicalHeight=340,quality=(typeof devicePixelRatio!=='undefined'&&devicePixelRatio>=2)?4:3,canvas=document.createElement('canvas');canvas.width=logicalWidth*quality;canvas.height=logicalHeight*quality;const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(quality,0,0,quality,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';NightRaidArt.drawCastle(ctx,logicalWidth/2,logicalHeight-16,skin,100,100,0);try{image.src=trimmedCanvasUrl(canvas,8*quality);}catch(_){image.src='img/night-raid/home-castle.webp';}};render();if(typeof CastleSkins!=='undefined'&&CastleSkins.preload)CastleSkins.preload(render);}
  function builderMapBase(){return 1600;}
  // The build screen opens at 60%: at 100% a phone showed nine of the 144 land
  // cells at a time and a child had to pan to find their own castle. At 60% a
  // land cell is still 61 x 48 css px — above the 44px a fingertip needs — and
  // the zoom buttons and pinch still reach the full camera range.
  // The raid stage (scout → battle → result) keeps its own camera bucket:
  // pinching the enemy board used to overwrite the HOME zoom, so the child's
  // own island came back the size the fight had been framed at.
  const viewKey=v=>(v==='builder'?'builder':(v==='scout'||v==='battle'||v==='result')?'scout':'home');
  function zoomFor(v){return builderZoomByView[viewKey(v)];}
  function applyViewZoom(v){builderZoom=zoomFor(v);builderScroll=builderScrollByView[viewKey(v)];}
  function gridKey(cell){return cell.gx+':'+cell.gy+':'+(NightRaidRules.itemById(cell.type).trap?'floor':'stand');}
  function buildRect(cell){const def=NightRaidRules.itemById(cell.type);return{gx:+cell.gx,gy:+cell.gy,size:NightRaidRules.footprintFor(def),layer:def.trap?'floor':'stand'};}
  function buildSpaceFree(layout,gx,gy,size,layer,ignoreCell,includeCastle=true){
    const z=activeZone(layout),G=z.grid,candidate={gx:+gx,gy:+gy,size:+size};
    if(candidate.gx<0||candidate.gy<0||candidate.gx+size>G||candidate.gy+size>G)return false;
    if(includeCastle&&z.castle&&layer==='stand'){
      const castle=layout.castleCell||CASTLE_HOME;
      if(NightRaidRules.rectsOverlap(candidate,{gx:+castle.gx,gy:+castle.gy,size:CASTLE_SIZE}))return false;
    }
    return !z.cells.some(cell=>cell!==ignoreCell&&buildRect(cell).layer===layer&&NightRaidRules.rectsOverlap(candidate,buildRect(cell)));
  }
  function footprintOwner(layout,gx,gy,layer){return activeZone(layout).cells.find(cell=>{const box=buildRect(cell);return box.layer===layer&&gx>=box.gx&&gx<box.gx+box.size&&gy>=box.gy&&gy<box.gy+box.size;})||null;}
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
      const def=NightRaidRules.itemById(cell.type);
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
  // Lane changes used to assign state.y=66/74/82 in one tick. That moved the
  // whole formation up to sixteen percent of the lawn in 120ms and looked
  // exactly like teleporting. Advance toward a target lane at walking speed,
  // validating every intermediate step against the current garden instead.
  function advanceArmyLane(state,slots,dt){
    if(!Number.isFinite(state.targetY)||Math.abs(state.targetY-state.y)<.03){state.targetY=null;return;}
    const step=Math.sign(state.targetY-state.y)*Math.min(Math.abs(state.targetY-state.y),5.2*dt),nextY=state.y+step;
    if(armyClearAt(petBlockedRects(),state.x,nextY,slots))state.y=nextY;
    else state.targetY=null;
  }
  function placeArmyParade(army,state,now){army.dataset.mode=state.mode;army.style.setProperty('--nr-army-x',state.x.toFixed(2)+'%');army.style.setProperty('--nr-army-y',state.y.toFixed(2)+'%');army.style.setProperty('--nr-army-dir',state.dir);army.querySelectorAll('[data-unit]').forEach((unit,i)=>{const row=Math.max(0,Math.min(5,+unit.dataset.row||0));if(state.mode==='march'){const frame=(Math.floor(now/120)+i*2)%6;unit.style.setProperty('--nr-unit-position',(frame*20)+'% '+(row*20)+'%');unit.style.setProperty('--nr-gait-phase',((frame%3)-1));}else{const frame=state.mode==='attention'?6:7;unit.style.setProperty('--nr-unit-position',(frame*(100/7))+'% '+(row*20)+'%');unit.style.setProperty('--nr-gait-phase',0);}});}
  const ARMY_PRINT_MS=230;
  function spawnArmyTrail(layer,state,slots,now){
    if(!layer||state.mode!=='march'||now-(state.trailAt||0)<ARMY_PRINT_MS)return;
    state.trailAt=now;state.trailSide=state.trailSide===1?-1:1;
    while(layer.childElementCount>34)layer.firstElementChild.remove();
    // Sample the formation rather than creating ten DOM nodes every tick.
    // Both rows stay visibly grounded without slowing down low-end phones.
    const sampled=slots.length<=4?slots:slots.filter((_,i)=>i===0||i===Math.floor(slots.length/2)||i===slots.length-1);
    sampled.forEach((slot,i)=>{const print=document.createElement('i');print.className='nr-army-print';print.style.cssText=`left:${(state.x+slot.x).toFixed(2)}%;top:${(state.y+slot.y+.5).toFixed(2)}%;--nr-army-step:${state.trailSide*(i%2?-.32:.32)}cqw;--nr-army-angle:${state.dir<0?'180deg':'0deg'}`;print.addEventListener('animationend',()=>print.remove(),{once:true});layer.appendChild(print);});
    if(now-(state.dustAt||0)>=420){state.dustAt=now;const tail=sampled[state.dir>0?0:sampled.length-1]||{x:0,y:0},dust=document.createElement('b');dust.className='nr-army-dust';dust.style.cssText=`left:${(state.x+tail.x-state.dir*1.15).toFixed(2)}%;top:${(state.y+tail.y+.45).toFixed(2)}%;--nr-dust-x:${state.dir>0?'-.8cqw':'.8cqw'}`;dust.addEventListener('animationend',()=>dust.remove(),{once:true});layer.appendChild(dust);}
  }
  function startArmyParade(map){if(armyParadeTimer){clearInterval(armyParadeTimer);armyParadeTimer=null;}map=map||document.querySelector('.screen.active .nr-builder-map');const army=map&&map.querySelector('[data-nr-yard-army]');if(!map||!army)return;const units=army.querySelectorAll('[data-unit]'),count=units.length;if(!count)return;const slots=armySlots(count),rects=petBlockedRects(),now=performance.now(),reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!armyParadeState)armyParadeState={x:28,y:82,dir:1,mode:'march',until:now+6800,last:now};const state=armyParadeState;
    if(!armyClearAt(rects,state.x,state.y,slots)){let found=null,best=Infinity;for(const y of [82,74,66]){for(let x=22;x<=78;x+=4){const distance=Math.hypot(x-state.x,(y-state.y)*2);if(distance<best&&armyClearAt(rects,x,y,slots)){found={x,y};best=distance;}}}if(found){state.x=found.x;state.y=found.y;state.targetY=null;}}
    if(reduced){state.mode='attention';placeArmyParade(army,state,now);return;}
    const trail=army.querySelector('[data-nr-army-trail]');placeArmyParade(army,state,now);armyParadeTimer=setInterval(()=>{if(document.hidden||!army.isConnected)return;const t=performance.now(),dt=Math.min(.22,(t-state.last)/1000);state.last=t;
      if(t>=state.until){if(state.mode==='march'){state.mode='attention';state.until=t+1800;}else if(state.mode==='attention'){state.mode='rest';state.until=t+2600;}else{state.mode='march';state.until=t+6200+Math.random()*2600;}}
      if(state.mode==='march'){advanceArmyLane(state,slots,dt);let nx=state.x+state.dir*2.7*dt;if(nx<20||nx>80||!armyClearAt(petBlockedRects(),nx,state.y,slots)){state.dir*=-1;nx=state.x;if(!Number.isFinite(state.targetY)){const alternatives=[82,74,66].filter(y=>Math.abs(y-state.y)>.5&&armyClearAt(petBlockedRects(),state.x,y,slots));if(alternatives.length)state.targetY=alternatives.reduce((near,y)=>Math.abs(y-state.y)<Math.abs(near-state.y)?y:near,alternatives[0]);}}state.x=nx;}
      placeArmyParade(army,state,t);spawnArmyTrail(trail,state,slots,t);
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
    startPetPatrol(petPatrolRoot);
    armyParadeState=null;
    startArmyParade(petPatrolRoot);
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
  function startPetPatrol(map){if(petPatrolTimer){clearInterval(petPatrolTimer);petPatrolTimer=null;}map=map||document.querySelector('.screen.active .nr-builder-map');const pet=map&&map.querySelector('[data-nr-yard-pet]'),sprite=pet&&pet.querySelector('.nr-yard-pet-sprite'),trail=map&&map.querySelector('[data-nr-pet-trail]');if(!map||!pet||!sprite)return;preloadPetAtlases(sprite);const bounds=petPatrolBounds(),reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches,started=performance.now();if(!petPatrolState)petPatrolState={x:bounds.minX+4,y:bounds.minY+4,vx:3.4,vy:1.15,frame:0,last:started,frameAt:0,mode:'walk',casualUntil:0,nextCasual:started+2200};const state=petPatrolState;state.mode=state.mode||'walk';state.nextCasual=state.nextCasual||started+2200;state.x=Math.max(bounds.minX,Math.min(bounds.maxX,state.x));state.y=Math.max(bounds.minY,Math.min(bounds.maxY,state.y));
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
  function ensureWorldPlane(viewport){
    if(!viewport)return null;let plane=viewport.querySelector(':scope > .nr-world-plane');
    // EVERY pannable stage, not just the home estate. The scout/battle board
    // is `.nr-builder-map.nr-scout-map`, so matching only `.nr-estate-map`
    // returned a null plane there — and setBuilderZoom then threw on
    // plane.offsetWidth, killing scout() on the line BEFORE it wired the
    // TIẾN QUÂN button. The button rendered, looked enabled, and did nothing.
    const map=viewport.querySelector(':scope > .nr-builder-map');
    if(!plane&&map){plane=document.createElement('div');plane.className='nr-world-plane';plane.dataset.nrWorldPlane='';viewport.insertBefore(plane,map);plane.appendChild(map);}
    return plane;
  }
  function layoutBuilderWorld(viewport,map){
    const plane=map?.closest('.nr-world-plane')||ensureWorldPlane(viewport);if(!viewport||!map||!plane)return null;
    // A fixed 32K logical surface leaves kilometres of grass around the map at
    // every legal zoom without ever rasterising a 32K image: CSS only repeats
    // the small meadow tile. Fixed dimensions also keep the world origin stable
    // while orientation and estate scale change.
    plane.style.width=WORLD_PLANE_SIZE+'px';plane.style.height=WORLD_PLANE_SIZE+'px';
    const tile=Math.max(32,Math.round(MEADOW_TILE_SIZE*builderZoom));
    plane.style.setProperty('--nr-ground-size',tile+'px');return plane;
  }
  function centerBuilderWorld(){
    const viewport=document.getElementById('nrBuilderWorld');if(!viewport)return;ensureWorldPlane(viewport);
    const activeMap=viewport.querySelector('.nr-builder-map');
    // A farm board has no castle: never mount the castle drag pad there.
    decorateCastleYard(activeMap,view==='builder'&&builderZone===0);
    startPetPatrol(activeMap);startArmyParade(activeMap);
    const saved=builderScroll?{left:builderScroll.left,top:builderScroll.top}:null;
    let placed=false;
    const place=()=>{
      if(!viewport.isConnected)return;
      const map=viewport.querySelector('.nr-builder-map');
      // The screen may still be laying out on the frame after a render — a
      // viewport of zero width would compute a scroll of zero and then REMEMBER
      // it, so every later visit opened on the corner of the land instead of on
      // the castle. Wait for a real size before deciding anything.
      if(!map||viewport.clientWidth<40){requestAnimationFrame(place);return;}layoutBuilderWorld(viewport,map);
      placed=true;
      if(saved){viewport.scrollLeft=saved.left;viewport.scrollTop=saved.top;}
      else{
        // Open on the castle, not the middle of the land: the build screen now
        // starts zoomed out and a phone still shows about a third of the board,
        // so centring the map could leave a child looking at empty grass.
        // The scout/battle board is the OPPONENT's: centre on the field
        // (castle top-left, muster bottom-right), not on the cell where the
        // child's own castle happens to stand at home.
        const scoutMap=map.classList.contains('nr-scout-map'),
              box=scoutMap?{left:20,top:23,width:60,height:60}:castleFootprint(appState.nightRaidLayout),w=map.offsetWidth,h=map.offsetHeight,
              cx=map.offsetLeft+(box.left+box.width/2)/100*w,cy=map.offsetTop+(box.top+box.height/2)/100*h;
        viewport.scrollLeft=Math.max(0,cx-viewport.clientWidth/2);
        viewport.scrollTop=Math.max(0,cy-viewport.clientHeight/2);
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

  function renderBuilder(){cleanup();pendingBuildPurchase=null;view='builder';applyViewZoom(view);ensure();const r=root();if(!r)return;const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout);appState.nightRaidLayout=layout;const z=activeZone(layout),G=z.grid;const homeLevel=NightRaidRules.homeLevel(layout,appState.dogLevel||1),power=ownPower(),skin=typeof CastleSkins!=='undefined'?CastleSkins.get(appState.petBattleCastleSkin):null,production=allCells(layout).filter(isProducing),ready=production.filter(cellReady).length;
    const cellMap=new Map(z.cells.map(c=>[gridKey(c),c]));let grid='';for(let gy=0;gy<G;gy++){for(let gx=0;gx<G;gx++){const stand=cellMap.get(gx+':'+gy+':stand'),floor=cellMap.get(gx+':'+gy+':floor'),standOwner=footprintOwner(layout,gx,gy,'stand'),floorOwner=footprintOwner(layout,gx,gy,'floor'),castle=layout.castleCell||CASTLE_HOME,castleCovered=z.castle&&gx>=castle.gx&&gx<castle.gx+CASTLE_SIZE&&gy>=castle.gy&&gy<castle.gy+CASTLE_SIZE,covered=(standOwner&&!stand)||(floorOwner&&!floor)||castleCovered;grid+=`<button type="button" class="nr-build-grid-cell ${stand?'has-stand':''} ${floor?'has-floor':''} ${covered?'footprint-covered':''} ${castleCovered?'castle-covered':''}" data-gx="${gx}" data-gy="${gy}" onclick="nrGridCell(${gx},${gy})" ondragover="nrBuildDragOver(event)" ondrop="nrDropBuildItem(event,${gx},${gy})" aria-label="Ô đất hàng ${gy+1}, cột ${gx+1}${standOwner?', '+NightRaidRules.itemById(standOwner.type).name.vi+' cấp '+standOwner.tier:''}${floorOwner?', có bẫy cấp '+floorOwner.tier:''}${castleCovered?', nhà chính':''}">${placedHtml(floor,'floor',gx,gy)}${placedHtml(stand,'stand',gx,gy)}<i aria-hidden="true"></i></button>`;}}
    const tray=trayHtml(layout,z);
    const mapBase=builderMapBase(),mapSize=Math.round(mapBase*builderZoom),mapHeight=Math.round(mapBase*.75*builderZoom);
    r.innerHTML=shell(`<main class="nr-builder ${builderEditing?'editing':''} ${builderShopOpen?'shop-open':''} ${builderRotated?'rotated':''} ${anyWilted(layout)?'wilted':''}"><section class="nr-builder-world" id="nrBuilderWorld" aria-label="Khu đất lâu đài hình chữ nhật 4:3 giữa đồng cỏ. Kéo một ngón để di chuyển, chụm hai ngón để thu phóng thoải mái từ 3 đến 400 phần trăm."><div class="nr-builder-map nr-estate-map" data-base-size="${mapBase}" style="width:${mapSize}px;height:${mapHeight}px"><img class="nr-board-art" src="img/night-raid/isometric-home-board-frame-v4.png" alt="Hàng rào, cổng và cảnh quan bao quanh khu vườn lâu đài trên một thảm cỏ liền mạch"><img id="nrEquippedCastle" class="nr-equipped-castle" src="img/night-raid/home-castle.webp" alt="${esc((skin&&skin.name.vi)||'Castle skin đang trang bị')}" ${z.castle?'':'hidden'}><div class="nr-home-level"><span><small>${z.castle?'CẤP NHÀ':'NÔNG TRẠI '+z.zone}</small><strong>${z.castle?homeLevel:'🌱'}</strong></span><span class="nr-skin-name">${z.castle?esc((skin&&skin.name.vi)||'Thành Đá'):'Giá trị nông trại '+NightRaidRules.farmRules.farmValue(layout)}</span></div><div class="nr-free-grid size-${G}" role="grid" aria-label="Lưới xây dựng ${G} nhân ${G}">${grid}</div></div></section>${zoneChipsHtml(layout)}<div class="nr-builder-hud"><button class="nr-builder-home" type="button" onclick="nrHome()" aria-label="Về màn Cướp Đêm">${svg('map')}</button><div class="nr-builder-power damage"><small>DAM</small><strong>${power.damage}</strong></div><div class="nr-builder-power defense"><small>DEF</small><strong>${power.defense}</strong></div><div class="nr-builder-power soldiers"><small>LÍNH</small><strong>${power.soldiers}</strong></div><div class="nr-builder-power coins">${svg('coin')}<strong>${Math.max(0,Math.floor(+appState.coins||0))}</strong></div></div>${taskBarHtml(layout)}<div class="nr-builder-zoom" role="group" aria-label="Thu phóng khu vườn thoải mái từ 3 đến 400 phần trăm"><button type="button" onclick="nrZoomBuilder(-.15)" aria-label="Thu nhỏ khu vườn">−</button><span data-nr-zoom>${Math.round(builderZoom*100)}%</span><button type="button" onclick="nrZoomBuilder(.15)" aria-label="Phóng to khu vườn">+</button></div><button class="nr-builder-rotate ${builderRotated?'active':''}" type="button" onclick="nrRotateBuilder()" aria-pressed="${builderRotated}" aria-label="${builderRotated?'Trở về màn hình dọc':'Xoay ngang màn hình để nhìn nhà rõ hơn'}"><b>⟳</b><span>${builderRotated?'DỌC':'NGANG'}</span></button><button class="nr-builder-edit ${builderEditing?'active':''}" type="button" onclick="nrToggleBuilderGrid()" aria-pressed="${builderEditing}" aria-label="${builderEditing?'Xong — tắt lưới di chuyển':'Sửa nhà — hiện lưới để di chuyển công trình'}"><b>${builderEditing?'✓':'✎'}</b><span>${builderEditing?'XONG':'SỬA'}</span></button>${production.length?(anyWilted(layout)&&!ready?`<button class="nr-collect-all wilted" type="button" onclick="nrGoLearn()">${svg('coin')}<span><strong>VÀO HỌC ĐỂ CÂY TƯƠI</strong><small>cây héo không hái được · xong nhiệm vụ là tươi lại</small></span></button>`:`<button class="nr-collect-all ${ready?'ready':''}" type="button" onclick="nrCollectResources()" ${ready?'':'disabled'}>${svg('coin')}<span><strong>${ready?'THU HOẠCH '+ready:'ĐANG SẢN XUẤT'}</strong><small>${power.soldiers} lính · ${production.length} công trình</small></span></button>`):''}${replantHtml()}<div class="nr-builder-tip" role="status">${builderEditing?'Chạm ô để đặt · kéo vật đã xây để đổi chỗ':'Thu nhỏ để thấy đồng cỏ · kéo để khám phá'}</div><button class="nr-builder-shop-fab ${builderShopOpen?'active':''}" type="button" onclick="nrToggleBuildShop()" aria-expanded="${builderShopOpen}" aria-controls="nrBuildShop">${svg('hammer')}<span>${builderShopOpen?'ĐÓNG':'SHOP'}</span></button><section class="nr-build-shop ${builderShopOpen?'open':''}" id="nrBuildShop" aria-label="Cửa hàng công trình"><div class="nr-shop-heading"><div><span class="nr-label">CỬA HÀNG</span><strong>Vuốt ngang để xem · kéo vào đất để mua</strong></div><span>${builderShopTab==='defense'?'Mỗi loại ruộng 1 cái · tối đa 10 trại':builderShopTab==='seeds'?'Cây lớn 1 nấc mỗi ngày xong nhiệm vụ':builderShopTab==='farm'?'Trang trí, không sản xuất':'Thêm đất khi lâu đài hết chỗ'}</span></div>${shopTabsHtml(z)}<div class="nr-build-tray" role="toolbar" aria-label="Công trình có thể mua bằng xu">${tray}</div></section></main>`);if(z.castle)paintEquippedCastle();centerBuilderWorld();setupBuilderGestures();startProductionTicker();setNav(true);
  }
  function selectBuild(id){if(builderSuppressShopClick)return;if(NightRaidRules.itemById(id)){rememberBuilderWorld();selectedBuild=id;builderEditing=true;builderShopOpen=false;renderBuilder();announce('Đã chọn vật phẩm. Chạm ô sáng để đặt.');}}
  function buildPurchasePlan(id,gx,gy){const def=NightRaidRules.itemById(id);if(!def)return null;const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),z=activeZone(layout),G=z.grid,size=NightRaidRules.footprintFor(def);gx=Math.max(0,Math.min(G-size,Math.trunc(gx)));gy=Math.max(0,Math.min(G-size,Math.trunc(gy)));
    const isDefense=!!NightRaidRules.defenseById(def.id),layer=def.trap?'floor':'stand',cell=footprintOwner(layout,gx,gy,layer),at=cell?z.cells.indexOf(cell):-1,old=cell?NightRaidRules.itemById(cell.type):null,owned=ownedCount(layout,def.id);
    let cost=def.price,refund=0,remove=false,title='Mua '+def.name.vi+'?',detail=def.kind==='crop'?`Chiếm 1 ô · chín sau ${def.days} ngày làm xong nhiệm vụ · hái được ${def.yield} xu`:def.kind==='farm'?`Chiếm ${size===2?'4 ô':'1 ô'} · trang trí, không sản xuất`:def.producer==='soldier'?'Chiếm 4 ô · mỗi ngày làm xong nhiệm vụ cho 1 lính +20 DAM':def.producer==='coins'?`Chiếm 4 ô · thu hoạch ${def.yield} xu sau mỗi 24 giờ`:'Đặt tại hàng '+(gy+1)+', cột '+(gx+1);
    if(isDefense&&z.zone>0)return{error:'Nông trại riêng chỉ trồng cây và dựng công trình nông trại'};
    if(!cell&&!buildSpaceFree(layout,gx,gy,size,layer,null,true))return{error:size===2?'Cần một vùng trống 2 × 2 ô để đặt công trình':'Ô này đã có công trình'};
    if(cell&&(cell.gx!==gx||cell.gy!==gy||NightRaidRules.footprintFor(old)!==size))return{error:'Vùng đặt đang chồng lên công trình khác'};
    if(cell&&old&&old.kind==='crop')return{error:old.name.vi+' đang lớn, chờ hái rồi hãy trồng cây khác'};
    if(def.buyMax&&!cell&&owned>=def.buyMax)return{error:'Mỗi loại 1 cái — con đã có '+def.name.vi};
    if(def.maxOwned&&owned>=def.maxOwned&&(!cell||cell.type!==def.id))return{error:'Chỉ được đặt tối đa '+def.maxOwned+' '+def.name.vi};
    if(cell&&cell.type===def.id){
      if(def.kind==='farm'){remove=true;cost=0;refund=Math.floor(def.price*.5);title='Dỡ '+def.name.vi+'?';detail='Hoàn lại '+refund+' xu, ô này trống ra';}
      else if(def.producer)return{error:def.name.vi+' đang sản xuất, không cần nâng cấp'};
      else if(cell.tier>=3)return{error:def.name.vi+' đã đạt cấp tối đa'};
      else{cost=def.price*(cell.tier+1);title='Nâng '+def.name.vi+' lên cấp '+(cell.tier+1)+'?';detail='Công trình mạnh hơn ngay sau khi xác nhận';}}
    else if(cell){refund=Math.floor((old.kind==='farm'?old.price:totalPaid(old,cell.tier))*.5);title='Đổi sang '+def.name.vi+'?';detail='Thu lại '+refund+' xu từ '+old.name.vi+' hiện tại';}
    const balance=Math.max(0,Math.floor(+appState.coins||0)),balanceAfter=balance+refund-cost;if(balanceAfter<0)return{error:'Chưa đủ '+cost+' xu để mua '+def.name.vi};return{id:def.id,def,gx,gy,layout,zone:z.zone,layer,at,cell,cost,refund,remove,balance,balanceAfter,title,detail};}
  function showBuildPurchase(plan){pendingBuildPurchase={id:plan.id,gx:plan.gx,gy:plan.gy};document.querySelector('.nr-purchase-backdrop')?.remove();const builder=document.querySelector('.nr-builder');if(!builder)return;builder.insertAdjacentHTML('beforeend',`<div class="nr-purchase-backdrop" role="presentation" onclick="if(event.target===this)nrCancelBuildPurchase()" onkeydown="if(event.key==='Escape')nrCancelBuildPurchase()"><section class="nr-purchase-dialog" role="dialog" aria-modal="true" aria-labelledby="nrPurchaseTitle" aria-describedby="nrPurchaseDetail"><button class="nr-purchase-close" type="button" onclick="nrCancelBuildPurchase()" aria-label="Hủy mua">${svg('close')}</button><img src="${buildAsset(plan.def)}" alt=""><div class="nr-purchase-copy"><span class="nr-label">XÁC NHẬN MUA</span><h2 id="nrPurchaseTitle">${esc(plan.title)}</h2><p id="nrPurchaseDetail">${esc(plan.detail)}</p></div><div class="nr-purchase-price"><span>${plan.remove?'Hoàn lại':'Giá'+(plan.refund?' sau hoàn xu':'')}</span><strong>${svg('coin')}${plan.remove?plan.refund:Math.max(0,plan.cost-plan.refund)} xu</strong></div><div class="nr-purchase-balance"><span>Số dư hiện tại <b>${plan.balance}</b></span><span aria-hidden="true">→</span><span>Sau khi mua <b>${plan.balanceAfter}</b></span></div><div class="nr-purchase-actions"><button type="button" class="nr-purchase-cancel" onclick="nrCancelBuildPurchase()">Hủy</button><button type="button" class="nr-purchase-confirm" onclick="nrConfirmBuildPurchase()">${plan.remove?'Dỡ':'Xác nhận mua'}</button></div></section></div>`);requestAnimationFrame(()=>document.querySelector('.nr-purchase-confirm')?.focus());}
  function cancelBuildPurchase(){pendingBuildPurchase=null;document.querySelector('.nr-purchase-backdrop')?.remove();document.querySelector('.nr-build-shop.open .nr-build-item.selected')?.focus();}
  function confirmBuildPurchase(){const pending=pendingBuildPurchase;if(!pending)return;pendingBuildPurchase=null;document.querySelector('.nr-purchase-backdrop')?.remove();if(pending.id==='farm-plot'){buyFarmPlot(true);return;}selectedBuild=pending.id;buildCell(pending.gx,pending.gy,true);}
  function buildCell(gx,gy,confirmed){if(!confirmed&&builderSuppressClick){builderSuppressClick=false;return;}if(!builderEditing&&!confirmed)return;const plan=buildPurchasePlan(selectedBuild,gx,gy);if(!plan)return;if(plan.error){if(typeof showToast==='function')showToast(plan.error);return;}if(!confirmed){showBuildPurchase(plan);return;}const {def,layout,at,cell,cost,refund}=plan,z=zoneOf(layout,plan.zone),G=z.grid,lane=Math.round(plan.gy*4/(G-1)),col=1+Math.round(plan.gx*7/(G-1));
    if(plan.remove){appState.coins=Math.max(0,(+appState.coins||0)+refund);z.cells.splice(at,1);}
    else if(cell&&cell.type===def.id){appState.coins-=cost;cell.tier++;}
    else if(cell){appState.coins=Math.max(0,(+appState.coins||0)+refund-cost);z.cells[at]=newBuildCell(def,lane,col,plan.gx,plan.gy);}
    else{appState.coins-=cost;z.cells.push(newBuildCell(def,lane,col,plan.gx,plan.gy));}
    rememberBuilderWorld();appState.nightRaidLayout=NightRaidRules.normalizeLayout(layout);builderEditing=false;builderShopOpen=false;save();syncHome();if(typeof showToast==='function')showToast((plan.remove?'Đã dỡ ':'Đã mua ')+def.name.vi+' · còn '+Math.floor(appState.coins)+' xu');announce((plan.remove?'Đã dỡ ':'Đã mua ')+def.name.vi);renderBuilder();}
  function toggleBuilderGrid(){builderEditing=!builderEditing;if(!builderEditing)builderShopOpen=false;renderBuilder();}
  function toggleBuildShop(){builderShopOpen=!builderShopOpen;builderEditing=false;renderBuilder();}
  function nativeBuildDrag(event,id){selectedBuild=id;builderEditing=true;event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('text/plain',id);document.querySelector('.nr-builder')?.classList.add('dragging');}
  function buildDragOver(event){event.preventDefault();event.currentTarget.classList.add('drag-over');}
  function settleBuilderPlacement(){builderEditing=false;builderShopOpen=false;const builder=document.querySelector('.nr-builder');builder?.classList.remove('editing','dragging','shop-open');document.querySelector('.nr-build-shop')?.classList.remove('open');}
  function dropBuildItem(event,gx,gy){event.preventDefault();selectedBuild=event.dataTransfer?.getData('text/plain')||selectedBuild;builderEditing=true;buildCell(gx,gy);settleBuilderPlacement();}
  function smoothBuilderDrag(event,imageSrc,onActivate,onDrop,allowHorizontalScroll){if(event.pointerType==='mouse'&&event.button!==0)return;event.stopPropagation();const source=event.currentTarget,pointerId=event.pointerId,startX=event.clientX,startY=event.clientY;let active=false,ghost=null,dropTarget=null,lastX=startX,lastY=startY,frame=0;const suppressShopClick=()=>{if(!allowHorizontalScroll)return;builderSuppressShopClick=true;setTimeout(()=>{builderSuppressShopClick=false;},320);};try{source.setPointerCapture(pointerId);}catch(_){}const paint=()=>{frame=0;if(!active||!ghost)return;ghost.style.transform=`translate3d(${lastX-42}px,${lastY-42}px,0) scale(1.04)`;const next=document.elementFromPoint(lastX,lastY)?.closest('.nr-build-grid-cell')||null;if(next!==dropTarget){dropTarget?.classList.remove('drag-over');dropTarget=next;dropTarget?.classList.add('drag-over');}};const move=e=>{if(e.pointerId!==pointerId)return;lastX=e.clientX;lastY=e.clientY;const dx=lastX-startX,dy=lastY-startY;if(!active&&allowHorizontalScroll&&Math.abs(dx)>7&&Math.abs(dx)>Math.abs(dy)*1.15){suppressShopClick();finish(e);return;}if(!active&&Math.hypot(dx,dy)<5)return;if(!active){active=true;onActivate();ghost=document.createElement('img');ghost.className='nr-build-drag-ghost';ghost.src=imageSrc;ghost.alt='';ghost.draggable=false;document.body.appendChild(ghost);source.classList.add('nr-drag-source');document.querySelector('.nr-builder')?.classList.add('dragging');if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(8);}e.preventDefault();if(!frame)frame=requestAnimationFrame(paint);};const finish=e=>{if(e.pointerId!==pointerId)return;if(frame){cancelAnimationFrame(frame);frame=0;}if(active)paint();dropTarget?.classList.remove('drag-over');ghost?.remove();source.classList.remove('nr-drag-source');document.querySelector('.nr-builder')?.classList.remove('dragging');try{source.releasePointerCapture(pointerId);}catch(_){}document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',finish);document.removeEventListener('pointercancel',finish);builderDrag=null;if(active)suppressShopClick();if(active&&dropTarget){e.preventDefault();onDrop(dropTarget);}};builderDrag={pointerId,source};document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);}
  function newBuildCell(def,lane,col,gx,gy){const uid=(p)=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
    if(def.kind==='crop')return{type:def.id,gx,gy,uid:uid('c-'),day:farmDay(),at:(farmCtx()&&farmCtx().today)||new Date(Date.now()+7*3600000).toISOString().slice(0,10)};
    if(def.kind==='farm')return{type:def.id,gx,gy,uid:uid('f-')};
    const cell={type:def.id,lane,col,gx,gy,tier:1};if(def.producer){cell.uid=uid('p-');if(def.perTaskDay)cell.lastDay=farmDay();else cell.readyAt=Date.now()+def.productionMs;}return cell;}
  function beginBuildDrag(event,id){const def=NightRaidRules.itemById(id);if(!def)return;smoothBuilderDrag(event,buildAsset(def),()=>{selectedBuild=id;builderEditing=true;document.querySelector('.nr-builder')?.classList.add('editing');},target=>{buildCell(+target.dataset.gx,+target.dataset.gy);settleBuilderPlacement();},true);}
  // Both the read-only home and builder share the meadow camera. The estate may
  // become tiny, but the 3% floor and persistent +/- control guarantee a
  // child can always bring it back. The surrounding world never becomes empty:
  // CSS paints a seamless grass tile for the whole viewport.
  function builderZoomBounds(viewport,map){
    return {min:ESTATE_MIN_ZOOM,max:ESTATE_MAX_ZOOM};
  }
  // The estate and meadow are siblings in one real scroll plane. Preserve the
  // exact point under the fingers when the estate changes size; using the
  // estate's offset inside that plane also prevents the jump that occurred
  // when crossing from a centred small map to an overflowing large one.
  function setBuilderZoom(next,clientX,clientY){const viewport=document.getElementById('nrBuilderWorld'),map=viewport?.querySelector('.nr-builder-map');if(!viewport||!map)return;const plane=ensureWorldPlane(viewport);if(!plane)return;layoutBuilderWorld(viewport,map);const old=Math.max(.001,builderZoom),bounds=builderZoomBounds(viewport,map),newZoom=Math.max(bounds.min,Math.min(bounds.max,+next||1)),rect=viewport.getBoundingClientRect(),cx=Number.isFinite(clientX)?clientX-rect.left:viewport.clientWidth/2,cy=Number.isFinite(clientY)?clientY-rect.top:viewport.clientHeight/2,worldX=(viewport.scrollLeft+cx-plane.offsetWidth/2)/old,worldY=(viewport.scrollTop+cy-plane.offsetHeight/2)/old,base=+map.dataset.baseSize||1600,aspect=map.classList.contains('nr-scout-map')?1:.75;builderZoom=newZoom;map.style.width=Math.round(base*newZoom)+'px';
    // The estate is 4:3; the scout/battle board is the SQUARE 800 canvas.
    // Forcing 4:3 here squashed the preview 25% and, once Phaser replaced
    // the canvas, let it snap to another aspect and clip the bottom fifth.
    map.style.height=Math.round(base*aspect*newZoom)+'px';layoutBuilderWorld(viewport,map);viewport.scrollLeft=Math.max(0,plane.offsetWidth/2+worldX*newZoom-cx);viewport.scrollTop=Math.max(0,plane.offsetHeight/2+worldY*newZoom-cy);const label=document.querySelector('[data-nr-zoom]');if(label)label.textContent=Math.round(newZoom*100)+'%';keepScroll({left:viewport.scrollLeft,top:viewport.scrollTop});builderZoomByView[viewKey(view)]=builderZoom;}
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
      if(cell&&!NightRaidRules.itemById(cell.type)?.producer)return;
      if(!cell)return;
      if(cell.readyAt<=Date.now()&&cell.uid)return collectResources(cell.uid);
      const badge=viewport.querySelector('.nr-build-grid-cell[data-gx="'+cell.gx+'"][data-gy="'+cell.gy+'"] .nr-production-badge');
      if(!badge)return;
      badge.classList.add('shown');clearTimeout(badge._hideTimer);badge._hideTimer=setTimeout(()=>badge.classList.remove('shown'),4000);
    });
    viewport.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();if(builderRotated)setBuilderZoom(builderZoom+(e.deltaY<0?.1:-.1));else setBuilderZoom(builderZoom+(e.deltaY<0?.1:-.1),e.clientX,e.clientY);},{passive:false});
  }
  function movePlacedItem(fromGx,fromGy,layer,toGx,toGy){fromGx=+fromGx;fromGy=+fromGy;toGx=+toGx;toGy=+toGy;settleBuilderPlacement();if(fromGx===toGx&&fromGy===toGy)return;const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),z=activeZone(layout),G=z.grid,sameLayer=c=>(NightRaidRules.itemById(c.type).trap?'floor':'stand')===layer,source=z.cells.find(c=>c.gx===fromGx&&c.gy===fromGy&&sameLayer(c));if(!source)return;const size=NightRaidRules.footprintFor(source.type);toGx=Math.max(0,Math.min(G-size,toGx));toGy=Math.max(0,Math.min(G-size,toGy));if(!buildSpaceFree(layout,toGx,toGy,size,layer,source,true)){if(typeof showToast==='function')showToast(size===2?'Cần một vùng trống 2 × 2 ô':'Ô này đã có công trình');return;}source.gx=toGx;source.gy=toGy;source.lane=Math.round(toGy*4/(G-1));source.col=1+Math.round(toGx*7/(G-1));rememberBuilderWorld();appState.nightRaidLayout=NightRaidRules.normalizeLayout(layout);builderSuppressClick=false;save();syncHome();renderBuilder();announce('Đã chuyển công trình sang vị trí mới');}
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
  function gridCell(gx,gy){const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),cell=footprintOwner(layout,gx,gy,'stand');if(cell&&cellReady(cell))return collectResources(cell.uid);if(cell&&isCropCell(cell)&&isWiltedCell(cell)){if(typeof showToast==='function')showToast('Cây đang héo 🥀 — làm xong nhiệm vụ hôm nay để cây tươi rồi hái · bấm Vào học ở thanh nhiệm vụ trên đầu màn');return;}buildCell(gx,gy);}
  // ---- raid lock countdowns -------------------------------------------
  // A breached home is sealed for 24 hours (server-side, see _night-raid.js).
  // Every place that can show that clock renders the same chip and lets the
  // one-second ticker below drive it, so the child sees exactly when to come
  // back instead of finding a castle that silently refuses to be attacked.
  const lockLeft=until=>Math.max(0,(+until||0)-Date.now());
  function lockChip(until,label,cls=''){
    if(!lockLeft(until))return '';
    return `<span class="nr-lock-chip ${cls}" data-nr-lock-until="${+until}" role="status">${svg('shield')}<span><small>${esc(label)}</small><b data-nr-lock-time>${productionTime(lockLeft(until))}</b></span></span>`;
  }
  function productionTime(ms){const total=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60;return[h,m,s].map(n=>String(n).padStart(2,'0')).join(':');}
  function updateProductionTimers(){let ready=document.querySelectorAll('.nr-production-badge[data-static-ready="1"]').length;document.querySelectorAll('.nr-production-badge[data-ready-at]').forEach(el=>{const left=+el.dataset.readyAt-Date.now(),isReady=left<=0;el.classList.toggle('ready',isReady);el.textContent=isReady?el.dataset.readyLabel:productionTime(left);if(isReady)ready++;});const all=document.querySelector('.nr-collect-all:not(.wilted)');if(all){all.disabled=!ready;all.classList.toggle('ready',!!ready);const strong=all.querySelector('strong');if(strong)strong.textContent=ready?'THU HOẠCH '+ready:'ĐANG SẢN XUẤT';}updateLockTimers();}
  // The lock chips tick on the same one-second beat. When one runs out the
  // castle becomes attackable again, so the chip leaves and whatever it was
  // guarding (the TIẾN QUÂN button, the target card) is handed back.
  function updateLockTimers(){
    document.querySelectorAll('[data-nr-lock-until]').forEach(el=>{
      const left=lockLeft(el.dataset.nrLockUntil);
      if(left>0){const time=el.querySelector('[data-nr-lock-time]');if(time)time.textContent=productionTime(left);return;}
      const card=el.closest('.nr-target-card');el.remove();
      // A card that was only waiting on the child's own clock is handed back
      // as a live target, not left greyed out until the screen is reopened.
      if(card){card.classList.remove('locked');card.disabled=false;}
      const fab=document.getElementById('nrStartRaid');if(fab){fab.disabled=false;fab.hidden=false;}
      const secret=document.getElementById('nrScoutSecret');if(secret)secret.hidden=false;
    });
  }
  function startProductionTicker(){updateProductionTimers();productionTicker=setInterval(updateProductionTimers,1000);}
  function localCollect(uid){const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),now=Date.now(),F=NightRaidRules.farmRules;let coins=0,soldiers=0;const room=()=>Math.max(0,100000-(+appState.coins||0));
    const sweep=cells=>cells.filter(cell=>{const def=NightRaidRules.itemById(cell.type);if(!def||(uid&&cell.uid!==uid))return true;
      if(def.producer==='coins'){if(cell.readyAt<=now&&room()){const gain=Math.min(def.yield,room());appState.coins=Math.max(0,+appState.coins||0)+gain;coins+=gain;cell.readyAt=now+def.productionMs;}return true;}
      if(def.producer==='soldier'){if(F.barracksReady(cell,farmDay())){layout.soldiers++;soldiers++;cell.lastDay=farmDay();}return true;}
      if(def.kind==='crop'){if(!cellReady(cell)||!room())return true;const gain=Math.min(def.yield,room());appState.coins=Math.max(0,+appState.coins||0)+gain;coins+=gain;return false;}
      return true;});
    layout.cells=sweep(layout.cells);layout.farms=layout.farms.map(f=>({cells:sweep(f.cells)}));appState.nightRaidLayout=layout;return{coins,soldiers};}
  async function collectResources(uid){const trigger=document.querySelector('.nr-collect-all');if(trigger)trigger.disabled=true;const synced=await syncHome(),res=synced&&synced.ok?await api('collect',{method:'POST',body:{uid:uid||''}}):{ok:false};let coins=0,soldiers=0,wiltedRefusal=false;if(res.ok&&res.data){adoptFarmClock(res.data);appState.nightRaidLayout=NightRaidRules.normalizeLayout(res.data.layout);coins=Math.max(0,Math.trunc(+res.data.collectedCoins||0));soldiers=+res.data.collectedSoldiers||0;wiltedRefusal=!!res.data.wilted&&!coins&&!soldiers;lastHarvest=Array.isArray(res.data.harvested)?res.data.harvested.filter(h=>NightRaidRules.farmRules.cropById(h.type)):[];
    // Trust the server's absolute balance only when it actually sent one. A
    // reply without a numeric coins field used to become Math.max(0,+undefined
    // ||0) — i.e. the whole wallet silently replaced by 0 and saved. Missing
    // number → fall back to adding the harvest to the local wallet instead.
    if(typeof res.data.coins==='number'&&Number.isFinite(res.data.coins))appState.coins=Math.max(0,Math.trunc(res.data.coins));else appState.coins=Math.max(0,(+appState.coins||0))+coins;}else{const local=localCollect(uid);coins=local.coins;soldiers=local.soldiers;}
    if(!coins&&!soldiers){if(typeof showToast==='function')showToast(wiltedRefusal?'Cây đang héo 🥀 — làm xong nhiệm vụ hôm nay để cây tươi rồi hái':(+appState.coins||0)>=100000?'Kho xu đã đầy':'Chưa có công trình sẵn sàng');if(view==='builder')renderBuilder();else if(view==='home')renderHome();return;}
    save();if(!res.ok)syncHome();if(typeof showToast==='function')showToast([coins?('+'+coins+' xu'):'',soldiers?('+'+soldiers+' lính'):''].filter(Boolean).join(' · ')+' đã thu hoạch');announce('Thu hoạch thành công');if(view==='builder')renderBuilder();else if(view==='home')renderHome();}
  function replantHtml(){if(!lastHarvest.length)return'';const F=NightRaidRules.farmRules,cost=lastHarvest.reduce((s,h)=>s+(F.cropById(h.type)||{price:0}).price,0),balance=Math.max(0,Math.floor(+appState.coins||0)),short=Math.max(0,cost-balance);return `<button class="nr-replant ${short?'':'ready'}" type="button" onclick="nrReplant()" ${short?'disabled':''}>${svg('coin')}<span><strong>TRỒNG LẠI NHƯ CŨ</strong><small>${short?'thiếu '+short+' xu':lastHarvest.length+' ô · '+cost+' xu'}</small></span></button>`;}
  // Re-buy the seeds the last harvest took, on the same cells, in one PUT.
  function replant(){if(!lastHarvest.length)return;const F=NightRaidRules.farmRules,layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),plan=lastHarvest.filter(h=>F.cropById(h.type)),quote=plan.reduce((s,h)=>s+F.cropById(h.type).price,0),balance=Math.max(0,Math.floor(+appState.coins||0));
    if(balance<quote){if(typeof showToast==='function')showToast('Thiếu '+(quote-balance)+' xu để trồng lại như cũ');return;}
    let planted=0,spent=0;for(const h of plan){const z=zoneOf(layout,h.zone);if(z.zone!==h.zone)continue;const def=F.cropById(h.type),saveZone=builderZone;builderZone=z.zone;const free=buildSpaceFree(layout,h.gx,h.gy,1,'stand',null,true);builderZone=saveZone;if(!free)continue;z.cells.push(newBuildCell(def,0,1,h.gx,h.gy));planted++;spent+=def.price;}
    if(!planted){lastHarvest=[];renderBuilder();return;}
    appState.coins=balance-spent;lastHarvest=[];appState.nightRaidLayout=NightRaidRules.normalizeLayout(layout);save();syncHome();if(typeof showToast==='function')showToast('Đã trồng lại '+planted+' ô · còn '+Math.floor(appState.coins)+' xu');announce('Đã trồng lại');if(view==='builder')renderBuilder();else renderHome();}
  function setDogLane(lane){appState.nightRaidLayout.dogLane=Math.max(0,Math.min(4,lane));save();syncHome();renderBuilder();}

  async function api(path,opts){if(typeof EngAuth==='undefined'||typeof currentUser==='undefined')return{ok:false,data:{error:'Chưa kết nối tài khoản'}};const token=EngAuth.tokenFor(currentUser);if(!token)return{ok:false,data:{error:'Đăng nhập để mở Phase 2'}};try{return await EngAuth.api('night-raid/'+path,Object.assign({token},opts||{}));}catch(e){return{ok:false,data:{error:'Không thể kết nối máy chủ'}};}}
  // A wallet/level field that is not a real number is OMITTED from the PUT:
  // the server keeps its stored value for an absent field, so a fresh or
  // half-hydrated profile can no longer push 0 xu (or dog level 1) over what
  // the server already holds for this child.
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  // Set while GET /home is in the air. A PUT that overtakes that GET pushes the
  // device's stale wallet over coins the server credited while the child was
  // offline, so a sync started during the read waits for the read to land.
  let homeRead=null;
  // True while this device holds building work the server has not accepted.
  // buildCell/movePlacedItem/setDogLane all spend coins locally and then fire
  // syncHome() without looking at the result, and refreshHome used to
  // overwrite the layout with the server's copy no matter what — so one failed
  // PUT (offline, a 5xx, an expired token) made a paid-for tower vanish on the
  // next open. While this is set the server's layout is NOT adopted; the PUT
  // is retried instead.
  // Persisted, not just held in memory. The failure this guards against is a
  // PUT that failed — which almost always means offline — and a child who is
  // offline usually closes the app. A module-level flag resets on the next
  // launch, refreshHome adopts the server's older layout, and the tower they
  // paid for is gone: the exact case the flag exists for was the one it did
  // not cover.
  const homeDirty=()=>!!(appState&&appState.nightRaidHomeDirty);
  const setHomeDirty=v=>{if(appState&&appState.nightRaidHomeDirty!==!!v){appState.nightRaidHomeDirty=!!v;save();}};
  async function syncHome(){
    if(homeRead){try{await homeRead;}catch(e){}}
    const body={layout:appState.nightRaidLayout,castleSkin:appState.petBattleCastleSkin||'stone-keep'};if(finite(appState.dogLevel))body.dogLevel=appState.dogLevel;if(finite(appState.coins))body.coins=appState.coins;const res=await api('home',{method:'PUT',body});
    setHomeDirty(!res.ok);
    // A PUT that landed makes this device the wallet of record: it has now
    // told the server what it holds, so a later GET must never overwrite it.
    if(res.ok)appState.nightRaidWalletSynced=true;
    if(res.ok&&res.data?.layout)appState.nightRaidLayout=NightRaidRules.normalizeLayout(res.data.layout);
    if(res.ok)adoptFarmClock(res.data);return res;}
  // night_raid_homes.lootable_coins is a MIRROR of this device's wallet, not a
  // second wallet. "Adopt any row that is higher than mine" was a refund loop:
  // lessons, the shop, the cups and the armoury all move appState.coins
  // without telling any server, so the row sits ABOVE the device for as long
  // as it takes the next PUT to land. Build a tower (row 1000), spend 800 in
  // the home shop (device 200), reopen Cướp Đêm — and open() GETs without
  // PUTting first, so the row said 1000, the merge took it, and the child was
  // handed their 800 xu back with a toast thanking them for being offline.
  // Repeatable as often as the child cared to reopen the screen.
  //
  // What the merge was really covering is a coin the SERVER moved while the
  // child was asleep — a raid on this house. That now arrives as a
  // coin_grants IOU (finish.js), through the same receipt-protected pipeline
  // as an admin gift, so it lands exactly once and the mirror is not needed
  // for it.
  //
  // One case is left, and it is a restore, not a merge: a device that has
  // never pushed this profile's wallet — a reinstall, or a second phone
  // signing in — has nothing to be authoritative WITH, so it takes the
  // server's number once and becomes the source of truth from then on.
  function adoptServerCoins(lootableCoins){
    if(appState.nightRaidWalletSynced)return 0;
    appState.nightRaidWalletSynced=true;
    if(!finite(+lootableCoins))return 0;
    const server=Math.max(0,Math.min(100000,Math.trunc(+lootableCoins))),mine=Math.max(0,Math.trunc(+appState.coins||0));
    if(!(server>mine))return 0;
    appState.coins=server;
    return server-mine;
  }
  function refreshHome(){
    const run=(async()=>{
      const res=await api('home');
      // Released BEFORE anything below can PUT, or syncHome() would wait on
      // the very promise it is being called from and neither would finish.
      if(homeRead===run)homeRead=null;
      if(!res.ok||!res.data)return;
      adoptFarmClock(res.data);
      if(!res.data.home){syncHome();return;}
      homeLockedUntil=Math.max(0,+res.data.home.lockedUntil||0);homeShieldUntil=Math.max(0,+res.data.home.shieldUntil||0);
      const gained=adoptServerCoins(res.data.home.lootableCoins);
      // Local building work the server has not taken yet outranks the server's
      // older copy — otherwise the tower the child just paid for disappears.
      if(homeDirty())syncHome();
      else appState.nightRaidLayout=NightRaidRules.normalizeLayout(res.data.home.layout);
      save();
      if(gained&&typeof showToast==='function')showToast('Nhà con nhận thêm '+gained+' xu khi con offline');
      if(view==='home')renderHome();
    })();
    homeRead=run;
    return run;
  }
  // ---- CƯỚP ĐÊM = danh sách nhà + khi nào con vào lại được -----------------
  // A row on this list must reveal NOTHING about the state of the house behind
  // it. It used to shout "🛡️ CÓ KHIÊN", "VỪA BỊ CƯỚP" and "CON ĐÃ THĂM HÔM
  // NAY", which turned the screen into a solved puzzle: a child simply skipped
  // every house that could not be won and the raid stopped being a raid. A
  // shield up, or somebody having got there first, are SURPRISES the troops
  // find on arrival — the row therefore carries two states and no third:
  //   • ⚔️ TẤN CÔNG — go now, and find out what is inside; or
  //   • the child's OWN 12 h wait on that door, counting down to the clock
  //     time it opens. That clock is about the child, not about the house.
  // Name, house level and difficulty stay: they describe how big the place is,
  // never what happened to it. Layout, DEF and shield clock never reach this
  // screen at all; the scout preview shows an empty yard until TIẾN QUÂN.
  const LIVE_SCENES=['moonlit-village','haunted-forest','storm-kingdom'],LIVE_TZ='Asia/Ho_Chi_Minh';
  function waitPhrase(ms){const mins=Math.max(1,Math.ceil(Math.max(0,+ms||0)/60000)),h=Math.floor(mins/60),m=mins%60;return h?(m?h+' giờ '+m+' phút':h+' giờ'):m+' phút';}
  function clockPhrase(at){const day=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:LIVE_TZ}),now=Date.now(),time=new Date(at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',timeZone:LIVE_TZ});return time+(day(at)===day(now)?' hôm nay':day(at)===day(now+86400000)?' ngày mai':' ngày '+new Date(at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',timeZone:LIVE_TZ}));}
  // The ONE number a row is allowed to carry: when this child may knock on
  // this door again (0 = right now). `retryAt` is what the server sends now;
  // `availableAt` is the same number under the name an older deployment uses,
  // so reading both keeps the list truthful whichever side ships first.
  const retryAtOf=f=>Math.max(0,+(f&&f.retryAt!=null?f.retryAt:f&&f.availableAt)||0);
  // The green half of the row. It is a <b> and not a <button> on purpose: the
  // whole row is already the button (a thumb aimed anywhere on the strip
  // attacks), and a button nested inside a button is invalid markup that
  // Safari resolves by dropping one of them.
  const readyStateHtml=(hasTickets)=>hasTickets!==false?'<b>⚔️ TẤN CÔNG</b>'
    :'<small>HẾT LƯỢT</small><b>quay lại mai nhé</b>';
  // A friend row becomes a scout target the same way a target card does, minus
  // everything the list does not carry: an empty yard stands in for the layout
  // until start() replaces it with the real snapshot. No lockedUntil and no
  // shield clue travel with it — the scout stage must be as blind as the row.
  function friendTarget(f){const level=Math.max(1,Math.trunc(+f.homeLevel)||1),name=String(f.name||'Nhà bạn');return {targetId:f.targetId,name,title:{vi:name,en:name},homeLevel:level,level,difficulty:f.difficulty||'Cân bằng',sceneId:LIVE_SCENES[Math.abs(Math.trunc(+f.targetId)||0)%3],seed:1,layout:{cells:[],soldiers:0,dogLane:2},dogLevel:1,castleSkin:'stone-keep',castleHp:180+Math.min(50,level)*8,budget:0,friend:true};}
  // `hasTickets` is the second half of the same honesty rule the row states
  // for the clock: a row that says ⚔️ TẤN CÔNG must be attackable. With the
  // allowance spent every one of them still said it, the child tapped, and the
  // server answered 429 — which is exactly the refusal that used to kill the
  // TIẾN QUÂN button on the next screen.
  function friendRow(f,index,hasTickets){const retryAt=retryAtOf(f),left=lockLeft(retryAt),ready=left<=0&&hasTickets!==false;
    const label=esc(f.name)+', nhà cấp '+esc(f.homeLevel)+', '+(left>0?'còn '+waitPhrase(left)+' nữa con mới vào lại được':ready?'tấn công ngay được':'hôm nay con hết lượt rồi');
    return `<li><button type="button" class="nr-friend-row ${ready?'ready':'wait'}" ${ready?'':'disabled'} ${left>0?`data-nr-friend-until="${retryAt}"`:''} onclick="nrScoutLive(${index})" aria-label="${label}"><span class="nr-friend-crest">${svg('castle')}</span><span class="nr-friend-copy"><strong>${esc(f.name)}</strong><small>Nhà cấp ${esc(f.homeLevel)} · ${esc(f.difficulty||'Cân bằng')}</small></span><span class="nr-friend-state" data-nr-friend-state>${left>0?`<small>CHỜ THÊM</small><b data-nr-friend-time>còn ${waitPhrase(left)}</b><em>vào lại lúc ${esc(clockPhrase(retryAt))}</em>`:readyStateHtml(hasTickets)}</span></button></li>`;}
  // Ticks beside updateLockTimers: the text only changes when the minute does,
  // and a row whose clock ran out is handed back as a live TẤN CÔNG button.
  function updateFriendTimers(hasTickets){document.querySelectorAll('.nr-friend-row[data-nr-friend-until]').forEach(row=>{const left=lockLeft(row.dataset.nrFriendUntil),time=row.querySelector('[data-nr-friend-time]');if(left>0){const text='còn '+waitPhrase(left);if(time&&time.textContent!==text)time.textContent=text;return;}row.removeAttribute('data-nr-friend-until');const state=row.querySelector('[data-nr-friend-state]');if(state)state.innerHTML=readyStateHtml(hasTickets);if(hasTickets===false)return;row.disabled=false;row.classList.remove('wait');row.classList.add('ready');});}
  function ownStatusHtml(me){const now=Date.now(),shield=Math.max(0,+(me?me.shieldUntil:homeShieldUntil)||0),lock=Math.max(0,+(me?me.lockedUntil:homeLockedUntil)||0);
    if(shield>now)return `<div class="nr-own-status safe" role="status"><i>🛡️</i><span>Nhà con: <b>đang có khiên</b> đến ${esc(clockPhrase(shield))} — ai cướp cũng thua.</span></div>`;
    if(lock>now)return `<div class="nr-own-status safe" role="status"><i>🏰</i><span>Nhà con: <b>đang được bảo vệ</b> đến ${esc(clockPhrase(lock))} (còn ${waitPhrase(lock-now)}).</span></div>`;
    return '<div class="nr-own-status open" role="status"><i>🏰</i><span>Nhà con: <b>có thể bị cướp</b> — xây thêm phòng thủ hoặc bật khiên.</span></div>';}
  async function showLiveTargets(){cleanup();setNav(true);view='live';const r=root();if(!r)return;
    // The topbar already owns the close action and identifies the mode. A
    // second oversized "Quay lại / Chọn nhà để cướp" header repeated both,
    // pushed the real houses below the fold, and made this page feel like a
    // modal. Keep only a compact, useful status card.
    const overview=(tickets,copy)=>`<section class="nr-raid-overview" aria-label="Thông tin lượt Cướp Đêm"><span class="nr-raid-overview-icon">${svg('moon')}</span><span><small>CƯỚP ĐÊM TỐI NAY</small><strong>${tickets==null?'Đang tìm nhà…':tickets+' lượt còn lại'}</strong>${copy?`<em>${copy}</em>`:''}</span></section>`;
    r.innerHTML=shell(`<main class="nr-live-targets">${overview(null,'Đang trinh sát khu phố')}<div class="nr-loading" role="status"><i></i><span>Đang tải các lâu đài</span></div></main>`);
    const [friendsRes,targetsRes]=await Promise.all([api('friends'),api('targets')]);if(view!=='live')return;
    const friendsOk=!!(friendsRes.ok&&friendsRes.data),targetsOk=!!(targetsRes.ok&&targetsRes.data);
    if(!friendsOk&&!targetsOk){r.innerHTML=shell(`<main class="nr-live-targets">${overview(0,'Chưa tải được nhà người chơi')}<div class="nr-live-empty"><strong>Chưa thể tìm nhà thật</strong>${esc((friendsRes.data&&friendsRes.data.error)||(targetsRes.data&&targetsRes.data.error)||'Máy chủ chưa bật Cướp Đêm cho tài khoản này.')}</div><p class="nr-empty">Chưa tải được nhà người chơi. Thử lại sau nhé.</p></main>`);return;}
    const me=friendsOk&&friendsRes.data.me?friendsRes.data.me:null;if(me){homeLockedUntil=Math.max(0,+me.lockedUntil||0);homeShieldUntil=Math.max(0,+me.shieldUntil||0);}
    const friends=(friendsOk?(friendsRes.data.friends||[]):[]).slice().sort((a,b)=>(retryAtOf(a)-retryAtOf(b))||String(a.name||'').localeCompare(String(b.name||''),'vi'));
    const randoms=targetsOk?(targetsRes.data.targets||[]):[],tickets=friendsOk&&Number.isFinite(+friendsRes.data.ticketsLeft)?+friendsRes.data.ticketsLeft:(targetsOk?+targetsRes.data.ticketsLeft||0:0);
    liveTargets=friends.map(friendTarget).concat(randoms);
    const hasTickets=tickets>0;
    const friendList=friends.length?`<ul class="nr-friend-list">${friends.map((f,i)=>friendRow(f,i,hasTickets)).join('')}</ul>`:friendsOk
      ?'<div class="nr-live-empty"><strong>Chưa có bạn nào có lâu đài</strong>Kết bạn trong <b>Hồ sơ → 👥 Bạn bè</b> (gửi link kết bạn cho bạn cùng lớp). Khi bạn xây nhà xong, tên bạn sẽ hiện ở đây kèm giờ cướp được.<button class="nr-secondary nr-wide" type="button" onclick="closeNightRaid();if(typeof switchScreen===\'function\')switchScreen(\'profileScreen\')">Mở 👥 Bạn bè</button></div>'
      :`<p class="nr-empty">Chưa tải được danh sách bạn bè${friendsRes.data&&friendsRes.data.error?' — '+esc(friendsRes.data.error):''}. Kéo xuống để chọn nhà ngẫu nhiên.</p>`;
    // A random castle keeps exactly the two states a friend row has. The old
    // `shieldClue` class painted a halo on any house holding a shield, which
    // is the same solved-puzzle leak the friend rows had; and its chip counted
    // down the HOUSE's 24 h seal, where this one counts the child's own wait.
    const randomCards=randoms.map((t,i)=>{const retryAt=retryAtOf(t),waiting=!!lockLeft(retryAt),blocked=waiting||!hasTickets;return `<button type="button" class="nr-target-card ${blocked?'locked':''}" ${blocked?'disabled':''} onclick="nrScoutLive(${friends.length+i})">${lockChip(retryAt,'CHỜ THÊM')}<span class="nr-target-art">${svg('castle')}</span><span class="nr-target-copy"><strong>${esc(t.name)}</strong><small>Nhà cấp ${t.homeLevel} · ${esc(t.difficulty)}</small></span><span class="nr-target-go">${waiting?'':hasTickets?'⚔️ TẤN CÔNG':'HẾT LƯỢT'}</span></button>`;}).join('');
    r.innerHTML=shell(`<main class="nr-live-targets">${overview(tickets,'Chạm một lâu đài để trinh sát')}${ownStatusHtml(me)}<div class="nr-live-head"><h3>👥 Bạn bè</h3><span>${friends.length} nhà</span></div>${friendList}<section class="nr-live-random"><div class="nr-live-head"><h3>🎲 Nhà ngẫu nhiên</h3><span>Nhà người chơi cân bằng với con</span></div><div class="nr-target-grid">${randomCards||'<p class="nr-empty">Chưa có nhà phù hợp. Hãy thử lại sau.</p>'}</div></section></main>`);
    updateFriendTimers(hasTickets);productionTicker=setInterval(()=>{updateLockTimers();updateFriendTimers(hasTickets);},1000);}
  function scoutLive(index){const t=liveTargets[index];if(!t)return;scout(t);}
  // A raid the server scored but the client never heard about: /start wrote
  // the row (tonight's visit to that house is spent), then /finish failed or
  // the app was killed, and the child saw "Kết quả đang chờ đồng bộ" with 0 xu
  // — for good, because nothing ever asked again. Keep the raidId and ask on
  // the next open: finish.js replays a stored result for a 'done' raid and
  // scores an 'active' one that is still inside its window.
  function rememberPendingRaid(raidId){if(!raidId)return;appState.nightRaidPending={raidId:String(raidId),at:Date.now()};save();}
  function clearPendingRaid(raidId){const p=appState.nightRaidPending;if(p&&(!raidId||p.raidId===raidId)){appState.nightRaidPending=null;save();}}
  // Apply a verified result to the wallet exactly once per raid.
  function claimVerified(raidId,verified){if(appState.nightRaidClaimed?.[raidId])return false;if(!appState.nightRaidClaimed)appState.nightRaidClaimed={};appState.nightRaidClaimed[raidId]=true;if(verified.won)appState.coins=Math.max(0,+appState.coins||0)+Math.max(0,+verified.reward||0);else appState.coins=Math.max(0,(+appState.coins||0)-Math.max(0,+verified.loss||0));if(Number.isFinite(+verified.soldiers))appState.nightRaidLayout.soldiers=Math.max(0,+verified.soldiers);save();syncHome();return true;}
  async function retryPendingFinish(){const p=appState&&appState.nightRaidPending;if(!p||!p.raidId)return null;const res=await api('finish',{method:'POST',body:{raidId:p.raidId,coins:Math.max(0,Math.trunc(+appState.coins||0))}});const verified=res.ok&&res.data&&res.data.result;
    if(verified){clearPendingRaid(p.raidId);const fresh=claimVerified(p.raidId,verified);if(fresh&&typeof showToast==='function')showToast(verified.won?`Đã đồng bộ trận Cướp Đêm: +${Math.max(0,+verified.reward||0)} xu`:`Đã đồng bộ trận Cướp Đêm: -${Math.max(0,+verified.loss||0)} xu`);if(fresh&&view==='home')refreshHome();return verified;}
    // Nothing left to recover — the row is gone, expired or not ours — so
    // stop asking. Any other failure (offline, no token) is retried next time.
    const err=String((res.data&&res.data.error)||'');if(/expired|not found|forbidden|invalid raid/i.test(err)||Date.now()-(+p.at||0)>36e5*24)clearPendingRaid(p.raidId);return null;}
  // A raid the server refuses to score is NOT a win. The old code fell through
  // to renderResult with the client's own simulated `state`, so a child who
  // switched apps mid-battle — Phaser sleeps its loop while the tab is hidden,
  // so any pause longer than the raid window does it — came back to a
  // CHIẾN THẮNG banner promising +0 xu, and the house was locked behind a 12 h
  // clock nobody had paid a ticket for. The server now deletes that row and
  // says so; this says so too, and puts the child back in front of the list.
  const isExpired=res=>!!(res&&res.data&&(res.data.expired||/expired|hết giờ/i.test(String(res.data.error||''))));
  // The wallet rides along: finish.js clamps a defeat to what this device can
  // actually pay, so the defender is never credited money that never left
  // anybody. See the note beside attackerCan.
  async function finishOnline(target,state,commands){const res=await api('finish',{method:'POST',body:{raidId:target.raidId,coins:Math.max(0,Math.trunc(+appState.coins||0))}});const verified=res.ok&&res.data&&res.data.result;
    if(!verified&&isExpired(res)){clearPendingRaid(target.raidId);announce('Trận này đã hết giờ');if(typeof showToast==='function')showToast('Hết giờ trận này rồi — con vào lại nhà đó được ngay');return showLiveTargets();}
    if(!verified){announce('Kết quả đang chờ đồng bộ');if(typeof showToast==='function')showToast('Chưa nhận được kết quả từ máy chủ — sẽ tự đồng bộ khi mở Cướp Đêm lần sau');return renderResult(target,state,0,0,0);}clearPendingRaid(target.raidId);claimVerified(target.raidId,verified);renderResult(target,Object.assign(state,{status:verified.won?'won':'lost',shielded:!!verified.shielded,castleHp:verified.castleHp,damage:verified.damage,defense:verified.defense,margin:verified.margin,defenderGain:Math.max(0,+verified.defenderGain||0)}),verified.stars||0,verified.reward||0,verified.loss||0);}

  // ---- NHẬT KÝ = cả hai chiều ---------------------------------------------
  // The log answered one question — "who came to MY house?" — and never the
  // one a child asks first: "how did MY raids go?". Every reward and every
  // defeat the child earned was invisible the moment its result card closed.
  // /reports now returns both lists, so the page has two sections in the order
  // the child cares about: what our army did, then what came to our door.
  // An older deployment sends no `attacks` key at all — that section is then
  // not drawn, because an empty "Con đi cướp" heading reads as a broken screen.
  const ATTACK_KINDS={
    won:{cls:'won',state:'CƯỚP ĐƯỢC',icon:'castle'},
    lost:{cls:'lost',state:'BỊ ĐÁNH BẬT',icon:'shield'},
    ruined:{cls:'ruined',state:'NHÀ ĐÃ TAN HOANG',icon:'moon'},
  };
  // `kind` is the label the server puts on the row; a row written before that
  // field existed still has result.won, so fall back to it rather than drop
  // the raid out of the child's history entirely.
  function attackKind(a){const key=String((a&&a.kind)||'').toLowerCase();return ATTACK_KINDS[key]||((a&&a.result&&a.result.won)?ATTACK_KINDS.won:ATTACK_KINDS.lost);}
  function whenPhrase(at){return at?new Date(at).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Gần đây';}
  function attackCardHTML(a){
    const kind=attackKind(a),reward=Math.max(0,Math.trunc(+a.reward||0)),loss=Math.max(0,Math.trunc(+a.loss||0)),stars=Math.max(0,Math.min(3,Math.trunc(+a.stars||0)));
    const money=kind.cls==='won'?`<b class="nr-attack-money gain">+${reward} xu</b>`
      :kind.cls==='ruined'?'<b class="nr-attack-money none">0 xu</b>'
      :`<b class="nr-attack-money loss">-${loss} xu</b>`;
    const note=kind.cls==='won'?(stars?' · '+'★'.repeat(stars):''):kind.cls==='ruined'?' · có đội khác tới trước':'';
    return `<article class="nr-report-card nr-attack-card ${kind.cls}"><span class="nr-report-crest">${svg(kind.icon)}</span><div><span class="nr-report-state">${kind.state}</span><h3>${esc(a.defenderName||'Nhà bí ẩn')}</h3><p>${whenPhrase(a.finishedAt)}${note}</p></div>${money}</article>`;
  }
  function reportCardHTML(report,i){
    const breached=!!report.result.won;
    return `<article class="nr-report-card ${breached?'breached':'held'} ${report.seen?'':'new'}"><span class="nr-report-crest">${svg(breached?'castle':'shield')}</span><div><span class="nr-report-state">${breached?'TƯỜNG ĐÃ BỊ PHÁ':(report.result.shielded?'🛡️ KHIÊN ĐÃ CHẶN':'PHÒNG THỦ THÀNH CÔNG')}</span><h3>${esc(report.attackerName||'Đội cướp bí ẩn')}</h3><p>${whenPhrase(report.finishedAt)} · Castle còn ${Math.max(0,Math.ceil(+report.result.castleHp||0))} HP</p></div><button class="nr-secondary" type="button" onclick="nrReplayReport(${i})">${svg('play')} Xem lại</button></article>`;
  }
  async function showReports(){cleanup();setNav(true);view='reports';const r=root();if(!r)return;
    const head=(label,title,copy)=>`<div class="nr-section-head compact"><button class="nr-back" type="button" onclick="nrHome()">${svg('shield')}<span>${VI.back}</span></button><div><span class="nr-label">${label}</span><h2>${title}</h2><p>${copy}</p></div></div>`;
    r.innerHTML=shell(`<main class="nr-reports">${head('NHẬT KÝ CƯỚP ĐÊM','Nhật ký Cướp Đêm','Đang mở sổ trực đêm của lâu đài…')}<div class="nr-loading" role="status"><i></i><span>Đang tải các trận cướp</span></div></main>`);
    const res=await api('reports');if(view!=='reports')return;
    if(!res.ok){r.innerHTML=shell(`<main class="nr-reports">${head('NHẬT KÝ CƯỚP ĐÊM','Chưa thể mở nhật ký',esc((res.data&&res.data.error)||'Hãy đăng nhập để xem nhà mình bị cướp ra sao.'))}</main>`);return;}
    raidReports=res.data.reports||[];
    const attacks=Array.isArray(res.data.attacks)?res.data.attacks:null;
    const unseen=raidReports.filter(x=>!x.seen).map(x=>x.id);
    const attackSection=attacks?`<section class="nr-log-section"><div class="nr-live-head"><h3>⚔️ Con đi cướp</h3><span>${attacks.length} trận</span></div><div class="nr-report-list">${attacks.map(attackCardHTML).join('')||'<div class="nr-empty-state">'+svg('moon')+'<h3>Con chưa đi cướp nhà nào</h3><p>Bấm CƯỚP ĐÊM ở màn hình nhà rồi chọn một nhà để bắt đầu.</p></div>'}</div></section>`:'';
    const defenceSection=`<section class="nr-log-section"><div class="nr-live-head"><h3>🏰 Nhà con bị cướp</h3><span>${raidReports.length} trận</span></div><div class="nr-report-list">${raidReports.map(reportCardHTML).join('')||'<div class="nr-empty-state">'+svg('moon')+'<h3>Đêm nay vẫn yên bình</h3><p>Khi có người ghé lâu đài, replay sẽ xuất hiện ở đây.</p></div>'}</div></section>`;
    r.innerHTML=shell(`<main class="nr-reports">${head('NHẬT KÝ · '+unseen.length+' BÁO CÁO MỚI','Nhật ký Cướp Đêm','Kết quả những trận con đi cướp, và những đội đã ghé lâu đài của con.')}${attackSection}${defenceSection}</main>`);
    if(unseen.length)api('reports',{method:'POST',body:{ids:unseen}});}

  function replayReport(index){setNav(true);const report=raidReports[index];if(!report||!report.snapshot)return;cleanup();view='replay';const r=root();if(!r)return;const breached=!!report.result.won;r.innerHTML=shell(`<main class="nr-replay"><div class="nr-section-head compact"><button class="nr-back" type="button" onclick="nrShowReports()">${svg('shield')}<span>Nhật ký</span></button><div><span class="nr-label">REPLAY TRẬN CƯỚP</span><h2>${esc(report.attackerName||'Đội cướp bí ẩn')}</h2><p>${breached?'Quân tấn công có DAM cao hơn DEF của nhà.':(report.result.shielded?'Khiên Đêm đã chặn đứng đội cướp.':'Phòng thủ đã chặn được toàn bộ đội cướp.')}</p></div></div><section class="nr-replay-stage"><canvas id="nrReplayCanvas" width="1000" height="560" aria-label="Phát lại trận Cướp Đêm"></canvas><div class="nr-replay-status" id="nrReplayStatus" aria-live="polite">Đang phát lại</div></section><div class="nr-replay-summary"><span>${breached?'Tường bị phá':'Đã giữ thành'}</span><strong>DAM ${report.result.damage||'?'} · DEF ${report.result.shielded?'🛡️ KHIÊN':(report.result.defense||'?')}</strong></div></main>`);const canvas=document.getElementById('nrReplayCanvas');if((report.rulesVersion||1)>=2){report.snapshot.attackerDamage=report.result.damage;report.snapshot.defense=report.result.defense;game=new NightRaidGame.AutoBattle(canvas,report.snapshot,{onUpdate:state=>{const el=document.getElementById('nrReplayStatus');if(el)el.textContent=state.status==='fighting'?'Đang giao chiến':state.status==='won'?'Tường đã bị phá':'Phòng thủ thành công';}});game.start();setTimeout(()=>game&&game.charge&&game.charge(),450);}else{game=new NightRaidGame.Game(canvas,report.snapshot,{replay:true,allowPause:false,onUpdate:state=>{const el=document.getElementById('nrReplayStatus');if(el)el.textContent=state.status==='playing'?`Còn ${Math.max(0,Math.ceil((state.maxTimeMs-state.timeMs)/1000))} giây trước bình minh`:state.status==='won'?'Tường đã bị phá':'Phòng thủ thành công';}});game.playReplay(report.commands||[],2);}}

  return Object.freeze({mountYardScene,unmountYardScene,yardPoopSpots,yardBlockedRects:petBlockedRects,yardBlockedAt:petBlockedAt,yardBounds:petPatrolBounds,open,close,renderHome,isRaiding,abandonRaid,showLiveTargets,scoutLive,startRaid,chargeArmy,quit,renderBuilder,selectBuild,selectShopTab,selectZone,buyFarmPlot,buildCell,gridCell,cancelBuildPurchase,confirmBuildPurchase,setDogLane,toggleBuilderGrid,toggleBuildShop,rotateBuilder,beginBuildDrag,beginPlacedDrag,beginCastleDrag,zoomBuilder,nativeBuildDrag,buildDragOver,dropBuildItem,collectResources,replant,goLearn,showReports,replayReport,cleanYardPoop});
})();

function openNightRaid(){NightRaid.open();}
function closeNightRaid(){NightRaid.close();}
function nrHome(){NightRaid.renderHome();}
function nrShowLiveTargets(){NightRaid.showLiveTargets();}
function nrScoutLive(n){NightRaid.scoutLive(n);}
function nrChargeArmy(){NightRaid.chargeArmy();}
function nrQuitRaid(){NightRaid.quit();}
function nrShowBuilder(){NightRaid.renderBuilder();}
function nrSelectBuild(id){NightRaid.selectBuild(id);}
function nrSelectShopTab(id){NightRaid.selectShopTab(id);}
function nrSelectZone(z){NightRaid.selectZone(z);}
function nrBuyFarmPlot(){NightRaid.buyFarmPlot(false);}
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
function nrReplant(){NightRaid.replant();}
function nrGoLearn(){NightRaid.goLearn();}
function nrShowReports(){NightRaid.showReports();}
// Kho Khiên & Kiếm is its own module (js/armory.js), loaded after this file.
function nrOpenArmory(){if(typeof Armory!=='undefined'&&Armory&&typeof Armory.open==='function')Armory.open();else if(typeof showToast==='function')showToast('Kho Khiên & Kiếm chưa tải xong, thử lại nhé');}
function nrCleanYard(){NightRaid.cleanYardPoop();}
function nrReplayReport(index){NightRaid.replayReport(index);}
