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
