import { test, expect, openRoute, followLink, projectName } from './support/fixtures';
import { chapterRoutes } from './support/routes';
import { installLifecycleProbe, lifecycleStats, framesDuring } from './support/lifecycle';

/**
 * Mount → navigate away → back, by client-side navigation (no reload): demos must remount
 * cleanly, leave no extra canvases behind and stop all rendering after unmount.
 * Theme does not change lifecycle; runs in the two light viewports.
 */
test.beforeEach(() => {
	test.skip(!/^(desktop|narrow)-light$/.test(projectName()), 'lifecycle runs in light viewports');
});

test('chapters remount without errors or leftover canvases', async ({ page }) => {
	test.setTimeout(180_000);
	await installLifecycleProbe(page);
	await openRoute(page, '/archiv');
	const firstVisit = new Map<string, number>();
	for (const round of [0, 1]) {
		for (const route of [...chapterRoutes, { path: '/formen/haus' }]) {
			if (route.path === '/formen/haus') await followLink(page, '/formen');
			await followLink(page, route.path);
			const { canvases } = await lifecycleStats(page);
			if (round === 0) firstVisit.set(route.path, canvases);
			else
				expect(canvases, `canvases on ${route.path} after remount`).toBe(
					firstVisit.get(route.path)
				);
		}
	}
	await followLink(page, '/archiv');
	const stats = await lifecycleStats(page);
	expect(stats.canvases).toBe(0);
	await page.waitForTimeout(300);
	expect(await framesDuring(page, 1000), 'animation frames after all demos unmounted').toBe(0);
	test.info().annotations.push({
		type: 'webgl-contexts',
		description: `created ${stats.created}, still alive after unmount (until GC) ${stats.detachedAlive}`
	});
});

test('one demo page mounted three times leaves the same scene', async ({ page }) => {
	await installLifecycleProbe(page);
	await openRoute(page, '/');
	const first = await lifecycleStats(page);
	for (let i = 0; i < 3; i++) {
		await followLink(page, '/archiv');
		expect(await framesDuring(page, 500), 'frames after unmount').toBe(0);
		await followLink(page, '/');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('City');
		expect((await lifecycleStats(page)).canvases).toBe(first.canvases);
	}
});
