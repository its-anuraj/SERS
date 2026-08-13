// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const patchesDir = path.resolve(__dirname, 'patches');

// Redirect broken React Native internal DOM geometry files to our safe patches.
// This is the ONLY reliable way to fix the "DOMRectReadOnly doesn't exist"
// ReferenceError caused by circular module evaluation order in Hermes.
config.resolver = config.resolver || {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept React Native's internal DOMRectReadOnly
  if (
    moduleName.includes('dom/geometry/DOMRectReadOnly') ||
    moduleName.endsWith('DOMRectReadOnly')
  ) {
    return {
      filePath: path.join(patchesDir, 'DOMRectReadOnly.js'),
      type: 'sourceFile',
    };
  }

  // Intercept React Native's internal DOMRect (which extends DOMRectReadOnly)
  if (
    moduleName.includes('dom/geometry/DOMRect') &&
    !moduleName.includes('DOMRectReadOnly')
  ) {
    return {
      filePath: path.join(patchesDir, 'DOMRect.js'),
      type: 'sourceFile',
    };
  }

  // Fall back to default resolver for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
