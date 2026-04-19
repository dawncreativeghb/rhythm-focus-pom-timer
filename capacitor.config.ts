import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.rhythmfocus',
  appName: 'Rhythm Focus',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
};

export default config;
