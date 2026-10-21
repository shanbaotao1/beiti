import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

// base: './' 兼容 GitHub Pages 项目站点(子路径)与自定义域名
export default defineConfig({
  base: './',
  define: {
    // 注入版本号与构建时间，供"版本号展示 + 更新提示"使用
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // 有新版本时弹提示，而非静默自动更新
      injectRegister: null, // 由我们在 App.tsx 手动 registerSW 以拿到 onNeedRefresh 钩子
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '背题软件',
        short_name: '背题',
        description: '手机端卡片式背题与自测',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        cleanupOutdatedCaches: true
      }
    })
  ]
})
