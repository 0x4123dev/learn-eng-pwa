// js/math-board.js — Bảng nháp: a finger-drawn scratch sheet over the Math quiz.
//
// Layer 1 (this half of the file) is pure state — no DOM — so the synchronous
// test harness can require() it. Layer 2 (painter + overlay, later tasks) only
// runs in the browser and is guarded by `typeof document`.
//
// A stroke is {points: [{x, y}, …]} in WORLD coordinates: x in CSS px of the
// sheet, y unbounded downward (scrolling never moves the points, only the
// viewport).

const MATH_BOARD_MAX = 3;          // bảng 1/2/3 — enough for one solution
const MATH_BOARD_MIN_DIST = 2;     // CSS px between recorded points
const MATH_BOARD_INK = '#1e293b';
const MATH_BOARD_INK_WIDTH = 2.5;
const MATH_BOARD_PEN_WIDTHS = [MATH_BOARD_INK_WIDTH];
const MATH_BOARD_ERASER_RADIUS = 16;
const MATH_BOARD_MIN_ZOOM = 0.6;
const MATH_BOARD_MAX_ZOOM = 2.5;
const MATH_BOARD_FORMULA_GAP = 48;
const MATH_BOARD_SUPERSCRIPTS = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    'x': 'ˣ', 'n': 'ⁿ', 'y': 'ʸ', '+': '⁺', '−': '⁻',
    '(': '⁽', ')': '⁾'
};

function mathBoardHistory(b) {
    if (!Array.isArray(b.history)) b.history = [];
    return b.history;
}

function mathBoardBegin(b, x, y, width) {
    const stroke = { points: [{ x, y }], width: width || MATH_BOARD_INK_WIDTH };
    b.strokes.push(stroke);
    mathBoardHistory(b).push({ type: 'add', stroke: stroke });
    return stroke;
}

// Append a point unless it is within MIN_DIST of the previous one — finger
// tremor produces clouds of sub-pixel samples that make ink look furry.
function mathBoardExtend(stroke, x, y) {
    const last = stroke.points[stroke.points.length - 1];
    const dx = x - last.x, dy = y - last.y;
    if (dx * dx + dy * dy < MATH_BOARD_MIN_DIST * MATH_BOARD_MIN_DIST) return false;
    stroke.points.push({ x, y });
    return true;
}

function mathBoardUndo(b) {
    const action = mathBoardHistory(b).pop();
    if (!action) return b.strokes.pop() || null;
    if (action.type === 'add') {
        const i = b.strokes.indexOf(action.stroke);
        if (i !== -1) b.strokes.splice(i, 1);
        return action.stroke;
    }
    if (action.type === 'erase') {
        action.removed.slice().sort(function (a, c) { return a.index - c.index; })
            .forEach(function (entry) { b.strokes.splice(entry.index, 0, entry.stroke); });
        return action.removed;
    }
    if (action.type === 'clear') {
        b.strokes.push.apply(b.strokes, action.strokes);
        b.formulae = action.formulae || [];
        return action.strokes;
    }
    if (action.type === 'formula-add') {
        const formulae = mathBoardFormulae(b);
        const i = formulae.indexOf(action.formula);
        if (i !== -1) formulae.splice(i, 1);
        if (b.formulaDraft === action.formula) b.formulaDraft = null;
        return action.formula;
    }
    return null;
}
function mathBoardClear(b) {
    const formulae = mathBoardFormulae(b);
    if (b.strokes.length || formulae.length) {
        mathBoardHistory(b).push({ type: 'clear', strokes: b.strokes.slice(), formulae: formulae.slice() });
    }
    b.strokes.length = 0;
    b.formulae = [];
    b.formulaDraft = null;
    b.formulaSup = false;
}

function mathBoardFormulae(b) {
    if (!Array.isArray(b.formulae)) b.formulae = [];
    return b.formulae;
}

function mathBoardFormulaDraft(b, scrollY, viewHeight, scrollX) {
    const formulae = mathBoardFormulae(b);
    if (b.formulaDraft && formulae.indexOf(b.formulaDraft) !== -1) return b.formulaDraft;
    const last = formulae[formulae.length - 1];
    const viewTop = scrollY || 0;
    const viewBottom = viewTop + (viewHeight || 500);
    const y = last && last.y >= viewTop && last.y + MATH_BOARD_FORMULA_GAP < viewBottom
        ? last.y + MATH_BOARD_FORMULA_GAP : viewTop + 28;
    const formula = { raw: '', x: (scrollX || 0) + 18, y: y };
    formulae.push(formula);
    b.formulaDraft = formula;
    b.formulaSup = false;
    mathBoardHistory(b).push({ type: 'formula-add', formula: formula });
    return formula;
}

function mathBoardFormulaKeyPress(b, key, scrollY, viewHeight, scrollX) {
    if (key === '^') { b.formulaSup = !b.formulaSup; return b.formulaDraft; }
    const formula = mathBoardFormulaDraft(b, scrollY, viewHeight, scrollX);
    if (key === '⌫') {
        formula.raw = formula.raw.slice(0, -1);
        if (!formula.raw) b.formulaSup = false;
        return formula;
    }
    if (b.formulaSup && MATH_BOARD_SUPERSCRIPTS[key]) {
        formula.raw += MATH_BOARD_SUPERSCRIPTS[key];
        return formula;
    }
    if (b.formulaSup) b.formulaSup = false;
    formula.raw += key;
    return formula;
}

function mathBoardFormulaNewLine(b) {
    b.formulaDraft = null;
    b.formulaSup = false;
}

function mathBoardDistanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    if (!dx && !dy) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// A finger cannot scrub individual pixels precisely. Remove the whole pen
// stroke it touches, like an object eraser, and record it for Undo.
function mathBoardEraseAt(b, x, y, radius, removed) {
    const hitRadius = radius || MATH_BOARD_ERASER_RADIUS;
    const erased = removed || [];
    let count = 0;
    for (let i = b.strokes.length - 1; i >= 0; i--) {
        const pts = b.strokes[i].points;
        let hit = pts.length === 1 && Math.hypot(x - pts[0].x, y - pts[0].y) <= hitRadius;
        for (let p = 1; !hit && p < pts.length; p++) {
            hit = mathBoardDistanceToSegment(x, y, pts[p - 1].x, pts[p - 1].y,
                pts[p].x, pts[p].y) <= hitRadius;
        }
        if (hit) {
            erased.push({ index: i, stroke: b.strokes[i] });
            b.strokes.splice(i, 1);
            count++;
        }
    }
    return count;
}

// One session of scratch paper per quiz. Lives in memory only — the spec says
// boards die with the session, so nothing here ever touches localStorage.
let _mathBoardSession = null;

function mathBoardSession() {
    if (!_mathBoardSession) {
        _mathBoardSession = { boards: [{ strokes: [], scrollX: 0, scrollY: 0, zoom: 1 }], active: 0, open: false };
    }
    return _mathBoardSession;
}

function mathBoardReset() { _mathBoardSession = null; }

