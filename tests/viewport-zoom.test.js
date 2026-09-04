// viewport-zoom.test.js — a child with low vision must be able to zoom.
//
// index.html shipped `maximum-scale=1.0, user-scalable=no` in its viewport
// meta. On Android Chrome that switches pinch-zoom off for the whole app: the
// 11.5px bottom-nav labels and the figures in the Toán questions could not be
// enlarged at all (WCAG 1.4.4 "Resize text"). iOS has ignored both parameters
// since iOS 10, so they were never buying anything there either — the app was
// paying the whole accessibility cost on the platform where it applied and
// getting the benefit on neither.
//
// The double-tap-zoom delay those parameters were really suppressing is a
// per-element concern, and `touch-action: manipulation` handles it without
// taking the gesture away from anyone.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

function viewportMeta(html) {
  const m = html.match(/<meta\s+name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

suite('accessibility: pinch-zoom is never taken away', () => {
  test('the app viewport does not disable user scaling', () => {
    const content = viewportMeta(read('index.html'));
    assert.truthy(content, 'index.html must still declare a viewport');
    assert.falsy(/user-scalable\s*=\s*no/i.test(content),
      'user-scalable=no locks Android Chrome out of zooming (WCAG 1.4.4)');
    assert.falsy(/maximum-scale/i.test(content),
      'maximum-scale caps the zoom a child with low vision needs');
    assert.falsy(/minimum-scale/i.test(content),
      'minimum-scale would clamp zoom-out the same way');
  });

  test('the layout contract the viewport still has to carry survives', () => {
    const content = viewportMeta(read('index.html'));
    assert.truthy(/width\s*=\s*device-width/.test(content), 'the app is still laid out to the device');
    assert.truthy(/initial-scale\s*=\s*1(\.0)?/.test(content), 'it must still open at 1:1');
    assert.truthy(/viewport-fit\s*=\s*cover/.test(content),
      'safe-area insets depend on this (tests/ipad-layout.test.js)');
  });

  test('taps still feel instant, and the fix stays per element', () => {
    // Removing user-scalable=no re-arms double-tap-to-zoom, which is what puts
    // the ~300ms wait back on a tap. `touch-action: manipulation` removes that
    // wait on the CONTROLS without removing the gesture from the page — which
    // is also the trap: putting the same declaration on `*`, `html` or `body`
    // would take pinch-zoom away again through CSS instead of through the meta
    // tag, and be exactly as inaccessible.
    const css = read('css/styles.css');
    assert.truthy(/touch-action:\s*manipulation/.test(css),
      'controls must opt out of double-tap zoom');
    for (const sel of ['*', 'html, body', 'body']) {
      const at = css.indexOf('\n        ' + sel + ' {');
      if (at < 0) continue;
      const block = css.slice(at, css.indexOf('}', at));
      assert.falsy(/touch-action/.test(block),
        'the `' + sel + '` reset must not set touch-action — that kills pinch-zoom app-wide');
    }
  });

  test('the surfaces that own their touches still say so themselves', () => {
    // The drawing canvas and the Toán board overlay must keep their own, more
    // specific rules — they are what stop a two-finger drag panning the page
    // away from the header, and they never depended on the meta tag.
    const css = read('css/styles.css');
    const overlay = css.slice(css.indexOf('.math-board-overlay {'), css.indexOf('.math-board-overlay.hidden'));
    assert.truthy(/touch-action:\s*pan-x pan-y/.test(overlay),
      'the board overlay forbids pinch-zoom on its own, class selector beats element selector');
    assert.truthy(/touch-action:\s*none/.test(css), 'the canvas still owns every touch inside it');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
