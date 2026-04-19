import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.rhythmfocus',
  appName: 'Rhythm Flow',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
};

export default config;
