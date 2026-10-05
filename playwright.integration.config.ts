import { defineConfig } from '@playwright/test';
export default defineConfig({
    testMatch: /quote-workflow\.spec\.ts/,
    timeout: 180000,
    workers: 1,
    use: { channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true, actionTimeout: 30000, trace: 'off' },
});
