import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';

const hardware = process.env.CI !== 'true' && existsSync('/dev/dri/renderD128');
const stageUnavailable = 'Use a browser with WebGPU to see this view.';
export const journeys = test.extend<{ browserErrors: void }>({
	browserErrors: [
		async ({ page }, use) => {
			const errors: string[] = [];
			page.on('console', (message) => {
				if (message.type() === 'error') {
					const { url } = message.location();
					errors.push(`console: ${message.text()} (${url})`);
				}
			});
			page.on('pageerror', (error) => errors.push('page: ' + error.message));
			await use(undefined);
			expect(errors, 'browser errors').toEqual([]);
		},
		{ auto: true }
	]
});

export async function open(page: Page, route: string) {
	const origin = process.env.CITY_BROWSER_URL;
	if (!origin) throw new Error('The preview did not report a loopback address');
	const url = new URL(route, origin).href;
	const response = await page.goto(url);
	expect(response?.status()).toBe(200);
	await expect(page).toHaveURL(url);
	await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
	// The shared header selects the current theme once hydration has mounted it.
	const theme = page.getByRole('radiogroup', { name: 'Theme' });
	await expect(theme.getByRole('radio', { checked: true })).toBeVisible();
}

export async function readyStages(page: Page, count: number) {
	const stages = page.locator('canvas[data-stage-ready="true"]');
	const fallback = page.getByText(stageUnavailable, { exact: true });
	await expect(stages.first().or(fallback.first())).toBeVisible();
	if (!hardware && (await fallback.count()) > 0) {
		const adapterExists = await page.evaluate(
			async () => !!(await navigator.gpu?.requestAdapter())
		);
		expect(adapterExists, 'The stage failed despite an available WebGPU adapter').toBe(false);
		await expect(fallback).toHaveCount(count);
		console.log(`${new URL(page.url()).pathname} WebGPU unavailable. Verified the fallback.`);
		return;
	}
	await expect(stages).toHaveCount(count);
	if (hardware) {
		for (const canvas of await stages.all()) {
			await expect(canvas).toHaveAttribute('data-stage-hardware', 'true');
			const adapter = await canvas.getAttribute('data-stage-adapter');
			expect(adapter).toBeTruthy();
			expect(adapter).not.toMatch(/swiftshader|llvmpipe|lavapipe|software|unknown/i);
			console.log(`${new URL(page.url()).pathname} WebGPU: ${adapter}`);
		}
	}
	return stages;
}

export async function distinctPixels(canvas: Locator) {
	// The compositor's screenshot can read WebGPU output after presenting the swapchain.
	// Hide the HUD so its controls cannot make a blank sandbox canvas pass.
	const png = await canvas.screenshot({ style: '.sandbox-hud { visibility: hidden !important; }' });
	return canvas.page().evaluate(async (base64) => {
		const image = await createImageBitmap(
			await (await fetch('data:image/png;base64,' + base64)).blob()
		);
		const context = new OffscreenCanvas(image.width, image.height).getContext('2d');
		if (!context) throw new Error('Cannot decode the canvas screenshot');
		context.drawImage(image, 0, 0);
		image.close();
		const { data } = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
		for (let i = 4; i < data.length; i += 4) {
			if (data[i] !== data[0] || data[i + 1] !== data[1] || data[i + 2] !== data[2]) return true;
		}
		return false;
	}, png.toString('base64'));
}
