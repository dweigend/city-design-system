// Terrain acceptance study: relief × lake mode × seed, measured headlessly in the 4 km survey
// square. Checks the hydrology invariants per run and writes _lokal/r08b-terrain/study.json.
// Run: heavy-slot --time 900 -- bun scripts/terrain-study.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { surveyValley, Valley, valleyLakeModes } from '../src/lib/domain/valley';
import { requireSlot } from './experiment-host';

requireSlot();
const out = resolve(import.meta.dir, '../_lokal/r08b-terrain');
mkdirSync(out, { recursive: true });

const reliefs = [0, 0.25, 0.5, 0.75, 1];
const seeds = [1201, 1301, 1409, 7, 42, 314, 2718, 9001, 65535, 424242, 31337, 8086];

type Row = {
	relief: number;
	lake: string;
	seed: number;
	generationMs: number;
	reliefM: number;
	maxSlope: number;
	waterShare: number;
	lakeAreaKm2: number;
	buildableShare: number;
	hasLake: boolean;
	pass: boolean;
	faults: string;
};

function run(relief: number, lake: number, seed: number): Row {
	const start = performance.now();
	const valley = Valley.create({ seed, parameters: { relief, lake } });
	const generationMs = performance.now() - start;
	const again = Valley.create({ seed, parameters: { relief, lake } });
	const survey = surveyValley(valley);
	const { uphillSteps, lakeTiltM, dryBelowWater } = survey.faults;
	const deterministic =
		Bun.hash(JSON.stringify(again.grid)) === Bun.hash(JSON.stringify(valley.grid));
	const lakeExpected = lake === 2 ? valley.lake !== null : lake === 0 ? valley.lake === null : true;
	const lakeSeen = valley.lake === null || survey.lakeArea > 0;
	const pass =
		uphillSteps === 0 &&
		lakeTiltM === 0 &&
		dryBelowWater === 0 &&
		deterministic &&
		lakeExpected &&
		lakeSeen;
	return {
		relief,
		lake: valleyLakeModes[lake],
		seed,
		generationMs,
		reliefM: survey.reliefM,
		maxSlope: survey.maxSlope,
		waterShare: survey.waterShare,
		lakeAreaKm2: survey.lakeArea / 1e6,
		buildableShare: survey.buildableShare,
		hasLake: valley.lake !== null,
		pass,
		faults: JSON.stringify({
			uphillSteps,
			lakeTiltM,
			dryBelowWater,
			deterministic,
			lakeExpected,
			lakeSeen
		})
	};
}

function spread(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b);
	const median =
		(sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
	return { min: sorted[0], median, max: sorted[sorted.length - 1] };
}

const rows: Row[] = [];
for (const relief of reliefs)
	for (const lake of [0, 1, 2]) for (const seed of seeds) rows.push(run(relief, lake, seed));

const failures = rows.filter((row) => !row.pass);
const metrics = [
	'reliefM',
	'maxSlope',
	'waterShare',
	'lakeAreaKm2',
	'buildableShare',
	'generationMs'
] as const;
const format = (value: number) => (Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(3));
const summary = reliefs.map((relief) => {
	const group = rows.filter((row) => row.relief === relief);
	const lakes = group.filter((row) => row.lake === 'seeded' && row.hasLake).length;
	const line = metrics.map((metric) => {
		const { min, median, max } = spread(group.map((row) => row[metric]));
		return `${metric} ${format(min)}/${format(median)}/${format(max)}`;
	});
	return `relief ${relief.toFixed(2)} · seeded lakes ${lakes}/${seeds.length} · ${line.join(' · ')}`;
});
writeFileSync(resolve(out, 'study.json'), JSON.stringify(rows, null, 1));
console.log(
	`runs ${rows.length}, passed ${rows.length - failures.length}, min/median/max per relief:`
);
for (const line of summary) console.log(line);
for (const failure of failures)
	console.log('FAIL', failure.relief, failure.lake, failure.seed, failure.faults);
if (failures.length) process.exit(1);
