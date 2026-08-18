// cross-boundary-drift.test.js — values that MUST be identical in two places
// that cannot import each other.
//
// This project has three runtimes that never share a module: the browser
// (js/*.js, classic scripts), Cloudflare Pages Functions (functions/**, ESM),
// and the relay Durable Object (battle-worker/, a separate deploy). Any value
// duplicated across that boundary can drift, and drift there fails SILENTLY —
// nothing throws, the feature just quietly does the wrong thing.
//
// The arena-allowlist guard in tests/battle-scenes.test.js is the same idea.
// This file covers the rest of them.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const C = require(path.join(ROOT, 'js', 'battlecalc.js'));

const serverBattle = read('functions/api/_battle.js');
const turnSrc = read('functions/api/battle/turn.js');
const gameSrc = read('js/petbattlegame.js');
const workerSrc = read('battle-worker/src/index.js');
const linkSrc = read('js/battlelink.js');

const serverNum = (name) => {
    const m = serverBattle.match(new RegExp('export const ' + name + ' = (\\d+)'));
    return m ? +m[1] : null;
};

suite('drift: battle constants shared by the client and the API', () => {
    // MAX_TURNS decides when a battle ends. If the two sides disagree, one
    // keeps offering turns the other has already closed.
    test('MAX_TURNS is identical on both sides', () => {
        const m = serverBattle.match(/export const MAX_TURNS = ([^;]+);/);
        const c = read('js/battlecalc.js').match(/const MAX_TURNS = ([^;]+);/);
        assert.truthy(m && c, 'MAX_TURNS must exist on both sides');
        assert.equal(m[1].trim(), c[1].trim(), 'MAX_TURNS expression differs between server and client');
        assert.equal(C.MAX_TURNS, 44, 'and the computed value is pinned');
    });

    test('every numeric rule the server exports matches the client', () => {
        for (const name of ['AMMO_PER_CORRECT', 'AMMO_VOLUME_MAX', 'AMMO_PERFECT_MAX',
            'AMMO_STREAK_BONUS', 'AMMO_CAP', 'BARRELS', 'BATTLE_ROUNDS']) {
            assert.equal(serverNum(name), C[name], `${name} differs between server and client`);
        }
    });
});

suite('drift: the battlefield version', () => {
    // The nastiest one. The server stamps field_version onto the battle row;
    // the client turns it into terrain. If the server ever writes a version
    // the client does not know, fieldRules() falls back to v1 and the child
    // plays a DIFFERENT WORLD from the one the battle was created in — with
    // no error anywhere.
    test('the client can render every version the server may write', () => {
        const newV = serverNum('FIELD_VERSION_NEW');
        const maxV = serverNum('FIELD_VERSION_MAX');
        assert.truthy(newV && maxV, 'server field-version constants missing');
        const known = Object.keys(C.FIELD_RULES).map(Number);
        for (let v = 1; v <= maxV; v++) {
            assert.truthy(known.includes(v), `server allows field_version ${v} but the client has no rules for it`);
            assert.equal(C.fieldRules(v).version, v, `fieldRules(${v}) silently fell back to v${C.fieldRules(v).version}`);
        }
        assert.truthy(newV <= maxV, 'new battles must not be stamped above the supported maximum');
        assert.equal(C.fieldRules(newV).version, newV,
            'the version new battles are stamped with must be one the client can actually draw');
    });

    test('an unknown version falls back rather than throwing', () => {
        // Probe past the highest version the CLIENT knows. The client may run
        // ahead of the server while a field version is being rolled out (v4
        // landed here before the server was allowed to stamp it), so
        // server-max + 1 is not necessarily unknown.
        const clientMax = Math.max(...Object.keys(C.FIELD_RULES).map(Number));
        assert.equal(C.fieldRules(clientMax + 1).version, 1, 'a future version must degrade to v1, not crash');
    });
});

