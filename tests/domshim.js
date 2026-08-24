// domshim.js — a DOM small enough to read, real enough to render a screen.
//
// The suite could only ever check that source text mentioned something. That
// is how a poll repainting over an open card, a habitat collapsing to zero
// height, and a result screen announcing a draw before the server had decided
// all shipped green. Those are render bugs: they need something that actually
// builds the markup and lets a test click it.
//
// The repo has no dependencies on purpose, so this is hand-rolled rather than
// jsdom: a tag-soup parser, a small selector engine, and the handful of
// element APIs the app screens actually use. It does no layout — anything
// about pixels still belongs in the browser — but it answers "what is on the
// screen, and what happens when a child taps it".
'use strict';

const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'path', 'circle', 'use']);

// ---- parsing --------------------------------------------------------------

function parseAttrs(raw) {
  const attrs = {};
  const re = /([:@a-zA-Z_][-.:\w]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(raw))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

function parse(html, ownerDoc) {
  const root = { children: [], _text: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][-\w]*)\s*>|<([a-zA-Z][-\w]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const [full, closeTag, openTag, attrRaw, text] = m;
    const top = stack[stack.length - 1];
    if (full.startsWith('<!--')) continue;
    if (closeTag) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === closeTag.toUpperCase()) { stack.length = i; break; }
      }
      continue;
    }
    if (openTag) {
      const el = new El(openTag, ownerDoc);
      const attrs = parseAttrs(attrRaw || '');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      el.parentElement = top === root ? null : top;
      top.children.push(el);
      const selfClosing = VOID_TAGS.has(openTag.toLowerCase()) || /\/\s*$/.test(attrRaw || '');
      if (!selfClosing) stack.push(el);
      continue;
    }
    if (text && text.trim()) {
      // Text is kept on the node that owns it; this shim has no text nodes,
      // which is enough for textContent and for reading a label.
      top._text = (top._text || '') + text;
    }
  }
  return root.children;
}

// ---- selectors ------------------------------------------------------------
// Supports: tag, #id, .class, [attr], [attr="value"], compounds of those, the
// descendant combinator, and comma-separated lists. That is everything the
// app's own queries use.

function parseCompound(sel) {
  const out = { tag: null, id: null, classes: [], attrs: [] };
  const re = /([a-zA-Z][-\w]*)|#([-\w]+)|\.([-\w]+)|\[([-\w:]+)(?:([~|^$*]?=)"?([^\]"]*)"?)?\]/g;
  let m;
  while ((m = re.exec(sel))) {
    if (m[1]) out.tag = m[1].toUpperCase();
    else if (m[2]) out.id = m[2];
    else if (m[3]) out.classes.push(m[3]);
    else if (m[4]) out.attrs.push([m[4].toLowerCase(), m[6] === undefined ? null : m[6]]);
  }
  return out;
}

function matchesCompound(el, c) {
  if (c.tag && el.tagName !== c.tag) return false;
  if (c.id && el.getAttribute('id') !== c.id) return false;
  for (const cls of c.classes) if (!el.classList.contains(cls)) return false;
  for (const [name, value] of c.attrs) {
    if (!el.hasAttribute(name)) return false;
    if (value !== null && el.getAttribute(name) !== value) return false;
  }
  return true;
}

function matchesSelector(el, selector) {
  return String(selector).split(',').some(part => {
    const steps = part.trim().split(/\s+/).map(parseCompound);
    if (!steps.length) return false;
    if (!matchesCompound(el, steps[steps.length - 1])) return false;
    let node = el.parentElement, i = steps.length - 2;
    while (i >= 0) {
      if (!node) return false;
      if (matchesCompound(node, steps[i])) i--;
      node = node.parentElement;
    }
    return true;
  });
}

// ---- element --------------------------------------------------------------

