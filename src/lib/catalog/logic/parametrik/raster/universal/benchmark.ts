/** Run: bun src/lib/catalog/logic/parametrik/raster/universal/benchmark.ts */
import { gridGenerators } from '../index';
import { organicGrid, strukturen, toPatch } from './index';
const generators = [
	...gridGenerators,
	{
		kind: 'organic',
		params: [{ key: 'sites', min: 8, max: 60, default: 32 }],
		generate: organicGrid
	}
];
console.log('| Grid | Size | Cells → vertices | Total median ms | Patch + structures ms |');
console.log('| --- | --- | --- | ---: | ---: |');
for (const g of generators)
	for (const large of [false, true]) {
		const params = Object.fromEntries(
			g.params.map((p) => [
				p.key,
				large && ['count', 'sites', 'rings'].includes(p.key) ? p.max : p.default
			])
		);
		const total: number[] = [],
			kernel: number[] = [];
		let counts = '';
		for (let i = 0; i < 7; i++) {
			const t = performance.now(),
				grid = g.generate(params, 42),
				u = performance.now(),
				patch = toPatch(grid, { cellSize: 5 });
			strukturen(patch);
			const v = performance.now();
			if (i > 1) {
				total.push(v - t);
				kernel.push(v - u);
			}
			counts = `${grid.cells.length} → ${patch.vertices.length}`;
		}
		console.log(
			`| ${g.kind} | ${large ? 'large' : 'standard'} | ${counts} | ${total.sort((a, b) => a - b)[2].toFixed(2)} | ${kernel.sort((a, b) => a - b)[2].toFixed(2)} |`
		);
	}
