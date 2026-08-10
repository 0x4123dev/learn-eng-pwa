// petart.js — Milo, drawn as a rigged inline SVG so he can actually move.
// One rig, ten breeds (colour + ear shape + markings), every part tagged with
// a class the CSS animates: breathing, tail wag, blinking, hopping on a
// correct answer, chewing when fed, drooping ears when hungry.
// Vector: a few KB, crisp at any size, works offline. No external assets.

const PET_BREED_LOOKS = {
  chihuahua: { fur: '#e9b77c', belly: '#fae6cc', muzzle: '#fae6cc', ear: 'pointy',  eye: '#3a2a1c', extra: '' },
  beagle:    { fur: '#d99a56', belly: '#fbf3e6', muzzle: '#fbf3e6', ear: 'long',    eye: '#3a2a1c', extra: 'patch' },
  poodle:    { fur: '#f3ece4', belly: '#ffffff', muzzle: '#ffffff', ear: 'curly',   eye: '#4a3a2c', extra: 'puff' },
  retriever: { fur: '#f0c273', belly: '#fdeecb', muzzle: '#fdeecb', ear: 'floppy',  eye: '#3a2a1c', extra: '' },
  dalmatian: { fur: '#f7f7f9', belly: '#ffffff', muzzle: '#ffffff', ear: 'floppy',  eye: '#3a2a1c', extra: 'spots' },
  husky:     { fur: '#9fb0c0', belly: '#ffffff', muzzle: '#ffffff', ear: 'pointy',  eye: '#39a7d8', extra: 'mask' },
  shepherd:  { fur: '#a9713a', belly: '#f2d9b4', muzzle: '#4a3728', ear: 'pointy',  eye: '#3a2a1c', extra: '' },
  akita:     { fur: '#e3a55f', belly: '#ffffff', muzzle: '#ffffff', ear: 'pointy',  eye: '#3a2a1c', extra: '' },
  royal:     { fur: '#e8c364', belly: '#fff3d0', muzzle: '#fff3d0', ear: 'floppy',  eye: '#3a2a1c', extra: 'crown' },
  diamond:   { fur: '#bfe6f2', belly: '#ffffff', muzzle: '#ffffff', ear: 'pointy',  eye: '#2e8fbf', extra: 'sparkle' },
};

function petBreedLook(stageCss) {
  return PET_BREED_LOOKS[stageCss] || PET_BREED_LOOKS.chihuahua;
}

// ---- the 5-level reward ladder --------------------------------------
// Inside every 20-level breed stage the child unlocks something visible
// every 5 levels, so progress never goes quiet:
//   +0  a whole new dog (the evolution itself)
//   +5  colour step — gem collar, richer fur
//   +10 a hat in this stage's colour
//   +15 jewellery — gem pendant necklace + earring + sparkles
// The ladder restarts on each evolution: the new breed arrives bare and
// earns its own outfit, which keeps a fresh goal alive for 200 levels.
const PET_TIER_STEP = 5;      // levels between unlocks
const PET_TIERS = 4;          // 0..3 within a stage

// Stage order must match DOG_STAGES in home.js.
const PET_STAGE_ORDER = ['chihuahua', 'beagle', 'poodle', 'retriever', 'dalmatian',
  'husky', 'shepherd', 'akita', 'royal', 'diamond'];

// One accent gem colour per breed era — every outfit looks different.
const PET_STAGE_ACCENT = {
  chihuahua: { accent: '#e03131', gem: '#ff6b6b', name: 'ruby' },
  beagle:    { accent: '#2f9e44', gem: '#51cf66', name: 'emerald' },
  poodle:    { accent: '#e64980', gem: '#faa2c1', name: 'pink sapphire' },
  retriever: { accent: '#1971c2', gem: '#4dabf7', name: 'sapphire' },
  dalmatian: { accent: '#f76707', gem: '#ffa94d', name: 'topaz' },
  husky:     { accent: '#7048e8', gem: '#b197fc', name: 'amethyst' },
  shepherd:  { accent: '#0c8599', gem: '#3bc9db', name: 'turquoise' },
  akita:     { accent: '#f59f00', gem: '#ffd43b', name: 'amber' },
  royal:     { accent: '#862e9c', gem: '#da77f2', name: 'royal amethyst' },
  diamond:   { accent: '#1098ad', gem: '#99e9f2', name: 'diamond' },
};

