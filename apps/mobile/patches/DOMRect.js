/**
 * Safe DOMRect polyfill — does not extend DOMRectReadOnly via import,
 * instead it references it from global to avoid circular deps in Hermes.
 * Metro resolver points here to replace the broken react-native internal.
 */

'use strict';

const DOMRectReadOnly = require('./DOMRectReadOnly');

class DOMRect extends DOMRectReadOnly {
  get x() { return this.__getInternalX(); }
  set x(x) { this.__setInternalX(x); }

  get y() { return this.__getInternalY(); }
  set y(y) { this.__setInternalY(y); }

  get width() { return this.__getInternalWidth(); }
  set width(width) { this.__setInternalWidth(width); }

  get height() { return this.__getInternalHeight(); }
  set height(height) { this.__setInternalHeight(height); }

  static fromRect(rect) {
    if (!rect) return new DOMRect();
    return new DOMRect(rect.x, rect.y, rect.width, rect.height);
  }
}

// Register on global immediately
if (typeof global !== 'undefined' && !global.DOMRect) {
  global.DOMRect = DOMRect;
}

module.exports = DOMRect;
module.exports.default = DOMRect;
module.exports.__esModule = true;
