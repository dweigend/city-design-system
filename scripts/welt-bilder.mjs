/** PLAYWRIGHT_MODULE can point to an existing external Playwright installation. */
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = fileURLToPath(new URL('../docs/research/labor/welt-kern/', import.meta.url));
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
	headless: true,
	...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
	args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage({
	viewport: { width: 1200, height: 800 },
	deviceScaleFactor: 1
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
	await page.goto((process.env.WELT_URL || 'http://127.0.0.1:5178') + '/labor#L11');
	const region = page.getByRole('region', { name: 'Full simulation', exact: true });
	await region.waitFor();
	const canvas = region.locator('canvas');
	const rasters = [
		['quadrat', 'Square'],
		['achsen', 'Axes'],
		['dreieck', 'Triangle'],
		['sechseck', 'Hexagon'],
		['polar', 'Polar'],
		['kontur', 'Contour'],
		['voronoi', 'Voronoi'],
		['viereck', 'Free quad'],
		['organisch', 'Organic']
	];
	for (const focus of ['alle', 'netze']) {
		await region
			.getByRole('radiogroup', { name: 'Focus', exact: true })
			.getByRole('radio', { name: focus === 'alle' ? 'Everything' : 'Networks', exact: true })
			.click();
		for (const [id, name] of rasters)
			for (const variant of ['alt', 'neu']) {
				await region
					.getByRole('radiogroup', { name: 'Grid', exact: true })
					.getByRole('radio', { name, exact: true })
					.click();
				const toggle = region.getByRole('switch', { name: 'Kernel', exact: true });
				if ((await toggle.getAttribute('aria-checked')) !== (variant === 'neu' ? 'true' : 'false'))
					await toggle.click();
				await region.getByRole('button', { name: 'Reset view', exact: true }).click();
				await canvas.scrollIntoViewIfNeeded();
				await page.waitForTimeout(1200);
				if (await region.getByText('3D view unavailable.', { exact: true }).count())
					throw new Error('WebGL unavailable');
				await canvas.screenshot({
					path: dir + `${id}${focus === 'netze' ? '-netze' : ''}-${variant}.png`
				});
				console.log(id, focus, variant);
			}
	}
	// Keyboard, mobile and dark/light checks on the affected switch.
	for (const width of [390, 1200])
		for (const [theme, file] of [
			['Light', 'hell'],
			['Dark', 'dunkel']
		]) {
			await page.setViewportSize({ width, height: 800 });
			await page.getByRole('radio', { name: theme, exact: true }).click();
			const toggle = region.getByRole('switch', { name: 'Kernel', exact: true });
			await toggle.focus();
			const before = await toggle.getAttribute('aria-checked');
			await page.keyboard.press('Space');
			if ((await toggle.getAttribute('aria-checked')) === before)
				throw new Error('Keyboard switch did not change');
			await toggle.scrollIntoViewIfNeeded();
			await page.screenshot({ path: dir + `ui-${width}-${file}.png` });
		}
	const board = await browser.newPage({
		viewport: { width: 1200, height: 1593 },
		deviceScaleFactor: 1
	});
	for (const focus of ['alle', 'netze']) {
		let html =
			'<html><body style="margin:0;background:#fff;font:12px sans-serif;display:grid;grid-template-columns:1fr 1fr">';
		for (const [id] of rasters)
			for (const variant of ['alt', 'neu']) {
				const file = `${id}${focus === 'netze' ? '-netze' : ''}-${variant}.png`,
					data = (await readFile(dir + file)).toString('base64');
				html += `<figure style="height:177px;margin:0;text-align:center"><figcaption>${id} · ${variant}</figcaption><img style="height:158px;max-width:590px;object-fit:contain" src="data:image/png;base64,${data}"></figure>`;
			}
		await board.setContent(html + '</body></html>');
		await board.screenshot({ path: dir + `tafel${focus === 'netze' ? '-netze' : ''}.png` });
	}
	if (errors.length) throw new Error(errors.join('\n'));
} finally {
	await browser.close();
}
