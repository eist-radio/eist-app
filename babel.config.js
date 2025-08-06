module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', {
        // Disable the old reanimated plugin from the preset
        reanimated: false
      }]
    ],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
        allowUndefined: false,
      }]
    ],
  };
};
