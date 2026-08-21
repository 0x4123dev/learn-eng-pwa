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
  const easeOut=p=>1-(1-p)*(1-p);
  const squadBoxes=[[0,300],[285,675],[670,1065],[1060,1425],[1415,1770],[1760,2172]];

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
      this.soldierCount=clamp(Math.trunc(+target.attackerSoldiers||0),0,NightRaidRules.MAX_SOLDIERS);
      this.state={...this.result,status:'ready',timeMs:0,soldiers:this.soldierCount};
      this.choreo=NightRaidChoreo.build(this.result,target,this.soldierCount,options.pet||null,target.seed);
      this.reduce=!!options.reduceEffects||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
      this.duration=this.reduce?2200:this.choreo.durationMs;this.game=null;this.scene=null;this.running=false;this.finished=false;this.pendingCharge=false;this.elapsed=0;this.lastNotify=0;this.lastEvent=-1;
      this.audio=this.reduce?null:new RaidAudio();this.stepPulse=false;this.lastStepSound=-1e9;
      const pet=options.pet,petText=pet?` Chó đội trưởng ${pet.name}, giống ${pet.breed}, cấp ${pet.level}.`:'';
      host.setAttribute('tabindex','0');host.setAttribute('role','img');host.setAttribute('aria-label',`Trận Cướp Đêm bằng Phaser. Pet dẫn ${this.soldierCount} lính. Sức công ${this.result.damage}, phòng thủ đối thủ ${this.result.defense}.${petText}`);
      this.visibility=()=>{if(!this.game||this.finished)return;if(document.hidden)this.game.loop.sleep();else{this.startedAt=performance.now()-this.elapsed;this.game.loop.wake();}};
      document.addEventListener('visibilitychange',this.visibility);
    }
    start(){
      return ensureRuntime().then(()=>this.prepareAssets()).then(()=>this.mount()).then(()=>{this.notify();return this;});
    }
    prepareAssets(){
      if(this.assetCanvases)return Promise.resolve();const petAtlas=(this.options.pet||{}).atlas==='large'?'large':'small';
      const sources={board:'img/night-raid/isometric-home-board-skin-pad.webp',squad:'img/night-raid/raider-squad.webp',pet:'img/night-raid/pet-soldiers-'+petAtlas+'-v2.webp'};
      for(const id of ['pebble-pup','wood-fence','stone-wall','spike-trap','water-cannon'])sources['def-'+id]='img/night-raid/'+id+'.webp';
      return Promise.all(Object.entries(sources).map(([key,src])=>decodeToCanvas(src).then(canvas=>[key,canvas]))).then(entries=>{this.assetCanvases=Object.fromEntries(entries);});
    }
    mount(){
      if(this.game)return Promise.resolve();
      return new Promise((resolve,reject)=>{
        const owner=this;
        class RaidScene extends Phaser.Scene {
          constructor(){super('night-raid-result');}
          preload(){}
          create(){try{owner.scene=this;owner.createScene(this);resolve();if(owner.pendingCharge)owner.beginCharge();}catch(error){reject(error);}}
          update(time,delta){owner.updateScene(time,delta);}
        }
        this.game=new Phaser.Game({type:Phaser.CANVAS,parent:this.host,width:SIZE,height:SIZE,transparent:false,backgroundColor:'#dcefc8',render:{antialias:true,pixelArt:false,roundPixels:false},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:RaidScene,callbacks:{postBoot:game=>{game.canvas.setAttribute('aria-hidden','true');}}});
      });
    }
    makeTexture(scene,key,color,size=22){const g=scene.add.graphics();g.fillStyle(color,1).fillCircle(size/2,size/2,size/2-1).generateTexture(key,size,size).destroy();}
    // Torso and legs are two crops of the SAME frame. The torso stays stable
    // while the leg band mirrors every half-step, so the unit reads as
    // alternating legs instead of a rocking cardboard cutout.
    makeActor(scene,texKey,frameKey,height){
      const upper=scene.add.image(0,0,texKey,frameKey),lower=scene.add.image(0,0,texKey,frameKey);
      const fw=upper.frame.realWidth,fh=upper.frame.realHeight,width=height*fw/fh;
      for(const s of [upper,lower]){s.setOrigin(.5,.86);s.setDisplaySize(width,height);}
      upper.setCrop(0,0,fw,fh*.66);lower.setCrop(0,fh*.64,fw,fh*.36);
      return {upper,lower,width,height,sx:upper.scaleX,sy:upper.scaleY};
    }
    createScene(scene){
      // Phaser's Canvas renderer corrupts direct WebP textures in some iOS
      // and embedded WebViews. Browser Canvas2D decodes them correctly, so
      // materialize each image once and let Phaser use the safe canvas copy.
      scene.textures.addCanvas('nr-board',this.assetCanvases.board);scene.textures.addCanvas('nr-squad',this.assetCanvases.squad);scene.textures.addCanvas('nr-pet',this.assetCanvases.pet);
      for(const id of ['pebble-pup','wood-fence','stone-wall','spike-trap','water-cannon'])scene.textures.addCanvas('nr-def-'+id,this.assetCanvases['def-'+id]);
      scene.add.image(400,400,'nr-board').setDisplaySize(800,800).setDepth(0);
      scene.add.rectangle(400,400,800,800,0x172044,.12).setDepth(1);
      this.makeTexture(scene,'nr-spark',0xffe477,18);this.makeTexture(scene,'nr-dust',0xdac8a6,26);this.makeTexture(scene,'nr-rubble',0x9b7559,18);this.makeTexture(scene,'nr-smoke',0x34404c,34);
      const squadTexture=scene.textures.get('nr-squad');
      squadBoxes.forEach((box,i)=>squadTexture.add('unit-'+i,0,box[0],0,box[1]-box[0],724));
      const petTexture=scene.textures.get('nr-pet'),petCell=clamp(Math.trunc(+(this.options.pet||{}).cell||0),0,4),petW=petTexture.getSourceImage().width/5;
      petTexture.add('leader',0,Math.round(petCell*petW),0,Math.round(petW),724);

      // Everything on the ground shares one depth space (its foot/ground y),
      // so soldiers genuinely walk BEHIND far buildings and in front of near
      // ones instead of floating over the whole base.
      this.castleCanvas=document.createElement('canvas');this.castleCanvas.width=340;this.castleCanvas.height=340;this.castleCtx=this.castleCanvas.getContext('2d',{alpha:true});
      scene.textures.addCanvas('nr-castle-live',this.castleCanvas);
      const CASTLE=NightRaidChoreo.CASTLE;
      this.castle=scene.add.image(CASTLE.x,CASTLE.y,'nr-castle-live').setOrigin(.5,320/340).setDepth(CASTLE.y-30).setDisplaySize(300,300);
      this.castleBaseScale={x:this.castle.scaleX,y:this.castle.scaleY};
      this.paintCastle(1,0);
      if(typeof CastleSkins!=='undefined'&&CastleSkins.preload)CastleSkins.preload(()=>{if(this.scene)this.paintCastle(this.result.won&&this.finished?0:1,0);});

      this.defenders=[];
      for(const tower of this.choreo.towers){if(tower.virtual||!scene.textures.exists('nr-def-'+tower.type))continue;const size=tower.type==='spike-trap'?58:86;const sprite=scene.add.image(tower.x,tower.y,'nr-def-'+tower.type).setOrigin(.5,1).setDisplaySize(size,size).setDepth(tower.y);this.defenders.push({tower,sprite,sx:sprite.scaleX,sy:sprite.scaleY});}
      this.actors=this.choreo.units.map(unit=>{
        const pet=unit.kind==='pet';
        const part=this.makeActor(scene,pet?'nr-pet':'nr-squad',pet?'leader':'unit-'+(unit.index%6),pet?112:108);
        return {unit,...part,pet,index:unit.index,dustTick:-1};
      });
      this.trail=scene.add.graphics().setDepth(2);
      this.projectiles=scene.add.graphics().setDepth(800);
      this.damageMark=scene.add.graphics().setDepth(328).setVisible(false);
      this.spark=scene.add.particles(0,0,'nr-spark',{speed:{min:90,max:320},angle:{min:0,max:360},lifespan:{min:220,max:620},scale:{start:.8,end:0},alpha:{start:1,end:0},blendMode:'ADD',gravityY:260,quantity:0,emitting:false}).setDepth(1000);
      this.dust=scene.add.particles(0,0,'nr-dust',{speed:{min:6,max:34},angle:{min:205,max:335},lifespan:{min:280,max:680},scale:{start:.25,end:.95},alpha:{start:.3,end:0},quantity:0,emitting:false}).setDepth(5);
      this.rubble=scene.add.particles(0,0,'nr-rubble',{speed:{min:90,max:300},angle:{min:115,max:260},lifespan:{min:500,max:1200},scale:{start:.8,end:.28},rotate:{min:-260,max:260},gravityY:540,quantity:0,emitting:false}).setDepth(980);
      this.smoke=scene.add.particles(0,0,'nr-smoke',{speed:{min:10,max:44},angle:{min:210,max:325},lifespan:{min:650,max:1350},scale:{start:.3,end:1.2},alpha:{start:.34,end:0},quantity:0,emitting:false}).setDepth(940);
      this.paintFrame(0);
    }
    paintCastle(ratio,impact){
      if(!this.castleCtx)return;const ctx=this.castleCtx;ctx.clearRect(0,0,340,340);const max=this.target.castleHp||200,hp=Math.max(0,max*ratio);NightRaidArt.drawCastle(ctx,170,320,this.target.castleSkin||'stone-keep',hp,max,impact);const texture=this.scene&&this.scene.textures.get('nr-castle-live');if(texture)texture.refresh();
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
        else if(event.type==='demolish')this.audio.demolish();
        else if(event.type==='breach'){this.audio.breach();this.audio.warCry();}
        else if(event.type==='retreat')this.audio.retreat();
      }
      if(this.reduce)return;
      if(event.type==='launch'){this.spark.explode(4,event.x,event.y);return;}
      const lethal=event.type==='breach'||event.type==='fall'||event.lethal,count=lethal?18:7;
      this.spark.explode(count,event.x,event.y);if(lethal)this.rubble.explode(event.type==='breach'?26:9,event.x,event.y);
      if(event.type==='fall')this.scene.cameras.main.shake(140,.004);
      if(event.type==='demolish'){this.rubble.explode(14,event.x,event.y+14);this.smoke.explode(8,event.x,event.y);this.dust.explode(6,event.x,event.y+26);this.scene.cameras.main.shake(220,.006);}
      if(event.type==='breach'){this.smoke.explode(15,event.x,event.y-8);this.scene.cameras.main.shake(360,.012);this.scene.cameras.main.zoomTo(1.065,170,'Quad.easeOut',true);this.scene.time.delayedCall(720,()=>this.scene&&this.scene.cameras.main.zoomTo(1,260,'Sine.easeInOut',true));}
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
    paintFrame(progress){
      if(!this.scene)return;const T=clamp(progress,0,1)*this.choreo.durationMs,C=NightRaidChoreo,ch=this.choreo,breachP=this.result.won&&ch.breachAt!=null?clamp((T-ch.breachAt)/Math.max(1,ch.durationMs-ch.breachAt),0,1):0;
      if(this.castle){const collapse=clamp(breachP*1.55,0,1);this.castle.setAlpha(1-collapse*.82).setAngle(breachP?Math.sin(T*.075)*3.5*(1-collapse):0).setScale(this.castleBaseScale.x*(1-breachP*.12),this.castleBaseScale.y*(1-breachP*.3));}
      if(!this.reduce)this.paintTrail(T);
      // Towers wind up before each scripted shot, recoil after it, and — on a
      // breach — crack, tip over and hit the ground on the choreo schedule.
      this.defenders.forEach(d=>{
        const tw=d.tower;let recoil=0,windup=0;
        for(const f of tw.fireAt){const dt=T-f;if(dt>=-160&&dt<0)windup=Math.max(windup,1+dt/160);else if(dt>=0&&dt<140)recoil=Math.max(recoil,1-dt/140);}
        let angle=0,dy=0,alpha=1,broken=false;
        if(tw.fallAt!=null&&!this.reduce){
          if(T>tw.fallAt-240&&T<=tw.fallAt)dy=Math.sin((tw.fallAt-T)*.09)*2;      // pre-collapse tremble
          if(T>tw.fallAt){const fp=easeOut(Math.min(1,(T-tw.fallAt)/520));angle=(tw.gx%2?1:-1)*74*fp;dy=fp*10;alpha=1-.62*fp;broken=fp>0;}
        } else if(tw.fallAt!=null&&this.reduce&&T>tw.fallAt){angle=(tw.gx%2?1:-1)*74;alpha=.4;broken=true;}
        d.sprite.x=tw.x+recoil*3;d.sprite.y=tw.y+dy;d.sprite.angle=angle;d.sprite.setAlpha(alpha);
        d.sprite.setScale(d.sx,d.sy*(windup?1-windup*.06:1));
        if(broken)d.sprite.setTint(0x9a8877);else d.sprite.clearTint();
        d.sprite.setDepth(tw.y);
      });
      this.actors.forEach(actor=>{
        const u=actor.unit,pose=C.unitAt(u,T);
        const rushing=pose.state==='charge'||pose.state==='flee',moving=pose.moving&&!this.reduce;
        const cadence=this.reduce?.008:(rushing?.024:.017);
        const phase=T*cadence+actor.index*1.47,gait=moving?Math.sin(phase):0,lift=Math.abs(gait);
        let x=pose.x,y=pose.y,angle=0,alpha=1,flash=0;
        if(moving){y-=lift*(actor.pet?4.5:3.5);angle=pose.facing*-(rushing?5:2.4)+gait*1.1;}
        else if(pose.state==='idle'){y-=Math.abs(Math.sin(T*.0016+actor.index))*1.2;}
        else if(pose.state==='engage'&&T>ch.engageStart&&!this.reduce){const lunge=Math.max(0,Math.sin(T*.005+actor.index*1.9));x+=pose.facing*lunge*7;angle=pose.facing*lunge*4;}
        if(pose.state==='fallen'){const fp=easeOut(Math.min(1,(T-u.fallAt)/420));angle=(actor.index%2?78:-78)*fp;y+=fp*8;alpha=1-.45*fp;}
        for(const st of u.staggerAt){const d=T-st;if(d>=0&&d<200){x+=Math.sin(d*.22)*3;flash=Math.max(flash,1-d/200);}}
        const flip=pose.facing===1,swap=moving&&gait<0,depth=(pose.state==='fallen'?y-60:y)+(actor.pet?.5:0);
        for(const s of [actor.upper,actor.lower]){s.x=x;s.y=y;s.angle=angle;s.setAlpha(alpha);s.setDepth(depth);}
        actor.upper.flipX=flip;actor.lower.flipX=swap?!flip:flip;
        actor.upper.setScale(actor.sx,actor.sy*(moving?1-lift*.03:1));actor.lower.setScale(actor.sx,actor.sy);
        if(flash>.35&&!this.reduce){actor.upper.setTintFill(0xfff2f2);actor.lower.setTintFill(0xfff2f2);}
        else{actor.upper.clearTint();actor.lower.clearTint();}
        if(moving){const tick=Math.floor(phase/Math.PI);if(tick!==actor.dustTick){actor.dustTick=tick;this.dust.explode(actor.pet?2:1,x+(flip?-14:14),y+2);this.stepPulse=true;}}
      });
      this.projectiles.clear();for(const shot of ch.shots)this.drawProjectile(this.scene,shot,T);
      if(this.result.won&&breachP>.18){
        const reveal=clamp((breachP-.18)/.45,0,1);this.damageMark.setVisible(true).clear().setAlpha(reveal);
        this.damageMark.fillStyle(0x5b4132,.48).fillEllipse(205,354,185,35);
        const stones=[[141,340,22,13,0xc8a27c],[165,329,17,15,0x927057],[185,344,24,13,0xd5b18d],[210,331,19,17,0xa77e61],[232,345,26,14,0xc39370],[259,334,19,15,0x84634f],[282,346,16,11,0xb78c68],[155,352,14,9,0x795b49],[220,356,17,10,0xe0bea0],[269,356,20,9,0x694d41]];
        stones.forEach(c=>this.damageMark.fillStyle(c[4],1).fillEllipse(c[0],c[1],c[2],c[3]).lineStyle(2,0x563e31,.62).strokeEllipse(c[0],c[1],c[2],c[3]));
        this.damageMark.fillStyle(0xbc765f,1).fillTriangle(169,335,182,299,193,338).fillTriangle(238,341,249,305,260,342);
        this.damageMark.lineStyle(3,0x704538,.9).strokeTriangle(169,335,182,299,193,338).strokeTriangle(238,341,249,305,260,342);
        this.damageMark.fillStyle(0x352b28,.82).fillEllipse(208,342,35,15);
      }
      else this.damageMark.setVisible(false);
    }
    updateScene(_time,delta){
      if(!this.running||this.finished)return;this.elapsed=Math.min(this.duration,performance.now()-this.startedAt);const p=this.elapsed/this.duration,T=p*this.choreo.durationMs;this.state.timeMs=this.elapsed;this.paintFrame(p);
      while(this.lastEvent+1<this.choreo.events.length&&this.choreo.events[this.lastEvent+1].t<=T){this.lastEvent++;this.impact(this.choreo.events[this.lastEvent]);}
      if(this.stepPulse){this.stepPulse=false;if(this.audio&&this.elapsed-this.lastStepSound>170){this.lastStepSound=this.elapsed;this.audio.step();}}
      if(this.elapsed-this.lastNotify>=220){this.lastNotify=this.elapsed;this.notify();}
      if(this.elapsed>=this.duration){this.running=false;this.finished=true;this.state.status=this.result.status;this.state.timeMs=this.result.durationMs;this.paintFrame(1);this.notify();if(this.options.onFinish)this.options.onFinish({...this.state},[]);}
    }
    destroy(){
      document.removeEventListener('visibilitychange',this.visibility);this.running=false;
      if(this.audio){this.audio.dispose();this.audio=null;}
      if(this.game){try{this.game.loop.sleep();this.game.destroy(false);}catch(_){}this.game=null;}this.scene=null;
    }
  }

  return Object.freeze({ensureRuntime,AutoBattle,SIZE});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=NightRaidPhaser;
