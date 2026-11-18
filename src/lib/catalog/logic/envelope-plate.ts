import type { ManifoldToplevel, Vec2 } from 'manifold-3d';
import { envelopeParams, buildEnvelope, type BuildingCell, type Roof } from './building-envelope';
// Frozen first cells from the seed-42 corner-grid dual and organic grids.
const corner: Vec2[] = [
	[6.341082908325957, 4.567642150745891],
	[9.551619761207219, 4.56764215074589],
	[7.322109333829653, 7.5869310300524955]
];
const organic: Vec2[] = [
	[-30.85468785768676, 15.00557303157711],
	[-34.04138218006272, 9.443519487228158],
	[-36.15653008101286, 0.6584291941088005],
	[-35.19263719373325, -7.083763522332565],
	[-15.737385989879407, 1.7768061053196025],
	[-14.122108227902466, 3.2475787775326985],
	[-14.874999703440938, 6.369036084722013]
];
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
	const rings = [square, corner, organic].map(fitCell);
	return roofs.flatMap((roof) =>
		rings.map((polygon) => buildEnvelope(kernel, [specimen(roof, polygon)]))
	);
}