class El {
  constructor(tag, ownerDoc) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this._attrs = {};
    this._text = '';
    this._listeners = {};
    this.style = new Proxy({}, { get: (t, k) => t[k] || '', set: (t, k, v) => (t[k] = v, true) });
    this.ownerDocument = ownerDoc || null;
  }

  // --- attributes
  setAttribute(name, value) { this._attrs[String(name).toLowerCase()] = String(value); }
  getAttribute(name) { const v = this._attrs[String(name).toLowerCase()]; return v === undefined ? null : v; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this._attrs, String(name).toLowerCase()); }
  removeAttribute(name) { delete this._attrs[String(name).toLowerCase()]; }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get hidden() { return this.hasAttribute('hidden') && this.getAttribute('hidden') !== 'false'; }
  set hidden(v) { if (v) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  get disabled() { return this.hasAttribute('disabled') && this.getAttribute('disabled') !== 'false'; }
  set disabled(v) { if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
  get value() { return this.getAttribute('value') || ''; }
  set value(v) { this.setAttribute('value', v); }

  get classList() {
    const self = this;
    const list = () => (self.className ? self.className.split(/\s+/).filter(Boolean) : []);
    const write = arr => { self.className = arr.join(' '); };
    return {
      contains: c => list().includes(c),
      add: (...cs) => { const a = list(); for (const c of cs) if (c && !a.includes(c)) a.push(c); write(a); },
      remove: (...cs) => write(list().filter(c => !cs.includes(c))),
      toggle: (c, force) => {
        const has = list().includes(c);
        const want = force === undefined ? !has : !!force;
        if (want && !has) list().includes(c) || write(list().concat(c));
        if (!want && has) write(list().filter(x => x !== c));
        return want;
      },
    };
  }

  get dataset() {
    const self = this;
    return new Proxy({}, {
      get(_, key) { return self.getAttribute('data-' + String(key).replace(/[A-Z]/g, m => '-' + m.toLowerCase())); },
      set(_, key, value) { self.setAttribute('data-' + String(key).replace(/[A-Z]/g, m => '-' + m.toLowerCase()), value); return true; },
      has(_, key) { return self.hasAttribute('data-' + String(key).replace(/[A-Z]/g, m => '-' + m.toLowerCase())); },
    });
  }

  // --- tree
  get firstElementChild() { return this.children[0] || null; }
  get childElementCount() { return this.children.length; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  insertAdjacentHTML(where, html) {
    const nodes = parse(html, this.ownerDocument);
    if (where === 'beforeend') { for (const n of nodes) { n.parentElement = this; this.children.push(n); } }
    else if (where === 'afterbegin') { for (const n of nodes.reverse()) { n.parentElement = this; this.children.unshift(n); } }
    else if (where === 'afterend' && this.parentElement) {
      const at = this.parentElement.children.indexOf(this);
      for (const n of nodes.reverse()) { n.parentElement = this.parentElement; this.parentElement.children.splice(at + 1, 0, n); }
    }
  }
  remove() {
    if (!this.parentElement) return;
    const at = this.parentElement.children.indexOf(this);
    if (at >= 0) this.parentElement.children.splice(at, 1);
    this.parentElement = null;
  }
  closest(selector) {
    let node = this;
    while (node) { if (matchesSelector(node, selector)) return node; node = node.parentElement; }
    return null;
  }
  matches(selector) { return matchesSelector(this, selector); }

  set innerHTML(html) {
    this.children = parse(html, this.ownerDocument).map(n => { n.parentElement = this; return n; });
    this._text = '';
  }
  get innerHTML() { return this._serialize(); }
  _serialize() {
    const inner = this.children.map(c => c._outer()).join('');
    return (this._text || '') + inner;
  }
  _outer() {
    const attrs = Object.entries(this._attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
    const tag = this.tagName.toLowerCase();
    if (VOID_TAGS.has(tag)) return `<${tag}${attrs}>`;
    return `<${tag}${attrs}>${this._serialize()}</${tag}>`;
  }
  get textContent() {
    return (this._text || '') + this.children.map(c => c.textContent).join('');
  }
  set textContent(v) { this.children = []; this._text = String(v); }

  // --- queries
  _walk(fn) { for (const c of this.children) { fn(c); c._walk(fn); } }
  querySelector(selector) {
    let found = null;
    this._walk(el => { if (!found && matchesSelector(el, selector)) found = el; });
    return found;
  }
  querySelectorAll(selector) {
    const out = [];
    this._walk(el => { if (matchesSelector(el, selector)) out.push(el); });
    out.forEach = Array.prototype.forEach.bind(out);
    return out;
  }

  // --- events
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    this._listeners[type] = (this._listeners[type] || []).filter(f => f !== fn);
  }
  dispatch(type, event) {
    const ev = Object.assign({ type, target: this, stopPropagation() {}, preventDefault() {} }, event || {});
    for (const fn of this._listeners[type] || []) fn.call(this, ev);
    const inline = this['on' + type];
    if (typeof inline === 'function') inline.call(this, ev);
    // This app wires most of its buttons with onclick="mfAnswer(0)" attributes,
    // so a shim that only knows addEventListener would let a test "click"
    // things and change nothing at all — passing for the wrong reason.
    const attr = this.getAttribute('on' + type);
    const runner = this.ownerDocument && this.ownerDocument.__runInline;
    if (attr && runner) runner(attr, this, ev);
    return ev;
  }
  click() { return this.dispatch('click'); }
  focus() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  get isConnected() {
    let node = this;
    while (node.parentElement) node = node.parentElement;
    return node === (this.ownerDocument && this.ownerDocument.body) || node.tagName === 'HTML';
  }
  get offsetWidth() { return 0; }
  get offsetHeight() { return 0; }
}

// ---- document -------------------------------------------------------------

function createDocument(bodyHtml) {
  const html = new El('html');
  const body = new El('body');
  const head = new El('head');
  html.appendChild(head); html.appendChild(body);

  const doc = {
    documentElement: html, body, head,
    hidden: false, visibilityState: 'visible',
    _listeners: {},
    createElement(tag) { const el = new El(tag, doc); return el; },
    getElementById(id) { return body.querySelector('#' + id); },
    querySelector(sel) { return body.querySelector(sel); },
    querySelectorAll(sel) { return body.querySelectorAll(sel); },
    addEventListener(type, fn) { (doc._listeners[type] = doc._listeners[type] || []).push(fn); },
    removeEventListener() {},
    dispatch(type) { for (const fn of doc._listeners[type] || []) fn({ type }); },
    hasFocus() { return true; },
  };
  html.ownerDocument = body.ownerDocument = head.ownerDocument = doc;
  body.innerHTML = bodyHtml || '';
  return doc;
}

module.exports = { createDocument, El, parse, matchesSelector };
