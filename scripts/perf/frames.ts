import type { Page } from '@playwright/test';
import { round } from './host';

type Frame = {
	at: number;
	cpu: number;
	drawCalls: number;
	chunks: number;
	placements: number;
	waiting: number;
};

declare global {
	interface Window {
		perfFrames: Frame[];
	}
}

/** Observe completed stage submissions through the stage's own counters. */
export async function observeFrames(page: Page) {
	await page.addInitScript(() => {
		window.perfFrames = [];
		new MutationObserver((records) => {
			const canvas = records.at(-1)?.target;
			if (!(canvas instanceof HTMLCanvasElement) || !canvas.dataset.stageReady) return;
			const { stageFrameCpuMs, stageDrawCalls, stageChunkBuilds } = canvas.dataset;
			const sandbox = canvas.closest<HTMLElement>('[data-sandbox-placements]');
			window.perfFrames.push({
				at: performance.now(),
				cpu: Number(stageFrameCpuMs),
				drawCalls: Number(stageDrawCalls),
				chunks: Number(stageChunkBuilds),
				placements: Number(sandbox?.dataset.sandboxPlacements ?? 0),
				waiting: Number(sandbox?.dataset.sandboxWaiting ?? 0)
			});
		}).observe(document, {
			subtree: true,
			attributes: true,
			attributeFilter: ['data-stage-frames']
		});
	});
}

export async function startFrames(page: Page) {
	return page.evaluate(() => ({
		ms: performance.now(),
		index: window.perfFrames.length,
		chunks: window.perfFrames.at(-1)?.chunks ?? 0
	}));
}

export async function nextFrame(page: Page, index: number) {
	await page.waitForFunction((from) => window.perfFrames.length > from, index);
}

export async function settledFrame(
	page: Page,
	start: Awaited<ReturnType<typeof startFrames>>,
	count: number
) {
	await page.waitForFunction(
		({ from, count }) =>
			window.perfFrames
				.slice(from)
				.some(({ placements, waiting }) => placements === count && waiting === 0),
		{ from: start.index, count }
	);
	return page.evaluate(
		({ from, count }) => {
			const frame = window.perfFrames
				.slice(from)
				.find(({ placements, waiting }) => placements === count && waiting === 0);
			if (!frame) throw new Error('Missing final sandbox frame');
			return frame;
		},
		{ from: start.index, count }
	);
}

function percentiles(numbers: readonly number[]) {
	if (numbers.some((value) => !Number.isFinite(value))) throw new Error('Invalid frame sample');
	const sorted = [...numbers].sort((a, b) => a - b);
	const at = (p: number) => round(sorted[Math.ceil(p * sorted.length) - 1]);
	return { p50: at(0.5), p95: at(0.95), p99: at(0.99) };
}

export async function readFrames(page: Page, index: number, through = Infinity) {
	const samples = await page.evaluate(
		({ from, end }) => window.perfFrames.slice(from).filter(({ at }) => at <= end),
		{ from: index, end: through }
	);
	const intervals = samples.slice(1).map(({ at }, i) => at - samples[i].at);
	if (intervals.length < 10)
		throw new Error(`Expected at least 10 stage intervals, observed ${intervals.length}`);
	return {
		samples: samples.length,
		frameMs: percentiles(intervals),
		cpuMs: percentiles(samples.map(({ cpu }) => cpu))
	};
}
