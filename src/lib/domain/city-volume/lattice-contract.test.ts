import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { TerrainGrid } from '../terrain-grid';
import {
	cityLatticesByPlan,
	createCityDistricts,
	createCityLattice,
	latticeVolumes,
	levelHeight,
	readCityColumns,
	taperStep,
	type CityColumn,
	type CityLattice,
	type CityPlanVariant,
	type LatticeVariant
} from './index';

const spatial = ['antiprism', 'diagrid', 'tree', 'setback', 'corbel'] as const;
const core = { origin: [0, 0], bearing: 0, aspect: 0.5 } as const;

function town(variant: CityPlanVariant) {
	const site = { origin: [0, 0], bearing: 0, length: 2000, width: 1000 } as const;
	const plan = TerrainGrid.create({
		seed: 1201,
		site,
		variant,
		heightAt: (x, y) => 0.004 * x + 0.002 * y,
		parameters: { cellSize: 60 }
	});
	const columns = readCityColumns(plan, createCityDistricts(plan, core, 1201));
	return { plan, columns };
}

/** A grid of square cells of `size` meters with the given levels per row-major cell. */
function squares(levels: readonly number[][], size = 60): CityColumn[] {
	const corner = (i: number, j: number) => ({
		id: `${i},${j}`,
		position: [i * size, j * size, 0] as const
	});
	const at = (i: number, j: number) => (levels[j]?.[i] ? `c${i},${j}` : null);
	return levels.flatMap((row, j) =>
		row.map((height, i) => ({
			planCellId: `c${i},${j}`,
			corners: [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)],
			neighbors: [at(i, j - 1), at(i + 1, j), at(i, j + 1), at(i - 1, j)],
			districtId: 'block/0',
			kind: 'block' as const,
			levels: height
		}))
	);
}

const build = (
	columns: readonly CityColumn[],
	variant: LatticeVariant,
	plan: CityPlanVariant = 'square'
) => createCityLattice(columns, 10, plan, variant);

/** Every solid is closed: each directed edge of its faces meets its reverse exactly once. */
function closedSolids(lattice: CityLattice) {
	return lattice.solids.every(({ faces }) => {
		const directed = new Map<string, number>();
		for (const face of faces)
			for (const [i, a] of face.entries()) {
				const key = `${a}>${face[(i + 1) % face.length]}`;
				directed.set(key, (directed.get(key) ?? 0) + 1);
			}
		return [...directed].every(([key, count]) => {
			const [a, b] = key.split('>');
			return count === 1 && directed.get(`${b}>${a}`) === 1;
		});
	});
}

/** A face lies on at most two solids, and two solids wind a shared face oppositely. */
function conformingFaces(lattice: CityLattice) {
	const uses = new Map<string, string[]>();
	for (const { faces } of lattice.solids)
		for (const face of faces) {
			const key = [...face].sort().join(' ');
			uses.set(key, [...(uses.get(key) ?? []), face.join(' ')]);
		}
	return [...uses.values()].every(
		(loops) => loops.length === 1 || (loops.length === 2 && loops[0] !== loops[1])
	);
}

function components(lattice: CityLattice) {
	const parent = new Map(lattice.nodes.map(({ id }) => [id, id]));
	const find = (id: string): string => {
		const up = required(parent.get(id), 'joint');
		return up === id ? id : find(up);
	};
	for (const { from, to } of lattice.edges) parent.set(find(from), find(to));
	return new Set(lattice.nodes.map(({ id }) => find(id))).size;
}

function planParts(columns: readonly CityColumn[]) {
	const seen = new Set<string>();
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	let parts = 0;
	for (const { planCellId } of columns) {
		if (seen.has(planCellId)) continue;
		parts++;
		const queue = [planCellId];
		seen.add(planCellId);
		for (const id of queue)
			for (const next of required(byId.get(id), 'column').neighbors)
				if (next !== null && !seen.has(next)) (seen.add(next), queue.push(next));
	}
	return parts;
}

function bayVolume(columns: readonly CityColumn[], datum: number) {
	return columns.reduce((sum, { corners, levels }) => {
		const ring = corners.map(({ position }) => position);
		const area = ring.reduce((a, [x, y], i) => {
			const [u, v] = ring[(i + 1) % ring.length];
			return a + (x * v - u * y) / 2;
		}, 0);
		const base = ring.reduce((z, p) => z + p[2], 0) / ring.length;
		return sum + Math.abs(area) * (datum + levelHeight * levels - base);
	}, 0);
}

const datumOf = (columns: readonly CityColumn[]) =>
	10 + Math.max(...columns.flatMap(({ corners }) => corners.map((c) => c.position[2])));

test('every model builds closed, conforming, connected solids on every plan grid', () => {
	for (const plan of ['organic', 'square', 'hex', 'triangle', 'voronoi'] as const) {
		const { columns } = town(plan);
		const datum = datumOf(columns);
		for (const variant of cityLatticesByPlan[plan]) {
			const lattice = createCityLattice(columns, datum, plan, variant);
			const label = `${plan} ${variant}`;
			const ids = new Set(lattice.nodes.map(({ id }) => id));
			const places = new Set(
				lattice.nodes.map(({ position }) => position.map((v) => v.toFixed(3)).join())
			);
			expect([label, ids.size, places.size]).toEqual([
				label,
				lattice.nodes.length,
				lattice.nodes.length
			]);
			expect(lattice.edges.every(({ from, to }) => ids.has(from) && ids.has(to) && from < to)).toBe(
				true
			);
			expect([label, closedSolids(lattice), conformingFaces(lattice)]).toEqual([label, true, true]);
			expect([label, Math.min(...latticeVolumes(lattice)) > 1]).toEqual([label, true]);
			expect([label, components(lattice)]).toEqual([label, planParts(columns)]);
			expect(createCityLattice(columns, datum, plan, variant)).toEqual(lattice);
			const peak = Math.max(...columns.map(({ levels }) => levels));
			const top = Math.max(...lattice.nodes.map(({ position }) => position[2]));
			expect([label, top]).toEqual([label, datum + levelHeight * peak]);
		}
	}
}, 60_000);