// Hat silhouette cycles so no two eras wear the same thing; the two
// crowned breeds upgrade their crown instead of stacking a cap on it.
const PET_STAGE_HAT = {
  chihuahua: 'cap', beagle: 'party', poodle: 'beret', retriever: 'cap',
  dalmatian: 'party', husky: 'beret', shepherd: 'cap', akita: 'party',
  royal: 'crown', diamond: 'crown',
};

function petStageAccent(stageCss) {
  return PET_STAGE_ACCENT[stageCss] || PET_STAGE_ACCENT.chihuahua;
}

// How far through the current breed stage this level is → tier 0..3.
// stageMinLevel comes from DOG_STAGES; falls back to the 20-level grid.
function petTierForLevel(level, stageMinLevel) {
  const lv = Math.max(1, Math.floor(level || 1));
  let base = stageMinLevel;
  if (!base || base > lv) {
    base = 1 + Math.floor((lv - 1) / 20) * 20;      // 1, 21, 41, …
  }
  const within = Math.max(0, lv - base);
  return Math.max(0, Math.min(PET_TIERS - 1, Math.floor(within / PET_TIER_STEP)));
}

// Every level between the larger five-level outfit rewards adds one polish
// mark. 0 is the outfit/evolution reveal itself; 1..4 progressively add coat,
// paw, face and aura details. This makes all 20 levels in an era distinct
// without burying the dog under twenty permanent accessories.
function petPolishForLevel(level, stageMinLevel) {
  const lv = Math.max(1, Math.floor(level || 1));
  let base = stageMinLevel;
  if (!base || base > lv) base = 1 + Math.floor((lv - 1) / 20) * 20;
  return Math.max(0, (lv - base) % PET_TIER_STEP);
}

// The level at which the next unlock happens (null at the top of a stage).
function petNextTierLevel(level, stageMinLevel) {
  const lv = Math.max(1, Math.floor(level || 1));
  let base = stageMinLevel;
  if (!base || base > lv) base = 1 + Math.floor((lv - 1) / 20) * 20;
  const next = base + (petTierForLevel(lv, base) + 1) * PET_TIER_STEP;
  return next < base + PET_TIERS * PET_TIER_STEP ? next : null;
}

const PET_TIER_LABELS_VI = ['chú chó mới', 'vòng cổ đá quý', 'chiếc mũ', 'bộ trang sức kim cương'];
function petTierLabel(tier) {
  return PET_TIER_LABELS_VI[Math.max(0, Math.min(PET_TIERS - 1, tier))];
}

// ---- ear shapes (drawn behind the head, one per side) ----
// At tier 3 the left ear also wears a small gold earring, so the lobe
// point is defined per ear shape rather than guessed.
const _PET_EAR_LOBE = { pointy: [30, 25], long: [24, 64], curly: [21, 57], floppy: [25, 57] };

function _petEarring(look, tier, acc) {
  if (tier < 3) return '';
  const p = _PET_EAR_LOBE[look.ear] || _PET_EAR_LOBE.floppy;
  return `
    <g class="pd-earring">
      <circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="none" stroke="#ffd34d" stroke-width="1.6"/>
      <circle class="pd-gem" cx="${p[0]}" cy="${p[1] + 4}" r="2.4" fill="${acc.gem}" stroke="#fff" stroke-width=".6"/>
    </g>`;
}

