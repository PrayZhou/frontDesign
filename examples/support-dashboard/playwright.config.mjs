import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['generated.spec.mjs', 'dashboard.spec.mjs'],
  workers: 2,
  use: {
    baseURL: new URL('./', import.meta.url).href,
    channel: process.env.PW_CHANNEL || undefined,
  },
});