suite('drift: the damage clamp', () => {
    // turn.js re-types the damage formula because it cannot import battlecalc.
    // If shotDamage() changes and the clamp does not, the server either
    // rejects legitimate hits or lets a tampered client claim inflated ones.
    test('the server clamp uses the same numbers as shotDamage()', () => {
        const m = turnSrc.match(/\(([\d.]+) \+ ([\d.]+) \* Math\.max\(1, level \|\| 1\)\)/);
        assert.truthy(m, 'could not find the re-typed damage formula in turn.js');
        const base = +m[1], perLevel = +m[2];
        // Recover the client's own coefficients from the function itself.
        const at1 = C.shotDamage(1), at101 = C.shotDamage(101);
        const clientPerLevel = (at101 - at1) / 100;
        const clientBase = at1 - clientPerLevel;
        assert.equal(base, +clientBase.toFixed(6), 'damage base differs from shotDamage()');
        assert.equal(perLevel, +clientPerLevel.toFixed(6), 'per-level damage differs from shotDamage()');
    });

    test('the clamp multiplier matches the client maximum', () => {
        const m = turnSrc.match(/\* ([\d.]+)\);/);
        assert.truthy(m, 'direct-hit multiplier not found in turn.js');
        // maxTurnDamage(shots, level) on the client uses the same 1.5.
        const expected = C.maxTurnDamage(1, 100) / Math.ceil(C.shotDamage(100));
        assert.truthy(Math.abs(+m[1] - 1.5) < 1e-9, `server multiplier ${m[1]} is not 1.5`);
        assert.truthy(expected > 1, 'client maxTurnDamage should exceed a single plain hit');
    });
});

