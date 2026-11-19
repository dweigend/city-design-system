import { flowToken } from '../../data/focus';
import type { ColorToken, Primitive } from '../parametrik/types';
import { inradius } from '../quad-grid';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';
import type { SpongeWork } from './state';

function site(cell: TerrainCell, id: string) {
	const [x, y] = cell.center;
	const ground = Math.min(...cell.corners.map((point) => point[2]));
	const top = Math.max(...cell.corners.map((point) => point[2]));
	const polygon = (scale: number) =>
		cell.corners.map(([a, b]): [number, number] => [x + (a - x) * scale, y + (b - y) * scale]);
	const prism = (name: string, token: ColorToken, scale: number, z: number, height: number) =>
		({
			id: id + '/' + name,
			kind: 'prism',
			polygon: polygon(scale),
			z,
			height,
			token,
			role: 'neu',
			material: 'concrete'
		}) satisfies Primitive;
	return { x, y, ground, top, polygon, prism };
}

function reservoir(cell: TerrainCell, id: string): Primitive[] {
	const { x, y, ground, top } = site(cell, id);
	const radius = inradius(cell) * 0.68;
	const vessel = {
		kind: 'cylinder',
		role: 'neu',
		material: 'metal',
		radius,
		edges: true
	} as const;
	return [
		{
			...vessel,
			id: id + '/wall',
			position: [x, y, ground],
			height: top - ground + 2.4,
			token: flowToken.water
		},
		{
			...vessel,
			id: id + '/lid',
			position: [x, y, top + 2.4],
			height: 0.24,
			token: '--cat-health-3'
		}
	];
}

function pool(
	cell: TerrainCell,
	id: string,
	kind: 'retention-basin' | 'water-square'
): Primitive[] {
	const { ground, top, polygon, prism } = site(cell, id);
	const water = top + 0.12;
	const inner = kind === 'water-square' ? 0.52 : 0.67;
	const rim = kind === 'water-square' ? flowToken.people : flowToken.food;
	return [
		prism('water', flowToken.water, inner, water, 0.12),
		{
			...prism('rim', rim, 0.94, ground, water - ground + 0.36),
			holes: [polygon(inner).reverse()]
		}
	];
}

function greenRoof(cell: TerrainCell, id: string): Primitive[] {
	const { ground, top, polygon, prism } = site(cell, id);
	const roof = top + 2.6;
	const posts = polygon(0.57).map(([x, y], i): Primitive => ({
		id: id + '/post/' + i,
		kind: 'cylinder',
		position: [x, y, ground],
		height: roof - ground,
		radius: 0.16,
		role: 'neu',
		token: '--cat-health-5',
		material: 'metal'
	}));
	return [
		...posts,
		prism('canopy', '--cat-health-3', 0.86, roof, 0.25),
		prism('planting', flowToken.food, 0.78, roof + 0.25, 0.35)
	];
}

/** Projects one retained water work into detached primitives in world meters. */
export function spongeWorkView(grid: TerrainGrid, work: SpongeWork): Primitive[] {
	const cell = grid.cellsById.get(work.cellId);
	if (!cell) return [];
	const id = 'sponge/' + work.cellId;
	switch (work.kind) {
		case 'tank':
			return reservoir(cell, id);
		case 'retention-basin':
		case 'water-square':
			return pool(cell, id, work.kind);
		case 'green-roof':
			return greenRoof(cell, id);
	}
}
