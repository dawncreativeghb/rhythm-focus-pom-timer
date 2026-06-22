import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dawncreative.rhythmfocus',
  appName: 'Rhythm Focus',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    scheme: 'rhythmfocus',
  },
};

export default config;
