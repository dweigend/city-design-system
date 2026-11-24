import type { Browser } from '@playwright/test';
import { driveFrames, measuredRss, openChrome, openRoute } from './chrome';
import { nextFrame, readFrames, settledFrame, startFrames } from './frames';
import { round } from './host';
import { townFixtures } from './pipeline';
import { strokePath } from './stroke';

const interactions = 20;
const paintParcels = 30;
const wholeTown = '/architecture?sheet=town&block=all';

type Route = Awaited<ReturnType<typeof openRoute>>;

async function withRoute<T>(
	browser: Browser,
	origin: URL,
	path: string,
	run: (route: Route) => Promise<T>
) {
	console.log(`Measuring ${path}`);
	const route = await openRoute(browser, new URL(path, origin));
	try {
		const result = await run(route);
		route.checkErrors();
		return { adapter: route.adapter, firstFrameMs: route.firstFrameMs, ...result };
	} finally {
		await route.context.close();
	}
}

async function architecture({ page, canvas, heapMiB }: Route) {
	await canvas.focus();
	const { index } = await startFrames(page);
	await driveFrames(page, interactions, (i) =>
		page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight')
	);
	return {
		...(await readFrames(page, index)),
		drawCalls: Number(await canvas.getAttribute('data-stage-draw-calls')),
		heapMiB: await heapMiB()
	};
}

async function sandbox(
	{ page, canvas, heapMiB }: Route,
	fixtures: ReturnType<typeof townFixtures>
) {
	await page.getByRole('radio', { name: 'Plan', exact: true }).click();
	await page.waitForFunction(() =>
		Boolean(document.querySelector('canvas[data-stage-view="plan"]'))
	);
	await canvas.scrollIntoViewIfNeeded();
	const box = await canvas.boundingBox();
	if (!box) throw new Error('Missing sandbox canvas bounds');
	const { path, hover: hoverPoints } = strokePath(
		fixtures,
		box,
		Number(await canvas.getAttribute('data-stage-width')),
		paintParcels
	);
	const x = Math.round(box.x + box.width * 0.5);
	const y = Math.round(box.y + box.height * 0.52);
	await canvas.focus();
	await page.keyboard.press('v');
	await page.mouse.move(x, y);
	await page.mouse.down();
	const panStart = await startFrames(page);
	await driveFrames(page, interactions, (i) => page.mouse.move(x + (i % 2 ? 4 : -4), y));
	const pan = await readFrames(page, panStart.index);
	await page.mouse.up();

	const zoomStart = await startFrames(page);
	await driveFrames(page, interactions, (i) => page.mouse.wheel(0, i % 2 ? -40 : 40));
	const zoom = await readFrames(page, zoomStart.index);

	const reset = await startFrames(page);
	await page.keyboard.press('Home');
	await nextFrame(page, reset.index);
	await page.keyboard.press('b');

	const hoverStart = await startFrames(page);
	if (hoverPoints.length < 2) throw new Error('No distinct parcels for hovering');
	await driveFrames(page, interactions, (i) =>
		page.mouse.move(...hoverPoints[i % hoverPoints.length])
	);
	const hover = await readFrames(page, hoverStart.index);

	const first = path[0];
	await page.mouse.move(...first);
	const paintStart = await startFrames(page);
	await page.mouse.down();
	for (const point of path.slice(1)) {
		await page.mouse.move(...point);
		await page.waitForTimeout(17);
	}
	await page.mouse.up();
	const painted = await settledFrame(page, paintStart, paintParcels);
	const paint = {
		...(await readFrames(page, paintStart.index, painted.at)),
		wallMs: round(painted.at - paintStart.ms),
		parcels: paintParcels,
		tilePacks: painted.chunks - paintStart.chunks,
		drawCalls: painted.drawCalls,
		heapMiB: await heapMiB()
	};

	const undoStart = await startFrames(page);
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	const undone = await settledFrame(page, undoStart, 0);
	return { pan, zoom, hover, paint, undo: { wallMs: round(undone.at - undoStart.ms) } };
}

async function load(
	{ page, heapMiB }: Route,
	save: ReturnType<typeof townFixtures>['saves'][number],
	sampleRss: () => Promise<number>
) {
	return measuredRss(sampleRss, async () => {
		const start = await startFrames(page);
		const chooser = page.waitForEvent('filechooser');
		await page.getByRole('button', { name: 'Load', exact: true }).click();
		await (
			await chooser
		).setFiles({
			name: 'town.json',
			mimeType: 'application/json',
			buffer: Buffer.from(save.contents)
		});
		const frame = await settledFrame(page, start, save.count);
		return {
			houses: save.count,
			wallMs: round(frame.at - start.ms),
			drawCalls: frame.drawCalls,
			tilePacks: frame.chunks - start.chunks,
			heapMiB: await heapMiB()
		};
	});
}

export async function measureBrowser(origin: URL) {
	const fixtures = townFixtures();
	Bun.gc(true);
	const { browser, environment, sampleRss } = await openChrome();
	try {
		const city = await withRoute(browser, origin, '/city', async () => ({}));
		const architectureTown = await withRoute(
			browser,
			origin,
			'/architecture?sheet=town&block=town',
			async () => ({})
		);
		const town = await withRoute(browser, origin, wholeTown, (route) =>
			measuredRss(sampleRss, () => architecture(route))
		);
		const sand = await withRoute(browser, origin, '/sandbox', (route) =>
			measuredRss(sampleRss, () => sandbox(route, fixtures))
		);
		const loads = [];
		for (const save of fixtures.saves) {
			console.log(`Loading ${save.count} house placements`);
			loads.push(
				await withRoute(browser, origin, '/sandbox', (route) => load(route, save, sampleRss))
			);
		}
		return {
			environment,
			city,
			architectureTown,
			architecture: { route: wholeTown, ...town },
			sandbox: sand,
			loads
		};
	} finally {
		await browser.close();
	}
}
