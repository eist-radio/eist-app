// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  // Remove svg from assetExts so it’s treated as source:
  config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
  // Add svg to sourceExts so the transformer picks it up:
  config.resolver.sourceExts.push('svg');
  // Point to the svg transformer:
  config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
  return config;
})();