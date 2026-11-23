// City volume acceptance across all grids and lattices at town scale with selected size extremes.
// Writes _lokal/r09b-river/city-study-morph/results.{json,csv} and prints a summary.
// Run: heavy-slot --time 1800 -- bun scripts/city-study.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { required } from '../src/lib/core/invariant';
import {
	cityLatticesByPlan,
	cityPlanVariants,
	createCityLattice,
	maximumLevelStep,
	prismVariants,
	readCityColumns
} from '../src/lib/domain/city-volume';
import {
	citySiteParams,
	citySiteConfig,
	createCitySite,
	readCitySide,
	readCityDistricts,
	readCityGrid
} from '../src/lib/world/city-site';
import { TerrainGrid } from '../src/lib/domain/terrain-grid';
import { groundContactMetrics, groundMetrics, hubGroundMetrics } from './city-study-ground';
import { districtMetrics, growthMetrics, latticeMetrics } from './city-study-metrics';
import { shoreMetrics } from './city-study-shore';
import { planMetrics } from './city-study-plan';
import { footprintMirrorShare, maximumMedianMirrorShare, mirrorSeeds } from './city-study-mirror';
import { solidMetrics } from './city-study-solids';
import { summarize, type Row } from './city-study-summary';
import { requireSlot } from './experiment-host';

requireSlot();
const out = resolve(import.meta.dir, '../_lokal/r09b-river/city-study-morph');
mkdirSync(out, { recursive: true });

/** Nominal outline lengths in meters of the three size classes. */
const sizes = {
	village: 1200,
	town: citySiteParams.citySize.default,
	largest: citySiteParams.citySize.max
} as const;
const terrain = [
	{ relief: 0, runoff: 1, seeds: [1201, 42] },
	{ relief: 0.75, runoff: 1.5, seeds: [42] },
	{ relief: 1, runoff: 0.5, seeds: [42] }
];
const bracedPrisms = new Set<string>(prismVariants.filter((variant) => variant !== 'box'));
const studyToleranceM = 0.001;
const growthStep = citySiteParams.citySize.step;
const settings = { complexity: 0.35 };
const expectedKinds = {
	village: 'detached',
	town: 'block,detached',
	city: 'block,center,detached'
} as const;

const time = <T>(run: () => T): [T, number] => {
	const start = performance.now();
	const value = run();
	return [value, performance.now() - start];
};
const hash = (value: unknown) => Bun.hash(JSON.stringify(value)).toString(16);

