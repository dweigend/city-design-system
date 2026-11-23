import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { levelHeight } from '../../domain/city-volume';
import { example } from './example';
import { cityProfile, projectCityLattice } from './index';

test('projects three shaded district kinds with flat caps and exposed steps only', () => {
	const { envelope, columns, datumZ, districts } = example();
	const { drawables, focus } = envelope;
	expect(drawables.map(({ id, color }) => [id, color])).toEqual([
		['detached', '--blueprint-1'],
		['block', '--blueprint-2'],
		['center', '--blueprint-3']
	]);
	expect(focus.max[2]).toBe(datumZ + districts.peakHeight);
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	for (const { id, shape, opacity, strokeSegments } of drawables) {
		expect(opacity).toBeUndefined();
		expect(strokeSegments?.length).toBeGreaterThan(0);
		if (shape.kind !== 'mesh') throw new Error('Expected an indexed envelope mesh');
		const expectedTriangles = columns
			.filter(({ kind }) => kind === id)
			.reduce(
				(count, column) =>
					count +
					column.corners.length -
					2 +
					2 *
						column.neighbors.filter(
							(id) =>
								id === null || required(byId.get(id), 'envelope neighbor').levels < column.levels
						).length,
				0
			);
		expect(shape.indices).toHaveLength(3 * expectedTriangles);
	}
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
		projectCityLattice({ cells: [], faces: [], nodes: [], edges: [] }, frame).drawables
	).toEqual([]);
});

test('keeps true scale at quarter distance and resolves to the stepped envelope at city distance', () => {
	const elevation = Math.PI / 8;
	const peak = 91;
	const near = cityProfile(500, 0.5, peak, elevation, false);
	const far = cityProfile(5000, 5.5, peak, elevation, false);
	const displayPeak = far.pivotAboveDatum + (peak - far.pivotAboveDatum) * far.factor;
	expect(near).toMatchObject({ factor: 1, detail: 1, uprights: 1, rims: 1, envelope: 0 });
	expect(far).toMatchObject({ detail: 0, uprights: 0, rims: 0, envelope: 1 });
	expect(displayPeak * Math.cos(elevation)).toBeCloseTo(500);
	expect(cityProfile(5000, 5.5, peak, elevation, true)).toEqual({ ...far, factor: 1 });
});
