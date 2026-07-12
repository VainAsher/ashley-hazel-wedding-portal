import { defineConfig, devices } from '@playwright/test'

const port = process.env.PLAYWRIGHT_PORT ?? '3100'
const baseURL = `http://127.0.0.1:${port}`
const isWindows = process.platform === 'win32'

export default defineConfig({
  testDir: './tests/browser',
  // CI runners share CPU across parallel workers hitting one dev server;
  // one retry absorbs that environment noise without masking a real bug —
  // local runs stay at 0 so a genuine regression fails immediately.
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: isWindows
      ? `set PLAYWRIGHT_PORT=${port} && npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`
      : `PLAYWRIGHT_PORT=${port} npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    reuseExistingServer: false,
    timeout: 30_000,
    url: baseURL,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 900 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
})
