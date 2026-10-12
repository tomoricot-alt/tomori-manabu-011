import { defineConfig } from '@playwright/test';

// スマートフォン相当の画面幅 (iPhone 13 相当のビューポート) で、ビルド済みアプリを検証する。
// ※ Chromium による確認であり、iPhone Safari 実機の確認ではない。
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
  webServer: {
    command: 'npm run build:web && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/tomori-manabu-011/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