function _petEars(look) {
  const f = look.fur, d = _petShade(look.fur, -18);
  const ln = ` stroke="${_petShade(look.fur, -30)}" stroke-width="1.1"`;
  switch (look.ear) {
    case 'pointy':
      return `
        <path class="pd-ear pd-ear-l" d="M32 26 L24 6 L46 20 Z" fill="${f}"${ln}/>
        <path class="pd-ear pd-ear-l" d="M33 24 L28 12 L42 21 Z" fill="${d}" opacity=".55"/>
        <path class="pd-ear pd-ear-r" d="M68 26 L76 6 L54 20 Z" fill="${f}"${ln}/>
        <path class="pd-ear pd-ear-r" d="M67 24 L72 12 L58 21 Z" fill="${d}" opacity=".55"/>`;
    case 'long':
      return `
        <ellipse class="pd-ear pd-ear-l" cx="24" cy="46" rx="9"  ry="20" fill="${d}"${ln}/>
        <ellipse class="pd-ear pd-ear-r" cx="76" cy="46" rx="9"  ry="20" fill="${d}"${ln}/>`;
    case 'curly':
      return `
        <circle class="pd-ear pd-ear-l" cx="24" cy="40" r="12" fill="${f}"${ln}/>
        <circle class="pd-ear pd-ear-l" cx="21" cy="49" r="9"  fill="${f}"/>
        <circle class="pd-ear pd-ear-r" cx="76" cy="40" r="12" fill="${f}"${ln}/>
        <circle class="pd-ear pd-ear-r" cx="79" cy="49" r="9"  fill="${f}"/>`;
    default: // floppy
      return `
        <ellipse class="pd-ear pd-ear-l" cx="25" cy="42" rx="10" ry="16" fill="${d}"${ln}/>
        <ellipse class="pd-ear pd-ear-r" cx="75" cy="42" rx="10" ry="16" fill="${d}"${ln}/>`;
  }
}

