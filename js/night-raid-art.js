// Storybook night renderer for Castle Night Raid. Gameplay state stays in
// night-raid-rules.js; this module only turns that state into readable art.
var NightRaidArt = (() => {
  'use strict';

  const SCENES = Object.freeze({
    'moonlit-village': Object.freeze({ sky:['#071936','#21487b'], glow:'#a9dcff', hill:'#173b45', ground:'#244c3d', lane:'#315f49', accent:'#ffd27a', weather:'firefly' }),
    'haunted-forest': Object.freeze({ sky:['#130c32','#432b67'], glow:'#d7c3ff', hill:'#201f3c', ground:'#26372f', lane:'#334b3d', accent:'#b8ffcf', weather:'fog' }),
    'storm-kingdom': Object.freeze({ sky:['#06111f','#273b59'], glow:'#d5ecff', hill:'#172738', ground:'#25313a', lane:'#344550', accent:'#ffca72', weather:'rain' }),
  });
  const DEFENSE_ASSET_IDS=Object.freeze(['pebble-pup','wood-fence','stone-wall','spike-trap','water-cannon']);
  const defenseSprites=Object.create(null),defenseListeners=[];let defenseLoadStarted=false,defenseLoaded=0;
  let sharedBattleBoardCutout=null;

  // The authored isometric board was delivered on a cream studio backdrop.
  // Scout and battle sit on the same endless meadow as the builder, so keeping
  // that backdrop turns the board into an obvious square picture. Remove only
  // the pale pixels connected to the image edge; pale paths, walls and flowers
  // inside the island remain because vegetation/cliffs isolate them from the
  // flood fill. Both the Canvas and Phaser renderers reuse this alpha cutout.
  function battleBoardCutout(source) {
    if(!source||typeof document==='undefined'||!document.createElement)return source;
    if(sharedBattleBoardCutout)return sharedBattleBoardCutout;
    const width=Math.trunc(source.naturalWidth||source.width||0),height=Math.trunc(source.naturalHeight||source.height||0);
    if(!width||!height)return source;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext&&canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)return source;
    try{
      ctx.drawImage(source,0,0,width,height);
      const pixels=ctx.getImageData(0,0,width,height),data=pixels.data,total=width*height;
      const outside=new Uint8Array(total),queue=new Int32Array(total);let head=0,tail=0;
      const isStudioBackdrop=index=>{
        const p=index*4,a=data[p+3];if(a<12)return true;
        const r=data[p],g=data[p+1],b=data[p+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b),light=(r+g+b)/3;
        // Neutral/warm, fairly bright studio paper and its soft shadow. Green
        // grass and brown cliff faces fail the chroma/hue guards immediately.
        return light>154&&hi-lo<58&&r>=b-10&&g>=b-22;
      };
      const visit=index=>{if(index<0||index>=total||outside[index]||!isStudioBackdrop(index))return;outside[index]=1;queue[tail++]=index;};
      for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}
      for(let y=1;y<height-1;y++){visit(y*width);visit(y*width+width-1);}
      while(head<tail){const index=queue[head++],x=index%width;if(x)visit(index-1);if(x<width-1)visit(index+1);if(index>=width)visit(index-width);if(index<total-width)visit(index+width);}
      for(let index=0;index<total;index++)if(outside[index])data[index*4+3]=0;
      ctx.putImageData(pixels,0,0);
    }catch(_){return source;}
    sharedBattleBoardCutout=canvas;return sharedBattleBoardCutout;
  }

  function preloadDefenses(onUpdate) {
    if(typeof onUpdate==='function')defenseListeners.push(onUpdate);
    if(defenseLoaded===DEFENSE_ASSET_IDS.length){if(typeof onUpdate==='function')onUpdate();return;}
    if(defenseLoadStarted||typeof Image==='undefined')return;
    defenseLoadStarted=true;
    DEFENSE_ASSET_IDS.forEach(id=>{const img=new Image();img.decoding='async';img.onload=()=>{defenseSprites[id]=img;defenseLoaded++;defenseListeners.slice().forEach(fn=>fn());if(defenseLoaded===DEFENSE_ASSET_IDS.length)defenseListeners.length=0;};img.src='img/night-raid/'+id+'.webp';});
  }

  function roundRect(ctx,x,y,w,h,r) {
    r=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }

  function drawScene(ctx,w,h,sceneId,timeMs,reduce) {
    const s=SCENES[sceneId] || SCENES['moonlit-village'];
    const g=ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,s.sky[0]); g.addColorStop(1,s.sky[1]); ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    const moonX=w*.78, moonY=h*.13, moonR=Math.max(24,w*.035);
    const aura=ctx.createRadialGradient(moonX,moonY,2,moonX,moonY,moonR*2.4); aura.addColorStop(0,'rgba(216,239,255,.35)'); aura.addColorStop(1,'rgba(216,239,255,0)'); ctx.fillStyle=aura; ctx.beginPath(); ctx.arc(moonX,moonY,moonR*2.4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=s.glow; ctx.beginPath(); ctx.arc(moonX,moonY,moonR,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=s.sky[0]; ctx.beginPath(); ctx.arc(moonX+moonR*.36,moonY-moonR*.2,moonR*.9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.72)'; for(let i=0;i<34;i++){const x=(i*83%997)/997*w,y=(i*47%271)/271*h*.42,r=i%7===0?1.6:.8;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=s.hill; ctx.beginPath(); ctx.moveTo(0,h*.46); for(let x=0;x<=w;x+=w/8){const y=h*(.33+.075*Math.sin(x*.018+1.7));ctx.lineTo(x,y);} ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.fill();
    // Distant village silhouettes create depth without competing with units.
    ctx.fillStyle='rgba(5,15,28,.55)'; for(let i=0;i<9;i++){const x=i*w/8.5-20,b=h*.45,hh=30+(i*17%42);ctx.fillRect(x,b-hh,58,hh);ctx.beginPath();ctx.moveTo(x-6,b-hh);ctx.lineTo(x+29,b-hh-27);ctx.lineTo(x+64,b-hh);ctx.fill();ctx.fillStyle=s.accent;ctx.fillRect(x+13,b-hh+13,7,10);ctx.fillStyle='rgba(5,15,28,.55)';}
    ctx.fillStyle=s.ground; ctx.fillRect(0,h*.43,w,h*.57);
    for(let lane=0;lane<5;lane++){const y=h*(248/560)+lane*h*(55/560);ctx.fillStyle=lane%2?'rgba(255,255,255,.035)':'rgba(0,0,0,.07)';roundRect(ctx,0,y-27,w,52,16);ctx.fill();ctx.strokeStyle='rgba(202,236,218,.15)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y+25);ctx.lineTo(w,y+25);ctx.stroke();}
    if(s.weather==='rain'&&!reduce){ctx.strokeStyle='rgba(186,224,255,.22)';ctx.lineWidth=1.2;const shift=(timeMs*.18)%48;for(let x=-40;x<w+40;x+=35){for(let y=-40;y<h;y+=78){ctx.beginPath();ctx.moveTo(x+shift,y);ctx.lineTo(x+shift-11,y+25);ctx.stroke();}}}
    if(s.weather==='fog'){ctx.fillStyle='rgba(205,226,235,.07)';for(let i=0;i<4;i++){const x=((i*287+(reduce?0:timeMs*.008))%(w+320))-160,y=h*(.45+i*.11);ctx.beginPath();ctx.ellipse(x,y,170,28,0,0,Math.PI*2);ctx.fill();}}
    if(s.weather==='firefly'&&!reduce){ctx.fillStyle=s.accent;for(let i=0;i<16;i++){const x=(i*137+Math.sin(timeMs*.001+i)*17)%w,y=h*(.55+(i%5)*.075);ctx.globalAlpha=.35+.5*(.5+.5*Math.sin(timeMs*.004+i));ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
    const fg=ctx.createLinearGradient(0,h*.88,0,h);fg.addColorStop(0,'rgba(4,12,19,0)');fg.addColorStop(1,'rgba(4,12,19,.7)');ctx.fillStyle=fg;ctx.fillRect(0,h*.84,w,h*.16);
  }

  function drawFallbackCastle(ctx,damage,skinColors) {
    const c=skinColors||['#e7b980','#b56c4d','#754439','#382f35','#ffad55'];
    ctx.fillStyle=c[1];ctx.strokeStyle=c[3];ctx.lineWidth=3;
    if(damage<4){ctx.fillRect(-65,-85,130,82);ctx.strokeRect(-65,-85,130,82);}
    if(damage<3){for(const x of [-61,31]){ctx.fillRect(x,-126,30,123);ctx.strokeRect(x,-126,30,123);ctx.fillStyle=c[0];ctx.beginPath();ctx.moveTo(x-5,-126);ctx.lineTo(x+15,-151);ctx.lineTo(x+35,-126);ctx.fill();ctx.fillStyle=c[1];}}
    if(damage<2){ctx.fillRect(-30,-137,60,134);ctx.strokeRect(-30,-137,60,134);ctx.fillStyle=c[0];ctx.beginPath();ctx.moveTo(-36,-137);ctx.lineTo(0,-169);ctx.lineTo(36,-137);ctx.fill();}
    ctx.fillStyle='#171d2b';ctx.beginPath();ctx.arc(0,-42,22,Math.PI,0);ctx.lineTo(22,-3);ctx.lineTo(-22,-3);ctx.closePath();ctx.fill();
    ctx.fillStyle=c[4];for(const x of [-48,45]){ctx.fillRect(x,-72,9,14);}
  }

  function drawCastle(ctx,x,groundY,skinId,hp,maxHp,impactPulse) {
    const ratio=Math.max(0,Math.min(1,hp/Math.max(1,maxHp))); const damage=ratio<=0?4:ratio<.25?3:ratio<.5?2:ratio<.76?1:0;
    ctx.save();ctx.translate(x,groundY);ctx.scale(1.45,1.45);
    // The board supplies ground contact; do not bake a black oval into the
    // castle bitmap reused by Home and the drag-and-drop builder.
    let drawn=false; if(typeof CastleSkins!=='undefined'&&CastleSkins.drawBattle) drawn=CastleSkins.drawBattle(ctx,skinId,damage);
    if(!drawn){const skin=typeof CastleSkins!=='undefined'?CastleSkins.get(skinId):null;drawFallbackCastle(ctx,damage,skin&&skin.colors);}
    // Deep crater with a bright broken inner edge — remains visible after dust clears.
    if(damage>0){ctx.fillStyle='#10131b';ctx.strokeStyle='#e2c29b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(24,-104);ctx.lineTo(54,-91);ctx.lineTo(43,-65);ctx.lineTo(61,-49);ctx.lineTo(30,-30);ctx.lineTo(9,-53);ctx.lineTo(18,-76);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='rgba(255,185,105,.42)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(9,-53);ctx.lineTo(-5,-66);ctx.lineTo(-21,-52);ctx.moveTo(18,-76);ctx.lineTo(2,-96);ctx.stroke();}
    if(impactPulse>0){ctx.globalAlpha=Math.min(1,impactPulse);ctx.strokeStyle='#fff1bd';ctx.lineWidth=5;ctx.beginPath();ctx.arc(35,-68,28+20*(1-impactPulse),0,Math.PI*2);ctx.stroke();}
    ctx.restore(); return damage;
  }

  function drawDefense(ctx,item,x,y,timeMs) {
    const spriteType=item.type==='guard-dog'?'pebble-pup':item.type,sprite=defenseSprites[spriteType];
    if(sprite){
      const isPup=item.type==='pebble-pup'||item.type==='guard-dog',bob=isPup&&!item.dead?Math.sin(timeMs*.004+(item.lane||0))*1.3:0;
      const heights={'pebble-pup':108,'wood-fence':92,'stone-wall':92,'spike-trap':72,'water-cannon':102};
      const h=heights[spriteType]||78,w=h*sprite.width/sprite.height,hurt=Math.max(0,1-item.hp/Math.max(1,item.maxHp));
      ctx.save();ctx.translate(x,y+bob);if(item.dead){ctx.translate(0,3);ctx.rotate(.22);ctx.globalAlpha=.3;}ctx.shadowColor='rgba(23,35,18,.34)';ctx.shadowBlur=7;ctx.shadowOffsetY=5;
      if(spriteType==='water-cannon'){ctx.scale(-1,1);ctx.drawImage(sprite,-w/2,-h,w,h);}else ctx.drawImage(sprite,-w/2,-h,w,h);
      ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
      if(hurt>.45&&!item.dead){ctx.strokeStyle='rgba(119,40,34,.92)';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-7,-h*.65);ctx.lineTo(4,-h*.55);ctx.lineTo(-3,-h*.42);ctx.lineTo(8,-h*.32);ctx.stroke();}
      if(item.hp<item.maxHp&&!item.dead){ctx.fillStyle='rgba(28,31,31,.72)';roundRect(ctx,-24,-h-8,48,6,3);ctx.fill();ctx.fillStyle=hurt>.55?'#ff665e':'#55d878';roundRect(ctx,-24,-h-8,48*Math.max(0,item.hp/item.maxHp),6,3);ctx.fill();}
      ctx.restore();return;
    }
    const bob=Math.sin(timeMs*.004+(item.lane||0))*(item.dead?0:1.5);ctx.save();ctx.translate(x,y+bob);const hurt=Math.max(0,1-item.hp/Math.max(1,item.maxHp));
    if(item.type==='guard-dog'){
      ctx.fillStyle='#f0b35e';ctx.strokeStyle='#432d2a';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,-18,22,17,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(-2,-42,18,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#432d2a';ctx.beginPath();ctx.moveTo(-15,-53);ctx.lineTo(-25,-68);ctx.lineTo(-5,-58);ctx.fill();ctx.beginPath();ctx.moveTo(10,-56);ctx.lineTo(23,-68);ctx.lineTo(20,-48);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-8,-44,4,0,Math.PI*2);ctx.arc(7,-44,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#15151b';ctx.beginPath();ctx.arc(-7,-44,2,0,Math.PI*2);ctx.arc(8,-44,2,0,Math.PI*2);ctx.arc(0,-35,3,0,Math.PI*2);ctx.fill();
    } else if(item.type==='wood-fence'||item.type==='stone-wall'){
      const stone=item.type==='stone-wall';ctx.fillStyle=stone?'#98a6b5':'#9b6036';ctx.strokeStyle=stone?'#3b4653':'#4b2d22';ctx.lineWidth=3;roundRect(ctx,-28,-54,56,54,stone?7:4);ctx.fill();ctx.stroke();ctx.strokeStyle=stone?'rgba(45,56,69,.55)':'rgba(255,218,167,.28)';ctx.lineWidth=2;for(let yy=-42;yy<-8;yy+=15){ctx.beginPath();ctx.moveTo(-24,yy);ctx.lineTo(24,yy);ctx.stroke();}
    } else if(item.type==='spike-trap'){
      ctx.fillStyle='#56606d';ctx.strokeStyle='#d9e0e8';ctx.lineWidth=2;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*11-6,0);ctx.lineTo(i*11,-24);ctx.lineTo(i*11+6,0);ctx.fill();ctx.stroke();}
    } else {
      const water=item.type==='water-cannon';ctx.fillStyle=water?'#42bfe8':'#d89a4a';ctx.strokeStyle='#283548';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-27,22,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=water?'#186a91':'#65402c';roundRect(ctx,-4,-34,35,12,6);ctx.fill();ctx.fillStyle='#f5d5a6';ctx.beginPath();ctx.arc(-4,-48,16,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#19202d';ctx.beginPath();ctx.arc(-9,-50,2.5,0,Math.PI*2);ctx.arc(2,-50,2.5,0,Math.PI*2);ctx.fill();
    }
    if(hurt>.45){ctx.strokeStyle='rgba(255,89,89,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-9,-39);ctx.lineTo(2,-29);ctx.lineTo(-5,-16);ctx.stroke();}
    ctx.restore();
  }

  function drawRaider(ctx,item,x,y,timeMs) {
    const type=typeof NightRaidRules!=='undefined'?NightRaidRules.raiderById(item.type):null;const color=type?type.color:'#ddd';const step=Math.sin(timeMs*.012+Number(String(item.id).replace(/\D/g,'')))*3;ctx.save();ctx.translate(x,y+step);ctx.globalAlpha=item.dead?.35:1;ctx.fillStyle='rgba(0,0,0,.26)';ctx.beginPath();ctx.ellipse(0,2,21,6,0,0,Math.PI*2);ctx.fill();
    if(item.type==='bat'){ctx.fillStyle=color;ctx.strokeStyle='#30224c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-28);ctx.quadraticCurveTo(-28,-54,-36,-25);ctx.quadraticCurveTo(-20,-35,0,-16);ctx.quadraticCurveTo(20,-35,36,-25);ctx.quadraticCurveTo(28,-54,0,-28);ctx.fill();ctx.stroke();}
    else {ctx.fillStyle=color;ctx.strokeStyle='#392c32';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,-22,item.type==='goblin'?22:18,item.type==='goblin'?23:18,0,0,Math.PI*2);ctx.fill();ctx.stroke();if(item.type==='bomb-rat'){ctx.fillStyle='#232734';ctx.beginPath();ctx.arc(18,-25,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffcf5c';ctx.beginPath();ctx.moveTo(24,-36);ctx.quadraticCurveTo(34,-48,38,-38);ctx.stroke();}}
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-6,-27,4,0,Math.PI*2);ctx.arc(6,-27,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111827';ctx.beginPath();ctx.arc(-5,-27,2,0,Math.PI*2);ctx.arc(7,-27,2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8b5a35';roundRect(ctx,-14,-13,28,17,7);ctx.fill();ctx.strokeStyle='#3f2c24';ctx.stroke();
    if(item.hp<item.maxHp){ctx.fillStyle='rgba(7,14,25,.8)';roundRect(ctx,-22,-62,44,6,3);ctx.fill();ctx.fillStyle='#ff6b6b';roundRect(ctx,-22,-62,44*Math.max(0,item.hp/item.maxHp),6,3);ctx.fill();}
    ctx.restore();
  }

  function drawProjectile(ctx,shot,mapX,mapY) {
    const p=Math.min(1,shot.age/420),x=mapX(shot.fromX+(shot.toX-shot.fromX)*p),y=mapY(shot.lane)-35-Math.sin(Math.PI*p)*28;ctx.save();ctx.globalAlpha=Math.max(0,1-shot.age/700);const color=shot.kind==='water'?'#55ddff':shot.kind==='rocket'?'#ff754f':'#ffe49b';ctx.strokeStyle=color;ctx.lineWidth=shot.kind==='rocket'?8:4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x+28,y+12);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#fff8cf';ctx.beginPath();ctx.arc(x,y,shot.kind==='rocket'?7:4,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  function drawClashSpark(ctx,x,y,pulse,index=0) {
    const power=Math.max(0,Math.min(1,pulse));if(!power)return;
    ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
    const glow=ctx.createRadialGradient(0,0,2,0,0,34+power*18);glow.addColorStop(0,'rgba(255,255,225,.96)');glow.addColorStop(.28,'rgba(255,210,71,.88)');glow.addColorStop(1,'rgba(255,92,34,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,52,0,Math.PI*2);ctx.fill();
    for(let i=0;i<12;i++){const a=i*Math.PI/6+index*.37,len=10+(i%4)*7+power*18;ctx.strokeStyle=i%3?'#ffd84c':'#fff6c5';ctx.lineWidth=i%3?3:5;ctx.beginPath();ctx.moveTo(Math.cos(a)*5,Math.sin(a)*5);ctx.lineTo(Math.cos(a)*len,Math.sin(a)*len);ctx.stroke();}
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,4+power*5,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  // ── Nhà tan hoang: the rubble a house is left in after someone raids it ──
  // The two castle-damage sheets are 3 columns (intact / damaged / RUINS) x 5
  // rows of castle skins. Column 3 is the pile we want.
  //
  // These are NOT five equal cells. Measured on the alpha channel (a pixel
  // counts as art at alpha >= 24), three of sheet a's rubble piles and four of
  // sheet b's hang 23-65px BELOW their mathematical row line — the piles were
  // authored wider and lower than the intact castle above them. Cutting on
  // col*w/3, row*h/5 therefore saws the bottom off the rubble. Each frame here
  // is one pile's own opaque box [sx,sy,sw,sh], so the whole pile lands on the
  // canvas and nothing of its neighbour leaks in.
  const RUINS_SHEETS=Object.freeze({a:'img/night-raid/animation/castle-damage-a-v2.webp',b:'img/night-raid/animation/castle-damage-b-v2.webp'});
  const RUINS_FRAMES=Object.freeze({
    a:Object.freeze([[1029,110,367,139],[1015,306,375,149],[1022,524,348,113],[1009,706,385,108],[1010,886,386,131]].map(f=>Object.freeze(f))),
    b:Object.freeze([[1211,114,286,101],[1205,319,262,99],[1207,517,265,98],[1209,695,260,84],[1202,824,272,83]].map(f=>Object.freeze(f))),
  });
  const ruinsSheets=Object.create(null),ruinsListeners=Object.create(null);

  // Skin -> sheet + row. CastleSkins.atlasCell already owns that mapping (its
  // shop atlases and these damage sheets were cut in the same skin order), so
  // ask it rather than keeping a second list here that can silently drift.
  // Without CastleSkins we degrade to the same default it normalizes to.
  function ruinsFrame(skinId) {
    const cell=typeof CastleSkins!=='undefined'&&CastleSkins.atlasCell?CastleSkins.atlasCell(skinId):{atlas:0,cell:0};
    const sheet=cell.atlas?'b':'a',row=Math.max(0,Math.min(4,Math.trunc(cell.cell)||0)),f=RUINS_FRAMES[sheet][row];
    return {sheet,row,src:RUINS_SHEETS[sheet],sx:f[0],sy:f[1],sw:f[2],sh:f[3]};
  }

  // Loads only the one sheet this skin needs (each is ~200-270KB).
  function preloadRuins(skinId,onReady) {
    const frame=ruinsFrame(skinId),img=ruinsSheets[frame.sheet];
    if(img&&img.complete&&img.naturalWidth){if(typeof onReady==='function')onReady();return img;}
    if(typeof Image==='undefined')return null;
    const waiting=ruinsListeners[frame.sheet]||(ruinsListeners[frame.sheet]=[]);
    if(typeof onReady==='function')waiting.push(onReady);
    if(img)return img;
    const next=new Image();next.decoding='async';ruinsSheets[frame.sheet]=next;
    next.onload=()=>{waiting.splice(0).forEach(fn=>{try{fn();}catch(e){}});};
    next.onerror=()=>{waiting.splice(0).forEach(fn=>{try{fn();}catch(e){}});};
    next.src=frame.src;return next;
  }

  // Draws the pile with its base centred on (x, groundY) and `width` px across.
  // Height follows the frame's own aspect, so no pile is ever squashed, and the
  // caller gets the box back to hang dust, embers and a signboard off it.
  // Returns null while the sheet is still decoding — the caller keeps painting.
  function drawRuins(ctx,x,groundY,skinId,width,alpha) {
    const frame=ruinsFrame(skinId),img=ruinsSheets[frame.sheet];
    if(!ctx||!img||!img.complete||!img.naturalWidth)return null;
    const w=Math.max(1,width||0),h=w*frame.sh/frame.sw,box={x:x-w/2,y:groundY-h,w,h};
    ctx.save();if(alpha!=null)ctx.globalAlpha=Math.max(0,Math.min(1,alpha));
    ctx.drawImage(img,frame.sx,frame.sy,frame.sw,frame.sh,box.x,box.y,w,h);
    ctx.restore();return box;
  }

  preloadDefenses();
  return Object.freeze({SCENES,roundRect,battleBoardCutout,drawScene,drawCastle,preloadDefenses,drawDefense,drawRaider,drawProjectile,drawClashSpark,
    RUINS_SHEETS,RUINS_FRAMES,ruinsFrame,preloadRuins,drawRuins});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=NightRaidArt;
