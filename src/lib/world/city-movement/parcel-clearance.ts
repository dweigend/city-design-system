import type { Vec2 } from '../../core/geometry';
import { createPolygonIndex } from '../../core/polygon-index';
import type { Parcel } from '../../domain/parcels';

type Ring = readonly Vec2[];

function contains(sides: ReturnType<typeof edges>, [x, y]: Vec2) {
	let inside = false;
	for (const [[ax, ay], [bx, by]] of sides)
		if (ay > y !== by > y && x < ax + ((bx - ax) * (y - ay)) / (by - ay)) inside = !inside;
	return inside;
}

function edges(ring: Ring) {
	return ring.map((point, i) => [point, ring[(i + 1) % ring.length]] as const);
}

function crosses([a, b]: readonly [Vec2, Vec2], [c, d]: readonly [Vec2, Vec2]) {
	function side([x, y]: Vec2, [u, v]: Vec2, [p, q]: Vec2) {
		return (u - x) * (q - y) - (v - y) * (p - x);
	}
	return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

export function parcelClearance(parcels: readonly Parcel[]) {
	const { readCandidates } = createPolygonIndex(
		parcels.map(({ id, outline }) => ({ id, outline, sides: edges(outline) }))
	);
	return {
		point(point: Vec2) {
			return !readCandidates([point]).some(({ sides }) => contains(sides, point));
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
			return !readCandidates([a, b]).some(
				({ sides }) => contains(sides, middle) || sides.some((side) => crosses([start, b], side))
			);
		},
		footprint(ring: Ring) {
			const boundary = edges(ring);
			return !readCandidates(ring).some(
				({ outline, sides }) =>
					ring.some((point) => contains(sides, point)) ||
					outline.some((point) => contains(boundary, point)) ||
					boundary.some((edge) => sides.some((side) => crosses(edge, side)))
			);
		}
	};
}
