// These journeys protect the built site's routes, rendering and controls from browser integration
// failures that headless module tests cannot catch. Each test uses the public UI or rendered output.
// Production code must have a user-facing purpose independent of these tests.
import { expect, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { distinctPixels, journeys, open, readyStages } from './fixtures';

// SwiftShader can take more than 15 seconds to present the whole town after stage startup.
const townSwiftShaderTimeoutMs = 45_000;

const routes = [
	['/', 0],
	['/landscape', 1],
	['/city', 1],
	['/paths', 1],
	['/paths/valley', 1],
	['/supply', 0],
	['/architecture', 1],
	['/architecture/structure', 1],
	['/surfaces', 2],
	['/interface', 0],
	['/blocks', 1],
	['/content', 0],
	['/story', 0],
	['/sandbox', 1],
	['/town', 1]
] as const;

// Each chapter must open and each stage must show a frame. This catches missing routes,
// client startup failures and blank frames that module tests cannot see. No app hooks are added.
for (const [route, count] of routes) {
	journeys(`opens ${route} and renders its stages`, async ({ page }) => {
		const townSwiftShader = route === '/town' && process.env.CI === 'true';
		if (townSwiftShader) page.setDefaultTimeout(townSwiftShaderTimeoutMs);
		if (route === '/town') {
			await page.addInitScript(() => {
				const firstTownFrame = new MutationObserver(() => {
					const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-stage-ready]');
					if (!canvas || !Number(canvas.dataset.stageDrawables)) return;
					canvas.dataset.townFirstFramePending = String(
						!!document.querySelector('[role="status"]')
					);
					canvas.dataset.townFirstFrameDrawables = canvas.dataset.stageDrawables ?? '0';
					canvas.dataset.townFirstFrameHasCladding = String(
						(document.querySelector('.city-measurements')?.textContent ?? '').includes('Cladding')
					);
					firstTownFrame.disconnect();
				});
				firstTownFrame.observe(document, {
					subtree: true,
					attributes: true,
					attributeFilter: ['data-stage-frames']
				});
			});
		}
		await open(page, route);
		if (!count) return;
		const stages = await readyStages(page, count);
		if (route === '/town') {
			const townCanvas = stages.first();
			await expect(townCanvas).toHaveAttribute('data-town-first-frame-pending', 'true');
			await expect(townCanvas).toHaveAttribute('data-town-first-frame-has-cladding', 'false');
			const firstDrawables = Number(
				await townCanvas.getAttribute('data-town-first-frame-drawables')
			);
			expect(firstDrawables).toBeGreaterThan(0);
			await expect(page.getByRole('status')).toHaveCount(0, {
				timeout: townSwiftShader ? townSwiftShaderTimeoutMs : 60_000
			});
			expect(Number(await townCanvas.getAttribute('data-stage-drawables'))).toBeGreaterThan(
				firstDrawables
			);
			await expect(page.locator('.city-measurements')).toContainText('Cladding');
		}
		for (const canvas of await stages.all()) {
			expect(
				await canvas.evaluate((element: HTMLCanvasElement) => element.width * element.height)
			).toBeGreaterThan(0);
			await expect
				.poll(() => distinctPixels(canvas), {
					message: 'The stage should show more than one color',
					timeout: townSwiftShader ? townSwiftShaderTimeoutMs : undefined
				})
				.toBe(true);
		}
		if (route === '/town')
			await expect(page.getByRole('status')).toHaveCount(0, { timeout: 60_000 });
	});
}

async function choose(page: Page, control: string, option: string) {
	const trigger = page.getByRole('combobox', { name: control, exact: true });
	await trigger.click();
	await page.getByRole('option', { name: option, exact: true }).click();
	await expect(trigger).toHaveText(option);
}

const hideHud = { style: '.sandbox-hud { visibility: hidden !important; }' };

async function renderedChange(canvas: Locator, change: () => Promise<void>) {
	const before = await canvas.screenshot(hideHud);
	const frame = Number(await canvas.getAttribute('data-stage-frames'));
	await change();
	await expect
		.poll(async () => Number(await canvas.getAttribute('data-stage-frames')))
		.toBeGreaterThan(frame);
	await expect(canvas).toHaveAttribute('data-stage-ready', 'true');
	await expect.poll(async () => (await canvas.screenshot(hideHud)).equals(before)).toBe(false);
}

async function expectStageIdle(page: Page, canvas: Locator) {
	const framesAtIdle = Number(await canvas.getAttribute('data-stage-frames'));
	const idleRafs = await page.evaluate(
		() =>
			new Promise<number>((resolve) => {
				const original = window.requestAnimationFrame.bind(window);
				let scheduled = 0;
				window.requestAnimationFrame = (callback) => {
					scheduled++;
					return original(callback);
				};
				window.setTimeout(() => {
					window.requestAnimationFrame = original;
					resolve(scheduled);
				}, 200);
			})
	);
	expect(idleRafs).toBe(0);
	expect(Number(await canvas.getAttribute('data-stage-frames'))).toBe(framesAtIdle);
}

// Changing the camera must render without rebuilding geometry (R07). This catches replacement
// of GPU drawables that headless checks cannot observe. Uses the existing stage metrics.
journeys('switches landscape camera without rebuilding drawables', async ({ page }) => {
	await open(page, '/landscape');
	const canvas = (await readyStages(page, 1)).first();
	const builds = await canvas.getAttribute('data-stage-drawable-builds');
	expect(Number(builds)).toBeGreaterThan(0);
	const view = page.getByRole('radiogroup', { name: 'View' });
	for (const [name, value] of [
		['Plan', 'plan'],
		['Iso', 'iso']
	] as const) {
		const option = view.getByRole('radio', { name, exact: true });
		await option.click();
		await expect(option).toBeChecked();
		await expect(canvas).toHaveAttribute('data-stage-view', value);
		await expect(canvas).toHaveAttribute('data-stage-drawable-builds', builds ?? '');
	}
});

