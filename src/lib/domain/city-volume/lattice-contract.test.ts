import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import type { Vec2 } from '../../core/geometry';
import { createCellSpace, defaultStoreyHeightM } from '../cell-space';
import { planEdgeId, TerrainGrid, type PlanVariant } from '../terrain-grid';
import {
	latticeVariants,
	cityVolumeConfig,
	subdivideBay,
	solidEdgeFaults,
	columnRoof,
	createCityDistricts,
	createCityLattice,
	latticeVolumes,
	levelHeight,
	readCityColumns,
	taperStep,
	storeysPerLevel,
	createCityTaper,
	type CityColumn,
	type CityLattice,
	type LatticeBay,
	type LatticeVariant
} from './index';

test('address example: the ceiling of a bay is the floor of the next bay', () => {
	const { cells, faces } = build(squares([[4]]), 'box');
	expect(cells[0].ceilingFace).toBe('cap/c0,0/level/1');
	expect(cells[1].floorFace).toBe(cells[0].ceilingFace);
	expect(faces.find(({ id }) => id === cells[1].floorFace)?.corners).toEqual([
		'vertex/0,0/level/1',
		'vertex/1,0/level/1',
		'vertex/1,1/level/1',
		'vertex/0,1/level/1'
	]);
});

test('address example: an antiprism face resolves its canonical corners independently of model joints', () => {
	const { faces, nodes, bayCorners } = build(squares([[4]]), 'antiprism');
	const cap = required(
		faces.find(({ id }) => id === 'cap/c0,0/level/3'),
		'centre plane cap'
	);
	const canonical = new Set(bayCorners.map(({ id }) => id));
	const model = new Set(nodes.map(({ id }) => id));
	expect(cap.corners.every((id) => canonical.has(id))).toBe(true);
	expect(cap.corners.every((id) => !model.has(id))).toBe(true);
});

test('address example: neighboring sloped antiprism bays share four child faces and their edges', () => {
	const columns = squares([[2, 2]]).map((column) => ({
		...column,
		corners: column.corners.map(({ id, position: [x, y] }) => ({
			id,
			position: [x, y, x / 10 + y / 20] as const
		}))
	}));
	const { cells } = createCityLattice(columns, 0, 'antiprism');
	const a = required(
		cells.find(({ id }) => id === 'c0,0/level/1'),
		'west bay'
	);
	const b = required(
		cells.find(({ id }) => id === 'c1,0/level/1'),
		'east bay'
	);
	expect(a.sideFaces[1]).toBe(`side/${planEdgeId('1,0', '1,1')}/level/1`);
	expect(b.sideFaces[3]).toBe(a.sideFaces[1]);
	const west = subdivideBay(a);
	const east = subdivideBay(b);
	expect(west).toHaveLength(8);
	expect(west[0].id).toBe('c0,0/level/1/child/["0,0",0]');
	const eFaces = new Map(east.flatMap(({ sideFaces }) => sideFaces.map((face) => [face.id, face])));
	const common = west.flatMap(({ sideFaces }) => sideFaces.filter(({ id }) => eFaces.has(id)));
	expect(common).toHaveLength(4);
	for (const face of common) {
		const opposite = required(eFaces.get(face.id), 'child interface');
		expect(new Set(face.edges)).toEqual(new Set(opposite.edges));
	}
});

test('address example: child caps also weld across the coarse horizontal interface', () => {
	const { cells } = build(squares([[2]]), 'box');
	const lower = subdivideBay(cells[0]).map(({ ceilingFace }) => ceilingFace.id);
	const upper = new Set(subdivideBay(cells[1]).map(({ floorFace }) => floorFace.id));
	expect(lower.filter((id) => upper.has(id))).toHaveLength(4);
});

const spatial = ['antiprism', 'diagrid', 'tree'] as const;
const core = { origin: [0, 0], bearing: 0, aspect: 0.5 } as const;

function town(variant: PlanVariant) {
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
			districtId: 'district/c0,0',
			densityRegionId: 'block/c0,0',
			kind: 'block' as const,
			levels: height
		}))
	);
}

const build = (columns: readonly CityColumn[], variant: LatticeVariant) =>
	createCityLattice(columns, 10, variant);

