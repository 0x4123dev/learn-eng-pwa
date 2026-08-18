// Cosmetic castle collection shared by the Arena shop and canvas renderer.
// Battle HP, collision and damage never read this visual-only module.
var CastleSkins = (() => {
  const skins = Object.freeze([
    { id:'stone-keep', price:0, tier:'Starter', name:{en:'Stone Keep',vi:'Thành Đá'}, desc:{en:'The trusted Arena classic',vi:'Pháo đài cổ điển đáng tin cậy'}, colors:['#e3b56f','#c98b56','#9b5d43','#65473e','#f97316','#bfe7f4'] },
    { id:'forest-fort', price:2000, tier:'Rare', name:{en:'Forest Fort',vi:'Thành Rừng Xanh'}, desc:{en:'Living vines and leaf banners',vi:'Dây leo sống và cờ lá xanh'}, colors:['#b7d889','#77a85b','#416b45','#294c38','#84cc16','#d9f99d'] },
    { id:'desert-citadel', price:2500, tier:'Rare', name:{en:'Desert Citadel',vi:'Thành Sa Mạc'}, desc:{en:'Sun-gold towers and warm sandstone',vi:'Tháp vàng nắng bằng sa thạch'}, colors:['#f6d48d','#d89b51','#a85f36','#713d2c','#fbbf24','#fef3c7'] },
    { id:'frost-bastion', price:3000, tier:'Epic', name:{en:'Frost Bastion',vi:'Thành Băng Giá'}, desc:{en:'Ice spires with a frozen glow',vi:'Chóp băng phát sáng lạnh giá'}, colors:['#dff7ff','#8dd9ed','#4a91b4','#245570','#38bdf8','#e0f2fe'] },
    { id:'coral-palace', price:4000, tier:'Epic', name:{en:'Coral Palace',vi:'Cung Điện San Hô'}, desc:{en:'Pearl windows and coral crowns',vi:'Cửa sổ ngọc trai, vương miện san hô'}, colors:['#ffc1c8','#f47f8f','#b84e78','#71355e','#2dd4bf','#ccfbf1'] },
    { id:'sakura-castle', price:5000, tier:'Epic', name:{en:'Sakura Castle',vi:'Thành Hoa Anh Đào'}, desc:{en:'Curved roofs under falling petals',vi:'Mái cong dưới cánh hoa bay'}, colors:['#ffe4e9','#f59ab4','#b55278','#63364e','#fb7185','#fff1f2'] },
    { id:'clockwork-keep', price:6000, tier:'Legendary', name:{en:'Clockwork Keep',vi:'Thành Cơ Khí'}, desc:{en:'Gears, copper pipes and steam',vi:'Bánh răng, ống đồng và hơi nước'}, colors:['#e8c17e','#b87b42','#75503a','#3d302d','#f59e0b','#fef3c7'] },
    { id:'dragon-fortress', price:7000, tier:'Legendary', name:{en:'Dragon Fortress',vi:'Pháo Đài Rồng'}, desc:{en:'Dragon horns and ember scales',vi:'Sừng rồng và vảy than hồng'}, colors:['#b9a3a5','#79545d','#442f3a','#211c27','#ef4444','#fecaca'] },
    { id:'crystal-citadel', price:8500, tier:'Mythic', name:{en:'Crystal Citadel',vi:'Thành Pha Lê'}, desc:{en:'Prismatic towers with neon light',vi:'Tháp lăng kính rực ánh neon'}, colors:['#ddd6fe','#a78bfa','#6d55bf','#352b68','#22d3ee','#ecfeff'] },
    { id:'celestial-palace', price:10000, tier:'Mythic', name:{en:'Celestial Palace',vi:'Thiên Cung'}, desc:{en:'A royal palace forged from starlight',vi:'Hoàng cung được rèn từ ánh sao'}, colors:['#fff7d6','#e8c86e','#a77b2c','#574319','#facc15','#ffffff'] },
  ]);
  const byId = Object.freeze(Object.fromEntries(skins.map(s => [s.id,s])));
  const defaultId = 'stone-keep';
  const normalize = id => byId[String(id || '')] ? String(id) : defaultId;
  const get = id => byId[normalize(id)];

  function drawOrnaments(ctx,id,damage) {
    if (!ctx || damage >= 4) return;
    const skin=get(id), c=skin.colors;
    ctx.save(); ctx.strokeStyle=c[4]; ctx.fillStyle=c[4]; ctx.lineWidth=3; ctx.lineCap='round';
    if (id==='forest-fort') {
      ctx.beginPath(); ctx.moveTo(-60,-90); ctx.bezierCurveTo(-78,-64,-48,-44,-62,-20); ctx.stroke();
      for (const p of [[-65,-72],[-53,-53],[-62,-34]]) { ctx.beginPath(); ctx.ellipse(p[0],p[1],7,3,-.5,0,Math.PI*2); ctx.fill(); }
    } else if (id==='desert-citadel') {
      ctx.beginPath(); ctx.arc(0,-116,19,Math.PI,0); ctx.fill(); ctx.fillRect(-19,-116,38,5); ctx.beginPath(); ctx.arc(0,-132,5,0,Math.PI*2); ctx.fill();
    } else if (id==='frost-bastion' || id==='crystal-citadel') {
      for (const x of [-58,-45,0,46,59]) { ctx.beginPath(); ctx.moveTo(x,-111); ctx.lineTo(x+7,-130-(Math.abs(x)%13)); ctx.lineTo(x+13,-111); ctx.closePath(); ctx.fill(); }
    } else if (id==='coral-palace') {
      for (const x of [-54,0,54]) { ctx.beginPath(); ctx.moveTo(x,-104); ctx.quadraticCurveTo(x-12,-126,x-3,-137); ctx.moveTo(x,-115); ctx.quadraticCurveTo(x+13,-127,x+10,-140); ctx.stroke(); }
    } else if (id==='sakura-castle') {
      ctx.lineWidth=6; for (const y of [-112,-91]) { ctx.beginPath(); ctx.moveTo(-42,y); ctx.quadraticCurveTo(0,y+10,42,y); ctx.stroke(); }
      for (const p of [[-54,-121],[49,-116],[28,-136]]) { ctx.beginPath(); ctx.arc(p[0],p[1],4,0,Math.PI*2); ctx.fill(); }
    } else if (id==='clockwork-keep') {
      for (const p of [[-49,-47,11],[48,-78,9]]) { ctx.beginPath(); ctx.arc(p[0],p[1],p[2],0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(p[0],p[1],3,0,Math.PI*2); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(-33,-78); ctx.lineTo(-15,-78); ctx.lineTo(-15,-101); ctx.stroke();
    } else if (id==='dragon-fortress') {
      for (const x of [-58,-44,44,58]) { ctx.beginPath(); ctx.moveTo(x,-106); ctx.lineTo(x+(x<0?-9:9),-132); ctx.lineTo(x+(x<0?7:-7),-112); ctx.closePath(); ctx.fill(); }
    } else if (id==='celestial-palace') {
      ctx.beginPath(); ctx.moveTo(0,-154); for (let i=1;i<10;i++) { const a=-Math.PI/2+i*Math.PI/5,r=i%2?5:12; ctx.lineTo(Math.cos(a)*r,-142+Math.sin(a)*r); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(0,-73,43,Math.PI,0); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPreview(canvas,id) {
    if (!canvas || typeof canvas.getContext!=='function') return;
    const ctx=canvas.getContext('2d'); if (!ctx) return;
    const skin=get(id),c=skin.colors,w=canvas.width||240,h=canvas.height||150;
    ctx.clearRect(0,0,w,h); const sky=ctx.createLinearGradient(0,0,0,h); sky.addColorStop(0,c[5]); sky.addColorStop(1,'#eff6ff'); ctx.fillStyle=sky; ctx.fillRect(0,0,w,h);
    ctx.fillStyle='rgba(15,23,42,.18)'; ctx.beginPath(); ctx.ellipse(w/2,h-12,w*.36,10,0,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.translate(w/2,h-12); ctx.scale(w/220,h/145); const grad=ctx.createLinearGradient(-70,-115,70,0); grad.addColorStop(0,c[0]); grad.addColorStop(.55,c[1]); grad.addColorStop(1,c[2]); ctx.fillStyle=grad; ctx.strokeStyle=c[3]; ctx.lineWidth=3;
    ctx.fillRect(-64,-64,128,58); ctx.strokeRect(-64,-64,128,58); for (const x of [-70,32]) { ctx.fillRect(x,-96,38,90); ctx.strokeRect(x,-96,38,90); } ctx.fillRect(-33,-111,66,54); ctx.strokeRect(-33,-111,66,54);
    ctx.fillStyle=c[0]; for (const x of [-69,-56,-43,33,46,59]) ctx.fillRect(x,-109,10,15); for (const x of [-31,-11,10]) ctx.fillRect(x,-123,14,15);
    ctx.fillStyle='#172033'; ctx.beginPath(); ctx.arc(0,-59,26,Math.PI,0); ctx.lineTo(26,-12); ctx.lineTo(-26,-12); ctx.closePath(); ctx.fill(); ctx.strokeStyle=c[4]; ctx.lineWidth=5; ctx.stroke(); drawOrnaments(ctx,skin.id,0); ctx.restore();
  }
  return Object.freeze({skins,defaultId,normalize,get,drawPreview,drawOrnaments});
})();
if (typeof module!=='undefined' && module.exports) module.exports=CastleSkins;
