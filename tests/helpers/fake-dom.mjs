// Minimal DOM stand-in so page controllers can be imported and driven under node --test.
export class El {
  constructor(id) {
    this.id = id; this.children = []; this.listeners = {}; this.style = {}; this.dataset = {};
    this.value = ''; this.checked = false; this.files = []; this._text = ''; this.innerHTML = '';
    const set = new Set();
    this.classList = {
      add: c => set.add(c),
      remove: c => set.delete(c),
      toggle: (c, f) => { const on = f === undefined ? !set.has(c) : f; if (on) set.add(c); else set.delete(c); return on; },
      contains: c => set.has(c),
    };
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this.children = []; }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  appendChild(c) { this.children.push(c); return c; }
  replaceChildren(...c) { this.children = c; }
  querySelector() { return new El(); }
  click() { return this.fire('click'); }
  fire(t, ev = {}) { return Promise.all((this.listeners[t] || []).map(fn => fn({ preventDefault() {}, stopPropagation() {}, ...ev }))); }
}
export function installDom() {
  const els = new Map();
  globalThis.document = {
    getElementById: id => { if (!els.has(id)) els.set(id, new El(id)); return els.get(id); },
    createElement: () => new El(),
    querySelectorAll: () => [],
    body: new El('body'),
  };
  return els;
}
export const tick = (n = 5) => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : setImmediate(f)); setImmediate(f); });
export const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
export const until = async (fn, ms = 2000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timeout waiting for condition'); await new Promise(r => setTimeout(r, 5)); } };