const rows: Row[] = [];
const shoreRows = [];
const started = performance.now();
for (const { relief, runoff, seeds } of terrain) {
	const sites = new Map(
		seeds.map((seed) => [seed, createCitySite(undefined, { relief, runoff, seed })])
	);
	for (const plan of cityPlanVariants) {
		const from = rows.length;
		for (const seed of seeds) {
			const city = required(sites.get(seed), 'study site');
			const replay = createCitySite(undefined, { relief, runoff, seed });
			for (const [sizeClass, size] of Object.entries(sizes)) {
				const [layout, gridMs] = time(() => readCityGrid(city, size, plan, seed));
				const { grid, areaKm2, datumZ, crossings } = layout;
				const shore = shoreMetrics(layout, city.sampleGround);
				shoreRows.push({
					plan,
					seed,
					size,
					relief,
					runoff,
					...shore
				});
				const gridStable = hash(readCityGrid(replay, size, plan, seed)) === hash(layout);
				const earlier =
					sizeClass === 'largest' ? readCityGrid(city, size - growthStep, plan, seed) : layout;
				const grown =
					sizeClass === 'largest' ? layout : readCityGrid(city, size + growthStep, plan, seed);
				const planned = planMetrics(grid, (point) => readCitySide(city, point), layout);
				const [districts, districtMs] = time(() => readCityDistricts(city, layout, seed, settings));
				const columns = readCityColumns(grid, districts);
				const clone = JSON.parse(JSON.stringify(layout)) as typeof layout;
				const again = readCityColumns(clone.grid, readCityDistricts(city, clone, seed, settings));
				const cloneStable = hash(again) === hash(columns);
				const growth = growthMetrics(
					earlier === layout
						? columns
						: readCityColumns(earlier.grid, readCityDistricts(city, earlier, seed, settings)),
					grown === layout
						? columns
						: readCityColumns(grown.grid, readCityDistricts(city, grown, seed, settings)),
					grown.growth.rankedCellIds
				);
				const district = districtMetrics(grid, columns);
				const ground = {
					...groundMetrics(city, columns),
					renderedGroundChecked: sizeClass === 'largest',
					...(sizeClass === 'largest' ? groundContactMetrics(city, grid) : {})
				};
				const raised = TerrainGrid.select(
					grid,
					columns.filter(({ kind }) => kind !== 'detached').map(({ planCellId }) => planCellId)
				);
				const raisedHoles = raised.cells.length ? planMetrics(raised).holes : 0;
				const studyLattices = cityLatticesByPlan[plan].filter(
					(lattice) => sizeClass === 'town' || lattice === 'box' || lattice === 'centered'
				);
				const spans = crossings.map(({ path }) => path.lengthM).sort((a, b) => a - b);
				for (const lattice of studyLattices) {
					const [frame, latticeMs] = time(() => createCityLattice(columns, datumZ, plan, lattice));
					// A single largest-plan replay per lattice covers the full input extent.
					const frameStable =
						sizeClass !== 'largest' ||
						hash(createCityLattice(again, datumZ, plan, lattice)) === hash(frame);
					const row: Row = {
						plan,
						lattice,
						sizeClass,
						size,
						seed,
						relief,
						runoff,
						complexity: settings.complexity,
						areaKm2,
						settlement: districts.settlement,
						...planned,
						crossings: spans.length,
						selectedCrossings: layout.selectedCrossings.length,
						spanMinM: spans[0] ?? '',
						spanMedianM: spans.length
							? (spans[Math.floor(spans.length / 2)] + spans[Math.floor((spans.length - 1) / 2)]) /
								2
							: '',
						spanMaxM: spans.at(-1) ?? '',
						...district,
						...ground,
						...(lattice === 'centered' ? hubGroundMetrics(city, frame) : {}),
						raisedHoles,
						...latticeMetrics(columns, frame),
						...solidMetrics(frame),
						...growth,
						deterministic: gridStable && frameStable,
						cloneStable,
						shoreCrossingsValid: spans.every(
							(span) => span > 0 && span <= citySiteConfig.crossingMaxLengthM
						),
						shoreAlignmentValid:
							plan !== 'organic' ||
							seed !== 1201 ||
							relief !== 0 ||
							sizeClass !== 'town' ||
							(shore.clipped > 0 && shore.alignedEdges > 0),
						gridMs,
						districtMs,
						latticeMs
					};
					row.failures = failures(row, expectedKinds[districts.settlement]).join(' ');
					row.pass = !row.failures;
					rows.push(row);
				}
			}
		}
		const failed = rows.slice(from).filter(({ pass }) => !pass);
		if (failed.length)
			console.error(
				JSON.stringify(
					failed.map(({ seed, sizeClass, lattice, failures, degenerateShare, raisedHoles }) => ({
						seed,
						sizeClass,
						lattice,
						failures,
						degenerateShare,
						raisedHoles
					}))
				)
			);
		console.error(
			`relief ${relief} runoff ${runoff} ${plan} done after ${((performance.now() - started) / 1000).toFixed(0)} s`
		);
	}
}

