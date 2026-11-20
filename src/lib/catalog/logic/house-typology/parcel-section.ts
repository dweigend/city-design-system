import { inside, intersects, validateRing } from '../parametrik/raster/universal/kern';
import { sectionInsets } from './section-insets';
import type { HouseEnvelope } from './envelope';

type XY = [number, number];
type Parcel = { polygon: XY[]; holes: XY[][] };
const mix = (a: XY, b: XY, t: number): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
type WallDepth = (x: number, y: number) => number;
function wallDepth(span: number, limits: number[]): WallDepth {
	return (x, y) =>
		span *
		(0.045 + 0.7 * (Math.abs(x) * limits[x > 0 ? 0 : 1] + Math.abs(y) * limits[y > 0 ? 2 : 3]));
}
function wall(a: XY, b: XY, depth: WallDepth) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		l = Math.hypot(dx, dy);
	const x = -dy / l,
		y = dx / l;
	return { x, y, d: depth(x, y) };
}
function spanOf(base: XY[]) {
	const width = (k: number) =>
		Math.max(...base.map((p) => p[k])) - Math.min(...base.map((p) => p[k]));
	return Math.min(width(0), width(1));
}
function rounded(ring: XY[], outline: HouseEnvelope['outline']) {
	if (outline === 'orthogonal') return ring;
	return ring.flatMap((p, i) => {
		const a = ring[(i + ring.length - 1) % ring.length],
			b = ring[(i + 1) % ring.length];
		const t = outline === 'fluted' ? 0.08 : outline === 'faceted' ? 0.14 : 0.25;
		const left = mix(p, a, t),
			right = mix(p, b, t);
		return outline === 'oval'
			? [left, mix(mix(left, p, 0.5), mix(p, right, 0.5), 0.5), right]
			: [left, right];
	});
}
function crosses(a: XY[], b: XY[]) {
	return a.some((p, i) =>
		b.some((q, j) => intersects(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length]))
	);
}
function fits(ring: XY[], parcel: Parcel, holes: XY[][]) {
	try {
		validateRing(ring);
	} catch {
		return false;
	}
	return (
		ring.every((p) => inside(p, parcel.polygon)) &&
		!crosses(ring, parcel.polygon) &&
		holes.every((h) => h.every((p) => inside(p, ring)) && !crosses(h, ring))
	);
}
function wallCorners(polygon: XY[]) {
	return polygon.filter((p, i, r) => {
		const a = r[(i + r.length - 1) % r.length],
			b = r[(i + 1) % r.length];
		return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9;
	});
}
/** Fits the inner weather line behind the outer load-bearing wall without closing a court. */
export function roomLining(parcel: Parcel): XY[] {
	return fittedSection(parcel, parcel.holes, 'orthogonal', wallCorners(parcel.polygon), () => 0.45)
		.polygon;
}

/** Offsets the original surveyed walls; backs off at re-entrant corners, courtyards and the stair. */
export function parcelSection(
	parcel: Parcel,
	opening: XY[],
	envelope: HouseEnvelope,
	elevation: number,
	floor: number
) {
	const base = wallCorners(parcel.polygon);
	if (floor === 0) return { polygon: base, holes: [...parcel.holes, opening] };
	return fittedSection(
		parcel,
		[...parcel.holes, opening],
		envelope.outline,
		base,
		wallDepth(spanOf(base), sectionInsets(envelope.section, elevation, floor))
	);
}
function fittedSection(
	parcel: Parcel,
	holes: XY[][],
	outline: HouseEnvelope['outline'],
	base: XY[],
	depth: WallDepth
) {
	const walls = base.map((p, i) => wall(p, base[(i + 1) % base.length], depth));
	const moves = walls.map((b, i): XY => {
		const a = walls[(i + walls.length - 1) % walls.length],
			det = a.x * b.y - a.y * b.x;
		return Math.abs(det) < 1e-8
			? [b.x * b.d, b.y * b.d]
			: [(a.d * b.y - b.d * a.y) / det, (a.x * b.d - b.x * a.d) / det];
	});
	for (let factor = 1; factor >= 1 / 128; factor /= 2) {
		const raw = base.map(([x, y], i): XY => [x + factor * moves[i][0], y + factor * moves[i][1]]);
		const ring = rounded(raw, outline);
		if (fits(ring, parcel, holes)) return { polygon: ring, holes };
		if (ring !== raw && fits(raw, parcel, holes)) return { polygon: raw, holes };
	}
	return { polygon: base, holes };
}

/** Fits continuous exterior panels to corresponding perimeter corners independently of floor heights. */
export function parcelExterior(
	parcel: Parcel,
	opening: XY[],
	envelope: HouseEnvelope,
	datums: readonly number[],
	survey: ReturnType<typeof import('./party-faces').partyFaces>
) {
	const ring = wallCorners(parcel.polygon),
		span = spanOf(ring);
	const holes = [...parcel.holes, opening];
	const last = datums.length - 2;
	const limits = (floor: number) =>
		sectionInsets(envelope.section, floor / Math.max(1, last), floor);
	const stations = datums.map((z, i) => {
		if (i <= 1) return { z, ring, atBoundary: true };
		// Both courses meet this datum. The outer wall must clear the broader one on each side.
		const below = limits(i - 1),
			above = limits(Math.min(i, last));
		const bounds = below.map((d, k) => Math.min(d, above[k]));
		const profile = fittedSection(
			parcel,
			holes,
			'orthogonal',
			ring,
			wallDepth(span, bounds)
		).polygon;
		return { z, ring: profile, atBoundary: profile === ring };
	});
	const seams = ring.map((a, i) => survey(a, ring[(i + 1) % ring.length]));
	return {
		ring,
		seams,
		reveal: fittedSection(parcel, holes, 'orthogonal', ring, () => 0.35).polygon,
		stations,
		bottom: datums[0],
		top: datums[datums.length - 1],
		system: envelope.system,
		finish: envelope.finish,
		faces: seams.map((spans) =>
			spans.some(
				({ hidden }) => !hidden || hidden[0] > datums[0] || hidden[1] < datums[datums.length - 1]
			)
		)
	};
}
