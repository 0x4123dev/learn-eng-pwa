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

    test('undo removes the last stroke and can restore a cleared board', () => {
        const b = { strokes: [], scrollY: 0 };
        board.mathBoardBegin(b, 1, 1);
        const s2 = board.mathBoardBegin(b, 2, 2);
        assert.equal(board.mathBoardUndo(b), s2);
        assert.equal(b.strokes.length, 1);
        board.mathBoardClear(b);
        assert.equal(b.strokes.length, 0);
        board.mathBoardUndo(b);
        assert.equal(b.strokes.length, 1, 'an accidental clear is recoverable');
    });

    test('the whiteboard uses one fixed pen without a redundant thin-pen button', () => {
        const b = { strokes: [], scrollY: 0 };
        assert.equal(board.mathBoardBegin(b, 1, 1).width, 2.5);
        assert.deepEqual(board.MATH_BOARD_PEN_WIDTHS, [2.5]);
        assert.equal(board.MATH_BOARD_INK_WIDTH, 2.5, 'the only pen is the smallest thin stroke');
        const src = read('js/math-board.js');
        assert.falsy(/Bút mảnh|>Mảnh</.test(src),
            'the fixed-width pen does not need a button that only repeats its thickness');
        assert.truthy(/mathBoardToggleEraser/.test(src),
            'tapping the active eraser must return to writing after the pen button is removed');
    });

    test('the object eraser removes a touched stroke and Undo restores it', () => {
        const b = { strokes: [], scrollY: 0 };
        const left = board.mathBoardBegin(b, 0, 10);
        board.mathBoardExtend(left, 100, 10);
        const right = board.mathBoardBegin(b, 0, 80);
        board.mathBoardExtend(right, 100, 80);
        const g = board.mathBoardGesture();
        assert.equal(board.mathBoardPointerDown(g, b, 1, 50, 12, 'erase'), 'erase');
        assert.equal(board.mathBoardPointerUp(g, b, 1), 'erase-end');
        assert.deepEqual(b.strokes, [right], 'nearby stroke is untouched');
        board.mathBoardUndo(b);
        assert.deepEqual(b.strokes, [left, right], 'one Undo restores the erased gesture');
    });

    test('two fingers in eraser mode scroll without deleting ink', () => {
        const b = { strokes: [], scrollY: 0 };
        const stroke = board.mathBoardBegin(b, 0, 10);
        board.mathBoardExtend(stroke, 100, 10);
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 50, 10, 'erase');
        assert.equal(b.strokes.length, 0, 'first contact begins erasing');
        assert.equal(board.mathBoardPointerDown(g, b, 2, 80, 10, 'erase'), 'none');
        board.mathBoardPointerMove(g, b, 1, 50, 30);
        assert.equal(board.mathBoardPointerMove(g, b, 2, 80, 30), 'pan-start', 'both fingers moved: a scroll');
        assert.equal(b.strokes.length, 1, 'the scroll restores the tentative erase');
    });

    test('maths keys create a visible formula draft on the board, not an answer value', () => {
        const b = { strokes: [], scrollY: 120 };
        ['√', '4', '9', '=', '7'].forEach(key => board.mathBoardFormulaKeyPress(b, key, 120, 500));
        assert.equal(b.formulae.length, 1);
        assert.equal(b.formulae[0].raw, '√49=7');
        assert.equal(b.formulae[0].y, 148, 'formula starts inside the visible sheet');
        board.mathBoardFormulaNewLine(b);
        ['x', '^', '2'].forEach(key => board.mathBoardFormulaKeyPress(b, key, 120, 500));
        assert.equal(b.formulae.length, 2);
        assert.equal(b.formulae[1].raw, 'x²');
        assert.equal(b.formulae[1].y, b.formulae[0].y + 48, 'new line sits below the first');
    });

    test('undo and clear include keyboard-written formulas', () => {
        const b = { strokes: [], scrollY: 0 };
        board.mathBoardFormulaKeyPress(b, 'x', 0, 500);
        board.mathBoardUndo(b);
        assert.equal(b.formulae.length, 0, 'undo removes the latest typed line');
        board.mathBoardFormulaKeyPress(b, 'y', 0, 500);
        board.mathBoardClear(b);
        assert.equal(b.formulae.length, 0);
        board.mathBoardUndo(b);
        assert.equal(b.formulae[0].raw, 'y', 'undo restores formulae cleared with the board');
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

    test('switching boards keeps each board\'s ink and two-axis scroll position', () => {
        board.mathBoardReset();
        const s = board.mathBoardSession();
        board.mathBoardBegin(s.boards[0], 5, 5);
        s.boards[0].scrollX = 240;
        s.boards[0].scrollY = 120;
        board.mathBoardAdd();                       // now on bảng 2
        assert.equal(board.mathBoardActive().strokes.length, 0);
        board.mathBoardSwitch(0);                   // back to bảng 1
        assert.equal(board.mathBoardActive().strokes.length, 1);
        assert.equal(board.mathBoardActive().scrollX, 240);
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
        b.scrollX = 80;
        b.scrollY = 100;
        const g = board.mathBoardGesture();
        assert.equal(board.mathBoardPointerDown(g, b, 1, 10, 20), 'ink-start');
        assert.deepEqual(b.strokes[0].points[0], { x: 90, y: 120 }, 'x and y are screen + scroll');
        assert.equal(board.mathBoardPointerMove(g, b, 1, 30, 40), 'ink');
        assert.deepEqual(b.strokes[0].points[1], { x: 110, y: 140 });
        assert.equal(board.mathBoardPointerUp(g, b, 1), 'ink-end');
    });

    test('two fingers pan the endless sheet horizontally as well as vertically', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 120, 200);
        board.mathBoardPointerDown(g, b, 2, 180, 200);
        board.mathBoardPointerMove(g, b, 1, 50, 170);
        assert.equal(board.mathBoardPointerMove(g, b, 2, 110, 170), 'pan-start', 'the travel since landing is not lost');
        assert.equal(b.scrollX, 70, 'dragging left reveals paper to the right');
        assert.equal(b.scrollY, 30, 'the same gesture may move vertically');
    });

    test('pan clamps at the top of the sheet — no negative scroll', () => {
        const b = freshBoard();
        b.scrollY = 30;
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 100);
        board.mathBoardPointerDown(g, b, 2, 60, 100);
        board.mathBoardPointerMove(g, b, 1, 10, 400);  // drag far downward
        board.mathBoardPointerMove(g, b, 2, 60, 400);
        assert.equal(b.scrollY, 0, 'clamped, not -270');
    });

    test('lifting fingers ends the pan; the NEXT single finger inks again', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 100);
        board.mathBoardPointerDown(g, b, 2, 60, 100);
        board.mathBoardPointerMove(g, b, 1, 10, 90);
        assert.equal(board.mathBoardPointerMove(g, b, 2, 60, 90), 'pan-start');
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
        board.mathBoardPointerMove(g, b, 2, 60, 400);
        assert.equal(b.scrollY, 0, 'nothing above the first line to show');
        board.mathBoardPointerMove(g, b, 1, 10, 100);   // fingers back where they started
        board.mathBoardPointerMove(g, b, 2, 60, 100);
        assert.equal(b.scrollY, 0, 'sheet is back where it started too, not 300px away');
    });

    test('when the steering finger leaves, a survivor takes over without a jump', () => {
        const b = freshBoard(); b.scrollY = 500;
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 100);   // lead
        board.mathBoardPointerDown(g, b, 2, 60, 300);   // survivor, 200px lower
        board.mathBoardPointerMove(g, b, 1, 10, 90);    // both move: a scroll (10px)
        board.mathBoardPointerMove(g, b, 2, 60, 290);
        assert.equal(b.scrollY, 510);
        board.mathBoardPointerUp(g, b, 1);              // the lead lifts mid-pan
        assert.equal(board.mathBoardPointerMove(g, b, 2, 60, 280), 'pan', 'survivor now steers');
        assert.equal(b.scrollY, 520, 'delta is from the survivor\'s own y, not the old lead\'s');
    });

    test('both fingers moving still scrolls once, not twice', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 300);
        board.mathBoardPointerDown(g, b, 2, 60, 300);
        board.mathBoardPointerMove(g, b, 1, 10, 250);
        assert.equal(board.mathBoardPointerMove(g, b, 2, 60, 250), 'pan-start',
            'the paired positions produce one centroid pan, not two separate pans');
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

    // ── the freeze reported on an iPhone XS Max ──────────────────────────
    // "Lâu lâu bảng bị đứng; đóng rồi mở lại thì viết được." Closing and
    // reopening builds a fresh gesture state, so whatever wedged it lived in
    // g.down. Two ways in, one symptom: a finger whose lift iOS never
    // delivered, or a thumb resting on the sheet's edge while the other hand
    // writes. Either way the machine saw "a second finger", switched to pan,
    // and pan needed BOTH fingers to move — the still one never does.

    test('a finger whose lift was lost cannot wedge the board: the next primary finger writes', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 300, 'pen', undefined, true);
        board.mathBoardPointerMove(g, b, 1, 40, 320);
        // …and pointer 1 is never lifted. A NEW primary pointer means, per the
        // Pointer Events spec, that every earlier touch has ended.
        assert.equal(board.mathBoardPointerDown(g, b, 2, 100, 100, 'pen', undefined, true), 'ink-start');
        assert.equal(b.strokes.length, 2, 'the stroke the lost finger drew stays; a fresh one begins');
        assert.equal(board.mathBoardPointerMove(g, b, 2, 120, 110), 'ink');
        assert.equal(board.mathBoardPointerUp(g, b, 2), 'ink-end');
    });

    test('a resting thumb beside the writing finger is ignored, and the writing goes on', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 100, 300);
        board.mathBoardPointerMove(g, b, 1, 104, 304);
        // the thumb lands on the edge of the sheet
        const second = board.mathBoardPointerDown(g, b, 2, 5, 600);
        assert.equal(second, 'none', 'a second finger is not yet a scroll: the stroke is kept until the fingers say which it is');
        assert.equal(b.strokes.length, 1, 'the half-drawn stroke is NOT deleted on the spot');
        // the writing finger keeps going; the thumb stays put
        let act;
        for (let i = 1; i <= 8; i++) act = board.mathBoardPointerMove(g, b, 1, 104 + i * 4, 304 + i * 3);
        assert.equal(act, 'ink', 'ink keeps flowing while the thumb rests');
        assert.equal(b.strokes.length, 1);
        assert.truthy(b.strokes[0].points.length >= 9, 'every sample was recorded: ' + b.strokes[0].points.length);
        assert.equal(g.mode, 'ink', 'the resting thumb was dropped and the machine is writing again');
        assert.equal(board.mathBoardPointerMove(g, b, 2, 6, 601), 'none', 'the dropped thumb is ignored even if it twitches');
        assert.equal(board.mathBoardPointerUp(g, b, 1), 'ink-end');
        assert.equal(board.mathBoardPointerUp(g, b, 2), 'none', 'and its lift changes nothing');
        assert.equal(board.mathBoardPointerDown(g, b, 3, 50, 50), 'ink-start', 'the next finger writes');
    });

    test('a resting thumb that touched FIRST is dropped and the writing finger takes over from its first point', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 5, 600);          // thumb, resting
        assert.equal(board.mathBoardPointerDown(g, b, 2, 100, 300), 'none');
        const acts = [];
        for (let i = 1; i <= 8; i++) acts.push(board.mathBoardPointerMove(g, b, 2, 100 + i * 4, 300 + i * 3));
        assert.truthy(acts.indexOf('ink-resume') > 0, 'the promoted stroke needs a full repaint, not a tail: ' + acts.join(','));
        assert.equal(acts[acts.length - 1], 'ink', 'and then it is ordinary writing');
        assert.equal(g.mode, 'ink');
        assert.equal(g.lead, '2');
        assert.equal(b.strokes.length, 1, 'the thumb\'s dot is gone; the finger\'s stroke is the only ink');
        assert.deepEqual(b.strokes[0].points[0], { x: 100, y: 300 }, 'the stroke starts where the finger landed, not where it was when the thumb was recognised');
        assert.equal(b.strokes[0].points.length, 9);
        assert.equal(board.mathBoardPointerMove(g, b, 2, 140, 330), 'ink');
        assert.equal(board.mathBoardPointerUp(g, b, 2), 'ink-end');
        assert.equal(board.mathBoardPointerUp(g, b, 1), 'none');
    });

    test('a real two-finger scroll still cancels the half-drawn stroke and pans', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 300);
        board.mathBoardPointerMove(g, b, 1, 10, 305);
        assert.equal(board.mathBoardPointerDown(g, b, 2, 60, 300), 'none');
        // both fingers move together: that is a scroll
        assert.equal(board.mathBoardPointerMove(g, b, 1, 10, 290), 'ink', 'still inking until the second finger confirms');
        assert.equal(board.mathBoardPointerMove(g, b, 2, 60, 285), 'pan-start', 'both moved ⇒ scroll; the stroke is cancelled');
        assert.equal(b.strokes.length, 0, 'the accidental stroke is gone');
        board.mathBoardPointerMove(g, b, 1, 10, 200);
        assert.equal(board.mathBoardPointerMove(g, b, 2, 60, 195), 'pan');
        assert.truthy(b.scrollY > 80, 'the sheet scrolled: ' + b.scrollY);
    });

    test('a second finger that only taps (down, up) leaves the stroke alone', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 300);
        board.mathBoardPointerMove(g, b, 1, 14, 304);
        board.mathBoardPointerDown(g, b, 2, 60, 300);
        assert.equal(board.mathBoardPointerUp(g, b, 2), 'none');
        assert.equal(g.mode, 'ink');
        assert.equal(board.mathBoardPointerMove(g, b, 1, 20, 310), 'ink');
        assert.equal(b.strokes.length, 1);
    });

    test('the eraser survives a resting thumb the same way', () => {
        const b = freshBoard();
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 10, 10); board.mathBoardPointerMove(g, b, 1, 40, 40); board.mathBoardPointerUp(g, b, 1);
        board.mathBoardPointerDown(g, b, 1, 200, 200); board.mathBoardPointerMove(g, b, 1, 230, 230); board.mathBoardPointerUp(g, b, 1);
        assert.equal(b.strokes.length, 2);
        board.mathBoardPointerDown(g, b, 5, 300, 300, 'erase');
        board.mathBoardPointerDown(g, b, 6, 5, 600);          // thumb
        const acts = [];
        for (let i = 1; i <= 8; i++) acts.push(board.mathBoardPointerMove(g, b, 5, 300 - i * 12, 300 - i * 12));
        assert.equal(g.mode, 'erase', 'back to erasing once the thumb is recognised as resting');
        assert.truthy(acts.indexOf('erase') >= 0, 'the pass over the stroke at (200,200) erased it: ' + acts.join(','));
        assert.equal(b.strokes.length, 1);
        assert.equal(board.mathBoardPointerUp(g, b, 5), 'erase-end');
    });

    test('many small moves scroll exactly as far as one big move', () => {
        const run = (steps) => {
            const b = freshBoard();
            const g = board.mathBoardGesture();
            board.mathBoardPointerDown(g, b, 1, 10, 1000);
            board.mathBoardPointerDown(g, b, 2, 60, 1000);
            let y = 1000;
            for (let i = 0; i < steps; i++) {
                y -= 100 / steps;
                board.mathBoardPointerMove(g, b, 1, 10, y);
                board.mathBoardPointerMove(g, b, 2, 60, y);
            }
            return b.scrollY;
        };
        assert.equal(run(10), run(1),
            'getCoalescedEvents replays a move as many sub-moves — they must not drift');
    });

    test('two fingers pinch around their midpoint while keeping that world point fixed', () => {
        const b = freshBoard(); b.scrollX = 100; b.scrollY = 200;
        const g = board.mathBoardGesture();
        board.mathBoardPointerDown(g, b, 1, 100, 200);
        board.mathBoardPointerDown(g, b, 2, 200, 200);
        board.mathBoardPointerMove(g, b, 1, 50, 200);
        assert.equal(board.mathBoardPointerMove(g, b, 2, 250, 200), 'pan-start', 'the first confirming move repaints in full');
        assert.equal(b.zoom, 2, 'doubling finger distance doubles the board scale');
        assert.equal(b.scrollX, 175, 'world point under the 150px midpoint stays under it');
        assert.equal(b.scrollY, 300);
    });

    test('pinch zoom is clamped and drawing coordinates account for zoom', () => {
        const b = freshBoard(); b.zoom = 2; b.scrollX = 40; b.scrollY = 60;
        assert.deepEqual(board.mathBoardScreenToWorld(b, 20, 30), { x: 50, y: 75 });
        b.zoom = 99;
        assert.equal(board.mathBoardZoom(b), board.MATH_BOARD_MAX_ZOOM);
        b.zoom = 0.01;
        assert.equal(board.mathBoardZoom(b), board.MATH_BOARD_MIN_ZOOM);
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

    test('stroke bounds are cached instead of rescanning old ink on every pan', () => {
        let reads = 0;
        const point = (x, y) => ({
            get x() { reads++; return x; },
            get y() { reads++; return y; }
        });
        const strokes = [{ points: [point(1, 1), point(10, 10), point(20, 20)] }];
        board.mathBoardVisibleStrokes(strokes, 0, 100, 0, 100, 1);
        const firstReads = reads;
        board.mathBoardVisibleStrokes(strokes, 0, 100, 0, 100, 1);
        assert.equal(reads, firstReads, 'the second viewport check must use cached bounds');
    });

    test('retina backing store is capped for iPhone memory and repaint cost', () => {
        assert.equal(board.mathBoardPixelRatio(3), 2, 'XS Max DPR 3 is capped at 2');
        assert.equal(board.mathBoardPixelRatio(2), 2);
        assert.equal(board.mathBoardPixelRatio(1), 1);
        const calls = [];
        const ctx = { setTransform: (...args) => calls.push(args) };
        const canvas = { style: {}, getContext: () => ctx };
        board.mathBoardSizeCanvas(canvas, 414, 800, 3);
        assert.equal(canvas.width, 828);
        assert.equal(canvas.height, 1600);
        assert.equal(calls[0][0], 2);
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

    test('two fingers can never zoom or pan the page away from the header', () => {
        // Bug: the canvas owns its touches (touch-action: none) but the header
        // did not. iOS ignores user-scalable=no, so a two-finger drag that
        // started on the strip or tool row — or one finger on each element —
        // pinch-zoomed the PAGE: the visual viewport slid, the header with its
        // "Thu nhỏ" button left the screen, and because the canvas swallows
        // every one-finger pan there was no gesture left to bring it back.
        const src = read('js/math-board.js');
        const css = require('./css-all').readAllCss();
        const overlay = css.slice(css.indexOf('.math-board-overlay {'), css.indexOf('.math-board-overlay.hidden'));
        assert.truthy(/touch-action:\s*pan-x pan-y/.test(overlay),
            'overlay must forbid pinch-zoom while keeping child panning');
        assert.truthy(/ontouchmove\s*=/.test(src) && /touches\.length\s*>\s*1/.test(src),
            'a second finger inside the overlay must preventDefault');
        assert.truthy(/ongesturestart\s*=/.test(src) && /ongesturechange\s*=/.test(src),
            "Safari's proprietary pinch events must be refused too");
    });

    test('a lost lift cannot survive in the browser layer either', () => {
        // Belt and braces around the deferred second-touch rule: the machine
        // learns about every lift the browser knows of, wherever it lands,
        // and forgets every finger when the page itself is taken away.
        const src = read('js/math-board.js');
        assert.truthy(/mathBoardPointerDown\(_mathBoardGestureState, mathBoardActive\(\),\s*e\.pointerId, point\.x, point\.y, _mathBoardTool, _mathBoardPenWidth, e\.isPrimary\)/.test(src),
            'isPrimary is the spec\'s own "every earlier touch has ended" signal and must reach the machine');
        assert.truthy(/window\.addEventListener\('pointerup', mathBoardWindowPointerEnd, true\)/.test(src)
            && /window\.addEventListener\('pointercancel', mathBoardWindowPointerEnd, true\)/.test(src),
            'a lift delivered to some other element (capture refused, finger slid off) still ends the gesture');
        assert.truthy(/document\.addEventListener\('visibilitychange'/.test(src) && /window\.addEventListener\('pagehide'/.test(src),
            'a notification shade or app switch that steals the touch mid-stroke ends the gesture');
        const move = src.slice(src.indexOf("canvas.addEventListener('pointermove'"), src.indexOf('function endGesture'));
        assert.truthy(/act === 'pan-start'/.test(move) && /act === 'ink-resume'/.test(move),
            'the pan is now confirmed on a MOVE, and a promoted stroke needs a full repaint');
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

    test('overlay ships: index.html mounts it and the math lazy group loads the script', () => {
        const html = read('index.html');
        assert.truthy(/id="mathBoardOverlay"/.test(html));
        // The script rides the "math" lazy group (js/lazy-data.js
        // GROUP_FILES.math), which runs in list order.
        assert.falsy(/js\/math-board\.js/.test(html), 'must not block the first paint');
        const math = require('../js/lazy-data.js').GROUP_FILES.math;
        const mathIdx = math.indexOf('js/math.js');
        const boardIdx = math.indexOf('js/math-board.js');
        assert.truthy(mathIdx > -1 && boardIdx > mathIdx, 'board script loads after math.js (it calls mathFormula)');
    });

    test('toolbar: undo, quick clear confirmation, one visible board, minimize', () => {
        const src = read('js/math-board.js');
        assert.truthy(/mathBoardUndoTap/.test(src));
        assert.truthy(/Chắc chưa\?/.test(src), 'clear asks before wiping — kid-proofing');
        assert.falsy(/mathBoardChipsHTML|math-board-chips|mathBoardTabTap/.test(src),
            'a one-page board needs neither a + button nor a redundant B1 label');
        assert.truthy(/minimizeMathBoard/.test(src));
        assert.truthy(/math-board-clear-quick[\s\S]*?mathBoardClearTap\(\)[\s\S]*?minimizeMathBoard\(\)/.test(src),
            'quick clear belongs immediately to the left of Minimize');
    });

    test('the pinned strip shows the current question through mathFormula', () => {
        const src = read('js/math-board.js');
        assert.truthy(/mathCurrentQuestion/.test(src));
        assert.truthy(/mathFormula\(/.test(src));
        assert.truthy(/mathCurrentQuestion/.test(read('js/math.js')), 'helper lives in math.js');
    });

    test('the full question is default and collapsing hides the entire stem', () => {
        const src = read('js/math-board.js');
        const css = require('./css-all').readAllCss();
        assert.truthy(/_mathBoardQuestionExpanded\s*=\s*true/.test(src),
            'every open must begin with the complete question');
        assert.truthy(/aria-expanded/.test(src), 'collapse state must be announced');
        assert.truthy(/Thu gọn đề/.test(src) && /Mở đề/.test(src),
            'the control needs explicit text, not only a chevron');
        const strip = css.slice(css.indexOf('.math-board-strip {'), css.indexOf('.math-board-strip-label'));
        assert.truthy(/position:\s*sticky/.test(strip) && /top:\s*0/.test(strip),
            'the question must stay visible while the sheet scrolls');
        const stripHTML = src.slice(src.indexOf('function mathBoardStripHTML'),
            src.indexOf('function mathBoardHintText'));
        assert.truthy(/if\s*\(!full\)\s*return\s*''/.test(stripHTML),
            'collapsed removes the entire question strip from layout, not just its text');
        assert.truthy(/math-board-question-open/.test(src) && /Mở đề/.test(src),
            'the restore action moves into the existing toolbar instead of consuming another row');
    });

    test('iOS cannot select the board or open its copy-paste callout', () => {
        const src = read('js/math-board.js');
        const css = require('./css-all').readAllCss();
        const overlay = css.slice(css.indexOf('.math-board-overlay {'), css.indexOf('.math-board-overlay.hidden'));
        assert.truthy(/-webkit-user-select:\s*none/.test(overlay));
        assert.truthy(/user-select:\s*none/.test(overlay));
        assert.truthy(/-webkit-touch-callout:\s*none/.test(overlay));
        assert.truthy(/\.math-board-overlay\s+\*\s*\{[^}]*-webkit-user-select:\s*none/s.test(css),
            'the lock must reach formula spans on iOS, where inheritance is inconsistent');
        assert.truthy(/onselectstart/.test(src) && /oncontextmenu/.test(src) && /ondragstart/.test(src),
            'CSS plus event guards are needed for older iOS WebKit');
    });

    test('the board adapts from a 320px phone to pointer-based desktop', () => {
        const src = read('js/math-board.js');
        const css = require('./css-all').readAllCss();
        assert.truthy(/@media\s*\(max-width:\s*600px\)/.test(css));
        assert.truthy(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(css),
            'phone actions must divide the available width without overflow');
        assert.truthy(/\.math-board-tool[^}]*min-width:\s*44px;\s*min-height:\s*44px/s.test(css));
        assert.truthy(/\(pointer:\s*fine\)/.test(css) && /cursor:\s*crosshair/.test(css),
            'mouse and trackpad users need drawing feedback too');
        assert.truthy(/matchMedia\('\(pointer: fine\)'\)/.test(src));
        assert.truthy(/Kéo chuột để viết/.test(src) && /1 ngón viết/.test(src),
            'the gesture hint must match the current device');
    });

    test('a long full question leaves writing room in short landscape viewports', () => {
        const css = require('./css-all').readAllCss();
        const full = css.slice(css.indexOf('.math-board-strip.full {'), css.indexOf('.math-board-strip-label'));
        assert.truthy(/max-height:\s*min\(46dvh,\s*360px\)/.test(full));
        assert.truthy(/overflow-y:\s*auto/.test(full));
        assert.truthy(/@media\s*\(max-height:\s*520px\)/.test(css));
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

    test('rapid iPhone pan events collapse to one full repaint per frame', () => {
        const src = read('js/math-board.js');
        assert.truthy(/function mathBoardScheduleRepaint/.test(src));
        assert.truthy(/requestAnimationFrame/.test(src),
            'full canvas pans must follow display frames, not pointer event frequency');
        const move = src.slice(src.indexOf("canvas.addEventListener('pointermove'"),
            src.indexOf('function endGesture'));
        assert.truthy(/if \(repaint\) mathBoardScheduleRepaint\(\)/.test(move),
            'pan, zoom and eraser bursts must share the frame scheduler');
        assert.falsy(/pts\.slice/.test(move),
            'continuous ink must not allocate a fresh array for every sample and trigger GC pauses');
        assert.equal((move.match(/getCoalescedEvents\(\)/g) || []).length, 1,
            'WebKit coalesced samples should be requested once per event, not allocated twice');
    });

    test('Safari chrome animation cannot repeatedly reallocate the retina canvas', () => {
        const src = read('js/math-board.js');
        assert.truthy(/function mathBoardQueueVisualViewportSync/.test(src) &&
            /requestAnimationFrame/.test(src),
            'visual viewport events must collapse to display frames');
        assert.truthy(/function mathBoardQueueResize/.test(src) &&
            /setTimeout\([\s\S]*?90\)/.test(src),
            'retina backing-store allocation must wait for viewport size to settle');
        assert.truthy(/new ResizeObserver\(mathBoardQueueResize\)/.test(src),
            'ResizeObserver must not bypass the allocation debounce');
    });

    test('iPhone browser chrome cannot lift the bottom bar or expose white space', () => {
        const src = read('js/math-board.js');
        const css = require('./css-all').readAllCss();
        const overlay = css.slice(css.indexOf('.math-board-overlay {'), css.indexOf('.math-board-overlay.hidden'));
        assert.truthy(/position:\s*fixed/.test(overlay),
            'the scratch board must not inherit a stale app-shell height');
        assert.truthy(/inset:\s*0/.test(overlay) && /window\.visualViewport/.test(src),
            'the full-screen board must use fixed visual-viewport coordinates');
        assert.falsy(/offsetTop|offsetLeft/.test(src.slice(src.indexOf('function mathBoardSyncVisualViewport'),
            src.indexOf('function mathBoardQueueVisualViewportSync'))),
            'a fixed overlay must not receive the visual viewport offset a second time');
        assert.truthy(/visualViewport\.addEventListener\('resize',\s*mathBoardQueueVisualViewportSync/.test(src) &&
            /visualViewport\.addEventListener\('scroll',\s*mathBoardQueueVisualViewportSync/.test(src),
            'Safari changes the visual viewport during repeated swipes, not just rotation');
        assert.truthy(/html\.math-board-open:has\(#mathBoardOverlay:not\(\.hidden\)\) #bottomNav\s*{[^}]*display:\s*none\s*!important/s.test(css),
            'the bottom navigation must reserve no space and accept no taps while writing');
        assert.truthy(/classList\.add\('math-board-open'\)/.test(src) &&
            /classList\.remove\('math-board-open'\)/.test(src),
            'opening and closing the board must restore navigation deterministically');
    });

    test('ink coordinates stay under the finger while Safari chrome moves', () => {
        const canvas = { _viewW: 400, _viewH: 600, clientWidth: 320, clientHeight: 480 };
        const shifted = board.mathBoardClientPoint(canvas, 170, 260,
            { left: 10, top: 20, width: 320, height: 480 });
        assert.equal(shifted.x, 200, 'x is translated and scaled into the backing canvas');
        assert.equal(shifted.y, 300, 'y is translated and scaled into the backing canvas');

        const src = read('js/math-board.js');
        const move = src.slice(src.indexOf("canvas.addEventListener('pointermove'"),
            src.indexOf('function endGesture'));
        assert.truthy(/const r = canvas\.getBoundingClientRect\(\)/.test(move),
            'every move event must read the current box, not the box cached at pointerdown');
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
        const css = require('./css-all').readAllCss();
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
        const toolsStart = src.indexOf('math-board-tools');
        const tools = src.slice(toolsStart, src.indexOf('mathBoardKeyboardHTML()', toolsStart));
        const labels = (tools.match(/>([^<>]+)<\/button>/g) || []).map(s => s.slice(1, -9).trim());
        assert.equal(labels.length, 6, 'open question, tools, maths keyboard, quick clear, minimize, undo');
        for (const l of labels) {
            assert.truthy(/[A-Za-zÀ-ỹ]/.test(l),
                `"${l}" is glyph-only — an unsupported emoji renders as a hollow box`);
        }
    });

    test('every question gets a complete, accessible scratch maths keyboard', () => {
        const src = read('js/math-board.js');
        const css = require('./css-all').readAllCss();
        assert.truthy(/mathBoardKeyboardToggle/.test(src) && /aria-controls="mathBoardKeyboard"/.test(src),
            'the board toolbar must open and identify the keyboard panel');
        for (const key of ['√', '^', '|', '/', '(', ')', '=', 'x', 'n', 'y']) {
            assert.truthy(src.includes("'" + key + "'"), 'missing required maths key: ' + key);
        }
        assert.truthy(!/mathBoardCanTypeAnswer/.test(src) && !/mathIsTyped/.test(src),
            'scratch formula typing belongs on every maths question, not only graded text fields');
        assert.truthy(/aria-live="polite"/.test(src), 'typed formula status must be announced');
        assert.truthy(/mathBoardFormulaKeyPress/.test(src) && /math-board-formula-layer/.test(src),
            'keys must write a rendered formula into the whiteboard layer');
        assert.truthy(!/mathKeyPress\(key\)/.test(src),
            'the scratch keyboard must never silently change the graded answer');
        assert.truthy(/\.math-board-key[^}]*min-width:\s*44px;\s*min-height:\s*44px/s.test(css),
            'every key keeps a comfortable target inside the horizontally scrolling key rail');
        assert.truthy(/\.math-board-key:focus-visible/.test(css), 'keyboard navigation needs visible focus');
    });

    test('the bulky drawing controls are collapsed while the maths keyboard stays prominent', () => {
        const src = read('js/math-board.js');
        const css = require('./css-all').readAllCss();
        assert.truthy(/_mathBoardToolsExpanded\s*=\s*false/.test(src),
            'drawing settings should not consume the board by default');
        assert.truthy(/math-board-advanced-tools'\s*\+\s*\(_mathBoardToolsExpanded\s*\?\s*''\s*:\s*' hidden'\)/.test(src),
            'eraser and undo belong in the collapsible tray');
        const advancedStart = src.indexOf("'<div class=\"math-board-advanced-tools'");
        const advanced = src.slice(advancedStart, src.indexOf("mathBoardKeyboardHTML()", advancedStart));
        assert.falsy(/Xoá bảng/.test(advanced), 'clear moved out of Công cụ and must not be duplicated there');
        assert.truthy(/aria-controls="mathBoardAdvancedTools"/.test(src) && /mathBoardToolsToggle/.test(src));
        assert.truthy(/Bàn phím toán/.test(src), 'the primary input action needs an unmistakable label');
        assert.truthy(/\.math-board-keyboard-toggle\s*\{[^}]*background:\s*linear-gradient/s.test(css),
            'keyboard action must be visually primary, not another white utility button');
        const renderStart = src.indexOf('function mathBoardRenderOverlay');
        const render = src.slice(renderStart, src.indexOf('mathBoardMountCanvas();', renderStart));
        assert.truthy(render.indexOf('mathBoardKeyboardHTML()') < render.indexOf('mathBoardCanvas'),
            'opening the keyboard must reveal it directly under the controls, before the canvas');
    });

    test('compact mode gives the writing sheet the maximum possible height', () => {
        const src = read('js/math-board.js');
        const css = require('./css-all').readAllCss();
        const toolbar = css.slice(css.indexOf('.math-board-tools {'), css.indexOf('.math-board-tools::-webkit-scrollbar'));
        assert.truthy(/display:\s*flex/.test(toolbar) && /flex-wrap:\s*nowrap/.test(toolbar) &&
            /overflow-x:\s*auto/.test(toolbar),
            'Bảng, Công cụ, Bàn phím and Thu nhỏ stay on one internally scrollable row');
        const keyboard = src.slice(src.indexOf('function mathBoardKeyboardHTML'),
            src.indexOf('window.mathBoardKeyboardToggle'));
        assert.truthy(!/math-board-keyboard-head/.test(keyboard) && !/Viết công thức lên bảng/.test(keyboard),
            'the keyboard has no visible header stealing whiteboard height');
        assert.truthy(/math-board-number-row/.test(keyboard) && /math-board-key-newline/.test(keyboard) &&
            /mathBoardFormulaNewLineTap/.test(keyboard),
            'Enter is the first real key on the number row');
        assert.truthy(/math-board-symbol-row/.test(keyboard) && /symbolKeys/.test(keyboard),
            'delete, operations, symbols and variables share the second row');
        assert.truthy(/math-board-sr-only/.test(keyboard) && /aria-live="polite"/.test(keyboard),
            'screen-reader feedback remains available without occupying visual space');
        assert.truthy(/\.math-board-key-grid\s*\{[^}]*display:\s*grid/s.test(css) &&
            /\.math-board-key-row\s*\{[^}]*display:\s*flex[^}]*overflow-x:\s*auto/s.test(css),
            'the keyboard is exactly two compact, independently scrollable rows');
        assert.deepEqual(board.MATH_BOARD_KEY_ROWS[0],
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ','],
            'top row contains only numeric entry after Enter');
        assert.deepEqual(board.MATH_BOARD_KEY_ROWS[1],
            ['⌫', '+', '−', '·', '/', '=', '(', ')', '√', '^', '|', 'x', 'y', 'n'],
            'bottom row starts with delete, then operations, symbols and variables');
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
        const gx = board.mathBoardGridLines(0, 100, 100, step, 10);
        assert.equal(gx.vertical[0], step - 10,
            'horizontal scrolling shifts the vertical grid without stretching it');
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
        assert.truthy(/passive:\s*false/.test(wheel.slice(0, 800)),
            'passive:false or preventDefault is ignored and the page behind pans too');
        assert.truthy(/deltaX/.test(wheel.slice(0, 500)) && /scrollX/.test(wheel.slice(0, 500)),
            'trackpad horizontal movement must reveal the wider sheet');
    });

    test('the first open teaches the two gestures, then gets out of the way', () => {
        const src = read('js/math-board.js');
        assert.truthy(/1 ngón viết/.test(src) && /2 ngón kéo hoặc chụm để thu phóng/.test(src),
            'the hint must teach two-axis pan and pinch zoom');
        assert.truthy(/mathBoardHintDismiss/.test(src.slice(src.indexOf("addEventListener('pointerdown'"))),
            'the first touch dismisses it — a hint over a working board is clutter');
        const close = src.slice(src.indexOf('window.mathBoardCloseForSession'));
        assert.truthy(/_mathBoardHintDone = false/.test(close.slice(0, close.indexOf('};'))),
            'a new quiz session earns one fresh reminder');
    });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