for (const viewport of [
	{ width: 1440, height: 900 },
	{ width: 390, height: 844 }
]) {
	journeys(
		`shows the landscape hero and controls above the fold at ${viewport.width}px`,
		async ({ page }) => {
			await page.setViewportSize(viewport);
			await open(page, '/landscape');
			const canvas = (await readyStages(page, 1)).first();
			const heroElements = [
				page.getByRole('heading', { name: 'Landscape and typography', level: 1 }),
				canvas,
				...['Meander', 'Relief', 'Runoff'].map((name) => page.getByRole('slider', { name })),
				page.getByRole('button', { name: 'New terrain' }),
				...['Iso', 'Plan'].map((name) => page.getByRole('radio', { name }))
			];
			for (const element of heroElements) {
				await expect(element).toBeInViewport({ ratio: 1 });
			}
			expect((await canvas.boundingBox())?.width).toBeGreaterThan(viewport.width * 0.85);
			await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeInViewport({
				ratio: 1
			});
			expect(await page.evaluate(() => window.scrollY)).toBe(0);
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
		}
	);
}

journeys('keeps the landscape stage and controls through fullscreen and exit', async ({ page }) => {
	await open(page, '/landscape');
	const canvas = (await readyStages(page, 1)).first();
	const original = await canvas.elementHandle();
	const builds = await canvas.getAttribute('data-stage-drawable-builds');
	expect(Number(builds)).toBeGreaterThan(0);
	const enter = page.getByRole('button', { name: 'Enter fullscreen' });
	const exit = page.getByRole('button', { name: 'Exit fullscreen' });
	const plan = page.getByRole('radio', { name: 'Plan' });

	async function expectSameStage(fullscreen: boolean, previousFrame: number) {
		await expect
			.poll(async () => Number(await canvas.getAttribute('data-stage-frames')))
			.toBeGreaterThan(previousFrame);
		await expect(page.locator('canvas')).toHaveCount(1);
		expect(await original.evaluate((element) => element === document.querySelector('canvas'))).toBe(
			true
		);
		await expect(canvas).toHaveAttribute('data-stage-drawable-builds', builds ?? '');
		expect(
			await canvas.evaluate((element) => document.fullscreenElement?.contains(element) ?? false)
		).toBe(fullscreen);
	}

	const hud = page.locator('.chapter-viewer-hud');
	async function expectFloatingBottomHud() {
		const canvasBox = await canvas.boundingBox();
		const hudBox = await hud.boundingBox();
		if (!canvasBox || !hudBox) throw new Error('Expected fullscreen canvas and HUD boxes');
		expect(hudBox.y).toBeGreaterThanOrEqual(canvasBox.y);
		expect(hudBox.y + hudBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);
		expect(hudBox.y + hudBox.height).toBeGreaterThanOrEqual(canvasBox.y + canvasBox.height * 0.6);
	}

	let previousFrame = Number(await canvas.getAttribute('data-stage-frames'));
	await enter.click();
	await expect(exit).toBeVisible();
	await expectSameStage(true, previousFrame);
	await expect(plan).toBeInViewport({ ratio: 1 });
	await expectFloatingBottomHud();
	await expectStageIdle(page, canvas);
	await plan.click();
	await expect(canvas).toHaveAttribute('data-stage-view', 'plan');
	previousFrame = Number(await canvas.getAttribute('data-stage-frames'));
	await exit.click();
	await expect(enter).toBeFocused();
	await expectSameStage(false, previousFrame);
	await expectStageIdle(page, canvas);

	await page.setViewportSize({ width: 390, height: 844 });
	previousFrame = Number(await canvas.getAttribute('data-stage-frames'));
	await enter.click();
	await expect(exit).toBeVisible();
	await expectSameStage(true, previousFrame);
	await expectFloatingBottomHud();
	await plan.focus();
	previousFrame = Number(await canvas.getAttribute('data-stage-frames'));
	await page.keyboard.press('Escape');
	await expect(enter).toBeFocused();
	await expectSameStage(false, previousFrame);
	await expect(plan).toBeChecked();
	await expect(canvas).toHaveAttribute('data-stage-view', 'plan');
	await expectStageIdle(page, canvas);
});

