import { expect, test } from 'bun:test';
import { crossProduct, displacement, dotProduct, type Vec3 } from '../../core/geometry';
import { example } from './example';
import {
	cityLatticesByPlan,
	createCityLattice,
	createLatticeBayObject,
	latticeVolumes
} from './index';

function signedVolume(positions: readonly number[], indices: readonly number[]) {
	const point = (index: number): Vec3 => [
		positions[3 * index],
		positions[3 * index + 1],
		positions[3 * index + 2]
	];
	const origin = point(indices[0]);
	let volume = 0;
	for (let i = 0; i < indices.length; i += 3) {
		const [a, b, c] = indices.slice(i, i + 3).map((index) => displacement(origin, point(index)));
		volume += dotProduct(a, crossProduct(b, c)) / 6;
	}
	return volume;
}

test('builds canonical meshes and unique joint anchors in all seven models', () => {
	const { columns, floor } = example();
	expect(floor).toBeDefined();
	const [column] = columns;
	const warped = {
		...column,
		corners: column.corners.map((corner, i) => ({
			...corner,
			position: [corner.position[0], corner.position[1], corner.position[2] + (i % 2)] as const
		}))
	};
	for (const model of cityLatticesByPlan.hex) {
		const lattice = createCityLattice([warped], 0, 'hex', model);
		const id = lattice.cells[0].id;
		const object = createLatticeBayObject(lattice, id);
		const shape = object.parts.find(({ slot }) => slot === 'solid')?.shape;
		if (shape?.kind !== 'mesh') throw new Error('Missing bay solid mesh');
		const volumes = latticeVolumes(lattice);
		const expected = lattice.solids.reduce(
			(total, solid, i) => total + (solid.bay === id ? volumes[i] : 0),
			0
		);
		expect(signedVolume(shape.positions, shape.indices)).toBeCloseTo(expected, 7);
		expect(object.anchors.length).toBeGreaterThan(2);
		expect(new Set(object.anchors.map(({ name }) => name)).size).toBe(object.anchors.length);
		expect(createLatticeBayObject(lattice, id)).toEqual(object);
	}
});
