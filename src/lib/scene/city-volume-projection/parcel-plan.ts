import { defaults } from '../../../config/city-volume-projection';
import type { Vec2, Vec3 } from '../../core/geometry';
import type { Shape } from '../../core/object';
import type { ParcelPlan, PlanPolygon } from '../../domain/parcels';
import { planOverlaySurfaces, type Drawable } from '../surface';
import { createTerrainDrape } from '../terrain-grid-projection';
import { planLineLiftM } from '../../../config/city-volume-projection';
import { mesh } from './mesh';
import { appendParcelFill } from './parcel-fill';
import { planOverlayIds } from './plan-water';

const emptyMesh = { kind: 'mesh', positions: [], indices: [] } as const;

function projectParcelDrawables(
	plan: ParcelPlan,
	drape: (a: Vec2, b: Vec2, lift: number) => Vec3[],
	fill: (shape: ReturnType<typeof mesh>, polygon: PlanPolygon, lift: number) => void
) {
	const lanes = mesh();
	const publicGround = mesh();
	const main: number[] = [];
	const parcels: number[] = [];
	const outerLiftM = 2 * planLineLiftM;
	const detailLiftM = defaults.parcelDetailLiftRatio * planLineLiftM;

	function stroke(buffer: number[], a: Vec2, b: Vec2, lift: number) {
		const points = drape(a, b, lift);
		for (let i = 1; i < points.length; i++) buffer.push(...points[i - 1], ...points[i]);
	}

	for (const block of plan.blocks) {
		for (const polygon of block.laneGround) fill(lanes, polygon, planLineLiftM);
		for (const polygon of block.publicGround.passage) fill(lanes, polygon, outerLiftM);
		const open =
			block.memberCellIds.length > 1
				? block.netGround
				: [...block.publicGround.court, ...block.publicGround.open];
		for (const polygon of open) fill(publicGround, polygon, outerLiftM);
	}
	for (const lane of plan.lanes) {
		if (lane.hierarchy.includes('main')) stroke(main, ...lane.points, detailLiftM);
	}
	const drawn = new Set<string>();
	for (const { outline } of plan.parcels) {
		for (const [i, a] of outline.entries()) {
			const b = outline[(i + 1) % outline.length];
			const key = JSON.stringify(a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? [a, b] : [b, a]);
			if (drawn.has(key)) continue;
			drawn.add(key);
			stroke(parcels, a, b, detailLiftM);
		}
	}

	const drawables = [
		{ slot: 'lanes', shape: lanes, strokeSegments: main },
		{ slot: 'parcels', shape: emptyMesh, strokeSegments: parcels, fillVisible: false },
		{ slot: 'merged-units', shape: publicGround }
	] as const;
	return drawables
		.filter(
			({ shape, ...part }) =>
				shape.indices.length > 0 || ('strokeSegments' in part && part.strokeSegments.length > 0)
		)
		.map(({ slot, ...part }): Drawable => ({
			...part,
			id: planOverlayIds[slot],
			...planOverlaySurfaces[slot],
			preserveColor: true
		}));
}

/** Drapes physical lane widths and holding outlines over the rendered XY terrain. */
export function projectParcelPlan(
	ground: Extract<Shape, { kind: 'mesh' }>,
	toLocal: (x: number, y: number) => Vec2,
	plan: ParcelPlan
) {
	const project = createTerrainDrape(ground);
	return projectParcelDrawables(
		plan,
		(a, b, lift) =>
			project.segment(toLocal(...a), toLocal(...b)).map(([x, y, z]) => [x, y, z + lift]),
		(shape, polygon, lift) => appendParcelFill(shape, polygon, lift, toLocal, project)
	);
}
