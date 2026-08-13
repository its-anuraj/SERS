/**
 * Safe DOMRectReadOnly polyfill — no circular deps, no Flow types
 * Metro resolver points here to replace the broken react-native internal
 */

'use strict';

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

  get top() {
    return this._height < 0 ? this._y + this._height : this._y;
  }
  get right() {
    return this._width < 0 ? this._x : this._x + this._width;
  }
  get bottom() {
    return this._height < 0 ? this._y : this._y + this._height;
  }
  get left() {
    return this._width < 0 ? this._x + this._width : this._x;
  }

  toJSON() {
    const { x, y, width, height, top, left, bottom, right } = this;
    return { x, y, width, height, top, left, bottom, right };
  }

  static fromRect(rect) {
    if (!rect) return new DOMRectReadOnly();
    return new DOMRectReadOnly(rect.x, rect.y, rect.width, rect.height);
  }

  // Compatibility shims for react-native internal usage
  __getInternalX() { return this._x; }
  __getInternalY() { return this._y; }
  __getInternalWidth() { return this._width; }
  __getInternalHeight() { return this._height; }
  __setInternalX(x) { this._x = castToNumber(x); }
  __setInternalY(y) { this._y = castToNumber(y); }
  __setInternalWidth(w) { this._width = castToNumber(w); }
  __setInternalHeight(h) { this._height = castToNumber(h); }
}

// Register on global immediately so any synchronous code that checks global.DOMRectReadOnly works
if (typeof global !== 'undefined' && !global.DOMRectReadOnly) {
  global.DOMRectReadOnly = DOMRectReadOnly;
}

module.exports = DOMRectReadOnly;
module.exports.default = DOMRectReadOnly;
module.exports.__esModule = true;
