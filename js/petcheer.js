// petcheer.js — the pet motivation loop: the dog asks for food every day,
// cheers during practice, and can be fed straight from the finish screen.
// Gentle urgency only: the pet gets hungry and sad, but NEVER loses XP or
// levels, and one practice session always makes him happy again.
//
// Depends (at runtime only) on home.js: DOG_FOOD, DOG_STAGES, getDogStage,
// getDogLevel, getPointsForLevel, computeCurrentHunger, buyFood, seededRandom.

// ---- tiny helpers -----------------------------------------------------
function _pcState() {
  return (typeof appState !== 'undefined' && appState) ? appState : null;
}
function _pcFoods() {
  return (typeof DOG_FOOD !== 'undefined') ? DOG_FOOD : [];
}
function _pcEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _pcToday() {
  let d = 0;
  try { d = Date.now(); } catch (e) {}
  return new Date(d).toDateString();
}
// The child's own dog face, so every reward shows THEIR pet.
function petFaceEmoji() {
  const st = _pcState();
  if (!st) return '🐶';
  try {
    const stage = getDogStage(st.dogLevel || 1);
    return (stage && stage.fallback) || '🐶';
  } catch (e) { return '🐶'; }
}
// The drawn version (petart.js) with the emoji as a safety net.
function petFaceArt(size) {
  const st = _pcState();
  try {
    if (typeof petDogSVG === 'function' && st) {
      const stage = getDogStage(st.dogLevel || 1);
      return petDogSVG({
        stageCss: stage && stage.stageCss, size: size || 34, mood: 'happy',
        level: st.dogLevel || 1, stageMinLevel: stage && stage.minLevel,
      });
    }
  } catch (e) {}
  return `<span style="font-size:${size || 34}px">${petFaceEmoji()}</span>`;
}
function petDisplayName() {
  const st = _pcState();
  return (st && st.petName) ? st.petName : 'Cún';
}

// ---- 1. daily food quest ---------------------------------------------
// The dog asks for one specific food each day, chosen to be reachable in
// 1-2 sessions at the child's own recent pace (never an impossible ask).
function petDailyEarnEstimate() {
  let perDay = 0;
  try {
    const days = (typeof getHomeDailyActivity === 'function') ? getHomeDailyActivity() : [];
    const past = days.slice(0, 6).filter(d => d.count > 0);        // exclude today
    if (past.length) perDay = past.reduce((n, d) => n + d.count, 0) / past.length;
  } catch (e) {}
  if (!perDay) perDay = 10;                       // new learner: assume one short session
  return Math.round(perDay * 5 * 0.8);            // 5 coins per correct, ~80% accuracy
}

function petFoodQuestToday() {
  const foods = _pcFoods();
  if (!foods.length) return null;
  const budget = petDailyEarnEstimate();
  // Everything affordable within a day's practice, plus always the cheapest.
  const reachable = foods.filter(f => f.price <= Math.max(budget, foods[0].price));
  const pool = reachable.length ? reachable.slice(-2) : [foods[0]];   // the best 1-2 he can get
  let idx = 0;
  try {
    if (typeof seededRandom === 'function') {
      idx = Math.floor(seededRandom('pet-food-' + _pcToday())() * pool.length);
    }
  } catch (e) {}
  return pool[Math.min(idx, pool.length - 1)] || foods[0];
}

// Quest progress lives in appState.petFoodQuest = { date, foodId, done }.
function petFoodQuestState() {
  const st = _pcState();
  const food = petFoodQuestToday();
  if (!st || !food) return { food, done: false };
  const today = _pcToday();
  if (!st.petFoodQuest || st.petFoodQuest.date !== today) {
    st.petFoodQuest = { date: today, foodId: food.id, done: false };
  }
  const q = st.petFoodQuest;
  const questFood = _pcFoods().find(f => f.id === q.foodId) || food;
  return { food: questFood, done: !!q.done };
}

// Called by buyFood(): buying today's requested food completes the quest.
function petFoodQuestOnFeed(foodId) {
  const st = _pcState();
  if (!st) return false;
  const q = petFoodQuestState();
  if (q.done || !q.food || q.food.id !== foodId) return false;
  st.petFoodQuest.done = true;
  if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    try { saveUserData(currentUser, st); } catch (e) {}
  }
  return true;
}

