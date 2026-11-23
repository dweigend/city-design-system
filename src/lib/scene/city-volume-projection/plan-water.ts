import { distance, type Vec2, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { Shape } from '../../core/object';
import { planEdges, type TerrainGrid } from '../../domain/terrain-grid';
import type { CityCrossing, CitySite } from '../../world/city-site';
import { terrainDrape } from '../terrain-grid-projection';
import type { Drawable } from '../surface';

const emptyMesh = { kind: 'mesh', positions: [], indices: [] } as const;

export function projectWetPlan(
	city: CitySite,
	ground: Extract<Shape, { kind: 'mesh' }>,
	toLocal: (x: number, y: number) => Vec2,
	grid: TerrainGrid,
	crossings: readonly CityCrossing[]
): readonly Drawable[] {
	const drape = terrainDrape(ground);
	const vertices = new Map(grid.vertices.map(({ id, position: [x, y] }) => [id, [x, y] as Vec2]));
	const dry: number[] = [];
	const wet: number[] = [];
	const markers: number[] = [];
	const covers = new Map(grid.cells.map(({ id, groundKind }) => [id, groundKind]));
	const point = (id: string) => required(vertices.get(id), 'plan corner');
	for (const {
		nodeIds: [a, b],
		cellIds
	} of planEdges(grid)) {
		const water = cellIds.some((id) => covers.get(id) !== 'dry');
		project(point(a), point(b), water ? wet : dry);
	}
	for (const { path } of crossings)
		for (const { from, to } of path.edges) project(point(from), point(to), markers, 1.2);

	function project(a: Vec2, b: Vec2, output: number[], lift = 0.32) {
		const start = toLocal(...a);
		const end = toLocal(...b);
		const length = distance(start, end);
		const points = drape(start, end).map(([x, y, z]): Vec3 => {
			const t = distance(start, [x, y]) / length;
			const world: Vec2 = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
			const reading = city.valley.sampleTerrain(...world);
			return [x, y, (reading.waterKind === null ? z : Math.max(z, reading.water)) + lift];
		});
		for (let i = 1; i < points.length; i++) output.push(...points[i - 1], ...points[i]);
	}

	const groups = [
		{ id: 'dry-plan', color: '--ink-2', width: 0.8, opacity: 0.82, strokeSegments: dry },
		{ id: 'water-plan', color: '--blueprint', width: 0.8, opacity: 0.6, strokeSegments: wet },
		{
			id: 'selected-crossings',
			color: '--signal',
			width: 1.9,
			opacity: 1,
			strokeSegments: markers
		}
	] as const;
	return groups
		.filter(({ strokeSegments }) => strokeSegments.length)
		.map(({ id, color, width, opacity, strokeSegments }) => ({
			id,
			shape: emptyMesh,
			color,
			finish: 'matte',
			fillVisible: false,
			preserveColor: true,
			stroke: { color, width, opacity },
			strokeSegments
		}));
}
