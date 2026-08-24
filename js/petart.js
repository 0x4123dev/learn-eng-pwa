// petart.js — Milo, drawn as a rigged inline SVG so he can actually move.
// One rig, ten real breeds (breed-specific build, head, muzzle, ears, coat and
// markings), every part tagged with
// a class the CSS animates: breathing, tail wag, blinking, hopping on a
// correct answer, chewing when fed, drooping ears when hungry.
// Vector: a few KB, crisp at any size, works offline. No external assets.

const PET_BREED_LOOKS = {
  chihuahua:       { fur: '#e8ad68', belly: '#fff1d6', muzzle: '#fff1d6', ear: 'tall-pointy', eye: '#4a2d22', extra: 'chihuahua', build: 'tiny',     tail: 'sickle', headRx: 25, headRy: 26, muzzleRx: 12, muzzleRy: 9 },
  pomeranian:      { fur: '#ed9f45', belly: '#ffe7bc', muzzle: '#ffe7bc', ear: 'fluffy',      eye: '#3b271d', extra: 'pomeranian', build: 'fluffy', tail: 'plume',  headRx: 27, headRy: 27, muzzleRx: 11, muzzleRy: 9 },
  beagle:          { fur: '#d99a56', belly: '#fbf3e6', muzzle: '#fbf3e6', ear: 'long',        eye: '#3a2a1c', extra: 'beagle',     build: 'medium', tail: 'upright',headRx: 26, headRy: 27, muzzleRx: 15, muzzleRy: 11 },
  corgi:           { fur: '#e89947', belly: '#fff5e7', muzzle: '#fff5e7', ear: 'upright',     eye: '#493020', extra: 'corgi',      build: 'low',    tail: 'nub',    headRx: 27, headRy: 26, muzzleRx: 14, muzzleRy: 10 },
  bulldog:         { fur: '#d9b28d', belly: '#fff1e4', muzzle: '#f7e5d5', ear: 'rose',        eye: '#392820', extra: 'bulldog',    build: 'stocky', tail: 'nub',    headRx: 31, headRy: 26, muzzleRx: 19, muzzleRy: 11 },
  husky:           { fur: '#9aafc1', belly: '#ffffff', muzzle: '#ffffff', ear: 'upright',     eye: '#159bd1', extra: 'husky',      build: 'athletic',tail: 'sickle', headRx: 27, headRy: 28, muzzleRx: 14, muzzleRy: 11 },
  retriever:       { fur: '#efbd59', belly: '#ffeab9', muzzle: '#ffeab9', ear: 'floppy',      eye: '#493020', extra: 'retriever',  build: 'large',  tail: 'feather',headRx: 28, headRy: 28, muzzleRx: 16, muzzleRy: 11 },
  shepherd:        { fur: '#b87a3d', belly: '#e8bd83', muzzle: '#59402c', ear: 'tall-pointy', eye: '#39271e', extra: 'shepherd',   build: 'tall',   tail: 'sweep',  headRx: 27, headRy: 29, muzzleRx: 15, muzzleRy: 12 },
  rottweiler:      { fur: '#35302d', belly: '#8b4d2e', muzzle: '#6f422d', ear: 'folded',      eye: '#3a241b', extra: 'rottweiler', build: 'powerful',tail: 'nub',    headRx: 31, headRy: 27, muzzleRx: 18, muzzleRy: 12 },
  'tibetan-mastiff': { fur: '#6b3d28', belly: '#9b613b', muzzle: '#4b3026', ear: 'folded',    eye: '#2d1d18', extra: 'mastiff',    build: 'giant',  tail: 'plume',  headRx: 32, headRy: 30, muzzleRx: 19, muzzleRy: 13 },
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
const PET_STAGE_ORDER = ['chihuahua', 'pomeranian', 'beagle', 'corgi', 'bulldog',
  'husky', 'retriever', 'shepherd', 'rottweiler', 'tibetan-mastiff'];

// One accent gem colour per breed era — every outfit looks different.
const PET_STAGE_ACCENT = {
  chihuahua: { accent: '#e03131', gem: '#ff6b6b', name: 'ruby' },
  pomeranian:{ accent: '#e64980', gem: '#faa2c1', name: 'pink sapphire' },
  beagle:    { accent: '#2f9e44', gem: '#51cf66', name: 'emerald' },
  corgi:     { accent: '#f76707', gem: '#ffa94d', name: 'topaz' },
  bulldog:   { accent: '#c92a2a', gem: '#ff8787', name: 'garnet' },
  husky:     { accent: '#7048e8', gem: '#b197fc', name: 'amethyst' },
  retriever: { accent: '#1971c2', gem: '#4dabf7', name: 'sapphire' },
  shepherd:  { accent: '#0c8599', gem: '#3bc9db', name: 'turquoise' },
  rottweiler:{ accent: '#862e9c', gem: '#da77f2', name: 'amethyst' },
  'tibetan-mastiff': { accent: '#b7791f', gem: '#ffd43b', name: 'gold' },
};

// Hat silhouette cycles so no two eras wear the same thing; the two
// crowned breeds upgrade their crown instead of stacking a cap on it.
const PET_STAGE_HAT = {
  chihuahua: 'cap', pomeranian: 'party', beagle: 'beret', corgi: 'cap',
  bulldog: 'party', husky: 'beret', retriever: 'cap', shepherd: 'party',
  rottweiler: 'beret', 'tibetan-mastiff': 'crown',
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
const _PET_EAR_LOBE = { 'tall-pointy': [29, 25], upright: [30, 26], fluffy: [29, 27], long: [24, 64], rose: [27, 35], folded: [25, 48], floppy: [25, 57] };

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
    case 'tall-pointy':
      return `
        <path class="pd-ear pd-ear-l" d="M32 27 L23 2 L47 20 Z" fill="${f}"${ln}/>
        <path class="pd-ear-inner pd-ear-l" d="M33 24 L28 9 L42 21 Z" fill="#f4a7a9" opacity=".68"/>
        <path class="pd-ear pd-ear-r" d="M68 27 L77 2 L53 20 Z" fill="${f}"${ln}/>
        <path class="pd-ear-inner pd-ear-r" d="M67 24 L72 9 L58 21 Z" fill="#f4a7a9" opacity=".68"/>`;
    case 'upright':
      return `
        <path class="pd-ear pd-ear-l" d="M31 28 Q24 12 28 5 Q42 13 46 22 Z" fill="${f}"${ln}/>
        <path class="pd-ear-inner" d="M33 24 Q28 14 30 10 Q39 16 42 22 Z" fill="#f4a7a9" opacity=".58"/>
        <path class="pd-ear pd-ear-r" d="M69 28 Q76 12 72 5 Q58 13 54 22 Z" fill="${f}"${ln}/>
        <path class="pd-ear-inner" d="M67 24 Q72 14 70 10 Q61 16 58 22 Z" fill="#f4a7a9" opacity=".58"/>`;
    case 'fluffy':
      return `
        <path class="pd-ear pd-ear-l" d="M31 29 Q20 12 31 7 Q41 13 45 23 Q37 19 31 29 Z" fill="${f}"${ln}/>
        <path class="pd-ear-inner" d="M32 23 Q27 14 32 12 Q38 17 40 22 Z" fill="#f4a7a9" opacity=".48"/>
        <path class="pd-ear pd-ear-r" d="M69 29 Q80 12 69 7 Q59 13 55 23 Q63 19 69 29 Z" fill="${f}"${ln}/>
        <path class="pd-ear-inner" d="M68 23 Q73 14 68 12 Q62 17 60 22 Z" fill="#f4a7a9" opacity=".48"/>`;
    case 'long':
      return `
        <ellipse class="pd-ear pd-ear-l" cx="24" cy="46" rx="9"  ry="20" fill="${d}"${ln}/>
        <ellipse class="pd-ear-inner" cx="24" cy="48" rx="4.2" ry="13" fill="#f0a5a7" opacity=".48"/>
        <ellipse class="pd-ear pd-ear-r" cx="76" cy="46" rx="9"  ry="20" fill="${d}"${ln}/>
        <ellipse class="pd-ear-inner" cx="76" cy="48" rx="4.2" ry="13" fill="#f0a5a7" opacity=".48"/>`;
    case 'rose':
      return `
        <path class="pd-ear pd-ear-l" d="M31 31 Q18 23 21 14 Q33 16 41 26 Q34 23 31 31 Z" fill="${d}"${ln}/>
        <path class="pd-ear-inner" d="M29 27 Q23 23 24 19 Q31 20 35 25 Z" fill="#d9898d" opacity=".62"/>
        <path class="pd-ear pd-ear-r" d="M69 31 Q82 23 79 14 Q67 16 59 26 Q66 23 69 31 Z" fill="${d}"${ln}/>
        <path class="pd-ear-inner" d="M71 27 Q77 23 76 19 Q69 20 65 25 Z" fill="#d9898d" opacity=".62"/>`;
    case 'folded':
      return `
        <path class="pd-ear pd-ear-l" d="M31 28 Q16 29 18 44 Q23 53 31 48 L39 29 Z" fill="${d}"${ln}/>
        <path class="pd-ear-inner" d="M28 32 Q20 33 22 42 Q25 46 29 44 Z" fill="#b87374" opacity=".42"/>
        <path class="pd-ear pd-ear-r" d="M69 28 Q84 29 82 44 Q77 53 69 48 L61 29 Z" fill="${d}"${ln}/>
        <path class="pd-ear-inner" d="M72 32 Q80 33 78 42 Q75 46 71 44 Z" fill="#b87374" opacity=".42"/>`;
    default: // floppy
      return `
        <ellipse class="pd-ear pd-ear-l" cx="25" cy="42" rx="10" ry="16" fill="${d}"${ln}/>
        <ellipse class="pd-ear-inner" cx="25" cy="44" rx="4.5" ry="10" fill="#f0a5a7" opacity=".45"/>
        <ellipse class="pd-ear pd-ear-r" cx="75" cy="42" rx="10" ry="16" fill="${d}"${ln}/>
        <ellipse class="pd-ear-inner" cx="75" cy="44" rx="4.5" ry="10" fill="#f0a5a7" opacity=".45"/>`;
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
    case 'chihuahua':
      return `<g class="pd-breed-detail">
          <path d="M31 27 q8 -5 14 0 M55 27 q8 -5 14 0" fill="none" stroke="${_petShade(look.fur, -34)}" stroke-width="1.7" stroke-linecap="round"/>
          <path d="M27 42 q-5 4 -7 9 M73 42 q5 4 7 9" fill="none" stroke="#fff3d8" stroke-width="2" opacity=".72"/>
        </g>`;
    case 'pomeranian':
      return `<g class="pd-breed-detail pd-pomeranian-fluff" fill="${_petShade(look.fur, 7)}" stroke="${_petShade(look.fur, -16)}" stroke-width=".65" stroke-linejoin="round">
          <path class="pd-cheek-fluff" d="M29 34 Q22 36 24 42 L18 47 L25 50 L22 57 L34 53 Q31 47 34 40Z"/>
          <path class="pd-cheek-fluff" d="M71 34 Q78 36 76 42 L82 47 L75 50 L78 57 L66 53 Q69 47 66 40Z"/>
          <path class="pd-chest-ruff" d="M31 59 Q39 64 50 65 Q61 64 69 59 L67 70 L72 74 L66 78 L67 86 L58 85 L50 94 L42 85 L33 86 L34 78 L28 74 L33 70Z" opacity=".82"/>
        </g>`;
    case 'beagle':
      return `<g class="pd-marks">
          <path d="M27 20 q14 -8 25 3 q-6 15 -19 14 q-8 -6 -6 -17Z" fill="${_petShade(look.fur, -30)}"/>
          <path d="M35 67 q15 -7 30 1 q-6 9 -14 13 q-11 -2 -16 -14Z" fill="#fff6e9" opacity=".82"/>
        </g>`;
    case 'corgi':
      return `<g class="pd-breed-detail" fill="#fff7e8">
          <path d="M32 18 q18 -8 36 0 q-6 10 -18 10 q-12 0 -18 -10Z" opacity=".72"/>
          <path d="M32 65 q18 -8 36 0 l-4 22 q-14 8 -28 0Z" opacity=".88"/>
        </g>`;
    case 'bulldog':
      return `<g class="pd-breed-detail" fill="none" stroke="${_petShade(look.fur, -26)}" stroke-linecap="round">
          <path d="M31 24 q8 -5 14 1 M55 25 q8 -6 14 -1" stroke-width="1.8"/>
          <path d="M36 43 q4 3 8 0 M56 43 q4 3 8 0 M39 58 q11 7 22 0" stroke-width="1.3" opacity=".72"/>
          <path d="M47 46 q-3 7 0 11 M53 46 q3 7 0 11" stroke-width="1" opacity=".55"/>
        </g>`;
    case 'husky':
      return `<path class="pd-marks" d="M26 25 Q39 12 50 26 Q61 12 74 25 L67 43 Q59 35 50 42 Q41 35 33 43Z" fill="${_petShade(look.fur, -25)}" opacity=".9"/>`;
    case 'retriever':
      return `<g class="pd-breed-detail" fill="${_petShade(look.fur, -30)}" opacity=".7">
          <circle cx="37" cy="52" r="1.2"/><circle cx="33" cy="49" r=".9"/><circle cx="63" cy="52" r="1.2"/><circle cx="67" cy="49" r=".9"/>
          <path d="M29 70 q21 -12 42 0" fill="none" stroke="${_petShade(look.fur, 10)}" stroke-width="3"/>
        </g>`;
    case 'shepherd':
      return `<g class="pd-marks">
          <path d="M29 67 q21 -13 42 0 l-5 20 q-16 8 -32 0Z" fill="#312824" opacity=".9"/>
          <path d="M34 25 q16 -12 32 0 l-7 16 q-9 -5 -18 0Z" fill="#3c3029" opacity=".78"/>
        </g>`;
    case 'rottweiler':
      return `<g class="pd-breed-detail" fill="#b96b3c">
          <ellipse cx="39" cy="29" rx="6" ry="2.6"/><ellipse cx="61" cy="29" rx="6" ry="2.6"/>
          <ellipse cx="31" cy="49" rx="5" ry="4"/><ellipse cx="69" cy="49" rx="5" ry="4"/>
          <path d="M34 72 q16 -8 32 0 l-3 15 q-13 7 -26 0Z" opacity=".9"/>
        </g>`;
    case 'mastiff':
      return `<g class="pd-breed-detail">
          <path d="M20 29 Q16 16 29 12 Q38 4 50 11 Q62 4 71 12 Q84 16 80 29 Q91 39 81 52 Q89 67 73 70 Q66 82 50 75 Q34 82 27 70 Q11 67 19 52 Q9 39 20 29Z" fill="${_petShade(look.fur, -9)}" stroke="${_petShade(look.fur, -28)}" stroke-width="1.3" opacity=".96"/>
          <path d="M31 26 q8 -5 14 0 M55 26 q8 -5 14 0" fill="none" stroke="#2f211c" stroke-width="2.1" stroke-linecap="round"/>
          <path d="M36 59 q14 7 28 0 q-3 12 -14 12 q-11 0 -14 -12Z" fill="#3d2821" opacity=".55"/>
        </g>`;
    case 'spots':
      return `<g class="pd-marks" fill="#2f3136" opacity=".9">
          <circle cx="36" cy="30" r="4"/><circle cx="63" cy="26" r="3"/>
          <circle cx="40" cy="72" r="5"/><circle cx="62" cy="78" r="4"/>
        </g>`;
    case 'patch':
      return `<path class="pd-marks" d="M28 20 q13 -7 23 3 q-6 13 -18 13 q-7 -5 -5 -16 Z" fill="${_petShade(look.fur, -28)}"/>`;
    case 'mask':
      return `<path class="pd-marks" d="M32 30 q18 -14 36 0 q-6 12 -18 12 q-12 0 -18 -12 Z" fill="${_petShade(look.fur, -22)}" opacity=".85"/>`;
    case 'puff':
      return `<g class="pd-marks" fill="${look.fur}" stroke="${_petShade(look.fur, -15)}" stroke-width=".7">
          <circle cx="42" cy="17" r="7"/><circle cx="50" cy="13" r="8"/><circle cx="58" cy="17" r="7"/>
        </g>`;
    case 'brows':
      return `<g class="pd-breed-detail" fill="${_petShade(look.fur, -30)}" opacity=".72">
          <path d="M34 29 q6 -4 11 0 q-6 -1 -11 2 Z"/><path d="M55 29 q6 -4 11 0 q-6 -1 -11 2 Z"/>
        </g>`;
    case 'freckles':
      return `<g class="pd-breed-detail" fill="${_petShade(look.fur, -28)}" opacity=".7">
          <circle cx="38" cy="51" r="1.2"/><circle cx="34" cy="48" r=".9"/><circle cx="62" cy="51" r="1.2"/><circle cx="66" cy="48" r=".9"/>
        </g>`;
    case 'saddle':
      return `<path class="pd-marks" d="M31 68 q19 -11 38 0 l-5 17 q-14 7 -28 0 Z" fill="#3c2c25" opacity=".82"/>`;
    case 'akita':
      return `<path class="pd-breed-detail" d="M34 19 q16 -8 32 0 q-5 8 -16 8 q-11 0 -16 -8 Z" fill="#fff4e8" opacity=".72"/>`;
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

const _PET_BUILD = {
  tiny:     { cx: 50, cy: 82, rx: 20, ry: 17, bellyRx: 11, bellyRy: 11, pawX: 13, pawRx: 7,   pawRy: 4.8 },
  fluffy:   { cx: 50, cy: 79, rx: 26, ry: 22, bellyRx: 14, bellyRy: 14, pawX: 14, pawRx: 8.5, pawRy: 5.2 },
  medium:   { cx: 50, cy: 80, rx: 25, ry: 21, bellyRx: 14, bellyRy: 13, pawX: 14, pawRx: 9,   pawRy: 5.5 },
  low:      { cx: 50, cy: 83, rx: 30, ry: 17, bellyRx: 18, bellyRy: 10, pawX: 17, pawRx: 9,   pawRy: 4.7 },
  stocky:   { cx: 50, cy: 79, rx: 30, ry: 23, bellyRx: 18, bellyRy: 15, pawX: 16, pawRx: 10,  pawRy: 6 },
  athletic: { cx: 50, cy: 78, rx: 25, ry: 23, bellyRx: 14, bellyRy: 15, pawX: 14, pawRx: 8.8, pawRy: 5.7 },
  large:    { cx: 50, cy: 78, rx: 28, ry: 23, bellyRx: 16, bellyRy: 15, pawX: 15, pawRx: 9.6, pawRy: 5.8 },
  tall:     { cx: 50, cy: 77, rx: 27, ry: 25, bellyRx: 15, bellyRy: 16, pawX: 15, pawRx: 9.2, pawRy: 5.8 },
  powerful: { cx: 50, cy: 78, rx: 31, ry: 24, bellyRx: 18, bellyRy: 15, pawX: 17, pawRx: 10.5,pawRy: 6.2 },
  giant:    { cx: 50, cy: 77, rx: 33, ry: 27, bellyRx: 20, bellyRy: 17, pawX: 18, pawRx: 11,  pawRy: 6.4 },
};

function _petTail(look, dark, line) {
  const common = `class="pd-tail" fill="${dark}" stroke="${line}" stroke-width="1.2" stroke-linejoin="round"`;
  switch (look.tail) {
    case 'plume':
      return `<path ${common} d="M72 79 Q91 76 86 59 Q84 48 92 44 Q99 65 90 79 Q82 90 70 86 Q80 82 72 79Z"/>`;
    case 'upright':
      return `<path ${common} d="M72 78 Q84 68 80 48 L87 46 Q92 69 76 84Z"/><path d="M80 49 l7 -3" stroke="#fff" stroke-width="3" opacity=".72"/>`;
    case 'sickle':
      return `<path ${common} d="M72 78 Q94 76 88 56 Q84 45 75 51 Q86 51 82 64 Q79 71 70 70Z"/>`;
    case 'feather':
      return `<path ${common} d="M72 78 Q91 70 91 57 Q98 69 89 82 Q80 90 69 85Z"/><path d="M79 77 q8 -4 11 -12 M77 82 q9 -2 13 -8" fill="none" stroke="#ffe8af" stroke-width="1.5" opacity=".55"/>`;
    case 'sweep':
      return `<path ${common} d="M72 77 Q91 81 94 93 Q82 88 70 85Z"/>`;
    case 'nub':
      return `<ellipse class="pd-tail" cx="78" cy="76" rx="8" ry="7" fill="${dark}" stroke="${line}" stroke-width="1.2"/>`;
    default:
      return `<path ${common} d="M73 78 q18 -2 13 -20 q-1 12 -12 13 q8 -5 7 -13 q10 20 -8 26Z"/>`;
  }
}

function _petBody(look, fur, dark, line) {
  const b = _PET_BUILD[look.build] || _PET_BUILD.medium;
  const pawY = 97;
  return `
    ${_petTail(look, dark, line)}
    <ellipse class="pd-body" cx="${b.cx}" cy="${b.cy}" rx="${b.rx}" ry="${b.ry}" fill="${fur}" stroke="${line}" stroke-width="1.8"/>
    <ellipse class="pd-body-shine" cx="42" cy="${b.cy - 9}" rx="${Math.max(9, b.rx - 15)}" ry="5" fill="#fff" opacity=".18" transform="rotate(-18 42 ${b.cy - 9})"/>
    <ellipse class="pd-belly" cx="50" cy="${b.cy + 5}" rx="${b.bellyRx}" ry="${b.bellyRy}" fill="${look.belly}"/>
    <ellipse class="pd-paw" cx="${50 - b.pawX}" cy="${pawY}" rx="${b.pawRx}" ry="${b.pawRy}" fill="${look.belly}" stroke="${line}" stroke-width="1.2"/>
    <ellipse class="pd-paw" cx="${50 + b.pawX}" cy="${pawY}" rx="${b.pawRx}" ry="${b.pawRy}" fill="${look.belly}" stroke="${line}" stroke-width="1.2"/>
    <g class="pd-toes" fill="none" stroke="${line}" stroke-width=".9" stroke-linecap="round" opacity=".55">
      <path d="M${47 - b.pawX} 96 v3 M${52 - b.pawX} 96 v3 M${47 + b.pawX} 96 v3 M${52 + b.pawX} 96 v3"/>
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
  const breedLabel = opts.stageCss === 'tibetan-mastiff'
    ? 'Tibetan Mastiff'
    : String(opts.stageCss || 'chihuahua').replace(/(^|-)([a-z])/g, (_, gap, letter) => (gap ? ' ' : '') + letter.toUpperCase());

  return `
<svg class="pd-dog ${moodCls}" data-breed="${opts.stageCss || 'chihuahua'}" data-build="${look.build}" data-tier="${tier}" data-polish="${polish}" viewBox="0 0 100 108" width="${size}" height="${Math.round(size * 1.08)}"
     xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${breedLabel} pet dog">
  ${_petLevelAura(polish, acc)}
  <ellipse class="pd-shadow" cx="50" cy="101" rx="26" ry="5" fill="#000" opacity=".18"/>
  <g class="pd-body-grp">
    ${_petBody(look, fur, dark, line)}
  </g>
  ${_petCollar(tier, acc)}
  <g class="pd-head-grp">
    ${_petEars(look)}
    ${_petEarring(look, tier, acc)}
    <ellipse class="pd-head" cx="50" cy="40" rx="${look.headRx || 28}" ry="${look.headRy || 28}" fill="${fur}" stroke="${line}" stroke-width="1.8"/>
    <ellipse class="pd-head-shine" cx="40" cy="23" rx="10" ry="5" fill="#fff" opacity=".2" transform="rotate(-18 40 23)"/>
    ${_petExtra(look)}
    <ellipse class="pd-muzzle" cx="50" cy="51" rx="${look.muzzleRx || 16}" ry="${look.muzzleRy || 12}" fill="${look.muzzle}" stroke="${line}" stroke-width="1" stroke-opacity=".48"/>
    <g class="pd-eyes">
      <ellipse class="pd-eye" cx="39.5" cy="35" rx="5.4" ry="6.1" fill="${look.eye}"/>
      <ellipse class="pd-eye" cx="60.5" cy="35" rx="5.4" ry="6.1" fill="${look.eye}"/>
      <circle class="pd-glint" cx="41" cy="32.8" r="2" fill="#fff"/>
      <circle class="pd-glint" cx="62" cy="32.8" r="2" fill="#fff"/>
      <circle class="pd-glint-small" cx="38" cy="37" r=".9" fill="#fff" opacity=".75"/>
      <circle class="pd-glint-small" cx="59" cy="37" r=".9" fill="#fff" opacity=".75"/>
      <rect class="pd-lid" x="34" y="27" width="12" height="9" rx="4" fill="${look.fur}"/>
      <rect class="pd-lid" x="54" y="27" width="12" height="9" rx="4" fill="${look.fur}"/>
    </g>
    <ellipse class="pd-nose" cx="50" cy="46" rx="5.2" ry="4" fill="#38282d"/>
    <ellipse cx="48.5" cy="44.8" rx="1.7" ry="1" fill="#fff" opacity=".58"/>
    <path class="pd-mouth" d="M50 50 q-5 7 -10 1 M50 50 q5 7 10 1" stroke="#38282d" stroke-width="2"
          fill="none" stroke-linecap="round"/>
    <path class="pd-tongue" d="M45.5 54 q4.5 9 9 0 Z" fill="#ff8fa3" stroke="#e96d88" stroke-width=".6"/>
    <ellipse class="pd-blush" cx="28" cy="47" rx="5.5" ry="3.3" fill="#ff9db0" opacity=".48"/>
    <ellipse class="pd-blush" cx="72" cy="47" rx="5.5" ry="3.3" fill="#ff9db0" opacity=".48"/>
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