// SILENT teardown for a profile change.
//
// mathBoardReset() is called from finishMathQuiz() and abandonMathQuiz() only,
// and switchUser() reaches neither — it does not go through switchScreen, so
// no quiz guard fires. A child who switched profile mid-quiz therefore left
// their working on the pad: the next child opened Toán, tapped ✏️ Bảng nháp,
// and was looking at somebody else's handwriting on all four sheets. Worse,
// the overlay is a fixed full-screen sheet whose only exit is its own button,
// so a board left open was painted over the whole app.
//
// mathBoardCloseForSession() is the UI half and only exists in a browser (it
// is a window.* assignment), hence the typeof guard: in Node the strokes are
// all there is to drop.
function mathBoardForgetProfile() {
    if (typeof mathBoardCloseForSession === 'function') {
        try { mathBoardCloseForSession(); } catch (e) {}
    }
    mathBoardReset();
}
function mathBoardActive() { const s = mathBoardSession(); return s.boards[s.active]; }

function mathBoardAdd() {
    const s = mathBoardSession();
    if (s.boards.length >= MATH_BOARD_MAX) return -1;
    s.boards.push({ strokes: [], scrollX: 0, scrollY: 0, zoom: 1 });
    s.active = s.boards.length - 1;
    return s.active;
}

function mathBoardSwitch(i) {
    const s = mathBoardSession();
    if (i >= 0 && i < s.boards.length) s.active = i;
    return s.active;
}

// Actions returned to the painter, and what each obliges it to do:
//   'ink-start' / 'ink'  draw the fresh tail of g.stroke
//   'pan-start'          FULL repaint — the half-drawn stroke was just deleted
//   'pan'                full repaint — b.scrollY moved
//   'ink-end' / 'pan-end'  full repaint at final quality; the gesture is over
//   'none'               nothing changed on screen; do not repaint
//
// ── Gesture machine ──────────────────────────────────────────────────────
// One finger is a pen; a second finger means "I wanted to scroll" — the stroke
// that first finger started is removed, and the whole gesture stays a pan until
// every finger lifts. That single rule is what makes writing feel safe: a
// scroll can never leave a stray ink mark behind.
//
// Each pointer's last y is remembered so a pan continues from where the finger
// already was. Anchoring on the newly-arrived second finger instead would make
// the sheet jump the moment the student rests a thumb down.
function mathBoardGesture() {
    return { down: {}, count: 0, mode: 'idle', // idle | ink | erase | pan
        stroke: null, lead: null, panX: 0, panY: 0, eraseRemoved: null,
        pinchX: 0, pinchY: 0, pinchDistance: 0, pinchMoved: {} };
}

function mathBoardZoom(b) {
    return Math.max(MATH_BOARD_MIN_ZOOM, Math.min(MATH_BOARD_MAX_ZOOM, Number(b.zoom) || 1));
}

function mathBoardScreenToWorld(b, x, y) {
    const zoom = mathBoardZoom(b);
    return { x: (b.scrollX || 0) + x / zoom, y: (b.scrollY || 0) + y / zoom };
}

function mathBoardPinchSnapshot(g) {
    const keys = Object.keys(g.down).slice(0, 2);
    if (keys.length < 2) return null;
    const a = g.down[keys[0]], c = g.down[keys[1]];
    return {
        x: (a.x + c.x) / 2,
        y: (a.y + c.y) / 2,
        distance: Math.max(1, Math.hypot(c.x - a.x, c.y - a.y))
    };
}

function mathBoardBeginPinch(g, b) {
    const pinch = mathBoardPinchSnapshot(g);
    if (!pinch) return;
    g.pinchX = pinch.x;
    g.pinchY = pinch.y;
    g.pinchDistance = pinch.distance;
    g.pinchMoved = {};
    g.panX = b.scrollX || 0;
    g.panY = b.scrollY || 0;
}

function mathBoardPointerDown(g, b, id, x, y, tool, width) {
    const key = String(id);
    if (g.down[key]) return 'none';
    g.down[key] = { x: x, y: y };
    g.count++;
    if (g.mode === 'idle') {
        const point = mathBoardScreenToWorld(b, x, y);
        if (tool === 'erase') {
            g.mode = 'erase';
            g.lead = key;
            g.eraseRemoved = [];
            mathBoardEraseAt(b, point.x, point.y,
                MATH_BOARD_ERASER_RADIUS / mathBoardZoom(b), g.eraseRemoved);
            return 'erase';
        }
        g.mode = 'ink';
        g.lead = key;
        g.stroke = mathBoardBegin(b, point.x, point.y, width);
        return 'ink-start';
    }
    if (g.mode === 'ink') {
        b.strokes.pop();
        const history = mathBoardHistory(b);
        if (history.length && history[history.length - 1].stroke === g.stroke) history.pop();
        g.stroke = null;
        g.mode = 'pan';        // lead stays the first finger — it is the anchor
        mathBoardBeginPinch(g, b);
        return 'pan-start';
    }
    if (g.mode === 'erase') {
        // A second finger means scroll, even while the eraser is selected.
        // Restore anything removed before that intent became unambiguous.
        g.eraseRemoved.slice().sort(function (a, c) { return a.index - c.index; })
            .forEach(function (entry) { b.strokes.splice(entry.index, 0, entry.stroke); });
        g.eraseRemoved = null;
        g.mode = 'pan';
        mathBoardBeginPinch(g, b);
        return 'pan-start';
    }
    return 'none';             // a third finger during a pan changes nothing
}

function mathBoardPointerMove(g, b, id, x, y) {
    const key = String(id);
    const p = g.down[key];
    if (!p) return 'none';
    const prevX = p.x, prevY = p.y;
    p.x = x;
    p.y = y;
    if (g.mode === 'ink' && key === g.lead && g.stroke) {
        const point = mathBoardScreenToWorld(b, x, y);
        return mathBoardExtend(g.stroke, point.x, point.y) ? 'ink' : 'none';
    }
    if (g.mode === 'erase' && key === g.lead) {
        const point = mathBoardScreenToWorld(b, x, y);
        return mathBoardEraseAt(b, point.x, point.y,
            MATH_BOARD_ERASER_RADIUS / mathBoardZoom(b), g.eraseRemoved)
            ? 'erase' : 'none';
    }
    if (g.mode === 'pan' && g.count >= 2) {
        g.pinchMoved[key] = true;
        const pinchKeys = Object.keys(g.down).slice(0, 2);
        // Pointer Events report each finger separately. Wait until both have
        // supplied a fresh position, otherwise an ordinary two-finger swipe
        // briefly looks like a pinch every other event and visibly pulses.
        if (!pinchKeys.every(function (pinchKey) { return g.pinchMoved[pinchKey]; })) return 'none';
        const pinch = mathBoardPinchSnapshot(g);
        if (!pinch) return 'none';
        const oldZoom = mathBoardZoom(b);
        const nextZoom = Math.max(MATH_BOARD_MIN_ZOOM, Math.min(MATH_BOARD_MAX_ZOOM,
            oldZoom * pinch.distance / Math.max(1, g.pinchDistance)));
        // Keep the world point under the previous midpoint under the new
        // midpoint. This combines pinch and two-axis pan without a jump.
        const anchorX = g.panX + g.pinchX / oldZoom;
        const anchorY = g.panY + g.pinchY / oldZoom;
        g.panX = anchorX - pinch.x / nextZoom;
        g.panY = anchorY - pinch.y / nextZoom;
        b.zoom = nextZoom;
        b.scrollX = Math.max(0, g.panX);
        b.scrollY = Math.max(0, g.panY);
        g.pinchX = pinch.x;
        g.pinchY = pinch.y;
        g.pinchDistance = pinch.distance;
        g.pinchMoved = {};
        return Math.abs(nextZoom - oldZoom) > 0.0001 ? 'zoom' : 'pan';
    }
    if (g.mode === 'pan' && key === g.lead) {
        const zoom = mathBoardZoom(b);
        g.panX -= (x - prevX) / zoom;
        g.panY -= (y - prevY) / zoom;       // the finger's true travel, unclamped
        b.scrollX = Math.max(0, g.panX);
        b.scrollY = Math.max(0, g.panY);    // clamp only what we show, or overscroll
        return 'pan';                       // at the top would steal the way back
    }
    return 'none';
}

