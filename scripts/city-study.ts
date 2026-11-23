// City volume acceptance study: every plan grid × lattice × size class × seed × complexity,
// measured headlessly. Writes _lokal/r10-study/results.{json,csv} and prints a summary.
// Run: heavy-slot --time 1800 -- bun scripts/city-study.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	cityLatticesByPlan,
	cityPlanVariants,
	createCityLattice,
	maximumLevelStep,
	readCityColumns
} from '../src/lib/domain/city-volume';
import {
	citySiteParams,
	createCitySite,
	readCityDistricts,
	readCityGrid
} from '../src/lib/world/city-site';
import { districtMetrics, growthMetrics, latticeMetrics } from './city-study-metrics';
import { planMetrics } from './city-study-plan';
import { summarize, type Row } from './city-study-summary';
import { requireSlot } from './experiment-host';

requireSlot();
const out = resolve(import.meta.dir, '../_lokal/r10-study');
mkdirSync(out, { recursive: true });

/** Nominal outline lengths in meters of the three size classes. */
const sizes = { village: 1200, town: 2600, city: 6000 } as const;
const seeds = [1201, 7, 42, 314, 2718, 9001, 65535, 424242];
const complexities = { low: 0.1, high: 0.9 } as const;
const expectedKinds: Record<keyof typeof sizes, string> = {
	village: 'detached',
	town: 'block,detached',
	city: 'block,center,detached'
};
const growthStep = citySiteParams.citySize.step;
const city = createCitySite();

const time = <T>(run: () => T): [T, number] => {
	const start = performance.now();
	const value = run();
	return [value, performance.now() - start];
};
const hash = (value: unknown) => Bun.hash(JSON.stringify(value)).toString(16);

const rows: Row[] = [];
const started = performance.now();
for (const plan of cityPlanVariants) {
	for (const [sizeClass, size] of Object.entries(sizes) as [keyof typeof sizes, number][]) {
		for (const seed of seeds) {
			const [{ grid, areaKm2 }, gridMs] = time(() => readCityGrid(city, size, plan, seed));
			const gridStable = hash(readCityGrid(city, size, plan, seed).grid) === hash(grid);
			const grown = readCityGrid(city, size + growthStep, plan, seed).grid;
			const planned = planMetrics(grid);
			for (const [complexityName, complexity] of Object.entries(complexities)) {
				const settings = { complexity };
				const [districts, districtMs] = time(() => readCityDistricts(city, grid, seed, settings));
				const columns = readCityColumns(grid, districts);
				const again = readCityColumns(grid, readCityDistricts(city, grid, seed, settings));
				const growth = growthMetrics(
					columns,
					readCityColumns(grown, readCityDistricts(city, grown, seed, settings))
				);
				const district = districtMetrics(grid, columns);
				for (const lattice of cityLatticesByPlan[plan]) {
					const [frame, latticeMs] = time(() =>
						createCityLattice(columns, city.datumZ, plan, lattice)
					);
					const frameStable =
						hash(createCityLattice(again, city.datumZ, plan, lattice)) === hash(frame);
					const row: Row = {
						plan,
						lattice,
						sizeClass,
						size,
						seed,
						complexity: complexityName,
						areaKm2,
						settlement: districts.settlement,
						...planned,
						...district,
						...latticeMetrics(columns, frame),
						...growth,
						deterministic: gridStable && frameStable,
						gridMs,
						districtMs,
						latticeMs
					};
					row.failures = failures(row, sizeClass).join(' ');
					row.pass = !row.failures;
					rows.push(row);
				}
			}
		}
		console.error(
			`${plan} ${sizeClass} done after ${((performance.now() - started) / 1000).toFixed(0)} s`
		);
	}
}

function failures(row: Row, sizeClass: keyof typeof sizes) {
	const checks: [string, boolean][] = [
		['column', row.everyCellHasColumn === true],
		['non-manifold', row.nonManifold === 0],
		['hanging', row.hanging === 0],
		['duplicate-vertex', row.duplicateVertices === 0],
		['duplicate-joint', row.duplicateNodes === 0],
		['face-mismatch', row.faceMatch === 1],
		['split-lattice', row.latticeComponents === 1],
		['hole', row.holes === 0],
		['degenerate', (row.degenerateShare as number) <= 0.01],
		['concave', row.concave === 0],
		['kinds', row.kinds === expectedKinds[sizeClass]],
		['step', (row.maxJump as number) <= maximumLevelStep],
		['nondeterministic', row.deterministic === true],
		[
			'growth',
			row.growthLost === 0 &&
				row.growthMoved === 0 &&
				row.growthDemoted === 0 &&
				row.growthLowered === 0
		]
	];
	return checks.filter(([, ok]) => !ok).map(([name]) => name);
}

writeFileSync(resolve(out, 'results.json'), JSON.stringify(rows, null, 1) + '\n');
const columns = Object.keys(rows[0]);
writeFileSync(
	resolve(out, 'results.csv'),
	[
		columns.join(','),
		...rows.map((row) => columns.map((c) => JSON.stringify(row[c] ?? '')).join(','))
	].join('\n') + '\n'
);
summarize(rows, out, sizes);
