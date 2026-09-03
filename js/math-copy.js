// math-copy.js — copy typeset maths as the maths it shows, not as the HTML it
// is drawn with.
//
// js/math.js draws x² as x<sup>2</sup>, 2/5 as a two-row inline grid and √36
// as a hook plus a radicand with a bar over it. That is right on screen and
// wrong on the clipboard: the browser's plain-text serialiser flattens
// markup, so a child who selects √(21,5²) and pastes it into her homework
// gets √(21,52) — a different, perfectly plausible number — and 2/5 arrives
// as three lines, "2", "/", "5", because grid items are blocks to the text
// iterator (the visually hidden ".math-frac-slash" IS copied; it just lands
// on a line of its own between two more). x⁻⁵ pastes as x−5, y₁ as y1.
//
// Rendering is not touched. This listens for `copy` and, ONLY when the
// selection contains typeset maths, rewrites the text/plain payload from the
// selected markup: <sup>/<sub> back to Unicode where a glyph exists (the
// inverse of MATH_SUPERSCRIPTS / MATH_SUBSCRIPTS) and ^(…)/_(…) otherwise,
// a fraction as num/den, a mixed number as "2 2/5", a root as √(…). text/html
// carries the selected markup unchanged, so a rich editor still pastes the
// styled version. Ordinary text never reaches this code: the event is left
// alone and the browser's own copy runs, byte for byte.
//
// The pure part — markup in, plain text out — is MathCopy.plainText(html) and
// MathCopy.payload(html); tests/math-copy.test.js runs every question, option,
// answer and explanation of the banks through it. The DOM part is only: take
// the selection, clone it, put back the maths ancestors a partial selection
// cut off, hand the HTML over. If anything in here throws, the browser's
// default copy proceeds untouched.
var MathCopy = (() => {
  'use strict';

  // Where js/math.js paints formulas. A <sup>/<sub> anywhere under one of
  // these is maths — no English tab writes them — and a .math-frac/.math-root/
  // .math-mixed/.math-power is maths wherever it is.
  const SURFACES = ['.math-lesson-body', '.grammar-question-text', '.grammar-option-text',
    '.grammar-explanation', '.grammar-review-q', '.grammar-review-explain', '.math-formula',
    '.math-solution-steps li', '.math-mistakes li', '.math-hint-def'];
  const SURFACE_SELECTOR = SURFACES.join(', ');
  const SURFACE_RULES = SURFACES.map(s => {
    const m = /^\.([\w-]+)(?:\s+([a-z]+))?$/.exec(s);
    return { cls: m[1], tag: m[2] || null };
  });
  const CONSTRUCTS = ['math-frac', 'math-root', 'math-mixed', 'math-power'];

  // Mirrors of the two tables in js/math.js — module-local there, not
  // exported. In the browser the live tables win when math.js has already run;
  // tests/math-copy.test.js fails the moment the mirrors drift.
  const SUPERSCRIPTS = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5',
    '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '⁺': '+', '⁻': '−', '⁼': '=', '⁽': '(', '⁾': ')',
    'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᵏ': 'k',
    'ᵐ': 'm', 'ⁿ': 'n', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't',
    'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z'
  };
  const SUBSCRIPTS = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5',
    '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    '₊': '+', '₋': '−', '₌': '=', '₍': '(', '₎': ')',
    'ₐ': 'a', 'ₑ': 'e', 'ₕ': 'h', 'ᵢ': 'i', 'ⱼ': 'j', 'ₖ': 'k', 'ₗ': 'l',
    'ₘ': 'm', 'ₙ': 'n', 'ₒ': 'o', 'ₚ': 'p', 'ᵣ': 'r', 'ₛ': 's', 'ₜ': 't',
    'ᵤ': 'u', 'ᵥ': 'v', 'ₓ': 'x'
  };
  function invert(table) {
    const inv = {};
    for (const glyph in table) inv[table[glyph]] = glyph;
    // The banks write minus as U+2212; an author's keyboard writes a hyphen.
    // Both raise to the same glyph.
    if (inv['−'] && !inv['-']) inv['-'] = inv['−'];
    return inv;
  }
  const TO_SUP = invert(typeof MATH_SUPERSCRIPTS !== 'undefined' ? MATH_SUPERSCRIPTS : SUPERSCRIPTS);
  const TO_SUB = invert(typeof MATH_SUBSCRIPTS !== 'undefined' ? MATH_SUBSCRIPTS : SUBSCRIPTS);

  // ---- a tolerant reader for the markup the app itself produced ----
  // Template literals, innerHTML serialisation, an SVG figure now and then.
  // Attribute values may hold ">" (an onclick), so tags are matched attribute
  // by attribute rather than up to the first ">".
  const TAG_RE = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][^\s\/>]*)((?:\s+[^\s"'=<>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
  const CLASS_RE = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
  const HIDDEN_RE = /(?:^|\s)hidden(?=[\s=]|$)|(?:^|\s)style\s*=\s*["'][^"']*display\s*:\s*none/i;
  const VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1 };
  // Never rendered, so never copied — the browser skips them too.
  const SKIP = { script: 1, style: 1, template: 1, noscript: 1, head: 1, title: 1, desc: 1 };
  const BLOCK = { address: 1, article: 1, aside: 1, blockquote: 1, dd: 1, details: 1, div: 1, dl: 1, dt: 1,
    fieldset: 1, figcaption: 1, figure: 1, footer: 1, form: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1,
    header: 1, hr: 1, li: 1, main: 1, nav: 1, ol: 1, p: 1, pre: 1, section: 1, summary: 1, table: 1,
    tbody: 1, tfoot: 1, thead: 1, tr: 1, ul: 1 };
  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
    times: '×', middot: '·', minus: '−', radic: '√', deg: '°', plusmn: '±', ne: '≠', le: '≤', ge: '≥' };
  const WS = /[ \t\n\r\f]+/g;

  function classList(attrs) {
    const m = CLASS_RE.exec(attrs || '');
    return m ? (m[1] || m[2] || m[3] || '').split(/\s+/).filter(Boolean) : [];
  }
  function hasClass(node, cls) { return !!node.cls && node.cls.indexOf(cls) !== -1; }
  function neverShown(node) { return HIDDEN_RE.test(node.attrs || ''); }

  function decode(s) {
    if (s.indexOf('&') === -1) return s;
    return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (whole, e) => {
      if (e[0] === '#') {
        const n = (e[1] === 'x' || e[1] === 'X') ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return n >= 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : whole;
      }
      return Object.prototype.hasOwnProperty.call(ENTITIES, e) ? ENTITIES[e] : whole;
    });
  }

  function parse(html) {
    const root = { tag: '#root', cls: [], attrs: '', children: [], parent: null };
    let cur = root, last = 0, m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(html))) {
      if (m.index > last) cur.children.push({ text: html.slice(last, m.index) });
      last = TAG_RE.lastIndex;
      if (m[0].charCodeAt(1) === 33) continue;                 // <!-- comment -->
      const name = m[2].toLowerCase();
      if (m[1]) {                                              // closing tag
        let open = cur;
        while (open && open.tag !== name) open = open.parent;
        if (open && open.parent) cur = open.parent;            // unmatched: ignore
        continue;
      }
      const node = { tag: name, cls: classList(m[3]), attrs: m[3], children: [], parent: cur };
      cur.children.push(node);
      if (!m[4] && !VOID[name]) cur = node;
    }
    if (last < html.length) cur.children.push({ text: html.slice(last) });
    return root;
  }

  // ---- the maths constructs, as one-line text ----

  // Bracket a fraction side or a radicand only when it needs it to keep its
  // meaning on one line: "a + b" over "x + y" must copy as (a + b)/(x + y).
  // A leading sign does not need brackets (−3/4), nothing inside its own
  // brackets or bars counts (−(a+b)/2, |x − 1|/2), and a side that already IS
  // one bracketed group is left alone rather than wrapped twice.
  const INFIX = /[+\-−×·⋅:=<>≤≥≠±\/]/;
  function wrapped(t) {
    if (t.length < 2 || t[0] !== '(' || t[t.length - 1] !== ')') return false;
    let depth = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') depth++;
      else if (t[i] === ')' && --depth === 0 && i < t.length - 1) return false;
    }
    return depth === 0;
  }
  function compound(t) {
    let depth = 0, inBar = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === '|') inBar = !inBar;
      else if (i > 0 && depth <= 0 && !inBar && (ch === ' ' || ch === ' ' || INFIX.test(ch))) return true;
    }
    return false;
  }
  function group(t) { return (!t || wrapped(t) || !compound(t)) ? t : '(' + t + ')'; }

  // <sup>2</sup> → ², <sup>m+n</sup> → ᵐ⁺ⁿ; a run the font has no glyphs for
  // (a space, a letter outside the table, a nested fraction) falls back to
  // ^(…) — the same caret notation the banks themselves use.
  function raised(text, inv, mark) {
    text = text.trim();
    if (text === '') return '';
    let out = '';
    for (const ch of Array.from(text)) {
      const glyph = inv[ch];
      if (!glyph) return mark + (wrapped(text) ? text : '(' + text + ')');
      out += glyph;
    }
    return out;
  }

  function part(node, cls) {
    const child = node.children.find(c => c.tag && hasClass(c, cls));
    return child ? inner(child) : null;
  }

  // The text a maths element stands for, or null when the element is not one.
  // Every branch tolerates a HALF-selected construct — a numerator on its own,
  // a radicand without its hook — and then says only what was selected.
  function formula(node) {
    if (node.tag === 'sup') return raised(inner(node), TO_SUP, '^');
    if (node.tag === 'sub') return raised(inner(node), TO_SUB, '_');
    if (hasClass(node, 'math-frac')) {
      const num = part(node, 'math-num'), den = part(node, 'math-den');
      if (num != null && den != null) return group(num) + '/' + group(den);
      if (num != null || den != null) return num != null ? num : den;
      return node.children.filter(c => !(c.tag && hasClass(c, 'math-frac-slash'))).map(inline).join('');
    }
    if (hasClass(node, 'math-mixed')) {
      const pieces = [];
      for (const c of node.children) {
        if (!c.tag) continue;
        const t = inline(c);
        if (t) pieces.push(t);
      }
      return pieces.join(' ');
    }
    if (hasClass(node, 'math-root')) {
      const hook = node.children.some(c => c.tag && hasClass(c, 'math-root-symbol'));
      const rad = part(node, 'math-radicand');
      if (!hook) return rad != null ? rad : node.children.map(inline).join('');
      return '√' + (rad == null ? '' : group(rad));
    }
    if (hasClass(node, 'math-frac-slash')) return '';      // the fraction writes its own "/"
    if (hasClass(node, 'math-root-symbol')) return '√';
    return null;
  }

  function altOf(node) {
    const m = /(?:^|\s)alt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(node.attrs || '');
    return m ? decode(m[1] || m[2] || '') : '';
  }

  // Inline context — inside a formula nothing is a block and nothing breaks
  // the line, whatever the tag.
  function inline(node) {
    if (node.text != null) return decode(node.text);
    if (SKIP[node.tag] || neverShown(node)) return '';
    if (node.tag === 'br') return ' ';
    if (node.tag === 'img') return altOf(node);
    const f = formula(node);
    return f != null ? f : node.children.map(inline).join('');
  }
  function inner(node) { return node.children.map(inline).join('').replace(WS, ' '); }

  // ---- block context: line breaks only at <br> and block boundaries ----
  function Writer() { this.out = ''; }
  Writer.prototype.text = function (t) {
    t = t.replace(WS, ' ');
    if (this.out === '' || /[\n\t ]$/.test(this.out)) t = t.replace(/^ +/, '');
    this.out += t;
  };
  Writer.prototype.newline = function (force) {
    this.out = this.out.replace(/[ \t]+$/, '');
    if (force || (this.out !== '' && this.out[this.out.length - 1] !== '\n')) this.out += '\n';
  };
  Writer.prototype.cell = function () {
    if (this.out !== '' && !/[\n\t]$/.test(this.out)) this.out += '\t';
  };
  Writer.prototype.result = function () { return this.out.replace(/^\n+/, '').replace(/[ \t\n]+$/, ''); };

  function block(node, w) {
    if (node.text != null) { w.text(decode(node.text)); return; }
    if (SKIP[node.tag] || neverShown(node)) return;
    if (node.tag === 'br') { w.newline(true); return; }
    if (node.tag === 'img') { w.text(altOf(node)); return; }
    const f = formula(node);
    if (f != null) { w.text(f); return; }
    const isBlock = BLOCK[node.tag] === 1;
    if (isBlock) w.newline(false);
    if (node.tag === 'td' || node.tag === 'th') w.cell();
    for (const c of node.children) block(c, w);
    if (isBlock) w.newline(false);
  }

  // HTML fragment → the plain text it should paste as.
  function plainText(html) {
    const w = new Writer();
    for (const c of parse(String(html == null ? '' : html)).children) block(c, w);
    return w.result();
  }

  function onSurface(node, ancestors) {
    return SURFACE_RULES.some(r => r.tag
      ? (node.tag === r.tag && ancestors.some(a => hasClass(a, r.cls)))
      : hasClass(node, r.cls));
  }

  // Does this markup contain typeset maths at all? If not, the copy event is
  // left to the browser and ordinary text copies exactly as it always has.
  function involvesMath(html) {
    let found = false;
    (function walk(node, ancestors) {
      if (found || node.text != null) return;
      if (node.tag !== '#root') {
        if (CONSTRUCTS.some(c => hasClass(node, c))) { found = true; return; }
        if ((node.tag === 'sup' || node.tag === 'sub')
            && ancestors.some((a, i) => onSurface(a, ancestors.slice(0, i)))) { found = true; return; }
      }
      ancestors.push(node);
      for (const c of node.children) walk(c, ancestors);
      ancestors.pop();
    })(parse(String(html == null ? '' : html)), []);
    return found;
  }

  // What the clipboard should carry for this selected markup — or null,
  // meaning "not ours, do not touch the event".
  function payload(html) {
    html = String(html == null ? '' : html);
    if (!involvesMath(html)) return null;
    return { text: plainText(html), html: html };
  }

  // ---- DOM ----

  // Clone what is selected and put back the maths ancestors a partial
  // selection cut off: select just the "2" of x² and the clone is a bare text
  // node — but it IS a superscript, so it must copy as ². Rebuilding stops at
  // the enclosing surface; for a selection that spans surfaces (Select All)
  // the common ancestor is above them and nothing needs putting back.
  function selectedMarkup(range, doc) {
    let cloned = range.cloneContents();
    let el = range.commonAncestorContainer;
    if (el && el.nodeType !== 1) el = el.parentNode;
    for (; el && el.nodeType === 1 && el !== doc.body && el !== doc.documentElement; el = el.parentNode) {
      const shell = el.cloneNode(false);
      shell.appendChild(cloned);
      cloned = shell;
      if (typeof el.matches === 'function' && el.matches(SURFACE_SELECTOR)) break;
    }
    const box = doc.createElement('div');
    box.appendChild(cloned);
    return box.innerHTML;
  }

  function onCopy(e, doc) {
    try {
      doc = doc || (typeof document !== 'undefined' ? document : null);
      if (!doc || !e || !e.clipboardData || typeof doc.getSelection !== 'function') return;
      const sel = doc.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const texts = [], htmls = [];
      let maths = false;
      for (let i = 0; i < sel.rangeCount; i++) {
        const html = selectedMarkup(sel.getRangeAt(i), doc);
        const p = payload(html);
        if (p) maths = true;
        texts.push(p ? p.text : plainText(html));
        htmls.push(html);
      }
      if (!maths) return;
      e.clipboardData.setData('text/plain', texts.join('\n'));
      // The charset tag is what the browser's own copy prefixes on macOS; the
      // selected markup follows unchanged.
      e.clipboardData.setData('text/html', '<meta charset="utf-8">' + htmls.join(''));
      e.preventDefault();
    } catch (err) {
      // Whatever went wrong, the browser's default copy still runs.
    }
  }

  const doc = typeof document !== 'undefined' ? document : null;
  if (doc && typeof doc.addEventListener === 'function') doc.addEventListener('copy', onCopy);

  const api = { plainText, payload, involvesMath, onCopy, selectedMarkup, SURFACES, TO_SUP, TO_SUB };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
