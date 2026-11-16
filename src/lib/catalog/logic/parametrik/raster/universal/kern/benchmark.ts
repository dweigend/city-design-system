/** bun src/lib/catalog/logic/parametrik/raster/universal/kern/benchmark.ts */
import { gridGenerators } from '../../index';
import { organicGrid, toPatch } from '../index';
import { fieldGrid, fromPatch, transact, compile, type Model } from './index';
console.log(
	'| Grid | Quads | Core p50 ms | Core p95 ms | min J_s | min angle ° | max aspect ratio |'
);
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const g of [...gridGenerators, { kind: 'organic-legacy', generate: organicGrid }]) {
	const patch = toPatch(g.generate({}, 42), { iterations: 0 });
	const times: number[] = [];
	let model: Model | undefined;
	try {
		for (let n = 0; n < 7; n++) {
			const t = performance.now();
			model = fromPatch(patch);
			if (n > 1) times.push(performance.now() - t);
		}
		const q = [...model!.chunks.values()].flatMap((c) => [...c.geometry.quality.values()]);
		times.sort((a, b) => a - b);
		console.log(
			`| ${g.kind} | ${q.length} | ${times[2].toFixed(2)} | ${times[4].toFixed(2)} | ${Math.min(...q.map((v) => v.minJacobian)).toFixed(4)} | ${Math.min(...q.map((v) => v.minAngle)).toFixed(2)} | ${Math.max(...q.map((v) => v.aspect)).toFixed(2)} |`
		);
	} catch (e) {
		console.log(
			`| ${g.kind} | — | abgewiesen: ${e instanceof Error ? e.message : String(e)} | — | — | — | — |`
		);
	}
}
const times: number[] = [];
let result: ReturnType<typeof fieldGrid> | undefined;
for (let n = 0; n < 7; n++) {
	const t = performance.now();
	result = fieldGrid(
		{
			angle: 0,
			strength: 1,
			density: 1,
			sources: [{ kind: 'direction', point: [20, 20], radius: 40, weight: 0.4, angle: 0.1 }]
		},
		{ min: [0, 0], max: [40, 40] },
		9
	);
	if (n > 1) times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
const m = result!.model,
	q = [...m.chunks.values()].flatMap((c) => [...c.geometry.quality.values()]);
console.log(
	`| field-native (incl. integration) | ${q.length} | ${times[2].toFixed(2)} | ${times[4].toFixed(2)} | ${Math.min(...q.map((v) => v.minJacobian)).toFixed(4)} | ${Math.min(...q.map((v) => v.minAngle)).toFixed(2)} | ${Math.max(...q.map((v) => v.aspect)).toFixed(2)} |`
);
const local: number[] = [],
	full: number[] = [];
const id = 'cross:4:4',
	p = m.intent.positions.get(id)!;
for (let n = 0; n < 22; n++) {
	let t = performance.now();
	const tx = transact(m, { positions: new Map([[id, [p[0] + 0.05, p[1]]]]) });
	const elapsed = performance.now() - t;
	t = performance.now();
	compile(tx.after.intent);
	if (n > 1) {
		local.push(elapsed);
		full.push(performance.now() - t);
	}
}
local.sort((a, b) => a - b);
full.sort((a, b) => a - b);
console.log(
	`\nLocal update (4/64 subtrees), p50/p95: ${local[10].toFixed(2)}/${local[18].toFixed(2)} ms. Full build: ${full[10].toFixed(2)}/${full[18].toFixed(2)} ms.`
);
