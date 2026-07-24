module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-class-properties'],
      ['@babel/plugin-transform-private-methods'],
      ['@babel/plugin-transform-private-property-in-object'],
      'react-native-reanimated/plugin',
    ],
  };
};
