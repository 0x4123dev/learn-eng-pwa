// petbattlebot.js — 🤖 practice mode: the same artillery duel, against a bot.
//
// Unlocked per user by an admin (users.allow_bot in D1), because practice
// bypasses the ammo economy completely: 20 shots every time, no cooldown, no
// friend needed. It runs ENTIRELY on the device — no battle row, no relay —
// so nothing a child does here can touch a real opponent's game.
//
// It also pays nothing: no coins, no cup, no history row. Practice is for
// learning to aim; the trophies stay earned.

const BOT_HP = 100;
const BOT_AMMO = 20;

// How wrong the bot's aim is, in degrees/power units. Big enough that a child
// who learns the arc will win, small enough that it lands often and the
// practice is worth having.
const BOT_ANGLE_ERROR = 7;
const BOT_POWER_ERROR = 9;

let _botGame = null;

// Search the (angle, power) space for the shot that lands nearest the target,
// then deliberately miss by a bit. Uses the real physics, so the bot is
// playing the same game the child is — not cheating with a scripted arc.
function botAim(calc, terrain, from, facing, target, wind, rng, rules) {
  let best = null;
  for (let angle = 25; angle <= 70; angle += 5) {
    for (let power = 40; power <= 95; power += 5) {
      // Same rule set the real shot will fly under — a bot aiming with v1
      // physics in a v2 world would never come close.
      const sim = calc.simulateShot({ terrain, from, facing, angle, power, wind, rules });
      if (!sim.hit) continue;
      const d = Math.abs(sim.hit.x - target.x);
      if (!best || d < best.d) best = { angle, power, d };
    }
  }
  // Nothing landed anywhere (shouldn't happen on a normal map) — lob one.
  if (!best) best = { angle: 45, power: 70, d: 999 };

  const r = rng || Math.random;
  return {
    angle: Math.max(10, Math.min(85, best.angle + (r() * 2 - 1) * BOT_ANGLE_ERROR)),
    power: Math.max(10, Math.min(100, best.power + (r() * 2 - 1) * BOT_POWER_ERROR)),
  };
}

// The bot's whole turn: aim, then hand the shot back through the SAME path a
// remote opponent's turn takes, so the game code cannot tell the difference.
function botTakeTurn(game) {
  if (!game || game.finished) return;
  const C = game.calc;
  const wind = game.wind();
  // Math.max(1, …) fired a phantom poop on an empty clip, so the bot kept
  // shooting from a visible "0 💩" and the battle never ended.
  const maxShots = C.maxShotsThisTurn(game.foeAmmo);
  if (maxShots <= 0) { game.turnNo += 1; _botEndOfTurn(); return; }
  const shots = Math.max(1, Math.min(maxShots, 1 + Math.floor(Math.random() * 3)));
  const aim = botAim(C, game.terrain, game.foePos, -game.meFacing, game.mePos, wind, null, game.rules);

  game.turnNo = game.turnNo + 1;
  game._replay({
    turn_no: game.turnNo,
    angle: aim.angle,
    power: aim.power,
    shots,
    damage: 0,          // 0 = "let the local simulation decide", same as a real turn
  });

  // Hand the turn back once the shells have landed.
  const waitForIdle = () => {
    if (!_botGame || _botGame.finished) return;
    if (_botGame.busy) { setTimeout(waitForIdle, 120); return; }
    _botEndOfTurn();
  };
  setTimeout(waitForIdle, 200);
}

// Practice follows the same rule as a real battle: play while anyone still
// has a poop left, not a fixed five rounds.
function _botEndOfTurn() {
  const g = _botGame;
  if (!g || g.finished) return;
  const C = g.calc;

  if (g.myHp <= 0 || g.foeHp <= 0 || (g.myAmmo <= 0 && g.foeAmmo <= 0) || g.turnNo >= C.MAX_TURNS) {
    g.finished = true;
    const won = g.foeHp <= 0 ? true : g.myHp <= 0 ? false : g.myHp > g.foeHp;
    setTimeout(() => g.onFinish({
      practice: true, won,
      myHp: g.myHp, foeHp: g.foeHp, foeName: '🤖 Bot',
      myLevel: g.view.me.level, foeLevel: g.view.foe.level,
      rounds: (g.log || []).slice(),
    }), 700);
    return;
  }
  g.turnNo += 1;
  g.myTurn = true;
  g.render();
}

// Called by the game after the child's volley resolves (practice only).
function botOnPlayerTurnDone() {
  const g = _botGame;
  if (!g || g.finished) return;
  const C = g.calc;
  if (g.foeHp <= 0 || g.myHp <= 0 || (g.myAmmo <= 0 && g.foeAmmo <= 0) || g.turnNo >= C.MAX_TURNS) { _botEndOfTurn(); return; }
  setTimeout(() => botTakeTurn(g), 700);
}

function botGameActive() { return !!_botGame && !_botGame.finished; }
function botSetGame(g) { _botGame = g; }
function botClearGame() { _botGame = null; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BOT_HP, BOT_AMMO, BOT_ANGLE_ERROR, BOT_POWER_ERROR,
    botAim, botTakeTurn, botOnPlayerTurnDone, botGameActive, botSetGame, botClearGame,
    _botEndOfTurn, _getBotGame: () => _botGame,
  };
}
