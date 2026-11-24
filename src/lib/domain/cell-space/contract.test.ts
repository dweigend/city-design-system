import { describe, expect, test } from 'bun:test';
import type { Vec2 } from '../../core/geometry';
import { subdivideBay, type LatticeBay } from '../city-volume';
import { cellAreaM2, createCellSpace, storeyAddress, storeyHeightM, type Parcel } from './index';

const parcel = (id: string, points: readonly Vec2[], frontage = [0]): Parcel => ({
	id,
	corners: points.map((position, i) => ({ id: `c${i}`, position })),
	frontage,
	baseZ: 0,
	storeyCount: 4
});

const hexagon = Array.from({ length: 6 }, (_, i): Vec2 => [15 * Math.cos((i * Math.PI) / 3), 15 * Math.sin((i * Math.PI) / 3)]);
const fixtures = {
	rectangle: parcel('rectangle', [[0, 0], [20, 0], [20, 30], [0, 30]]),
	trapezoid: parcel('trapezoid', [[0, 0], [28, 0], [22, 24], [3, 26]]),
	hexagon: parcel('hexagon', hexagon, [0, 1]),
	triangle: parcel('triangle', [[0, 0], [34, 0], [14, 30]]),
	ell: parcel('ell', [[0, 0], [32, 0], [32, 14], [14, 14], [14, 30], [0, 30]])
};

function outlineArea(points: readonly Vec2[]) {
	let sum = 0;
	points.forEach(([ax, ay], i) => {
		const [bx, by] = points[(i + 1) % points.length];
		sum += ax * by - bx * ay;
	});
	return sum / 2;
}

describe('createCellSpace', () => {
	test.each(Object.entries(fixtures))('%s: cells tile the parcel and agree on every side', (_, fixture) => {
		const space = createCellSpace(fixture);
		const byId = new Map(space.cells.map((cell) => [cell.id, cell]));
		expect(byId.size).toBe(space.cells.length);
		const area = space.cells.reduce((sum, cell) => sum + cellAreaM2(cell), 0);
		expect(area).toBeCloseTo(outlineArea(fixture.corners.map(({ position }) => position)), 6);
		for (const cell of space.cells) {
			expect(cell.quad).toHaveLength(4);
			expect(cellAreaM2(cell)).toBeGreaterThan(0);
			for (const { neighbour, edge, frontage } of cell.sides) {
				if (neighbour) expect(byId.get(neighbour)?.sides.some((side) => side.neighbour === cell.id)).toBe(true);
				else expect(frontage).toBe(fixture.frontage.includes(edge ?? -1));
			}
		}
	});

	test('a convex n-gon gives 4n cells per refinement round, a re-entrant L three quads per ear', () => {
		expect(createCellSpace(fixtures.hexagon, 0).cells).toHaveLength(6);
		expect(createCellSpace(fixtures.hexagon).cells).toHaveLength(24);
		expect(createCellSpace(fixtures.ell, 0).cells).toHaveLength(12);
	});

	test('is deterministic and addresses storeys by a fixed grammar', () => {
		expect(createCellSpace(fixtures.ell)).toEqual(createCellSpace(fixtures.ell));
		expect(storeyHeightM).toBe(3.5);
		expect(storeyAddress('p/child/["a"]', 3)).toBe('p/child/["a"]/storey/3');
		expect(() => storeyAddress('p', -1)).toThrow(RangeError);
	});

	test('rejects clockwise, degenerate or mislabelled parcels', () => {
		expect(() => createCellSpace(parcel('cw', [[0, 0], [0, 10], [10, 10], [10, 0]]))).toThrow(RangeError);
		expect(() => createCellSpace(parcel('two', [[0, 0], [1, 0]]))).toThrow(RangeError);
		expect(() => createCellSpace(parcel('far', [[0, 0], [1, 0], [0, 1]], [3]))).toThrow(RangeError);
	});

	test('corner quads of a bay are the logical child bays of subdivideBay', () => {
		const bay: LatticeBay = {
			id: 'p/level/2',
			planCellId: 'p',
			level: 2,
			planCorners: ['a', 'b', 'c', 'd'],
			floorFace: 'cap/p/level/2',
			ceilingFace: 'cap/p/level/3',
			sideFaces: []
		};
		const points: Vec2[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
		const space = createCellSpace({ ...parcel('p', points), corners: bay.planCorners.map((id, i) => ({ id, position: points[i] })) }, 0);
		const fromBay = subdivideBay(bay).map(({ id }) => {
			const [corner, half] = JSON.parse(id.slice(id.indexOf('/child/') + '/child/'.length)) as [string, number];
			return storeyAddress(`p/child/${JSON.stringify([corner])}`, bay.level * 2 + half);
		});
		const fromSpace = space.cells.flatMap(({ id }) => [4, 5].map((storey) => storeyAddress(id, storey)));
		expect(new Set(fromBay)).toEqual(new Set(fromSpace));
	});
});
