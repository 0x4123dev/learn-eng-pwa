// tests/math-board.test.js — bảng nháp: pure state first, painter contracts later.
// The harness is synchronous; every test here is a plain sync function.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const board = require(path.join(root, 'js', 'math-board.js'));

suite('math board: strokes', () => {
    test('a stroke begins with its first point and grows point by point', () => {
        const b = { strokes: [], scrollY: 0 };
        const s = board.mathBoardBegin(b, 10, 20);
        assert.equal(b.strokes.length, 1);
        assert.deepEqual(s.points, [{ x: 10, y: 20 }]);
        assert.equal(board.mathBoardExtend(s, 14, 24), true);
        assert.deepEqual(s.points[1], { x: 14, y: 24 });
    });

    test('jitter closer than 2px is filtered out, so ink stays smooth', () => {
        const b = { strokes: [], scrollY: 0 };
        const s = board.mathBoardBegin(b, 10, 10);
        assert.equal(board.mathBoardExtend(s, 11, 10), false, '1px is a tremor, not a move');
        assert.equal(s.points.length, 1);
        assert.equal(board.mathBoardExtend(s, 13, 10), true, '3px is a real move');
    });

    test('undo removes exactly the last stroke; clear empties the board', () => {
        const b = { strokes: [], scrollY: 0 };
        board.mathBoardBegin(b, 1, 1);
        const s2 = board.mathBoardBegin(b, 2, 2);
        assert.equal(board.mathBoardUndo(b), s2);
        assert.equal(b.strokes.length, 1);
        board.mathBoardClear(b);
        assert.equal(b.strokes.length, 0);
        assert.equal(board.mathBoardUndo(b), null, 'undo on empty board is a no-op');
    });
});

suite('math board: session and boards', () => {
    test('a session starts with one empty board and remembers it', () => {
        board.mathBoardReset();
        const s = board.mathBoardSession();
        assert.equal(s.boards.length, 1);
        assert.equal(s.active, 0);
        assert.equal(s.open, false);
        assert.equal(board.mathBoardSession(), s, 'same session on every call');
    });

    test('adding boards caps at 3 and switches to the new board', () => {
        board.mathBoardReset();
        assert.equal(board.mathBoardAdd(), 1);
        assert.equal(board.mathBoardAdd(), 2);
        assert.equal(board.mathBoardAdd(), -1, 'fourth board refused');
        assert.equal(board.mathBoardSession().boards.length, 3);
        assert.equal(board.mathBoardSession().active, 2);
    });

    test('switching boards keeps each board\'s ink and scroll position', () => {
        board.mathBoardReset();
        const s = board.mathBoardSession();
        board.mathBoardBegin(s.boards[0], 5, 5);
        s.boards[0].scrollY = 120;
        board.mathBoardAdd();                       // now on bảng 2
        assert.equal(board.mathBoardActive().strokes.length, 0);
        board.mathBoardSwitch(0);                   // back to bảng 1
        assert.equal(board.mathBoardActive().strokes.length, 1);
        assert.equal(board.mathBoardActive().scrollY, 120);
        assert.equal(board.mathBoardSwitch(9), 0, 'bad index is a no-op');
    });

    test('reset throws the whole session away — a fresh quiz gets fresh paper', () => {
        board.mathBoardSession();
        board.mathBoardAdd();
        board.mathBoardReset();
        assert.equal(board.mathBoardSession().boards.length, 1);
    });
});

