import type { Page } from '@playwright/test';
import { test, expect, openRoute, isNarrow, projectName } from './support/fixtures';
import { chapterRoutes } from './support/routes';

/** Representative reader flow: chapters, color mode, a seeded demo with Play/Pause and reset. */

const reducedMotion = () => projectName().includes('reduced-motion');
const motionButtons = /^(Play|Pause)( motion)?$/;

/** Opens a chapter from the header: inline links on desktop, the chapter popover on narrow screens. */
async function chooseChapter(page: Page, name: string) {
	const banner = page.getByRole('banner');
	if (isNarrow()) {
		await banner.getByRole('button', { name: /^Choose a chapter/ }).click();
		await page
			.getByRole('navigation', { name: 'Chapters' })
			.getByRole('link', { name, exact: true })
			.click();
	} else {
		await banner
			.getByRole('navigation', { name: 'Chapters' })
			.getByRole('link', { name, exact: true })
			.click();
	}
}

test('reader moves through all chapters from the header', async ({ page }) => {
	await openRoute(page, '/');
	for (const chapter of [...chapterRoutes.slice(1), chapterRoutes[0]]) {
		await chooseChapter(page, chapter.nav);
		await expect(page).toHaveURL((url) => url.pathname === chapter.path);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(chapter.title);
		const banner = page.getByRole('banner');
		if (isNarrow()) {
			await expect(
				banner.getByRole('button', { name: `Choose a chapter, current: ${chapter.nav}` })
			).toBeVisible();
		} else {
			await expect(banner.getByRole('link', { name: chapter.nav, exact: true })).toHaveAttribute(
				'aria-current',
				'page'
			);
		}
	}
});

test('chapter popover works by keyboard on narrow screens', async ({ page }) => {
	test.skip(!isNarrow(), 'the popover exists below 1200 px only');
	await openRoute(page, '/');
	const trigger = page.getByRole('button', { name: 'Choose a chapter, current: City' });
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
	await openRoute(page, '/farben');
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

test('explainer loops start paused under reduced motion and toggle on demand', async ({ page }) => {
	await openRoute(page, '/');
	const buttons = page.getByRole('button', { name: motionButtons });
	expect(await buttons.count()).toBeGreaterThan(0);
	// DS-64: under reduced motion no loop starts on its own; every toggle offers Play.
	if (reducedMotion())
		for (const button of await buttons.all()) await expect(button).toHaveAccessibleName(/^Play/);
	const demo = page.getByRole('group', { name: 'Building on existing stock' });
	const toggle = demo.getByRole('button', { name: motionButtons });
	const before = reducedMotion() ? 'Play motion' : 'Pause motion';
	const after = reducedMotion() ? 'Pause motion' : 'Play motion';
	await expect(toggle).toHaveAccessibleName(before);
	await toggle.click();
	await expect(toggle).toHaveAccessibleName(after);
	await toggle.press('Enter');
	await expect(toggle).toHaveAccessibleName(before);
});

/** The growth demo on /wachstum: image name carries seed and progress. */
function growthDemo(page: Page) {
	const controls = page.getByRole('group', { name: 'Growth in time-lapse' });
	const image = page.getByRole('img', { name: /^Paths first, seed \d+: path network after/ });
	return { controls, image };
}

async function setSeed(page: Page, seed: number) {
	const { controls, image } = growthDemo(page);
	await controls.getByRole('spinbutton', { name: 'Seed' }).fill(String(seed));
	await expect(image).toHaveAccessibleName(new RegExp(`seed ${seed}:`));
}

async function seedShown(page: Page): Promise<number> {
	const name = (await growthDemo(page).image.getAttribute('aria-label')) ?? '';
	return Number(/seed (\d+):/.exec(name)?.[1]);
}

test('seeded demo: fixed seed, deterministic reroll, reset restores the start', async ({
	page
}) => {
	await openRoute(page, '/wachstum');
	const { controls, image } = growthDemo(page);
	await expect(image).toHaveAccessibleName(/seed 1:/);
	await controls.getByRole('button', { name: 'Seed', exact: true }).click();
	await setSeed(page, 7);
	const reroll = controls.getByRole('button', { name: 'Reroll' });
	await reroll.click();
	await expect(image).not.toHaveAccessibleName(/seed 7:/);
	const next = await seedShown(page);
	expect(Number.isInteger(next)).toBe(true);
	await setSeed(page, 7);
	await reroll.click();
	await expect(image).toHaveAccessibleName(new RegExp(`seed ${next}:`));
	await controls.getByRole('button', { name: 'Reset view' }).click();
	await expect(image).toHaveAccessibleName(/seed 1:/);
	await expect(controls.getByRole('button', { name: 'Time-lapse' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
});

test('seeded demo: Play/Pause controls the time-lapse', async ({ page }) => {
	await openRoute(page, '/wachstum');
	const { controls, image } = growthDemo(page);
	await image.scrollIntoViewIfNeeded();
	const toggle = controls.getByRole('button', { name: /^(Play|Pause)$/ });
	if (!reducedMotion()) {
		await expect(toggle).toHaveAccessibleName('Pause');
		await expect
			.poll(() => image.getAttribute('aria-label'), { timeout: 15_000 })
			.not.toMatch(/after 0 %/);
		await toggle.click();
	}
	await expect(toggle).toHaveAccessibleName('Play');
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	const still = await image.getAttribute('aria-label');
	await page.waitForTimeout(500);
	expect(await image.getAttribute('aria-label'), 'paused image does not advance').toBe(still);
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(() => image.getAttribute('aria-label'), { timeout: 15_000 }).not.toBe(still);
});
