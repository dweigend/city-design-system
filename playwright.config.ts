import { defineConfig, devices } from '@playwright/test';

/**
 * Browser scenarios of the design bible (Chromium only).
 * Specs are named `*.e2e.ts` so `bun test` never collects them.
 * The suite starts its own dev server on a dedicated port and never reuses a foreign one.
 * Screenshot evidence is opt-in: `EVIDENCE_DIR=<path> bun run test:browser`.
 */
const PORT = 5191;
const desktop = { width: 1366, height: 768 };
const narrow = { width: 390, height: 844 };
const chrome = devices['Desktop Chrome'];

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	globalTeardown: './e2e/support/evidence-teardown.ts',
	outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'node_modules/.cache/playwright-results',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: process.env.CI ? 2 : 4,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	reporter: [['list']],
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'retain-on-failure',
		// Software WebGL in headless Chromium: visual evidence only, never performance evidence (DS-73).
		launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
	},
	projects: [
		{
			name: 'desktop-light',
			use: { ...chrome, viewport: desktop, colorScheme: 'light' }
		},
		{
			name: 'desktop-dark',
			use: { ...chrome, viewport: desktop, colorScheme: 'dark' }
		},
		{
			name: 'narrow-light',
			use: { ...chrome, viewport: narrow, colorScheme: 'light' }
		},
		{
			name: 'narrow-dark',
			use: { ...chrome, viewport: narrow, colorScheme: 'dark' }
		},
		{
			name: 'desktop-light-reduced-motion',
			use: { ...chrome, viewport: desktop, colorScheme: 'light', reducedMotion: 'reduce' }
		}
	],
	webServer: {
		command: `bunx vite dev --host 127.0.0.1 --port ${PORT} --strictPort`,
		url: `http://127.0.0.1:${PORT}/`,
		reuseExistingServer: false,
		timeout: 120_000,
		stdout: 'ignore',
		stderr: 'pipe'
	}
});
