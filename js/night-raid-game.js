// Canvas session for the one Castle Night Raid combat mode.
var NightRaidGame = (() => {
  'use strict';

  const W=1000,H=560,LANE_TOP=248,LANE_GAP=55;
  const Choreo=typeof NightRaidChoreo!=='undefined'?NightRaidChoreo:(typeof require==='function'?require('./night-raid-choreo.js'):null);
  const laneY=lane=>LANE_TOP+lane*LANE_GAP;
  const worldX=x=>235+x*80;
  const SQUAD_WALK_ANCHORS=[
    [ .0171, .0432,-.0091, .0200, .0493, .0448],[ .0090, .0019, .0312,-.0161, .0262,-.0002],
    [ .0214, .0347,-.0014, .0089, .0192, .0005],[ .0414, .0339, .0021,-.0140, .0268, .0007],
    [ .0139, .0248, .0458, .0302, .0965, .0499],[ .0195,-.0087, .0066,-.0249, .0101, .0688],
  ];
  const SQUAD_ACTION_ANCHORS=[
    [ .0417, .0627,-.0409,-.1082,-.0933, .0596, .0789, .0448],[ .0739, .0755,-.0054,-.0582,-.0105, .0622,-.0050,-.0340],
    [ .0413, .0371,-.0104,-.0612,-.0775, .0071, .0074, .0069],[ .0485, .0810, .0646,-.0368,-.0574,-.0848,-.0274,-.0240],
    [ .0231, .0013,-.0445,-.1180,-.0979, .0197,-.0273,-.0433],[ .0311, .0345,-.0086,-.0825,-.1500,-.0150,-.0619,-.0989],
  ];

  class Game {
    constructor(canvas,target,options={}) {
      if(!canvas||!canvas.getContext) throw new Error('Night Raid needs a canvas');
      this.canvas=canvas;this.ctx=canvas.getContext('2d');this.target=target;this.options=options;
      this.state=NightRaidRules.createState(target,target.seed);this.selected='goblin';this.commands=[];
      this.running=false;this.paused=false;this.raf=0;this.last=0;this.acc=0;this.lastPaint=0;this.lastNotify=0;this.finished=false;
      this.reduce=!!options.reduceEffects||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
      this.particles=[];this.impactPulse=0;this.replayQueue=null;this.replayIndex=0;this.replaySpeed=1;this.boundFrame=t=>this.frame(t);this.boundPointer=e=>this.pointer(e);this.boundKey=e=>this.key(e);
      canvas.width=W;canvas.height=H;canvas.setAttribute('tabindex','0');canvas.setAttribute('role','application');
      canvas.setAttribute('aria-label','Night Raid battlefield. Select a robber, then choose one of five lanes.');
      canvas.addEventListener('pointerup',this.boundPointer);canvas.addEventListener('keydown',this.boundKey);
      this.resize();this.ro=typeof ResizeObserver==='function'?new ResizeObserver(()=>this.resize()):null;if(this.ro)this.ro.observe(canvas);
      NightRaidArt.preloadDefenses(()=>{if(this.running||this.paused)this.paint(performance.now());});
    }
    resize(){const r=this.canvas.getBoundingClientRect();if(!r.width)return;this.canvas.style.setProperty('--nr-aspect',W+'/'+H);}
    start(){if(this.running)return;this.running=true;this.last=performance.now();this.notify();this.raf=requestAnimationFrame(this.boundFrame);}
    destroy(){this.running=false;cancelAnimationFrame(this.raf);this.canvas.removeEventListener('pointerup',this.boundPointer);this.canvas.removeEventListener('keydown',this.boundKey);if(this.ro)this.ro.disconnect();}
    setSelected(id){if(NightRaidRules.raiderById(id)){this.selected=id;this.notify();this.paint(performance.now());}}
    togglePause(){if(!this.options.allowPause)return false;this.paused=!this.paused;this.notify();return this.paused;}
    deploy(lane){const result=NightRaidRules.deploy(this.state,this.selected,lane);if(result.ok){this.commands.push({at:this.state.timeMs,type:'deploy',unitId:this.selected,lane});this.spark(worldX(NightRaidRules.COLS+.65),laneY(lane)-22,'#ffd47e',7);if(typeof navigator!=='undefined'&&navigator.vibrate&&!this.reduce)navigator.vibrate(8);}this.notify(result);return result;}
    pointer(event){if(this.options.replay||this.state.status!=='playing'||this.paused)return;const r=this.canvas.getBoundingClientRect(),y=(event.clientY-r.top)*H/r.height;let lane=Math.round((y-LANE_TOP)/LANE_GAP);lane=Math.max(0,Math.min(4,lane));this.deploy(lane);}
    key(event){if(this.options.replay)return;if(event.key>='1'&&event.key<='5'){this.setSelected(NightRaidRules.RAIDERS[Number(event.key)-1].id);event.preventDefault();return;}if(event.key==='ArrowUp'||event.key==='ArrowDown'){const current=Number(this.canvas.dataset.lane||2),next=Math.max(0,Math.min(4,current+(event.key==='ArrowUp'?-1:1)));this.canvas.dataset.lane=String(next);this.options.onAnnounce&&this.options.onAnnounce('Lane '+(next+1));event.preventDefault();return;}if(event.code==='Space'){this.deploy(Number(this.canvas.dataset.lane||2));event.preventDefault();}if(event.key==='Escape'&&this.options.allowPause){this.togglePause();event.preventDefault();}}
    playReplay(commands,speed=1){this.replayQueue=NightRaidRules.normalizeCommands(commands);this.replayIndex=0;this.replaySpeed=Math.max(1,Math.min(2,+speed||1));this.options.replay=true;this.start();}
    replayDeploys(){while(this.replayQueue&&this.replayIndex<this.replayQueue.length&&this.replayQueue[this.replayIndex].at<=this.state.timeMs){const c=this.replayQueue[this.replayIndex++];NightRaidRules.deploy(this.state,c.unitId,c.lane);this.spark(worldX(NightRaidRules.COLS+.65),laneY(c.lane)-22,'#9bd5ff',this.reduce?3:7);}}
    notify(extra){if(this.options.onUpdate)this.options.onUpdate(this.state,this.selected,extra||null);}
    spark(x,y,color,count){for(let i=0;i<count;i++){const a=Math.PI*2*i/count+(i%2)*.2,s=25+(i*13%34);this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:500+(i%3)*100,max:700,color,size:3+(i%3)});}}
    consumeEvents(){for(const e of this.state.events){if(e.type==='castle-hit'||e.type==='bomb-castle'){this.impactPulse=1;this.spark(168,laneY(e.lane)-20,'#ffc06b',this.reduce?5:18);}else if(e.type==='bomb'||e.type==='defense-down'){this.spark(worldX(e.x),laneY(e.lane)-20,e.material==='stone'?'#c5d1de':'#e3a96c',this.reduce?4:13);}else if(e.type==='raider-down'){this.spark(worldX(e.x),laneY(e.lane)-20,'#e6d7ff',this.reduce?3:8);}else if(e.type==='fox-loot'){this.spark(158,laneY(e.lane)-45,'#ffd45f',9);} }
    }
    updateParticles(dt){for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=75*dt/1000;}this.particles=this.particles.filter(p=>p.life>0);this.impactPulse=Math.max(0,this.impactPulse-dt/500);}
    frame(now){if(!this.running)return;const raw=Math.min(250,now-this.last);this.last=now;if(!this.paused&&this.state.status==='playing'&&!document.hidden){this.acc+=raw*this.replaySpeed;while(this.acc>=NightRaidRules.TICK_MS){this.replayDeploys();NightRaidRules.tick(this.state,NightRaidRules.TICK_MS);this.consumeEvents();this.acc-=NightRaidRules.TICK_MS;}this.updateParticles(raw);if(now-this.lastPaint>32){this.paint(now);this.lastPaint=now;}if(this.state.status!=='playing'&&!this.finished){this.finished=true;this.paint(now);this.options.onFinish&&this.options.onFinish(this.state,this.commands.slice());}}
      if(now-this.lastNotify>=200){this.notify();this.lastNotify=now;}
      if(this.paused||document.hidden)this.paint(now);this.raf=requestAnimationFrame(this.boundFrame);
    }
    paint(now){const ctx=this.ctx;ctx.clearRect(0,0,W,H);NightRaidArt.drawScene(ctx,W,H,this.target.sceneId,now,this.reduce);
      // Castle is deliberately large and remains the visual objective.
      NightRaidArt.drawCastle(ctx,145,492,this.target.castleSkin||'stone-keep',this.state.castleHp,this.state.castleMaxHp,this.impactPulse);
      const defenses=this.state.defenses.slice().sort((a,b)=>a.lane-b.lane||a.x-b.x);for(const d of defenses){if(d.dead&&d.type!=='guard-dog')continue;if((NightRaidRules.defenseById(d.type)||{}).trap&&!d.revealed){ctx.fillStyle='rgba(157,124,79,.22)';ctx.beginPath();ctx.ellipse(worldX(d.x),laneY(d.lane),24,7,0,0,Math.PI*2);ctx.fill();continue;}NightRaidArt.drawDefense(ctx,d,worldX(d.x),laneY(d.lane),now);}
      for(const r of this.state.raiders)NightRaidArt.drawRaider(ctx,r,worldX(r.x),laneY(r.lane),now);
      for(const s of this.state.shots)NightRaidArt.drawProjectile(ctx,s,worldX,laneY);
      for(const p of this.particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
      // Selected keyboard lane stays visible without depending on color alone.
      const focusLane=Number(this.canvas.dataset.lane||-1);if(document.activeElement===this.canvas&&focusLane>=0){ctx.strokeStyle='#fff7b2';ctx.lineWidth=3;ctx.setLineDash([8,7]);ctx.strokeRect(4,laneY(focusLane)-48,W-8,52);ctx.setLineDash([]);}
      if(this.paused){ctx.fillStyle='rgba(3,8,18,.68)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='700 38px system-ui';ctx.textAlign='center';ctx.fillText('PAUSED',W/2,H/2);}
    }
  }

  // One-tap presentation layer. The result is decided by the shared DAM/DEF
  // rules before the animation starts; canvas only makes that result readable.
  class AutoBattle {
    constructor(canvas,target,options={}){
      if(!canvas||!canvas.getContext)throw new Error('Night Raid needs a canvas');
      this.canvas=canvas;this.ctx=canvas.getContext('2d');this.target=target;this.options=options;
      this.result=NightRaidRules.resolveAutoBattle(target,target.attackerDamage);this.soldierCount=Math.max(0,Math.min(NightRaidRules.ARMY_DISPLAY_CAP,Math.trunc(+target.attackerSoldiers||0)));this.state={...this.result,status:'ready',timeMs:0,soldiers:this.soldierCount};
      this.running=false;this.startedAt=0;this.raf=0;this.finished=false;
      this.reduce=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Deterministic battle script: enemy fire, casualties and paths are all
      // staged up-front; reduce-motion replays the same timeline compressed.
      this.choreo=Choreo.build(this.result,target,this.soldierCount,options.pet||null,target.seed);
      this.duration=this.reduce?2000:this.choreo.durationMs;this.boundFrame=t=>this.frame(t);
      this.size=800;this.assets={};
      this.loadAsset('board','img/night-raid/isometric-home-board-frame-v4.png');
      this.loadAsset('squadActions','img/night-raid/animation/raider-actions-v2.webp');
      this.loadAsset('squadWalk','img/night-raid/animation/raider-walk-v3.png');
      if(options.pet)this.loadAsset('pet','img/night-raid/pet-soldiers-'+(options.pet.atlas==='large'?'large':'small')+'-v2.webp');
      NightRaidArt.preloadDefenses(()=>this.paint(this.duration?this.state.timeMs/this.duration:0));
      if(typeof CastleSkins!=='undefined'&&CastleSkins.preload)CastleSkins.preload(()=>this.paint(this.duration?this.state.timeMs/this.duration:0));
      const petText=options.pet?` Chó đội trưởng ${options.pet.name}, giống ${options.pet.breed}, cấp ${options.pet.level}, đứng trong đội hình tiến công.`:'';
      canvas.width=this.size;canvas.height=this.size;canvas.setAttribute('tabindex','0');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Trận Cướp Đêm tự động trên sân nhà isometric. Pet dẫn ${this.soldierCount} lính. Sức công ${this.result.damage}, phòng thủ đối thủ ${target.shielded?'Khiên Đêm':this.result.defense}.${petText}`);
      this.paint(0);
    }
    loadAsset(key,src){if(typeof Image==='undefined')return;const img=new Image();img.decoding='async';img.onload=()=>{this.assets[key]=img;this.paint(this.duration?this.state.timeMs/this.duration:0);};img.src=src;}
    start(){this.paint(0);this.notify();}
    charge(){if(this.running||this.finished)return false;this.running=true;this.state.status='fighting';this.startedAt=performance.now();this.notify();this.raf=requestAnimationFrame(this.boundFrame);return true;}
    destroy(){this.running=false;cancelAnimationFrame(this.raf);}
    notify(){if(this.options.onUpdate)this.options.onUpdate(this.state,null,null);}
    frame(now){if(!this.running)return;const elapsed=Math.min(this.duration,now-this.startedAt);this.state.timeMs=elapsed;const p=elapsed/this.duration;this.paint(p);if(elapsed>=this.duration){this.running=false;this.finished=true;this.state.status=this.result.status;this.state.timeMs=this.result.durationMs;this.paint(1);this.notify();if(this.options.onFinish)this.options.onFinish({...this.state},[]);return;}if(!document.hidden)this.raf=requestAnimationFrame(this.boundFrame);else setTimeout(()=>this.frame(performance.now()),120);if(elapsed%220<18)this.notify();}
    drawStepContact(x,y,phase,pet,alpha=1){const ctx=this.ctx,lead=Math.sin(phase),rear=-lead;
      ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='rgba(45,35,25,.2)';ctx.beginPath();ctx.ellipse(x,y+2,pet?22:18,pet?6:5,0,0,Math.PI*2);ctx.fill();
      const foot=(dx,dy,lift,size)=>{ctx.globalAlpha=alpha*(.24+.62*Math.max(0,1-lift));ctx.fillStyle='#352a22';ctx.beginPath();ctx.ellipse(x+dx,y+dy,size,size*.42,-.18,0,Math.PI*2);ctx.fill();};
      if(pet){foot(-12,-1,Math.max(0,lead),4.2);foot(11,1,Math.max(0,rear),4.2);foot(-5,3,Math.max(0,rear),3.7);foot(16,3,Math.max(0,lead),3.7);}
      else{foot(-8,1,Math.max(0,lead),5);foot(8,1,Math.max(0,rear),5);}
      ctx.restore();
    }
    // A real two-frame gait from one authored sprite: the torso remains
    // stable while the lower-body crop swaps left/right every half-step.
    // This reads as changing legs instead of translating a cardboard cutout.
    drawStrideSprite(img,sx,sw,h,w,top,step,moving){const ctx=this.ctx,split=top+h*.67,phase=Math.sin(step),swap=moving&&phase<0;
      ctx.save();ctx.beginPath();ctx.rect(-w*.55,top-2,w*1.1,split-top+8);ctx.clip();ctx.drawImage(img,sx,0,sw,img.height,-w*.5,top,w,h);ctx.restore();
      ctx.save();ctx.beginPath();ctx.rect(-w*.58,split-5,w*1.16,h-(split-top)+13);ctx.clip();if(swap)ctx.scale(-1,1);ctx.drawImage(img,sx,0,sw,img.height,-w*.5,top,w,h);ctx.restore();
    }
    drawSquadMember(index,x,y,size,alpha=1,step=0,moving=false,motion=1,state='idle',flash=0){const ctx=this.ctx,row=index%6,walk=this.assets.squadWalk,actions=this.assets.squadActions,img=moving&&walk?walk:actions;if(!img)return;const cols=moving?6:8,rows=6,raw=moving?Math.floor(step/Math.PI*2):state==='fallen'?7:flash>.2?6:(state==='engage'||state==='loot')?4+Math.floor(step/3):0,frame=((raw%cols)+cols)%cols,x0=Math.round(frame*img.width/cols),x1=Math.round((frame+1)*img.width/cols),y0=Math.round(row*img.height/rows),y1=Math.round((row+1)*img.height/rows),sw=x1-x0,sh=y1-y0,h=size,w=h*1.32,anchor=(moving?SQUAD_WALK_ANCHORS:SQUAD_ACTION_ANCHORS)[row][frame];this.drawStepContact(x,y,step,false,alpha);ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.drawImage(img,x0,y0,sw,sh,-w*(.5+anchor),-h*.88,w,h);ctx.restore();}
    drawPetLeader(x,y,size,alpha=1,showBadge=true,step=0,moving=false,motion=1){const ctx=this.ctx,img=this.assets.pet,pet=this.options.pet;if(!img||!pet)return;const sw=img.width/5,sx=Math.max(0,Math.min(4,pet.cell||0))*sw,h=size,w=h*sw/img.height,stride=moving?Math.sin(step)*motion:0,bounce=moving?Math.abs(stride)*10:0;this.drawStepContact(x,y,step,true,alpha);ctx.save();ctx.globalAlpha=alpha;ctx.translate(x+stride*5,y-bounce);ctx.rotate(-.035+stride*.085);if(moving)ctx.scale(1+Math.abs(stride)*.04,1-Math.abs(stride)*.055);this.drawStrideSprite(img,sx,sw,h,w,-h*.82,step,moving);ctx.restore();if(!showBadge)return;ctx.save();ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.font='900 13px system-ui';const name=String(pet.name||pet.breed||'Dog').slice(0,12),labelW=Math.max(52,ctx.measureText(name).width+16);ctx.fillStyle='rgba(42,31,50,.88)';NightRaidArt.roundRect(ctx,x-labelW/2,y+4,labelW,22,11);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(name,x,y+19);ctx.font='950 11px system-ui';ctx.fillStyle='#f48b2d';NightRaidArt.roundRect(ctx,x+labelW/2-24,y-53,42,20,10);ctx.fill();ctx.fillStyle='#fff';ctx.fillText('LV '+pet.level,x+labelW/2-3,y-39);ctx.restore();}
    // Renders the NightRaidChoreo script at one point in time. Projectiles
    // fly with real travel time and only explode at their scripted impact.
    // Footprints and kicked-up dust, replayed from the same script the units
    // walk: each past step instant is quantised to a fixed 150ms grid, so the
    // prints stay PLANTED on the ground and fade where the foot fell instead
    // of sliding along with the sprite. Pure function of T — seeking a replay
    // shows the same trail.
    drawTrail(ctx,u,T){const C=Choreo,STEP=150,base=Math.floor(T/STEP)*STEP;
      for(let k=0;k<8;k++){
        const tq=base-k*STEP;if(tq<=0)continue;
        const s=C.unitAt(u,tq);if(!s.moving)continue;
        const ahead=C.unitAt(u,tq+80),dx=ahead.x-s.x,dy=ahead.y-s.y,len=Math.hypot(dx,dy)||1;
        const fx=dx/len,fy=dy/len,nx=-fy,ny=fx,n=Math.round(tq/STEP),side=n%2?1:-1,age=T-tq;
        const rush=s.state==='charge'||s.state==='flee'?1.35:1;
        const fa=Math.max(0,1-age/1200);
        if(fa>0){const px=s.x+nx*side*5,py=s.y+ny*side*2.5+2;
          ctx.save();ctx.translate(px,py);ctx.rotate(Math.atan2(dy,dx));ctx.globalAlpha=fa*.3;ctx.fillStyle='#4a3c2a';
          if(u.kind==='pet'){ctx.beginPath();ctx.ellipse(0,0,2.7,2,0,0,Math.PI*2);ctx.fill();for(let t=-1;t<=1;t++){ctx.beginPath();ctx.arc(3.1,t*1.9,.95,0,Math.PI*2);ctx.fill();}}
          else{ctx.beginPath();ctx.ellipse(0,0,3.6,1.7,0,0,Math.PI*2);ctx.fill();}
          ctx.restore();}
        const da=Math.max(0,1-age/700);
        if(da>0&&k<5){const bx=s.x-fx*(11+age*.022),by=s.y-2-age*.012,r=(3.2+age*.017)*rush;
          ctx.globalAlpha=da*.24*rush;ctx.fillStyle='#e8dcc2';
          ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);ctx.fill();
          ctx.beginPath();ctx.arc(bx-fx*4.5,by-2.5,r*.68,0,Math.PI*2);ctx.fill();
          ctx.beginPath();ctx.arc(bx+nx*side*3,by-1,r*.5,0,Math.PI*2);ctx.fill();
          ctx.globalAlpha=1;}
      }
    }
    paint(progress){const ctx=this.ctx,S=this.size,ch=this.choreo,C=Choreo;
      const T=Math.max(0,Math.min(1,progress))*ch.durationMs,now=T;
      ctx.clearRect(0,0,S,S);
      if(this.assets.board)ctx.drawImage(this.assets.board,0,S*.125,S,S*.75);
      const won=this.result.won,hpMax=this.target.castleHp||200;
      const breachP=won&&ch.breachAt!=null?Math.max(0,Math.min(1,(T-ch.breachAt)/Math.max(1,ch.durationMs-ch.breachAt))):0;
      const hp=won?Math.max(0,hpMax*(1-breachP)):hpMax;
      let shake=0;
      if(!this.reduce){for(const e of ch.events){const dt=T-e.t;if(dt<0||dt>260)continue;if(e.type==='fall'||e.type==='breach'||e.type==='demolish'||(e.type==='impact'&&e.lethal))shake=Math.max(shake,3*(1-dt/260));}
        if(breachP>0&&breachP<1)shake=Math.max(shake,2);}
      ctx.save();ctx.translate(shake*Math.sin(T*.11),0);
      NightRaidArt.drawCastle(ctx,205,350,this.target.castleSkin||'stone-keep',hp,hpMax,breachP>0&&breachP<.5?1-breachP*2:0);
      ctx.restore();
      // Towers wind up before each scripted shot and recoil after it.
      for(const tw of ch.towers){
        if(tw.virtual)continue;
        const dead=tw.fallAt!=null?T>tw.fallAt:won&&ch.breachAt!=null&&T>ch.breachAt+500;
        let recoil=0,windup=0;
        for(const f of tw.fireAt){const d=T-f;if(d>=-160&&d<0)windup=Math.max(windup,1+d/160);else if(d>=0&&d<140)recoil=Math.max(recoil,1-d/140);}
        // Every melee blow on the building jolts it visibly.
        if(!this.reduce)for(const h of (tw.hitAt||[])){const d=T-h;if(d>=0&&d<130)recoil=Math.max(recoil,1.5*(1-d/130));}
        ctx.save();ctx.translate(tw.x+recoil*3,tw.y);if(windup)ctx.transform(1,0,0,1-windup*.06,0,0);
        NightRaidArt.drawDefense(ctx,{type:tw.type,hp:100,maxHp:100,dead,lane:0},0,0,now);
        ctx.restore();
      }
      // Trails go down first so every unit walks ON its own footprints.
      if(!this.reduce)for(const u of ch.units)this.drawTrail(ctx,u,T);
      const easeOut=p=>1-(1-p)*(1-p);
      const actors=[],motion=this.reduce?.38:1;
      for(const u of ch.units){
        const s=C.unitAt(u,T);
        let x=s.x,y=s.y,rot=0,alpha=1,flash=0;
        if(s.state==='idle')x+=Math.sin(now*.002+u.index*1.3)*1.2;
        const step=now*(this.reduce?.009:.022)+u.index*1.7;
        if(s.moving){const gait=Math.sin(step);x+=gait*1.4;rot=gait*.025;}
        else if(s.state==='engage'&&T>ch.engageStart){const lunge=Math.max(0,Math.sin(now*.005+u.index*1.9));x-=lunge*7;rot=-lunge*.06;}
        if(s.state==='fallen'){const fp=easeOut(Math.min(1,(T-u.fallAt)/420));rot=(u.index%2?1:-1)*1.35*fp;y+=fp*8;alpha=1-.25*fp;}
        for(const st of u.staggerAt){const d=T-st;if(d>=0&&d<180){x+=Math.sin(d*.25)*3;flash=Math.max(flash,1-d/180);}}
        actors.push({u,x,y,rot,alpha,flash,facing:s.facing,state:s.state,moving:s.moving,step});
      }
      actors.sort((a,b)=>(a.state==='fallen'?-900:0)+a.y-((b.state==='fallen'?-900:0)+b.y));
      for(const a of actors){
        ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.rot);if(a.facing===1)ctx.scale(-1,1);
        if(a.u.kind==='pet')this.drawPetLeader(0,0,145,a.alpha,a.facing===-1&&a.state!=='fallen',a.step,a.moving,motion);
        else this.drawSquadMember(a.u.index%6,0,0,108,a.alpha,a.step,a.moving,motion,a.state,a.flash);
        if(a.flash&&!this.reduce){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a.flash*.45;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(0,-58,24,50,0,0,Math.PI*2);ctx.fill();}
        ctx.restore();
        if(!this.reduce&&a.moving){const beat=(Math.sin(a.step)+1)/2;if(beat>.82){ctx.globalAlpha=.1+(beat-.82)*.8;ctx.fillStyle='#e7dcc0';ctx.beginPath();ctx.arc(a.x+(a.facing===1?-18:18),a.y-1,4+(beat-.82)*18,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}}
      }
      for(const s of ch.shots){
        if(T<s.launchAt)continue;
        const d=T-s.launchAt;
        if(!this.reduce&&d<240){const g=d/240;ctx.globalAlpha=.38*(1-g);ctx.fillStyle=s.kind==='water'?'#bfe9ff':'#efe6cf';ctx.beginPath();ctx.arc(s.from.x-4-g*10,s.from.y-2-g*8,4+g*9,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
        if(T<=s.impactAt){
          const p=C.shotAt(s,T);
          ctx.save();
          ctx.globalAlpha=.22;ctx.fillStyle='#1c2430';ctx.beginPath();ctx.ellipse(p.x,p.ground+4,5,2.2,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
          if(s.kind==='water'){for(let i=0;i<4;i++){const q=C.shotAt(s,T-i*36);if(q.p<=0)break;ctx.globalAlpha=1-i*.22;ctx.fillStyle=i?'#8fd8ff':'#d9f2ff';ctx.beginPath();ctx.arc(q.x,q.y,4.4-i*.8,0,Math.PI*2);ctx.fill();}}
          else{ctx.translate(p.x,p.y);ctx.rotate(d*.02);ctx.fillStyle='#8d8a80';ctx.beginPath();ctx.arc(0,0,4.6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c9c6ba';ctx.beginPath();ctx.arc(-1.4,-1.4,1.7,0,Math.PI*2);ctx.fill();}
          ctx.restore();
        } else if(T-s.impactAt<340&&!this.reduce){
          const g=(T-s.impactAt)/340;ctx.save();ctx.globalAlpha=1-g;
          if(s.kind==='water'){ctx.strokeStyle='#bfe9ff';ctx.lineWidth=2;for(let i=0;i<5;i++){const a2=Math.PI+i*.55,r=4+g*16;ctx.beginPath();ctx.moveTo(s.to.x+Math.cos(a2)*3,s.to.y+Math.sin(a2)*2);ctx.lineTo(s.to.x+Math.cos(a2)*r,s.to.y-Math.abs(Math.sin(a2))*r*.7);ctx.stroke();}}
          else{ctx.strokeStyle='#efe1bd';ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.to.x,s.to.y,3+g*14,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#a5a095';for(let i=0;i<5;i++){const a2=i*1.26,r=3+g*17;ctx.beginPath();ctx.arc(s.to.x+Math.cos(a2)*r,s.to.y+Math.sin(a2)*r*.6-g*6,1.6,0,Math.PI*2);ctx.fill();}}
          ctx.restore();
        }
      }
      if(T>ch.engageStart&&T<ch.engageEnd){for(let i=0;i<6;i++){const pulse=Math.max(0,Math.sin(now*.005+i*2.1));if(pulse>.55)NightRaidArt.drawClashSpark(ctx,352+(i%3)*30,352+(i%2)*36,(pulse-.55)*1.6,i);}}
      if(won&&breachP>0){for(let i=0;i<3;i++)NightRaidArt.drawClashSpark(ctx,215+i*24,270+i*34,.35+.5*Math.sin(now*.02+i),i+6);}
      // Battle state is rendered by the responsive DOM HUD. Keeping it out of
      // the canvas prevents a second status banner from covering the estate.
    }
  }
  return Object.freeze({Game,AutoBattle,W,H,laneY,worldX});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=NightRaidGame;
