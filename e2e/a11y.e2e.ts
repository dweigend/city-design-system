import { test, expect, openRoute } from './support/fixtures';
import { pageRoutes } from './support/routes';
import { unnamedNodes, walkKeyboard } from './support/a11y';

/**
 * DS-60: every control has an accessible name and is keyboard-reachable; the focus stays visible.
 * Runs in every viewport and theme to check layout and focus colors.
 */
for (const route of pageRoutes) {
	test(`page ${route.path}: names, Tab reach and visible focus`, async ({ page }) => {
		test.setTimeout(120_000);
		await openRoute(page, route.path);
		expect(await unnamedNodes(page), 'controls and images without accessible name').toEqual([]);
		const walk = await walkKeyboard(page);
		expect(walk.stops, 'Tab stops').toBeGreaterThan(3);
		expect(walk.invisibleFocus, 'Tab stops without visible focus').toEqual([]);
		expect(walk.unreached, 'tabbable controls Tab never reached').toEqual([]);
	});
}
