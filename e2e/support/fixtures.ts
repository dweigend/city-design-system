import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared fixtures of the browser scenarios.
 *
 * - `consoleGuard` (automatic): every console error and uncaught page error fails the test.
 *   Warnings are allowed; the software renderer warns about the missing WebGPU adapter.
 * - Web fonts are stubbed with an empty stylesheet, so the suite never depends on the network.
 *   Screenshot evidence (`EVIDENCE_DIR`) loads the real fonts instead.
 */
type Fixtures = { consoleGuard: void };

const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/** True when the run captures screenshot evidence (opt-in). */
export const evidenceRun = !!process.env.EVIDENCE_DIR;

export const test = base.extend<Fixtures>({
	consoleGuard: [
		async ({ page }, use) => {
			const problems: string[] = [];
			page.on('console', (message) => {
				if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
			});
			page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
			if (!evidenceRun) {
				await page.route(FONT_HOSTS, (route) =>
					route.fulfill({ status: 200, contentType: 'text/css', body: '' })
				);
			}
			await use();
			expect(problems, 'console errors and page errors').toEqual([]);
		},
		{ auto: true }
	]
});

export { expect };

/** Opens a route and waits until modules, images and fonts have settled. */
export async function openRoute(page: Page, path: string) {
	const response = await page.goto(path, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	return response;
}

/** Follows an in-page link as a reader would (client-side navigation, no reload). */
export async function followLink(page: Page, path: string) {
	await page.locator(`a[href="${path}"]`).first().dispatchEvent('click');
	await page.waitForURL((url) => url.pathname === path);
	await page.waitForLoadState('networkidle');
}

/** Name of the running project, e.g. `narrow-dark`. */
export function projectName(): string {
	return base.info().project.name;
}

/** True for the 390 px projects. */
export function isNarrow(): boolean {
	return projectName().startsWith('narrow');
}