// A delayed first import must not replace the latest selection. Exercise the real chunks,
// exact source, keyboard activation and StageView lifecycle because Bun only runs the demos.
journeys('runs and stops lazy landscape aspects on one stage', async ({ page }) => {
	await open(page, '/landscape');
	const canvas = (await readyStages(page, 1)).first();
	const original = await canvas.elementHandle();
	const hero = page.getByRole('region', { name: 'River valley' });
	const enter = page.getByRole('button', { name: 'Enter fullscreen' });
	const width = await canvas.getAttribute('data-stage-width');
	const drawableCount = await canvas.getAttribute('data-stage-drawables');
	const meander = 'River meander';
	const relief = 'Valley relief and contours';
	const tributary = 'Tributary runoff and side-lake';
	const card = (name: string) =>
		hero.getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true }) });
	const play = (name: string) => card(name).getByRole('button', { name: `Play ${name}` });
	const disclosure = (name: string) =>
		hero.locator('details.chapter-aspect-disclosure').filter({ hasText: `Source · ${name}` });
	const source = (name: string) => page.getByRole('region', { name: `${name} source` });
	const readAspectFile = (name: string) =>
		readFile(new URL(`../../src/routes/landscape/aspects/${name}.ts`, import.meta.url), 'utf8');
	const frames = async () => Number(await canvas.getAttribute('data-stage-frames'));

	await expect(page.locator('.chapter-aspect-disclosure')).toHaveCount(0);
	await page.getByRole('button', { name: 'New terrain' }).click();
	await page.getByRole('radio', { name: 'Plan' }).click();
	await expect(hero.getByText('Seed 1301')).toBeVisible();

	const beforePlay = await frames();
	await play(meander).focus();
	await page.keyboard.press('Enter');
	await expect(disclosure(meander)).toBeVisible();
	await expect(source(meander)).toBeHidden();
	await disclosure(meander).locator('summary').focus();
	await page.keyboard.press('Enter');
	await expect(source(meander)).toBeVisible();
	expect(await source(meander).locator('code').textContent()).toBe(await readAspectFile('meander'));
	await page.keyboard.press('Space');
	await expect(source(meander)).toBeHidden();
	await expect(canvas).toHaveAttribute('aria-label', 'Plan of the isolated main river channel');
	await expect(page.locator('canvas')).toHaveCount(1);
	await expect(canvas).toHaveAttribute('data-stage-drawables', '1');
	await expect.poll(frames).toBeGreaterThan(beforePlay);
	expect(await distinctPixels(canvas)).toBe(true);
	const meanderMetric = hero.getByText('Measured sinuosity', { exact: true }).locator('..');
	await expect(meanderMetric).toContainText('1.255');
	await hero.screenshot({ path: journeys.info().outputPath('landscape-aspect-desktop.png') });

	const manifest = JSON.parse(
		await readFile(
			new URL('../../.svelte-kit/output/client/.vite/manifest.json', import.meta.url),
			'utf8'
		)
	) as Record<string, { file: string }>;
	const reliefFile = manifest['src/routes/landscape/aspects/relief.ts'].file;
	const reliefChunk = (url: URL) => url.pathname.endsWith('/' + reliefFile);
	let held = false;
	const release = Promise.withResolvers<void>();
	await page.route(reliefChunk, async (route) => {
		held = true;
		await release.promise;
		await route.continue();
	});
	try {
		await play(relief).click();
		await expect.poll(() => held).toBe(true);
		await expect(card(relief).getByRole('status')).toHaveText('Loading demo…');
		await play(tributary).click();
		await expect(disclosure(tributary)).toBeVisible();
		const loaded = page.waitForResponse((response) => reliefChunk(new URL(response.url())));
		release.resolve();
		await (await loaded).finished();
	} finally {
		release.resolve();
		await page.unroute(reliefChunk);
	}
	await expect(disclosure(tributary)).toBeVisible();
	await disclosure(tributary).locator('summary').click();
	await expect(source(tributary)).toBeVisible();
	expect(await source(tributary).locator('code').textContent()).toBe(
		await readAspectFile('tributary')
	);
	await expect(disclosure(relief)).toHaveCount(0);
	await expect(hero.getByText('Peak river discharge', { exact: true })).toBeVisible();

	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('radio', { name: 'Dark' }).click();
	await expect(canvas).toHaveAttribute('data-stage-theme', 'dark');
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
	await hero.screenshot({ path: journeys.info().outputPath('landscape-aspect-mobile-dark.png') });
	await expect(disclosure(tributary)).toBeVisible();
	await expect(disclosure(relief)).toHaveCount(0);
	await page.setViewportSize({ width: 1366, height: 900 });
	await expect(page.locator('canvas')).toHaveCount(1);

	await card(tributary)
		.getByRole('button', { name: `Stop ${tributary}` })
		.click();
	await expect(disclosure(tributary)).toHaveCount(0);
	await expect(hero.getByText('Seed 1201')).toBeVisible();
	await page.getByRole('radio', { name: 'Plan' }).click();
	await play(relief).click();
	await expect(disclosure(relief)).toBeVisible();
	await disclosure(relief).locator('summary').click();
	expect(await source(relief).locator('code').textContent()).toBe(await readAspectFile('relief'));
	await expect(hero.getByText('Contour interval', { exact: true })).toBeVisible();
	// Exiting fullscreen via Escape directly while an aspect runs stops it and restores focus.
	await enter.click();
	const fullscreen = page.locator('.chapter-viewer:fullscreen');
	await expect(fullscreen.locator('canvas')).toHaveCount(1);
	await expect(fullscreen.getByRole('button', { name: `Stop ${relief}` })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(enter).toHaveAccessibleName('Enter fullscreen');
	await expect(enter).toBeFocused();

	await expect(canvas).toHaveAttribute('data-stage-view', 'iso');
	await expect(canvas).toHaveAttribute('data-stage-width', width ?? '');
	await expect(canvas).toHaveAttribute('data-stage-drawables', drawableCount ?? '');
	await expect(hero.getByText('Seed 1201')).toBeVisible();
	await expect(page.locator('.chapter-aspect-disclosure')).toHaveCount(0);
	await expect(page.locator('canvas')).toHaveCount(1);
	expect(await original.evaluate((element) => element === document.querySelector('canvas'))).toBe(
		true
	);

	// Wait beyond the comparison delay to catch both an idle frame loop and an uncancelled timer.
	const idleFrames = await frames();
	const idleRafs = await page.evaluate(
		() =>
			new Promise<number>((resolve) => {
				const original = window.requestAnimationFrame.bind(window);
				let scheduled = 0;
				window.requestAnimationFrame = (callback) => {
					scheduled++;
					return original(callback);
				};
				window.setTimeout(() => {
					window.requestAnimationFrame = original;
					resolve(scheduled);
				}, 2800);
			})
	);
	expect(idleRafs).toBe(0);
	expect(await frames()).toBe(idleFrames);
	await expect(page.locator('.chapter-aspect-disclosure')).toHaveCount(0);

	// Same-route query navigation cancels an active aspect and shows the requested seed-42 plan.
	await play(meander).click();
	await expect(disclosure(meander)).toBeVisible();
	await page.getByRole('link', { name: 'Side-lake example', exact: true }).click();
	await expect(page).toHaveURL(/seed=42&relief=1&view=plan/);
	await expect(page.locator('.chapter-aspect-disclosure')).toHaveCount(0);
	await expect(hero.getByText('Seed 42')).toBeVisible();
	await expect(canvas).toHaveAttribute('data-stage-view', 'plan');
	expect(await original.evaluate((element) => element === document.querySelector('canvas'))).toBe(
		true
	);

	// Navigating away mid-aspect cleans up timers and stage resources with zero leaked frames.
	await play(tributary).click();
	await expect(disclosure(tributary)).toBeVisible();
	await page.getByRole('link', { name: 'City Design System', exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('canvas')).toHaveCount(0);
	const postNavRafs = await page.evaluate(
		() =>
			new Promise<number>((resolve) => {
				const original = window.requestAnimationFrame.bind(window);
				let scheduled = 0;
				window.requestAnimationFrame = (callback) => {
					scheduled++;
					return original(callback);
				};
				window.setTimeout(() => {
					window.requestAnimationFrame = original;
					resolve(scheduled);
				}, 200);
			})
	);
	expect(postNavRafs).toBe(0);
});

