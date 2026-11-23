// Lattice model study: every lattice × every plan grid × three sizes × four seeds, measured
// headlessly against the lattice contract. Writes _lokal/r10d-lattices/study.{json,md}.
// Run: heavy-slot --time 1800 -- bun scripts/lattice-study.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { required } from '../src/lib/core/invariant';
import {
	cityLatticesByPlan,
	cityPlanVariants,
	createCityLattice,
	latticeVolumes,
	levelHeight,
	readCityColumns,
	type CityColumn,
	type CityLattice
} from '../src/lib/domain/city-volume';
import {
	citySiteParams,
	createCitySite,
	readCityDistricts,
	readCityGrid
} from '../src/lib/world/city-site';
import { latticeMetrics } from './city-study-metrics';
import { key } from './city-study-plan';
import { requireSlot } from './experiment-host';

requireSlot();
const out = resolve(import.meta.dir, '../_lokal/r10d-lattices');
mkdirSync(out, { recursive: true });

const sizes = { town: citySiteParams.citySize.default, city: 4600, largest: 7000 } as const;
const seeds = [1201, 42, 2718, 424242];
const city = createCitySite();
const bracedPrisms = new Set(['braced', 'centered', 'tetrahedral']);

type Row = Record<string, string | number | boolean>;

function parts(columns: readonly CityColumn[]) {
	const parent = new Map(columns.map(({ planCellId }) => [planCellId, planCellId]));
	const find = (id: string): string => {
		const up = required(parent.get(id), 'cell');
		return up === id ? id : find(up);
	};
	for (const { planCellId, neighbors } of columns)
		for (const id of neighbors) if (id !== null) parent.set(find(id), find(planCellId));
	return new Set(columns.map(({ planCellId }) => find(planCellId))).size;
}

/** Open solids, faces used by more than two solids, and members that bound no solid. */
function solidMetrics(lattice: CityLattice) {
	let open = 0;
	const uses = new Map<string, number>();
	const solidEdges = new Set<string>();
	for (const { faces } of lattice.solids) {
		const directed = new Set<string>();
		for (const face of faces) {
			uses.set([...face].sort().join(' '), (uses.get([...face].sort().join(' ')) ?? 0) + 1);
			for (const [i, a] of face.entries()) {
				const b = face[(i + 1) % face.length];
				directed.add(`${a}>${b}`);
				solidEdges.add(JSON.stringify(a < b ? [a, b] : [b, a]));
			}
		}
		open += +[...directed].some((edge) => !directed.has(edge.split('>').reverse().join('>')));
	}
	const volumes = latticeVolumes(lattice);
	return {
		solids: lattice.solids.length,
		openSolids: open,
		overusedFaces: [...uses.values()].filter((n) => n > 2).length,
		looseMembers: lattice.edges.filter(({ id }) => !solidEdges.has(id)).length,
		minVolume: Math.min(...volumes),
		volumeKm3: volumes.reduce((a, b) => a + b, 0) / 1e9
	};
}

/** Every column reaches its own height: its top bay owns a solid, and no joint stands higher. */
function profileMetrics(columns: readonly CityColumn[], lattice: CityLattice, datumZ: number) {
	const owned = new Set(lattice.solids.map(({ bay }) => bay));
	const peak = datumZ + levelHeight * Math.max(...columns.map(({ levels }) => levels));
	return {
		missingTops: columns.filter(
			({ planCellId, levels }) => !owned.has(`${planCellId}/level/${levels - 1}`)
		).length,
		aboveProfile: lattice.nodes.filter(({ position }) => position[2] > peak + 1e-6).length
	};
}

const rows: Row[] = [];
const started = performance.now();
for (const plan of cityPlanVariants) {
	for (const [sizeClass, size] of Object.entries(sizes)) {
		for (const seed of seeds) {
			const { grid, datumZ } = readCityGrid(city, size, plan, seed);
			const columns = readCityColumns(grid, readCityDistricts(city, grid, seed));
			const expectedParts = parts(columns);
			for (const lattice of cityLatticesByPlan[plan]) {
				const start = performance.now();
				const frame = createCityLattice(columns, datumZ, plan, lattice);
				const ms = performance.now() - start;
				const again = createCityLattice(columns, datumZ, plan, lattice);
				const deterministic = Bun.hash(JSON.stringify(again)) === Bun.hash(JSON.stringify(frame));
				const metrics = latticeMetrics(columns, frame);
				const places = new Set(frame.nodes.map(({ position }) => key(position)));
				const row: Row = {
					plan,
					lattice,
					sizeClass,
					size,
					seed,
					cells: columns.length,
					parts: expectedParts,
					...metrics,
					duplicateJoints: frame.nodes.length - places.size,
					...solidMetrics(frame),
					...profileMetrics(columns, frame, datumZ),
					deterministic,
					ms
				};
				const checks: [string, boolean][] = [
					['split', metrics.latticeComponents === expectedParts],
					['duplicate-joint', row.duplicateJoints === 0],
					['face-mismatch', metrics.faceMatch === 1],
					['open-solid', row.openSolids === 0],
					['overused-face', row.overusedFaces === 0],
					// Prism bracing lies inside the bay solid; every other model's members are solid edges.
					['loose-member', row.looseMembers === 0 || bracedPrisms.has(lattice)],
					['volume', (row.minVolume as number) > 1],
					['missing-top', row.missingTops === 0],
					['above-profile', row.aboveProfile === 0],
					['nondeterministic', deterministic]
				];
				row.failures = checks
					.filter(([, ok]) => !ok)
					.map(([name]) => name)
					.join(' ');
				row.pass = !row.failures;
				rows.push(row);
			}
		}
		console.error(
			`${plan} ${sizeClass} after ${((performance.now() - started) / 1000).toFixed(0)} s`
		);
	}
}

writeFileSync(resolve(out, 'study.json'), JSON.stringify(rows, null, 1) + '\n');
const models = cityLatticesByPlan.organic;
const pick = (sizeClass: string, lattice: string) =>
	rows.find(
		(row) =>
			row.plan === 'organic' &&
			row.seed === 1201 &&
			row.sizeClass === sizeClass &&
			row.lattice === lattice
	);
const table = [
	'| Lattice | Pass | Town joints | Town members | Town ms | Largest joints | Largest members | Largest solids | Largest ms |',
	'| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
	...models.map((lattice) => {
		const town = required(pick('town', lattice), 'town row');
		const largest = required(pick('largest', lattice), 'largest row');
		const runs = rows.filter((row) => row.lattice === lattice);
		const passed = runs.filter(({ pass }) => pass).length;
		return `| ${lattice} | ${passed}/${runs.length} | ${town.joints} | ${town.members} | ${(town.ms as number).toFixed(0)} | ${largest.joints} | ${largest.members} | ${largest.solids} | ${(largest.ms as number).toFixed(0)} |`;
	})
];
const failed = rows.filter(({ pass }) => !pass);
const report = [
	`# Lattice study`,
	'',
	`${rows.length} runs, ${rows.length - failed.length} pass. Organic plan, seed 1201; town ${sizes.town} m, largest ${sizes.largest} m.`,
	'',
	...table,
	'',
	...failed
		.slice(0, 40)
		.map((row) => `- ${row.plan} ${row.lattice} ${row.sizeClass} ${row.seed}: ${row.failures}`)
].join('\n');
writeFileSync(resolve(out, 'study.md'), report + '\n');
console.log(report);
if (failed.length) process.exitCode = 1;
