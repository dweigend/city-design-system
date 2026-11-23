import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { columnRoof, levelHeight } from '../../domain/city-volume';
import { createCitySite, readCityGrid } from '../../world/city-site';
import { drawnInPencil } from './blocks';
import { example } from './example';

const isDrawn = drawnInPencil(1201);
import { cityProfile, projectCityDistricts, projectCityLattice, projectCityTerrain } from './index';

test('projects shaded district bodies with flat caps, exposed walls split at every level', () => {
	const { envelope, columns, datumZ } = example();
	const { drawables, focus } = envelope;
	const bodies = drawables.filter(({ role }) => role === 'body');
	expect(new Set(bodies.map(({ kind, color }) => `${kind} ${color}`))).toEqual(
		new Set(['detached --blueprint-2', 'block --blueprint-3', 'center --blueprint'])
	);
	expect(focus?.max[2]).toBe(Math.max(...columns.map((column) => columnRoof(column, datumZ))));
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	const storeysBelow = (column: (typeof columns)[number], floor: number) =>
		Math.ceil((columnRoof(column, datumZ) - floor) / levelHeight - 1e-9);
	for (const { kind, levels, drawn, shape, opacity, strokeSegments, warp } of bodies) {
		expect(opacity).toBeUndefined();
		expect(strokeSegments?.length).toBeGreaterThan(0);
		if (shape.kind !== 'mesh') throw new Error('Expected an indexed envelope mesh');
		expect(warp?.fill.length).toBe((2 * shape.positions.length) / 3);
		const expectedTriangles = columns
			.filter(
				(column) =>
					column.kind === kind && column.levels === levels && isDrawn(column.planCellId) === drawn
			)
			.reduce((count, column) => {
				let walls = 0;
				for (const [i, id] of column.neighbors.entries()) {
					const top = columnRoof(column, datumZ);
					const lower =
						id === null ? undefined : columnRoof(required(byId.get(id), 'neighbor'), datumZ);
					if (lower !== undefined && lower >= top) continue;
					const floor =
						lower ??
						Math.max(
							column.corners[i].position[2],
							column.corners[(i + 1) % column.corners.length].position[2]
						);
					walls += storeysBelow(column, floor);
				}
				return count + column.corners.length - 2 + 2 * walls;
			}, 0);
		expect(shape.indices).toHaveLength(3 * expectedTriangles);
	}
	// About one stock column in six is drawn in pencil, by a keyed draw.
	const drawnShare =
		columns.filter(({ planCellId }) => isDrawn(planCellId)).length / columns.length;
	expect(drawnShare).toBeGreaterThan(0.1);
	expect(drawnShare).toBeLessThan(0.25);
});

test('projects one glyph per joint and one segment per unique member on common planes', () => {
	const { datumZ, heightAt, lattice, members } = example();
	const [drawable] = members.drawables;
	const { shape } = drawable;
	if (shape.kind !== 'mesh') throw new Error('Expected a mesh of lattice joints');
	expect(shape.indices.length).toBe(24 * lattice.nodes.length);
	const strokes = members.drawables.flatMap(({ strokeSegments }) => strokeSegments ?? []);
	expect(strokes.length).toBe(6 * lattice.edges.length);
	for (let i = 0; i < strokes.length; i += 6) {
		for (const offset of [0, 3]) {
			const [x, y, z] = strokes.slice(i + offset, i + offset + 3);
			if (z < datumZ + levelHeight) expect(z).toBeCloseTo(heightAt(x, y), 8);
			else expect((z - datumZ) % levelHeight).toBeCloseTo(0);
		}
	}
});

test('omits the lattice drawable when there are no bays', () => {
	const { frame } = example();
	expect(
		projectCityLattice(
			{ cells: [], faces: [], bayCorners: [], nodes: [], edges: [], solids: [] },
			frame
		).drawables
	).toEqual([]);
});

test('keeps true scale at quarter distance and resolves to the stepped envelope at city distance', () => {
	const elevation = Math.PI / 8;
	const peak = 91;
	const near = cityProfile(500, 0.5, peak, elevation, false);
	const far = cityProfile(5000, 3.88, peak, elevation, false);
	const displayPeak = peak * far.factor;
	expect(near).toMatchObject({ factor: 1, detail: 1, uprights: 1, rims: 1, envelope: 0 });
	expect(far).toMatchObject({ detail: 0, uprights: 0, rims: 0, envelope: 1 });
	expect(displayPeak * Math.cos(elevation)).toBeCloseTo(500);
	expect(cityProfile(5000, 3.88, peak, elevation, false, 2.3).factor).toBe(2.3);
	expect(cityProfile(5000, 3.88, peak, elevation, true)).toEqual({ ...far, factor: 1 });
});

test('omits an empty district envelope and leaves the stage free to fit the terrain', () => {
	const { frame, datumZ } = example();
	const envelope = projectCityDistricts([], datumZ, frame);
	expect(envelope.drawables).toEqual([]);
	expect(envelope.focus).toBeUndefined();
	expect([...envelope.points()]).toEqual([]);
});

test('uses the same sampled mountain ground in the lattice and terrain triangles', () => {
	const city = createCitySite(undefined, { relief: 1 });
	const { grid } = readCityGrid(city, 1200, 'triangle');
	const { drawables, toLocal } = projectCityTerrain(city, grid);
	const shape = required(
		drawables.find(({ finish }) => finish === 'terrain'),
		'ground'
	).shape;
	if (shape.kind !== 'mesh') throw new Error('Expected triangle ground');
	const key = (position: readonly number[]) =>
		position.map((value) => Math.round(value * 1000)).join(',');
	const points = new Set(shape.indices.map((i) => key(shape.positions.slice(3 * i, 3 * i + 3))));
	for (const {
		position: [x, y, z]
	} of grid.vertices)
		expect(points.has(key([...toLocal(x, y), z]))).toBe(true);
}, 15_000);

test('projects both the ground and water elevations from the alternate city sampler', () => {
	const site = createCitySite((x) =>
		x < 0
			? { height: 240, waterKind: 'river', waterClearance: x, waterHeight: 245 }
			: { height: 240, waterKind: null, waterClearance: x }
	);
	const { drawables } = projectCityTerrain(site, { vertices: [], cells: [], boundary: [] });
	expect(site.valley).toBeNull();
	for (const [id, z] of [
		['ground', 240],
		['river', 245]
	] as const) {
		const shape = required(
			drawables.find((part) => part.id === id),
			id
		).shape;
		if (shape.kind !== 'mesh') throw new Error('Expected a sampled mesh');
		expect(shape.indices.length).toBeGreaterThan(0);
		expect(shape.positions.filter((_, i) => i % 3 === 2).every((height) => height === z)).toBe(
			true
		);
	}
});
