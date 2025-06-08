// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// allow Metro to resolve .cjs and .mjs modules
config.resolver.sourceExts.push('cjs', 'mjs')

module.exports = config;