function failures(row: Row, kinds: string) {
	const checks: [string, boolean][] = [
		['column', row.everyCellHasColumn === true],
		['non-manifold', row.nonManifold === 0],
		['hanging', row.hanging === 0],
		['duplicate-vertex', row.duplicateVertices === 0],
		['duplicate-joint', row.duplicateNodes === 0],
		['face-mismatch', row.faceMatch === 1 && row.faceConflicts === 0],
		['open-solid', row.openSolids === 0 && row.nonManifoldSolidEdges === 0],
		['bay-address', row.unresolvedBayAddresses === 0],
		['clone', row.cloneStable === true],
		['crossing-span', row.shoreCrossingsValid === true],
		['shore-alignment', row.shoreAlignmentValid === true],
		['folded-cap', row.foldedCaps === 0],
		['bay-solid', row.orphanSolids === 0 && row.missingSolids === 0],
		['solid-volume', Number(row.minVolume) > 0],
		['loose-member', row.looseMembers === 0 || bracedPrisms.has(String(row.lattice))],
		['split-lattice', row.latticeComponents === row.parts],
		['hole', row.holes === 0 && row.raisedHoles === 0],
		['wet-ground', row.wetProbes === 0],
		['cell-rise', row.excessiveCellRises === 0],
		[
			'foundation',
			row.missingFeet === 0 &&
				(!row.renderedGroundChecked || row.missingRenderedFeet === 0) &&
				Number(row.maxFoundationErrorM) <= studyToleranceM &&
				Number(row.maxJointErrorM) <= studyToleranceM
		],
		[
			'ground-hub',
			Number(row.maxHubUndershootM ?? 0) <= studyToleranceM &&
				Number(row.hubCount ?? 1) > 0 &&
				Number(row.maxGroundHubErrorM ?? 0) <= studyToleranceM
		],
		['parts', Number(row.partsWithoutRiverSplit) <= 8],
		['degenerate', (row.degenerateShare as number) <= 0.01],
		['concave', row.concave === 0],
		['kinds', row.kinds === kinds],
		['step', (row.maxJump as number) <= maximumLevelStep],
		['nondeterministic', row.deterministic === true],
		[
			'growth',
			Number(row.growthAdded) > 0 &&
				row.growthLost === 0 &&
				row.growthMoved === 0 &&
				row.growthDemoted === 0 &&
				row.growthLowered === 0 &&
				row.unexpectedDistrictChanges === 0
		]
	];
	return checks.filter(([, ok]) => !ok).map(([name]) => name);
}

writeFileSync(resolve(out, 'shore.json'), JSON.stringify(shoreRows, null, 1) + '\n');
writeFileSync(resolve(out, 'results.json'), JSON.stringify(rows, null, 1) + '\n');
const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
writeFileSync(
	resolve(out, 'results.csv'),
	[
		columns.join(','),
		...rows.map((row) => columns.map((c) => JSON.stringify(row[c] ?? '')).join(','))
	].join('\n') + '\n'
);
summarize(rows, out, sizes);
const plans = rows.filter(({ lattice }) => lattice === 'box');
function median(field: string) {
	const values = plans.map((row) => Number(row[field])).sort((a, b) => a - b);
	return (values[Math.floor(values.length / 2)] + values[Math.floor((values.length - 1) / 2)]) / 2;
}
const parts = median('partsWithoutRiverSplit');
const compactness = median('compactness');
console.log('Footprint medians across the city matrix', { parts, compactness });
const mirror = mirrorSeeds.map((seed) => {
	const site = createCitySite(undefined, { seed, relief: 0, runoff: 1 });
	const { grid } = readCityGrid(site, 2600, 'organic', seed);
	return { seed, share: footprintMirrorShare(grid, site.valley.course.xy) };
});
writeFileSync(resolve(out, 'mirror.json'), JSON.stringify(mirror, null, 2) + '\n');
const shares = mirror.map(({ share }) => share).sort((a, b) => a - b);
const medianMirror =
	(shares[Math.floor(shares.length / 2)] + shares[Math.floor((shares.length - 1) / 2)]) / 2;
console.log('Lowland mirror share', { min: shares[0], median: medianMirror, max: shares.at(-1) });
if (
	rows.some(({ pass }) => !pass) ||
	parts > 3 ||
	compactness < 0.45 ||
	compactness > 0.65 ||
	medianMirror > maximumMedianMirrorShare
)
	process.exitCode = 1;
