// Pass rates, verdicts and worst cases of the city volume study.
import { resolve } from 'node:path';

/** One measured study run. */
export type Row = Record<string, string | number | boolean>;

function verdict(rate: number) {
	return rate >= 0.95 ? 'works' : rate >= 0.75 ? 'works with limits' : 'fails';
}

function group(rows: Row[], field: 'plan' | 'lattice') {
	const values = [...new Set(rows.map((row) => row[field] as string))];
	return values.map((value) => {
		const subset = rows.filter((row) => row[field] === value);
		const passed = subset.filter((row) => row.pass).length;
		const reasons = new Map<string, number>();
		for (const row of subset)
			for (const reason of String(row.failures).split(' ').filter(Boolean))
				reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
		const worst = subset
			.filter((row) => !row.pass)
			.sort(
				(a, b) => String(b.failures).split(' ').length - String(a.failures).split(' ').length
			)[0];
		const rate = passed / subset.length;
		return {
			[field]: value,
			runs: subset.length,
			passRate: `${(100 * rate).toFixed(1)} %`,
			verdict: verdict(rate),
			reasons: [...reasons].map(([r, n]) => `${r} ${n}`).join(', ') || '—',
			worst: worst
				? `${worst.plan}/${worst.lattice}/${worst.sizeClass}/seed ${worst.seed}/relief ${worst.relief}/lake ${worst.lake}: ${worst.failures}`
				: '—'
		};
	});
}

export function summarize(rows: Row[], out: string, sizes: Record<string, number>) {
	const total = rows.filter((row) => row.pass).length;
	console.log(
		`\nCity volume study: ${rows.length} runs, ${total} pass (${((100 * total) / rows.length).toFixed(1)} %)`
	);
	console.table(group(rows, 'plan'));
	console.table(group(rows, 'lattice'));
	const bySize = Object.keys(sizes).map((sizeClass) => {
		const subset = rows.filter((row) => row.sizeClass === sizeClass);
		const stat = (field: string, f: (v: number[]) => number) =>
			f(subset.map((r) => r[field] as number));
		const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
		return {
			sizeClass,
			areaKm2: `${stat('areaKm2', (v) => Math.min(...v)).toFixed(2)}–${stat('areaKm2', (v) => Math.max(...v)).toFixed(2)}`,
			settlements: [...new Set(subset.map((r) => r.settlement))].join('/'),
			cells: `${stat('cells', (v) => Math.min(...v))}–${stat('cells', (v) => Math.max(...v))}`,
			maxMembers: stat('members', (v) => Math.max(...v)),
			maxJoints: stat('joints', (v) => Math.max(...v)),
			peak: `${stat('peakLevels', (v) => Math.min(...v)) * 7}–${stat('peakLevels', (v) => Math.max(...v)) * 7} m`,
			block: `${(100 * stat('blockShare', mean)).toFixed(0)} %`,
			center: `${(100 * stat('centerShare', mean)).toFixed(0)} %`,
			gridMs: stat('gridMs', mean).toFixed(0),
			latticeMs: stat('latticeMs', mean).toFixed(1),
			growthKept: `${(100 * stat('growthKept', mean)).toFixed(1)} %`
		};
	});
	console.table(bySize);
	const shapeRows = [];
	for (const relief of [...new Set(rows.map((row) => row.relief))]) {
		const group = rows.filter((row) => row.relief === relief);
		for (const measure of ['parts', 'minorSideShare', 'compactness']) {
			const values = group.map((row) => Number(row[measure])).sort((a, b) => a - b);
			shapeRows.push({
				relief,
				measure,
				min: values[0].toFixed(3),
				median: (
					(values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) /
					2
				).toFixed(3),
				max: values[values.length - 1].toFixed(3)
			});
		}
	}
	console.table(shapeRows);
	console.log(`results: ${resolve(out, 'results.json')}`);
}
