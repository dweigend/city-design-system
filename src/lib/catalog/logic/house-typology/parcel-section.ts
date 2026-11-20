import { inside, intersects, validateRing } from '../parametrik/raster/universal/kern';
import { sectionInsets } from './section-insets';
import type { HouseEnvelope } from './envelope';

type XY = [number, number];
type Parcel = { polygon: XY[]; holes: XY[][] };
const mix = (a: XY, b: XY, t: number): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function wall(a: XY, b: XY, limits: number[], span: number) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		l = Math.hypot(dx, dy);
	const x = -dy / l,
		y = dx / l;
	return {
		x,
		y,
		d:
			span *
			(0.045 + 0.7 * (Math.abs(x) * limits[x > 0 ? 0 : 1] + Math.abs(y) * limits[y > 0 ? 2 : 3]))
	};
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
/** Offsets the original surveyed walls; backs off at re-entrant corners, courtyards and the stair. */
export function parcelSection(
	parcel: Parcel,
	opening: XY[],
	envelope: HouseEnvelope,
	elevation: number,
	floor: number
) {
	const base = wallCorners(parcel.polygon);
	const ext = (k: number) =>
		Math.max(...base.map((p) => p[k])) - Math.min(...base.map((p) => p[k]));
	const span = Math.min(ext(0), ext(1));
	const limits = sectionInsets(envelope.section, elevation, floor);
	const walls = base.map((p, i) => wall(p, base[(i + 1) % base.length], limits, span));
	const moves = walls.map((b, i): XY => {
		const a = walls[(i + walls.length - 1) % walls.length],
			det = a.x * b.y - a.y * b.x;
		return Math.abs(det) < 1e-8
			? [b.x * b.d, b.y * b.d]
			: [(a.d * b.y - b.d * a.y) / det, (a.x * b.d - b.x * a.d) / det];
	});
	const holes = [...parcel.holes, opening];
	for (let factor = 1; factor >= 1 / 128; factor /= 2) {
		const raw = base.map(([x, y], i): XY => [x + factor * moves[i][0], y + factor * moves[i][1]]);
		const ring = rounded(raw, envelope.outline);
		if (fits(ring, parcel, holes)) return { polygon: ring, holes };
		if (fits(raw, parcel, holes)) return { polygon: raw, holes };
	}
	return { polygon: base, holes };
}

/** Fits continuous exterior panels to corresponding perimeter corners independently of floor heights. */
export function parcelExterior(
	parcel: Parcel,
	opening: XY[],
	envelope: HouseEnvelope,
	datums: readonly number[],
	faces: (a: XY, b: XY) => boolean
) {
	const reference = { ...envelope, outline: 'orthogonal' as const };
	const ring = wallCorners(parcel.polygon);
	const lastFloor = datums.length - 2;
	const stations = datums.map((z, i) => {
		const floor = Math.min(i, lastFloor);
		const section = parcelSection(
			parcel,
			opening,
			reference,
			floor / Math.max(1, lastFloor),
			floor
		);
		return { z, ring: section.polygon };
	});
	return {
		ring,
		stations,
		bottom: datums[0],
		top: datums[datums.length - 1],
		system: envelope.system,
		finish: envelope.finish,
		faces: ring.map((a, i) => faces(a, ring[(i + 1) % ring.length]))
	};
}
