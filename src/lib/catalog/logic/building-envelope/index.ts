import type { CrossSection, Manifold, ManifoldToplevel, Vec2 } from 'manifold-3d';
import { settings, type BuildingCell, type EnvelopeMesh } from './contract';
import { cleanRing, epsilon } from './footprint';
import { roofSolid } from './roof';
import { clip, withSolids, type Solids } from './solids';
export { envelopeParams, type BuildingCell, type EnvelopeMesh, type Roof } from './contract';
import { sectionAt } from './section';
export { offsetFootprint } from './section';
export { roundFootprint } from './footprint';

function foundation(s: Solids, section: CrossSection, grade: Vec2) {
	const [dx, dy] = grade;
	const samples = section
		.toPolygons()
		.flat()
		.map(([x, y]) => dx * x + dy * y);
	const high = Math.max(...samples),
		depth = high - Math.min(...samples);
	if (depth <= epsilon) return [];
	const prism = s.keep(section.extrude(depth));
	return [clip(s, s.keep(prism.translate([0, 0, -depth])), [-dx, -dy, 1], -high)];
}
function groundPlane(cell: BuildingCell) {
	const grade: Vec2 = cell.grade ?? [0, 0],
		baseHeight = cell.base ?? 0;
	if (![baseHeight, ...grade].every(Number.isFinite))
		throw new RangeError('Expected finite ground plane');
	return { grade, baseHeight };
}
function storeys(s: Solids, cell: BuildingCell, base: CrossSection) {
	const floors = cell.storeys ?? [{}],
		bodies: Manifold[] = [];
	const { grade, baseHeight } = groundPlane(cell);
	let z = baseHeight;
	for (const [i, floor] of floors.entries()) {
		const p = settings(cell, floor),
			section = sectionAt(s, base, p);
		if (section.isEmpty()) break;
		if (i === 0)
			for (const foot of foundation(s, section, grade))
				bodies.push(s.keep(foot.translate([0, 0, z])));
		const body =
			i === floors.length - 1
				? roofSolid(s, section, cell.roof, p)
				: s.keep(section.extrude(p.height));
		bodies.push(s.keep(body.translate([0, 0, z])));
		z += p.height;
	}
	return bodies;
}
function cellBodies(s: Solids, cell: BuildingCell) {
	const ring = cleanRing(cell.polygon);
	if (ring.length < 3) return [];
	const base = s.keep(new s.kernel.CrossSection(ring, 'EvenOdd'));
	return storeys(s, cell, base);
}
/** Builds one closed exterior for touching cells. Pass an initialized Manifold kernel.
 * Plan x/y, elevation z, metres and radians. Collapsed cells contribute no faces.
 * Storey offsets refer to the original cell. A collapsed storey terminates its stack.
 */
export function buildEnvelope(
	kernel: ManifoldToplevel,
	cells: readonly BuildingCell[]
): EnvelopeMesh {
	return withSolids(kernel, (s) => {
		const parts = cells.flatMap((cell) => cellBodies(s, cell));
		if (!parts.length) return { positions: new Float32Array(), indices: new Uint32Array() };
		const body = s.keep(kernel.Manifold.union(parts));
		if (body.status() !== 'NoError')
			throw new RangeError('Building envelope failed: ' + body.status());
		const mesh = body.getMesh();
		return { positions: mesh.vertProperties.slice(), indices: mesh.triVerts.slice() };
	});
}
