import { test, expect, openRoute, chooseChapter } from './support/fixtures';
import { pageRoutes } from './support/routes';

test('reader moves through every chapter and Archive from the header', async ({ page }) => {
	await openRoute(page, '/landschaft');
	const trigger = page.getByRole('button', { name: 'Chapters', exact: true });
	const nav = page.getByRole('navigation', { name: 'Chapters' });
	await trigger.click();
	await expect(nav.getByRole('link')).toHaveCount(pageRoutes.length);
	await trigger.press('Escape');
	for (const chapter of [...pageRoutes.slice(1), pageRoutes[0]]) {
		await chooseChapter(page, chapter.title);
		await expect(page).toHaveURL((url) => url.pathname === chapter.path);
		await trigger.click();
		await expect(nav.getByRole('link', { name: chapter.title, exact: true })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await trigger.press('Escape');
	}
});

test('chapter menu opens and returns focus by keyboard', async ({ page }) => {
	await openRoute(page, '/landschaft');
	const trigger = page.getByRole('button', { name: 'Chapters', exact: true });
	await trigger.focus();
	await page.keyboard.press('Enter');
	const nav = page.getByRole('navigation', { name: 'Chapters' });
	await expect(nav).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(nav).toBeHidden();
	await expect(trigger).toBeFocused();
});

test('color mode switches, persists across reload and returns to the system', async ({
	page,
	colorScheme
}) => {
	await openRoute(page, '/oberflaechen');
	const root = page.locator('html');
	const mode = page.getByRole('group', { name: 'Color mode' });
	await expect(root).toHaveAttribute('data-theme', colorScheme ?? 'light');
	await mode.getByRole('radio', { name: 'Dark' }).click();
	await expect(root).toHaveAttribute('data-theme', 'dark');
	await page.reload({ waitUntil: 'networkidle' });
	await expect(root).toHaveAttribute('data-theme', 'dark');
	await expect(mode.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
	// Keyboard: roving focus with arrows, Space selects.
	await mode.getByRole('radio', { name: 'Dark' }).focus();
	await page.keyboard.press('ArrowLeft');
	await expect(mode.getByRole('radio', { name: 'Light' })).toBeFocused();
	await page.keyboard.press('Space');
	await expect(root).toHaveAttribute('data-theme', 'light');
	await mode.getByRole('radio', { name: 'Match system' }).click();
	await expect(root).toHaveAttribute('data-theme', colorScheme ?? 'light');
	await expect(root).toHaveAttribute('data-theme-choice', 'system');
});

test('valley playback starts on demand and Stop restores the first view', async ({ page }) => {
	await openRoute(page, '/landschaft');
	const toggle = page.getByRole('button', { name: 'Play demo' });
	await expect(toggle).toBeEnabled();
	await toggle.click();
	await page.getByRole('button', { name: 'Stop demo' }).press('Enter');
	await expect(toggle).toBeEnabled();
	await expect(page.getByRole('img', { name: /Terrain view/ })).toBeVisible();
});

test('valley seeds cycle deterministically and reset restores the first seed', async ({ page }) => {
	await openRoute(page, '/landschaft#step-1');
	const reroll = page.getByRole('button', { name: 'Reroll seed' });
	const image = page.getByRole('img', { name: /An invented valley/ });
	await expect(image).toHaveAccessibleName(/seed 1201/);
	await reroll.click();
	await expect(image).toHaveAccessibleName(/seed 1301/);
	await reroll.click();
	await expect(image).toHaveAccessibleName(/seed 1409/);
	await page.getByRole('button', { name: 'Reset stage' }).click();
	await expect(image).toHaveAccessibleName(/seed 1201/);
	await reroll.click();
	await expect(image).toHaveAccessibleName(/seed 1301/);
});

test('placeholder steps keep deep links and expose their status', async ({ page }) => {
	await openRoute(page, '/stadtbau#step-1');
	const tab = page.getByRole('tab', { name: /Quads/ });
	await expect(tab).toHaveAttribute('aria-selected', 'true');
	await tab.press('ArrowRight');
	await expect(page).toHaveURL('/stadtbau#step-2');
	await page.goBack();
	await expect(tab).toHaveAttribute('aria-selected', 'true');
	await page.getByRole('button', { name: 'Demo status' }).click();
	await expect(page.getByText('Status: placeholder · demo follows')).toBeVisible();
});
