// tapwords.js — tap any English word (after answering) to hear it and see
// its Vietnamese meaning. Voice reuses _unitSpeak (units.js); meanings come
// from the offline dictionary WORD_VI (dictionary-data.js): { word: [pos, vi] }.

function twDict() {
  return (typeof WORD_VI !== 'undefined') ? WORD_VI : {};
}

function twEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Wrap every pure-ASCII English word in a tappable span. Vietnamese words
// (contain diacritics), ___ blanks, digits and punctuation stay untouched.
// Matching whole letter-runs (incl. Vietnamese letters) then filtering to
// ASCII-only avoids splitting "nghĩa" into fake English fragments — and
// needs no regex lookbehind (older Safari would fail at parse time).
function tapwordsWrap(text) {
  const esc = twEsc(String(text));
  // Entities produced by escaping (&amp; &lt; &gt; &#39;…) must pass through
  // untouched — the alternation matches them first so their letters are
  // never mistaken for words.
  return esc.replace(/&(?:[a-z]+|#\d+);|[A-Za-zÀ-ɏḀ-ỿ']+/g, m =>
    m[0] !== '&' && /^[A-Za-z]+(?:'[a-z]+)?$/.test(m)
      ? `<span class="tw" onclick="tapWord(this, event)">${m}</span>`
      : m
  );
}

// Warm the recordings for text the student is about to be able to tap.
// Tap-to-hear unlocks only after a question is answered, so calling this when
// the question renders buys the whole reading-and-answering window of free
// network time — by the time the words become tappable, they are cached.
// Most words are already warm from HOT_WORDS; this covers the tail.
function twPrefetch(...texts) {
  if (typeof warmWord !== 'function') return 0;
  let started = 0;
  for (const text of texts.flat()) {
    // Tags stripped first: <b>/<br> are formatting, never tappable words.
    const plain = String(text == null ? '' : text).replace(/<[^>]*>/g, ' ');
    for (const m of plain.match(/[A-Za-zÀ-ɏḀ-ỿ']+/g) || []) {
      if (!/^[A-Za-z]+(?:'[a-z]+)?$/.test(m)) continue;
      try { if (warmWord(m)) started++; } catch (e) {}
    }
  }
  return started;
}

// Lookup with light morphology fallback for words outside the bank list.
const TW_IRREGULAR = {
  went: 'go', gone: 'go', taught: 'teach', thought: 'think', bought: 'buy',
  brought: 'bring', caught: 'catch', children: 'child', feet: 'foot',
  teeth: 'tooth', mice: 'mouse', men: 'man', women: 'woman', better: 'good',
  best: 'good', worse: 'bad', worst: 'bad', was: 'be', were: 'be', is: 'be',
  are: 'be', am: 'be', been: 'be', has: 'have', had: 'have', did: 'do',
  done: 'do', said: 'say', made: 'make', took: 'take', taken: 'take',
  gave: 'give', given: 'give', saw: 'see', seen: 'see', came: 'come',
  knew: 'know', known: 'know', got: 'get', ran: 'run', wrote: 'write',
  written: 'write', spoke: 'speak', spoken: 'speak', ate: 'eat',
  eaten: 'eat', drank: 'drink', swam: 'swim', flew: 'fly', flown: 'fly',
  drove: 'drive', driven: 'drive', rode: 'ride', fell: 'fall', felt: 'feel',
  kept: 'keep', left: 'leave', lost: 'lose', met: 'meet', paid: 'pay',
  sat: 'sit', slept: 'sleep', stood: 'stand', told: 'tell', wore: 'wear',
  worn: 'wear', won: 'win', understood: 'understand',
};

function twCandidates(w) {
  const c = [w];
  if (TW_IRREGULAR[w]) c.push(TW_IRREGULAR[w]);
  if (w.endsWith('ies')) c.push(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) c.push(w.slice(0, -2));
  if (w.endsWith('s')) c.push(w.slice(0, -1));
  if (w.endsWith('ied')) c.push(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) { c.push(w.slice(0, -2), w.slice(0, -1)); if (w.length > 4 && w[w.length - 3] === w[w.length - 4]) c.push(w.slice(0, -3)); }
  if (w.endsWith('ing')) { c.push(w.slice(0, -3), w.slice(0, -3) + 'e'); if (w.length > 5 && w[w.length - 4] === w[w.length - 5]) c.push(w.slice(0, -4)); }
  if (w.endsWith('er')) c.push(w.slice(0, -2), w.slice(0, -1));
  if (w.endsWith('est')) c.push(w.slice(0, -3), w.slice(0, -2));
  if (w.endsWith('ly')) c.push(w.slice(0, -2));
  return c;
}

function twLookup(word) {
  const dict = twDict();
  const w = String(word || '').toLowerCase().replace(/[^a-z']/g, '').replace(/'.*$/, '');
  if (!w) return null;
  for (const cand of twCandidates(w)) {
    if (dict[cand]) return { w: cand, pos: dict[cand][0], vi: dict[cand][1] };
  }
  return null;
}

function tapWord(el, ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();   // don't re-trigger option buttons
  const raw = (el && el.textContent ? el.textContent : '').trim();
  if (!raw) return;
  if (typeof _unitSpeak === 'function') _unitSpeak(raw);
  // The offline dictionary is 352 KB and belongs to no single screen, so it is
  // no longer part of the app's first paint (js/lazy-data.js). Speak the word
  // immediately either way, and fetch the meaning the first time one is asked
  // for — after that it is already in memory.
  if (typeof LazyData !== 'undefined' && !LazyData.dictionaryReady()) {
    LazyData.ensureDictionary().then(() => twShowChip(raw, twLookup(raw)));
    return;
  }
  twShowChip(raw, twLookup(raw));
}

const TW_POS_VI = {
  n: 'danh từ', v: 'động từ', adj: 'tính từ', adv: 'trạng từ', prep: 'giới từ',
  conj: 'liên từ', pron: 'đại từ', det: 'hạn định từ', num: 'số từ',
  interj: 'thán từ', name: 'tên riêng', abbr: 'viết tắt',
};

function twShowChip(word, hit) {
  let chip = document.getElementById('twChip');
  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'twChip';
    chip.className = 'tw-chip';
    document.body.appendChild(chip);
  }
  const meaning = hit
    ? `<span class="tw-chip-pos">(${twEsc(TW_POS_VI[hit.pos] || hit.pos)})</span> ${twEsc(hit.vi)}`
    : '<em>chưa có trong từ điển</em>';
  chip.innerHTML = `
    <button class="tw-chip-speak" onclick="if (typeof _unitSpeak === 'function') _unitSpeak('${twEsc(word).replace(/'/g, '&#39;')}')">🔊</button>
    <span class="tw-chip-text"><b>${twEsc(word)}</b> — ${meaning}</span>`;
  chip.classList.add('show');
  if (typeof clearTimeout === 'function') {
    clearTimeout(twShowChip._t);
    twShowChip._t = setTimeout(() => chip.classList.remove('show'), 4500);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tapwordsWrap, twPrefetch, twLookup, twCandidates, tapWord, twShowChip, twEsc };
}
