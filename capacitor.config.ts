import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.danbaotao.beiti',
  appName: '背题软件',
  webDir: 'dist',
  server: {
    // 用 https scheme，让 WebView 处于安全上下文，PWA 的 service worker 也能正常注册
    androidScheme: 'https',
  },
};

export default config;
