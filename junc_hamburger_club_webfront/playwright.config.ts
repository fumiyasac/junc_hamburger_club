import { defineConfig, devices } from '@playwright/test'

/**
 * Next.js (3002) + User API (3100) + Admin API (8081) が起動している前提。
 * ローカルは `./scripts/dev-up.sh` → `npm run dev` or `npm run build && npm run start`。
 * CI は webfront.yml の e2e ジョブで docker compose up + next build && next start。
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,         // 管理画面の更新操作は直列で安定させる
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                   // 同上
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3002',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // CI 外: npm run dev を自動起動 (既に 3002 で動いていれば再利用)。
  // CI 内: ワークフロー側で next start を起動済みなので使わない。
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3002',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
