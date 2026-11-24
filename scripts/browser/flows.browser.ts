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
		registryRevision: 'city-assets/2'
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
	const stroke = async () => {
		const y = box.y + box.height * 0.52;
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
	const saved = await saveSandbox(page, 'sandbox.json');

	await page.getByRole('button', { name: 'Clear', exact: true }).click();
	await expect(stage).toHaveAttribute('data-sandbox-placements', '0');
	const chooserEvent = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'Load', exact: true }).click();
	await (await chooserEvent).setFiles(saved);
	await expect(stage).toHaveAttribute('data-sandbox-placements', String(painted));
	await expect(stage).toHaveAttribute('data-sandbox-waiting', '0');
	const resaved = await saveSandbox(page, 'sandbox-restored.json');
	// The public format stores an edit log and its position. Equality preserves the
	// placement addresses, assets, parameters and seeds, including the redo history.
	const original = JSON.parse(await readFile(saved, 'utf8'));
	expect(original.strokes.length).toBeGreaterThan(0);
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

	await page.reload();
	await expect(page.getByRole('status')).toHaveCount(0, { timeout: 60_000 });
	const reloaded = (await readyStages(page, 1)).first();
	await expect(reloaded).toHaveAttribute('data-stage-view', 'plan');
	await expect(page.getByRole('combobox', { name: 'Focus', exact: true })).toHaveText(
		'Paths and rail'
	);
	await expect(
		page
			.getByRole('radiogroup', { name: 'Frame' })
			.getByRole('radio', { name: 'Quarter', exact: true })
	).toBeChecked();
});

async function saveSandbox(page: Page, filename: string) {
	const downloadEvent = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const path = journeys.info().outputPath(filename);
	await (await downloadEvent).saveAs(path);
	return path;
}
