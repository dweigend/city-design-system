import { describe, expect, test } from 'bun:test';
import type { Vec2 } from '../../core/geometry';
import type { Shape } from '../../core/object';
import { cellAreaM2, createCellSpace, type CellSpace, type Parcel } from '../cell-space';
import { cellRoles, createHouseCourt, createHouseObject, houseDetails, houseFigures, type HouseCourt } from './index';

const parcel = (id: string, points: readonly Vec2[], frontage = [0]): Parcel => ({
	id,
	corners: points.map((position, i) => ({ id: `c${i}`, position })),
	frontage,
	baseZ: 2,
	storeyCount: 10
});
const hexagon = Array.from({ length: 6 }, (_, i): Vec2 => [15 * Math.cos((i * Math.PI) / 3), 15 * Math.sin((i * Math.PI) / 3)]);
const spaces = Object.entries({
	rectangle: parcel('rectangle', [[0, 0], [20, 0], [20, 30], [0, 30]]),
	trapezoid: parcel('trapezoid', [[0, 0], [28, 0], [22, 24], [3, 26]]),
	hexagon: parcel('hexagon', hexagon, [0, 1]),
	triangle: parcel('triangle', [[0, 0], [34, 0], [14, 30]]),
	ell: parcel('ell', [[0, 0], [32, 0], [32, 14], [14, 14], [14, 30], [0, 30]])
}).map(([name, fixture]) => [name, createCellSpace(fixture)] as const);
const grid = [0, 0.5, 1].flatMap((complexity) => [1, 14, 32].flatMap((height) => [1, 12, 32].map((width) => ({ height, width, complexity, seed: 5 }))));

/** Signed volume and directed-edge balance of a triangle mesh; a closed, consistently wound
 * surface has every directed edge matched by its reverse. */
