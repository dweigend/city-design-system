import type { CrossSection, ManifoldToplevel, Vec2 } from 'manifold-3d';
import { resolveParams } from '../params';
import { envelopeParams, type Settings } from './contract';
import { normalizeRing } from './normalize-ring';
import { roundFootprint } from './footprint';
import { withSolids, type Solids } from './solids';
/** Applies the signed offset before tangent corner fillets. */
function sectionAt(s: Solids, base: CrossSection, p: Settings) {
	const outline = p.offset ? s.keep(base.offset(p.offset, 'Miter', 2)) : base;
	if (!p.radius || outline.isEmpty()) return outline;
	const rounded = outline.toPolygons().map((r) => roundFootprint(r, p.radius));
	return s.keep(new s.kernel.CrossSection(rounded, 'EvenOdd'));
}

/** Applies the same storey footprint, constrained to a supporting slab when drawing a roof. */
export function seatedSection(s: Solids, base: CrossSection, p: Settings, seat?: CrossSection) {
	const footprint = sectionAt(s, base, p);
	// Coincident inset and slab edges can leave micrometre slivers after the planar boolean.
	return seat ? s.keep(s.keep(footprint.intersect(seat)).simplify(1e-5)) : footprint;
}

/** Returns every surviving storey contour, outer rings CCW and holes CW. Distances are in metres. */
export function offsetFootprint(
	kernel: ManifoldToplevel,
	ring: readonly Vec2[],
	offset: number,
	radius = 0
) {
	const clean = normalizeRing(ring);
	const params = resolveParams(envelopeParams, { offset, radius });
	if (!clean.length) return [];
	return withSolids(kernel, (s) => {
		const base = s.keep(new kernel.CrossSection(clean, 'EvenOdd'));
		return sectionAt(s, base, params).toPolygons();
	});
}
