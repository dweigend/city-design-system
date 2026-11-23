import { distance, type Vec2, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { Shape } from '../../core/object';
import { planEdges, type TerrainGrid } from '../../domain/terrain-grid';
import type { CityCrossing, CitySite } from '../../world/city-site';
import { terrainDrape } from '../terrain-grid-projection';
import { planOverlaySurfaces, type Drawable } from '../surface';
import { crossingLiftM, planLineLiftM } from './constants';

const emptyMesh = { kind: 'mesh', positions: [], indices: [] } as const;

/** Drawable id of each plan overlay slot; the slot names the focus subsystem it belongs to. */
export const planOverlayIds = {
	plan: 'dry-plan',
	'water-cells': 'water-plan',
	crossings: 'selected-crossings'
} as const;

/** Projects the continuous plan as three overlays: dry plan edges, edges touching a water cell, and
 * the selected crossing paths or direct spans, each resolved from its surface slot. */
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
	for (const { path, span } of crossings) {
		if (span) {
			const [from, to] = span.nodeIds;
			project(point(from), point(to), markers, crossingLiftM);
			continue;
		}
		for (const { from, to } of path.edges) project(point(from), point(to), markers, crossingLiftM);
	}

	function project(a: Vec2, b: Vec2, output: number[], lift = planLineLiftM) {
		const start = toLocal(...a);
		const end = toLocal(...b);
		const length = distance(start, end);
		const points = drape(start, end).map(([x, y, z]): Vec3 => {
			const t = distance(start, [x, y]) / length;
			const world: Vec2 = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
			const reading = city.sampleGround(...world);
			return [x, y, (reading.waterKind === null ? z : Math.max(z, reading.waterHeight)) + lift];
		});
		for (let i = 1; i < points.length; i++) output.push(...points[i - 1], ...points[i]);
	}

	const groups = [
		{ slot: 'plan', strokeSegments: dry },
		{ slot: 'water-cells', strokeSegments: wet },
		{ slot: 'crossings', strokeSegments: markers }
	] as const;
	return groups
		.filter(({ strokeSegments }) => strokeSegments.length)
		.map(({ slot, strokeSegments }) => ({
			id: planOverlayIds[slot],
			shape: emptyMesh,
			...planOverlaySurfaces[slot],
			fillVisible: false,
			preserveColor: true,
			strokeSegments
		}));
}