suite('math board: gesture machine — 1 ngón viết, 2 ngón cuộn', () => {
    function freshBoard() { board.mathBoardReset(); return board.mathBoardActive(); }

    test('one finger draws: down begins a stroke in world coords, move extends it', () => {
        const b = freshBoard();
        b.scrollY = 100;
        const g = board.mathBoardGesture();
        assert.equal(board.mathBoardPointerDown(g, b, 1, 10, 20), 'ink-start');
        assert.deepEqual(b.strokes[0].points[0], { x: 10, y: 120 }, 'y is screen + scroll');
        assert.equal(board.mathBoardPointerMove(g, b, 1, 30, 40), 'ink');
        assert.deepEqual(b.strokes[0].points[1], { x: 30, y: 140 });
        assert.equal(board.mathBoardPointerUp(g, b, 1), 'ink-end');
    });

    test('a second finger cancels the half-drawn stroke and turns into a pan', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 300);
        board.mathBoardPointerMove(g, b, 1, 10, 305);
        assert.equal(board.mathBoardPointerDown(g, b, 2, 60, 300), 'pan-start');
        assert.equal(b.strokes.length, 0, 'the accidental stroke is gone');
        assert.equal(board.mathBoardPointerMove(g, b, 1, 10, 200), 'pan');
        assert.equal(b.scrollY, 105, 'finger up 105px ⇒ sheet scrolls down 105px');
    });

    test('pan clamps at the top of the sheet — no negative scroll', () => {
        const b = freshBoard();
        b.scrollY = 30;
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 100);
        board.mathBoardPointerDown(g, b, 2, 60, 100);
        board.mathBoardPointerMove(g, b, 1, 10, 400);  // drag far downward
        assert.equal(b.scrollY, 0, 'clamped, not -270');
    });

    test('lifting fingers ends the pan; the NEXT single finger inks again', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 100);
        board.mathBoardPointerDown(g, b, 2, 60, 100);
        board.mathBoardPointerUp(g, b, 2);
        assert.equal(board.mathBoardPointerMove(g, b, 1, 10, 50), 'pan',
            'the surviving finger of a pan never turns back into ink mid-gesture');
        board.mathBoardPointerUp(g, b, 1);
        assert.equal(board.mathBoardPointerDown(g, b, 3, 5, 5), 'ink-start');
    });

    test('pointercancel (incoming call) ends the stroke without corrupting state', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 10);
        assert.equal(board.mathBoardPointerCancel(g, b, 1), 'ink-end');
        assert.equal(b.strokes.length, 1, 'what was drawn stays drawn');
        assert.equal(board.mathBoardPointerDown(g, b, 2, 5, 5), 'ink-start');
    });

    test('aborting mid-stroke stops the finger from inking into a detached stroke', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 10);
        board.mathBoardUndo(b);              // the toolbar yanks the stroke away
        board.mathBoardAbort(g);
        assert.equal(board.mathBoardPointerMove(g, b, 1, 40, 40), 'none',
            'the finger must not keep feeding an orphaned stroke');
        assert.equal(b.strokes.length, 0);
    });

    test('overscrolling past the top does not steal the way back down', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 100);
        board.mathBoardPointerDown(g, b, 2, 60, 100);
        board.mathBoardPointerMove(g, b, 1, 10, 400);   // drag 300px past the top
        assert.equal(b.scrollY, 0, 'nothing above the first line to show');
        board.mathBoardPointerMove(g, b, 1, 10, 100);   // finger back where it started
        assert.equal(b.scrollY, 0, 'sheet is back where it started too, not 300px away');
    });

    test('when the steering finger leaves, a survivor takes over without a jump', () => {
        const b = freshBoard(); b.scrollY = 500;
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 100);   // lead
        board.mathBoardPointerDown(g, b, 2, 60, 300);   // survivor, resting 200px lower
        board.mathBoardPointerUp(g, b, 1);              // the lead lifts mid-pan
        assert.equal(board.mathBoardPointerMove(g, b, 2, 60, 290), 'pan', 'survivor now steers');
        assert.equal(b.scrollY, 510, 'delta is from the survivor\'s own y, not the old lead\'s');
    });

    test('both fingers moving still scrolls once, not twice', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 300);
        board.mathBoardPointerDown(g, b, 2, 60, 300);
        board.mathBoardPointerMove(g, b, 1, 10, 250);
        assert.equal(board.mathBoardPointerMove(g, b, 2, 60, 250), 'none',
            'only the steering finger moves the sheet — otherwise it scrolls at 2x');
        assert.equal(b.scrollY, 50);
    });

    test('a cancelled finger during a pan does not wedge the board', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 100);
        board.mathBoardPointerDown(g, b, 2, 60, 100);
        board.mathBoardPointerCancel(g, b, 1);
        board.mathBoardPointerCancel(g, b, 2);
        assert.equal(board.mathBoardPointerDown(g, b, 5, 5, 5), 'ink-start',
            'after every finger is cancelled the next tap writes again');
    });

    test('many small moves scroll exactly as far as one big move', () => {
        const run = (steps) => {
            const b = freshBoard();
            const g = board.mathBoardGesture();
            board.mathBoardPointerDown(g, b, 1, 10, 1000);
            board.mathBoardPointerDown(g, b, 2, 60, 1000);
            let y = 1000;
            for (let i = 0; i < steps; i++) { y -= 100 / steps; board.mathBoardPointerMove(g, b, 1, 10, y); }
            return b.scrollY;
        };
        assert.equal(run(10), run(1),
            'getCoalescedEvents replays a move as many sub-moves — they must not drift');
    });
});

