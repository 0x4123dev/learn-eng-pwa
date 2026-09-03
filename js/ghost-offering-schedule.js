// Ghost-offering event schedule — THE ONE SOURCE OF TRUTH for when the
// ceremony opens, and for the name of every room the players land in.
//
// Three separately-written pieces need these numbers:
//   js/ghost-offering-event.js   the child's screen (countdown, lock overlay)
//   functions/api/ghost-offering.js  the Pages API that awards the coins
//   battle-worker/src/index.js   the Worker that hands out the item locks
//
// The first two ship in the same Pages deployment; the Worker ships with a
// SEPARATE `wrangler deploy`. When each file carried its own copy of the date,
// moving the event and deploying only one side left the child with a screen
// that opens and a Worker that answers 409 Wrong event room — silently, with
// nothing on screen to explain it. So all three import this file instead.
//
// UMD like js/daily-task-catalog.js: a classic <script> global in the browser,
// `module.exports` for the Node test suite, and a default import for the two
// esbuild-bundled runtimes.
var GhostOfferingSchedule = (function () {
  const HOUR = 60 * 60 * 1000;

  // 22:00 on 10 Sep 2026 in Vietnam (GMT+7) is 15:00 UTC the same day.
  // EVENT_DATE is the GMT+7 calendar date, and it is also the public room's
  // name — tests/ghost-offering-schedule.test.js checks the two agree, so a
  // half-edited change fails the suite instead of the event.
  const EVENT_DATE = '2026-09-10';
  const OPENS_AT = Date.UTC(2026, 8, 10, 15, 0, 0);
  const DURATION_MS = 2 * HOUR;
  const CLOSES_AT = OPENS_AT + DURATION_MS;

  // Vietnam has no daylight saving, so the offset is a constant.
  const TZ_OFFSET_MS = 7 * HOUR;

  // The GMT+7 calendar date of an instant, as YYYY-MM-DD.
  function localDate(ms) {
    return new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
  }

  function eventWindow(now) {
    const t = typeof now === 'number' ? now : Date.now();
    const open = t >= OPENS_AT && t < CLOSES_AT;
    return {
      eventDate: EVENT_DATE,
      opensAt: OPENS_AT,
      closesAt: CLOSES_AT,
      open,
      ended: t >= CLOSES_AT,
      nextOpensAt: OPENS_AT,
    };
  }

  // Room names. The public room is the event date itself; QA accounts
  // (allow_bot) get their own rooms so a tester can never take an offering
  // out of the children's table.
  function publicRoomId() { return EVENT_DATE; }
  function qaRoomId() { return 'qa-' + EVENT_DATE; }
  function humanTestRoomId() { return 'qa-human-' + EVENT_DATE; }

  // The single room a connection is allowed into, given who is asking.
  // Both the API and the Worker call this, so they cannot disagree.
  function roomIdFor(opts) {
    const o = opts || {};
    if (!o.preview) return publicRoomId();
    return o.humanTest ? humanTestRoomId() : qaRoomId();
  }

  return Object.freeze({
    EVENT_DATE, OPENS_AT, CLOSES_AT, DURATION_MS, TZ_OFFSET_MS,
    localDate, eventWindow, publicRoomId, qaRoomId, humanTestRoomId, roomIdFor,
  });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GhostOfferingSchedule;
