// "Nhà tan hoang" — the little story a child gets when they raid a house that
// somebody else already emptied today. The friends list gives nothing away on
// purpose: they press attack, the squad marches in, the lantern finds rubble
// where a castle should be, everyone hesitates, and they walk home empty
// handed. The mood is "tiếc quá, tới trễ rồi" — never a failure buzzer. No
// blood, no explosion: the wreck is old and already cold.
//
// Presentation only. The 24h lockout is decided on the server; this module
// just breaks the news. Canvas 2D like night-raid-game.js — no Phaser, no new
// asset: the rubble comes from NightRaidArt.drawRuins (castle-damage sheets),
// the squad from the same walk atlases the auto-battle uses.
//
//   NightRaidRuins.play(canvasOrHost, {castleSkin, name}, {onFinish}) -> handle
//   handle.destroy()   stops everything and lets go of the canvas (idempotent)
//
// onFinish fires exactly once, either when the story ends or immediately if
// play() cannot run at all, so the caller is never left waiting. destroy() is
// the owner stopping it on purpose and does NOT fire onFinish.
var NightRaidRuins = (() => {
  'use strict';

  const Art=typeof NightRaidArt!=='undefined'?NightRaidArt:(typeof require==='function'?require('./night-raid-art.js'):null);

  // ── The beat sheet, in ms ────────────────────────────────────────────────
  // Nothing here is random: the same call always plays the same 5.3 seconds.
  const BEATS=Object.freeze({
    march:1500,     // squad walks in from the right, lantern leading
    reveal:900,     // the light spreads over the pile — oh.
    beat:900,       // nobody moves
    turn:300,       // the squad spins on the spot
    retreat:1500,   // and walks back out the way it came
    hold:200,       // the wreck sits there, lit, for the card to land on
  });
  const MARCH_END=BEATS.march,
        REVEAL_END=MARCH_END+BEATS.reveal,
        BEAT_END=REVEAL_END+BEATS.beat,
        TURN_END=BEAT_END+BEATS.turn,
        RETREAT_END=TURN_END+BEATS.retreat,
        DURATION_MS=RETREAT_END+BEATS.hold;

  // ── Assets already on disk for the auto-battle ───────────────────────────
  const SOLDIER_SHEET='img/night-raid/animation/raider-walk-v4.webp',SOLDIER_COLS=6,SOLDIER_ROWS=10;
  // Frame 3 is the only pose in the walk strip with both feet under the body,
  // so it doubles as "standing still" and we never load the action atlas too.
  const SOLDIER_IDLE=3;
  const PET_COLS=4,PET_ROWS=5;
  const petSheet=atlas=>'img/night-raid/pet-walk-'+(atlas==='small'?'small':'large')+'-v1.png';
  // Horizontal visual centroid measured inside each raider-walk cell: a swung
  // sword or a wide stride moves the transparent bounds, and without this the
  // torso slides sideways as the legs cycle. Same measurement (and same
  // numbers) as SQUAD_WALK_ANCHORS in night-raid-game.js — keep them in step.
  const WALK_ANCHORS=Object.freeze([
    [ .0171, .0432,-.0091, .0200, .0493, .0448],[ .0090, .0019, .0312,-.0161, .0262,-.0002],
    [ .0214, .0347,-.0014, .0089, .0192, .0005],[ .0414, .0339, .0021,-.0140, .0268, .0007],
    [ .0139, .0248, .0458, .0302, .0965, .0499],[ .0195,-.0087, .0066,-.0249, .0101, .0688],
    [0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],
  ].map(r=>Object.freeze(r)));
  // The dog stands about 90% of its square cell tall, the goblins about 98% of
  // theirs, so the dog's cell is scaled up 1.14x to read a head taller than the
  // troops it leads. PET_FOOT lifts the cell so its paws touch the ground line.
  const PET_CELL_SCALE=1.14,PET_FOOT=.054;

  // Formation, in soldier heights, measured from the pet. The dog leads; four
  // raiders trail in two loose ranks so the group overlaps like a crowd rather
  // than lining up like a fence. `s` is the depth scale — the back rank sits
  // higher on the ground plane AND smaller, which is the only cue a flat side
  // view has for "behind".
  const SQUAD=Object.freeze([
    Object.freeze({pet:true,dx:0,dy:0,s:1}),
    Object.freeze({row:0,dx:.46,dy:-.10,s:.86}),
    Object.freeze({row:2,dx:.66,dy:.10,s:1}),
    Object.freeze({row:1,dx:1.00,dy:-.06,s:.88}),
    Object.freeze({row:3,dx:1.20,dy:.13,s:.97}),
  ]);

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const lerp=(a,b,p)=>a+(b-a)*p;
  const easeOut=p=>1-(1-p)*(1-p);
  const easeIn=p=>p*p;
  // The walk home: heavy in the first step, then a steady trudge. A plain
  // quadratic left them standing still for a third of the retreat.
  const easeTrudge=p=>p*(.4+.6*p);
  // 0 before `from`, 1 after `to` — every beat below is a pure function of T.
  const span=(t,from,to)=>clamp((t-from)/Math.max(1,to-from),0,1);
  const rgba=(r,g,b,a)=>'rgba('+r+','+g+','+b+','+(Math.round(clamp(a,0,1)*1000)/1000)+')';

  // Everything is a fraction of the canvas so the same clip reads on a 320px
  // phone strip and on a wide result card.
  function layout(w,h) {
    // Sized off the shorter constraint: on a tall narrow box a height-only
    // rule made the troops so big they stood on top of the rubble.
    const soldierH=clamp(Math.min(h*.20,w*.15),22,120);
    return {
      w,h,groundY:h*.82,soldierH,petH:soldierH*PET_CELL_SCALE,
      // The pile sits left of centre with room on its left for the tracks of
      // whoever got here first, and the squad halts clear of the rubble.
      ruinX:w*.36,ruinW:Math.min(w*.50,h*1.15),
      enterX:w+soldierH*1.0,stopX:w*.73,exitX:w+soldierH*2.6,
    };
  }

  // Where the squad's leader stands, which way it faces, and whether its feet
  // are moving — the whole choreography, as one pure function of time.
  function squadAt(L,T) {
    let x,moving;
    if(T<=MARCH_END){x=lerp(L.enterX,L.stopX,easeOut(span(T,0,MARCH_END)));moving=true;}
    else if(T<=TURN_END){
      // A small recoil at the reveal — the squad leans back half a step before
      // it accepts what it is looking at — then creeps a little closer during
      // the beat, the way a child edges up to something disappointing.
      x=L.stopX+L.soldierH*.16*Math.sin(Math.PI*span(T,MARCH_END,REVEAL_END))
              -L.soldierH*.10*easeOut(span(T,REVEAL_END,BEAT_END));
      moving=false;
    }
    else{x=lerp(L.stopX,L.exitX,easeTrudge(span(T,TURN_END,RETREAT_END)));moving=true;}
    // -1 walks left (every sprite is authored facing right); the turn sweeps
    // facing through 0, which reads as spinning on the spot for the price of a
    // scale. A cosine, not a ramp: it is fastest exactly at the edge-on moment,
    // so nobody is stuck being a zero-width sliver.
    const facing=T<BEAT_END?-1:T>=TURN_END?1:-Math.cos(Math.PI*span(T,BEAT_END,TURN_END));
    // An about-face is a little hop in every cartoon a five-year-old has seen,
    // and the hop is doing real work here: the formation swaps sides exactly at
    // the edge-on instant, and the lift is what carries the eye over it.
    const turning=T>=BEAT_END&&T<TURN_END;
    const hop=turning?Math.sin(Math.PI*span(T,BEAT_END,TURN_END)):0;
    return {x,facing,moving,turning,hop};
  }

  // Horizontal scale for the turn. It bottoms out at 42% rather than passing
  // through zero: a sprite squeezed to nothing for a frame reads as a glitch,
  // a sprite squeezed to a squat body reads as somebody turning round.
  const spin=S=>(S.facing<0?-1:1)*(.42+.58*Math.abs(S.facing));
  // Which side of the leader the rest of the squad trails on. It flips in one
  // step at the middle of the turn — under cover of the squeeze and the hop —
  // instead of sliding through the leader and piling everyone on one spot.
  const trailSide=S=>S.facing<0?1:-1;

  function frameBox(img,cols,rows,col,row) {
    const x0=Math.round(col*img.width/cols),x1=Math.round((col+1)*img.width/cols);
    const y0=Math.round(row*img.height/rows),y1=Math.round((row+1)*img.height/rows);
    return {sx:x0,sy:y0,sw:x1-x0,sh:y1-y0};
  }

  class Scene {
    constructor(canvas,ctx,target,options,finish) {
      this.canvas=canvas;this.ctx=ctx;this.target=target;this.options=options;this.finish=finish;
      this.skin=String(target.castleSkin||'stone-keep');
      this.name=String(target.name||'').trim().slice(0,14);
      const pet=target.pet||options.pet||{};
      this.petAtlas=pet.atlas==='small'?'small':'large';
      this.petCell=clamp(Math.trunc(+pet.cell||0),0,PET_ROWS-1);
      this.sceneId=target.sceneId||'moonlit-village';
      this.reduce=!!options.reduceEffects||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
      this.assets={};this.raf=0;this.timer=0;this.startedAt=0;this.elapsed=0;this.done=false;this.destroyed=false;
      this.ownsCanvas=!!options.__ownsCanvas;
      this.boundFrame=t=>this.frame(t);

      this.resize();
      canvas.setAttribute('role','img');
      canvas.setAttribute('aria-label',
        (this.name?'Nhà của '+this.name:'Ngôi nhà này')+' đã bị người khác cướp trước rồi, chỉ còn lại một đống đổ nát. Đội quân của bạn quay về tay không.');
      if(Art&&Art.preloadRuins)Art.preloadRuins(this.skin,()=>this.paint(this.elapsed));
      this.load('soldiers',SOLDIER_SHEET);
      this.load('pet',petSheet(this.petAtlas));
      this.paint(0);
      this.startedAt=this.now();
      this.tick();
    }

    // Same read-only shape as the bail-out handle, so a caller can treat both
    // the same without asking which one it got.
    get finished(){return this.done||this.destroyed;}
    get durationMs(){return DURATION_MS;}
    now(){return typeof performance!=='undefined'&&performance.now?performance.now():Date.now();}
    load(key,src){
      if(typeof Image==='undefined')return;
      const img=new Image();img.decoding='async';
      img.onload=()=>{if(!this.destroyed){this.assets[key]=img;this.paint(this.elapsed);}};
      img.src=src;
    }
    // rAF when we can get it. A background tab throttles rAF to a stop, and a
    // host that never animates has none at all, so a timer takes over: the
    // story always reaches its end and the screen is never left waiting.
    tick(){
      if(this.destroyed)return;
      const hidden=typeof document!=='undefined'&&document.hidden;
      if(!hidden&&typeof requestAnimationFrame==='function')this.raf=requestAnimationFrame(this.boundFrame);
      else if(typeof setTimeout==='function')this.timer=setTimeout(()=>this.frame(this.now()),hidden?120:40);
      else this.complete();
    }
    frame(){
      if(this.destroyed)return;
      this.elapsed=clamp(this.now()-this.startedAt,0,DURATION_MS);
      this.paint(this.elapsed);
      if(this.elapsed>=DURATION_MS){this.complete();return;}
      this.tick();
    }
    complete(){
      if(this.done)return;
      this.done=true;this.stopClock();
      const fn=this.finish;this.finish=null;
      if(fn)fn();
    }
    stopClock(){
      if(this.raf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(this.raf);
      if(this.timer&&typeof clearTimeout==='function')clearTimeout(this.timer);
      this.raf=0;this.timer=0;
    }
    // A deliberate stop by the owner, not a bail-out: like NightRaidGame's own
    // destroy() it does NOT fire onFinish, or closing the screen mid-story
    // would fire the callback that advances it. Safe to call any number of
    // times, before or after the end.
    destroy(){
      if(this.destroyed)return;
      this.destroyed=true;this.stopClock();this.finish=null;
      if(this.ownsCanvas&&this.canvas&&this.canvas.parentNode&&this.canvas.parentNode.removeChild)
        {try{this.canvas.parentNode.removeChild(this.canvas);}catch(e){}}
      this.canvas=null;this.ctx=null;this.assets={};
    }

    // Honour whatever box the screen gave us; a detached or unstyled canvas
    // still gets a stage so the clip plays instead of dividing by zero.
    resize(){
      const c=this.canvas;let cw=0,ch=0;
      if(c.getBoundingClientRect){const r=c.getBoundingClientRect();cw=r.width||0;ch=r.height||0;}
      if(!cw)cw=c.clientWidth||0;
      if(!ch)ch=c.clientHeight||0;
      if(cw<40||ch<40){
        cw=900;ch=520;
        // Only ever style a canvas we made ourselves: a host that gave us a
        // container with no height would otherwise get a 0px-tall clip.
        if(this.ownsCanvas&&c.style){c.style.height='auto';c.style.aspectRatio='900 / 520';}
      }
      const dpr=clamp(typeof devicePixelRatio==='number'&&devicePixelRatio>0?devicePixelRatio:1,1,2);
      c.width=Math.round(cw*dpr);c.height=Math.round(ch*dpr);
    }

    paint(T) {
      const ctx=this.ctx,c=this.canvas;
      if(!ctx||!c)return;
      const w=c.width||900,h=c.height||520,L=layout(w,h),S=squadAt(L,T);
      ctx.clearRect(0,0,w,h);
      if(Art&&Art.drawScene)Art.drawScene(ctx,w,h,this.sceneId,T,this.reduce);
      else{ctx.fillStyle='#0b1a2e';ctx.fillRect(0,0,w,h);}

      // How much of the wreck the lantern has found. It used to fall back to 0
      // on the way out — a pretty ending, and the wrong one: the result card
      // lands the instant this clip stops, so the child read the message over a
      // black square and never saw the ruined house it is talking about. The
      // retreat now only takes the lantern down to .78, which still reads as
      // the light walking away while leaving the wreck plainly on screen for
      // the card to sit on.
      const lit=span(T,MARCH_END*.96,REVEAL_END)*(1-.22*span(T,TURN_END+300,RETREAT_END));
      const box=this.drawWreck(ctx,L,T,lit);
      this.drawShroud(ctx,L,box,1-lit);
      this.drawSquad(ctx,L,T,S);
      this.drawVeil(ctx,L,T,S);
    }

    drawWreck(ctx,L,T,lit) {
      const settle=1-.03*(1-easeOut(span(T,MARCH_END,MARCH_END+320)));   // one last stone dropping
      ctx.save();
      ctx.fillStyle='rgba(4,10,18,.34)';
      ctx.beginPath();ctx.ellipse(L.ruinX,L.groundY,L.ruinW*.52,L.ruinW*.075,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(L.ruinX,L.groundY);ctx.scale(1,settle);ctx.translate(-L.ruinX,-L.groundY);
      const drawn=Art&&Art.drawRuins?Art.drawRuins(ctx,L.ruinX,L.groundY,this.skin,L.ruinW):null;
      if(!drawn){
        // The sheet has not decoded yet: a low broken silhouette holds the
        // spot so the pile never pops in from nothing.
        ctx.fillStyle='#2b2620';ctx.beginPath();
        ctx.moveTo(L.ruinX-L.ruinW*.5,L.groundY);
        for(let i=0;i<=8;i++){const p=i/8;ctx.lineTo(L.ruinX+(p-.5)*L.ruinW,L.groundY-L.ruinW*(.06+.05*Math.abs(Math.sin(p*7.4))));}
        ctx.lineTo(L.ruinX+L.ruinW*.5,L.groundY);ctx.fill();
      }
      ctx.restore();
      if(lit>0){
        this.drawTracks(ctx,L,lit);
        this.drawDust(ctx,L,T,lit);
        this.drawSign(ctx,L,T,lit);
      }
      return drawn;
    }

    // Until the squad's light reaches it, the pile is just a dark lump where a
    // castle ought to be — the child's own eyes are the thing being fooled, the
    // same way the friends list gave nothing away. The shroud lifts on arrival
    // and closes again as the troops walk off.
    drawShroud(ctx,L,box,a) {
      if(a<=.01)return;
      const bh=box?box.h:L.ruinW*.34,cx=L.ruinX,cy=L.groundY-bh*.40,rx=L.ruinW*.86,ry=Math.max(bh*1.45,L.ruinW*.34);
      ctx.save();ctx.translate(cx,cy);ctx.scale(1,ry/rx);
      const g=ctx.createRadialGradient(0,0,rx*.12,0,0,rx);
      g.addColorStop(0,rgba(5,12,23,a*.94));g.addColorStop(.52,rgba(5,12,23,a*.86));g.addColorStop(1,rgba(5,12,23,0));
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,rx,0,Math.PI*2);ctx.fill();ctx.restore();
    }

    // The boot prints of whoever got here first, walking away to the left.
    // This is the whole plot in eight smudges: somebody already did this.
    drawTracks(ctx,L,lit) {
      ctx.save();ctx.fillStyle='#2f2a1c';
      for(let i=0;i<8;i++){
        const p=i/7,x=L.ruinX-L.ruinW*(.54+p*.55),y=L.groundY+L.soldierH*(.09+(i%2)*.15);
        ctx.globalAlpha=lit*.30*(1-p*.55);
        ctx.beginPath();ctx.ellipse(x,y,L.soldierH*.09,L.soldierH*.042,-.22,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }

    // Dust still settling, and a few embers too tired to be a fire. Both are
    // pure functions of T, so a seek shows the same frame.
    drawDust(ctx,L,T,lit) {
      if(this.reduce)return;
      ctx.save();
      for(let i=0;i<9;i++){
        const p=((T+i*317)%2600)/2600;
        const x=L.ruinX+Math.sin(i*2.31)*L.ruinW*.36+Math.sin(p*3.1+i)*L.ruinW*.03;
        const y=L.groundY-L.ruinW*.07-p*L.ruinW*.21;
        ctx.globalAlpha=lit*.34*(1-p);ctx.fillStyle='#dbd0b7';
        ctx.beginPath();ctx.arc(x,y,L.ruinW*(.011+p*.028),0,Math.PI*2);ctx.fill();
      }
      ctx.globalCompositeOperation='lighter';
      for(let i=0;i<5;i++){
        const p=((T+i*641)%3100)/3100;
        const x=L.ruinX+Math.cos(i*1.97)*L.ruinW*.27+Math.sin(p*4.2+i)*L.ruinW*.02;
        const y=L.groundY-L.ruinW*.09-p*L.ruinW*.26;
        ctx.globalAlpha=lit*.5*Math.sin(Math.PI*p);ctx.fillStyle='#ffb066';
        ctx.beginPath();ctx.arc(x,y,L.ruinW*.008,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }

    // Whose house this was. A leaning board, not a caption — the picture has
    // already said everything a five-year-old needs.
    drawSign(ctx,L,T,lit) {
      if(!this.name)return;
      const a=lit*span(T,REVEAL_END-260,REVEAL_END+240);
      if(a<=.01)return;
      // Planted in FRONT of the pile (lower on the ground plane = nearer the
      // camera), never on it: some skins fill their whole frame with rubble and
      // a board laid over that is unreadable.
      const fs=clamp(L.soldierH*.26,9,20),x=L.ruinX+L.ruinW*.36,y=L.groundY+L.soldierH*.26;
      ctx.save();ctx.globalAlpha=a;ctx.translate(x,y);ctx.rotate(-.14);
      ctx.font='700 '+fs.toFixed(1)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      const pad=fs*.7,bw=ctx.measureText(this.name).width+pad*2,bh=fs*1.75;
      ctx.fillStyle='#4a3524';ctx.fillRect(-fs*.09,0,fs*.18,L.soldierH*.30);
      ctx.fillStyle='#7c5a3a';ctx.strokeStyle='#3a2a1c';ctx.lineWidth=Math.max(1,fs*.11);
      if(Art&&Art.roundRect)Art.roundRect(ctx,-bw/2,-bh,bw,bh,fs*.28);else ctx.rect(-bw/2,-bh,bw,bh);
      ctx.fill();ctx.stroke();
      ctx.fillStyle='#f4e6cd';ctx.fillText(this.name,0,-bh/2);
      ctx.restore();
    }

    drawSquad(ctx,L,T,S) {
      const soldiers=this.assets.soldiers,pet=this.assets.pet;
      const phase=T*(this.reduce?.010:.021);
      const side=trailSide(S);
      // Painted back to front: whoever stands lower on the ground is nearer the
      // camera and must cover the ones behind.
      const members=SQUAD.map((m,i)=>({m,i,x:S.x+m.dx*L.soldierH*side,y:L.groundY+m.dy*L.soldierH}))
        .sort((a,b)=>a.y-b.y);
      for(const item of members){
        const m=item.m,bob=S.moving?0:Math.sin(T*.0026+item.i*1.4)*L.soldierH*.012;
        // The shadow stays on the ground while the body lifts — that gap is the
        // whole reason a hop reads as a hop.
        const lift=S.hop*L.soldierH*.13,y=item.y+bob-lift;
        this.drawContact(ctx,item.x,item.y,L.soldierH*m.s*(m.pet?.20:.16)*(1-S.hop*.22),S.moving?phase+item.i*1.7:0);
        if(m.pet)this.drawPet(ctx,pet,item.x,y,L.petH*m.s,S,phase);
        else this.drawSoldier(ctx,soldiers,m.row,item.x,y,L.soldierH*m.s,S,phase+item.i*1.7);
      }
    }

    drawContact(ctx,x,y,r,phase) {
      ctx.save();ctx.fillStyle='rgba(28,22,14,.26)';
      const squash=1-.12*Math.abs(Math.sin(phase));
      ctx.beginPath();ctx.ellipse(x,y+r*.12,r*1.25*squash,r*.34,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }

    drawSoldier(ctx,img,row,x,y,h,S,phase) {
      if(!img)return;
      const col=S.moving?((Math.floor(phase/Math.PI*2)%SOLDIER_COLS)+SOLDIER_COLS)%SOLDIER_COLS:SOLDIER_IDLE;
      const cut=frameBox(img,SOLDIER_COLS,SOLDIER_ROWS,col,row),w=h*cut.sw/cut.sh;
      const anchor=S.moving?WALK_ANCHORS[row][col]:0;
      ctx.save();ctx.translate(x,y);
      ctx.scale(spin(S),S.turning?1+(1-Math.abs(S.facing))*.12:1);
      ctx.drawImage(img,cut.sx,cut.sy,cut.sw,cut.sh,-w*(.5+anchor),-h,w,h);
      ctx.restore();
    }

    drawPet(ctx,img,x,y,h,S,phase) {
      if(!img)return;
      const col=S.moving?((Math.floor(phase/Math.PI*2)%PET_COLS)+PET_COLS)%PET_COLS:0;
      const cut=frameBox(img,PET_COLS,PET_ROWS,col,this.petCell),w=h*cut.sw/cut.sh;
      ctx.save();ctx.translate(x,y+h*PET_FOOT);
      ctx.scale(spin(S),S.turning?1+(1-Math.abs(S.facing))*.12:1);
      // While the squad stands there the dog tips its head — the only "aww" the
      // scene needs, and it costs one rotation.
      if(!S.moving&&!S.turning)ctx.rotate(-.05);
      ctx.drawImage(img,cut.sx,cut.sy,cut.sw,cut.sh,-w/2,-h,w,h);
      ctx.restore();
    }

    // Night everywhere except the pool of light the squad carries. The rubble
    // is on screen from the first frame but unreadable in the dark, so the
    // reveal happens when the troops arrive — exactly as the child experiences
    // it: nothing warned them.
    drawVeil(ctx,L,T,S) {
      const near=L.soldierH*2.2;
      const reach=Math.abs(L.stopX-L.ruinX)+L.ruinW*.52;
      let r=lerp(near,near*1.3,easeOut(span(T,0,MARCH_END)));
      r=lerp(r,reach,easeOut(span(T,MARCH_END,REVEAL_END)));
      let edge=lerp(.52,.34,easeOut(span(T,MARCH_END,REVEAL_END)));
      // The pool used to be pinned to the squad for the whole clip and to
      // shrink back as they left, which walked the light off the screen with
      // them: the result card lands the instant the clip ends, so the child
      // read "NHÀ ĐÃ TAN HOANG" over a black square and never saw the wreck.
      // From the turn onward the lantern is planted at the ruins and the squad
      // walks out of its own light, which is both what actually happens and
      // what leaves the card something to sit on.
      const settled=easeOut(span(T,BEAT_END,TURN_END));
      const cx=lerp(S.x,L.ruinX,settled),cy=L.groundY-L.petH*.45;
      ctx.save();
      const g=ctx.createRadialGradient(cx,cy,Math.max(1,r*.34),cx,cy,Math.max(2,r));
      g.addColorStop(0,rgba(5,11,22,0));g.addColorStop(.66,rgba(5,11,22,edge*.42));g.addColorStop(1,rgba(5,11,22,edge));
      ctx.fillStyle=g;ctx.fillRect(0,0,L.w,L.h);
      // The lantern itself, added on top so the veil cannot dim it.
      ctx.globalCompositeOperation='lighter';
      const warm=ctx.createRadialGradient(cx,cy,1,cx,cy,Math.max(2,r*.8));
      warm.addColorStop(0,'rgba(255,214,138,.30)');warm.addColorStop(.5,'rgba(255,183,96,.10)');warm.addColorStop(1,'rgba(255,183,96,0)');
      ctx.fillStyle=warm;ctx.fillRect(0,0,L.w,L.h);
      ctx.restore();
    }
  }

  // A handle that has already finished: play() hands one back whenever it has
  // to bail out, so the screen is never left waiting on an onFinish.
  function stub(){return Object.freeze({destroy(){},get finished(){return true;},durationMs:DURATION_MS});}

  function resolveCanvas(host) {
    if(!host)return null;
    if(typeof host.getContext==='function')return {canvas:host,owned:false};
    if(typeof host.appendChild!=='function'||typeof document==='undefined'||!document.createElement)return null;
    const canvas=document.createElement('canvas');
    if(!canvas||typeof canvas.getContext!=='function')return null;
    if(canvas.style){canvas.style.display='block';canvas.style.width='100%';canvas.style.height='100%';}
    if(canvas.dataset)canvas.dataset.nrRuins='';
    host.appendChild(canvas);
    return {canvas,owned:true};
  }

  // Plays: troops march in -> the ruined castle is revealed -> troops turn
  // back. onFinish always fires exactly once, including on every bail-out.
  function play(canvasOrHost,target,options) {
    options=options||{};
    let called=false;
    const raw=typeof options.onFinish==='function'?options.onFinish:null;
    const finish=()=>{if(called)return;called=true;if(raw){try{raw();}catch(e){}}};
    const found=resolveCanvas(canvasOrHost);
    if(!found){finish();return stub();}
    let ctx=null;
    try{ctx=found.canvas.getContext('2d');}catch(e){ctx=null;}
    if(!ctx){if(found.owned&&found.canvas.parentNode&&found.canvas.parentNode.removeChild){try{found.canvas.parentNode.removeChild(found.canvas);}catch(e){}}finish();return stub();}
    try{
      return new Scene(found.canvas,ctx,target||{},{...options,__ownsCanvas:found.owned},finish);
    }catch(e){
      finish();return stub();
    }
  }

  return Object.freeze({play,BEATS,DURATION_MS,MARCH_END,REVEAL_END,BEAT_END,TURN_END,RETREAT_END,layout,squadAt});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=NightRaidRuins;