suite('math board: painter', () => {
    test('only strokes whose y-range crosses the viewport are redrawn', () => {
        const mk = (y1, y2) => ({ points: [{ x: 0, y: y1 }, { x: 5, y: y2 }] });
        const strokes = [mk(0, 50), mk(400, 450), mk(900, 950)];
        const vis = board.mathBoardVisibleStrokes(strokes, 380, 300); // viewport 380..680
        assert.deepEqual(vis, [strokes[1]], 'stroke above and stroke below are skipped');
        assert.deepEqual(board.mathBoardVisibleStrokes(strokes, 40, 300), [strokes[0]],
            'a stroke straddling the top edge still draws');
        assert.deepEqual(board.mathBoardVisibleStrokes(strokes, 0, 420), [strokes[0], strokes[1]],
            'and one straddling the bottom edge draws too');
    });

    test('a stroke renders as midpoint quadratics with round caps, offset by scroll', () => {
        const calls = [];
        const ctx = new Proxy({}, {
            get: (t, k) => {
                if (k === 'set') return undefined;
                return (...a) => { calls.push([k, ...a]); };
            },
            set: (t, k, v) => { calls.push(['set:' + k, v]); return true; }
        });
        const pts = [{ x: 0, y: 100 }, { x: 10, y: 110 }, { x: 20, y: 120 }];
        board.mathBoardDrawStroke(ctx, pts, 100);
        assert.truthy(calls.some(c => c[0] === 'set:lineCap' && c[1] === 'round'), 'round cap');
        assert.truthy(calls.some(c => c[0] === 'moveTo' && c[2] === 0), 'starts at y − scroll');
        assert.truthy(calls.some(c => c[0] === 'quadraticCurveTo'), 'curves, not polylines');
        assert.truthy(calls.some(c => c[0] === 'stroke'));
    });

    test('a dot (tap without moving) still leaves a visible mark', () => {
        const calls = [];
        const ctx = new Proxy({}, {
            get: (t, k) => (...a) => { calls.push([k, ...a]); },
            set: () => true
        });
        board.mathBoardDrawStroke(ctx, [{ x: 5, y: 5 }], 0);
        assert.truthy(calls.some(c => c[0] === 'arc'), 'single point draws a filled dot');
    });
});

