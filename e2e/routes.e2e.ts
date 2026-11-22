import { test, expect, openRoute, projectName } from './support/fixtures';
import { pageRoutes, redirects } from './support/routes';

/** Every page loads with its heading and without console or page errors; old addresses redirect. */
for (const route of pageRoutes) {
	test(`page ${route.path} loads cleanly`, async ({ page }) => {
		const response = await openRoute(page, route.path);
		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.title);
		await expect(page.getByRole('banner').getByRole('button', { name: 'Chapters' })).toBeVisible();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, 'no horizontal page scroll').toBeLessThanOrEqual(0);
		if (projectName().includes('reduced-motion')) {
			// DS-64: with reduced motion no loop starts on its own.
			for (const toggle of await page.getByRole('button', { name: /^(Play|Pause)\b/ }).all()) {
				await expect(toggle).toHaveAccessibleName(/^Play/);
			}
		}
	});
}

for (const [from, to] of redirects) {
	test(`old address ${from} moves permanently to ${to}`, async ({ page }) => {
		const response = await page.request.get(from, { maxRedirects: 0 });
		expect(response.status()).toBe(308);
		await page.goto(from, { waitUntil: 'domcontentloaded' });
		await expect(page).toHaveURL((url) => url.pathname + url.hash === to);
	});
}
