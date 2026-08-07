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

// ---- ear shapes (drawn behind the head, one per side) ----
function _petEars(look) {
  const f = look.fur, d = _petShade(look.fur, -18);
  switch (look.ear) {
    case 'pointy':
      return `
        <path class="pd-ear pd-ear-l" d="M32 26 L24 6 L46 20 Z" fill="${f}"/>
        <path class="pd-ear pd-ear-l" d="M33 24 L28 12 L42 21 Z" fill="${d}" opacity=".55"/>
        <path class="pd-ear pd-ear-r" d="M68 26 L76 6 L54 20 Z" fill="${f}"/>
        <path class="pd-ear pd-ear-r" d="M67 24 L72 12 L58 21 Z" fill="${d}" opacity=".55"/>`;
    case 'long':
      return `
        <ellipse class="pd-ear pd-ear-l" cx="24" cy="46" rx="9"  ry="20" fill="${d}"/>
        <ellipse class="pd-ear pd-ear-r" cx="76" cy="46" rx="9"  ry="20" fill="${d}"/>`;
    case 'curly':
      return `
        <circle class="pd-ear pd-ear-l" cx="24" cy="40" r="12" fill="${f}"/>
        <circle class="pd-ear pd-ear-l" cx="21" cy="49" r="9"  fill="${f}"/>
        <circle class="pd-ear pd-ear-r" cx="76" cy="40" r="12" fill="${f}"/>
        <circle class="pd-ear pd-ear-r" cx="79" cy="49" r="9"  fill="${f}"/>`;
    default: // floppy
      return `
        <ellipse class="pd-ear pd-ear-l" cx="25" cy="42" rx="10" ry="16" fill="${d}"/>
        <ellipse class="pd-ear pd-ear-r" cx="75" cy="42" rx="10" ry="16" fill="${d}"/>`;
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

// ---- the dog ----
// opts: { stageCss, size, mood, id }  — mood: 'happy'|'hungry'|'starving'|'stinky'|'sad'
function petDogSVG(opts) {
  opts = opts || {};
  const look = petBreedLook(opts.stageCss);
  const size = opts.size || 96;
  const mood = opts.mood || 'happy';
  const moodCls = (mood === 'hungry' || mood === 'starving' || mood === 'sad') ? 'pd-sad' : '';
  const dark = _petShade(look.fur, -20);

  return `
<svg class="pd-dog ${moodCls}" viewBox="0 0 100 108" width="${size}" height="${Math.round(size * 1.08)}"
     xmlns="http://www.w3.org/2000/svg" role="img" aria-label="pet dog">
  <ellipse class="pd-shadow" cx="50" cy="101" rx="26" ry="5" fill="#000" opacity=".18"/>
  <g class="pd-body-grp">
    <path class="pd-tail" d="M74 78 q14 -4 12 -18 q-2 12 -12 12 Z" fill="${dark}"/>
    <ellipse class="pd-body" cx="50" cy="78" rx="24" ry="20" fill="${look.fur}"/>
    <ellipse class="pd-belly" cx="50" cy="84" rx="14" ry="12" fill="${look.belly}"/>
    <ellipse class="pd-paw" cx="37" cy="95" rx="8" ry="5" fill="${look.belly}"/>
    <ellipse class="pd-paw" cx="63" cy="95" rx="8" ry="5" fill="${look.belly}"/>
  </g>
  <g class="pd-head-grp">
    ${_petEars(look)}
    <circle class="pd-head" cx="50" cy="40" r="26" fill="${look.fur}"/>
    ${_petExtra(look)}
    <ellipse class="pd-muzzle" cx="50" cy="50" rx="15" ry="11" fill="${look.muzzle}"/>
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
  </g>
</svg>`;
}

// A tiny version for chips, the cheer popup and the reward card.
function petDogMiniSVG(stageCss, size) {
  return petDogSVG({ stageCss, size: size || 34, mood: 'happy' });
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
  };
}
