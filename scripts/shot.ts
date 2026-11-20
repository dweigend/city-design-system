import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { git, integration, preview, requireSlot, research, shots } from './experiment-host';

requireSlot();
const { values, positionals } = parseArgs({
	args: process.argv.slice(2),
	allowPositionals: true,
	options: {
		revision: { type: 'string' },
		before: { type: 'string' },
		reference: { type: 'string' },
		url: { type: 'string' }
	}
});
const revision = values.revision ?? git(integration, 'rev-parse', 'HEAD');
const origin = preview(revision);
const requested = values.url ? new URL(values.url, origin) : undefined;
if (requested && requested.origin !== origin)
	throw Error('URL must match the verified preview at ' + origin);
const routes = positionals.length
	? positionals
	: requested && requested.pathname !== '/'
		? [requested.pathname + requested.search]
		: ['/sandbox/abnahme', '/sandbox', '/sandbox/haus'];
const folder = resolve(shots, new Date().toISOString().replaceAll(':', '-'));
const reference = resolve(
	values.reference ??
		resolve(research, '../experiments/image-workflow/input/stil-referenz-approved.png')
);
function matchesParent(path: string, parent: string) {
	if (!existsSync(path)) return false;
	const manifest = JSON.parse(readFileSync(path, 'utf8'));
	return (
		manifest.revision === parent &&
		routes.every((route) => manifest.records.some((r: { route: string }) => r.route === route))
	);
}
function parentCapture() {
	if (!existsSync(shots)) return;
	const parent = git(integration, 'rev-parse', revision + '^1');
	const folder = readdirSync(shots)
		.sort()
		.reverse()
		.find((name) => matchesParent(resolve(shots, name, 'manifest.json'), parent));
	if (folder) return resolve(shots, folder);
}
const before = values.before ?? parentCapture();
const previous = before ? await Bun.file(resolve(before, 'manifest.json')).json() : undefined;
if (previous && previous.revision !== git(integration, 'rev-parse', revision + '^1'))
	throw Error('Before must show the first parent of this revision');
mkdirSync(folder, { recursive: true });
const records = [];
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
		'--ignore-gpu-blocklist'
	]
});
try {
	for (const route of routes) {
		const url = new URL(route, origin);
		if (url.origin !== origin) throw Error('Expected a local preview route');
		for (const [size, width, height] of [
			['phone', 390, 844],
			['short-desktop', 1280, 640]
		] as const) {
			const page = await browser.newPage({
				viewport: { width, height },
				deviceScaleFactor: 1,
				colorScheme: 'light',
				reducedMotion: 'reduce'
			});
			try {
				if (!(await page.goto(url.href, { waitUntil: 'networkidle', timeout: 120000 }))?.ok())
					throw Error('Could not open ' + url.href);
				const canvas = page
					.locator('canvas[data-backend][data-frame]:not([data-frame="0"])')
					.first();
				await canvas.waitFor({ timeout: 90000 });
				await canvas.evaluate(async () => {
					await document.fonts.ready;
					await new Promise<void>((done) =>
						requestAnimationFrame(() => requestAnimationFrame(() => done()))
					);
				});
				const backend = await canvas.getAttribute('data-backend');
				const renderer =
					backend === 'webgpu'
						? await canvas.evaluate(webGpuRenderer)
						: await canvas.evaluate(webGlRenderer);
				const proof = { backend, renderer };
				if (
					!/amd|radeon/i.test(proof.renderer) ||
					/swiftshader|llvmpipe|lavapipe|software/i.test(proof.renderer)
				)
					throw Error('Hardware proof failed: ' + JSON.stringify(proof));
				const key = Buffer.from(route).toString('base64url') + '-' + size;
				const image = key + '.png';
				const sheet = key + '-sheet.png';
				await page.screenshot({ path: resolve(folder, image), animations: 'disabled' });
				const current = resolve(folder, image);
				const bounds = await canvas.boundingBox();
				if (!bounds) throw Error('Scene canvas disappeared');
				const cx = Math.floor(
					Math.min(width, bounds.x + bounds.width) / 2 + Math.max(0, bounds.x) / 2
				);
				const cy = Math.floor(
					Math.min(height, bounds.y + bounds.height) / 2 + Math.max(0, bounds.y) / 2
				);
				const variation = execFileSync(
					'convert',
					[
						current,
						'-crop',
						'80x80+' + (cx - 40) + '+' + (cy - 40),
						'-format',
						'%[fx:standard_deviation]',
						'info:'
					],
					{ encoding: 'utf8' }
				);
				if (!(Number(variation) > 0.001)) throw Error('Blank scene in ' + current);
				const baseline = before ? resolve(before, image) : 'xc:#eeeeee';
				execFileSync('montage', [
					'-font',
					'DejaVu-Sans',
					'-pointsize',
					'18',
					'-label',
					before ? 'Before' : 'Before (baseline capture)',
					baseline,
					'-label',
					'After',
					current,
					'-label',
					'Reference',
					reference,
					'-geometry',
					width + 'x' + height + '+4+4',
					'-tile',
					'3x1',
					resolve(folder, sheet)
				]);
				records.push({ route, size, width, height, image, sheet, ...proof });
				console.log(route, size, proof.backend, proof.renderer);
			} finally {
				await page.close();
			}
		}
	}
} finally {
	await browser.close();
}
preview(revision);
await Bun.write(
	resolve(folder, 'manifest.json'),
	JSON.stringify(
		{
			revision,
			origin,
			before,
			reference,
			preset: 'opening',
			theme: 'light',
			reducedMotion: true,
			deviceScaleFactor: 1,
			browser: browser.version(),
			records
		},
		null,
		2
	)
);
console.log(folder);

async function webGpuRenderer(element: Element) {
	const context = (element as HTMLCanvasElement).getContext('webgpu') as GPUCanvasContext;
	const device = context.getConfiguration()?.device;
	if (!device) throw Error('Missing scene device');
	await device.queue.onSubmittedWorkDone();
	const info = device.adapterInfo;
	if (info.isFallbackAdapter) throw Error('Fallback scene adapter');
	return [info.vendor, info.architecture, info.device, info.description].join(' ');
}
function webGlRenderer(element: Element) {
	const gl = (element as HTMLCanvasElement).getContext('webgl2');
	if (!gl) throw Error('Missing scene WebGL2 context');
	const ext = gl.getExtension('WEBGL_debug_renderer_info');
	if (!ext) throw Error('Missing renderer info');
	gl.finish();
	return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
}
