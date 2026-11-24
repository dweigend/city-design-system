import type { Browser } from '@playwright/test';
import { protocol } from '../config/perf-baseline';
import { measuredRss, openChrome, openRoute } from './chrome';
import { driveGestures, nextFrame, readFrames, settledFrame, startFrames } from './frames';
import { round } from './host';
import { townFixtures } from './pipeline';
import { strokePath } from './stroke';

const paintParcels = protocol.perfStrokeParcels.value;
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
	const frames = await driveGestures(page, (i) =>
		page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight')
	);
	return {
		...frames,
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
	const pan = await driveGestures(page, (i) => page.mouse.move(x + (i % 2 ? 4 : -4), y), {
		async begin() {
			await page.mouse.move(x, y);
			await page.mouse.down();
		},
		end: () => page.mouse.up()
	});
	const zoom = await driveGestures(page, (i) => page.mouse.wheel(0, i % 2 ? -40 : 40));

	const reset = await startFrames(page);
	await page.keyboard.press('Home');
	await nextFrame(page, reset.index);
	await page.keyboard.press('b');

	if (hoverPoints.length < 2) throw new Error('No distinct parcels for hovering');
	const hover = await driveGestures(page, (i) =>
		page.mouse.move(...hoverPoints[i % hoverPoints.length])
	);

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
		...(await readFrames(page, [
			{ from: paintStart.index, to: (await startFrames(page)).index, through: painted.at }
		])),
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
	save: ReturnType<typeof townFixtures>['saves']['small'],
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

export async function measureBrowser(origin: URL, signal: AbortSignal) {
	signal.throwIfAborted();
	const fixtures = townFixtures();
	Bun.gc(true);
	const { browser, environment, sampleRss } = await openChrome();
	const abort = () => void browser.close().catch(() => {});
	signal.addEventListener('abort', abort, { once: true });
	try {
		signal.throwIfAborted();
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
		const readSave = (save: typeof fixtures.saves.small) => {
			signal.throwIfAborted();
			console.log(`Loading ${save.count} house placements`);
			return withRoute(browser, origin, '/sandbox', (route) => load(route, save, sampleRss));
		};
		const loads = {
			small: await readSave(fixtures.saves.small),
			town: await readSave(fixtures.saves.town)
		};
		return {
			environment,
			city,
			architectureTown,
			architecture: { route: wholeTown, ...town },
			sandbox: sand,
			loads
		};
	} finally {
		signal.removeEventListener('abort', abort);
		await browser.close();
	}
}