// `perCorrect` turns the coins still needed into a number of questions. It is
// not always 5: the maths tab pays 2, and quoting 5 there told a child they
// were less than half as far from the treat as they really are.
function petQuestLineHTML(perCorrect) {
  const rate = (Number.isFinite(+perCorrect) && +perCorrect > 0) ? +perCorrect : PET_COINS_PER_CORRECT;
  const st = _pcState();
  if (!st) return '';
  const { food, done } = petFoodQuestState();
  if (!food) return '';
  const coins = st.coins || 0;
  const name = _pcEsc(petDisplayName());
  if (done) {
    return `<div class="pet-quest-line done">✅ ${name} đã được ăn ${food.emoji} hôm nay — cảm ơn bé!</div>`;
  }
  const pct = Math.min(100, Math.round(coins / food.price * 100));
  const left = Math.max(0, food.price - coins);
  return `
    <div class="pet-quest-line">
      <div class="pet-quest-ask">${petFaceEmoji()} ${name} muốn ăn ${food.emoji} <b>${_pcEsc(food.name)}</b> hôm nay!</div>
      <div class="pet-quest-bar"><div class="pet-quest-fill" style="width:${pct}%"></div></div>
      <div class="pet-quest-meta">${coins}/${food.price} 🪙 ${left ? `· còn <b>${left}</b> 🪙 nữa (${Math.ceil(left / rate)} câu đúng)` : '· đủ rồi, cho bé ăn nhé!'}</div>
    </div>`;
}

// ---- 2. cheering during practice -------------------------------------
// Every correct answer the dog hops; every 5 in a row is a combo treat
// (+5 bonus coins, paid out on the finish screen).
const PET_COMBO_STEP = 5;
const PET_COMBO_BONUS = 5;
// What one correct answer is worth in the English tabs — the default the
// "how many more questions?" line quotes when a caller names no rate.
const PET_COINS_PER_CORRECT = 5;
let _petCombo = { streak: 0, best: 0, bonus: 0 };

function petCheerReset() { _petCombo = { streak: 0, best: 0, bonus: 0 }; }
function petComboState() { return { streak: _petCombo.streak, best: _petCombo.best, bonus: _petCombo.bonus }; }

// Returns the bonus coins earned this session and clears the counter.
function petComboBonus() {
  const b = _petCombo.bonus;
  petCheerReset();
  return b;
}

function petCheerAnswer(isCorrect) {
  if (!isCorrect) { _petCombo.streak = 0; petCheerPop('😮', ''); return; }
  _petCombo.streak++;
  if (_petCombo.streak > _petCombo.best) _petCombo.best = _petCombo.streak;
  const combo = _petCombo.streak > 0 && _petCombo.streak % PET_COMBO_STEP === 0;
  if (combo) {
    _petCombo.bonus += PET_COMBO_BONUS;
    petCheerPop('🎉', `${_petCombo.streak} liên tiếp! +${PET_COMBO_BONUS} 🪙`);
  } else {
    petCheerPop('💚', '');
  }
}

