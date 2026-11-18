import type { CrossSection, ManifoldToplevel, Vec2 } from 'manifold-3d';
import { resolveParams } from '../params';
import { envelopeParams, type Settings } from './contract';
import { cleanRing, roundFootprint } from './footprint';
import { withSolids, type Solids } from './solids';
/** Applies the signed offset before tangent corner fillets. */
export function sectionAt(s: Solids, base: CrossSection, p: Settings) {
	const outline = p.offset ? s.keep(base.offset(p.offset, 'Miter', 2)) : base;
	if (!p.radius || outline.isEmpty()) return outline;
	const rounded = outline.toPolygons().map((r) => roundFootprint(r, p.radius));
	return s.keep(new s.kernel.CrossSection(rounded, 'NonZero'));
}

/** Returns every surviving storey contour, outer rings CCW and holes CW. Distances are in metres. */
export function offsetFootprint(
	kernel: ManifoldToplevel,
	ring: readonly Vec2[],
	offset: number,
	radius = 0
) {
	const params = resolveParams(envelopeParams, { offset, radius });
	const clean = cleanRing(ring);
	if (!clean.length) return [];
	return withSolids(kernel, (s) => {
		const base = s.keep(new kernel.CrossSection(clean, 'EvenOdd'));
		return sectionAt(s, base, params).toPolygons();
	});
}
