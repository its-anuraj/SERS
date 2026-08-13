/**
 * Global Web DOM Polyfills for Native Hermes JS Runtime
 * Must run synchronously via CommonJS require BEFORE expo-router loads.
 * These are also the fallback if Metro resolver patch ever misses anything.
 */

'use strict';

// ── DOMRectReadOnly ─────────────────────────────────────────────────────────
function castToNumber(value) {
  return value ? Number(value) : 0;
}

class DOMRectReadOnly {
  constructor(x, y, width, height) {
    this._x = castToNumber(x);
    this._y = castToNumber(y);
    this._width = castToNumber(width);
    this._height = castToNumber(height);
  }
  get x() { return this._x; }
  get y() { return this._y; }
  get width() { return this._width; }
  get height() { return this._height; }
  get top() { return this._height < 0 ? this._y + this._height : this._y; }
  get right() { return this._width < 0 ? this._x : this._x + this._width; }
  get bottom() { return this._height < 0 ? this._y : this._y + this._height; }
  get left() { return this._width < 0 ? this._x + this._width : this._x; }
  toJSON() {
    return { x: this._x, y: this._y, width: this._width, height: this._height, top: this.top, right: this.right, bottom: this.bottom, left: this.left };
  }
  static fromRect(r) {
    return new DOMRectReadOnly(r && r.x, r && r.y, r && r.width, r && r.height);
  }
  // Shims used by react-native internals
  __getInternalX() { return this._x; }
  __getInternalY() { return this._y; }
  __getInternalWidth() { return this._width; }
  __getInternalHeight() { return this._height; }
  __setInternalX(v) { this._x = castToNumber(v); }
  __setInternalY(v) { this._y = castToNumber(v); }
  __setInternalWidth(v) { this._width = castToNumber(v); }
  __setInternalHeight(v) { this._height = castToNumber(v); }
}

// ── DOMRect ─────────────────────────────────────────────────────────────────
class DOMRect extends DOMRectReadOnly {
  get x() { return this.__getInternalX(); }
  set x(v) { this.__setInternalX(v); }
  get y() { return this.__getInternalY(); }
  set y(v) { this.__setInternalY(v); }
  get width() { return this.__getInternalWidth(); }
  set width(v) { this.__setInternalWidth(v); }
  get height() { return this.__getInternalHeight(); }
  set height(v) { this.__setInternalHeight(v); }
  static fromRect(r) {
    if (!r) return new DOMRect();
    return new DOMRect(r.x, r.y, r.width, r.height);
  }
}

// ── ResizeObserver ───────────────────────────────────────────────────────────
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// ── Install on every global object Hermes exposes ───────────────────────────
var targets = [
  typeof global !== 'undefined' ? global : null,
  typeof globalThis !== 'undefined' ? globalThis : null,
];

for (var i = 0; i < targets.length; i++) {
  var t = targets[i];
  if (!t) continue;
  try {
    // Always overwrite — we want OUR safe version, not RN's broken one
    t.DOMRectReadOnly = DOMRectReadOnly;
    t.DOMRect = DOMRect;
    if (!t.ResizeObserver) t.ResizeObserver = ResizeObserver;
  } catch (e) {
    // Silently ignore if property is non-writable in this context
  }
}
