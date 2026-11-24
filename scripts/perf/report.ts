import { budgets, protocol } from '../config/perf-baseline';
import type { Baseline } from './measure';
import { round } from './host';

type Budget = keyof typeof budgets;
type Noise =
	| 'perfTimeNoiseFloor'
	| 'perfFrameNoiseFloor'
	| 'perfCpuNoiseFloor'
	| 'perfCallNoiseFloor'
	| 'perfPackNoiseFloor';
type Percentiles = { p50: number; p95: number; p99: number };
type Metric = {
	value: number;
	unit: string;
	hard?: number;
	noise?: Noise;
	percentiles?: Percentiles;
	intervals?: number;
};

function metrics(result: Baseline) {
	const rows = new Map<string, Metric>();
	const budget = (name: string, value: number, key: Budget, noise?: Noise) => {
		const { unit, value: hard } = budgets[key];
		rows.set(name, { value, unit, hard, noise });
	};
	const time = (name: string, value: number, key: Budget) =>
		budget(name, value, key, 'perfTimeNoiseFloor');
	const profile = (
		name: string,
		stats: Baseline['browser']['sandbox']['pan'],
		frame: Budget,
		cpu: Budget
	) => {
		rows.set(name + ' frame', {
			value: stats.frameMs.p95,
			unit: 'ms',
			hard: budgets[frame].value,
			noise: 'perfFrameNoiseFloor',
			percentiles: stats.frameMs,
			intervals: stats.intervals
		});
		rows.set(name + ' stage CPU', {
			value: stats.cpuMs.p95,
			unit: 'ms',
			hard: budgets[cpu].value,
			noise: 'perfCpuNoiseFloor',
			percentiles: stats.cpuMs,
			intervals: stats.intervals
		});
	};
	for (const [name, city] of Object.entries(result.pipeline)) {
		const town = name === 'town';
		time(`${name} pipeline wall`, city.totalMs, town ? 'perfTownPipeline' : 'perfLargestPipeline');
		for (const [stage, stats] of Object.entries(city.stages))
			rows.set(`${name} · ${stage}`, { value: stats.ms, unit: 'ms' });
		budget(
			`${name} pipeline peak RSS`,
			city.peakRssMiB,
			town ? 'perfTownPipelineRss' : 'perfLargestPipelineRss'
		);
	}
	const { city, architecture, architectureTown, sandbox, loads } = result.browser;
	time('/city first frame', city.firstFrameMs, 'perfCityFirstFrame');
	time('Architecture study first frame', architectureTown.firstFrameMs, 'perfStudyFirstFrame');
	time('Architecture Whole Town first frame', architecture.firstFrameMs, 'perfWholeTownFirstFrame');
	time('/sandbox first frame', sandbox.firstFrameMs, 'perfSandboxFirstFrame');
	profile('Pan', sandbox.pan, 'perfPanFrame', 'perfPanCpu');
	profile('Zoom', sandbox.zoom, 'perfZoomFrame', 'perfZoomCpu');
	profile('Hover', sandbox.hover, 'perfHoverFrame', 'perfHoverCpu');
	profile('Paint', sandbox.paint, 'perfPaintFrame', 'perfPaintCpu');
	profile('Architecture', architecture, 'perfArchitectureFrame', 'perfArchitectureCpu');
	time('Paint stroke wall', sandbox.paint.wallMs, 'perfStroke');
	time('Undo wall', sandbox.undo.wallMs, 'perfUndo');
	budget('Paint draw calls', sandbox.paint.drawCalls, 'perfPaintCalls', 'perfCallNoiseFloor');
	budget('Paint tile packs', sandbox.paint.tilePacks, 'perfPaintPacks', 'perfPackNoiseFloor');
	budget('Sandbox paint JS heap', sandbox.paint.heapMiB, 'perfPaintHeap');
	budget('Sandbox interaction peak RSS', sandbox.peakRssMiB, 'perfSandboxRss');
	budget(
		'Architecture draw calls',
		architecture.drawCalls,
		'perfArchitectureCalls',
		'perfCallNoiseFloor'
	);
	budget('Architecture JS heap', architecture.heapMiB, 'perfArchitectureHeap');
	budget('Architecture peak RSS', architecture.peakRssMiB, 'perfArchitectureRss');
	for (const [scope, load] of Object.entries(loads)) {
		const small = scope === 'small';
		const name = small ? 'Small load' : 'Full-town load';
		time(name, load.wallMs, small ? 'perfSmallLoad' : 'perfTownLoad');
		budget(
			name + ' draw calls',
			load.drawCalls,
			small ? 'perfSmallLoadCalls' : 'perfTownLoadCalls',
			'perfCallNoiseFloor'
		);
		budget(
			name + ' tile packs',
			load.tilePacks,
			small ? 'perfSmallLoadPacks' : 'perfTownLoadPacks',
			'perfPackNoiseFloor'
		);
		budget(name + ' JS heap', load.heapMiB, small ? 'perfSmallLoadHeap' : 'perfTownLoadHeap');
		budget(name + ' peak RSS', load.peakRssMiB, small ? 'perfSmallLoadRss' : 'perfTownLoadRss');
	}
	return rows;
}

