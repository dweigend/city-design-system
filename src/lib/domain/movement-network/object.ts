import { defaults } from '../../../config/movement-network';
import { isFiniteVector, type Vec3 } from '../../core/geometry';
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
	const normal: Vec3 = /* Exact arithmetic: positive Z axis. */ [0, 0, 1];
	const anchors: Anchor[] = [
		{ name: 'start', position: start, normal },
		{ name: 'end', position: end, normal }
	];
	return createMeshObject(edge.id, layers, anchors);
}

// Exact arithmetic: all access points are XYZ triples.
function checkPoints(points: readonly Vec3[]): void {
	for (let i = 0; i < points.length; i++) {
		if (!isFiniteVector(points[i], 3))
			throw new RangeError(`Access point ${i} requires finite XYZ coordinates`);
	}
}

/** Builds one supported deck along its resolved edge, with an anchor at each end. */
export function createWalkwayObject(edge: AccessEdge, widthM: number = accessWidths.walkway) {
	if (!Number.isFinite(widthM) || widthM <= 0) throw new RangeError('Invalid walkway width');
	checkPoints(edge.points);
	return build(edge, 'deck', (body) => body.ribbon(edge.points, widthM, defaults.deckThicknessM));
}

function stairRun({ points }: AccessEdge) {
	checkPoints(points);
	const first = points.findIndex((end, i) => {
		const start = points[i - 1];
		return start && end[2] !== start[2];
	});
	if (first < 0) throw new RangeError('A stair requires an inclined run with horizontal length');
	const run = points.slice(first - 1);
	if (
		run.some(([x, y, z], i) => {
			const previous = run[i - 1];
			return previous && previous[0] === x && previous[1] === y && previous[2] !== z;
		})
	)
		throw new RangeError('A stair requires horizontal length for each inclined segment');
	return run;
}

/** Rejects malformed XYZ points and edges without an inclined run of positive horizontal length. */
export function validateStairEdge(edge: AccessEdge): void {
	stairRun(edge);
}

/** Builds one supported stair with metric treads. Removes the level approach preceding the
 * first inclined segment and retains the landings that follow it. */
export function createStairObject(edge: AccessEdge, widthM: number = accessWidths.stair) {
	if (!Number.isFinite(widthM) || widthM <= 0) throw new RangeError('Invalid stair width');
	const points = stairRun(edge);
	return build(edge, 'stairs', (body) => drawStair(body, points, widthM));
}
