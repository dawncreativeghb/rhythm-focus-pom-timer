import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.rhythmfocus',
  appName: 'Rhythm Focus',
  webDir: 'dist',
  server: {
    url: 'https://37956388-6962-4650-a7e8-68f572004607.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
