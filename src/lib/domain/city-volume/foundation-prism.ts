import type { Vec3 } from '../../core/geometry';
import { cityVolumeConfig } from '../../../config/city-volume';

type Point = Readonly<{ id: string; position: Vec3 }>;

/** Geometric fan anchor. All copies of a warped cap then use the same diagonals. */
export function fanAnchor<T>(loop: readonly T[], position: (point: T) => Vec3) {
	return loop.reduce((least, point, i) => {
		const [x, y, z] = position(point);
		const [a, b, c] = position(loop[least]);
		return x < a || (x === a && (y < b || (y === b && z < c))) ? i : least;
	}, 0);
}

export function fanTriangles<T extends Point>(ring: readonly T[]) {
	const origin = fanAnchor(ring, ({ position }) => position);
	return Array.from(
		{ length: ring.length - 2 },
		(_, i) =>
			[
				ring[origin],
				ring[(origin + i + 1) % ring.length],
				ring[(origin + i + 2) % ring.length]
			] as const
	);
}

/** The first band is most clamped, so any collapsed internal fan diagonal must occur there. */
export function hasCollapsedDiagonal(bottom: readonly Point[], top: readonly Point[]) {
	if (bottom.length === 3) return false;
	const origin = fanAnchor(bottom, ({ position }) => position);
	if (bottom[origin].id !== top[origin].id) return false;
	for (let i = 2; i < bottom.length - 1; i++) {
		const j = (origin + i) % bottom.length;
		if (bottom[j].id === top[j].id) return true;
	}
	return false;
}

/** Cuts a warped prism along each zero-thickness fan diagonal and drops flat pieces. */
export function prismParts<T extends Point>(bottom: readonly T[], top: readonly T[]) {
	const origin = fanAnchor(bottom, ({ position }) => position);
	const collapsed = (i: number) => bottom[i].id === top[i].id;
	const parts = [];
	let start = 1;
	for (let i = 2; i < bottom.length; i++) {
		const j = (origin + i) % bottom.length;
		if (i < bottom.length - 1 && !(collapsed(origin) && collapsed(j))) continue;
		const indices = [origin];
		for (let k = start; k <= i; k++) indices.push((origin + k) % bottom.length);
		start = i;
		if (indices.every(collapsed)) continue;
		parts.push({ bottom: indices.map((k) => bottom[k]), top: indices.map((k) => top[k]), indices });
	}
	return parts;
}

/** Height in the same triangulation used by the solid's cap. */
export function capHeight(ring: readonly Point[], x: number, y: number) {
	for (const [{ position: a }, { position: b }, { position: c }] of fanTriangles(ring)) {
		const [ux, uy] = [b[0] - a[0], b[1] - a[1]];
		const [vx, vy] = [c[0] - a[0], c[1] - a[1]];
		const [px, py] = [x - a[0], y - a[1]];
		const area = ux * vy - uy * vx;
		if (!area) continue;
		const u = (px * vy - py * vx) / area;
		const v = (ux * py - uy * px) / area;
		const tolerance = cityVolumeConfig.hubWeightTolerance;
		if (u < -tolerance || v < -tolerance || 1 - u - v < -tolerance) continue;
		return a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]);
	}
	return undefined;
}
