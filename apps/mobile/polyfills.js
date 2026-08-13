/**
 * Global Web DOM Polyfills for Native Hermes JS Runtime
 * Must run synchronously via CommonJS require BEFORE expo-router loads
 */

(function () {
  function createDOMRectClass() {
    return class DOMRectReadOnly {
      x = 0; y = 0; width = 0; height = 0; top = 0; right = 0; bottom = 0; left = 0;
      constructor(x, y, width, height) {
        this.x = Number(x) || 0;
        this.y = Number(y) || 0;
        this.width = Number(width) || 0;
        this.height = Number(height) || 0;
        this.top = this.y;
        this.right = this.x + this.width;
        this.bottom = this.y + this.height;
        this.left = this.x;
      }
      toJSON() {
        return { x: this.x, y: this.y, width: this.width, height: this.height, top: this.top, right: this.right, bottom: this.bottom, left: this.left };
      }
      static fromRect(r) {
        return new DOMRectReadOnly(r?.x, r?.y, r?.width, r?.height);
      }
    };
  }

  const DOMRectClass = createDOMRectClass();

  const targets = [
    typeof global !== 'undefined' ? global : null,
    typeof globalThis !== 'undefined' ? globalThis : null,
    typeof window !== 'undefined' ? window : null,
  ];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (!t) continue;
    try {
      if (typeof t.DOMRectReadOnly === 'undefined') {
        Object.defineProperty(t, 'DOMRectReadOnly', {
          value: DOMRectClass,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      }
      if (typeof t.DOMRect === 'undefined') {
        Object.defineProperty(t, 'DOMRect', {
          value: DOMRectClass,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      }
      if (typeof t.ResizeObserver === 'undefined') {
        class ResizeObserverPolyfill {
          observe() {}
          unobserve() {}
          disconnect() {}
        }
        Object.defineProperty(t, 'ResizeObserver', {
          value: ResizeObserverPolyfill,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      }
    } catch (e) {
      t.DOMRectReadOnly = DOMRectClass;
      t.DOMRect = DOMRectClass;
    }
  }
})();
