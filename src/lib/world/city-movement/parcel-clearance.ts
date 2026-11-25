import type { Vec2 } from '../../core/geometry';
import { createPolygonIndex } from '../../core/polygon-index';
import type { Parcel } from '../../domain/parcels';

type Ring = readonly Vec2[];

function contains(ring: Ring, [x, y]: Vec2) {
	let inside = false;
	for (let i = 0; i < ring.length; i++) {
		const [ax, ay] = ring[i];
		const [bx, by] = ring[(i + 1) % ring.length];
		if (ay > y !== by > y && x < ax + ((bx - ax) * (y - ay)) / (by - ay)) inside = !inside;
	}
	return inside;
}

function side([x, y]: Vec2, [u, v]: Vec2, [p, q]: Vec2) {
	return (u - x) * (q - y) - (v - y) * (p - x);
}

function crosses(a: Vec2, b: Vec2, ring: Ring) {
	for (let i = 0; i < ring.length; i++) {
		const c = ring[i];
		const d = ring[(i + 1) % ring.length];
		if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;
	}
	return false;
}

export function parcelClearance(parcels: readonly Parcel[]) {
	const { someCandidate } = createPolygonIndex(parcels);
	return {
		point(point: Vec2) {
			return !someCandidate([point], ({ outline }) => contains(outline, point));
		},
		segment(a: Vec2, b: Vec2, originToleranceM?: number) {
			const [x, y] = a;
			const [u, v] = b;
			const length = Math.hypot(u - x, v - y);
			if (length === 0) return true;
			// Published frontage follows the ideal reserve within the plan's quantization tolerance.
			const t = originToleranceM === undefined ? 0 : Math.min(1, originToleranceM / length);
			const start: Vec2 = [x + (u - x) * t, y + (v - y) * t];
			const middle: Vec2 = [(start[0] + u) / 2, (start[1] + v) / 2];
			return !someCandidate(
				[a, b],
				({ outline }) => contains(outline, middle) || crosses(start, b, outline)
			);
		},
		footprint(ring: Ring) {
			return !someCandidate(
				ring,
				({ outline }) =>
					ring.some((point) => contains(outline, point)) ||
					outline.some((point) => contains(ring, point)) ||
					ring.some((point, i) => crosses(point, ring[(i + 1) % ring.length], outline))
			);
		}
	};
}
