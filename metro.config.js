// Lets the web build load SQLite's WebAssembly file (used for previewing Clink in a browser)
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

module.exports = config;
