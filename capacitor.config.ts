import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.rhythmfocus',
  appName: 'Rhythm Focus',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    scheme: 'focusflow',
  },
};

export default config;
