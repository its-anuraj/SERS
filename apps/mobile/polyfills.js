/**
 * Global Web DOM Polyfills for Native Hermes JS Runtime
 * Must run BEFORE expo-router/entry or any module evaluation
 */

if (typeof global !== 'undefined') {
  if (typeof global.DOMRectReadOnly === 'undefined') {
    class DOMRectReadOnlyPolyfill {
      x = 0; y = 0; width = 0; height = 0; top = 0; right = 0; bottom = 0; left = 0;
      constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.top = y; this.right = x + width; this.bottom = y + height; this.left = x;
      }
      toJSON() {
        return { x: this.x, y: this.y, width: this.width, height: this.height, top: this.top, right: this.right, bottom: this.bottom, left: this.left };
      }
      static fromRect(r) {
        return new DOMRectReadOnlyPolyfill(r?.x, r?.y, r?.width, r?.height);
      }
    }
    global.DOMRectReadOnly = DOMRectReadOnlyPolyfill;
  }

  if (typeof global.DOMRect === 'undefined') {
    global.DOMRect = global.DOMRectReadOnly;
  }

  if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class ResizeObserverPolyfill {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (typeof global.window === 'undefined') {
    global.window = global;
  }

  if (typeof global.window.DOMRectReadOnly === 'undefined') {
    global.window.DOMRectReadOnly = global.DOMRectReadOnly;
  }
}