function closure(shape: Shape) {
	if (shape.kind !== 'mesh') throw new Error('Expected a mesh');
	const { positions: p, indices } = shape;
	const key = (i: number) => [0, 1, 2].map((k) => Math.round(p[i * 3 + k] * 1e6)).join(',');
	const edges = new Map<string, number>();
	let volume = 0;
	for (let t = 0; t < indices.length; t += 3) {
		const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
		const [ax, ay, az, bx, by, bz, cx, cy, cz] = [a, b, c].flatMap((i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
		volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
		for (const [u, v] of [[a, b], [b, c], [c, a]]) {
			const forward = `${key(u)}>${key(v)}`;
			const backward = `${key(v)}>${key(u)}`;
			if (edges.get(backward)) edges.set(backward, (edges.get(backward) ?? 0) - 1);
			else edges.set(forward, (edges.get(forward) ?? 0) + 1);
		}
	}
	return { volume, open: [...edges.values()].filter(Boolean).length };
}

function groundReach(space: CellSpace, house: HouseCourt) {
	const cells = new Map(house.cells.map((cell) => [cell.id, cell]));
	const open = (id: string) => (cells.get(id)?.fromStorey ?? 0) > 0 || (cells.get(id)?.toStorey ?? 0) === 0;
	const start = space.cells.filter((cell) => cell.sides.some(({ frontage }) => frontage) && open(cell.id)).map(({ id }) => id);
	const seen = new Set(start);
	for (const id of seen)
		for (const { neighbour } of space.cells.find((cell) => cell.id === id)?.sides ?? [])
			if (neighbour && open(neighbour)) seen.add(neighbour);
	return seen;
}

describe('createHouseCourt', () => {
	test.each(spaces)('%s: closed, non-overlapping volume and a reachable court at every input bound', (_, space) => {
		for (const inputs of grid) {
			const house = createHouseCourt(space, inputs);
			const object = createHouseObject(space, house, 'block');
			const mass = object.parts.find(({ slot }) => slot === 'mass');
			const expected = house.cells.reduce((sum, { id, fromStorey, toStorey }) => {
				const cell = space.cells.find((c) => c.id === id);
				return sum + (cell ? cellAreaM2(cell) : 0) * (toStorey - fromStorey) * space.storeyHeightM;
			}, 0);
			const { volume, open } = closure(mass?.shape ?? { kind: 'mesh', positions: [], indices: [] });
			expect(open).toBe(0);
			expect(volume).toBeCloseTo(expected, 4);
			const court = house.cells.filter(({ role }) => role === 'court');
			expect(court.length).toBeGreaterThan(0);
			const reach = groundReach(space, house);
			for (const { id } of court) expect(reach.has(id)).toBe(true);
			for (const cell of house.cells) expect(cellRoles[cell.role].built).toBe(cell.toStorey > cell.fromStorey);
		}
	});

	test('is deterministic and the seed only moves storeys', () => {
		const [, space] = spaces[2];
		const inputs = { height: 21, width: 32, complexity: 1, seed: 9 };
		expect(createHouseCourt(space, inputs)).toEqual(createHouseCourt(space, inputs));
		const other = createHouseCourt(space, { ...inputs, seed: 10 });
		expect(other.cells.map(({ role }) => role)).toEqual(createHouseCourt(space, inputs).cells.map(({ role }) => role));
	});

	test('built cells grow with width and every cell grows with height', () => {
		for (const [, space] of spaces) {
			const built = (width: number) => new Set(createHouseCourt(space, { width, seed: 1 }).cells.filter(({ toStorey }) => toStorey > 0).map(({ id }) => id));
			for (const width of [1, 6, 12, 20, 32]) for (const id of built(width)) expect(built(width + 4).has(id) || width + 4 > 32).toBe(true);
			const storeys = (height: number) => createHouseCourt(space, { height, complexity: 1, width: 32, seed: 1 }).cells.map(({ toStorey }) => toStorey);
			for (const height of [3.5, 10.5, 17.5, 28]) storeys(height).forEach((value, i) => expect(storeys(height + 3.5)[i]).toBeGreaterThanOrEqual(value));
		}
	});

	test('height sets the storeys, width one keeps only the frontage', () => {
		const [, space] = spaces[0];
		expect(createHouseCourt(space, { height: 1, seed: 0 }).storeys).toBe(1);
		expect(createHouseCourt(space, { height: 32, seed: 0 }).storeys).toBe(9);
		const narrow = createHouseCourt(space, { width: 1, seed: 0 });
		for (const cell of space.cells) {
			const role = narrow.cells.find(({ id }) => id === cell.id)?.role;
			if (!cell.sides.some(({ frontage }) => frontage)) expect(['court', 'garden']).toContain(role);
		}
		expect(houseFigures(space, narrow).courtAreaM2).toBeGreaterThan(0);
	});

	test('geometry names role slots only and carries no colour', () => {
		const [, space] = spaces[4];
		const house = createHouseCourt(space, { height: 17.5, width: 32, complexity: 1, seed: 3 });
		for (const detail of ['full', 'block'] as const) {
			const object = createHouseObject(space, house, detail);
			expect(object.slots).toEqual(houseDetails[detail]);
			expect(JSON.stringify(object)).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(|"--/i);
			expect(object.anchors.map(({ name }) => name)).toEqual(['entrance', 'court']);
		}
		expect(createHouseObject(space, house, 'full').parts.some(({ slot }) => slot === 'stair')).toBe(true);
	});

	test('a space without frontage or a foreign house throws', () => {
		const [, space] = spaces[0];
		const blind = { ...space, cells: space.cells.map((cell) => ({ ...cell, sides: cell.sides.map((side) => ({ ...side, frontage: false })) })) };
		expect(() => createHouseCourt(blind, { seed: 1 })).toThrow(RangeError);
		expect(() => createHouseObject(spaces[1][1], createHouseCourt(space, { seed: 1 }), 'block')).toThrow(RangeError);
	});
});
