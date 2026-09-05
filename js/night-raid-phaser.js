// Phaser presentation layer for the one-tap Night Raid result battle.
// Rules and choreography remain deterministic in NightRaidRules/Choreo;
// Phaser owns only sprites, camera motion, particles and sound after TIEN QUAN.
var NightRaidPhaser = (() => {
  'use strict';

  const SIZE=800;
  let runtimePromise=null;

  function ensureRuntime(){
    if(typeof Phaser!=='undefined')return Promise.resolve(Phaser);
    if(runtimePromise)return runtimePromise;
    if(typeof document==='undefined')return Promise.reject(new Error('Phaser needs a browser'));
    runtimePromise=new Promise((resolve,reject)=>{
      let script=document.querySelector('script[data-night-raid-phaser]');
      if(script){script.addEventListener('load',()=>resolve(Phaser),{once:true});script.addEventListener('error',()=>reject(new Error('Phaser failed to load')),{once:true});return;}
      script=document.createElement('script');script.src='js/phaser.min.js';script.async=true;script.dataset.nightRaidPhaser='';
      script.onload=()=>typeof Phaser!=='undefined'?resolve(Phaser):reject(new Error('Phaser unavailable'));
      script.onerror=()=>reject(new Error('Phaser failed to load'));document.head.appendChild(script);
    }).catch(error=>{runtimePromise=null;throw error;});
    return runtimePromise;
  }

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const lerp=(a,b,p)=>a+(b-a)*p;
  const easeOut=p=>1-(1-p)*(1-p);
  const squadRows=6, squadCols=8, squadWalkCols=6;
  // Horizontal visual centroids measured inside each authored atlas cell.
  // Compensating these keeps the torso over the same world coordinate even
  // when a sword, shield or wide running pose changes the transparent bounds.
  const squadWalkAnchors=Object.freeze([
    [ .0171, .0432,-.0091, .0200, .0493, .0448],
    [ .0090, .0019, .0312,-.0161, .0262,-.0002],
    [ .0214, .0347,-.0014, .0089, .0192, .0005],
    [ .0414, .0339, .0021,-.0140, .0268, .0007],
    [ .0139, .0248, .0458, .0302, .0965, .0499],
    [ .0195,-.0087, .0066,-.0249, .0101, .0688],
  ]);
  const squadActionAnchors=Object.freeze([
    [ .0417, .0627,-.0409,-.1082,-.0933, .0596, .0789, .0448],
    [ .0739, .0755,-.0054,-.0582,-.0105, .0622,-.0050,-.0340],
    [ .0413, .0371,-.0104,-.0612,-.0775, .0071, .0074, .0069],
    [ .0485, .0810, .0646,-.0368,-.0574,-.0848,-.0274,-.0240],
    [ .0231, .0013,-.0445,-.1180,-.0979, .0197,-.0273,-.0433],
    [ .0311, .0345,-.0086,-.0825,-.1500,-.0150,-.0619,-.0989],
  ]);
  const petCols=Object.freeze({small:8,large:7});
  const defenseRows=Object.freeze(['wood-fence','stone-wall','pebble-pup','water-cannon','spike-trap']);
  const economyRows=Object.freeze(['training-barracks','rice-field']);
  const castleRows=Object.freeze([
    ['stone-keep','forest-fort','desert-citadel','frost-bastion','coral-palace'],
    ['sakura-castle','clockwork-keep','dragon-fortress','crystal-citadel','celestial-palace'],
  ]);
  // Per-frame anchors for the castle damage atlases: [base centre x, ground
  // line y] as fractions of the authored cell, measured from the opaque
  // pixels (the bottom 12% of rows give the base centre). The generated
  // frames are NOT registered to each other — the ruin of a stone keep sits
  // 13% of a cell further left than the intact keep — so drawing every stage
  // in the same box made the castle jump sideways as it broke. Placing each
  // stage by its own anchor keeps the footprint still while the walls fall.
  const castleAnchors=Object.freeze({
    a:[[[.5073,.9951],[.4310,.9951],[.3730,.9951]],
       [[.4965,.9951],[.4413,.9951],[.3270,.9951]],
       [[.4803,.9951],[.4405,.9951],[.3273,.9951]],
       [[.4793,.9951],[.4505,.9951],[.3377,.9707]],
       [[.4921,.9610],[.4389,.9659],[.3415,.9610]]],
    b:[[[.6095,.9945],[.4832,.9945],[.3545,.9945]],
       [[.5993,.9945],[.4500,.9945],[.3479,.9945]],
       [[.6127,.9946],[.4437,.9946],[.3314,.9946]],
       [[.6120,.9945],[.4660,.9945],[.3195,.9945]],
       [[.6086,.9290],[.4633,.9454],[.3398,.9454]]],
  });
  // The frame the gate geometry (NightRaidChoreo.GATE, the slots) was
  // authored against: atlas a, stone keep, intact. Every other frame is
  // shifted so its base centre and ground line land where this one's do.
  const CASTLE_REF=Object.freeze([.5073,.9951]),CASTLE_W=430,CASTLE_H=258,CASTLE_XFADE_MS=250;
  const FRAME_ZOOM_MIN=.9,FRAME_ZOOM_MAX=1.08,BREACH_ZOOM=1.18,CAMERA_TAU_MS=380;

  // What the camera should be looking at, as a pure function of battle time:
  // the castle face and doorway PLUS every standing unit. Keep nearly the
  // whole 800px estate visible (0.9x–1.08x), with only a restrained push-in
  // as the door gives, so a child can understand the whole attack at once.
  function cameraFrame(ch,T){
    const C=NightRaidChoreo,G=C.GATE||{x:C.CASTLE.x+58,y:C.CASTLE.y+6};
    let minX=G.x-80,maxX=G.x+50,minY=G.y-150,maxY=G.y+40;
    for(const u of ch.units){
      if(u.fallAt!=null&&T>u.fallAt+1200)continue;   // the fallen drop out of the frame after a beat
      const p=C.unitAt(u,T);
      minX=Math.min(minX,p.x-36);maxX=Math.max(maxX,p.x+36);minY=Math.min(minY,p.y-104);maxY=Math.max(maxY,p.y+18);
    }
    const w=maxX-minX,h=maxY-minY,fit=Math.min(SIZE/w,SIZE/h);
    let zoom=clamp(fit,FRAME_ZOOM_MIN,FRAME_ZOOM_MAX),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    if(ch.breachAt!=null){
      // Tighten on the door as it gives — but never so far that a straggler
      // still running up leaves the frame.
      const k=1-Math.min(1,Math.abs(T-ch.breachAt-150)/750);
      if(k>0){zoom=lerp(zoom,Math.min(BREACH_ZOOM,Math.max(zoom,fit)),k);cx=lerp(cx,lerp(cx,G.x+10,.5),k);cy=lerp(cy,lerp(cy,G.y-30,.5),k);}
    }
    const half=SIZE/zoom/2;
    // Whatever the push-in wanted, the interest box stays inside the view.
    cx=2*half>=w?clamp(cx,maxX-half,minX+half):(minX+maxX)/2;
    cy=2*half>=h?clamp(cy,maxY-half,minY+half):(minY+maxY)/2;
    return {x:clamp(cx,half,SIZE-half),y:clamp(cy,half,SIZE-half),zoom};
  }
  // Cheap separation pass over one frame's standing bodies: any pair closer
  // than minDist is nudged apart along the line between them, at most
  // maxPush each, y damped so depth order does not flip. Pure in its input,
  // so the frame stays a function of T.
  function separate(points,minDist=36,maxPush=16,iterations=3){
    const out=points.map(p=>({x:p.x,y:p.y,ox:p.x,oy:p.y}));
    for(let it=0;it<iterations;it++){
      for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){
        const a=out[i],b=out[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
        if(d>=minDist)continue;
        if(d<.01){dx=i%2?1:-1;dy=.5;d=Math.hypot(dx,dy);}
        const push=(minDist-d)/2,ux=dx/d,uy=dy/d;
        a.x-=ux*push;a.y-=uy*push*.6;b.x+=ux*push;b.y+=uy*push*.6;
      }
      // Nobody is shoved further than maxPush from where the script put them.
      for(const p of out){const dx=p.x-p.ox,dy=p.y-p.oy,d=Math.hypot(dx,dy);if(d>maxPush){p.x=p.ox+dx/d*maxPush;p.y=p.oy+dy/d*maxPush;}}
    }
    return out.map(p=>({x:p.x,y:p.y}));
  }

  function decodeToCanvas(src){return new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d',{alpha:true});ctx.drawImage(image,0,0);resolve(canvas);};image.onerror=()=>reject(new Error('Cannot decode '+src));image.src=src;});}

  // Tiny WebAudio battle-sound kit: every cue is synthesized on the fly so the
  // raid ships no audio assets and works offline. The context is created only
  // after TIEN QUAN (a real user gesture) and skipped under reduced effects.
  class RaidAudio {
    constructor(){this.ctx=null;this.master=null;this.noise=null;this.stepFlip=false;}
    ensure(){
      if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});return this.ctx;}
      const AC=typeof AudioContext!=='undefined'?AudioContext:(typeof webkitAudioContext!=='undefined'?webkitAudioContext:null);
      if(!AC)return null;
      try{this.ctx=new AC();}catch(_){return null;}
      this.master=this.ctx.createGain();this.master.gain.value=.5;this.master.connect(this.ctx.destination);
      const len=this.ctx.sampleRate,buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate),d=buf.getChannelData(0);
      for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.noise=buf;
      return this.ctx;
    }
    env(g,at,attack,peak,dur){g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(peak,at+attack);g.gain.exponentialRampToValueAtTime(.0001,at+dur);}
    burst({t=0,dur=.3,peak=.2,type='lowpass',freq=800,q=1,rate=1}={}){
      const ctx=this.ensure();if(!ctx)return;const at=ctx.currentTime+t;
      const src=ctx.createBufferSource();src.buffer=this.noise;src.loop=true;src.playbackRate.value=rate;
      const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;
      const g=ctx.createGain();this.env(g,at,.012,peak,dur);
      src.connect(f);f.connect(g);g.connect(this.master);src.start(at);src.stop(at+dur+.05);
    }
    tone({t=0,dur=.3,peak=.15,type='triangle',from=220,to=null,glide=null}={}){
      const ctx=this.ensure();if(!ctx)return;const at=ctx.currentTime+t;
      const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(Math.max(30,from),at);
      if(to!=null)o.frequency.exponentialRampToValueAtTime(Math.max(30,to),at+(glide||dur));
      const g=ctx.createGain();this.env(g,at,.02,peak,dur);
      o.connect(g);g.connect(this.master);o.start(at);o.stop(at+dur+.08);
    }
    // Marching boots: alternating soft ground thuds.
    step(){this.stepFlip=!this.stepFlip;this.burst({dur:.09,peak:.055,freq:this.stepFlip?170:135,rate:.6});}
    // TIẾNG HÔ: a war horn plus a ragged crowd of shout-shaped noise bursts.
    warCry(){
      this.tone({type:'sawtooth',from:196,to:294,dur:.7,peak:.14});
      this.tone({type:'sawtooth',from:98,to:147,dur:.7,peak:.1});
      for(let i=0;i<7;i++)this.burst({t:.1+i*.05,dur:.22,peak:.09,type:'bandpass',freq:520+(i%3)*160,q:2.4,rate:.9+(i%4)*.12});
    }
    launch(kind){if(kind==='water')this.burst({dur:.18,peak:.1,type:'bandpass',freq:1500,q:1.4,rate:1.4});else this.burst({dur:.12,peak:.1,type:'highpass',freq:900,rate:1.1});}
    impactShot(kind,lethal){
      if(kind==='water')this.burst({dur:.3,peak:.14,freq:900,rate:1.3});
      else{this.burst({dur:.16,peak:.16,freq:600});this.tone({type:'square',from:130,to:70,dur:.14,peak:.07});}
      if(lethal)this.tone({from:220,to:90,dur:.35,peak:.12});
    }
    fall(){this.burst({dur:.22,peak:.16,freq:340,rate:.7});this.tone({type:'square',from:110,to:55,dur:.25,peak:.08});}
    // One melee blow landing on a building: wood knocks, stone clunks deeper.
    smash(material){
      if(material==='stone')this.burst({dur:.13,peak:.13,freq:420,rate:.7});
      else this.burst({dur:.11,peak:.12,type:'bandpass',freq:material==='soft'?700:900,q:1.6,rate:.9});
      this.tone({type:'square',from:material==='stone'?95:150,to:material==='stone'?50:80,dur:.1,peak:.05});
    }
    // Coins scooped into the sack.
    lootChime(){this.tone({type:'triangle',from:880,to:1320,dur:.16,peak:.09});this.tone({t:.05,type:'triangle',from:1174,to:1568,dur:.14,peak:.07});}
    // A tower cracking apart and hitting the ground.
    demolish(){this.burst({dur:.7,peak:.26,freq:300,rate:.5});this.burst({t:.06,dur:.4,peak:.17,type:'bandpass',freq:1100,q:.8,rate:.8});this.tone({type:'square',from:80,to:38,dur:.6,peak:.1});}
    breach(){this.demolish();this.burst({t:.1,dur:1.1,peak:.28,freq:220,rate:.4});this.tone({t:.3,type:'sawtooth',from:262,to:392,dur:.9,peak:.11});}
    retreat(){this.tone({type:'sawtooth',from:330,to:165,dur:.9,peak:.1});this.tone({t:.1,from:247,to:123,dur:.9,peak:.09});}
    dispose(){if(this.ctx){try{this.ctx.close();}catch(_){}}this.ctx=null;}
  }

  class AutoBattle {
    constructor(host,target,options={}){
      if(!host||!host.appendChild)throw new Error('Night Raid Phaser needs a host');
      this.host=host;this.target=target;this.options=options;
      this.result=NightRaidRules.resolveAutoBattle(target,target.attackerDamage);
      this.soldierCount=clamp(Math.trunc(+target.attackerSoldiers||0),0,NightRaidRules.ARMY_DISPLAY_CAP);
      this.state={...this.result,status:'ready',timeMs:0,soldiers:this.soldierCount};
      this.choreo=NightRaidChoreo.build(this.result,target,this.soldierCount,options.pet||null,target.seed);
      this.reduce=!!options.reduceEffects||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
      this.duration=this.reduce?2200:this.choreo.durationMs;this.game=null;this.scene=null;this.running=false;this.finished=false;this.pendingCharge=false;this.elapsed=0;this.lastNotify=0;this.lastEvent=-1;
      this.audio=this.reduce?null:new RaidAudio();this.stepPulse=false;this.lastStepSound=-1e9;this.lastGateSound=-1e9;this.cam=null;
      const pet=options.pet,petText=pet?` Chó đội trưởng ${pet.name}, giống ${pet.breed}, cấp ${pet.level}.`:'';
      host.setAttribute('tabindex','0');host.setAttribute('role','img');host.setAttribute('aria-label',`Trận Cướp Đêm bằng Phaser. Pet dẫn ${this.soldierCount} lính. Sức công ${this.result.damage}, phòng thủ đối thủ ${target.shielded?'Khiên Đêm':this.result.defense}.${petText}`);
      this.visibility=()=>{if(!this.game||this.finished)return;if(document.hidden)this.game.loop.sleep();else{this.startedAt=performance.now()-this.elapsed;this.game.loop.wake();}};
      document.addEventListener('visibilitychange',this.visibility);
    }
    start(){
      return ensureRuntime().then(()=>this.prepareAssets()).then(()=>this.mount()).then(()=>{this.notify();return this;});
    }
    prepareAssets(){
      if(this.assetCanvases)return Promise.resolve();const petAtlas=(this.options.pet||{}).atlas==='large'?'large':'small';
      this.petAtlas=petAtlas;
      const sources={
        board:'img/night-raid/isometric-home-board-frame-v4.png',
        squad:'img/night-raid/animation/raider-actions-v2.webp',
        squadWalk:'img/night-raid/animation/raider-walk-v3.png',
        pet:'img/night-raid/animation/pet-actions-'+petAtlas+'-v2.webp',
        defenses:'img/night-raid/animation/defense-damage-v2.webp',
        economy:'img/night-raid/animation/economy-damage-v2.webp',
        castleA:'img/night-raid/animation/castle-damage-a-v2.webp',
        castleB:'img/night-raid/animation/castle-damage-b-v2.webp',
      };
      return Promise.all(Object.entries(sources).map(([key,src])=>decodeToCanvas(src).then(canvas=>[key,canvas]))).then(entries=>{this.assetCanvases=Object.fromEntries(entries);});
    }
    mount(){
      if(this.game)return Promise.resolve();
      // destroy() can land while start() is still decoding the eight sprite
      // sheets — the child taps the map button and confirms. Without this
      // flag mount() went on to build a Phaser.Game parented to a host that
      // had already been detached, and nothing held a reference to it any
      // more: an RAF loop rendering into nowhere for the rest of the session,
      // one per abandoned raid.
      if(this.destroyed)return Promise.resolve();
      return new Promise((resolve,reject)=>{
        const owner=this;
        class RaidScene extends Phaser.Scene {
          constructor(){super('night-raid-result');}
          preload(){}
          create(){try{owner.scene=this;owner.createScene(this);resolve();if(owner.pendingCharge)owner.beginCharge();}catch(error){reject(error);}}
          update(time,delta){owner.updateScene(time,delta);}
        }
        this.game=new Phaser.Game({type:Phaser.CANVAS,parent:this.host,width:SIZE,height:SIZE,transparent:true,render:{antialias:true,pixelArt:false,roundPixels:false},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:RaidScene,callbacks:{postBoot:game=>{game.canvas.setAttribute('aria-hidden','true');}}});
      });
    }
    makeTexture(scene,key,color,size=22){const g=scene.add.graphics();g.fillStyle(color,1).fillCircle(size/2,size/2,size/2-1).generateTexture(key,size,size).destroy();}
    addGrid(texture,prefix,cols,rows){
      const source=texture.getSourceImage(),width=source.width,height=source.height;
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const x0=Math.round(col*width/cols),x1=Math.round((col+1)*width/cols),y0=Math.round(row*height/rows),y1=Math.round((row+1)*height/rows);
        texture.add(prefix+row+'-'+col,0,x0,y0,x1-x0,y1-y0);
      }
    }
    // Generated action atlases provide real paw/leg and weapon poses. Phaser
    // swaps frames; it no longer deforms one still image to fake a walk.
    makeActor(scene,texKey,frameKey,height){
      const sprite=scene.add.image(0,0,texKey,frameKey),fw=sprite.frame.realWidth,fh=sprite.frame.realHeight,width=height*fw/fh;
      sprite.setOrigin(.5,.88).setDisplaySize(width,height);
      return {sprite,width,height,sx:sprite.scaleX,sy:sprite.scaleY};
    }
    createScene(scene){
      // Phaser's Canvas renderer corrupts direct WebP textures in some iOS
      // and embedded WebViews. Browser Canvas2D decodes them correctly, so
      // materialize each image once and let Phaser use the safe canvas copy.
      scene.textures.addCanvas('nr-board',this.assetCanvases.board);scene.textures.addCanvas('nr-squad-actions',this.assetCanvases.squad);scene.textures.addCanvas('nr-squad-walk',this.assetCanvases.squadWalk);scene.textures.addCanvas('nr-pet-actions',this.assetCanvases.pet);
      scene.textures.addCanvas('nr-defense-damage',this.assetCanvases.defenses);scene.textures.addCanvas('nr-economy-damage',this.assetCanvases.economy);
      scene.textures.addCanvas('nr-castle-a-damage',this.assetCanvases.castleA);scene.textures.addCanvas('nr-castle-b-damage',this.assetCanvases.castleB);
      scene.add.image(400,400,'nr-board').setDisplaySize(800,600).setDepth(0);
      this.makeTexture(scene,'nr-spark',0xffe477,18);this.makeTexture(scene,'nr-dust',0xdac8a6,26);this.makeTexture(scene,'nr-rubble',0x9b7559,18);this.makeTexture(scene,'nr-smoke',0x34404c,34);
      this.addGrid(scene.textures.get('nr-squad-actions'),'unit-',squadCols,squadRows);
      this.addGrid(scene.textures.get('nr-squad-walk'),'walk-',squadWalkCols,squadRows);
      this.addGrid(scene.textures.get('nr-pet-actions'),'pet-',petCols[this.petAtlas],5);
      this.addGrid(scene.textures.get('nr-defense-damage'),'def-',3,defenseRows.length);
      this.addGrid(scene.textures.get('nr-economy-damage'),'eco-',3,economyRows.length);
      this.addGrid(scene.textures.get('nr-castle-a-damage'),'castle-a-',3,5);this.addGrid(scene.textures.get('nr-castle-b-damage'),'castle-b-',3,5);
      this.petCell=clamp(Math.trunc(+(this.options.pet||{}).cell||0),0,4);

      // Everything on the ground shares one depth space (its foot/ground y),
      // so soldiers genuinely walk BEHIND far buildings and in front of near
      // ones instead of floating over the whole base.
      const CASTLE=NightRaidChoreo.CASTLE;
      const skin=this.target.castleSkin||'stone-keep',group=castleRows[1].includes(skin)?1:0,row=Math.max(0,castleRows[group].indexOf(skin));
      this.castleFrames={key:group?'nr-castle-b-damage':'nr-castle-a-damage',prefix:'castle-'+(group?'b-':'a-')+row+'-',atlas:group?'b':'a',row};
      // Two sprites: the stage being shown and the stage it is fading from.
      this.castleBack=scene.add.image(CASTLE.x,CASTLE.y,this.castleFrames.key,this.castleFrames.prefix+'0').setOrigin(.5,.9).setDepth(CASTLE.y-30).setDisplaySize(CASTLE_W,CASTLE_H).setVisible(false);
      this.castle=scene.add.image(CASTLE.x,CASTLE.y,this.castleFrames.key,this.castleFrames.prefix+'0').setOrigin(.5,.9).setDepth(CASTLE.y-30+.1).setDisplaySize(CASTLE_W,CASTLE_H);
      this.castleStage=0;

      this.defenders=[];
      for(const tower of this.choreo.towers){
        if(tower.virtual)continue;const dr=defenseRows.indexOf(tower.type),er=economyRows.indexOf(tower.type);if(dr<0&&er<0)continue;
        const key=dr>=0?'nr-defense-damage':'nr-economy-damage',prefix=(dr>=0?'def-'+dr:'eco-'+er)+'-',size=tower.type==='spike-trap'?64:(er>=0?94:88);
        const sprite=scene.add.image(tower.x,tower.y,key,prefix+'0').setOrigin(.5,.9).setDisplaySize(size,size).setDepth(tower.y);
        this.defenders.push({tower,sprite,prefix,sx:sprite.scaleX,sy:sprite.scaleY,stage:0});
      }
      this.actors=this.choreo.units.map(unit=>{
        const pet=unit.kind==='pet';
        const cols=pet?petCols[this.petAtlas]:squadCols,row=pet?this.petCell:unit.index%squadRows,actionPrefix=(pet?'pet-':'unit-')+row+'-';
        const part=this.makeActor(scene,pet?'nr-pet-actions':'nr-squad-actions',actionPrefix+'0',pet?112:108);
        return {unit,...part,pet,index:unit.index,row,actionPrefix,walkPrefix:'walk-'+row+'-',cols,dustTick:-1,frameKey:''};
      });
      this.trail=scene.add.graphics().setDepth(2);
      this.projectiles=scene.add.graphics().setDepth(800);
      this.damageMark=scene.add.graphics().setDepth(328).setVisible(false);
      this.spark=scene.add.particles(0,0,'nr-spark',{speed:{min:90,max:320},angle:{min:0,max:360},lifespan:{min:220,max:620},scale:{start:.8,end:0},alpha:{start:1,end:0},blendMode:'ADD',gravityY:260,quantity:0,emitting:false}).setDepth(1000);
      this.dust=scene.add.particles(0,0,'nr-dust',{speed:{min:6,max:34},angle:{min:205,max:335},lifespan:{min:280,max:680},scale:{start:.25,end:.95},alpha:{start:.3,end:0},quantity:0,emitting:false}).setDepth(5);
      this.rubble=scene.add.particles(0,0,'nr-rubble',{speed:{min:90,max:300},angle:{min:115,max:260},lifespan:{min:500,max:1200},scale:{start:.8,end:.28},rotate:{min:-260,max:260},gravityY:540,quantity:0,emitting:false}).setDepth(980);
      this.smoke=scene.add.particles(0,0,'nr-smoke',{speed:{min:10,max:44},angle:{min:210,max:325},lifespan:{min:650,max:1350},scale:{start:.3,end:1.2},alpha:{start:.34,end:0},quantity:0,emitting:false}).setDepth(940);
      scene.cameras.main.setBounds(0,0,SIZE,SIZE);
      this.paintFrame(0);this.moveCamera(0,0);
    }
    charge(){if(this.running||this.finished)return false;if(!this.scene){this.pendingCharge=true;return true;}this.beginCharge();return true;}
    beginCharge(){if(this.running||this.finished)return;this.pendingCharge=false;this.running=true;this.startedAt=performance.now()-this.elapsed;this.state.status='fighting';if(this.audio){this.audio.ensure();this.audio.warCry();}this.notify();}
    notify(){if(this.options.onUpdate)this.options.onUpdate(this.state,null,null);}
    impact(event){
      if(!this.scene)return;
      if(this.audio&&this.running){
        if(event.type==='launch')this.audio.launch(event.kind);
        else if(event.type==='impact')this.audio.impactShot(event.kind,event.lethal);
        else if(event.type==='fall')this.audio.fall();
        else if(event.type==='smash')this.audio.smash(event.material);
        // Eleven hammers on one door must not become a drum roll.
        else if(event.type==='gatehit'){if(this.elapsed-this.lastGateSound>150){this.lastGateSound=this.elapsed;this.audio.smash('stone');}}
        else if(event.type==='loot')this.audio.lootChime();
        else if(event.type==='demolish')this.audio.demolish();
        else if(event.type==='breach'){this.audio.breach();this.audio.warCry();}
        else if(event.type==='retreat')this.audio.retreat();
      }
      if(this.reduce)return;
      if(event.type==='launch'){this.spark.explode(4,event.x,event.y);return;}
      // A blow on a building chips it: a few sparks and a puff of dust.
      if(event.type==='smash'){this.spark.explode(3,event.x,event.y);this.dust.explode(2,event.x,event.y+18);return;}
      if(event.type==='gatehit'){this.spark.explode(3,event.x,event.y);return;}
      // Coins fly while the sacks are filled.
      if(event.type==='loot'){this.spark.explode(6,event.x,event.y);return;}
      const lethal=event.type==='breach'||event.type==='fall'||event.lethal,count=lethal?18:7;
      this.spark.explode(count,event.x,event.y);if(lethal)this.rubble.explode(event.type==='breach'?26:9,event.x,event.y);
      if(event.type==='fall')this.scene.cameras.main.shake(140,.004);
      if(event.type==='demolish'){this.rubble.explode(14,event.x,event.y+14);this.smoke.explode(8,event.x,event.y);this.dust.explode(6,event.x,event.y+26);this.scene.cameras.main.shake(220,.006);}
      // The camera push-in on the breach lives in cameraFrame(); here only the shake and the smoke.
      if(event.type==='breach'){this.smoke.explode(15,event.x,event.y-8);this.scene.cameras.main.shake(360,.012);}
    }
    drawProjectile(scene,shot,T){
      if(T<shot.launchAt||T>shot.impactAt)return;const p=NightRaidChoreo.shotAt(shot,T),trail=NightRaidChoreo.shotAt(shot,Math.max(shot.launchAt,T-65));
      this.projectiles.fillStyle(0x1c2430,.2).fillEllipse(p.x,p.ground+4,10,4.4);
      this.projectiles.lineStyle(shot.kind==='water'?7:4,shot.kind==='water'?0x75d9ff:0xf3dfb1,.72).beginPath().moveTo(trail.x,trail.y).lineTo(p.x,p.y).strokePath();
      this.projectiles.fillStyle(shot.kind==='water'?0xd6f4ff:0xa6a096,1).fillCircle(p.x,p.y,shot.kind==='water'?5:4);
    }
    // Planted footprints replayed from the same script the units walk: each
    // past step instant is quantised to a fixed 150ms grid, so prints stay on
    // the ground where the foot fell and fade there instead of sliding along
    // with the sprite. Pure function of T.
    paintTrail(T){
      const C=NightRaidChoreo,g=this.trail,STEP=150,base=Math.floor(T/STEP)*STEP;
      g.clear();
      for(const u of this.choreo.units){
        for(let k=0;k<8;k++){
          const tq=base-k*STEP;if(tq<=0)continue;
          const s=C.unitAt(u,tq);if(!s.moving)continue;
          const ahead=C.unitAt(u,tq+80),dx=ahead.x-s.x,dy=ahead.y-s.y,len=Math.hypot(dx,dy)||1;
          const nx=-dy/len,ny=dx/len,n=Math.round(tq/STEP),side=n%2?1:-1,age=T-tq,fa=Math.max(0,1-age/1300);
          if(fa<=0)continue;
          g.save();g.translateCanvas(s.x+nx*side*5,s.y+ny*side*2.5+2);g.rotateCanvas(Math.atan2(dy,dx));
          g.fillStyle(0x4a3c2a,fa*.3);
          if(u.kind==='pet'){g.fillEllipse(0,0,5.4,4);for(let t=-1;t<=1;t++)g.fillCircle(3.1,t*1.9,.95);}
          else g.fillEllipse(0,0,7.2,3.4);
          g.restore();
        }
      }
    }
    // Which ruin stage the castle shows at T, and how far into the crossfade
    // it is. Stage 1 lands ON the breach (with the shake and smoke), stage 2
    // once the looting is under way — never a hard swap.
    castleStageAt(T){
      const ch=this.choreo;if(!this.result.won||ch.breachAt==null)return {stage:0,xf:1};
      const t1=ch.breachAt,t2=ch.breachAt+Math.max(900,(ch.durationMs-ch.breachAt)*.35);
      if(T<t1)return {stage:0,xf:1};
      if(T<t2)return {stage:1,xf:clamp((T-t1)/CASTLE_XFADE_MS,0,1)};
      return {stage:2,xf:clamp((T-t2)/CASTLE_XFADE_MS,0,1)};
    }
    castlePlace(stage){
      const CASTLE=NightRaidChoreo.CASTLE,an=(castleAnchors[this.castleFrames.atlas]||castleAnchors.a)[this.castleFrames.row]||castleAnchors.a[0];
      const a=an[Math.min(stage,an.length-1)];
      return {x:CASTLE.x+(CASTLE_REF[0]-a[0])*CASTLE_W,y:CASTLE.y+(CASTLE_REF[1]-a[1])*CASTLE_H};
    }
    paintFrame(progress){
      if(!this.scene)return;const T=clamp(progress,0,1)*this.choreo.durationMs,C=NightRaidChoreo,ch=this.choreo;
      if(this.castle){
        const {stage,xf}=this.castleStageAt(T);
        if(stage!==this.castleStage){this.castleStage=stage;this.castle.setFrame(this.castleFrames.prefix+stage);if(stage>0)this.castleBack.setFrame(this.castleFrames.prefix+(stage-1));}
        const pf=this.castlePlace(stage);
        this.castle.setPosition(pf.x,pf.y).setAlpha(stage>0?xf:1);
        if(stage>0&&xf<1){const pb=this.castlePlace(stage-1);this.castleBack.setPosition(pb.x,pb.y).setAlpha(1-xf).setVisible(true);}
        else this.castleBack.setVisible(false);
        this.castle.setAngle(stage===1&&!this.reduce?Math.sin(T*.075)*1.2:0);
      }
      if(!this.reduce)this.paintTrail(T);
      // Towers wind up before each scripted shot, recoil after it, and — on a
      // breach — crack, tip over and hit the ground on the choreo schedule.
      this.defenders.forEach(d=>{
        const tw=d.tower;let recoil=0,windup=0;
        for(const f of tw.fireAt){const dt=T-f;if(dt>=-160&&dt<0)windup=Math.max(windup,1+dt/160);else if(dt>=0&&dt<140)recoil=Math.max(recoil,1-dt/140);}
        // Every melee blow visibly jolts the building being smashed.
        if(!this.reduce)for(const h of (tw.hitAt||[])){const dh=T-h;if(dh>=0&&dh<130)recoil=Math.max(recoil,1.5*(1-dh/130));}
        let angle=0,dy=0,alpha=1,broken=false;
        if(tw.fallAt!=null&&!this.reduce){
          if(T>tw.fallAt-240&&T<=tw.fallAt)dy=Math.sin((tw.fallAt-T)*.09)*2;      // pre-collapse tremble
          if(T>tw.fallAt){const fp=easeOut(Math.min(1,(T-tw.fallAt)/520));dy=fp*5;broken=fp>0;}
        } else if(tw.fallAt!=null&&this.reduce&&T>tw.fallAt){broken=true;}
        // Damage tells the story of the fight: intact -> cracked while the
        // blows land (crackAt) -> rubble at the collapse. It no longer waits
        // for the breach to happen elsewhere.
        const crack=tw.crackAt!=null?tw.crackAt:tw.fallAt;
        const stage=tw.fallAt==null||T<crack?0:T<tw.fallAt?1:2;
        if(stage!==d.stage){d.stage=stage;d.sprite.setFrame(d.prefix+stage);}
        d.sprite.x=tw.x+recoil*3;d.sprite.y=tw.y+dy;d.sprite.angle=angle;d.sprite.setAlpha(alpha);
        d.sprite.setScale(d.sx,d.sy*(windup?1-windup*.06:1));
        if(broken&&stage<2)d.sprite.setTint(0xe9d4c0);else d.sprite.clearTint();
        d.sprite.setDepth(tw.y);
      });
      // --- actors: pose everyone first, keep the bodies apart, then draw ----
      const STRIDE=C.STRIDE_PX||70;
      const poses=this.actors.map(actor=>{
        const u=actor.unit,pose=C.unitAt(u,T);
        const rushing=pose.state==='charge'||pose.state==='flee'||pose.state==='carry',moving=pose.moving&&!this.reduce;
        // The walk phase is ground covered divided by the stride, so the legs
        // stop the instant the body stops and slow down as it brakes. Wall
        // time used to run the cycle at full speed through the last 900 ms
        // of every eased arrival while the body crept — the classic slide.
        const cycle=C.odometer(u,T)/(actor.pet?STRIDE*1.15:STRIDE)+actor.index*.37;
        const gait=moving?Math.sin(cycle*Math.PI*2):0,lift=Math.abs(gait);
        let x=pose.x,y=pose.y,angle=0,alpha=1,flash=0,sx=1,sy=1,frame=0;
        let texture=actor.pet?'nr-pet-actions':'nr-squad-actions',prefix=actor.actionPrefix;
        if(moving)y-=lift*(actor.pet?2.2:1.6);
        else if(pose.state==='idle'){y-=Math.abs(Math.sin(T*.0016+actor.index))*1.2;}
        // Melee: the pose follows THIS unit's blow schedule — wind up during
        // the 200 ms before a hit lands, strike for the 120 ms after it,
        // guard in between — instead of flipping two frames on a 190 ms clock
        // unrelated to when the blows actually land.
        if((pose.state==='engage'||pose.state==='loot')&&!moving){
          let next=Infinity,since=Infinity,strike=0;
          for(const b of (u.blowAt||[])){const d=b-T;if(d>=0){if(d<next)next=d;}else if(-d<since)since=-d;}
          if(since<120){frame=5;strike=1-since/120;}
          else if(next<200){frame=4;strike=-(1-next/200)*.35;}
          else if(pose.state==='loot'){frame=4;y-=Math.abs(Math.sin(T*.008+actor.index))*3;}
          else frame=4;
          x+=pose.facing*strike*7;
        }
        for(const st of u.staggerAt){const d=T-st;if(d>=0&&d<200){x+=Math.sin(d*.22)*3;flash=Math.max(flash,1-d/200);}}
        // Soldiers use the authored six-frame run cycle while advancing or
        // retreating. The action atlas takes over again for weapon swings,
        // stagger and fallen poses so the castle assault stays expressive.
        if(pose.state==='fallen'){
          // A shot lands: a 300 ms hop, tip and squash, then the body dims
          // on the ground — not a y+=5 teleport onto the last atlas column.
          const fp=clamp((T-u.fallAt)/300,0,1);
          y+=-Math.sin(fp*Math.PI)*12+fp*5;angle=(actor.index%2?1:-1)*16*fp;sx=1+.12*fp;sy=1-.22*fp;
          alpha=1-.45*clamp((T-u.fallAt-300)/600,0,1);
          frame=fp<.45?actor.cols-2:actor.cols-1;
        }
        else if(flash>.2)frame=Math.max(0,actor.cols-2);
        else if(moving&&!actor.pet){texture='nr-squad-walk';prefix=actor.walkPrefix;frame=Math.floor(cycle*squadWalkCols)%squadWalkCols;}
        else if(moving)frame=Math.floor(cycle*4)%Math.min(4,actor.cols);
        return {actor,u,pose,x,y,angle,alpha,flash,sx,sy,frame,texture,prefix,moving,cycle,rushing};
      });
      if(!this.reduce){
        const live=poses.filter(p=>p.pose.state!=='fallen'&&p.pose.state!=='idle');
        const spaced=separate(live.map(p=>({x:p.x,y:p.y})));
        live.forEach((p,i)=>{p.x=spaced[i].x;p.y=spaced[i].y;});
      }
      for(const p of poses){
        const actor=p.actor,frameKey=p.texture+'|'+p.prefix+p.frame;
        if(frameKey!==actor.frameKey){actor.frameKey=frameKey;actor.sprite.setTexture(p.texture,p.prefix+p.frame);}
        // The atlases are authored facing LEFT (toward the castle): mirror
        // only when a unit moves right — fleeing home or repositioning.
        const flip=p.pose.facing===1,depth=(p.pose.state==='fallen'?p.y-60:p.y)+(actor.pet?.5:0);
        // A fixed display box prevents a width pop at march → attack. Atlas
        // centroid compensation removes the remaining per-frame side jump.
        const actorWidth=actor.pet?actor.width:actor.height*1.32;
        const artAnchor=actor.pet?0:(p.texture==='nr-squad-walk'?squadWalkAnchors[actor.row][p.frame]:squadActionAnchors[actor.row][p.frame]);
        actor.bodyX=p.x;actor.bodyY=p.y;   // the world point the torso stands on (diagnostics / tests); sprite.x carries the atlas-anchor compensation
        actor.sprite.x=p.x+(flip?1:-1)*artAnchor*actorWidth;actor.sprite.y=p.y;actor.sprite.angle=p.angle;
        actor.sprite.setAlpha(p.alpha).setDepth(depth).setFlipX(flip).setDisplaySize(actorWidth*p.sx,actor.height*p.sy);
        if(p.flash>.35&&!this.reduce)actor.sprite.setTintFill(0xfff2f2);else actor.sprite.clearTint();
        // Dust and the boot sound only when a foot actually lands: two
        // contacts per stride cycle, none while the body stands still.
        if(p.moving){const step=Math.floor(p.cycle*2);if(step!==actor.dustTick){actor.dustTick=step;this.dust.explode(actor.pet?2:1,p.x+(flip?-14:14),p.y+2);this.stepPulse=true;}}
      }
      this.projectiles.clear();for(const shot of ch.shots)this.drawProjectile(this.scene,shot,T);
      this.damageMark.setVisible(false);
    }
    // Ease the real camera toward cameraFrame(T): frame-rate independent
    // smoothing so a 30 fps phone and a 120 Hz tablet land on the same shot.
    moveCamera(T,dtMs){
      if(!this.scene)return;const cam=this.scene.cameras.main;
      const f=this.reduce?{x:SIZE/2,y:SIZE/2,zoom:1}:cameraFrame(this.choreo,T);
      if(!this.cam||!dtMs)this.cam={x:f.x,y:f.y,zoom:f.zoom};
      else{const k=1-Math.exp(-dtMs/CAMERA_TAU_MS);this.cam.x+=(f.x-this.cam.x)*k;this.cam.y+=(f.y-this.cam.y)*k;this.cam.zoom+=(f.zoom-this.cam.zoom)*k;}
      cam.setZoom(this.cam.zoom);cam.centerOn(this.cam.x,this.cam.y);
    }
    updateScene(_time,delta){
      if(!this.running||this.finished)return;this.elapsed=Math.min(this.duration,performance.now()-this.startedAt);const p=this.elapsed/this.duration,T=p*this.choreo.durationMs;this.state.timeMs=this.elapsed;this.paintFrame(p);this.moveCamera(T,delta);
      while(this.lastEvent+1<this.choreo.events.length&&this.choreo.events[this.lastEvent+1].t<=T){this.lastEvent++;this.impact(this.choreo.events[this.lastEvent]);}
      if(this.stepPulse){this.stepPulse=false;if(this.audio&&this.elapsed-this.lastStepSound>170){this.lastStepSound=this.elapsed;this.audio.step();}}
      if(this.elapsed-this.lastNotify>=220){this.lastNotify=this.elapsed;this.notify();}
      if(this.elapsed>=this.duration){this.running=false;this.finished=true;this.state.status=this.result.status;this.state.timeMs=this.result.durationMs;this.paintFrame(1);this.moveCamera(this.choreo.durationMs,delta);this.notify();if(this.options.onFinish)this.options.onFinish({...this.state},[]);}
    }
    destroy(){
      this.destroyed=true;
      document.removeEventListener('visibilitychange',this.visibility);this.running=false;
      if(this.audio){this.audio.dispose();this.audio=null;}
      if(this.game){try{this.game.loop.sleep();this.game.destroy(false);}catch(_){}this.game=null;}this.scene=null;
    }
  }

  return Object.freeze({ensureRuntime,AutoBattle,SIZE,cameraFrame,separate,castleAnchors,CASTLE_REF,FRAME_ZOOM_MIN,FRAME_ZOOM_MAX,BREACH_ZOOM});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=NightRaidPhaser;
