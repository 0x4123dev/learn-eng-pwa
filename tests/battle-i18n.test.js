// battle-i18n.test.js — the arena's 🇬🇧/🇻🇳 toggle.
//
// English is the default on EVERY visit and the choice is deliberately not
// persisted: this is an English-learning app, so Vietnamese is a lifeline, not
// a setting. The real risk with two languages is one drifting behind the
// other, so parity is asserted key by key.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js', 'petbattle.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
const calc = require(path.join(root, 'js', 'battlecalc.js'));

// Pull the live table + translator out of the file.
const ctx = { module: { exports: {} } };
vm.createContext(ctx);
vm.runInContext(
    src.slice(src.indexOf('let _pbLang'), src.indexOf('function _pbToken'))
    + '\nthis.PB_STR = PB_STR; this.pbT = pbT;'
    + '\nthis.setLang = (l) => { _pbLang = l; }; this.getLang = () => _pbLang;'
    + '\nfunction renderPetBattle() {}', ctx);
const { PB_STR, pbT, setLang, getLang } = ctx;

const KEYS_EN = Object.keys(PB_STR.en);
const KEYS_VI = Object.keys(PB_STR.vi);
const PLACEHOLDERS = (s) => (String(s).match(/\{[a-z]+\}/gi) || []).sort().join(',');

suite('arena language: parity between English and Vietnamese', () => {
    test('both tables exist and are substantial', () => {
        assert.truthy(KEYS_EN.length > 40, `only ${KEYS_EN.length} English strings`);
        assert.equal(KEYS_VI.length, KEYS_EN.length);
    });

    test('every English key has a Vietnamese twin', () => {
        const missing = KEYS_EN.filter(k => !(k in PB_STR.vi));
        assert.equal(missing.join(', '), '', 'untranslated keys');
    });

    test('no Vietnamese-only keys are left orphaned', () => {
        const extra = KEYS_VI.filter(k => !(k in PB_STR.en));
        assert.equal(extra.join(', '), '', 'keys with no English original');
    });

    // A translation that drops {n} silently renders a sentence with a hole.
    test('placeholders match exactly in both languages', () => {
        for (const k of KEYS_EN) {
            assert.equal(PLACEHOLDERS(PB_STR.vi[k]), PLACEHOLDERS(PB_STR.en[k]),
                `${k}: placeholders differ (en "${PB_STR.en[k]}" vs vi "${PB_STR.vi[k]}")`);
        }
    });

    test('no string is left empty in either language', () => {
        for (const k of KEYS_EN) {
            for (const lang of ['en', 'vi']) {
                assert.truthy(String(PB_STR[lang][k]).trim().length > 0, `${lang}.${k} is empty`);
            }
        }
    });

    test('the English table has no Vietnamese diacritics left in it', () => {
        const leaked = KEYS_EN.filter(k => /[ăâđêôơưàáảãạằắẳẵặèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i.test(PB_STR.en[k]));
        assert.equal(leaked.join(', '), '', 'untranslated English strings');
    });
});

suite('arena language: the toggle behaves', () => {
    test('English is the default', () => {
        assert.equal(getLang(), 'en');
        assert.equal(pbT('title'), PB_STR.en.title);
    });

    test('switching to Vietnamese changes what is rendered', () => {
        setLang('vi');
        assert.equal(pbT('histTitle'), PB_STR.vi.histTitle);
        assert.truthy(pbT('histTitle').includes('Lịch sử'));
        setLang('en');
        assert.truthy(pbT('histTitle').includes('history'));
    });

    test('an unknown language falls back to English rather than blanking', () => {
        assert.truthy(src.includes("(lang === 'vi') ? 'vi' : 'en'"), 'pbSetLang must sanitise its input');
        setLang('klingon');
        assert.equal(pbT('title'), PB_STR.en.title, 'a bad language must not empty the screen');
        setLang('en');
    });

    test('placeholders are filled, not printed', () => {
        const s = pbT('powFoot', { n: 200 });
        assert.truthy(s.includes('200'), s);
        assert.falsy(s.includes('{n}'), `placeholder left unfilled: ${s}`);
    });

    test('a missing key shows itself instead of "undefined"', () => {
        assert.equal(pbT('nope_not_a_key'), 'nope_not_a_key');
    });

    // Reopening the arena must reset to English — that is the whole point.
    test('opening the arena resets the language to English', () => {
        const fn = src.slice(src.indexOf('function openPetBattle'), src.indexOf('function closePetBattle'));
        assert.truthy(fn.includes("_pbLang = 'en'"), 'a visit must start in English');
        assert.truthy(fn.includes('_pbHistoryOpen = -1'), 'and with history collapsed');
    });

    test('the choice is never written to storage', () => {
        const lang = src.slice(src.indexOf('let _pbLang'), src.indexOf('function _pbToken'));
        assert.falsy(/localStorage|sessionStorage/.test(lang), 'the language must not persist');
    });
});

suite('arena language: every visible string goes through pbT', () => {
    // Anything still hardcoded would be stuck in one language forever.
    const renderZone = src.slice(src.indexOf('function _pbShell'));
    const VIET = /[ăâđêôơư]|Cấp|câu đúng|trận|thắng|thua|Đấu trường|Chiến|gió/i;

    test('no Vietnamese text is hardcoded in the render functions', () => {
        const offenders = renderZone.split('\n')
            .map((line, i) => ({ line: line.trim(), no: i }))
            .filter(x => !x.line.startsWith('//') && VIET.test(x.line) && !x.line.includes('pbT('));
        assert.equal(offenders.map(o => o.line).join(' | '), '', 'hardcoded Vietnamese left in the UI');
    });

    test('the flags are rendered in the header', () => {
        const shell = src.slice(src.indexOf('function _pbShell'), src.indexOf('function _pbPowerPanel'));
        assert.truthy(shell.includes("pbSetLang('en')") && shell.includes("pbSetLang('vi')"), 'both flags needed');
        assert.truthy(shell.includes('🇬🇧') && shell.includes('🇻🇳'), 'flags should be flags');
        assert.truthy(shell.includes('aria-pressed'), 'the active language must be announced');
    });

    test('the flags are styled and the active one is distinguishable', () => {
        assert.truthy(cssSrc.includes('.pb-flag'), 'no flag styles');
        assert.truthy(cssSrc.includes('.pb-flag.on'), 'the selected flag needs a distinct state');
    });
});

suite('arena language: the rules layer stayed language-free', () => {
    test('ammoBreakdown returns data the UI can phrase either way', () => {
        for (const r of calc.ammoBreakdown({ correct: 45, perfects: 2, days: 2 })) {
            assert.truthy(PB_STR.en['ammo' + r.key.charAt(0).toUpperCase() + r.key.slice(1)],
                `no English string for ammo row "${r.key}"`);
        }
    });

    test('powerProfile stats map onto translated labels', () => {
        for (const s of calc.powerProfile(50).stats) {
            const key = 'pow' + s.key.charAt(0).toUpperCase() + s.key.slice(1);
            assert.truthy(PB_STR.en[key], `no English label for power stat "${s.key}"`);
            assert.truthy(PB_STR.vi[key], `no Vietnamese label for power stat "${s.key}"`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
