// These journeys protect the built site's routes, rendering and controls from browser integration
// failures that headless module tests cannot catch. Each test uses the public UI or rendered output.
// Production code must have a user-facing purpose independent of these tests.
import { expect, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { distinctPixels, journeys, open, readyStages } from './fixtures';

const routes = [
	['/', 0],
	['/landscape', 1],
	['/city', 1],
	['/paths', 1],
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
		await open(page, route);
		if (!count) return;
		// The town review builds every house on the main thread before its stage appears.
		if (route === '/town')
			await expect(page.getByRole('status')).toHaveCount(0, { timeout: 60_000 });
		const stages = await readyStages(page, count);
		for (const canvas of await stages.all()) {
			expect(
				await canvas.evaluate((element: HTMLCanvasElement) => element.width * element.height)
			).toBeGreaterThan(0);
			await expect
				.poll(() => distinctPixels(canvas), {
					message: 'The stage should show more than one color'
				})
				.toBe(true);
		}
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

// Town review controls must preserve combined URL selections across reloads without rebuilding
// house geometry on focus switches. Catches broken shallow routing or dropped query params.
journeys('preserves town review focus, frame and view across reloads', async ({ page }) => {
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

async function saveSandbox(page: Page, filename: string) {
	const downloadEvent = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const path = journeys.info().outputPath(filename);
	await (await downloadEvent).saveAs(path);
	return path;
}
