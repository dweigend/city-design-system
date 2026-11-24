// Step 0 picture pass: every route, the town review's focus and framing choices, dark theme and
// phone shots on the hardware GPU, with labelled contact sheets and an evidence file.
// Run after `bun run build`:
//   heavy-slot --exclusive --mem 4G --time 900 --wait 900 -- bun scripts/step0-shots.ts [--out dir]
import { chromium, type Page } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { git, integration, requireSlot } from './experiment-host';
import { shots, sizes, type Shot } from './step0-shot-list';

requireSlot();
const { values } = parseArgs({
	args: process.argv.slice(2),
	options: { out: { type: 'string' } }
});
const folder = resolve(values.out ?? resolve(integration, '_lokal/step0-screenshots'));
const builtTimeoutMs = 120_000;
const settleMs = 400;

/** Serves this checkout's build on a free loopback port and resolves its address. */
function servePreview() {
	const server = spawn(
		'bun',
		['run', 'preview', '--host', '127.0.0.1', '--port', '0', '--strictPort'],
		{
			stdio: ['ignore', 'pipe', 'inherit'],
			detached: true
		}
	);
	const origin = new Promise<string>((done, fail) => {
		let output = '';
		server.stdout.on('data', (chunk) => {
			output += String(chunk);
			const found = output.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/);
			if (found) done(found[1]);
		});
		server.on('exit', (code) => fail(Error('Preview exited with ' + code)));
	});
	return {
		origin,
		stop: () => {
			if (!server.pid) return;
			try {
				process.kill(-server.pid, 'SIGTERM');
			} catch {
				// The preview already exited before teardown.
			}
		}
	};
}

function fileName({ route, size, theme }: Shot) {
	const slug =
		route
			.replace(/^\//, '')
			.replace(/[^a-z0-9]+/gi, '-')
			.replace(/-$/, '') || 'home';
	return `${size}-${theme}-${slug}.png`;
}

/** Paints three strokes of houses in plan view, then returns to the 3D view. */
async function paintSandbox(page: Page) {
	const stage = page.locator('[data-sandbox-placements]');
	const canvas = page.locator('canvas[data-stage-ready="true"]').first();
	await page.getByRole('radio', { name: 'Plan', exact: true }).click();
	await page.locator('canvas[data-stage-view="plan"]').waitFor();
	await canvas.waitFor({ timeout: builtTimeoutMs });
	const box = await canvas.boundingBox();
	if (!box) throw Error('The sandbox canvas has no bounds');
	for (const share of [0.42, 0.52, 0.62]) {
		const y = box.y + box.height * share;
		await page.mouse.move(box.x + box.width * 0.3, y);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * 0.7, y, { steps: 16 });
		await page.mouse.up();
	}
	await page.mouse.move(0, 0);
	await page.getByRole('radio', { name: '3D', exact: true }).click();
	await page.locator('canvas[data-stage-view="iso"]').waitFor();
	await page.waitForFunction(
		() =>
			document.querySelector('[data-sandbox-waiting]')?.getAttribute('data-sandbox-waiting') === '0'
	);
	return Number(await stage.getAttribute('data-sandbox-placements'));
}

/** Waits until every expected stage canvas has drawn and its frame count stops moving. */
async function settle(page: Page, expectedStages: number, route: string) {
	const building = page.getByRole('status').filter({ hasText: /^Building/ });
	await building.waitFor({ state: 'detached', timeout: builtTimeoutMs });
	if (!expectedStages) return;
	await page.waitForFunction(
		(count) => document.querySelectorAll('canvas[data-stage-ready="true"]').length === count,
		expectedStages,
		{ timeout: builtTimeoutMs }
	);
	const deadline = performance.now() + builtTimeoutMs;
	let previous = '';
	while (performance.now() < deadline) {
		const frames = await page.$$eval('canvas', (all) =>
			all.map((c) => c.dataset.stageFrames).join()
		);
		if (frames === previous) return;
		previous = frames;
		await page.waitForTimeout(settleMs);
	}
	throw Error(`Stage frames did not settle on ${route} (last frames: ${previous})`);
}

