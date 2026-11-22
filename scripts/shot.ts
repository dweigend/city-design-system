import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { git, integration, preview, requireSlot, shots } from './experiment-host';

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
	: [requested ? requested.pathname + requested.search : (process.env.SHOT_ROUTE ?? '/')];
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
				await page.evaluate(async () => {
					await document.fonts.ready;
				});
				const renderer = await page.evaluate(webGlRenderer);
				const backend = 'webgl2';
				if (
					!/amd|radeon/i.test(renderer) ||
					/swiftshader|llvmpipe|lavapipe|software/i.test(renderer)
				)
					throw Error('Hardware proof failed: ' + renderer);

				const key = Buffer.from(route).toString('base64url') + '-' + size;
				const image = key + '.png';
				const sheet = key + '-sheet.png';
				const current = resolve(folder, image);
				await page.screenshot({ path: current, animations: 'disabled' });

				const baseline = previous?.records.find((r) => r.route === route && r.size === size);
				const panels = ['-label', 'After', current];
				if (baseline && before) panels.unshift('-label', 'Before', resolve(before, baseline.image));
				if (reference) panels.push('-label', 'Reference', reference);
				const hasComparison = panels.length > 3;
				if (hasComparison) {
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
					image,
					sheet: hasComparison ? sheet : undefined,
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
preview(revision);
await Bun.write(
	resolve(folder, 'manifest.json'),
	JSON.stringify(
		{
			revision,
			origin,
			before,
			reference,
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

function webGlRenderer() {
	const gl = document.createElement('canvas').getContext('webgl2');
	if (!gl) throw Error('Missing browser WebGL2 context');
	const ext = gl.getExtension('WEBGL_debug_renderer_info');
	if (!ext) throw Error('Missing renderer info');
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.finish();
	return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
}