// City tabs and focus must change the displayed subject. This catches dead controls
// and stale renders in the page wiring. Module tests cover the focus policy. No hooks are added.
journeys('switches city steps and focuses on parcels', async ({ page }) => {
	await open(page, '/city');
	const canvas = (await readyStages(page, 1)).first();
	for (const [step, label] of [
		['Plan', 'City plan showing pedestrian lanes, bridges and holdings'],
		['Districts', 'Stepped district heights above the city plan'],
		['Lattice', 'Continuous carrier lattice under the stepped district envelope']
	] as const) {
		const tab = page.getByRole('tab', { name: step, exact: true });
		await renderedChange(canvas, () => tab.click());
		await expect(tab).toHaveAttribute('aria-selected', 'true');
		await expect(canvas).toHaveAccessibleName(label);
	}
	await renderedChange(canvas, () => choose(page, 'Focus', 'Parcels'));
	await expect(canvas).toHaveAccessibleName(
		'City plan showing pedestrian lanes, bridges and holdings'
	);
});

for (const viewport of [
	{ width: 1440, height: 900 },
	{ width: 390, height: 844 }
]) {
	journeys(
		`keeps the city hero and fullscreen HUD usable at ${viewport.width}px`,
		async ({ page }) => {
			await page.setViewportSize(viewport);
			await page.emulateMedia({ colorScheme: viewport.width === 390 ? 'dark' : 'light' });
			await open(page, '/city?seed=42&step=01');
			const canvas = (await readyStages(page, 1)).first();
			const hero = page.locator('.city-hero');
			const tabs = hero.getByRole('tablist', { name: 'City steps' });
			const plan = tabs.getByRole('tab', { name: 'Plan', exact: true });
			const lattice = tabs.getByRole('tab', { name: 'Lattice', exact: true });
			const enter = hero.getByRole('button', { name: 'Enter fullscreen' });
			const exit = hero.getByRole('button', { name: 'Exit fullscreen' });
			const focus = hero.getByRole('combobox', { name: 'Focus', exact: true });
			const disclosure = page.locator('.city-specialist-panel > summary');
			const terrainSliders = ['Meander', 'Relief', 'Runoff'].map((name) =>
				page.getByRole('slider', { name, exact: true })
			);
			const profile = page.getByRole('radiogroup', { name: 'Profile' });
			const view = hero.getByRole('radiogroup', { name: 'View' });
			const overflow = () => page.evaluate(() => document.documentElement.scrollWidth);

			for (const control of [
				canvas,
				tabs,
				hero.getByRole('combobox', { name: 'Plan grid' }),
				focus,
				view,
				enter
			]) {
				await expect(control).toBeInViewport({ ratio: 1 });
			}
			expect((await canvas.boundingBox())?.width).toBeGreaterThan(viewport.width * 0.85);
			expect(await overflow()).toBe(viewport.width);
			expect(await page.evaluate(() => scrollY)).toBe(0);
			await expect(plan).toHaveAttribute('aria-selected', 'true');
			for (const slider of terrainSliders) await expect(slider).toBeHidden();
			await disclosure.click();
			for (const slider of terrainSliders) await expect(slider).toBeVisible();
			await expect(profile).toHaveCount(0);
			await tabs.getByRole('tab', { name: 'Districts' }).click();
			await expect(profile.getByRole('radio', { name: 'Auto' })).toBeChecked();
			await profile.getByRole('radio', { name: 'True scale' }).click();
			await expect(profile.getByRole('radio', { name: 'True scale' })).toBeChecked();
			await disclosure.click();
			for (const slider of terrainSliders) await expect(slider).toBeHidden();
			await expect(profile).toBeHidden();
			await lattice.click();
			await page.evaluate(() => window.scrollTo(0, 0));
			await expect(hero.getByRole('combobox', { name: 'Lattice' })).toBeInViewport({ ratio: 1 });
			await expect(enter).toBeInViewport({ ratio: 1 });
			expect(await overflow()).toBe(viewport.width);

			await view.getByRole('radio', { name: 'Plan' }).click();
			await expect(canvas).toHaveAttribute('data-stage-view', 'plan');
			await renderedChange(canvas, () => canvas.press('ArrowRight'));
			await enter.focus();
			const pannedFrame = await canvas.screenshot();
			const original = await canvas.elementHandle();
			const builds = await canvas.getAttribute('data-stage-drawable-builds');
			const frames = async () => Number(await canvas.getAttribute('data-stage-frames'));
			async function expectSameStage(previousFrame: number) {
				await expect.poll(frames).toBeGreaterThan(previousFrame);
				await expect(page.locator('canvas')).toHaveCount(1);
				expect(
					await original.evaluate((element) => element === document.querySelector('canvas'))
				).toBe(true);
				await expect(canvas).toHaveAttribute('data-stage-drawable-builds', builds ?? '');
				await expect(canvas).toHaveAttribute('data-stage-view', 'plan');
			}

			const fullscreen = hero.locator('.chapter-viewer:fullscreen');
			let before = await frames();
			await enter.click();
			await expect(fullscreen.locator('canvas')).toHaveCount(1);
			// Headless Chromium initially enters fullscreen at its virtual display size.
			await page.setViewportSize(viewport);
			await expect
				.poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
				.toEqual(viewport);
			await expectSameStage(before);
			const canvasBox = await canvas.boundingBox();
			const hudBox = await fullscreen.locator('.chapter-viewer-hud').boundingBox();
			if (!canvasBox || !hudBox) throw new Error('Expected fullscreen canvas and HUD boxes');
			expect(hudBox.x).toBeGreaterThan(canvasBox.x);
			expect(hudBox.x + hudBox.width).toBeLessThan(canvasBox.x + canvasBox.width);
			expect(hudBox.y).toBeGreaterThan(canvasBox.y + canvasBox.height / 2);
			expect(hudBox.y + hudBox.height).toBeLessThan(canvasBox.y + canvasBox.height);
			await expectStageIdle(page, canvas);

			await choose(page, 'Focus', 'Parcels');
			await choose(page, 'Focus', 'All');
			before = await frames();
			await exit.click();
			await expect(enter).toBeFocused();
			await expect(fullscreen).toHaveCount(0);
			await expectSameStage(before);
			await expectStageIdle(page, canvas);
			expect((await canvas.screenshot()).equals(pannedFrame)).toBe(true);
		}
	);
}

