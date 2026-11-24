import { chromium, type Browser, type Page } from '@playwright/test';
import { closeSync, openSync } from 'node:fs';
import { bytesPerMiB, round, rssMiB } from './host';
import { observeFrames } from './frames';

const device = '/dev/dri/renderD128';
const icd = '/usr/share/vulkan/icd.d/radeon_icd.json';
const software = /swiftshader|llvmpipe|lavapipe|software/i;
const amd = /amd|radeon/i;
const args = [
	'--use-angle=vulkan',
	'--use-vulkan=native',
	'--enable-features=Vulkan',
	'--enable-unsafe-webgpu',
	'--ignore-gpu-blocklist'
];
const viewport = { width: 1366, height: 900 };
const deviceScaleFactor = 1;

export async function openChrome() {
	closeSync(openSync(device, 'r+'));
	const browser = await chromium.launch({
		channel: 'chrome',
		chromiumSandbox: true,
		ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
		env: { ...process.env, VK_DRIVER_FILES: icd },
		args
	});
	try {
		const session = await browser.newBrowserCDPSession();
		const { gpu } = await session.send('SystemInfo.getInfo');
		// The app's stage proves the WebGPU adapter separately. CDP supplies native driver metadata.
		const driver = gpu.devices.find(
			({ vendorId, deviceString }) => vendorId === 0x1002 || amd.test(deviceString)
		);
		if (!driver || software.test(driver.deviceString))
			throw new Error('Chrome did not report an AMD hardware GPU in SystemInfo');
		return {
			browser,
			environment: {
				browser: `Chrome ${browser.version()}`,
				backend: 'WebGPU / Dawn / Vulkan',
				driver,
				renderDevice: device,
				vulkanDriverFiles: icd,
				args,
				viewport,
				deviceScaleFactor
			},
			async sampleRss() {
				const { processInfo } = await session.send('SystemInfo.getProcessInfo');
				const total = processInfo.reduce((sum, { id }) => sum + rssMiB(id), 0);
				if (!total) throw new Error('No Chrome RSS data from /proc');
				return total;
			}
		};
	} catch (error) {
		await browser.close();
		throw error;
	}
}

export async function openRoute(browser: Browser, url: URL) {
	const context = await browser.newContext({ viewport, deviceScaleFactor });
	try {
		const page = await context.newPage();
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text());
		});
		page.setDefaultTimeout(30_000);
		await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
			route.fulfill({ status: 200, body: '' })
		);
		await observeFrames(page);
		const response = await page.goto(url.href);
		if (!response?.ok())
			throw new Error(`Preview failed for ${url.pathname}: ${response?.status()}`);
		const canvas = page.locator('canvas[data-stage-ready="true"]');
		const fallback = page.getByText('Use a browser with WebGPU to see this view.', { exact: true });
		await canvas.or(fallback).first().waitFor({ state: 'visible' });
		if (await fallback.isVisible())
			throw new Error(`${url.pathname} could not open its WebGPU stage`);
		const adapter = await canvas.getAttribute('data-stage-adapter');
		const hardware = await canvas.getAttribute('data-stage-hardware');
		if (hardware !== 'true' || !adapter || !amd.test(adapter) || software.test(adapter))
			throw new Error(
				`${url.pathname} did not render on hardware AMD WebGPU: ${adapter} (${hardware})`
			);
		const firstFrameMs = await page.evaluate(() => window.perfFrames[0]?.at);
		if (firstFrameMs === undefined) throw new Error(`Missing first frame at ${url.pathname}`);
		await canvas.scrollIntoViewIfNeeded();
		const session = await context.newCDPSession(page);
		return {
			context,
			page,
			canvas,
			adapter,
			firstFrameMs: round(firstFrameMs),
			checkErrors() {
				if (errors.length) throw new Error(errors.join('\n'));
			},
			async heapMiB() {
				await session.send('HeapProfiler.collectGarbage');
				const heap = await session.send('Runtime.getHeapUsage');
				return round(heap.usedSize / bytesPerMiB);
			}
		};
	} catch (error) {
		await context.close();
		throw error;
	}
}

export async function measuredRss<T>(sample: () => Promise<number>, run: () => Promise<T>) {
	let peak = await sample();
	let error: unknown;
	let active: Promise<void> | undefined;
	const interval = setInterval(() => {
		active ??= sample()
			.then((rss) => {
				peak = Math.max(peak, rss);
			})
			.catch((cause: unknown) => {
				error = cause;
			})
			.finally(() => {
				active = undefined;
			});
	}, 200);
	try {
		const result = await run();
		await active;
		if (error) throw error;
		return { ...result, peakRssMiB: round(Math.max(peak, await sample())) };
	} finally {
		clearInterval(interval);
		await active;
	}
}