function mathBoardPointerUp(g, b, id) {
    const key = String(id);
    if (!g.down[key]) return 'none';
    delete g.down[key];
    g.count--;
    const wasLead = key === g.lead;
    if (g.mode === 'ink' && wasLead) {
        g.stroke = null;
        g.mode = 'idle';
        g.lead = null;
        return 'ink-end';
    }
    if (g.mode === 'erase' && wasLead) {
        if (g.eraseRemoved && g.eraseRemoved.length) {
            mathBoardHistory(b).push({ type: 'erase', removed: g.eraseRemoved });
        }
        g.eraseRemoved = null;
        g.mode = 'idle';
        g.lead = null;
        return 'erase-end';
    }
    if (g.mode === 'pan') {
        if (g.count === 0) { g.mode = 'idle'; g.lead = null; return 'pan-end'; }
        // The steering finger left but others remain: hand the pan to a
        // survivor, which carries its own last y, so the sheet does not jump.
        if (wasLead) g.lead = Object.keys(g.down)[0];
        if (g.count >= 2) mathBoardBeginPinch(g, b);
        return 'none';
    }
    if (g.count === 0) { g.mode = 'idle'; g.lead = null; }
    return 'none';
}

// A cancelled pointer (incoming call, notification shade) must end the gesture
// exactly like a lift — anything else wedges the board in ink mode forever.
function mathBoardPointerCancel(g, b, id) { return mathBoardPointerUp(g, b, id); }

// The board array is shared with the toolbar (undo / xoá / switch board). Any
// of those can pull the in-progress stroke out from under a finger that is
// still down, so they must abort the gesture instead of leaving g.stroke
// pointing at a detached object that silently swallows ink.
function mathBoardAbort(g, b) {
    if (b && g.mode === 'erase' && g.eraseRemoved && g.eraseRemoved.length) {
        mathBoardHistory(b).push({ type: 'erase', removed: g.eraseRemoved });
    }
    g.mode = 'idle'; g.stroke = null; g.lead = null; g.down = {}; g.count = 0; g.eraseRemoved = null;
    g.pinchMoved = {};
}

// ── Painter ──────────────────────────────────────────────────────────────
// The canvas is only ever viewport-sized; scrolling changes which slice of
// the world we draw, never the canvas. That is what makes the sheet endless
// without ever meeting iOS's canvas-size ceiling.

function mathBoardVisibleStrokes(strokes, scrollY, viewH, scrollX, viewW, zoom) {
    const z = zoom || 1;
    const top = scrollY, bottom = scrollY + viewH / z;
    const left = scrollX || 0, right = viewW == null ? Infinity : left + viewW / z;
    return strokes.filter(s => {
        let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
        for (const p of s.points) {
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        }
        return maxY >= top && minY <= bottom && maxX >= left && minX <= right;
    });
}

// Midpoint-quadratic smoothing: each recorded point becomes the control point
// of a curve between neighbouring midpoints — cheap, stable, and it reads as
// ink instead of connect-the-dots.
function mathBoardDrawStroke(ctx, pts, scrollY, width, scrollX, zoom) {
    if (!pts.length) return;
    const offsetX = scrollX || 0;
    const z = zoom || 1;
    ctx.strokeStyle = MATH_BOARD_INK;
    ctx.fillStyle = MATH_BOARD_INK;
    ctx.lineWidth = (width || MATH_BOARD_INK_WIDTH) * z;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pts.length === 1) {              // a tap is a dot, not nothing
        ctx.beginPath();
        ctx.arc((pts[0].x - offsetX) * z, (pts[0].y - scrollY) * z,
            (width || MATH_BOARD_INK_WIDTH) * z / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
    }
    ctx.beginPath();
    ctx.moveTo((pts[0].x - offsetX) * z, (pts[0].y - scrollY) * z);
    for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo((pts[i].x - offsetX) * z, (pts[i].y - scrollY) * z,
            (mx - offsetX) * z, (my - scrollY) * z);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo((last.x - offsetX) * z, (last.y - scrollY) * z);
    ctx.stroke();
}

// Giấy ô ly. The grid is anchored in WORLD coordinates (line n sits at
// world y = n·step), which buys three things at once: the sheet looks like
// the squared paper the student does nháp on anyway, the squares guide the
// handwriting, and — the part that is easy to miss — a two-finger scroll on
// an EMPTY board visibly moves something. Without it, the gesture that most
// needs discovering looks broken the first time it is tried.
const MATH_BOARD_GRID_STEP = 28;
const MATH_BOARD_GRID_INK = '#dfe6f3';

// A complete, predictable maths keyboard for questions with typed answers.
// Keep this independent of q.keys: a child should never have to hunt for √ or
// |x| because one author forgot to list that symbol on a particular question.
// The values are the exact tokens understood by mathKeyPress() in math.js.
const MATH_BOARD_KEY_ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ','],
    ['⌫', '+', '−', '·', '/', '=', '(', ')', '√', '^', '|', 'x', 'y', 'n']
];

function mathBoardGridLines(scrollY, viewW, viewH, step, scrollX, zoom) {
    const s = step || MATH_BOARD_GRID_STEP;
    const z = zoom || 1;
    const vertical = [];
    const left = scrollX || 0;
    for (let n = Math.max(1, Math.ceil(left / s)); n * s <= left + viewW / z; n++) {
        vertical.push((n * s - left) * z);
    }
    const horizontal = [];
    for (let n = Math.max(1, Math.ceil(scrollY / s)); n * s <= scrollY + viewH / z; n++) {
        horizontal.push((n * s - scrollY) * z);
    }
    return { vertical, horizontal };
}

function mathBoardDrawGrid(ctx, scrollY, viewW, viewH, scrollX, zoom) {
    const g = mathBoardGridLines(scrollY, viewW, viewH, MATH_BOARD_GRID_STEP, scrollX, zoom);
    ctx.strokeStyle = MATH_BOARD_GRID_INK;
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    for (const x of g.vertical) { ctx.moveTo(x, 0); ctx.lineTo(x, viewH); }
    for (const y of g.horizontal) { ctx.moveTo(0, y); ctx.lineTo(viewW, y); }
    ctx.stroke();
}

