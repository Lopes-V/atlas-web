import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /setup\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:3101' } },
    { name: 'connected', testMatch: /connected\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:3102' } },
  ],
  webServer: [
    { command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3101', url: 'http://127.0.0.1:3101', reuseExistingServer: false, env: { ATLAS_ACCESS_PASSWORD: '', ATLAS_SESSION_SECRET: '', SUPABASE_URL: '', SUPABASE_SECRET_KEY: '' } },
    { command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3102', url: 'http://127.0.0.1:3102/login', reuseExistingServer: false, env: { NODE_OPTIONS: '--require ./tests/mock-supabase.cjs', ATLAS_ACCESS_PASSWORD: 'atlas-test-password-only', ATLAS_SESSION_SECRET: 'atlas-test-session-secret-only-32-characters', SUPABASE_URL: 'https://atlas-test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_only_never_real' } },
  ],
});
