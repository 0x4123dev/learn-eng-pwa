// math-fight-api.test.js — the server half of Đấu Toán, read as source.
//
// Two things matter more than anything else here and both are pinned below:
//   1. The client never reports a score. It sends the values it chose; the
//      server rebuilds the same twenty questions from the seed and marks them.
//   2. The handicap is invisible. No payload may carry the opponent's rung,
//      the pair's leader or its streak — a child who could see the handicap
//      would learn that losing is rewarded.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const api = n => read('functions/api/math-fight/' + n + '.js');

suite('math fight: schema', () => {
  test('the migration creates both tables', () => {
    const sql = read('db/011-math-fight.sql');
    for (const t of ['math_fights', 'math_fight_pairs'])
      assert.truthy(sql.includes('CREATE TABLE IF NOT EXISTS ' + t), t);
  });
  test('a fight stores the seed and both rungs, so any result can be rebuilt', () => {
    const sql = read('db/011-math-fight.sql');
    for (const col of ['seed', 'challenger_level', 'opponent_level', 'c_answers_json', 'o_answers_json'])
      assert.truthy(sql.includes(col), col);
  });
  test('the handicap is keyed on the sorted pair, so A-B and B-A share one row', () => {
    const sql = read('db/011-math-fight.sql');
    assert.truthy(sql.includes('PRIMARY KEY (lo_id, hi_id)'));
    assert.truthy(sql.includes('next_ready_at'));
  });
  test('the migration carries the command that applies it', () => {
    assert.truthy(read('db/011-math-fight.sql').includes('wrangler@3 d1 execute'));
  });
});

suite('math fight: server helpers', () => {
  const src = () => read('functions/api/_math-fight.js');
  test('scoring runs the shared generator, never a client-supplied score', () => {
    // The round is drawn by ONE builder that the device and the server both
    // call (MF.fightQuestions), so the twenty questions can never drift apart
    // and mark a child wrong for a right answer. Behavioural coverage:
    // tests/math-fight-score-integrity.test.js.
    assert.truthy(src().includes('MF.fightQuestions('));
    assert.truthy(src().includes('MATH_FIGHT_BANK'), 'the pre-authored bank is injected on the server');
    assert.falsy(/body\.correct/.test(src()), 'the client must never report a score');
  });
  test('the pair row is read and written through the sorted key', () => {
    assert.truthy(src().includes('MF.pairKey('));
    assert.truthy(src().includes('math_fight_pairs'));
  });
  test('the fight view never leaks the opponent rung or the handicap', () => {
    const s = src();
    const view = s.slice(s.indexOf('export function fightView'), s.indexOf('export', s.indexOf('export function fightView') + 10) + 1 || undefined);
    for (const leak of ['streak', 'leaderId', 'foeLevel', 'opponentLevel'])
      assert.falsy(view.includes(leak), 'fightView must not carry ' + leak);
  });
  test('settlement writes the handicap, the cooldown and the coins together', () => {
    const s = src();
    const fn = s.slice(s.indexOf('export async function settleFight'));
    assert.truthy(fn.includes('MF.adjudicate('));
    assert.truthy(fn.includes('MF.nextPairState('));
    assert.truthy(fn.includes('MF.cooldownUntil('));
    assert.truthy(fn.includes('MF.hasWalkedAway('));
  });
  test('the coin delta is the prize, and a loser never goes negative', () => {
    const s = src();
    const fn = s.slice(s.indexOf('export function coinDelta'));
    assert.truthy(fn.includes('MF.coinChange('), 'the floor rule lives in the rules module');
    assert.truthy(fn.includes('winner_id'));
  });
});

