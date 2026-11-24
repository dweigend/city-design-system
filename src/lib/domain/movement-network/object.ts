import { defaults } from '../../../config/movement-network';
import type { Vec3 } from '../../core/geometry';
import { createMeshObject, drawBearing, mesh, type Mesh } from '../../core/mesh';
import { defineParams } from '../../core/params';
import type { Anchor } from '../../core/object';
import { drawStair } from './stair';
import type { MovementEdge } from './types';

/** Geometry required from a measured graph edge or a resolved plan edge. */
export type AccessEdge = Pick<MovementEdge, 'id' | 'points' | 'supports'>;

const accessWidths = Object.freeze({
	walkway: defaults.walkwayWidthM,
	stair: defaults.stairWidthM
});

function widthSchema(value: number) {
	return defineParams({
		width: {
			label: 'Width',
			unit: 'm',
			default: value,
			min: defaults.accessWidthMinM,
			max: defaults.accessWidthMaxM,
			step: defaults.accessWidthStepM
		}
	});
}

/** Schemas for editable single-edge clear widths in meters. */
export const accessObjectParams = Object.freeze({
	walkway: widthSchema(accessWidths.walkway),
	stair: widthSchema(accessWidths.stair)
});

// Exact arithmetic: an edge has two endpoints and its attachment normal points up.
function build(edge: AccessEdge, slot: string, draw: (mesh: Mesh) => void) {
	const start = edge.points[0];
	const end = edge.points.at(-1);
	if (edge.points.length < 2 || !end) throw new RangeError('Expected two or more edge points');
	const layers = { [slot]: mesh(), bearing: mesh() };
	draw(layers[slot]);
	for (const { base, top } of edge.supports ?? [])
		drawBearing(layers.bearing, base, top, defaults.walkwayPierRadiusM, defaults.deckThicknessM);
	const normal: Vec3 = [0, 0, 1];
	const anchors: Anchor[] = [
		{ name: 'start', position: start, normal },
		{ name: 'end', position: end, normal }
	];
	return createMeshObject(edge.id, layers, anchors);
}

/** Builds one supported deck along its resolved edge, with an anchor at each end. */
export function createWalkwayObject(edge: AccessEdge, widthM: number = accessWidths.walkway) {
	if (!Number.isFinite(widthM) || widthM <= 0) throw new RangeError('Invalid walkway width');
	return build(edge, 'deck', (body) => body.ribbon(edge.points, widthM, defaults.deckThicknessM));
}

/** Builds one supported stair with metric treads along the edge's inclined run. */
export function createStairObject(edge: AccessEdge, widthM: number = accessWidths.stair) {
	if (!Number.isFinite(widthM) || widthM <= 0) throw new RangeError('Invalid stair width');
	const { points } = edge;
	return build(edge, 'stairs', (body) => {
		const hasApproach = points[0][2] === points[1][2];
		drawStair(body, hasApproach ? points.slice(1) : points, widthM);
	});
}
