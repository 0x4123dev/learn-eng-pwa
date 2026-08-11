// battle-scenes.js — data-driven, layered arenas for the long artillery world.
// The game canvas stays transparent above this renderer, so an idle arena can
// animate at 15 FPS without forcing terrain, pets and castles to repaint.
(function (root) {
  'use strict';

  const BASE = '/img/battle-scenes/';
  const DEFAULT_ID = 'cloudstep-meadow';
  const raw = [
    ['cloudstep-meadow', 'Cloudstep Meadow', 'Đồng Cỏ Mây', 'Clouds & pollen', 'Mây và phấn hoa', 'clouds', ['#6ee7f5', '#b9f5d0', '#65a94d']],
    ['clockwork-canyon', 'Clockwork Canyon', 'Hẻm Núi Đồng Hồ', 'Rain & lightning', 'Mưa và sấm chớp', 'storm', ['#f8c76a', '#7bb9b3', '#9a6334']],
    ['sakura-shrine', 'Sakura Shrine', 'Đền Hoa Anh Đào', 'Falling petals', 'Cánh hoa bay', 'petals', ['#ffb7cf', '#d8f0d0', '#688c51']],
    ['aurora-glacier', 'Aurora Glacier', 'Sông Băng Cực Quang', 'Aurora & snow', 'Cực quang và tuyết', 'snow', ['#76c8ed', '#8b78d8', '#5e8fb1']],
    ['ember-caldera', 'Ember Caldera', 'Miệng Núi Lửa', 'Ash & embers', 'Tro và tàn lửa', 'embers', ['#f58246', '#7a3f63', '#654033']],
    ['pirate-lagoon', 'Pirate Lagoon', 'Đầm Phá Hải Tặc', 'Waves & sea spray', 'Sóng và bụi nước', 'waves', ['#4dd8d0', '#a8ebc1', '#b98749']],
    ['firefly-forest', 'Firefly Forest', 'Rừng Đom Đóm', 'Mist & fireflies', 'Sương và đom đóm', 'fireflies', ['#224d72', '#32a69a', '#486f42']],
    ['moonlit-rooftops', 'Moonlit Rooftops', 'Mái Nhà Ánh Trăng', 'Moon & drifting clouds', 'Trăng và mây trôi', 'night-clouds', ['#405d9b', '#738fc4', '#53516c']],
    ['candy-cloudworks', 'Candy Cloudworks', 'Xưởng Mây Kẹo', 'Rainbow sparkles', 'Lấp lánh cầu vồng', 'sparkles', ['#ef9ac2', '#94dfd3', '#9f75bd']],
    ['cosmic-observatory', 'Cosmic Observatory', 'Đài Thiên Văn', 'Stars & meteors', 'Sao và thiên thạch', 'stars', ['#332b72', '#7a5bc5', '#554382']],
  ];

  const SCENES = raw.map((r) => {
    const dir = BASE + r[0] + '/';
    return Object.freeze({
      id: r[0], name: { en: r[1], vi: r[2] }, description: { en: r[3], vi: r[4] },
      weather: r[5], palette: Object.freeze({ sky: r[6][0], haze: r[6][1], ground: r[6][2] }),
      poster: dir + 'poster.webp', far: dir + 'far-strip.webp',
      zones: Object.freeze([dir + 'zone-left.webp', dir + 'zone-center.webp', dir + 'zone-right.webp']),
    });
  });
  const BY_ID = Object.freeze(Object.fromEntries(SCENES.map((scene) => [scene.id, scene])));

  function normalizeBattleSceneId(id) {
    return Object.prototype.hasOwnProperty.call(BY_ID, String(id || '')) ? String(id) : DEFAULT_ID;
  }
  function getBattleScene(id) { return BY_ID[normalizeBattleSceneId(id)]; }
  function battleSceneAssetPaths() {
    return SCENES.flatMap((scene) => [scene.poster, scene.far].concat(scene.zones));
  }

  function loadImage(src, onDone) {
    if (typeof Image === 'undefined') return null;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => onDone(image);
    image.onerror = () => onDone(null);
    image.src = src;
    return image;
  }

  function BattleSceneRenderer(opts) {
    opts = opts || {};
    this.canvas = opts.canvas || null;
    this.ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null;
    this.scene = getBattleScene(opts.sceneId);
    this.worldW = Math.max(800, Number(opts.worldW) || 2000);
    this.viewW = Math.max(320, Number(opts.viewW) || 800);
    this.viewH = Math.max(180, Number(opts.viewH) || 450);
    this.cameraX = 0;
    this.images = { far: null, zones: [null, null, null] };
    this.failed = false;
    this.running = false;
    this._raf = null;
    this._last = 0;
    this._startAt = typeof performance !== 'undefined' ? performance.now() : 0;
    this.reducedMotion = !!opts.reducedMotion;
    this._hidden = typeof document !== 'undefined' && document.hidden;
    this._visibility = () => {
      this._hidden = !!document.hidden;
      if (!this._hidden && this.running) this._schedule();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._visibility);
    this._loadFar();
  }

  BattleSceneRenderer.prototype._loadFar = function () {
    loadImage(this.scene.far, (image) => {
      this.images.far = image;
      this.failed = !image;
      this._loadNearby();
      this.draw();
    });
  };

  BattleSceneRenderer.prototype._loadNearby = function () {
    const centers = [400, 1000, 1600];
    const focal = this.cameraX + this.viewW / 2;
    centers.forEach((center, index) => {
      if (this.images.zones[index] || Math.abs(center - focal) > this.viewW * 1.65) return;
      // Mark as loading so camera updates do not create duplicate requests.
      this.images.zones[index] = { loading: true };
      loadImage(this.scene.zones[index], (image) => {
        this.images.zones[index] = image || { failed: true };
        this.draw();
      });
    });
  };

  BattleSceneRenderer.prototype.setCamera = function (x) {
    const max = Math.max(0, this.worldW - this.viewW);
    this.cameraX = Math.max(0, Math.min(max, Number(x) || 0));
    this._loadNearby();
    this.draw();
  };

  BattleSceneRenderer.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.draw();
    if (!this.reducedMotion) this._schedule();
  };

  BattleSceneRenderer.prototype._schedule = function () {
    if (!this.running || this._hidden || this._raf || typeof requestAnimationFrame !== 'function') return;
    this._raf = requestAnimationFrame((now) => {
      this._raf = null;
      if (!this.running || this._hidden) return;
      // Decorative motion is intentionally capped at 15 FPS.
      if (!this._last || now - this._last >= 66) {
        this._last = now;
        this.draw(now);
      }
      this._schedule();
    });
  };

  BattleSceneRenderer.prototype._fallback = function (ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, this.scene.palette.sky);
    gradient.addColorStop(1, this.scene.palette.haze);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };

  BattleSceneRenderer.prototype.draw = function (now) {
    const ctx = this.ctx;
    if (!ctx) return;
    const width = this.canvas.width || this.viewW;
    const height = this.canvas.height || this.viewH;
    ctx.clearRect(0, 0, width, height);

    // The battlefield canvas is taller than the world is deep, so there is
    // open sky above the play area. The arena art keeps its own 16:9 shape and
    // sits at the BOTTOM — stretching it to fill would squash every landmark —
    // and the scene's own sky colour fills the space above it.
    const artH = Math.min(height, Math.round(width * this.viewH / this.viewW));
    const skyH = Math.max(0, height - artH);
    if (skyH > 0) {
      const sky = ctx.createLinearGradient(0, 0, 0, skyH + 2);
      sky.addColorStop(0, (this.scene && this.scene.palette && this.scene.palette.sky) || '#8dc7ff');
      sky.addColorStop(1, (this.scene && this.scene.palette && this.scene.palette.haze) || '#cfe9ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, skyH + 2);
    }

    if (this.images.far && this.images.far.width) {
      const sourceMax = Math.max(0, this.images.far.width - this.viewW);
      const sourceX = this.worldW > this.viewW
        ? (this.cameraX / (this.worldW - this.viewW)) * sourceMax : 0;
      ctx.drawImage(this.images.far, sourceX, 0, this.viewW, this.viewH, 0, skyH, width, artH);
    } else {
      ctx.save(); ctx.translate(0, skyH);
      this._fallback(ctx, width, artH);
      ctx.restore();
    }

    const scaleX = width / this.viewW;
    const zoneX = [0, 600, 1200];
    this.images.zones.forEach((image, index) => {
      if (!image || !image.width) return;
      const x = (zoneX[index] - this.cameraX * 0.88) * scaleX;
      if (x > width || x + 800 * scaleX < 0) return;
      ctx.drawImage(image, x, skyH, 800 * scaleX, artH);
    });
    this._drawWeather(ctx, width, height, this.reducedMotion ? 0 : ((now || performance.now()) - this._startAt) / 1000);
  };

  BattleSceneRenderer.prototype._drawWeather = function (ctx, width, height, t) {
    const kind = this.scene.weather;
    const count = /storm|snow/.test(kind) ? 38 : 24;
    ctx.save();
    for (let i = 0; i < count; i++) {
      const seedX = (i * 97 + 31) % 997 / 997;
      const seedY = (i * 53 + 17) % 991 / 991;
      let x = seedX * width, y = seedY * height;
      if (kind === 'snow') {
        x = (x + Math.sin(t * .7 + i) * 18 + t * 8) % width;
        y = (y + t * (12 + i % 9)) % height;
        ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.beginPath(); ctx.arc(x, y, 1.5 + i % 3, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'storm') {
        x = (x - t * 45) % width; y = (y + t * 85) % height;
        ctx.strokeStyle = 'rgba(215,239,255,.48)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 18); ctx.stroke();
      } else if (kind === 'petals') {
        x = (x + t * (10 + i % 8) + Math.sin(t + i) * 16) % width; y = (y + t * 15) % height;
        ctx.fillStyle = 'rgba(255,190,214,.75)'; ctx.beginPath(); ctx.ellipse(x, y, 3.5, 1.8, t + i, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'embers') {
        y = height - ((seedY * height + t * (12 + i % 12)) % height);
        ctx.fillStyle = i % 3 ? 'rgba(255,142,54,.62)' : 'rgba(75,55,61,.35)'; ctx.beginPath(); ctx.arc(x + Math.sin(t + i) * 9, y, 1 + i % 3, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'fireflies' || kind === 'sparkles' || kind === 'stars') {
        const pulse = .25 + .65 * Math.abs(Math.sin(t * (kind === 'stars' ? .7 : 1.8) + i));
        ctx.fillStyle = kind === 'stars' ? `rgba(220,235,255,${pulse})` : kind === 'fireflies' ? `rgba(223,255,102,${pulse})` : `rgba(255,245,187,${pulse})`;
        ctx.beginPath(); ctx.arc(x + Math.sin(t + i) * 4, y, 1 + i % 2, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'clouds' || kind === 'night-clouds') {
        if (i > 6) break;
        x = ((x + t * (3 + i)) % (width + 120)) - 60;
        ctx.fillStyle = kind === 'clouds' ? 'rgba(255,255,255,.2)' : 'rgba(199,215,255,.13)';
        ctx.beginPath(); ctx.ellipse(x, 35 + seedY * 120, 36 + i * 3, 11 + i, 0, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'waves') {
        if (i > 8) break;
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, height * .72 + i * 7, 16 + Math.sin(t * 1.2 + i) * 5, Math.PI * .1, Math.PI * .9); ctx.stroke();
      }
    }
    // Localized, gentle lightning: never a full-screen white flash.
    if (kind === 'storm' && !this.reducedMotion && Math.sin(t * .63) > .985) {
      ctx.strokeStyle = 'rgba(241,248,255,.78)'; ctx.lineWidth = 3;
      const x = width * .68;
      ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x - 18, 54); ctx.lineTo(x + 4, 48); ctx.lineTo(x - 12, 96); ctx.stroke();
    }
    ctx.restore();
  };

  BattleSceneRenderer.prototype.destroy = function () {
    this.running = false;
    if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
    this._raf = null;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._visibility);
  };

  const api = Object.freeze({ DEFAULT_ID, scenes: SCENES, normalizeBattleSceneId, getBattleScene, battleSceneAssetPaths, BattleSceneRenderer });
  root.BattleScenes = api;
  root.BattleSceneRenderer = BattleSceneRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