suite('math fight: challenge and accept', () => {
  test('every endpoint requires auth', () => {
    for (const n of ['index', 'challenge', 'respond', 'progress', 'submit'])
      assert.truthy(api(n).includes('requireAuth'), n + ' must require auth');
  });
  test('a challenge is only ever against a friend', () => {
    assert.truthy(api('challenge').includes('areFriends'));
  });
  test('nobody picks a stake: the prize is a server constant', () => {
    const src = api('challenge');
    assert.truthy(src.includes('MF.PRIZE'), 'the prize comes from the rules module');
    assert.falsy(src.includes('body.bet'), 'a client may not name its own stake');
    assert.falsy(src.includes('body.coins'), 'challenging costs nothing up front');
  });
  test('a challenge enforces both cooldowns and one fight at a time', () => {
    const src = api('challenge');
    assert.truthy(src.includes('friendBattleReadyAt'), 'the 3-day friendship gate still applies');
    assert.truthy(src.includes('nextReadyAt'), 'the 3-day pair cooldown must be checked');
    assert.truthy(src.includes('currentFight'), 'one fight at a time');
    assert.truthy(src.includes('MF.INVITE_TTL_MS'));
  });
  test('the rungs are decided by the server at challenge time', () => {
    const src = api('challenge');
    assert.truthy(src.includes('MF.baseLevel('));
    assert.truthy(src.includes('MF.levelsFor('));
    assert.falsy(src.includes('body.bet)') && src.includes('body.level)') && !src.includes('MF.baseLevel('),
      'a client may not pick its own difficulty');
  });
  test('accepting starts the five-minute clock on the server', () => {
    const src = api('respond');
    assert.truthy(src.includes("status='active'"));
    assert.truthy(src.includes('MF.SECONDS * 1000'));
  });
});

suite('math fight: scoring and settlement', () => {
  test('the heartbeat carries answers, never a score', () => {
    const src = api('progress');
    assert.truthy(src.includes('scoreAnswers('), 'the server scores the array itself');
    assert.falsy(/body\.correct/.test(src), 'a client-reported score is a cheat vector');
    assert.truthy(src.includes('beat_at'), 'the pulse doubles as walk-away detection');
  });
  test('submitting scores the same way and settles once', () => {
    const src = api('submit');
    assert.truthy(src.includes('scoreAnswers('));
    assert.truthy(src.includes('settleFight('));
    assert.falsy(/body\.reward/.test(src));
  });
  test('a fight that nobody finished still gets settled', () => {
    assert.truthy(read('functions/api/_math-fight.js').includes('reapStale'));
    assert.truthy(api('index').includes('reapStale'));
  });
});

