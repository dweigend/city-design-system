import type { Vec2 } from '../../core/geometry';
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

function extent(points: Ring) {
	return points.reduce(
		({ left, right, bottom, top }, [x, y]) => ({
			left: Math.min(x, left),
			right: Math.max(x, right),
			bottom: Math.min(y, bottom),
			top: Math.max(y, top)
		}),
		{ left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity }
	);
}

function crosses([a, b]: readonly [Vec2, Vec2], [c, d]: readonly [Vec2, Vec2]) {
	function side([x, y]: Vec2, [u, v]: Vec2, [p, q]: Vec2) {
		return (u - x) * (q - y) - (v - y) * (p - x);
	}
	return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

export function parcelClearance(parcels: readonly Parcel[]) {
	const obstacles = parcels.map(({ outline }) => ({
		outline,
		box: extent(outline),
		sides: edges(outline)
	}));
	function nearby(points: Ring) {
		const { left, right, bottom, top } = extent(points);
		return obstacles.filter(
			({ box }) => right >= box.left && left <= box.right && top >= box.bottom && bottom <= box.top
		);
	}
	return {
		point(point: Vec2) {
			return !nearby([point]).some(({ sides }) => contains(sides, point));
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
			return !nearby([a, b]).some(
				({ sides }) => contains(sides, middle) || sides.some((side) => crosses([start, b], side))
			);
		},
		footprint(ring: Ring) {
			const boundary = edges(ring);
			return !nearby(ring).some(
				({ outline, sides }) =>
					ring.some((point) => contains(sides, point)) ||
					outline.some((point) => contains(boundary, point)) ||
					boundary.some((edge) => sides.some((side) => crosses(edge, side)))
			);
		}
	};
}
