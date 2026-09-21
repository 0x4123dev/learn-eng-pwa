// tests/css-all.js — the app's stylesheet, as the browser ends up seeing it.
//
// css/styles.css is only the part that loads at startup. The farm's rules
// live in css/night-raid.css, which js/lazy-data.js appends (as
// <link rel="stylesheet">) when its screen is opened — so in the cascade it
// comes AFTER styles.css, which is the order this file concatenates them in. A test that asks "is this feature styled?"
// reads this, not css/styles.css alone; tests/css-split.test.js is the one
// that cares which file a rule is in.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS_FILES = ['css/styles.css', 'css/night-raid.css'];

function readAllCss() {
  return CSS_FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
}

module.exports = { CSS_FILES, readAllCss };