function mathBoardRedraw(ctx, b, viewW, viewH) {
    const zoom = mathBoardZoom(b);
    ctx.clearRect(0, 0, viewW, viewH);
    mathBoardDrawGrid(ctx, b.scrollY, viewW, viewH, b.scrollX || 0, zoom);
    for (const s of mathBoardVisibleStrokes(b.strokes, b.scrollY, viewH, b.scrollX || 0, viewW, zoom)) {
        mathBoardDrawStroke(ctx, s.points, b.scrollY, s.width, b.scrollX || 0, zoom);
    }
}

// Size the backing store to devicePixelRatio so 3px ink is 3 crisp pixels,
// not a blurry smear on retina.
function mathBoardSizeCanvas(canvas, viewW, viewH, dpr) {
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
}

// ── Browser layer ────────────────────────────────────────────────────────
// Everything below needs a real DOM; the sync test harness never runs it, but
// pins its contracts by reading this source.
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    var _mathBoardCtx = null;
    var _mathBoardGestureState = null;
    var _mathBoardClearArmed = 0;
    var _mathBoardResizeObs = null;
    var _mathBoardKeyboardOpen = false;
    var _mathBoardToolsExpanded = false;
    var _mathBoardTool = 'pen';
    var _mathBoardPenWidth = MATH_BOARD_INK_WIDTH;
    // One gesture hint per quiz session: the first open shows "1 ngón viết ·
    // 2 ngón cuộn" and the first touch (or 4 s) removes it. Reset when the
    // session closes so the next quiz gets one reminder, not zero, not many.
    var _mathBoardHintDone = false;
    // The dismiss timer must be tracked: overlay re-renders schedule a new one
    // each time, and an orphaned 4 s timer from a previous open fires into the
    // NEXT session's hint and removes it seconds early — the same stale-timer
    // shape as the "Chắc chưa?" confirm.
    var _mathBoardHintTimer = null;
    // The complete question is the safe default: a child should never solve
    // from a clipped stem without noticing. Collapse is an explicit choice and
    // survives switching Bảng 1/2/3 during the same board opening.
    var _mathBoardQuestionExpanded = true;

    // A live gesture holds a reference into b.strokes (g.stroke) or is mid-pan.
    // Any toolbar action that mutates the board, or that tears the overlay
    // down, must abort first — but C3 can null the gesture state entirely
    // (overlay closed under a live stroke), so this must tolerate "no gesture"
    // rather than assume one, unlike the plain mathBoardAbort(g) it wraps.
    function mathBoardAbortSafe() {
        if (_mathBoardGestureState) mathBoardAbort(_mathBoardGestureState, mathBoardActive());
    }

    // The canvas box changes size for three ordinary reasons: rotation, the
    // iOS URL bar collapsing, and the question strip being expanded. A bitmap
    // that no longer matches its box is scaled like an image, which puts the
    // ink somewhere the finger is not — so re-size and repaint from the
    // vectors, which lose nothing.
    function mathBoardResize() {
        const canvas = document.getElementById('mathBoardCanvas');
        if (!canvas) return;
        canvas.style.width = '';    // release the locked box before measuring,
        canvas.style.height = '';   // or clientWidth reports the old size
        const w = Math.max(1, canvas.clientWidth);
        const h = Math.max(1, canvas.clientHeight);
        if (w === canvas._viewW && h === canvas._viewH) {
            // unchanged: restore the inline box and stop, or the ResizeObserver
            // below would keep re-triggering itself forever
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            return;
        }
        _mathBoardCtx = mathBoardSizeCanvas(canvas, w, h, window.devicePixelRatio || 1);
        canvas._viewW = w;
        canvas._viewH = h;
        mathBoardRepaint();
    }
    // Registered ONCE here, not inside mathBoardMountCanvas — that function
    // reruns on every board switch, and window listeners would accumulate.
    window.addEventListener('resize', mathBoardResize);
    window.addEventListener('orientationchange', mathBoardResize);

    // Expanding the question strip is the one thing that reliably shrinks the
    // sheet, and it is a tap we own — so resize on the spot rather than trust
    // the ResizeObserver to notice. (Some engines never deliver it; a stale
    // bitmap here means the ink lands where the finger is not.)
    window.mathBoardStripTap = function () {
        // Toán 4 has no collapse control, so nothing should be able to hide
        // its question — not a stale handler, not a keyboard activation.
        const cur = (typeof mathCurrentQuestion === 'function') ? mathCurrentQuestion() : null;
        if (mathBoardQuestionLocked(cur)) return;
        mathBoardAbortSafe();
        _mathBoardQuestionExpanded = !_mathBoardQuestionExpanded;
        mathBoardRenderOverlay();
        mathBoardResize();
    };

    window.openMathBoard = function () {
        const s = mathBoardSession();
        s.open = true;
        _mathBoardGestureState = mathBoardGesture();
        _mathBoardClearArmed = 0;
        _mathBoardKeyboardOpen = false;
        _mathBoardToolsExpanded = false;
        _mathBoardTool = 'pen';
        _mathBoardPenWidth = MATH_BOARD_INK_WIDTH;
        _mathBoardQuestionExpanded = true;
        mathBoardRenderOverlay();
    };

    window.minimizeMathBoard = function () {
        mathBoardAbortSafe();
        mathBoardSession().open = false;
        _mathBoardClearArmed = 0;
        mathBoardDropCanvas();
    };

    // The quiz can end while the board is open — the child taps a nav tab and
    // confirms. Nothing else hides the overlay, so without this the sheet stays
    // painted over the whole app with no obvious way out.
    window.mathBoardCloseForSession = function () {
        mathBoardDropCanvas();
        _mathBoardGestureState = null;
        _mathBoardClearArmed = 0;
        _mathBoardKeyboardOpen = false;
        _mathBoardToolsExpanded = false;
        clearTimeout(_mathBoardHintTimer);
        _mathBoardHintTimer = null;
        _mathBoardHintDone = false;   // next quiz session gets its one reminder
    };

    // Tear the canvas down for good: hide the overlay, drop its DOM, and stop
    // observing it. The observer outlives a detached target, so skipping the
    // disconnect leaks the canvas bitmap — megabytes on a retina phone.
    function mathBoardDropCanvas() {
        if (_mathBoardResizeObs) { _mathBoardResizeObs.disconnect(); _mathBoardResizeObs = null; }
        const el = document.getElementById('mathBoardOverlay');
        if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
        _mathBoardCtx = null;
    }

    // ← REVIEW (Task 3): every toolbar action mutates b.strokes, which the
    // gesture machine may be holding a live reference into. Aborting first is
    // what stops a finger that is still down from inking into a detached
    // stroke that then vanishes on the next repaint.
    window.mathBoardUndoTap = function () {
        mathBoardAbortSafe();
        mathBoardUndo(mathBoardActive());
        mathBoardRepaint();
    };

    // A toolbar control is a word on the Toán 7 board and a single icon in
    // the Toán 4 question header. The same handlers toggle both, so the face
    // is chosen here once rather than at every call site — writing the word
    // into an icon button was how "🧽" became the text "Chắc chưa?" in a
    // 44px circle.
    function mathBoardFace(btn, word, icon, label) {
        if (!btn) return;
        if (btn.classList && btn.classList.contains('math-board-icon')) {
            btn.textContent = icon;
            btn.setAttribute('aria-label', label || word);
            btn.setAttribute('title', label || word);
            return;
        }
        btn.textContent = word;
    }

    // Xoá bảng is destructive for a child: the first tap arms, a second tap
    // within 2s wipes. The armed button re-labels itself "Chắc chưa?".
    window.mathBoardClearTap = function () {
        const now = Date.now();
        if (now - _mathBoardClearArmed < 2000) {
            mathBoardAbortSafe();
            const b = mathBoardActive();
            mathBoardClear(b);
            b.scrollX = 0;
            b.scrollY = 0;
            _mathBoardClearArmed = 0;
            // A full mathBoardRenderOverlay() would also disarm the button, but
            // nothing about the board list changed here — only its strokes — so
            // a plain repaint is enough, as long as the label is put back by hand.
            mathBoardFace(document.getElementById('mathBoardClearBtn'), 'Xoá bảng', '🧽', 'Xoá bảng');
            mathBoardRepaint();
            return;
        }
        _mathBoardClearArmed = now;
        mathBoardFace(document.getElementById('mathBoardClearBtn'),
            'Chắc chưa?', '❓', 'Chắc chưa? Chạm lần nữa để xoá cả bảng');
        setTimeout(function () {
            _mathBoardClearArmed = 0;
            mathBoardFace(document.getElementById('mathBoardClearBtn'), 'Xoá bảng', '🧽', 'Xoá bảng');
        }, 2000);
    };

    window.mathBoardTabTap = function (i) {
        mathBoardAbortSafe();
        if (i === -1) { if (mathBoardAdd() === -1) return; }
        else mathBoardSwitch(i);
        mathBoardRenderOverlay();
    };

    function mathBoardChipsHTML() {
        const s = mathBoardSession();
        let html = s.boards.map(function (b, i) {
            return '<button class="math-board-chip ' + (i === s.active ? 'active' : '') +
                   '" type="button" aria-label="Bảng ' + (i + 1) + '" ' +
                   'onclick="mathBoardTabTap(' + i + ')">B' + (i + 1) + '</button>';
        }).join('');
        if (s.boards.length < MATH_BOARD_MAX) {
            html += '<button class="math-board-chip" type="button" onclick="mathBoardTabTap(-1)">+</button>';
        }
        return html;
    }

    function mathBoardWritingToolsHTML() {
        const penActive = _mathBoardTool === 'pen';
        const pen = '<button class="math-board-write-tool' + (penActive ? ' active' : '') + '" type="button" ' +
                   'aria-pressed="' + (penActive ? 'true' : 'false') + '" ' +
                   'onclick="mathBoardSelectTool(\'pen\')">' +
                     '<span class="math-board-pen-sample" style="height:' + MATH_BOARD_INK_WIDTH + 'px"></span>' +
                     '<span>Bút mảnh</span>' +
                   '</button>';
        const eraseActive = _mathBoardTool === 'erase';
        return '<div class="math-board-writing-tools" role="group" aria-label="Công cụ viết">' + pen +
               '<button class="math-board-write-tool math-board-eraser' + (eraseActive ? ' active' : '') + '" ' +
                       'type="button" aria-pressed="' + (eraseActive ? 'true' : 'false') + '" ' +
                       'onclick="mathBoardSelectTool(\'erase\')">Tẩy nét</button></div>';
    }

    window.mathBoardSelectTool = function (tool) {
        mathBoardAbortSafe();
        _mathBoardTool = tool === 'erase' ? 'erase' : 'pen';
        _mathBoardPenWidth = MATH_BOARD_INK_WIDTH;
        document.querySelectorAll('.math-board-write-tool').forEach(function (button) {
            button.classList.remove('active');
            button.setAttribute('aria-pressed', 'false');
        });
        const selector = _mathBoardTool === 'erase'
            ? '.math-board-eraser'
            : '.math-board-write-tool:not(.math-board-eraser)';
        const selected = document.querySelector(selector);
        if (selected) {
            selected.classList.add('active');
            selected.setAttribute('aria-pressed', 'true');
        }
        const canvas = document.getElementById('mathBoardCanvas');
        if (canvas) canvas.classList.toggle('erasing', _mathBoardTool === 'erase');
    };

    // Toán 4 asks four sums under one heading. `q.q` is only that heading —
    // "Đặt tính rồi tính:" — and the sums themselves live in the answer-box
    // labels. A child who opened the board saw the heading and nothing to
    // work from, so for Toán 4 the whole question comes across, and there is
    // no collapse control to hide it behind again.
    function mathBoardQuestionLocked(q) { return !!q && q.grade === 4; }

    function mathBoardQuestionBodyHTML(q) {
        let html = '<span class="math-formula">' + mathFormula(q.q) + '</span>';
        const parts = Array.isArray(q.answerParts) ? q.answerParts : [];
        if (mathBoardQuestionLocked(q) && parts.length) {
            html += '<span class="math-board-strip-parts">' + parts.map(function (p, i) {
                return '<span class="math-board-strip-part"><b>' + (i + 1) + '</b>' +
                       '<span class="math-formula">' + mathFormula(p.label) + '</span></span>';
            }).join('') + '</span>';
        }
        return html;
    }

    // Toán 4's board keeps three controls and no toolbar row of its own:
    // wipe the board, the maths keyboard, and put the board away. They ride
    // in the question header as icons, so the whole row of chips and toggles
    // stops eating writing space on a tablet the child is working on.
    function mathBoardIconToolsHTML() {
        return '<span class="math-board-icon-tools">' +
          '<button class="math-board-tool math-board-icon" type="button" id="mathBoardClearBtn" ' +
                  'aria-label="Xoá bảng" title="Xoá bảng" ' +
                  'onclick="mathBoardClearTap()">🧽</button>' +
          '<button class="math-board-tool math-board-icon' + (_mathBoardKeyboardOpen ? ' active' : '') + '" ' +
                  'type="button" id="mathBoardKeyboardBtn" aria-controls="mathBoardKeyboard" ' +
                  'aria-expanded="' + (_mathBoardKeyboardOpen ? 'true' : 'false') + '" ' +
                  'aria-label="Bàn phím toán" title="Bàn phím toán" ' +
                  'onclick="mathBoardKeyboardToggle()">🔢</button>' +
          '<button class="math-board-tool math-board-icon" type="button" ' +
                  'aria-label="Thu nhỏ bảng nháp" title="Thu nhỏ" ' +
                  'onclick="minimizeMathBoard()">✕</button>' +
        '</span>';
    }

    function mathBoardStripHTML() {
        const q = (typeof mathCurrentQuestion === 'function') ? mathCurrentQuestion() : null;
        if (!q) return '';
        if (mathBoardQuestionLocked(q)) {
            return '<div class="math-board-strip full locked">' +
                   '<span class="math-board-strip-label">Đề bài</span>' +
                   mathBoardIconToolsHTML() +
                   mathBoardQuestionBodyHTML(q) + '</div>';
        }
        const full = _mathBoardQuestionExpanded;
        if (!full) return '';
        return '<button class="math-board-strip' + (full ? ' full' : '') + '" type="button" ' +
               'aria-expanded="' + (full ? 'true' : 'false') + '" ' +
               'aria-label="' + (full ? 'Thu gọn đề bài' : 'Mở rộng đầy đủ đề bài') + '" ' +
               'onclick="mathBoardStripTap()">' +
               '<span class="math-board-strip-label">Đề bài</span>' +
               '<span class="math-formula">' + mathFormula(q.q) + '</span>' +
               '<span class="math-board-strip-action">Thu gọn đề</span>' +
               '</button>';
    }

    function mathBoardHintText() {
        const finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
        return finePointer
            ? 'Kéo chuột để viết &nbsp;·&nbsp; Trackpad cuộn mọi hướng'
            : '1 ngón viết &nbsp;·&nbsp; 2 ngón kéo hoặc chụm để thu phóng';
    }

    function mathBoardKeyHTML(key) {
        let face = mathEsc(key);
        let label = key;
        let className = 'math-board-key';
        if (key === '/') {
            face = '<span class="math-board-fraction-key" aria-hidden="true"><span>a</span><span>b</span></span>';
            label = 'Phân số';
            className += ' math-board-key-symbol';
        } else if (key === '^') {
            face = 'x<sup>n</sup>';
            label = 'Số mũ';
            className += ' math-board-key-symbol math-key-pow' +
                (mathBoardActive().formulaSup ? ' active' : '');
        } else if (key === '|') {
            face = '|x|';
            label = 'Giá trị tuyệt đối, bấm trước và sau biểu thức';
            className += ' math-board-key-symbol';
        } else if (key === '√') {
            face = '√x';
            label = 'Căn bậc hai';
            className += ' math-board-key-symbol';
        } else if (key === '⌫') {
            label = 'Xóa một ký tự';
            className += ' math-board-key-delete';
        } else if (key === '(') label = 'Mở ngoặc';
        else if (key === ')') label = 'Đóng ngoặc';
        else if (key === '=') label = 'Dấu bằng';
        return '<button type="button" class="' + className + '" aria-label="' + label + '" ' +
               'onclick="mathBoardKeyboardKey(\'' + key + '\')">' + face + '</button>';
    }

    function mathBoardKeyboardHTML() {
        const numberKeys = MATH_BOARD_KEY_ROWS[0].map(mathBoardKeyHTML).join('');
        const symbolKeys = MATH_BOARD_KEY_ROWS[1].map(mathBoardKeyHTML).join('');
        return '<section class="math-board-keyboard' + (_mathBoardKeyboardOpen ? '' : ' hidden') + '" ' +
               'id="mathBoardKeyboard" aria-label="Bàn phím toán học">' +
                 '<div class="math-board-key-grid" role="group" aria-label="Các phím nhập công thức">' +
                   '<div class="math-board-key-row math-board-number-row" aria-label="Enter và các chữ số">' +
                     '<button type="button" class="math-board-key math-board-key-newline" ' +
                             'aria-label="Enter, thêm dòng mới" onclick="mathBoardFormulaNewLineTap()">↵ Enter</button>' +
                     numberKeys +
                   '</div>' +
                   '<div class="math-board-key-row math-board-symbol-row" aria-label="Xóa và các ký hiệu toán học">' +
                     symbolKeys +
                   '</div>' +
                 '</div>' +
                 '<div class="math-board-sr-only" id="mathBoardKeyboardStatus" aria-live="polite">' +
                   'Bàn phím toán đã mở' +
                 '</div>' +
               '</section>';
    }

    window.mathBoardKeyboardToggle = function () {
        mathBoardAbortSafe();
        _mathBoardKeyboardOpen = !_mathBoardKeyboardOpen;
        if (_mathBoardKeyboardOpen) _mathBoardToolsExpanded = false;
        const panel = document.getElementById('mathBoardKeyboard');
        const button = document.getElementById('mathBoardKeyboardBtn');
        const advanced = document.getElementById('mathBoardAdvancedTools');
        const toolsButton = document.getElementById('mathBoardToolsBtn');
        if (panel) panel.classList.toggle('hidden', !_mathBoardKeyboardOpen);
        if (advanced) advanced.classList.toggle('hidden', !_mathBoardToolsExpanded);
        if (toolsButton) {
            toolsButton.setAttribute('aria-expanded', 'false');
            toolsButton.classList.remove('active');
            toolsButton.textContent = 'Công cụ';
        }
        if (button) {
            button.setAttribute('aria-expanded', _mathBoardKeyboardOpen ? 'true' : 'false');
            button.classList.toggle('active', _mathBoardKeyboardOpen);
            mathBoardFace(button, _mathBoardKeyboardOpen ? 'Ẩn bàn phím' : 'Bàn phím toán',
                '🔢', _mathBoardKeyboardOpen ? 'Ẩn bàn phím toán' : 'Bàn phím toán');
        }
        mathBoardResize();
    };

    window.mathBoardFormulaNewLineTap = function () {
        mathBoardFormulaNewLine(mathBoardActive());
        const status = document.getElementById('mathBoardKeyboardStatus');
        if (status) status.textContent = 'Đã thêm dòng mới trên bảng nháp';
        mathBoardRenderFormulae();
    };

    window.mathBoardToolsToggle = function () {
        mathBoardAbortSafe();
        _mathBoardToolsExpanded = !_mathBoardToolsExpanded;
        if (_mathBoardToolsExpanded) _mathBoardKeyboardOpen = false;
        const advanced = document.getElementById('mathBoardAdvancedTools');
        const button = document.getElementById('mathBoardToolsBtn');
        const keyboard = document.getElementById('mathBoardKeyboard');
        const keyboardButton = document.getElementById('mathBoardKeyboardBtn');
        if (advanced) advanced.classList.toggle('hidden', !_mathBoardToolsExpanded);
        if (keyboard) keyboard.classList.toggle('hidden', !_mathBoardKeyboardOpen);
        if (button) {
            button.setAttribute('aria-expanded', _mathBoardToolsExpanded ? 'true' : 'false');
            button.classList.toggle('active', _mathBoardToolsExpanded);
            button.textContent = _mathBoardToolsExpanded ? 'Ẩn công cụ' : 'Công cụ';
        }
        if (keyboardButton) {
            keyboardButton.setAttribute('aria-expanded', 'false');
            keyboardButton.classList.remove('active');
            mathBoardFace(keyboardButton, 'Bàn phím toán', '🔢', 'Bàn phím toán');
        }
        mathBoardResize();
    };

    window.mathBoardKeyboardKey = function (key) {
        const canvas = document.getElementById('mathBoardCanvas');
        const b = mathBoardActive();
        const zoom = mathBoardZoom(b);
        const formula = mathBoardFormulaKeyPress(b, key, b.scrollY,
            canvas ? canvas._viewH / zoom : 500, b.scrollX || 0);
        mathBoardRenderFormulae();
        // A typed calculation is one continuous line of working. Once its
        // right edge approaches the viewport, move the paper just enough to
        // keep the newest symbol visible instead of wrapping the mathematics.
        const note = document.getElementById('mathBoardActiveFormula');
        if (canvas && note && formula && formula.raw) {
            const right = formula.x + note.offsetWidth;
            const visibleRight = (b.scrollX || 0) + canvas._viewW / zoom - 18;
            if (right > visibleRight) {
                b.scrollX = right - canvas._viewW / zoom + 18;
                mathBoardRepaint();
            }
        }
        const status = document.getElementById('mathBoardKeyboardStatus');
        if (status) status.textContent = formula && formula.raw
            ? 'Đã viết lên bảng: ' + formula.raw : 'Đang viết trực tiếp trên bảng nháp';
        document.querySelectorAll('.math-key-pow').forEach(function (button) {
            button.classList.toggle('active', !!b.formulaSup);
        });
    };

    function mathBoardRenderOverlay() {
        const el = document.getElementById('mathBoardOverlay');
        if (!el) return;
        _mathBoardClearArmed = 0;   // the armed button is about to be destroyed
        el.classList.remove('hidden');
        // iOS Safari may interpret a slow pencil/finger contact as selecting
        // the overlay text, tint the whole sheet blue, then show Copy/Paste.
        // The board has no editable text, so those native gestures are always
        // accidental and can be safely blocked at the overlay boundary.
        el.onselectstart = function (event) { event.preventDefault(); };
        el.oncontextmenu = function (event) { event.preventDefault(); };
        el.ondragstart = function (event) { event.preventDefault(); };
        // Two fingers anywhere on the board must belong to the board. The
        // canvas already owns its touches (touch-action: none), but a
        // two-finger drag that started on the HEADER — strip, tool row, or one
        // finger on each element — was Safari's page pinch: iOS ignores
        // user-scalable=no, the visual viewport zoomed and slid, the header
        // with "Thu nhỏ" left the screen, and the canvas swallowed every
        // one-finger pan that could have brought it back. Refuse the native
        // gesture at the overlay boundary; one-finger taps and scrolls (the
        // long-stem strip, the toolbar) are untouched. Property handlers, not
        // addEventListener: this function reruns on every board switch, and
        // properties cannot accumulate.
        el.ontouchmove = function (event) {
            if (event.touches && event.touches.length > 1) event.preventDefault();
        };
        el.ongesturestart = function (event) { event.preventDefault(); };
        el.ongesturechange = function (event) { event.preventDefault(); };
        // Toán 4 carries its three controls in the question header instead, so
        // the whole row of board chips and toggles — and the panel behind
        // "Công cụ" — is left out rather than drawn and hidden.
        const lockedBoard = mathBoardQuestionLocked(
            (typeof mathCurrentQuestion === 'function') ? mathCurrentQuestion() : null);
        el.innerHTML =
            mathBoardStripHTML() +
            (lockedBoard ? '' :
            '<div class="math-board-tools">' +
              '<span class="math-board-chips">' + mathBoardChipsHTML() + '</span>' +
              '<div class="math-board-quick-tools">' +
                (_mathBoardQuestionExpanded ? '' :
                  '<button class="math-board-tool math-board-question-open" type="button" ' +
                          'onclick="mathBoardStripTap()">Mở đề</button>') +
                '<button class="math-board-tool math-board-tools-toggle' + (_mathBoardToolsExpanded ? ' active' : '') + '" ' +
                        'type="button" id="mathBoardToolsBtn" aria-controls="mathBoardAdvancedTools" ' +
                        'aria-expanded="' + (_mathBoardToolsExpanded ? 'true' : 'false') + '" ' +
                        'onclick="mathBoardToolsToggle()">' +
                        (_mathBoardToolsExpanded ? 'Ẩn công cụ' : 'Công cụ') + '</button>' +
                '<button class="math-board-tool math-board-keyboard-toggle' + (_mathBoardKeyboardOpen ? ' active' : '') + '" ' +
                        'type="button" id="mathBoardKeyboardBtn" aria-controls="mathBoardKeyboard" ' +
                        'aria-expanded="' + (_mathBoardKeyboardOpen ? 'true' : 'false') + '" ' +
                        'onclick="mathBoardKeyboardToggle()">' +
                        (_mathBoardKeyboardOpen ? 'Ẩn bàn phím' : 'Bàn phím toán') + '</button>' +
                '<button class="math-board-tool" type="button" onclick="minimizeMathBoard()">Thu nhỏ</button>' +
              '</div>' +
            '</div>' +
              '<div class="math-board-advanced-tools' + (_mathBoardToolsExpanded ? '' : ' hidden') + '" ' +
                   'id="mathBoardAdvancedTools">' +
                mathBoardWritingToolsHTML() +
                '<div class="math-board-edit-tools">' +
                  '<button class="math-board-tool" type="button" onclick="mathBoardUndoTap()">Lùi một bước</button>' +
                  '<button class="math-board-tool" type="button" id="mathBoardClearBtn" ' +
                          'onclick="mathBoardClearTap()">Xoá bảng</button>' +
                '</div>' +
              '</div>') +
            mathBoardKeyboardHTML() +
            '<div class="math-board-sheet" id="mathBoardSheet">' +
              '<canvas id="mathBoardCanvas"></canvas>' +
              '<div class="math-board-formula-layer" id="mathBoardFormulaLayer" aria-label="Công thức trên bảng nháp"></div>' +
            '</div>' +
            (_mathBoardHintDone ? '' :
              '<div class="math-board-hint" id="mathBoardHint">' + mathBoardHintText() + '</div>');
        mathBoardMountCanvas();
        clearTimeout(_mathBoardHintTimer);
        if (!_mathBoardHintDone) _mathBoardHintTimer = setTimeout(mathBoardHintDismiss, 4000);
    }

    function mathBoardHintDismiss() {
        clearTimeout(_mathBoardHintTimer);
        _mathBoardHintTimer = null;
        _mathBoardHintDone = true;
        const hint = document.getElementById('mathBoardHint');
        if (hint) hint.remove();
    }

    function mathBoardMountCanvas() {
        const canvas = document.getElementById('mathBoardCanvas');
        if (!canvas) return;
        // A ResizeObserver does NOT stop observing when its target is detached,
        // and every board switch replaces the canvas — so without this the old
        // observer and its retina bitmap (megabytes) stay alive for the life of
        // the page, once per switch.
        if (_mathBoardResizeObs) { _mathBoardResizeObs.disconnect(); _mathBoardResizeObs = null; }
        canvas.style.touchAction = 'none';   // touch-action: none — we own every touch
        canvas.classList.toggle('erasing', _mathBoardTool === 'erase');
        // ← REVIEW (Task 4): clamp to at least 1px. A canvas sized during an
        // unsettled layout would be zero-area and silently swallow every stroke.
        const w = Math.max(1, canvas.clientWidth || (canvas.parentNode && canvas.parentNode.clientWidth) || 320);
        const h = Math.max(1, canvas.clientHeight || 300);
        // mathBoardSizeCanvas clears the bitmap as a side effect of assigning
        // canvas.width, so the repaint at the end of this function is required,
        // not decorative.
        _mathBoardCtx = mathBoardSizeCanvas(canvas, w, h, window.devicePixelRatio || 1);
        canvas._viewW = w;
        canvas._viewH = h;

        canvas.addEventListener('pointerdown', function (e) {
            // C3 can null the gesture state out from under an open overlay
            // (session ended while the board was up); without this guard a
            // stray touch on the stale canvas would throw.
            if (!_mathBoardGestureState) return;
            e.preventDefault();
            mathBoardHintDismiss();   // the first touch means the hint landed
            // Capture is an optimisation — it keeps a stroke alive when the
            // finger slides off the canvas. It is NOT worth the whole gesture:
            // setPointerCapture throws NotFoundError if the pointer is already
            // gone by the time we run, and an uncaught throw here skips the
            // code below, so the tap draws nothing at all. (Same shape as the
            // iOS currentTime throw in app.js that once killed every card tap.)
            try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
            const r = canvas.getBoundingClientRect();
            const act = mathBoardPointerDown(_mathBoardGestureState, mathBoardActive(),
                e.pointerId, e.clientX - r.left, e.clientY - r.top, _mathBoardTool, _mathBoardPenWidth);
            // ← REVIEW (Task 3): 'pan-start' means the machine just deleted the
            // half-drawn stroke. Without this repaint it stays painted on the
            // canvas until the first pan move — ink that should be gone.
            if (act === 'pan-start') mathBoardRepaint();
        });

        canvas.addEventListener('pointermove', function (e) {
            const g = _mathBoardGestureState;
            if (!g || !_mathBoardCtx) return;
            const r = canvas.getBoundingClientRect();
            const b = mathBoardActive();
            // getCoalescedEvents: iOS batches touch samples between frames;
            // without unpacking them, fast writing has straight-line gaps.
            const events = (e.getCoalescedEvents && e.getCoalescedEvents().length)
                ? e.getCoalescedEvents() : [e];
            let repaint = false;
            for (let i = 0; i < events.length; i++) {
                const ce = events[i];
                const act = mathBoardPointerMove(g, b, e.pointerId,
                    ce.clientX - r.left, ce.clientY - r.top);
                if (act === 'pan' || act === 'zoom' || act === 'erase') repaint = true;
                else if (act === 'ink' && g.stroke) {
                    // Draw only the fresh tail — repainting the whole sheet on
                    // every sample is what makes cheap phones lag behind the finger.
                    const pts = g.stroke.points;
                    mathBoardDrawStroke(_mathBoardCtx, pts.slice(Math.max(0, pts.length - 3)),
                        b.scrollY, g.stroke.width, b.scrollX || 0, mathBoardZoom(b));
                }
            }
            if (repaint) mathBoardRepaint();
        });

        function endGesture(e) {
            if (!_mathBoardGestureState) return;
            mathBoardPointerUp(_mathBoardGestureState, mathBoardActive(), e.pointerId);
            mathBoardRepaint();   // final full-quality pass over the finished stroke
        }
        canvas.addEventListener('pointerup', endGesture);
        canvas.addEventListener('pointercancel', function (e) {
            if (!_mathBoardGestureState) return;
            mathBoardPointerCancel(_mathBoardGestureState, mathBoardActive(), e.pointerId);
            mathBoardRepaint();
        });

        // A laptop has no second finger: the trackpad/mouse wheel is its
        // scroll gesture, and without this the desktop sheet simply cannot
        // move. passive:false because we consume the scroll ourselves —
        // otherwise the page behind the overlay pans instead.
        canvas.addEventListener('wheel', function (e) {
            e.preventDefault();
            const b = mathBoardActive();
            const zoom = mathBoardZoom(b);
            const horizontal = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
            b.scrollX = Math.max(0, (b.scrollX || 0) + horizontal / zoom);
            if (!e.shiftKey) b.scrollY = Math.max(0, b.scrollY + e.deltaY / zoom);
            mathBoardRepaint();
        }, { passive: false });

        mathBoardRepaint();
        // Per-element observer: dies with the canvas on the next re-render,
        // unlike the window-level resize/orientationchange listeners above.
        if (window.ResizeObserver) {
            _mathBoardResizeObs = new ResizeObserver(mathBoardResize);
            _mathBoardResizeObs.observe(canvas);
        }
    }

    function mathBoardRenderFormulae() {
        const layer = document.getElementById('mathBoardFormulaLayer');
        if (!layer) return;
        const b = mathBoardActive();
        const zoom = mathBoardZoom(b);
        const canvas = document.getElementById('mathBoardCanvas');
        const viewH = canvas ? canvas._viewH || canvas.clientHeight : 0;
        layer.innerHTML = mathBoardFormulae(b).filter(function (formula) {
            return formula.raw && formula.y >= b.scrollY - 50 / zoom &&
                formula.y <= b.scrollY + viewH / zoom + 20 / zoom;
        }).map(function (formula) {
            const active = formula === b.formulaDraft;
            return '<div class="math-board-formula-note' + (active ? ' active' : '') + '" ' +
                   (active ? 'id="mathBoardActiveFormula" ' : '') +
                   'style="left:' + ((formula.x - (b.scrollX || 0)) * zoom) + 'px;' +
                   'top:' + ((formula.y - b.scrollY) * zoom) + 'px;' +
                   'transform:scale(' + zoom + ');transform-origin:top left">' +
                     '<span class="math-formula">' + mathFormula(formula.raw) + '</span>' +
                   '</div>';
        }).join('');
    }

    function mathBoardRepaint() {
        const canvas = document.getElementById('mathBoardCanvas');
        if (!canvas || !_mathBoardCtx) return;
        mathBoardRedraw(_mathBoardCtx, mathBoardActive(), canvas._viewW, canvas._viewH);
        mathBoardRenderFormulae();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MATH_BOARD_MAX, MATH_BOARD_MIN_DIST, MATH_BOARD_INK, MATH_BOARD_INK_WIDTH,
        MATH_BOARD_PEN_WIDTHS, MATH_BOARD_ERASER_RADIUS, MATH_BOARD_MIN_ZOOM, MATH_BOARD_MAX_ZOOM,
        mathBoardBegin, mathBoardExtend, mathBoardUndo, mathBoardClear,
        mathBoardEraseAt, mathBoardDistanceToSegment,
        mathBoardFormulae, mathBoardFormulaDraft, mathBoardFormulaKeyPress, mathBoardFormulaNewLine,
        mathBoardSession, mathBoardReset, mathBoardForgetProfile, mathBoardActive, mathBoardAdd, mathBoardSwitch,
        mathBoardGesture, mathBoardPointerDown, mathBoardPointerMove, mathBoardPointerUp, mathBoardPointerCancel,
        mathBoardAbort, mathBoardZoom, mathBoardScreenToWorld,
        mathBoardVisibleStrokes, mathBoardDrawStroke, mathBoardRedraw, mathBoardSizeCanvas,
        mathBoardGridLines, MATH_BOARD_GRID_STEP,
        MATH_BOARD_KEY_ROWS,
    };
}
