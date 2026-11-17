import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, openRoute, evidenceRun, projectName } from './support/fixtures';
import { captureTargets } from './support/routes';
import { evidenceDir, recordEntry, renderInfo, worktreeState } from './support/evidence';

/**
 * Opt-in screenshot evidence: `EVIDENCE_DIR=/abs/path bun run test:browser e2e/evidence.e2e.ts`.
 * Every capture target × viewport × theme uses default cameras and controls with reduced
 * motion requested. Live fonts, asynchronous rendering and wall-clock scene updates are
 * not frozen, so repeated captures are not guaranteed to have identical pixels.
 */
const STATE = 'default camera and controls, reduced motion requested';
/** Pause per viewport step so viewport-triggered renderers and lazy images can start. */
const STEP_SETTLE_MS = 400;

/**
 * Scrolls the page once from top to bottom, viewport by viewport, so components that
 * initialize near the viewport and lazily loaded images render; then waits until every image
 * has decoded and returns to the top. Without this, a full-page capture shows empty canvases
 * and blank thumbnails below the fold.
 */
async function settleFullPage(page: Page) {
	const height = await page.evaluate(() => document.documentElement.scrollHeight);
	const step = page.viewportSize()?.height ?? 768;
	for (let y = 0; y < height; y += step) {
		await page.evaluate((top) => window.scrollTo(0, top), y);
		await page.waitForTimeout(STEP_SETTLE_MS);
	}
	await page.evaluate(() =>
		Promise.all(
			Array.from(document.images, (img) => (img.complete ? null : img.decode().catch(() => null)))
		)
	);
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(STEP_SETTLE_MS);
}

test.describe('evidence', () => {
	test.skip(!evidenceRun, 'set EVIDENCE_DIR to capture screenshots');
	test.skip(() => projectName().includes('reduced-motion'), 'themes × viewports only');

	for (const target of captureTargets) {
		test(`capture ${target.id}`, async ({ page, browser, colorScheme, viewport }) => {
			test.setTimeout(120_000);
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await openRoute(page, target.path);
			// Let async renderers (WebGPU → WebGL2 fallback) draw their first frames.
			await page.evaluate(
				() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
			);
			await page.waitForTimeout(800);
			const file = `${target.id}--${projectName()}.png`;
			const path = join(evidenceDir(), file);
			if (target.demo) {
				const demo = page.getByRole(target.demo.role, { name: target.demo.name, exact: true });
				await demo.scrollIntoViewIfNeeded();
				await page.waitForTimeout(300);
				await demo.screenshot({ path, animations: 'disabled' });
			} else {
				await settleFullPage(page);
				await page.screenshot({ path, fullPage: true, animations: 'disabled' });
			}
			recordEntry({
				file,
				target: target.id,
				route: target.path,
				demo: target.demo ? `${target.demo.role} "${target.demo.name}"` : null,
				viewport: `${viewport?.width}x${viewport?.height}`,
				theme: colorScheme ?? 'light',
				seed: target.seed === undefined ? 'page defaults (unchanged)' : String(target.seed),
				state: `${STATE}, ${target.demo ? 'demo scrolled into view' : 'full page after one scroll pass (all regions initialized)'}`,
				...(await renderInfo(page, browser)),
				fonts: 'Google Fonts, loaded live',
				...worktreeState(),
				capturedAt: new Date().toISOString()
			});
		});
	}
});