test('solids stay inside the bays and the members are exactly their edges', () => {
	const { columns } = town('hex');
	const datum = datumOf(columns);
	const bays = bayVolume(columns, datum);
	for (const variant of spatial) {
		const lattice = createCityLattice(columns, datum, 'hex', variant);
		const volume = latticeVolumes(lattice).reduce((a, b) => a + b, 0);
		expect(volume).toBeGreaterThan(0.25 * bays);
		// A corbel overhangs lower neighbors and the city edge, so only it may exceed the bays.
		if (variant !== 'corbel') expect(volume).toBeLessThanOrEqual(bays * (1 + 1e-9));
		const fromSolids = new Set(
			lattice.solids.flatMap(({ faces }) =>
				faces.flatMap((face) =>
					face.map((a, i) => {
						const b = face[(i + 1) % face.length];
						return JSON.stringify(a < b ? [a, b] : [b, a]);
					})
				)
			)
		);
		expect(new Set(lattice.edges.map(({ id }) => id))).toEqual(fromSolids);
	}
});

test('example: one square cell in each model', () => {
	const one = squares([[2]]);
	const count = (variant: LatticeVariant) => {
		const { nodes, edges, solids } = build(one, variant);
		return [nodes.length, edges.length, solids.length];
	};
	// Plan square, centre apex at 7 m, plan square at 14 m: two pyramids tip to tip.
	expect(count('antiprism')).toEqual([9, 16, 2]);
	// Square, midpoint diamond at 7 m, square again: two cut-corner frustums.
	expect(count('diagrid')).toEqual([12, 28, 2]);
	// One foot, the midpoint diamond, then the corners: an inverted pyramid and a frustum.
	expect(count('tree')).toEqual([9, 20, 2]);
	const foot = build(one, 'tree').nodes.find(({ id }) => id === 'cell/c0,0/level/0');
	expect(foot?.position).toEqual([30, 30, 0]);
	const corner = (variant: LatticeVariant, level: number) =>
		build(one, variant).nodes.find(({ id }) => id === `vertex/0,0/level/${level}`)?.position;
	const run = taperStep / Math.SQRT2;
	const near = (actual: readonly number[] | undefined, expected: readonly number[]) =>
		expected.forEach((value, i) => expect(actual?.[i]).toBeCloseTo(value, 9));
	near(corner('setback', 1), [run, run, 17]);
	expect(corner('setback', 2)?.[0]).toBeCloseTo(2 * run, 9);
	near(corner('corbel', 1), [-run, -run, 17]);
});

test('example: a uniform square field fills the bays exactly with interior solids', () => {
	const field = squares(Array.from({ length: 4 }, () => [2, 2, 2, 2]));
	// The first bay rises from the ground at 0 m to the first plane at 17 m, the second to 24 m.
	const cell = (60 * 60 * 24) / 2;
	const total = (variant: LatticeVariant) =>
		latticeVolumes(build(field, variant)).reduce((a, b) => a + b, 0) / cell;
	// Each layer: 16 cell pyramids (1/3), 24 inner edge tetrahedra (1/6), 9 corner pyramids (1/3).
	expect(total('antiprism')).toBeCloseTo(2 * (16 / 3 + 24 / 6 + 9 / 3), 9);
	// Each layer: 16 frustums (5/6) and 9 inner corner pyramids (1/6).
	expect(total('diagrid')).toBeCloseTo(2 * (16 * (5 / 6) + 9 / 6), 9);
	expect(total('box')).toBeCloseTo(32, 9);
	expect(total('tree')).toBeLessThan(32);
});

test('example: a lower neighbor stops the shared solids at its own height', () => {
	const pair = squares([[1, 3]]);
	for (const variant of ['antiprism', 'diagrid'] as const) {
		const { solids } = build(pair, variant);
		const owners = (level: number) =>
			solids.filter(({ bay }) => bay.endsWith(`/level/${level}`)).map(({ id }) => id);
		expect(owners(0).some((id) => id.startsWith('edge/') || id.startsWith('vertex/'))).toBe(
			variant === 'antiprism'
		);
		expect(owners(1)).toEqual(['c1,0/level/1/cell']);
		expect(owners(2)).toEqual(['c1,0/level/2/cell']);
	}
	// The tall column steps back from its lower neighbor and from the open city edge.
	const shared = build(pair, 'setback').nodes.find(({ id }) => id === 'vertex/1,0/level/2');
	const inner = build(pair, 'setback').nodes.find(({ id }) => id === 'vertex/2,1/level/1');
	expect(shared?.position[0]).toBeGreaterThan(60);
	expect(inner?.position.slice(0, 2)).not.toEqual([120, 60]);
});