// Readouts must follow the pointer, while drawable builds wait for a commit.
// Taper must render during the gesture and reuse existing geometry.
journeys('commits city geometry sliders and previews taper live', async ({ page }) => {
	await open(page, '/city?seed=42&city=1000&height=21&complexity=0&taper=-1');
	const canvas = (await readyStages(page, 1)).first();
	const paint = () => page.screenshot();
	const stageCount = async (name: 'builds' | 'drawable-builds' | 'frames') =>
		Number(await canvas.getAttribute(`data-stage-${name}`));
	const inputs = [
		{ label: 'City size', values: ['1600', '2800', '3800'] },
		{ label: 'Height', values: ['35', '49', '63'] },
		{ label: 'Complexity', values: ['0.17', '0.33', '0.5'] },
		{ label: 'Taper', values: ['-0.75', '-0.25', '0'] }
	];
	for (const { label, values } of inputs) {
		const slider = page.getByRole('slider', { name: label, exact: true });
		await slider.scrollIntoViewIfNeeded();
		await paint();
		const initialBatches = await stageCount('builds');
		const initialBuilds = await stageCount('drawable-builds');
		const track = await slider.locator('..').boundingBox();
		const thumb = await slider.boundingBox();
		if (!track || !thumb) throw new Error(`Cannot locate the ${label} slider`);
		const min = Number(await slider.getAttribute('aria-valuemin'));
		const max = Number(await slider.getAttribute('aria-valuemax'));
		const y = thumb.y + thumb.height / 2;
		await page.mouse.move(thumb.x + thumb.width / 2, y);
		await page.mouse.down();
		for (const value of values) {
			const frames = await stageCount('frames');
			const fraction = (Number(value) - min) / (max - min);
			await page.mouse.move(track.x + track.width * fraction, y);
			await expect(slider).toHaveText(value);
			if (label === 'Taper') {
				await expect.poll(() => stageCount('frames')).toBeGreaterThan(frames);
			}
			await paint();
			expect(await stageCount('builds'), `${label} build batches while dragging`).toBe(
				initialBatches
			);
			expect(await stageCount('drawable-builds'), `${label} while dragging`).toBe(initialBuilds);
		}
		await page.mouse.up();
		if (label !== 'Taper') {
			await expect.poll(() => stageCount('builds')).toBe(initialBatches + 1);
			expect(await stageCount('drawable-builds')).toBeGreaterThan(initialBuilds);
		}
		await paint();
		expect(await stageCount('builds'), `${label} cumulative stage builds for one gesture`).toBe(
			label === 'Taper' ? initialBatches : initialBatches + 1
		);
		if (label === 'Taper') {
			expect(await stageCount('drawable-builds'), 'Taper must reuse existing drawables').toBe(
				initialBuilds
			);
		}
	}

	const size = page.getByRole('slider', { name: 'City size', exact: true });
	const builds = await stageCount('drawable-builds');
	await size.press('ArrowRight');
	await expect(size).toHaveText('4000');
	await expect.poll(() => stageCount('drawable-builds')).toBeGreaterThan(builds);

	const citySummary = async () => {
		const measurements = await page.locator('.city-measurements').innerText();
		const focus = page.getByRole('combobox', { name: 'Focus', exact: true });
		await focus.click();
		await expect(page.getByRole('option', { name: 'Parcels', exact: true })).toBeVisible();
		const choices = await page.getByRole('option').allTextContents();
		await page.keyboard.press('Escape');
		return { measurements, choices, active: await focus.innerText() };
	};
	const committed = await citySummary();
	await open(page, '/city?seed=42&city=4000&height=63&complexity=0.5&taper=0');
	await readyStages(page, 1);
	expect(await citySummary()).toEqual(committed);
	for (const { label, values } of inputs.slice(1)) {
		await expect(page.getByRole('slider', { name: label, exact: true })).toHaveText(
			values[values.length - 1]
		);
	}
	await expect(size).toHaveText('4000');

	await page.getByRole('link', { name: 'City', exact: true }).click();
	await expect(page).toHaveURL(/\/city$/);
	for (const [label, value] of [
		['City size', '1800'],
		['Height', '105'],
		['Complexity', '0.35'],
		['Taper', '1']
	]) {
		await expect(page.getByRole('slider', { name: label, exact: true })).toHaveText(value);
	}
});