suite('math board: overlay wiring', () => {
    test('the browser layer keeps its handwriting-quality contracts', () => {
        const src = read('js/math-board.js');
        assert.truthy(/touch-action:\s*none/.test(src) || /touchAction\s*=\s*'none'/.test(src),
            'canvas must own every touch — no browser scroll fights');
        assert.truthy(/getCoalescedEvents/.test(src), 'coalesced samples or iOS ink has gaps');
        assert.truthy(/devicePixelRatio/.test(src), 'retina-crisp backing store');
        assert.truthy(/setPointerCapture/.test(src), 'strokes survive leaving the canvas');
        assert.truthy(/pointercancel/.test(src), 'incoming call must not wedge the gesture');
    });

    test('the quiz screen offers the ✏️ scratch-board button', () => {
        assert.truthy(/math-board-fab/.test(read('js/math.js')),
            'renderMathQuestion must render the board fab');
        assert.truthy(/openMathBoard\(\)/.test(read('js/math.js')));
    });

    test('boards die with the quiz session, both endings', () => {
        const src = read('js/math.js');
        const finish = src.slice(src.indexOf('function finishMathQuiz'));
        const abandon = src.slice(src.indexOf('function abandonMathQuiz'));
        assert.truthy(/mathBoardReset/.test(finish.slice(0, finish.indexOf('\n}') + 2)),
            'finishMathQuiz must reset the scratch boards');
        assert.truthy(/mathBoardReset/.test(abandon.slice(0, abandon.indexOf('\n}') + 2)),
            'abandonMathQuiz must reset the scratch boards');
    });

    test('overlay ships: index.html mounts it and loads the script', () => {
        const html = read('index.html');
        assert.truthy(/id="mathBoardOverlay"/.test(html));
        assert.truthy(/js\/math-board\.js/.test(html));
        const mathIdx = html.indexOf('js/math.js');
        const boardIdx = html.indexOf('js/math-board.js');
        assert.truthy(boardIdx > mathIdx, 'board script loads after math.js (it calls mathFormula)');
    });

    test('toolbar: undo, xoá with a second-tap confirm, chips capped by MAX, minimize', () => {
        const src = read('js/math-board.js');
        assert.truthy(/mathBoardUndoTap/.test(src));
        assert.truthy(/Chắc chưa\?/.test(src), 'clear asks before wiping — kid-proofing');
        assert.truthy(/MATH_BOARD_MAX/.test(src.slice(src.indexOf('function mathBoardChipsHTML'))),
            'the + chip must respect the 3-board cap');
        assert.truthy(/minimizeMathBoard/.test(src));
    });

    test('the pinned strip shows the current question through mathFormula', () => {
        const src = read('js/math-board.js');
        assert.truthy(/mathCurrentQuestion/.test(src));
        assert.truthy(/mathFormula\(/.test(src));
        assert.truthy(/mathCurrentQuestion/.test(read('js/math.js')), 'helper lives in math.js');
    });

    test('a toolbar tap during a stroke aborts the gesture, never orphans ink', () => {
        const src = read('js/math-board.js');
        const tapFns = src.slice(src.indexOf('window.mathBoardUndoTap'));
        assert.truthy(/mathBoardAbort/.test(tapFns),
            'undo/xoá/switch must abort a live gesture — g.stroke would dangle otherwise');
    });

    test('a cancelled stroke is wiped from screen immediately, not on the next move', () => {
        const src = read('js/math-board.js');
        assert.truthy(/'pan-start'/.test(src),
            'pointerdown must notice pan-start and full-repaint — the deleted stroke is still painted');
    });

    test('the board survives the box changing size — rotation, URL bar, strip expand', () => {
        const src = read('js/math-board.js');
        assert.truthy(/ResizeObserver/.test(src) && /orientationchange/.test(src),
            'a canvas whose bitmap stops matching its box draws ink away from the finger');
    });

    test('the destructive-clear confirm cannot survive the button being rebuilt', () => {
        const src = read('js/math-board.js');
        const render = src.slice(src.indexOf('function mathBoardRenderOverlay'));
        assert.truthy(/_mathBoardClearArmed = 0/.test(render.slice(0, render.indexOf('\n    }'))),
            'a re-render must disarm, or one tap wipes a board that looked unarmed');
    });

    test('ending the quiz closes the overlay, not just the session state', () => {
        assert.truthy(/mathBoardCloseForSession/.test(read('js/math-board.js')));
        const m = read('js/math.js');
        assert.truthy((m.match(/mathBoardCloseForSession/g) || []).length >= 2,
            'both finishMathQuiz and abandonMathQuiz must close the overlay');
    });
});

// Three defects that only showed up when the board was run in a real browser.
// None of them can fail a unit test — they are pinned here so a later edit
// cannot quietly undo them.
suite('math board: what the browser found', () => {
    test('the canvas can SHRINK, not just grow', () => {
        const css = read('css/styles.css');
        const rule = css.slice(css.indexOf('#mathBoardCanvas'));
        assert.truthy(/min-height:\s*0/.test(rule.slice(0, rule.indexOf('}'))),
            'a canvas is a replaced element: without min-height 0 the default ' +
            'min-height:auto pins it to its bitmap, so a shorter sheet (rotation, ' +
            'expanded question) overflows under the nav and the ink drifts');
    });

    test('a refused pointer capture cannot swallow the whole stroke', () => {
        const src = read('js/math-board.js');
        assert.truthy(/try\s*{\s*canvas\.setPointerCapture\([^)]*\);\s*}\s*catch/.test(src),
            'setPointerCapture throws NotFoundError when the pointer is already ' +
            'gone; uncaught, it skips the rest of pointerdown and the tap draws nothing');
    });

    test('expanding the question resizes the sheet without waiting for an observer', () => {
        const src = read('js/math-board.js');
        assert.truthy(/mathBoardStripTap/.test(src), 'the strip tap must be a real handler');
        const fn = src.slice(src.indexOf('window.mathBoardStripTap'));
        assert.truthy(/mathBoardResize\(\)/.test(fn.slice(0, fn.indexOf('};'))),
            'resize on the tap we own — some engines never deliver ResizeObserver');
    });

    test('every toolbar button carries a word, not just an emoji', () => {
        const src = read('js/math-board.js');
        const tools = src.slice(src.indexOf('math-board-tools'), src.indexOf('mathBoardCanvas"></canvas>'));
        const labels = (tools.match(/>([^<>]+)<\/button>/g) || []).map(s => s.slice(1, -9).trim());
        assert.equal(labels.length, 3, 'undo, xoa, minimize');
        for (const l of labels) {
            assert.truthy(/[A-Za-zÀ-ỹ]/.test(l),
                `"${l}" is glyph-only — an unsupported emoji renders as a hollow box`);
        }
    });
});