// Floating reaction near the top of the screen: the child's own dog hops.
function petCheerPop(icon, label) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('petCheer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'petCheer';
    el.className = 'pet-cheer';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span class="pet-cheer-dog">${petFaceArt(30)}</span><span class="pet-cheer-icon">${icon}</span>${label ? `<span class="pet-cheer-label">${_pcEsc(label)}</span>` : ''}`;
  // the hero dog (if on screen) and the popup dog react together
  if (typeof petDogPlay === 'function' && icon !== '😮') { try { petDogPlay(icon === '😋' ? 'eat' : 'hop'); } catch (e) {} }
  el.classList.remove('show');
  void el.offsetWidth;                       // restart the animation
  el.classList.add('show');
  if (typeof clearTimeout === 'function') {
    clearTimeout(petCheerPop._t);
    petCheerPop._t = setTimeout(() => el.classList.remove('show'), label ? 1800 : 1100);
  }
}

// ---- 3. finish-screen feeding card -----------------------------------
function petHungerNow() {
  const st = _pcState();
  if (!st) return 100;
  try { return computeCurrentHunger(st); } catch (e) { return 100; }
}

function petEvolutionLineHTML() {
  const st = _pcState();
  if (!st || typeof DOG_STAGES === 'undefined') return '';
  const level = st.dogLevel || 1;
  let stage, next = null;
  try {
    stage = getDogStage(level);
    next = DOG_STAGES.find(s => s.minLevel > level) || null;
  } catch (e) { return ''; }
  if (!next) return `<div class="pet-evo-line">${stage.fallback} <b>${_pcEsc(stage.name)}</b> · Level ${level} 👑 tối đa!</div>`;
  const span = next.minLevel - stage.minLevel;
  const done = level - stage.minLevel;
  const pct = span > 0 ? Math.min(100, Math.round(done / span * 100)) : 0;
  // The nearer goal: the next 5-level unlock (collar → hat → jewellery).
  let unlock = '';
  try {
    if (typeof petNextTierLevel === 'function') {
      const at = petNextTierLevel(level, stage.minLevel);
      if (at) {
        const label = petTierLabel(petTierForLevel(at, stage.minLevel));
        unlock = `<div class="pet-evo-unlock">🎁 Level <b>${at}</b> (còn <b>${at - level}</b>): Milo được <b>${_pcEsc(label)}</b></div>`;
      }
    }
  } catch (e) {}
  return `
    <div class="pet-evo-line">
      <div class="pet-evo-text">${stage.fallback} <b>${_pcEsc(stage.name)}</b> · Level ${level} — còn <b>${next.minLevel - level}</b> level nữa thành <span class="pet-evo-next">❓</span> <b>${_pcEsc(next.name)}</b>!</div>
      <div class="pet-evo-bar"><div class="pet-evo-fill" style="width:${pct}%"></div></div>
      ${unlock}
    </div>`;
}

// The celebration + feeding card shown on every practice finish screen.
function petRewardCardHTML(score, total, coinsEarned, perCorrect) {
  const st = _pcState();
  const pct = total ? Math.round(score / total * 100) : 0;
  const msg = pct === 100 ? 'PERFECT! Xuất sắc! 🏆'
    : pct >= 80 ? 'Tuyệt vời! 🌟'
    : pct >= 60 ? 'Làm tốt lắm! 👍'
    : 'Cố lên, luyện thêm nhé! 💪';
  const coins = st ? (st.coins || 0) : 0;
  const hunger = petHungerNow();
  const hungerCls = hunger <= 25 ? 'low' : hunger <= 50 ? 'mid' : '';
  const burst = ['🪙', '🎉', '⭐', '🪙', '🎊', '🪙'].map((e, i) =>
    `<span class="reward-burst-item" style="left:${8 + i * 15}%; animation-delay:${(i * 0.12).toFixed(2)}s">${e}</span>`).join('');

  const foodBtns = _pcFoods().map(f => {
    const can = coins >= f.price;
    return `<button class="pet-feed-btn ${can ? '' : 'locked'}" ${can ? '' : 'disabled'} onclick="petQuickFeed('${f.id}')">
        <span class="pet-feed-emoji">${f.emoji}</span>
        <span class="pet-feed-price">${f.price}🪙</span>
      </button>`;
  }).join('');

  return `
      <div class="unit-reward-card reward-pop" id="petRewardCard">
        <div class="reward-burst">${burst}</div>
        <div class="reward-congrats">🎉 ${msg}</div>
        <div class="unit-reward-coins reward-coins-pop">${coinsEarned ? `+${coinsEarned} 🪙` : '0 🪙'}</div>
        <div class="unit-reward-total">Bạn có ${coins} 🪙</div>

        <div class="pet-feed-zone">
          <div class="pet-feed-head">
            <span class="pet-feed-dog">${petFaceArt(52)}</span>
            <div class="pet-feed-info">
              <div class="pet-feed-name">${_pcEsc(petDisplayName())} ${hunger <= 25 ? 'đang rất đói 🥺' : hunger <= 50 ? 'hơi đói 🙂' : 'no bụng 😊'}</div>
              <div class="pet-hunger-bar"><div class="pet-hunger-fill ${hungerCls}" style="width:${hunger}%"></div></div>
            </div>
          </div>
          ${petQuestLineHTML(perCorrect)}
          <div class="pet-feed-row">${foodBtns}</div>
          ${petEvolutionLineHTML()}
        </div>
      </div>`;
}

// Feed straight from the finish screen, then refresh the card in place.
function petQuickFeed(foodId) {
  const st = _pcState();
  const food = _pcFoods().find(f => f.id === foodId);
  if (!st || !food || (st.coins || 0) < food.price) return;
  const beforeLevel = st.dogLevel || 1;
  if (typeof buyFood === 'function') { try { buyFood(foodId); } catch (e) {} }
  const questJustDone = petFoodQuestOnFeed(foodId);
  const card = document.getElementById('petRewardCard');
  if (card) {
    const parent = card.parentNode;
    const html = petRewardCardHTML(0, 0, 0);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const fresh = tmp.firstElementChild;
    // keep the congrats/coins lines from the original card
    const keepCongrats = card.querySelector('.reward-congrats');
    const keepCoins = card.querySelector('.unit-reward-coins');
    if (keepCongrats) fresh.querySelector('.reward-congrats').innerHTML = keepCongrats.innerHTML;
    if (keepCoins) fresh.querySelector('.unit-reward-coins').innerHTML = keepCoins.innerHTML;
    fresh.classList.remove('reward-pop');
    parent.replaceChild(fresh, card);
  }
  petCheerPop('😋', `${petDisplayName()} ăn ${food.emoji} ngon quá!`);
  if ((st.dogLevel || 1) > beforeLevel) {
    if (typeof petDogPlay === 'function') { try { petDogPlay('levelup'); } catch (e) {} }
    if (typeof createConfetti === 'function') { try { createConfetti(); } catch (e) {} }
  }
  if (questJustDone && typeof showPetSpeechBubble === 'function') {
    try { showPetSpeechBubble('Cảm ơn bé! Hôm nay mình no rồi! 🎉'); } catch (e) {}
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    petFaceEmoji, petDisplayName, petDailyEarnEstimate, petFoodQuestToday,
    petFoodQuestState, petFoodQuestOnFeed, petQuestLineHTML,
    petCheerAnswer, petCheerReset, petComboState, petComboBonus,
    petEvolutionLineHTML, petRewardCardHTML, petQuickFeed, petHungerNow,
    PET_COMBO_STEP, PET_COMBO_BONUS,
  };
}
