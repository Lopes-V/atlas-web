import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
  projects: [
    { name: 'setup', testMatch: /setup\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:3101' } },
    { name: 'connected', testMatch: /(?:connected|virtual)\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:3102', timezoneId: 'America/Sao_Paulo' } },
  ],
  webServer: [
    { command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3101', url: 'http://127.0.0.1:3101', reuseExistingServer: false, env: { ATLAS_ACCESS_PASSWORD: '', ATLAS_SESSION_SECRET: '', SUPABASE_URL: '', SUPABASE_SECRET_KEY: '' } },
    { command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3102', url: 'http://127.0.0.1:3102/login', reuseExistingServer: false, env: { NODE_OPTIONS: '--require ./tests/mock-supabase.cjs --require ./tests/mock-virtual-supabase.cjs', ATLAS_ACCESS_PASSWORD: '1234', ATLAS_SESSION_SECRET: 'atlas-test-session-secret-only-32-characters', SUPABASE_URL: 'https://atlas-test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_only_never_real', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only_never_real' } },
  ],
});