// Usability pass: giấy ô ly, the gesture hint, and desktop scrolling.
suite('math board: easy to draw and use', () => {
    test('grid lines are anchored to the WORLD, so scrolling visibly moves them', () => {
        const step = board.MATH_BOARD_GRID_STEP;
        const g0 = board.mathBoardGridLines(0, 100, 100, step);
        assert.deepEqual(g0.horizontal, [step, step * 2, step * 3],
            'unscrolled: lines at every step, none at y=0 (the sheet top is an edge, not a rule)');
        const g10 = board.mathBoardGridLines(10, 100, 100, step);
        assert.equal(g10.horizontal[0], step - 10,
            'scroll 10px and every line climbs 10px — the feedback that makes 2-finger scroll discoverable');
        assert.deepEqual(g0.vertical, [step, step * 2, step * 3]);
    });

    test('the grid never doubles a line at the very top after a deep scroll', () => {
        const step = board.MATH_BOARD_GRID_STEP;
        const g = board.mathBoardGridLines(step * 5, 100, 100, step);
        assert.equal(g.horizontal[0], 0, 'a line exactly at the seam draws once at y=0');
        assert.truthy(g.horizontal.every((y, i) => i === 0 || y - g.horizontal[i - 1] === step),
            'and the spacing stays perfectly even');
    });

    test('the grid is painted before the ink, never over it', () => {
        const src = read('js/math-board.js');
        const redraw = src.slice(src.indexOf('function mathBoardRedraw'));
        const body = redraw.slice(0, redraw.indexOf('\n}'));
        assert.truthy(body.indexOf('mathBoardDrawGrid') < body.indexOf('mathBoardVisibleStrokes'),
            'grid first, strokes on top — ô ly paper under the pencil, not through it');
    });

    test('a laptop can scroll the sheet: wheel is handled, and consumed', () => {
        const src = read('js/math-board.js');
        assert.truthy(/addEventListener\('wheel'/.test(src),
            'no second finger on a trackpad — the wheel is the only scroll a desktop has');
        const wheel = src.slice(src.indexOf("addEventListener('wheel'"));
        assert.truthy(/passive:\s*false/.test(wheel.slice(0, 400)),
            'passive:false or preventDefault is ignored and the page behind pans too');
    });

    test('the first open teaches the two gestures, then gets out of the way', () => {
        const src = read('js/math-board.js');
        assert.truthy(/1 ngón viết/.test(src) && /2 ngón cuộn/.test(src),
            'the hint must name both gestures');
        assert.truthy(/mathBoardHintDismiss/.test(src.slice(src.indexOf("addEventListener('pointerdown'"))),
            'the first touch dismisses it — a hint over a working board is clutter');
        const close = src.slice(src.indexOf('window.mathBoardCloseForSession'));
        assert.truthy(/_mathBoardHintDone = false/.test(close.slice(0, close.indexOf('};'))),
            'a new quiz session earns one fresh reminder');
    });
});