// Surface controls must update the plates and both stage displays. This catches a disconnected
// level or switch after hydration. Geometry tests cannot exercise the controls. No hooks are added.
journeys('changes the surface plate level and transparency', async ({ page }) => {
	await open(page, '/surfaces');
	const stages = await (await readyStages(page, 2)).all();
	const builds = await Promise.all(
		stages.map((canvas) => canvas.getAttribute('data-stage-drawable-builds'))
	);
	for (const count of builds) expect(Number(count)).toBeGreaterThan(0);
	const plates = page.getByRole('region', { name: 'Sample plates' });
	const transparency = plates.getByRole('switch', { name: 'Transparency' });
	for (const display of ['transparency', 'normal'] as const) {
		await transparency.click();
		await expect(transparency).toHaveAttribute('aria-checked', String(display === 'transparency'));
		for (const [index, canvas] of stages.entries()) {
			await expect(canvas).toHaveAttribute('data-stage-display', display);
			await expect(canvas).toHaveAttribute('data-stage-drawable-builds', builds[index] ?? '');
		}
	}
	const triangles = plates.getByText(/^Largest plate /);
	const before = await triangles.textContent();
	const plain = plates.getByRole('radio', { name: 'Plain', exact: true });
	await plain.click();
	await expect(plain).toBeChecked();
	await expect(triangles).not.toHaveText(before ?? '');
});

// Filtering must show the selected specimen kind and reset must restore the complete list.
// This catches stale results that the asset registry's tests cannot detect. No hooks are added.
journeys('filters the specimen list and restores all assets', async ({ page }) => {
	await open(page, '/blocks');
	const specimens = page
		.getByRole('list', { name: 'Specimens' })
		.getByRole('listitem')
		.filter({ visible: true });
	const all = await specimens.allInnerTexts();
	expect(all.length).toBeGreaterThan(1);
	await choose(page, 'Asset kind', 'Houses');
	const houses = await specimens.allInnerTexts();
	expect(houses.length).toBeGreaterThan(0);
	expect(houses.length).toBeLessThan(all.length);
	for (const item of houses) expect(item).toMatch(/\bhouse\/\S+/);
	await choose(page, 'Asset kind', 'Parks');
	await expect(specimens).toHaveText([/Grove.*park\/grove/s]);
	await choose(page, 'Asset kind', 'All kinds');
	await expect(specimens).toHaveText(all, { useInnerText: true });
});

// The browser's save must carry the same revisions as the Bun default-town contract.
journeys('saves the default town with engine-portable revisions', async ({ page }) => {
	await open(page, '/sandbox');
	await readyStages(page, 1);
	const saved = await saveSandbox(page, 'sandbox.json');
	expect(JSON.parse(await readFile(saved, 'utf8')).world).toMatchObject({
		terrainRevision: '["valley",4,1201,{"sinuosity":1.15,"relief":0,"runoff":1}]',
		topologyRevision: '2992ab70a4f9fad2',
		registryRevision: 'city-assets/3'
	});
});

// Painting and erasing change the document, and history and file actions preserve its contents.
// This catches broken pointer handling, queue drains and file wiring beyond model tests.
// Inputs are real mouse strokes and a browser download. No app hooks are added.
journeys('paints, erases, uses history and reloads the saved sandbox', async ({ page }) => {
	await open(page, '/sandbox');
	const canvas = (await readyStages(page, 1)).first();
	const stage = page.locator('[data-sandbox-placements]');
	const placements = async () => Number(await stage.getAttribute('data-sandbox-placements'));
	const erase = page.getByRole('radio', { name: 'Erase', exact: true });
	const plan = page.getByRole('radio', { name: 'Plan', exact: true });
	await expect(stage).toHaveAttribute('data-sandbox-placements', '0');
	await plan.click();
	await expect(plan).toBeChecked();

	await expect(canvas).toHaveAttribute('data-stage-view', 'plan');
	await canvas.scrollIntoViewIfNeeded();
	const box = await canvas.boundingBox();
	if (!box) throw new Error('The sandbox canvas has no bounds');
	const stroke = async (row = 0.52) => {
		const y = box.y + box.height * row;
		await page.mouse.move(box.x + box.width * 0.35, y);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * 0.65, y, { steps: 16 });
		await page.mouse.up();
	};
	const beforePaint = await canvas.screenshot(hideHud);
	await stroke();
	await expect.poll(placements).toBeGreaterThan(0);
	await expect(page.getByRole('status')).toContainText(/\b[1-9]\d* houses? placed\b/);
	await expect(stage).toHaveAttribute('data-sandbox-waiting', '0');
	// Park the pointer off the canvas so the hover contour clears before comparing drawn houses.
	await page.mouse.move(0, 0);
	await expect.poll(async () => (await canvas.screenshot(hideHud)).equals(beforePaint)).toBe(false);
	const painted = await placements();

	await erase.click();
	await stroke();
	await expect.poll(placements).toBeLessThan(painted);
	await expect(page.getByRole('status')).toContainText(/\b[1-9]\d* houses? erased\b/);
	const erased = await placements();
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(stage).toHaveAttribute('data-sandbox-placements', String(painted));
	await page.getByRole('button', { name: 'Redo', exact: true }).click();
	await expect(stage).toHaveAttribute('data-sandbox-placements', String(erased));

	// Save the restored, nonempty document even when the erase stroke crossed all painted parcels.
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(stage).toHaveAttribute('data-sandbox-placements', String(painted));
	await expect(stage).toHaveAttribute('data-sandbox-waiting', '0');

	await page.getByRole('radio', { name: 'Paint', exact: true }).click();
	const grove = page.getByRole('radio', { name: 'Grove', exact: true });
	await grove.click();
	await expect(grove).toBeChecked();
	for (const row of [0.59, 0.45, 0.66]) {
		await stroke(row);
		if ((await placements()) > painted) break;
	}
	await expect.poll(placements).toBeGreaterThan(painted);
	await expect(page.getByRole('status')).toContainText(/\b[1-9]\d* groves? placed\b/);
	await expect(stage).toHaveAttribute('data-sandbox-waiting', '0');
	const mixed = await placements();
	const saved = await saveSandbox(page, 'sandbox.json');

	await page.getByRole('button', { name: 'Clear', exact: true }).click();
	await expect(stage).toHaveAttribute('data-sandbox-placements', '0');
	const chooserEvent = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'Load', exact: true }).click();
	await (await chooserEvent).setFiles(saved);
	await expect(stage).toHaveAttribute('data-sandbox-placements', String(mixed));
	await expect(stage).toHaveAttribute('data-sandbox-waiting', '0');
	const resaved = await saveSandbox(page, 'sandbox-restored.json');
	// The public format stores an edit log and its position. Equality preserves the
	// placement addresses, assets, parameters and seeds, including the redo history.
	const original = JSON.parse(await readFile(saved, 'utf8'));
	const saveText = JSON.stringify(original.strokes);
	expect(saveText).toContain('house/court-neutral');
	expect(saveText).toContain('park/grove');
	expect(JSON.parse(await readFile(resaved, 'utf8'))).toEqual(original);
});