async function capture(
	browser: Awaited<ReturnType<typeof chromium.launch>>,
	origin: string,
	shot: Shot
) {
	const [width, height] = sizes[shot.size];
	const page = await browser.newPage({
		viewport: { width, height },
		colorScheme: shot.theme,
		reducedMotion: 'reduce'
	});
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push('console: ' + message.text());
	});
	page.on('pageerror', (error) => errors.push('page: ' + error.message));
	await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
		route.fulfill({ status: 200, body: '' })
	);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Performance.enable');
	let peakHeapBytes = 0;
	const sample = setInterval(async () => {
		try {
			const { metrics } = await cdp.send('Performance.getMetrics');
			const used = metrics.find(({ name }) => name === 'JSHeapUsedSize')?.value ?? 0;
			peakHeapBytes = Math.max(peakHeapBytes, used);
		} catch {
			// The page closed between samples.
		}
	}, 250);
	try {
		const start = performance.now();
		const response = await page.goto(new URL(shot.route, origin).href, { timeout: builtTimeoutMs });
		if (!response?.ok()) throw Error('Could not open ' + shot.route);
		await page.evaluate(() => document.fonts.ready);
		await settle(page, shot.stages, shot.route);
		const readyMs = Math.round(performance.now() - start);
		const placements = shot.route === '/sandbox' ? await paintSandbox(page) : undefined;
		if (placements !== undefined) await settle(page, shot.stages, shot.route);
		const stages = await page.$$eval('canvas[data-stage-ready]', (all) =>
			all.map(({ dataset }) => ({ ...dataset }))
		);
		if (stages.length !== shot.stages)
			throw Error(`Expected ${shot.stages} ready stage(s) on ${shot.route}, got ${stages.length}`);
		for (const stage of stages)
			if (
				stage.stageHardware !== 'true' ||
				!/amd|radeon/i.test(stage.stageAdapter ?? '') ||
				/swiftshader|llvmpipe|lavapipe|software/i.test(stage.stageAdapter ?? '')
			)
				throw Error(`Hardware proof failed on ${shot.route}: ${stage.stageAdapter}`);
		const image = fileName(shot);
		await page.screenshot({ path: resolve(folder, image), animations: 'disabled' });
		const frame = page.locator('.frame').filter({ has: page.locator('canvas[data-stage-ready]') });
		const stageImage = stages.length ? image.replace(/\.png$/, '-stage.png') : undefined;
		if (stageImage)
			await frame.first().screenshot({ path: resolve(folder, stageImage), animations: 'disabled' });
		const pageTheme = await page.evaluate(() => document.documentElement.dataset.theme);
		console.log(shot.size, shot.theme, shot.route, stages[0]?.stageAdapter ?? '', readyMs + ' ms');
		return {
			...shot,
			image,
			stageImage,
			finalUrl: page.url(),
			pageTheme,
			readyMs,
			peakHeapBytes,
			placements,
			errors,
			stages
		};
	} finally {
		clearInterval(sample);
		await page.close();
	}
}

function contactSheet(
	name: string,
	records: readonly { image: string; route: string; theme: string }[],
	geometry: string,
	tile: string
) {
	execFileSync(
		'montage',
		[
			'-font',
			'DejaVu-Sans',
			'-pointsize',
			'15',
			...records.flatMap(({ image, route, theme }) => [
				'-label',
				`${route} · ${theme}`,
				resolve(folder, image)
			]),
			'-geometry',
			geometry,
			'-tile',
			tile,
			'-background',
			'#f4f1ea',
			resolve(folder, name)
		],
		{ stdio: 'inherit' }
	);
	return name;
}

mkdirSync(folder, { recursive: true });
const preview = servePreview();
const records: Awaited<ReturnType<typeof capture>>[] = [];
let browserVersion: string | undefined;
try {
	const origin = await preview.origin;
	const browser = await chromium.launch({
		channel: 'chrome',
		chromiumSandbox: true,
		ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
		env: { ...process.env, VK_DRIVER_FILES: '/usr/share/vulkan/icd.d/radeon_icd.json' },
		args: [
			'--use-angle=vulkan',
			'--use-vulkan=native',
			'--enable-features=Vulkan',
			'--enable-unsafe-webgpu',
			'--ignore-gpu-blocklist',
			'--enable-precise-memory-info'
		]
	});
	browserVersion = browser.version();
	try {
		for (const shot of shots) records.push(await capture(browser, origin, shot));
	} finally {
		await browser.close();
	}
} finally {
	preview.stop();
}

const sheetOf = (sheet: string) => records.filter((record) => record.sheet === sheet);
const stageOf = (sheet: string) =>
	sheetOf(sheet).map((record) => ({ ...record, image: record.stageImage ?? record.image }));
const sheets = [
	contactSheet('contact-routes.png', sheetOf('routes'), '560x350+6+6', '4x'),
	contactSheet('contact-town-focus.png', stageOf('town-focus'), '640x360+6+6', '3x'),
	contactSheet('contact-town-frames.png', stageOf('town-frames'), '640x360+6+6', '2x'),
	contactSheet('contact-dark.png', sheetOf('dark'), '560x350+6+6', '4x'),
	contactSheet('contact-phone.png', sheetOf('phone'), '240x520+6+6', '5x')
];
const errors = records.flatMap(({ route, errors }) => errors.map((error) => `${route}: ${error}`));
const evidence = {
	revision: git('.', 'rev-parse', 'HEAD'),
	browser: browserVersion,
	adapters: [
		...new Set(records.flatMap(({ stages }) => stages.map((stage) => stage.stageAdapter)))
	],
	consoleErrors: errors,
	sheets,
	records
};
await Bun.write(resolve(folder, 'evidence.json'), JSON.stringify(evidence, null, 2));
console.log(folder);
if (errors.length) {
	console.error(errors.join('\n'));
	process.exitCode = 1;
}
