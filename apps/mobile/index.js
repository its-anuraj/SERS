/**
 * SERS Mobile Entry Point
 * CommonJS require ensures polyfills run synchronously BEFORE expo-router loads modules
 */

require('./polyfills');
require('expo-router/entry');
