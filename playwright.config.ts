import { defineConfig, devices } from '@playwright/test'

// e2e держим отдельно от vitest (test/**). прогон: npm run test:e2e
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // /app это spa, dev-сервер компилит его на первый заход — на холодном ci
  // это дольше, поэтому запас по таймауту и ретрай на случай медленного старта
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: { DATABASE_URL: ':memory:' },
  },
})
