// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// In a monorepo, multiple node_modules copies of React can co-exist,
// causing "Invalid hook call" / "useState of null" runtime crashes.
// Force Metro to always resolve these critical packages from the workspace
// root node_modules so only ONE copy is ever bundled.
const workspaceRoot = path.resolve(__dirname, '../..');

config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  // Single source of truth for React
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-dom': path.resolve(workspaceRoot, 'node_modules/react-dom'),
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
  'react-native-web': path.resolve(workspaceRoot, 'node_modules/react-native-web'),
};

// Make sure Metro watches the workspace root as well as the project dir
config.watchFolders = [
  workspaceRoot,
];

module.exports = config;
