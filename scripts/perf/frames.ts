import type { Page } from '@playwright/test';
import { protocol } from '../config/perf-baseline';
import { round } from './host';

type Publication = { placements: number; waiting: number; revision: number };
type Frame = {
	at: number;
	cpu: number;
	drawCalls: number;
	chunks: number;
	publication: Publication;
};
type Range = { from: number; to: number; through?: number };

declare global {
	interface Window {
		perfFrames: Frame[];
		perfPublication: Publication;
	}
}

/** Consume stage and sandbox mutations in DOM order. A pending draw can precede a queue update
 * within a single observer batch and must retain its earlier publication. */
export async function observeFrames(page: Page) {
	await page.addInitScript(() => {
		window.perfFrames = [];
		window.perfPublication = { placements: 0, waiting: 0, revision: 0 };
		new MutationObserver((records) => {
			// Each record's new value is the next mutation's old value, or its final DOM value.
			const later = new Map<string, string | null>();
			const values = records.map(() => null as string | null);
			for (let index = records.length - 1; index >= 0; index--) {
				const { attributeName, target, oldValue } = records[index];
				if (!attributeName || attributeName === 'data-stage-frames') continue;
				if (!(target instanceof HTMLElement)) continue;
				values[index] = later.has(attributeName)
					? (later.get(attributeName) ?? null)
					: target.getAttribute(attributeName);
				later.set(attributeName, oldValue);
			}
			for (const [index, { target, attributeName }] of records.entries()) {
				if (attributeName === 'data-stage-frames' && target instanceof HTMLCanvasElement) {
					const { stageFrameCpuMs, stageDrawCalls, stageChunkBuilds } = target.dataset;
					window.perfFrames.push({
						at: performance.now(),
						cpu: Number(stageFrameCpuMs),
						drawCalls: Number(stageDrawCalls),
						chunks: Number(stageChunkBuilds),
						publication: window.perfPublication
					});
				} else if (
					attributeName === 'data-sandbox-placements' ||
					attributeName === 'data-sandbox-waiting'
				) {
					const key = attributeName === 'data-sandbox-placements' ? 'placements' : 'waiting';
					window.perfPublication = {
						...window.perfPublication,
						[key]: Number(values[index]),
						revision: window.perfPublication.revision + 1
					};
				}
			}
		}).observe(document, {
			subtree: true,
			attributes: true,
			attributeOldValue: true,
			attributeFilter: ['data-stage-frames', 'data-sandbox-placements', 'data-sandbox-waiting']
		});
	});
}

export async function startFrames(page: Page) {
	return page.evaluate(() => ({
		ms: performance.now(),
		index: window.perfFrames.length,
		chunks: window.perfFrames.at(-1)?.chunks ?? 0,
		publication: window.perfPublication.revision
	}));
}

export async function nextFrame(page: Page, index: number) {
	const handle = await page.waitForFunction(
		(from) => window.perfFrames.length > from && window.perfFrames.length,
		index
	);
	try {
		const count = await handle.jsonValue();
		if (!count) throw new Error('Missing stage submission');
		return count;
	} finally {
		await handle.dispose();
	}
}

export async function settledFrame(
	page: Page,
	start: Awaited<ReturnType<typeof startFrames>>,
	count: number
) {
	const frame = await page.waitForFunction(
		({ from, publication, count }) =>
			window.perfFrames
				.slice(from)
				.find(
					({ publication: state }) =>
						state.revision > publication && state.placements === count && state.waiting === 0
				),
		{ from: start.index, publication: start.publication, count }
	);
	try {
		const submitted = await frame.jsonValue();
		if (!submitted) throw new Error('Missing final sandbox frame');
		return submitted;
	} finally {
		await frame.dispose();
	}
}

function percentiles(numbers: readonly number[]) {
	if (numbers.some((value) => !Number.isFinite(value))) throw new Error('Invalid frame sample');
	const sorted = [...numbers].sort((a, b) => a - b);
	const at = (p: number) => round(sorted[Math.ceil(p * sorted.length) - 1]);
	return { p50: at(0.5), p95: at(0.95), p99: at(0.99) };
}

export async function readFrames(page: Page, ranges: readonly Range[], minimum = 10) {
	const groups = await page.evaluate(
		(ranges) =>
			ranges.map(({ from, to, through }) =>
				window.perfFrames.slice(from, to).filter(({ at }) => through === undefined || at <= through)
			),
		ranges
	);
	const intervals = groups.flatMap((frames) =>
		frames.slice(1).map(({ at }, i) => at - frames[i].at)
	);
	if (intervals.length < minimum)
		throw new Error(`Expected at least ${minimum} stage intervals, observed ${intervals.length}`);
	return {
		intervals: intervals.length,
		frameMs: percentiles(intervals),
		cpuMs: percentiles(groups.flatMap((frames) => frames.map(({ cpu }) => cpu)))
	};
}

export async function driveGestures(
	page: Page,
	step: (index: number) => Promise<void>,
	gesture?: { begin: () => Promise<void>; end: () => Promise<void> }
) {
	const repeats = protocol.perfGestureRepeats.value;
	const steps = protocol.perfGestureSteps.value;
	const ranges: Range[] = [];
	for (let repeat = 0; repeat < repeats; repeat++) {
		await gesture?.begin();
		let { index: from } = await startFrames(page);
		const start = from;
		for (let i = 0; i < steps; i++) {
			await step(repeat * steps + i);
			from = await nextFrame(page, from);
		}
		ranges.push({ from: start, to: from });
		await gesture?.end();
	}
	return readFrames(page, ranges, repeats * (steps - 1));
}
