import { settings } from '../config/perf-baseline';
import type { Baseline } from './measure';
import { round } from './host';

const limits = settings;
type Limit = Exclude<keyof typeof limits, 'perfLargestSampleBlocks'>;
type Percentiles = { p50: number; p95: number; p99: number };
type Metric = { value: number; unit: string; limit?: Limit; percentiles?: Percentiles };

function metrics(result: Baseline) {
	const rows = new Map<string, Metric>();
	const add = (name: string, value: number, unit: string, limit?: Limit) => {
		rows.set(name, { value, unit, limit });
	};
	const budget = (name: string, value: number, limit: Limit) =>
		add(name, value, limits[limit].unit, limit);
	const timing = (name: string, percentiles: Percentiles, limit?: Limit) =>
		rows.set(name, { value: percentiles.p95, unit: 'ms', limit, percentiles });
	for (const [name, city] of Object.entries(result.pipeline)) {
		budget(
			`${name} pipeline`,
			city.totalMs,
			name === 'town' ? 'perfTownPipeline' : 'perfLargestPipeline'
		);
		for (const [stage, stats] of Object.entries(city.stages))
			add(`${name} · ${stage}`, stats.ms, 'ms');
		budget(`${name} pipeline peak RSS`, city.peakRssMiB, 'perfPipelineRss');
	}
	const { city, architecture, architectureTown, sandbox, loads } = result.browser;
	budget('/city first frame', city.firstFrameMs, 'perfFirstFrame');
	budget('Architecture study first frame', architectureTown.firstFrameMs, 'perfFirstFrame');
	budget('Architecture Whole Town first frame', architecture.firstFrameMs, 'perfFirstFrame');
	budget('/sandbox first frame', sandbox.firstFrameMs, 'perfFirstFrame');
	const interactions = {
		pan: sandbox.pan,
		zoom: sandbox.zoom,
		hover: sandbox.hover,
		paint: sandbox.paint
	};
	for (const [name, stats] of Object.entries(interactions)) {
		timing(
			`${name} frame p50/p95/p99`,
			stats.frameMs,
			name === 'paint' ? 'perfPaintFrame' : 'perfPanZoomHoverFrame'
		);
		timing(`${name} stage CPU p50/p95/p99`, stats.cpuMs, 'perfStageCpu');
	}
	budget('Paint stroke wall', sandbox.paint.wallMs, 'perfStroke');
	budget('Undo wall', sandbox.undo.wallMs, 'perfUndo');
	budget('Sandbox paint JS heap', sandbox.paint.heapMiB, 'perfBrowserHeap');
	budget('Sandbox interaction peak RSS', sandbox.peakRssMiB, 'perfBrowserRss');
	timing('Architecture frame p50/p95/p99', architecture.frameMs);
	timing('Architecture stage CPU p50/p95/p99', architecture.cpuMs, 'perfStageCpu');
	budget('Architecture draw calls', architecture.drawCalls, 'perfDrawCalls');
	budget('Architecture JS heap', architecture.heapMiB, 'perfBrowserHeap');
	budget('Architecture peak RSS', architecture.peakRssMiB, 'perfBrowserRss');
	for (const load of loads) {
		const name = `${load.houses}-house load`;
		budget(name, load.wallMs, load.houses === 300 ? 'perfSmallLoad' : 'perfTownLoad');
		budget(name + ' draw calls', load.drawCalls, 'perfDrawCalls');
		budget(name + ' tile packs', load.tilePacks, 'perfTilePacks');
		budget(name + ' JS heap', load.heapMiB, 'perfBrowserHeap');
		budget(name + ' peak RSS', load.peakRssMiB, 'perfBrowserRss');
	}
	return rows;
}

function display(metric: Metric | undefined) {
	if (!metric) return '—';
	const { percentiles, unit, value } = metric;
	const timing = percentiles && [percentiles.p50, percentiles.p95, percentiles.p99].join(' / ');
	return `${timing ?? value} ${unit}`;
}

export function report(current: Baseline, baseline?: Baseline) {
	const measured = metrics(current);
	const previous = baseline && metrics(baseline);
	const { browser, driver, viewport, deviceScaleFactor } = current.browser.environment;
	console.log(
		`\n${browser} · ${current.browser.sandbox.adapter} · ${driver.driverVendor} ${driver.driverVersion} · ${viewport.width}×${viewport.height} @ ${deviceScaleFactor}x`
	);
	console.log(
		`Revision ${current.gitRevision}${current.dirty ? ' (working tree changes)' : ''} · reference ${baseline?.gitRevision ?? 'new'}`
	);
	console.log(
		`Host load ${current.hostBefore.loadAverage.join('/')} → ${current.hostAfter.loadAverage.join('/')} · MemAvailable ${current.hostBefore.memAvailableMiB} → ${current.hostAfter.memAvailableMiB} MiB\n`
	);
	console.log('| Metric | Current | Reference | Δ (p95 for percentiles) | Hard limit |');
	console.log('| --- | ---: | ---: | ---: | ---: |');
	let passed = true;
	for (const [name, metric] of measured) {
		const { value, limit } = metric;
		const before = previous?.get(name);
		const hard = limit && limits[limit].value;
		const failed = !Number.isFinite(value) || (hard !== undefined && value > hard);
		const delta = before === undefined ? '—' : round(value - before.value);
		console.log(
			`| ${name} | ${display(metric)} | ${display(before)} | ${delta} | ${hard ?? '—'}${failed ? ' **FAIL**' : ''} |`
		);
		passed &&= !failed;
	}
	return passed;
}