/** Every solid is closed: each directed edge of its faces meets its reverse exactly once. */
function closedSolids(lattice: CityLattice) {
	return lattice.solids.every(({ faces }) => {
		const { open, nonManifold } = solidEdgeFaults(faces);
		return open === 0 && nonManifold === 0;
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
	return [...uses.values()].every((loops) => {
		if (loops.length === 1) return true;
		if (loops.length !== 2) return false;
		const [a, b] = loops.map((loop) => loop.split(' '));
		const start = b.indexOf(a[0]);
		return a.every((id, i) => id === b.at((start - i) % b.length));
	});
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
				if (next !== null && !seen.has(next)) {
					seen.add(next);
					queue.push(next);
				}
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
	for (const plan of [
		'organic',
		'square',
		'hex',
		'triangle',
		'bands',
		'contour',
		'voronoi'
	] as const) {
		const { columns } = town(plan);
		const datum = datumOf(columns);
		for (const variant of latticeVariants) {
			const lattice = createCityLattice(columns, datum, variant);
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
			expect(createCityLattice(columns, datum, variant)).toEqual(lattice);
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
		const lattice = createCityLattice(columns, datum, variant);
		const volume = latticeVolumes(lattice).reduce((a, b) => a + b, 0);
		expect(volume).toBeGreaterThan(0.25 * bays);
		expect(volume).toBeLessThanOrEqual(bays * (1 + 1e-9));
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
	const one = squares([[4]]);
	const count = (variant: LatticeVariant) => {
		const { nodes, edges, solids } = build(one, variant);
		return [nodes.length, edges.length, solids.length];
	};

	// Two prism bays precede the alternating spatial pair on this site.
	expect(count('antiprism')).toEqual([17, 32, 4]);
	expect(count('diagrid')).toEqual([20, 44, 4]);
	// The foundation cap supports one central foot. The next two bays branch to the ring.
	expect(count('tree')).toEqual([21, 44, 4]);
	const foot = build(one, 'tree').nodes.find(({ id }) => id === 'cell/c0,0/level/1');
	expect(foot?.position).toEqual([30, 30, 17]);
});

test('example: the taper field retreats a corner by one step per level above its foundation', () => {
	const one = squares([[4]]);
	const taper = createCityTaper(one, 10);
	const run = taperStep / Math.SQRT2;
	const near = (actual: readonly number[], expected: readonly number[]) =>
		expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 9));
	near(taper([0, 0, 17]), [0, 0]);
	near(taper([0, 0, 24]), [run, run]);
	near(taper([0, 0, 31]), [2 * run, 2 * run]);
	// Between two planes the move is linear, and the centre moves with the mean of its corners.
	near(taper([0, 0, 27.5]), [1.5 * run, 1.5 * run]);
	near(taper([30, 30, 31]), [0, 0]);
	near(taper([30, 0, 24]), [0, run]);
	expect(() => taper([7, 7, 24])).toThrow(RangeError);
	// Every lattice joint is a plan address of the field, also on irregular plan cells.
	for (const variant of latticeVariants)
		for (const { position } of build(one, variant).nodes) expect(taper(position)).toHaveLength(2);
	const { columns } = town('organic');
	const datum = datumOf(columns);
	const field = createCityTaper(columns, datum);
	for (const variant of latticeVariants)
		for (const { position } of createCityLattice(columns, datum, variant).nodes)
			expect(field(position)).toHaveLength(2);
}, 60_000);

test('example: a uniform square field fills the bays exactly with interior solids', () => {
	const field = squares(Array.from({ length: 4 }, () => [4, 4, 4, 4]));
	const total = (variant: LatticeVariant) =>
		latticeVolumes(build(field, variant)).reduce((a, b) => a + b, 0) / (60 * 60);
	// The first 24 m are prisms. The two spatial layers contribute another 7 m each.
	const foundation = 16 * 24;
	expect(total('antiprism')).toBeCloseTo(foundation + 14 * (16 / 3 + 24 / 6 + 9 / 3), 9);
	expect(total('diagrid')).toBeCloseTo(foundation + 14 * (16 * (5 / 6) + 9 / 6), 9);
	expect(total('box')).toBeCloseTo(16 * 38, 9);
	expect(total('tree')).toBeLessThan(16 * 38);
});

test('example: a lower neighbor stops the shared solids at its own height', () => {
	const pair = squares([[3, 5]]);
	for (const variant of ['antiprism', 'diagrid'] as const) {
		const { solids } = build(pair, variant);
		const owners = (level: number) =>
			solids.filter(({ bay }) => bay.endsWith(`/level/${level}`)).map(({ id }) => id);
		expect(owners(2).some((id) => id.startsWith('edge/') || id.startsWith('vertex/'))).toBe(
			variant === 'antiprism'
		);
		expect(owners(4)).toEqual(['c1,0/level/4/cell']);
		expect(owners(3)).toEqual(['c1,0/level/3/cell']);
	}
	// The tall column steps back from its lower neighbor and from the open city edge.
	const steps = squares([[1, 3]]);
	const taper = createCityTaper(steps, 10);
	const level = (n: number) => 10 + n * levelHeight;
	expect(taper([60, 0, level(2)])[0]).toBeGreaterThan(0);
	expect(taper([120, 60, level(2)])).not.toEqual([0, 0]);
});

test('all seven models share exact slope contacts and close their clamped bays', () => {
	const columns = squares([
		[2, 3],
		[2, 3]
	]).map((column) => ({
		...column,
		corners: column.corners.map(({ id, position: [x, y] }) => ({
			id,
			position: [x, y, 0.11 * x + 0.06 * y] as const
		}))
	}));
	for (const model of latticeVariants) {
		const frame = createCityLattice(columns, 0, model);
		const nodes = new Map(frame.nodes.map(({ id, position }) => [id, position]));
		for (const { corners } of columns)
			for (const { id, position } of corners)
				expect([model, nodes.get(`vertex/${id}/level/0`)]).toEqual([model, position]);
		expect([model, closedSolids(frame), conformingFaces(frame)]).toEqual([model, true, true]);
		expect([model, Math.min(...latticeVolumes(frame)) > 0]).toEqual([model, true]);
		const roof = Math.max(...columns.map((column) => columnRoof(column, 0)));
		expect(Math.max(...frame.nodes.map(({ position }) => position[2]))).toBe(roof);
	}
});

test('a diagrid frustum shares its triangle with the next column’s foundation', () => {
	const datum = 344 / 31;
	const columns = squares([[2, 2]]).map((column) => ({
		...column,
		corners: column.corners.map(({ id, position: [x, y] }) => ({
			id,
			position: [x, y, datum + (x === 0 ? 0 : x === 60 ? 8 : 15)] as const
		}))
	}));
	const lattice = createCityLattice(columns, datum, 'diagrid');
	const { solids } = lattice;
	expect(closedSolids(lattice)).toBe(true);
	const shared = [
		'vertex/1,0/level/2',
		'vertex/1,1/level/2',
		`edge/${planEdgeId('1,0', '1,1')}/level/3`
	].sort();
	for (const id of ['c0,0/level/2', 'c1,0/level/2']) {
		const solid = required(
			solids.find(({ bay }) => bay === id),
			'bay solid'
		);
		expect(solid.faces.map((face) => [...face].sort())).toContainEqual(shared);
	}
});

test('separates the saddle along the collapsed high diagonal and checks both edge incidences', () => {
	const [column] = squares([[1]]);
	const saddle = {
		...column,
		corners: column.corners.map(({ id, position: [x, y] }, i) => ({
			id,
			position: [x, y, [14, 0, 14, 0][i]] as const
		}))
	};
	for (const model of latticeVariants) {
		const lattice = createCityLattice([saddle], 0, model);
		const first = lattice.solids
			.map(({ bay }, i) => (bay === 'c0,0/level/0' ? i : -1))
			.filter((i) => i >= 0);
		const volumes = latticeVolumes(lattice);
		expect(first.map((i) => volumes[i])).toEqual([4200, 4200]);
		expect([model, closedSolids(lattice)]).toEqual([model, true]);
		expect(components(lattice)).toBe(1);
		if (model === 'box')
			expect(solidEdgeFaults(first.flatMap((i) => lattice.solids[i].faces))).toEqual({
				open: 0,
				nonManifold: 1
			});
		if (model === 'centered') {
			const hubs = lattice.nodes.filter(({ id }) => id.endsWith('/center'));
			expect(hubs.map(({ position }) => position)).toEqual([[30, 30, 17.5]]);
		}
	}
});

test('bounds occupied spans before walking levels but accepts a narrow high-altitude site', () => {
	const [column] = squares([[1]]);
	const heights = (z: number, low = z) => ({
		...column,
		corners: column.corners.map(({ id, position: [x, y] }, i) => ({
			id,
			position: [x, y, i ? z : low] as const
		}))
	});
	expect(() => createCityLattice([heights(1e300)], 0, 'antiprism')).toThrow(RangeError);
	expect(() =>
		createCityLattice([heights(levelHeight * cityVolumeConfig.maximumOccupiedBands, 0)], 0)
	).toThrow(RangeError);
	const high = createCityLattice([heights(7e8)], 0, 'antiprism');
	expect(high.cells.map(({ level }) => level)).toEqual([1e8]);
	expect(closedSolids(high)).toBe(true);
});

test('keeps an exactly reconstructed fractional-datum contact on its plane', () => {
	const datum = 344 / 31;
	const [column] = squares([[1]]);
	const ground = datum + 3 * levelHeight;
	const corners = column.corners.map(({ id, position: [x, y] }) => ({
		id,
		position: [x, y, ground] as const
	}));
	const lattice = createCityLattice([{ ...column, corners }], datum, 'diagrid');
	expect(lattice.cells.map(({ level }) => level)).toEqual([3]);
	expect(closedSolids(lattice)).toBe(true);
});

test.each(spatial)('%s retains every member with delimiter-bearing corner IDs', (variant) => {
	const ids = ['a', 'b/level/0\nvertex/z', 'a/level/0\nvertex/b', 'z'];
	const [column] = squares([[6]]);
	const corners = column.corners.map((corner, i) => ({ ...corner, id: ids[i] }));
	const { edges, solids } = createCityLattice([{ ...column, corners }], 0, variant);
	const expected = new Set(
		solids.flatMap(({ faces }) =>
			faces.flatMap((face) =>
				face.map((from, i) => JSON.stringify([from, face[(i + 1) % face.length]].sort()))
			)
		)
	);
	expect(edges).toHaveLength(expected.size);
	expect(new Set(edges.map(({ from, to }) => JSON.stringify([from, to].sort())))).toEqual(expected);
	expect(new Set(edges.map(({ id }) => id))).toEqual(expected);
});

test('cell-array order cannot change the settlement class at the town threshold', () => {
	const rings = Array.from({ length: 250 }, (_, i) => {
		const y = i * 90;
		const width = 50 + (i < 180 ? -1e-14 : 1e-14);
		return (
			[
				[0, y, 0],
				[width, y, 0],
				[width, y + 80, 0],
				[0, y + 80, 0]
			] as const
		).map((position, j) => ({ id: i + '/' + j, position }));
	});
	const plan: TerrainGrid = {
		cells: rings.map((ring, i) => ({
			id: String(i),
			vertexIds: ring.map(({ id }) => id),
			neighbors: [null, null, null, null]
		})),
		vertices: rings.flat(),
		identity: { variant: 'square' as const, scope: 'test-plan' },
		boundary: []
	};
	const growth = { rankedCellIds: plan.cells.map(({ id }) => id), futureFringe: [] };
	const first = createCityDistricts(plan, core, 1201, undefined, growth);
	const reverse = createCityDistricts(
		{ ...plan, cells: [...plan.cells].reverse() },
		core,
		1201,
		undefined,
		growth
	);
	expect(first.settlement).toBe('village');
	expect(reverse.areaKm2).toBe(first.areaKm2);
	expect(reverse.settlement).toBe(first.settlement);
	expect(reverse.shares).toEqual(first.shares);
});

test('matches the fine cell storey height and logical child bays', () => {
	expect(levelHeight / storeysPerLevel).toBe(defaultStoreyHeightM);
	const bay: LatticeBay = {
		id: 'p/level/2',
		planCellId: 'p',
		level: 2,
		planCorners: ['a', 'b', 'c', 'd'],
		floorFace: '',
		ceilingFace: '',
		sideFaces: []
	};
	const points: Vec2[] = [
		[0, 0],
		[10, 0],
		[10, 10],
		[0, 10]
	];
	const space = createCellSpace(
		{
			id: 'p',
			corners: bay.planCorners.map((id, i) => ({ id, position: points[i] })),
			frontage: [],
			baseZ: 0,
			storeyCount: 4
		},
		0
	);
	const corners = new Set(space.cells.map(({ corner }) => corner));
	for (const { id } of subdivideBay(bay)) {
		expect(corners.has((JSON.parse(id.split('/child/')[1]) as [string, number])[0])).toBe(true);
	}
	expect(corners.size).toBe(4);
});