// Darken/lighten a hex colour by a percentage (for ear/shadow tones).
function _petShade(hex, pct) {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl((num >> 16) + 255 * pct / 100);
  const g = cl(((num >> 8) & 255) + 255 * pct / 100);
  const b = cl((num & 255) + 255 * pct / 100);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ---- per-breed markings ----
function _petExtra(look) {
  switch (look.extra) {
    case 'spots':
      return `<g class="pd-marks" fill="#2f3136" opacity=".9">
          <circle cx="36" cy="30" r="4"/><circle cx="63" cy="26" r="3"/>
          <circle cx="40" cy="72" r="5"/><circle cx="62" cy="78" r="4"/>
        </g>`;
    case 'patch':
      return `<path class="pd-marks" d="M30 22 q12 -6 20 2 q-10 10 -22 8 Z" fill="${_petShade(look.fur, -25)}"/>`;
    case 'mask':
      return `<path class="pd-marks" d="M32 30 q18 -14 36 0 q-6 12 -18 12 q-12 0 -18 -12 Z" fill="${_petShade(look.fur, -22)}" opacity=".85"/>`;
    case 'puff':
      return `<circle class="pd-marks" cx="50" cy="16" r="9" fill="${look.fur}"/>`;
    case 'crown':
      return `<path class="pd-crown" d="M36 14 L42 22 L50 12 L58 22 L64 14 L62 26 L38 26 Z" fill="#ffd34d" stroke="#e0a800" stroke-width="1.2"/>`;
    case 'sparkle':
      return `<g class="pd-sparkles" fill="#ffffff">
          <path d="M22 20 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"/>
          <path d="M78 30 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z"/>
        </g>`;
    default: return '';
  }
}

// ---- tier outfit pieces --------------------------------------------
// Tier 1: a gem collar sitting on the neckline.
function _petCollar(tier, acc) {
  if (tier < 1) return '';
  return `
    <g class="pd-collar">
      <path d="M33 62 q17 13 34 0 q-17 8 -34 0 Z" fill="${acc.accent}"/>
      <circle class="pd-gem" cx="50" cy="68" r="3.4" fill="${acc.gem}" stroke="#fff" stroke-width=".7"/>
    </g>`;
}

// Tier 2: a hat in this era's colour (crowned breeds get a jewelled crown).
function _petHat(look, tier, acc, shape, hidden) {
  if (tier < 2 || hidden) return '';
  const dark = _petShade(acc.accent, -12);
  switch (shape) {
    case 'party':
      return `
        <g class="pd-hat">
          <path d="M50 -6 L37 21 L63 21 Z" fill="${acc.accent}"/>
          <path d="M50 -6 L44 21 L50 21 Z" fill="${dark}" opacity=".5"/>
          <circle cx="50" cy="-7" r="4" fill="${acc.gem}"/>
          <circle cx="44" cy="14" r="1.8" fill="#fff" opacity=".85"/>
          <circle cx="56" cy="9" r="1.6" fill="#fff" opacity=".85"/>
        </g>`;
    case 'beret':
      return `
        <g class="pd-hat">
          <ellipse cx="50" cy="12" rx="21" ry="9" fill="${acc.accent}" transform="rotate(-8 50 12)"/>
          <ellipse cx="50" cy="16" rx="19" ry="5" fill="${dark}" opacity=".55"/>
          <circle cx="62" cy="5" r="3.2" fill="${acc.gem}"/>
        </g>`;
    case 'crown':
      return `
        <g class="pd-hat pd-crown-jewel">
          <path d="M32 12 L39 21 L50 8 L61 21 L68 12 L66 26 L34 26 Z" fill="#ffd34d" stroke="#e0a800" stroke-width="1.2"/>
          <circle class="pd-gem" cx="50" cy="20" r="3.4" fill="${acc.gem}" stroke="#fff" stroke-width=".7"/>
          <circle class="pd-gem" cx="38" cy="22" r="2.2" fill="${acc.accent}"/>
          <circle class="pd-gem" cx="62" cy="22" r="2.2" fill="${acc.accent}"/>
        </g>`;
    default: // cap
      return `
        <g class="pd-hat">
          <path d="M31 18 a19 17 0 0 1 38 0 Z" fill="${acc.accent}"/>
          <path d="M50 1 a19 17 0 0 1 19 17 L50 18 Z" fill="${dark}" opacity=".45"/>
          <path d="M66 18 q13 1 12 6 q-13 2 -28 -1 Z" fill="${dark}"/>
          <circle cx="50" cy="2" r="3" fill="${acc.gem}"/>
        </g>`;
  }
}

// Tier 3: the jewellery set — pendant necklace (+ earring, drawn with the
// ear) and twinkling sparkles. Drawn above the head so the chain reads.
function _petJewelry(tier, acc, hidden) {
  if (tier < 3) return '';
  return `
    <g class="pd-jewel">
      ${hidden ? '' : `<path class="pd-chain" d="M34 60 q16 20 32 0" fill="none" stroke="#ffd34d" stroke-width="2.2" stroke-linecap="round"/>
      <path class="pd-pendant" d="M50 71 l6 6 -6 8 -6 -8 Z" fill="${acc.gem}" stroke="#ffd34d" stroke-width="1.4"/>
      <path class="pd-pendant-shine" d="M50 73 l3 3.5 -3 4 -3 -4 Z" fill="#fff" opacity=".55"/>`}
      <g class="pd-sparks" fill="#fff">
        <path d="M20 34 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z"/>
        <path d="M80 26 l1.3 3.4 3.4 1.3 -3.4 1.3 -1.3 3.4 -1.3 -3.4 -3.4 -1.3 3.4 -1.3 Z"/>
        <path d="M74 62 l1.1 2.8 2.8 1.1 -2.8 1.1 -1.1 2.8 -1.1 -2.8 -2.8 -1.1 2.8 -1.1 Z"/>
      </g>
    </g>`;
}

// Small, cumulative details for the four levels between outfit unlocks.
// Their fixed SVG geometry keeps the renderer cheap and crisp offline.
function _petLevelAura(polish, acc) {
  if (polish < 4) return '';
  return `<ellipse class="pd-level-aura" cx="50" cy="58" rx="38" ry="45"
      fill="${acc.gem}" opacity=".13" stroke="${acc.gem}" stroke-width="1.4" stroke-dasharray="3 5"/>`;
}

function _petLevelPolish(polish, acc) {
  if (polish < 1) return '';
  return `
    <g class="pd-level-polish pd-polish-${polish}" aria-hidden="true">
      <path class="pd-coat-shine" d="M39 73 q11 -8 22 0 q-11 -3 -22 0 Z" fill="#fff" opacity=".42"/>
      ${polish >= 2 ? `<g class="pd-paw-detail" fill="none" stroke="${acc.accent}" stroke-width="1.2" stroke-linecap="round" opacity=".75">
        <path d="M34 95 l2 -2 M39 96 l2 -2 M59 94 l2 2 M64 93 l2 2"/>
      </g>` : ''}
      ${polish >= 3 ? `<g class="pd-face-shine" fill="${acc.gem}">
        <path d="M26 39 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z"/>
        <path d="M74 34 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1 Z"/>
      </g>` : ''}
      ${polish >= 4 ? `<g class="pd-aura-sparks" fill="#fff">
        <circle cx="16" cy="64" r="1.8"/><circle cx="84" cy="54" r="1.8"/>
        <circle cx="70" cy="82" r="1.4"/><circle cx="30" cy="20" r="1.4"/>
      </g>` : ''}
    </g>`;
}

// ---- the dog ----
// opts: {
//   stageCss, size, mood, level, stageMinLevel, tier,
//   hasHeadAccessory, hasNeckAccessory   // shop items win over drawn ones
// }  — mood: 'happy'|'hungry'|'starving'|'stinky'|'sad'
function petDogSVG(opts) {
  opts = opts || {};
  const look = petBreedLook(opts.stageCss);
  const mood = opts.mood || 'happy';
  const moodCls = (mood === 'hungry' || mood === 'starving' || mood === 'sad') ? 'pd-sad' : '';
  const acc = petStageAccent(opts.stageCss);
  const tier = (typeof opts.tier === 'number')
    ? Math.max(0, Math.min(PET_TIERS - 1, opts.tier))
    : petTierForLevel(opts.level || 1, opts.stageMinLevel);
  const polish = (typeof opts.polish === 'number')
    ? Math.max(0, Math.min(PET_TIER_STEP - 1, Math.floor(opts.polish)))
    : petPolishForLevel(opts.level || 1, opts.stageMinLevel);
  // Growth and coat lustre now move at every level, not only at outfit rungs.
  const size = Math.round((opts.size || 96) * (1 + tier * 0.04 + polish * 0.01));
  const fur = _petShade(look.fur, tier * 1.5 + polish * 0.8);
  const dark = _petShade(fur, -20);
  const line = _petShade(fur, -30);          // outline: keeps pale breeds readable
  const hatShape = PET_STAGE_HAT[opts.stageCss] || 'cap';

  return `
<svg class="pd-dog ${moodCls}" data-tier="${tier}" data-polish="${polish}" viewBox="0 0 100 108" width="${size}" height="${Math.round(size * 1.08)}"
     xmlns="http://www.w3.org/2000/svg" role="img" aria-label="pet dog">
  ${_petLevelAura(polish, acc)}
  <ellipse class="pd-shadow" cx="50" cy="101" rx="26" ry="5" fill="#000" opacity=".18"/>
  <g class="pd-body-grp">
    <path class="pd-tail" d="M74 78 q14 -4 12 -18 q-2 12 -12 12 Z" fill="${dark}"/>
    <ellipse class="pd-body" cx="50" cy="78" rx="24" ry="20" fill="${fur}" stroke="${line}" stroke-width="1.2"/>
    <ellipse class="pd-belly" cx="50" cy="84" rx="14" ry="12" fill="${look.belly}"/>
    <ellipse class="pd-paw" cx="37" cy="95" rx="8" ry="5" fill="${look.belly}" stroke="${line}" stroke-width="1"/>
    <ellipse class="pd-paw" cx="63" cy="95" rx="8" ry="5" fill="${look.belly}" stroke="${line}" stroke-width="1"/>
  </g>
  ${_petCollar(tier, acc)}
  <g class="pd-head-grp">
    ${_petEars(look)}
    ${_petEarring(look, tier, acc)}
    <circle class="pd-head" cx="50" cy="40" r="26" fill="${fur}" stroke="${line}" stroke-width="1.2"/>
    ${_petExtra(look)}
    <ellipse class="pd-muzzle" cx="50" cy="50" rx="15" ry="11" fill="${look.muzzle}" stroke="${line}" stroke-width=".9" stroke-opacity=".55"/>
    <g class="pd-eyes">
      <circle class="pd-eye" cx="40" cy="35" r="4.6" fill="${look.eye}"/>
      <circle class="pd-eye" cx="60" cy="35" r="4.6" fill="${look.eye}"/>
      <circle class="pd-glint" cx="41.6" cy="33.4" r="1.6" fill="#fff"/>
      <circle class="pd-glint" cx="61.6" cy="33.4" r="1.6" fill="#fff"/>
      <rect class="pd-lid" x="34" y="27" width="12" height="9" rx="4" fill="${look.fur}"/>
      <rect class="pd-lid" x="54" y="27" width="12" height="9" rx="4" fill="${look.fur}"/>
    </g>
    <ellipse class="pd-nose" cx="50" cy="45" rx="4.6" ry="3.6" fill="#33272a"/>
    <path class="pd-mouth" d="M50 49 q-5 6 -9 1 M50 49 q5 6 9 1" stroke="#33272a" stroke-width="1.8"
          fill="none" stroke-linecap="round"/>
    <path class="pd-tongue" d="M46 53 q4 8 8 0 Z" fill="#ff8fa3"/>
    <circle class="pd-blush" cx="30" cy="46" r="4.5" fill="#ff9db0" opacity=".5"/>
    <circle class="pd-blush" cx="70" cy="46" r="4.5" fill="#ff9db0" opacity=".5"/>
    ${_petHat(look, tier, acc, hatShape, opts.hasHeadAccessory)}
  </g>
  ${_petJewelry(tier, acc, opts.hasNeckAccessory)}
  ${_petLevelPolish(polish, acc)}
</svg>`;
}

// A tiny version for chips, the cheer popup and the reward card — carries
// the same outfit so the child sees their upgrades everywhere.
function petDogMiniSVG(stageCss, size, level, stageMinLevel) {
  return petDogSVG({ stageCss, size: size || 34, mood: 'happy', level, stageMinLevel });
}

// Play a one-shot animation on every dog currently on screen.
// state: 'hop' | 'eat' | 'levelup' | 'sad'
function petDogPlay(state, root) {
  if (typeof document === 'undefined') return;
  const scope = root || document;
  const dogs = scope.querySelectorAll('.pd-dog');
  dogs.forEach(d => {
    d.classList.remove('pd-hop', 'pd-eat', 'pd-levelup');
    if (state === 'sad') { d.classList.add('pd-sad'); return; }
    void d.getBoundingClientRect();          // restart the CSS animation
    d.classList.add('pd-' + state);
    if (typeof setTimeout === 'function') {
      setTimeout(() => d.classList.remove('pd-' + state), state === 'levelup' ? 1400 : 800);
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PET_BREED_LOOKS, petBreedLook, petDogSVG, petDogMiniSVG, petDogPlay, _petShade,
    PET_TIER_STEP, PET_TIERS, PET_STAGE_ORDER, PET_STAGE_ACCENT, PET_STAGE_HAT,
    petStageAccent, petTierForLevel, petPolishForLevel, petNextTierLevel, petTierLabel,
  };
}
