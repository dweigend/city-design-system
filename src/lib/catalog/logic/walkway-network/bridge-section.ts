import { chainage, pathPoint, profileSolid } from '../linear-path';
import { interpolatePoint, type Vec3 } from '../parametrik/types';
import { needsTreads, walkingProfile } from './walking-profile';
import type { Band } from './town-path';
import { treadCount } from '../walkway';

const webDepth = 0.42;
type Slice = { right: Vec3; left: Vec3 };
type Ground = (x: number, y: number) => number;
function samples(edge: Vec3[], fractions: number[]) {
	const distances = chainage(edge);
	return fractions.map((t) => pathPoint(edge, distances, t * distances[distances.length - 1]));
}
function profile({ right, left }: Slice, top: number, bottom: number) {
	const at = (share: number, z: number): Vec3 => {
		const [x, y] = interpolatePoint(right, left, share);
		return [x, y, z];
	};
	return [at(0.2, bottom), at(0.8, bottom), at(0.94, top), at(0.06, top)];
}
function pierRing(slice: Slice, along: number, width: number, z: number): Vec3[] {
	const c = interpolatePoint(slice.right, slice.left, 0.5),
		dx = slice.left[0] - slice.right[0],
		dy = slice.left[1] - slice.right[1],
		length = Math.hypot(dx, dy);
	return [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([u, v]) => [
		c[0] + (dx * width * u - dy * along * v) / length,
		c[1] + (dy * width * u + dx * along * v) / length,
		z
	]);
}
function pier(slice: Slice, ground: Ground, bottom: (p: Vec3) => number, id: string) {
	const base = pierRing(slice, 0.46, 0.49, 0).map(([x, y]): Vec3 => [x, y, ground(x, y) - 0.04]);
	const soffit = bottom(interpolatePoint(slice.right, slice.left, 0.5)),
		shoulder = soffit - 0.32;
	if (!base.every((p) => p[2] < shoulder)) return [];
	const solid = profileSolid([
		base,
		pierRing(slice, 0.29, 0.34, shoulder),
		pierRing(slice, 0.33, 0.72, soffit).map((p): Vec3 => [p[0], p[1], bottom(p)])
	]);
	return [{ id, slot: 'bearing' as const, ...solid }];
}
// Adjacent tread seats share the two soffit vertices at each riser.
function girderSolid(rings: Vec3[][], stepped: boolean) {
	const mesh = profileSolid(rings);
	if (!stepped) return mesh;
	const triangles: number[] = [];
	const shared = (index: number) => {
		const ring = Math.floor(index / 4);
		return ring > 0 && ring % 2 === 0 && index % 4 < 2 ? index - 4 : index;
	};
	for (let i = 0; i < mesh.triangles.length; i += 3) {
		const [a, b, c] = mesh.triangles.slice(i, i + 3).map(shared);
		if (a !== b && b !== c && c !== a) triangles.push(a, b, c);
	}
	return { ...mesh, triangles };
}
/** Sweeps a folded box girder and flared blade piers beneath the surveyed walking section.
 * Girder crowns meet tread soffits; pier soles sample finished terrain at all four corners.
 * Geometry identifies surface slots. All coordinates and dimensions are in metres. */
export function bridgeSection(band: Band, ground: Ground) {
	const { a, b, id } = band.span,
		stepped = needsTreads(a, b);
	const slopes = (edge: Vec3[]) => {
		const ds = chainage(edge);
		return ds.map((d) => d / ds[ds.length - 1]);
	};
	const steps = treadCount(b[2] - a[2], walkingProfile.treadRise);
	const fractions = stepped
		? Array.from({ length: steps + 1 }, (_, i) => i / steps)
		: [...new Set([...slopes(band.left), ...slopes(band.right)])].sort((a, b) => a - b);
	const count = fractions.length - 1;
	const left = samples(band.left, fractions),
		right = samples(band.right, fractions);
	const depth = walkingProfile.thickness + webDepth;
	const soffit = (t: number) => a[2] + (b[2] - a[2]) * t - depth;
	const rings: Vec3[][] = [];
	for (let i = 0; i < count; i++) {
		const top = (j: number) =>
			(stepped ? a[2] + ((b[2] - a[2]) * i) / (count - 1) : right[j][2]) - walkingProfile.thickness;
		for (const j of [i, i + 1])
			if (stepped || !rings.length || j > i)
				rings.push(profile({ right: right[j], left: left[j] }, top(j), soffit(fractions[j])));
	}
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
		bays = Math.max(1, Math.ceil(length / 12));
	const stations = Array.from({ length: bays }, (_, i) => (i + 0.5) / bays);
	const ls = samples(band.left, stations),
		rs = samples(band.right, stations);
	const supports = stations.flatMap((t, i) =>
		pier(
			{ left: ls[i], right: rs[i] },
			ground,
			(p) => {
				const c = interpolatePoint(ls[i], rs[i], 0.5);
				return (
					soffit(t) +
					((b[2] - a[2]) * ((p[0] - c[0]) * (b[0] - a[0]) + (p[1] - c[1]) * (b[1] - a[1]))) /
						(length * length)
				);
			},
			id + '/pier/' + i
		)
	);
	return [
		{ id: id + '/girder', slot: 'structure' as const, ...girderSolid(rings, stepped) },
		...supports
	];
}
