import { squareGrid, type QuadCell } from '../quad-grid';
import { area } from '../ansicht/geometrie';
import { createTerrain } from '../terrain';
import { deriveGrid } from '../terrain-grid';
import { planHouse } from '../composed-house';
import type { HouseUse } from '../../data/house-body';
import type { Vec3 } from '../parametrik/types';

export const plotShapes = ['Rectangle', 'L', 'U', 'T', 'Round', 'Irregular'] as const;
export type PlotShape = (typeof plotShapes)[number];
let parcel: QuadCell | undefined;
function terrainParcel() {
	if (!parcel) parcel = deriveGrid(createTerrain({ seed: 7 })).cellsById.get('30/30');
	if (!parcel) throw new Error('Missing terrain parcel');
	return parcel;
}
function discPoint([x, y, z]: Vec3): Vec3 {
	const radius = Math.max(Math.abs(x), Math.abs(y)),
		length = Math.hypot(x, y);
	return length ? [(x * radius) / length, (y * radius) / length, z] : [0, 0, z];
}

function plotCells(shape: PlotShape) {
	if (shape === 'Irregular') return [terrainParcel()];
	if (shape === 'Rectangle') return squareGrid(2, 1, 1).cells;
	const grid = squareGrid(5, 5, 1);
	if (shape === 'Round')
		return grid.cells.map((c) => {
			const [a, b, d, e] = c.corners.map(discPoint);
			return { ...c, center: discPoint(c.center), corners: [a, b, d, e] as const };
		});
	return grid.cells.filter((c) => {
		const [x, y] = c.center;
		if (shape === 'L') return x <= -1 || y <= -1;
		if (shape === 'U') return Math.abs(x) >= 1 || y <= -1;
		return y >= 1 || Math.abs(x) < 1;
	});
}

/** Scales the painted carrier to the requested square metres before invoking the shared grammar. */
export function plotHouse(stories: number, squareMetres: number, shape: PlotShape, seed: number) {
	if (
		!Number.isSafeInteger(stories) ||
		stories < 1 ||
		!Number.isFinite(squareMetres) ||
		squareMetres <= 0
	)
		throw new RangeError('Expected positive storeys and plot area');
	const source = plotCells(shape);
	const scale = Math.sqrt(
		squareMetres / source.reduce((sum, c) => sum + area(c.corners.map(([x, y]) => [x, y])), 0)
	);
	const [cx, cy, cz] = source[0].center;
	const point = ([x, y, z]: Vec3): Vec3 => [(x - cx) * scale, (y - cy) * scale, (z - cz) * scale];
	const cells = source.map((c) => {
		const [a, b, d, e] = c.corners;
		return {
			...c,
			corners: [point(a), point(b), point(d), point(e)] as const,
			center: point(c.center),
			pad: shape === 'Irregular' ? (c.pad - cz) * scale : c.pad
		};
	});
	const programme: HouseUse[] = ['living', 'energy', 'water', 'food', 'material'];
	const uses = Array.from({ length: stories }, (_, i) => programme[i % programme.length]);
	return planHouse({
		cells,
		stacks: new Map(cells.map((c) => [c.id, uses])),
		seed,
		plan: shape === 'Round' ? 'round' : 'rectangular'
	});
}
