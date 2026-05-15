import type { ExpoConfig } from 'expo/config';

const DEFAULT_APP_NAME = 'TechMD';
const DEFAULT_SLUG = 'techmd-native';
const DEFAULT_SCHEME = 'techmd';
const DEFAULT_IOS_BUNDLE_ID = 'com.techmd.native';
const DEFAULT_ANDROID_PACKAGE = 'com.techmd.native';
const DEFAULT_APP_VERSION = '1.0.0';
const DEFAULT_IOS_BUILD_NUMBER = '1';

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  return value;
}

export default (): ExpoConfig => ({
  name: readOptionalEnv('EXPO_PUBLIC_APP_NAME') ?? DEFAULT_APP_NAME,
  slug: readOptionalEnv('EXPO_PUBLIC_APP_SLUG') ?? DEFAULT_SLUG,
  version: readOptionalEnv('EXPO_PUBLIC_APP_VERSION') ?? DEFAULT_APP_VERSION,
  orientation: 'portrait',
  scheme: readOptionalEnv('EXPO_PUBLIC_APP_SCHEME') ?? DEFAULT_SCHEME,
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#001F3F',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: readOptionalEnv('EXPO_PUBLIC_IOS_BUNDLE_ID') ?? DEFAULT_IOS_BUNDLE_ID,
    buildNumber: readOptionalEnv('IOS_BUILD_NUMBER') ?? DEFAULT_IOS_BUILD_NUMBER,
  },
  android: {
    package: readOptionalEnv('EXPO_PUBLIC_ANDROID_PACKAGE') ?? DEFAULT_ANDROID_PACKAGE,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#001F3F',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: true,
  },
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: {
    typedRoutes: false,
  },
});
