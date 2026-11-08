// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Design preview only: `VISION_DESIGN_PREVIEW=1 npx expo start --web` swaps native-only modules
// for in-memory stubs so every screen renders in a browser for screenshots. Unset, this is a no-op.
if (process.env.VISION_DESIGN_PREVIEW === '1') {
  const stubs = {
    'expo-file-system': path.join(__dirname, 'design-preview/expo-file-system.js'),
    'expo-notifications': path.join(__dirname, 'design-preview/expo-notifications.js'),
    'expo-keep-awake': path.join(__dirname, 'design-preview/expo-keep-awake.js'),
  };
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && stubs[moduleName]) return { type: 'sourceFile', filePath: stubs[moduleName] };
    return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
