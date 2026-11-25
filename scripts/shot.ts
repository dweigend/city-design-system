import { chromium, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { findIntegration, git, preview, requireSlot } from './experiment-host';

requireSlot();
const integration = findIntegration();
const shots = resolve(integration, '_lokal/rebuild-shots');
const { values, positionals } = parseArgs({
	args: process.argv.slice(2),
	allowPositionals: true,
	options: {
		revision: { type: 'string' },
		before: { type: 'string' },
		reference: { type: 'string' },
		url: { type: 'string' },
		size: { type: 'string' }
	}
});
const revision = values.revision ?? git(integration, 'rev-parse', 'HEAD');
const origin = preview(integration, revision);
const requested = values.url ? new URL(values.url, origin) : undefined;
if (requested && requested.origin !== origin)
	throw Error('URL must match the verified preview at ' + origin);
const requestedRoutes = positionals.length
	? positionals
	: requested
		? [requested.pathname + requested.search]
		: process.env.SHOT_ROUTE
			? [process.env.SHOT_ROUTE]
			: ['/', '/landscape', '/interface', '/blocks'];
const variants: Record<string, readonly string[]> = {
	'/landscape': ['?view=plan', '?sinuosity=1.04', '?sinuosity=1.28'],
	'/city': [
		'?step=01',
		'?step=02',
		'?step=03&view=plan',
		'?step=03&complexity=0.2',
		'?step=03&complexity=1.0'
	]
};
const routes = requestedRoutes.flatMap((route) =>
	values.size ? [route] : [route, ...(variants[route] ?? []).map((query) => route + query)]
);
const sizes = [
	['phone', 390, 844, 'light'],
	['desktop', 1366, 768, 'light'],
	['dark-desktop', 1366, 768, 'dark'],
	['dark-phone', 390, 844, 'dark']
] as const;
if (values.size && !sizes.some(([size]) => size === values.size))
	throw Error('Unknown shot size: ' + values.size);
const folder = resolve(shots, new Date().toISOString().replaceAll(':', '-'));
const reference = values.reference ? resolve(values.reference) : undefined;

type Capture = { route: string; size: string; image: string };
type Manifest = { revision: string; records: Capture[] };
function readManifest(directory: string): Manifest | undefined {
	const path = resolve(directory, 'manifest.json');
	if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
}

const parent = git(integration, 'rev-parse', revision + '^1');
function matchesParent(manifest: Manifest | undefined) {
	return (
		manifest?.revision === parent &&
		routes.every((route) => manifest.records.some((record) => record.route === route))
	);
}
function parentCapture() {
	if (!existsSync(shots)) return;
	return readdirSync(shots)
		.sort()
		.reverse()
		.map((name) => resolve(shots, name))
		.find((directory) => matchesParent(readManifest(directory)));
}
const before = values.before ?? parentCapture();
const previous = before ? readManifest(before) : undefined;
if (before && !matchesParent(previous))
	throw Error('Before must show the first parent of this revision and all requested routes');

mkdirSync(folder, { recursive: true });
const records = [];
const browser = await chromium.launch({
	channel: 'chrome',
	chromiumSandbox: true,
	ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
	env: { ...process.env, VK_DRIVER_FILES: '/usr/share/vulkan/icd.d/radeon_icd.json' },
	args: [
		`--unsafely-treat-insecure-origin-as-secure=${origin}`,
		'--use-angle=vulkan',
		'--use-vulkan=native',
		'--enable-features=Vulkan',
		'--enable-unsafe-webgpu',
		'--ignore-gpu-blocklist'
	]
});
try {
	for (const route of routes) {
		const url = new URL(route, origin);
		if (url.origin !== origin) throw Error('Expected a local preview route');
		const isCity = url.pathname === '/city';
		const hasStage = isCity || url.pathname === '/blocks' || url.pathname === '/landscape';
		const isVariant = (isCity || url.pathname === '/landscape') && url.search.length > 0;
		for (const [size, width, height, theme] of sizes) {
			if (values.size && values.size !== size) continue;
			if (!values.size && isVariant && size !== 'desktop') continue;
			const showChapterMenu = size === 'dark-phone' && url.pathname === '/';
			const showDarkStage = size === 'dark-desktop' && hasStage;
			if (theme === 'dark' && url.pathname !== '/interface' && !showChapterMenu && !showDarkStage)
				continue;
			const cropStage = isCity && size === 'desktop';
			const deviceScaleFactor = cropStage ? 2 : 1;
			const page = await browser.newPage({
				viewport: { width, height },
				deviceScaleFactor,
				colorScheme: theme,
				reducedMotion: 'reduce'
			});
			try {
				if (!(await page.goto(url.href, { waitUntil: 'networkidle', timeout: 120000 }))?.ok())
					throw Error('Could not open ' + url.href);
				await page.evaluate(async () => {
					await document.fonts.ready;
				});
				if (showChapterMenu) {
					await page.getByRole('button', { name: 'Chapters' }).click();
					await page.getByRole('dialog', { name: 'Chapters' }).waitFor();
				}
				const backend = hasStage ? 'webgpu' : 'webgl2';
				const renderer = hasStage ? await stageAdapter(page) : await page.evaluate(webGlRenderer);
				if (
					(!hasStage && !/amd|radeon/i.test(renderer)) ||
					/swiftshader|llvmpipe|lavapipe|software/i.test(renderer)
				)
					throw Error('Hardware proof failed: ' + renderer);

				const key = Buffer.from(route).toString('base64url') + '-' + size;
				const fullImage = key + '-full.png';
				const image = hasStage || theme === 'dark' ? fullImage : key + '.png';
				const current = resolve(folder, image);
				if (theme === 'light')
					await page.screenshot({
						path: resolve(folder, key + '.png'),
						animations: 'disabled',
						scale: 'css'
					});
				await page.screenshot({
					path: resolve(folder, fullImage),
					animations: 'disabled',
					fullPage: true,
					scale: 'css'
				});

				const stageImage = cropStage ? key + '-stage-2x.png' : undefined;
				if (stageImage)
					await page
						.locator('.frame')
						.filter({ has: page.locator('canvas[data-stage-ready]') })
						.screenshot({
							path: resolve(folder, stageImage),
							animations: 'disabled',
							scale: 'device'
						});

				const baseline = previous?.records.find((r) => r.route === route && r.size === size);
				const panels = ['-label', 'After', current];
				if (baseline && before) panels.unshift('-label', 'Before', resolve(before, baseline.image));
				if (reference && theme === 'light') panels.push('-label', 'Reference', reference);
				const sheet = panels.length > 3 ? key + '-sheet.png' : undefined;
				if (sheet) {
					execFileSync('montage', [
						'-font',
						'DejaVu-Sans',
						'-pointsize',
						'18',
						...panels,
						'-geometry',
						width + 'x' + height + '+4+4',
						'-tile',
						'x1',
						resolve(folder, sheet)
					]);
				}
				records.push({
					route,
					finalUrl: page.url(),
					size,
					width,
					height,
					theme,
					chapterMenuOpen: showChapterMenu,
					image,
					fullImage,
					stageImage,
					deviceScaleFactor,
					sheet,
					backend,
					renderer
				});
				console.log(route, size, backend, renderer);
			} finally {
				await page.close();
			}
		}
	}
} finally {
	await browser.close();
}
preview(integration, revision);
const manifest = {
	revision,
	origin,
	before,
	reference,
	reducedMotion: true,
	browser: browser.version(),
	records
};
await Bun.write(resolve(folder, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(folder);

async function stageAdapter(page: Page) {
	const ready = page.locator('canvas[data-stage-ready="true"]');
	const unavailable = page.getByRole('status').filter({ hasText: 'WebGPU' });
	await ready.or(unavailable).waitFor();
	if (await unavailable.isVisible()) throw Error('The stage could not initialise WebGPU');
	const { stageHardware, stageAdapter } = await ready.evaluate((canvas) => canvas.dataset);
	if (stageHardware !== 'true' || !stageAdapter)
		throw Error('WebGPU hardware proof failed: ' + stageAdapter);
	return stageAdapter;
}

function webGlRenderer() {
	const gl = document.createElement('canvas').getContext('webgl2');
	if (!gl) throw Error('Missing browser WebGL2 context');
	const ext = gl.getExtension('WEBGL_debug_renderer_info');
	if (!ext) throw Error('Missing renderer info');
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.finish();
	return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
}