journeys(
	'previews sandbox storey drags and Plan levels without editing the town',
	async ({ page }) => {
		await open(page, '/sandbox');
		const canvas = (await readyStages(page, 1)).first();
		const stage = page.locator('[data-sandbox-placements]');
		const status = page.getByRole('status');
		await canvas.scrollIntoViewIfNeeded();
		const box = await canvas.boundingBox();
		if (!box) throw new Error('The sandbox canvas has no bounds');

		// Paint existing stock first so both preview modes run over a populated town and
		// preserve the complete saved sandbox/3 document verbatim.
		await page.getByRole('radio', { name: 'Plan', exact: true }).click();
		await expect(canvas).toHaveAttribute('data-stage-view', 'plan');
		const paintY = box.y + box.height * 0.52;
		await page.mouse.move(box.x + box.width * 0.35, paintY);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * 0.65, paintY, { steps: 12 });
		await page.mouse.up();
		await expect
			.poll(async () => Number(await stage.getAttribute('data-sandbox-placements')))
			.toBeGreaterThan(0);
		await expect(stage).toHaveAttribute('data-sandbox-waiting', '0');
		const beforeFile = await saveSandbox(page, 'sandbox-before-preview.json');
		const beforeDoc = JSON.parse(await readFile(beforeFile, 'utf8'));
		expect(beforeDoc.strokes.length).toBeGreaterThan(0);

		await page.getByRole('radio', { name: '3D', exact: true }).click();
		await expect(canvas).toHaveAttribute('data-stage-view', 'iso');
		await page.getByRole('radio', { name: 'Preview storeys', exact: true }).click();
		const baseCount = Number(await canvas.getAttribute('data-stage-drawables'));
		const x = box.x + box.width * 0.46;
		const y = box.y + box.height * 0.52;
		const startDrag = async (steps: number) => {
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.mouse.move(x, y - box.height * 0.22, { steps });
			await expect(status).toContainText(/Previewing storeys \d+–\d+/);
			await expect(canvas).toHaveAttribute('data-stage-drawables', String(baseCount + 1));
			return status.innerText();
		};
		const fast = await startDrag(1);
		await page.mouse.up();
		await expect(status).toContainText('Drag up or down on a fine cell');
		await expect(canvas).toHaveAttribute('data-stage-drawables', String(baseCount));
		expect(await startDrag(12)).toBe(fast);
		await canvas.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
		await page.mouse.up();
		await expect(status).toContainText('Drag up or down on a fine cell');
		await expect(canvas).toHaveAttribute('data-stage-drawables', String(baseCount));

		await page.getByRole('radio', { name: 'Plan', exact: true }).click();
		await expect(canvas).toHaveAttribute('data-stage-view', 'plan');
		await page.mouse.click(box.x + box.width * 0.42, y);
		await expect(status).toContainText('Previewing storey 1');
		await choose(page, 'Storey', '2');
		await expect(status).toContainText('Previewing storey 2');
		await expect(canvas).toHaveAttribute('data-stage-drawables', String(baseCount + 1));
		const afterFile = await saveSandbox(page, 'sandbox-after-preview.json');
		expect(JSON.parse(await readFile(afterFile, 'utf8'))).toEqual(beforeDoc);
		await page.getByRole('radio', { name: '3D', exact: true }).click();
		await expect(page.getByRole('combobox', { name: 'Storey', exact: true })).toHaveCount(0);
		await expect(canvas).toHaveAttribute('data-stage-drawables', String(baseCount));
	}
);