function display(metric: Metric | undefined) {
	if (!metric) return '—';
	const { percentiles, intervals, unit, value } = metric;
	if (!percentiles) return `${value} ${unit}`;
	const { p50, p95, p99 } = percentiles;
	return `${p50} / ${p95} / ${p99} ${unit} (n=${intervals})`;
}

function referenceLimit(reference: number | undefined, noise: Noise | undefined) {
	if (reference === undefined || !noise) return undefined;
	return Math.max(
		reference * protocol.perfRegressionRatio.value,
		reference + protocol[noise].value
	);
}

function checkEnvironment(current: Baseline, baseline: Baseline) {
	const actual = current.browser.environment;
	const reference = baseline.browser.environment;
	const fields = {
		browser: [actual.browser, reference.browser],
		driver: [actual.driver, reference.driver],
		viewport: [
			[actual.viewport, actual.deviceScaleFactor],
			[reference.viewport, reference.deviceScaleFactor]
		]
	};
	for (const [field, [value, old]] of Object.entries(fields)) {
		if (JSON.stringify(value) !== JSON.stringify(old))
			console.warn(`Warning: ${field} differs from the reference.`);
	}
}

function compareReferences(current: Baseline, baseline: Baseline | undefined) {
	if (!baseline) return undefined;
	if (current.schemaVersion !== baseline.schemaVersion) {
		console.warn(
			`Warning: reference schema ${baseline.schemaVersion} differs from current schema ${current.schemaVersion}. Refresh the reference to compare results.`
		);
		return undefined;
	}
	checkEnvironment(current, baseline);
	return metrics(baseline);
}

function printRow(name: string, metric: Metric, before: Metric | undefined) {
	const { value, hard, noise } = metric;
	const relative = referenceLimit(before?.value, noise);
	const failed =
		!Number.isFinite(value) || value > Math.min(hard ?? Infinity, relative ?? Infinity);
	const delta = before === undefined ? '—' : round(value - before.value);
	const allowed = relative === undefined ? '—' : round(relative);
	console.log(
		`| ${name} | ${display(metric)} | ${display(before)} | ${delta} | ${hard ?? '—'} | ${allowed}${failed ? ' **FAIL**' : ''} |`
	);
	return !failed;
}

export function report(current: Baseline, baseline?: Baseline) {
	const measured = metrics(current);
	const previous = compareReferences(current, baseline);
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
	console.log(
		'Frame and CPU columns show p50 / p95 / p99 and the count of frame intervals. Limits and deltas use p95.'
	);
	console.log('| Metric | Current | Reference | Δ | Hard limit | Reference limit |');
	console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
	const results = [...measured].map(([name, metric]) =>
		printRow(name, metric, previous?.get(name))
	);
	const passed = results.every(Boolean) && (!baseline || previous !== undefined);
	console.log(passed ? 'Performance budgets passed.' : 'Performance baseline check failed.');
	return passed;
}
