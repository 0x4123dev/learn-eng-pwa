// Farm art manifest — the ONE list of pictures the farm may draw. Built from
// FarmRules.spriteNames() (every growth day and wilt state of every crop, every
// farm building) plus two extras. scripts/build-farm-art.py renders exactly
// these files into img/farm/, tests/farm-art.test.js checks they all exist and
// are precached, and js/night-raid.js never names a file that is not here.
// UMD like js/farm-rules.js.
var FarmArtManifest = (() => {
  'use strict';
  const Farm = typeof FarmRules !== 'undefined' ? FarmRules
    : (typeof require === 'function' ? require('./farm-rules.js') : null);
  // The style sheet every prompt starts with. One sentence, never edited per
  // file, so 48 pictures read as one set.
  const STYLE = 'Isometric game sprite, same camera angle as a 2:1 isometric tile viewed from the front-left, '
    + 'soft cel shading, bright storybook palette matching a green castle garden, transparent background, '
    + 'no text, no ground shadow longer than the object, centered, fills 80% of the canvas.';
  const CROP_VI = { lettuce: 'rau cải xanh', tomato: 'cây cà chua', carrot: 'cây cà rốt', rice: 'khóm lúa', rose: 'khóm hoa hồng', pumpkin: 'dây bí ngô' };
  const CROP_EN = { lettuce: 'lettuce', tomato: 'tomato plant', carrot: 'carrot plant', rice: 'rice plant', rose: 'rose bush', pumpkin: 'pumpkin vine' };
  const files = [];
  const add = (name, px, prompt) => files.push(Object.freeze({ name, px, prompt: STYLE + ' ' + prompt }));

  add('sprout', 256, 'A tiny green seedling with two leaves in a small mound of dark soil, freshly watered.');
  add('sprout-wilted', 256, 'A tiny seedling drooping sideways, leaves yellowed and limp, soil dry and cracked.');
  for (const c of Farm.CROPS) {
    for (let g = 1; g <= c.days; g++) {
      const stage = g === c.days ? 'fully ripe and ready to harvest, fruit or flowers bright and abundant'
        : `at growth stage ${g} of ${c.days}, ${Math.round(g / c.days * 100)}% grown, visibly larger than stage ${g - 1}`;
      add(c.id + '-day' + g, 256, `One ${CROP_EN[c.id]} (${CROP_VI[c.id]}) in a small soil bed, ${stage}.`);
    }
    add(c.id + '-wilted-young', 256, `A young ${CROP_EN[c.id]} wilting: stems bent, leaves yellow-brown and limp, soil dry and cracked, a little sad.`);
    add(c.id + '-wilted-old', 256, `A grown ${CROP_EN[c.id]} wilting: drooping heavily, leaves brown at the edges, fruit dull, soil dry and cracked, a little sad.`);
  }
  const BUILDING_PROMPT = {
    'fence': 'A short wooden farm fence segment with two posts and three rails.',
    'fruit-tree': 'A round fruit tree with red apples, small trunk, a few fallen apples.',
    'well': 'A stone water well with a small wooden roof and a bucket on a rope.',
    'chicken-coop': 'A small red wooden chicken coop with a ramp and two white hens outside.',
    'barn': 'A red wooden barn with white trim and a hay bale by the door.',
    'windmill': 'A stone-and-wood windmill with four cloth sails, a tiny door.',
    'cow-shed': 'A long open-front cow shed with a brown-and-white cow inside and a trough.',
    'farmhouse': 'A cozy farmhouse with a tiled roof, chimney smoke, a porch and flower boxes.',
  };
  for (const b of Farm.FARM_BUILDINGS) add(b.id, b.footprint === 2 ? 512 : 256, BUILDING_PROMPT[b.id]);
  add('farm-plot', 256, 'Legacy fenced square of tilled farmland, kept only for old cached clients.');
  add('farm-plot-stone', 512, 'A square vivid-green lawn with an ivory castle-stone border and small flowers at the corners, top-down, open centre.');
  add('farm-plot-hedge', 512, 'A square vivid-green lawn with a soft flower hedge and cream corner posts, top-down, open centre.');
  add('farm-plot-clover', 512, 'A square enchanted clover lawn with a cream cobblestone rim and glowing green corner markers, top-down, open centre.');
  add('dry-ground', 512, 'A seamless square tile of dry cracked pale-brown soil with a few dead grass tufts, flat, top-down, for tinting a garden that has been neglected.');

  const FILES = Object.freeze(files);
  function pathFor(name) { return 'img/farm/' + name + '.webp'; }
  return Object.freeze({ STYLE, FILES, pathFor });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = FarmArtManifest;