suite('drift: the relay worker', () => {
    // battle-worker is a SEPARATE deploy. It allowlists message types and
    // emoji; anything the client sends that is missing there is dropped in
    // silence — the opponent simply never sees it.
    test('the worker relays every message type the client sends', () => {
        const clientTypes = [...linkSrc.matchAll(/_send\(\{\s*t:\s*'([a-z]+)'/g)].map(m => m[1]);
        assert.truthy(clientTypes.length >= 4, `only found ${clientTypes.length} client message types`);
        const allow = workerSrc.match(/RELAY_TYPES = new Set\(\[([^\]]+)\]\)/);
        assert.truthy(allow, 'worker RELAY_TYPES not found');
        const relayed = (allow[1].match(/'[^']+'/g) || []).map(s => s.slice(1, -1));
        const dropped = clientTypes.filter(t => !relayed.includes(t));
        assert.equal(dropped.join(', '), '', 'the worker would silently drop these client messages');
    });

    test('the worker accepts exactly the emoji the client offers', () => {
        const clientEmotes = gameSrc.match(/\[('(?:[^']+)',\s*)+'[^']+'\]\.map\(e =>/);
        assert.truthy(clientEmotes, 'client emote list not found');
        const client = (clientEmotes[0].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));
        const workerSet = workerSrc.match(/EMOTES = new Set\(\[([^\]]+)\]\)/);
        assert.truthy(workerSet, 'worker EMOTES not found');
        const worker = (workerSet[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));
        const dropped = client.filter(e => !worker.includes(e));
        const orphan = worker.filter(e => !client.includes(e));
        assert.equal(dropped.join(' '), '', 'these emoji would never reach the opponent');
        assert.equal(orphan.join(' '), '', 'the worker allows emoji the client cannot send');
        assert.equal(client.length, worker.length);
    });
});

// ---- the pet -------------------------------------------------------------
// DOG_STAGES (js/home.js) decides which breed a level maps to. petart.js keeps
// TWO parallel tables keyed by the same stageCss, and both fall back to
// chihuahua on a miss — so a breed added to DOG_STAGES alone would render a
// level-200 Diamond Dog as a chihuahua, with nothing thrown and nothing logged.
//
// tests/petart.test.js derives its breed list from PET_BREED_LOOKS itself, so
// it can only ever prove that table matches itself. These anchor to
// DOG_STAGES, which is where a new breed actually gets added.
suite('drift: pet breeds', () => {
    const { loadAppCode } = require('./setup');
    const env = loadAppCode();
    const art = require(path.join(ROOT, 'js', 'petart.js'));
    const stages = env.DOG_STAGES;

    test('DOG_STAGES is the source of truth and is well formed', () => {
        assert.truthy(Array.isArray(stages) && stages.length >= 10, 'DOG_STAGES missing');
        assert.equal(new Set(stages.map(s => s.stageCss)).size, stages.length, 'duplicate stageCss');
    });

    test('every breed has art AND an accent, not a silent chihuahua', () => {
        for (const st of stages) {
            assert.truthy(art.PET_BREED_LOOKS[st.stageCss],
                `breed "${st.stageCss}" would silently render as a chihuahua`);
            assert.truthy(art.PET_STAGE_ACCENT[st.stageCss],
                `breed "${st.stageCss}" has no accent colour and would fall back`);
        }
    });

    test('the art tables carry no breeds DOG_STAGES never awards', () => {
        const known = new Set(stages.map(s => s.stageCss));
        for (const table of ['PET_BREED_LOOKS', 'PET_STAGE_ACCENT']) {
            const orphans = Object.keys(art[table]).filter(k => !known.has(k));
            assert.equal(orphans.join(', '), '', `${table} has keys no level can reach — likely a typo`);
        }
    });

    test('stage thresholds ascend, because getDogStage scans backwards', () => {
        assert.equal(stages[0].minLevel, 1, 'a level-1 pet must match the first stage');
        for (let i = 1; i < stages.length; i++) {
            assert.truthy(stages[i].minLevel > stages[i - 1].minLevel,
                `minLevel ${stages[i].minLevel} does not follow ${stages[i - 1].minLevel} — the wrong breed would be picked`);
        }
    });

    test('every breed image is actually shipped', () => {
        const missing = stages.filter(s => s.img && !fs.existsSync(path.join(ROOT, s.img)));
        assert.equal(missing.map(s => s.img).join(', '), '', 'breed art referenced but not shipped');
    });

    // Levelling up offline is exactly when a child is most likely to be
    // offline — on a plane, in a car — so the reward must not 404.
    test('every breed image is precached by the service worker', () => {
        const sw = read('sw.js');
        const uncached = stages.filter(s => s.img && !sw.includes("'/" + s.img + "'"));
        assert.equal(uncached.map(s => s.img).join(', '), '',
            'breed art not in the service-worker cache — the pet would vanish offline');
    });

    // The opponent's breed arrives over the network, so it may be a breed this
    // build has never heard of. That must degrade, not break.
    test('an unknown breed from the network degrades safely', () => {
        assert.equal(art.petBreedLook('breed-from-a-newer-app'), art.PET_BREED_LOOKS.chihuahua);
        assert.equal(art.petStageAccent('breed-from-a-newer-app'), art.PET_STAGE_ACCENT.chihuahua);
    });
});

// ---- the cup cabinet -------------------------------------------------------
suite('drift: cup tiers', () => {
    const cups = require(path.join(ROOT, 'js', 'cups.js'));

    // CUP_LOOK[tier].icon has NO fallback, so a tier missing from it throws
    // inside renderCupCabinet() and takes the whole Profile screen with it.
    test('every tier has a look and a name', () => {
        for (const tier of cups.CUP_TIERS) {
            assert.truthy(cups.CUP_LOOK[tier], `CUP_LOOK["${tier}"] missing — the Profile screen would throw`);
            assert.truthy(cups.CUP_NAME[tier], `CUP_NAME["${tier}"] missing`);
        }
        assert.equal(Object.keys(cups.CUP_LOOK).length, cups.CUP_TIERS.length);
    });

    test('tier worths follow the merge rule', () => {
        // 5 cups = 1 ruby, 5 ruby = 1 diamond. If a worth drifts from the
        // merge constant, the lifetime total silently stops adding up.
        const [a, b, c] = cups.CUP_TIERS;
        assert.equal(cups.CUP_LOOK[a].worth, 1);
        assert.equal(cups.CUP_LOOK[b].worth, cups.CUP_MERGE);
        assert.equal(cups.CUP_LOOK[c].worth, cups.CUP_MERGE * cups.CUP_MERGE);
    });
});

// ---- grade 4 ---------------------------------------------------------------
// The unit list is DERIVED from the word bank rather than declared twice, so
// it cannot drift by construction. These tests protect that property and the
// data it depends on.
suite('drift: grade 4 units', () => {
    const unitsSrc = read('js/units.js');

    test('the unit list is derived from the bank, never hardcoded', () => {
        const fn = unitsSrc.slice(unitsSrc.indexOf('function unitsList'), unitsSrc.indexOf('// \'mix\' draws'));
        assert.truthy(fn.includes('unitsBank()'), 'unitsList must read the data');
        assert.falsy(/\[\s*1\s*,\s*2\s*,/.test(fn), 'a hardcoded unit list would drift from the words');
    });

    test('every unit in the bank has words behind its card', () => {
        // units.js reads UNIT_WORDS off the global, the way the browser does.
        const { UNIT_WORDS } = require(path.join(ROOT, 'js', 'units-data.js'));
        global.UNIT_WORDS = UNIT_WORDS;
        const units = require(path.join(ROOT, 'js', 'units.js'));
        const list = units.unitsList();
        assert.truthy(list.length >= 12, `only ${list.length} units`);
        for (const u of list) {
            assert.truthy(units._unitPool(u).length > 0, `Unit ${u} renders a card with no words`);
        }
        // Mix must see the whole bank, or "12 units" is a lie.
        assert.equal(units._unitPool('mix').length, UNIT_WORDS.length);
    });

    test('the mastery target is read from the constant, not retyped', () => {
        const render = unitsSrc.slice(unitsSrc.indexOf('function renderUnitsBar'), unitsSrc.indexOf('// ---- celebration'));
        assert.truthy(render.includes('UNIT_MASTERY_TARGET'), 'the card must use the constant');
        assert.falsy(/\$\{perfect\}\/10 /.test(render), 'a hardcoded 10 would drift from the rule');
    });
});

// ---- grammar ---------------------------------------------------------------
suite('drift: grammar units and lessons', () => {
    const { loadAppCode } = require('./setup');
    const env = loadAppCode();
    const unitIds = (env.GRAMMAR_UNITS || []).map(u => u.id);
    const lessonIds = (env.GRAMMAR_LESSONS || []).map(u => u.unitId);

    // Questions live in grammar-units.js, theory in grammar-lessons.js. A unit
    // in one and not the other means either a lesson card with nothing to
    // practise, or practice with no explanation behind it.
    test('every unit with questions has a lesson, and every lesson has a unit', () => {
        assert.truthy(unitIds.length >= 13, `only ${unitIds.length} units`);
        assert.equal(unitIds.filter(u => !lessonIds.includes(u)).join(', '), '',
            'units with questions but no lesson card');
        assert.equal(lessonIds.filter(l => !unitIds.includes(l)).join(', '), '',
            'lesson cards with no questions behind them');
    });

    // tests/grammar-all-units.test.js runs deep per-unit checks against a
    // HAND-MAINTAINED list. unit13 is legitimately outside it — it is the Exam
    // unit, with no textbook PDF refs and a different topic structure — but
    // nothing recorded that the exclusion was deliberate rather than forgotten.
    // A unit14 added tomorrow must land in one bucket or the other on purpose.
    const DEEP_CHECKED = ['unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit6',
        'unit7', 'unit8', 'unit9', 'unit10', 'unit11', 'unit12'];
    const DELIBERATELY_EXCLUDED = {
        unit13: 'the Exam unit: mixed revision, no textbook page refs, no per-unit topic syllabus',
    };

    test('every unit is either deep-checked or excluded on purpose', () => {
        const unaccounted = unitIds.filter(u => !DEEP_CHECKED.includes(u) && !(u in DELIBERATELY_EXCLUDED));
        assert.equal(unaccounted.join(', '), '',
            'new grammar unit is in neither the deep-check list nor the documented exclusions');
    });

    test('the deep-check list names only units that exist', () => {
        assert.equal(DEEP_CHECKED.filter(u => !unitIds.includes(u)).join(', '), '',
            'the deep-check list references units that were removed');
        // …and it must match the list the other suite actually iterates.
        const other = read('tests/grammar-all-units.test.js').match(/const ALL_UNIT_IDS = \[([^\]]+)\]/);
        assert.truthy(other, 'ALL_UNIT_IDS not found in grammar-all-units.test.js');
        const theirs = (other[1].match(/'[^']+'/g) || []).map(x => x.slice(1, -1));
        assert.equal(theirs.join(','), DEEP_CHECKED.join(','),
            'the two lists have drifted — this guard would be checking the wrong thing');
    });
});

// ---- exam ------------------------------------------------------------------
suite('drift: exam questions and the renderer', () => {
    const vm = require('vm');
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(read('js/exam-data.js') + '\nthis.EXAMS = EXAMS;', ctx);
    const exams = ctx.EXAMS;
    const examUi = read('js/exam.js');

    // The renderer names 'text' explicitly and sends everything else down the
    // options[q.correct] path. A new type added to the data would therefore
    // not be "unhandled" — it would be silently treated as multiple-choice and
    // throw on a missing options array.
    const RENDERABLE = ['mcq', 'tf', 'text'];

    test('the data uses only types the renderer can actually draw', () => {
        const seen = new Set();
        for (const e of exams) for (const q of (e.questions || [])) seen.add(q.type);
        const unknown = [...seen].filter(t => !RENDERABLE.includes(t));
        assert.equal(unknown.join(', '), '',
            'these types fall through to the multiple-choice path and would throw');
    });

    test('the renderer still special-cases text, or typed answers break', () => {
        assert.truthy(examUi.includes("q.type === 'text'"), 'typed answers need their own branch');
    });

    test('every option-based question can survive that path', () => {
        const broken = [];
        for (const e of exams) {
            for (const q of (e.questions || [])) {
                if (q.type === 'text') continue;
                if (!Array.isArray(q.options) || q.options.length === 0) { broken.push(`${e.id} q${q.n}: no options`); continue; }
                if (!(q.correct >= 0 && q.correct < q.options.length)) broken.push(`${e.id} q${q.n}: correct=${q.correct} of ${q.options.length}`);
            }
        }
        assert.equal(broken.slice(0, 5).join(' | '), '', 'options[q.correct] would be undefined');
    });

    test('exam ids are unique, because history keys on them', () => {
        const ids = exams.map(e => e.id);
        assert.equal(new Set(ids).size, ids.length, 'a duplicate id would merge two exams histories');
    });
});

// ---- activity sync ---------------------------------------------------------
suite('drift: every practice module reaches the admin dashboard', () => {
    // _localHistoryItems() in js/auth.js enumerates each module's history by
    // hand. A new tab that forgets to add itself syncs NOTHING — the child's
    // work simply never appears in the dashboard, with no error anywhere.
    // This derives the list from the app instead of trusting a second copy.
    const EXCLUDED = {
        battleHistory: 'the older local word-matching mode, not a practice session',
        petBattleHistory: 'battles are already recorded server-side in the battles table',
    };

    test('no practice history is silently left out of the sync', () => {
        const found = new Set();
        for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
            const src = read('js/' + f);
            for (const m of src.matchAll(/appState\.([a-zA-Z]*[Hh]istory)\b/g)) found.add(m[1]);
        }
        const auth = read('js/auth.js');
        const synced = new Set([...auth.matchAll(/appState\.([a-zA-Z]*[Hh]istory)\b/g)].map(m => m[1]));
        const missing = [...found].filter(h => !synced.has(h) && !(h in EXCLUDED));
        assert.equal(missing.join(', '), '',
            'this history never syncs — the child\'s work would be invisible to the dashboard');
    });

    test('the exclusions still exist, so the list cannot rot', () => {
        const all = read('js/auth.js') + Object.keys(EXCLUDED).map(k => k).join(' ');
        for (const key of Object.keys(EXCLUDED)) {
            const used = fs.readdirSync(path.join(ROOT, 'js'))
                .some(f => f.endsWith('.js') && read('js/' + f).includes('appState.' + key));
            assert.truthy(used, `${key} is excluded from sync but no longer exists — drop the exclusion`);
        }
    });
});

// ---- friends ---------------------------------------------------------------
// js/friends.js reads fields straight off the API response. A renamed field
// does not throw — `undefined` renders as an empty list or a zero, so the
// Friends tab would calmly report "Chưa có bạn nào" to a child who has five.
suite('drift: the friends API contract', () => {
    const listSrc = read('functions/api/friends/index.js');
    const actSrc = read('functions/api/friends/activity.js');
    const respondSrc = read('functions/api/friends/respond.js');
    const client = read('js/friends.js');

    test('the list response still has the three arrays the client destructures', () => {
        assert.truthy(client.includes('const { friends, incoming, outgoing } = _friendsData'),
            'client no longer destructures the list — update this guard');
        assert.truthy(/return json\(\{ friends, incoming, outgoing \}\)/.test(listSrc),
            'the endpoint must return exactly those three arrays');
    });

    test('each friendship entry carries every field the rows render', () => {
        const entry = listSrc.match(/const entry = \{([^}]+)\}/);
        assert.truthy(entry, 'friendship entry literal not found');
        for (const field of ['friendshipId', 'userId', 'username']) {
            assert.truthy(entry[1].includes(field), `entry is missing ${field}`);
            assert.truthy(client.includes('.' + field), `client no longer reads ${field} — update this guard`);
        }
    });

    // The summary is what turns a friend row from a name into a reason to
    // care. Every key is read directly in the row markup.
    test('the friend summary returns the keys the card shows', () => {
        const fn = listSrc.slice(listSrc.indexOf('async function summaryFor'), listSrc.indexOf('// GET /api/friends'));
        for (const key of ['sessions', 'correct', 'daysThisWeek']) {
            assert.truthy(new RegExp(key + ':').test(fn), `summaryFor no longer returns ${key}`);
            assert.truthy(client.includes('s.' + key), `client no longer reads s.${key}`);
        }
    });

    test('the activity response aliases match what the card reads', () => {
        // SQL aliases ARE the API here — renaming one is a silent break.
        for (const alias of ['day', 'sessions', 'correct', 'total', 'perfects']) {
            assert.truthy(new RegExp('AS ' + alias + '\\b').test(actSrc), `activity SQL no longer aliases ${alias}`);
        }
        assert.truthy(/return json\(\{[\s\S]*user:[\s\S]*byDay:[\s\S]*bySkill:[\s\S]*totals:/.test(actSrc),
            'the activity payload lost one of the four sections the card renders');
        for (const key of ['d.byDay', 'd.bySkill', 'd.totals', 'd.user.username']) {
            assert.truthy(client.includes(key), `client no longer reads ${key} — update this guard`);
        }
    });

    test('invite and respond both return the status the client branches on', () => {
        assert.truthy(client.includes("r.data.status === 'accepted'"), 'client branches on status');
        assert.truthy(listSrc.includes("status: 'accepted'"), 'inviting an inviter must report acceptance');
        assert.truthy(/return json\(\{ ok: true, status \}\)/.test(respondSrc), 'respond must echo the new status');
    });
});

// ---- cups ------------------------------------------------------------------
suite('drift: cup tiers have distinct art', () => {
    const cups = require(path.join(ROOT, 'js', 'cups.js'));
    const css = read('css/styles.css');

    // All three tiers draw the SAME 🏆 glyph and are told apart only by a CSS
    // filter. A tier whose class has no styles is not subtly wrong — it is
    // indistinguishable from the tier below it.
    test('every tier class is actually styled', () => {
        for (const tier of cups.CUP_TIERS) {
            const cls = cups.CUP_LOOK[tier].cls;
            assert.truthy(css.includes('.' + cls + ' '), `.${cls} has no styles — this tier would look identical to the others`);
            assert.truthy(css.includes('.' + cls + '-shelf'), `.${cls}-shelf has no styles`);
        }
    });

    test('the tiers grow, so the shelf reads as a ladder', () => {
        const sizes = cups.CUP_TIERS.map(t => cups.CUP_LOOK[t].size);
        for (let i = 1; i < sizes.length; i++) {
            assert.truthy(sizes[i] > sizes[i - 1], `tier ${cups.CUP_TIERS[i]} is not drawn larger than the one below`);
        }
    });
});

suite('drift: the username rule', () => {
    // Already pinned in tests/username.test.js; asserted here too so the whole
    // cross-boundary inventory lives in one place.
    test('the client and the register endpoint share one pattern', () => {
        const srv = read('functions/api/register.js').match(/(\/\^\[[^\n]*?\/u)\.test\(username\)/);
        const cli = read('js/auth.js').match(/const USERNAME_RE = (\/\^\[[^\n]*?\/u);/);
        assert.truthy(srv && cli, 'username pattern missing on one side');
        assert.equal(cli[1], srv[1], 'the username rule differs between client and server');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