// Town review controls must preserve combined URL selections across reloads without rebuilding
// house geometry on focus switches. Catches broken shallow routing or dropped query params.
journeys('preserves town review focus, frame and view across reloads', async ({ page }) => {
	if (process.env.CI === 'true') {
		journeys.setTimeout(120_000);
		page.setDefaultTimeout(townSwiftShaderTimeoutMs);
	}
	await open(page, '/town');
	await expect(page.getByRole('status')).toHaveCount(0, { timeout: 60_000 });
	const canvas = (await readyStages(page, 1)).first();
	const builds = await canvas.getAttribute('data-stage-drawable-builds');
	expect(Number(builds)).toBeGreaterThan(0);

	await choose(page, 'Focus', 'Paths and rail');
	await page
		.getByRole('radiogroup', { name: 'Frame' })
		.getByRole('radio', { name: 'Quarter', exact: true })
		.click();
	await page
		.getByRole('radiogroup', { name: 'View' })
		.getByRole('radio', { name: 'Plan', exact: true })
		.click();

	await expect(canvas).toHaveAttribute('data-stage-view', 'plan');
	await expect(canvas).toHaveAttribute('data-stage-drawable-builds', builds ?? '');
	await expect(page).toHaveURL(/focus=paths/);
	await expect(page).toHaveURL(/frame=quarter/);
	await expect(page).toHaveURL(/view=plan/);
	await page.getByRole('switch', { name: 'Transparency' }).click();
	await expect(canvas).toHaveAttribute('data-stage-display', 'transparency');
	await expect(canvas).toHaveAttribute('data-stage-drawable-builds', builds ?? '');
	await expect(page).toHaveURL(/display=transparency/);

	// Structure is built lazily on first selection and then cached across focus switches.
	const beforeStructure = Number(await canvas.getAttribute('data-stage-frames'));
	await choose(page, 'Focus', 'Structure');
	await expect
		.poll(async () => Number(await canvas.getAttribute('data-stage-frames')))
		.toBeGreaterThan(beforeStructure);
	const withStructureBuilds = await canvas.getAttribute('data-stage-drawable-builds');
	expect(Number(withStructureBuilds)).toBeGreaterThan(Number(builds));
	await choose(page, 'Focus', 'Paths and rail');
	await expect(canvas).toHaveAttribute('data-stage-drawable-builds', withStructureBuilds ?? '');
	await expect(page).toHaveURL(/focus=paths/);

	await page.reload();
	await expect(page.getByRole('status')).toHaveCount(0, { timeout: 60_000 });
	const reloaded = (await readyStages(page, 1)).first();
	await expect(reloaded).toHaveAttribute('data-stage-view', 'plan');
	await expect(reloaded).toHaveAttribute('data-stage-display', 'transparency');
	await expect(page.getByRole('combobox', { name: 'Focus', exact: true })).toHaveText(
		'Paths and rail'
	);
	await expect(
		page
			.getByRole('radiogroup', { name: 'Frame' })
			.getByRole('radio', { name: 'Quarter', exact: true })
	).toBeChecked();
});

// Protects the stage's three.js demand-render and teardown lifecycle on upgrades: a mounted stage
// must render a frame, stay idle without spinning requestAnimationFrame, and release cleanly on unmount.
journeys('renders on demand, stays idle and tears down cleanly after unmount', async ({ page }) => {
	await open(page, '/landscape');
	const canvas = (await readyStages(page, 1)).first();
	const framesAtIdle = Number(await canvas.getAttribute('data-stage-frames'));
	expect(framesAtIdle).toBeGreaterThan(0);

	const idleRafs = await page.evaluate(
		() =>
			new Promise<number>((resolve) => {
				const original = window.requestAnimationFrame.bind(window);
				let scheduled = 0;
				window.requestAnimationFrame = (callback) => {
					scheduled++;
					return original(callback);
				};
				window.setTimeout(() => {
					window.requestAnimationFrame = original;
					resolve(scheduled);
				}, 250);
			})
	);
	expect(idleRafs).toBe(0);
	expect(Number(await canvas.getAttribute('data-stage-frames'))).toBe(framesAtIdle);

	await page.getByRole('link', { name: 'City Design System', exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('canvas[data-stage-ready]')).toHaveCount(0);
	const postUnmountRafs = await page.evaluate(
		() =>
			new Promise<number>((resolve) => {
				const original = window.requestAnimationFrame.bind(window);
				let scheduled = 0;
				window.requestAnimationFrame = (callback) => {
					scheduled++;
					return original(callback);
				};
				window.setTimeout(() => {
					window.requestAnimationFrame = original;
					resolve(scheduled);
				}, 150);
			})
	);
	expect(postUnmountRafs).toBe(0);
});

// Direct acceptance URLs on /paths/valley must activate after hydration instead of keeping the
// prerendered default town framing. Protects the preserved #63/#64 acceptance views.
journeys('applies /paths/valley acceptance query views after hydration', async ({ page }) => {
	await open(page, '/paths/valley');
	const defaultWidth = Number(
		await (await readyStages(page, 1)).first().getAttribute('data-stage-width')
	);

	await open(page, '/paths/valley?extent=valley');
	const valleyStage = (await readyStages(page, 1)).first();
	await expect(
		page.getByRole('radiogroup', { name: 'Extent' }).getByRole('radio', { name: 'Valley' })
	).toBeChecked();
	expect(Number(await valleyStage.getAttribute('data-stage-width'))).toBeGreaterThan(defaultWidth);

	await open(page, '/paths/valley?route=on&frame=route');
	const routeStage = (await readyStages(page, 1)).first();
	await expect(
		page
			.getByRole('radiogroup', { name: 'Portal to station route' })
			.getByRole('radio', { name: 'Show' })
	).toBeChecked();
	const routeStats = await page.locator('.city-measurements').innerText();
	expect(routeStats).toContain('Route');
	expect(routeStats).toContain('Climb');
	const routeWidth = Number(await routeStage.getAttribute('data-stage-width'));

	await open(page, '/paths/valley?frame=dock');
	const dockStage = (await readyStages(page, 1)).first();
	const dockWidth = Number(await dockStage.getAttribute('data-stage-width'));
	expect(dockWidth).toBeLessThan(defaultWidth);

	await open(page, '/paths/valley?frame=crossing');
	const crossingStage = (await readyStages(page, 1)).first();
	const crossingWidth = Number(await crossingStage.getAttribute('data-stage-width'));
	expect(crossingWidth).toBeLessThan(defaultWidth);
	expect(new Set([defaultWidth, routeWidth, dockWidth, crossingWidth]).size).toBeGreaterThan(2);
});

async function saveSandbox(page: Page, filename: string) {
	const downloadEvent = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const path = journeys.info().outputPath(filename);
	await (await downloadEvent).saveAs(path);
	return path;
}