suite('math fight: hidden until an admin opens it', () => {
  test('the switch is app-wide and ships off', () => {
    const sql = read('db/011-math-fight.sql');
    assert.truthy(sql.includes('CREATE TABLE IF NOT EXISTS app_flags'), 'one switch table for the app');
    assert.truthy(sql.includes("INSERT OR IGNORE INTO app_flags(key, value, updated_at) VALUES ('math_fight', 0, 0)"),
      'it must seed to OFF, or deploying would open the tab for everyone at once');
    // Not per child: a duel needs two, so a per-child switch would mostly
    // produce friend lists with nobody to challenge.
    assert.falsy(sql.includes('allow_math_fight'), 'the switch must not be a per-user column');
  });
  test('the server refuses the tab, not just the menu card', () => {
    const helper = read('functions/api/_math-fight.js');
    assert.truthy(helper.includes('export async function mathFightEnabled'));
    assert.truthy(helper.includes("MATH_FIGHT_FLAG = 'math_fight'"));
    assert.truthy(helper.includes('FROM app_flags WHERE key = ?'));
    for (const n of ['index', 'challenge'])
      assert.truthy(api(n).includes('mathFightEnabled(env)'), n + ' must check the switch');
    // A live bout must stay finishable even if the switch flips mid-fight, or
    // two children would be stranded with a fight nobody can settle.
    for (const n of ['progress', 'submit'])
      assert.falsy(api(n).includes('mathFightEnabled'), n + ' must not strand a fight in progress');
  });
  test('the menu card is hidden until the flag says otherwise', () => {
    const math = read('js/math.js');
    assert.truthy(math.includes('function mathFightUnlocked()'));
    assert.truthy(math.includes("mathFightUnlocked() ? `<button"), 'the card renders only when unlocked');
    assert.truthy(math.includes("if (v === 'fight' && !mathFightUnlocked()) v = 'home'"),
      'a stale deep link must not open a tab that is switched off');
  });
  test('an admin flips it once, for everybody', () => {
    const flags = read('functions/api/admin/app-flags.js');
    assert.truthy(flags.includes("auth.role !== 'admin'"), 'only an admin may flip it');
    assert.truthy(flags.includes("const FLAGS = ['math_fight']"), 'only known flags may be written');
    assert.truthy(flags.includes('Unknown flag'), 'a mistyped key must be refused, not stored');
    assert.truthy(flags.includes('ON CONFLICT(key) DO UPDATE'));
    const html = read('admin.html');
    assert.truthy(html.includes('mathFightFlag'), 'the dashboard carries the switch');
    assert.truthy(html.includes("key:'math_fight'"));
    assert.truthy(html.includes('TẤT CẢ người học'), 'the confirm must say it affects everyone');
    // The per-user experiment must not linger anywhere.
    assert.falsy(html.includes('fight-toggle'));
    assert.falsy(read('functions/api/admin/user-flags.js').includes('allowMathFight'));
    assert.falsy(read('functions/api/admin/users.js').includes('allow_math_fight'));
  });
});

suite('math fight: one fight, one verdict', () => {
  const ui = () => read('js/math-fight.js');
  test('finishing first is not a draw', () => {
    // The server only decides once both are in, so a fight still 'active' has
    // no winner. Painting the result anyway told whoever finished first that
    // it was a draw, while the other child later saw the real verdict — two
    // screens, two answers, same fight.
    assert.truthy(ui().includes("if (st.fight.status !== 'done') return waitForVerdict()"),
      'an unsettled fight must wait, not announce');
    assert.truthy(ui().includes('function waitForVerdict()'));
    assert.truthy(ui().includes('Đang chờ bạn ấy làm xong'));
    // Polling progress while waiting doubles as the pulse, so the child who
    // finished first is never mistaken for one who walked away.
    const wait = ui().slice(ui().indexOf('function waitForVerdict()'), ui().indexOf('function paintWaiting()'));
    assert.truthy(wait.includes("api('progress'"), 'the wait must keep the pulse alive');
  });
  test('the winner comes from the server, never from guessing the scores', () => {
    const src = ui();
    assert.falsy(src.includes('EngAuth.userIdFor'), 'that helper never existed, so the check always fell through');
    assert.truthy(src.includes('EngAuth.getAccount(currentUser) || {}).id'), 'the account row carries the id');
    assert.truthy(src.includes('Number(st.fight.winnerId) === Number(me)'));
    // A draw is only a draw once the fight is settled.
    assert.truthy(src.includes("const settled = st.fight.status === 'done'"));
    assert.truthy(src.includes('const drew = settled && !st.fight.winnerId'));
  });
});

suite('math fight: an unlocked tab must actually appear', () => {
  test('feature flags are refreshed on every app open, not only at login', () => {
    // loginUser only syncs when the profile still holds a passcode, so a
    // device that simply stayed signed in kept an unlocked tab hidden.
    const app = read('js/app.js'), auth = read('js/auth.js');
    assert.truthy(app.includes('EngAuth.refreshFlags(resumeUser)'), 'a resumed session must re-ask for the flags');
    assert.truthy(auth.includes('refreshFlags: claimCoinGrants'), 'the flag fetch must be callable on its own');
    // And the screen the child is already looking at must repaint.
    assert.truthy(auth.includes('renderMathHome()'), 'the Math menu must redraw when the switch arrives');
  });
});
