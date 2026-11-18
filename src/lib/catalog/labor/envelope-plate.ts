import type { ManifoldToplevel, Vec2 } from 'manifold-3d';
import {
	envelopeParams,
	buildEnvelope,
	type BuildingCell,
	type Roof
} from '../logic/building-envelope';
import { createPatch, projection } from '../logic/parametrik/eckraster/topology';
import { organicGrid } from '../logic/parametrik/raster/universal';
function fitCell(ring: Vec2[]): Vec2[] {
	const x = ring.map((p) => p[0]),
		y = ring.map((p) => p[1]);
	const w = Math.max(...x) - Math.min(...x),
		h = Math.max(...y) - Math.min(...y);
	const scale = 12 / Math.max(w, h);
	return ring.map(([a, b]) => [
		(a - Math.min(...x) - w / 2) * scale,
		(b - Math.min(...y) - h / 2) * scale
	]);
}
const square: Vec2[] = [
	[0, 0],
	[12, 0],
	[12, 12],
	[0, 12]
];
const roofs: Roof[] = ['hip', 'gable', 'sawtooth', 'shed'];
function specimen(roof: Roof, polygon: Vec2[]): BuildingCell {
	const ceramic = roof === 'shed';
	return {
		polygon,
		roof,
		params: { direction: 0.24, pitch: ceramic ? 0.18 : 0.67 },
		grade: [0.08, 0.02],
		storeys: ceramic
			? [
					{ radius: 1.3, height: 2.4 },
					{ radius: 2, offset: 0.65, height: 2 }
				]
			: [{ height: envelopeParams.height.default }]
	};
}
/** Builds the same four roof rules on three reference cells normalized to a 12 m span. */
export function envelopePlate(kernel: ManifoldToplevel) {
	const corner = projection(createPatch(42), 'dual').cells[0].polygon;
	const organic = organicGrid({}, 42).cells[0].polygon;
	const rings = [square, corner, organic].map(fitCell);
	return roofs.flatMap((roof) =>
		rings.map((polygon) => buildEnvelope(kernel, [specimen(roof, polygon)]))
	);
}
