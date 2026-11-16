import { InvariantError, type Vec, type Limits, type QuadQuality } from './types';
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
export const length = (a: Vec) => Math.hypot(...a);
export const mix = (a: Vec, b: Vec, t: number): Vec => [
	a[0] + t * (b[0] - a[0]),
	a[1] + t * (b[1] - a[1])
];
export const cross = (a: Vec, b: Vec) => a[0] * b[1] - a[1] * b[0];
export const area = (p: readonly Vec[]) =>
	p.slice(1, -1).reduce((s, v, i) => s + cross(sub(v, p[0]), sub(p[i + 2], p[0])) / 2, 0);
// Exact dyadic fallback for IEEE-754 inputs. Construction remains floating point.
function dyadic(x: number): [bigint, number] {
	const buffer = new DataView(new ArrayBuffer(8));
	buffer.setFloat64(0, x);
	const bits = buffer.getBigUint64(0),
		e = Number((bits >> 52n) & 2047n);
	const m = (bits & ((1n << 52n) - 1n)) | (e ? 1n << 52n : 0n);
	return [bits >> 63n ? -m : m, e ? e - 1075 : -1074];
}
export function orient(a: Vec, b: Vec, c: Vec): number {
	const u = sub(b, a),
		v = sub(c, a),
		d = cross(u, v);
	if (Math.abs(d) > 8 * Number.EPSILON * (Math.abs(u[0] * v[1]) + Math.abs(u[1] * v[0])))
		return Math.sign(d);
	const ds = [...a, ...b, ...c].map(dyadic),
		e = Math.min(...ds.map((d) => d[1]));
	const [ax, ay, bx, by, cx, cy] = ds.map(([m, k]) => m << BigInt(k - e));
	const exact = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
	return exact > 0n ? 1 : exact < 0n ? -1 : 0;
}
export function onSegment(p: Vec, a: Vec, b: Vec) {
	return (
		orient(a, b, p) === 0 &&
		p[0] >= Math.min(a[0], b[0]) &&
		p[0] <= Math.max(a[0], b[0]) &&
		p[1] >= Math.min(a[1], b[1]) &&
		p[1] <= Math.max(a[1], b[1])
	);
}
export function intersects(a: Vec, b: Vec, c: Vec, d: Vec) {
	return (
		(orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) ||
		onSegment(a, c, d) ||
		onSegment(b, c, d) ||
		onSegment(c, a, b) ||
		onSegment(d, a, b)
	);
}
export function inside(p: Vec, ring: readonly Vec[]): boolean {
	let hit = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const a = ring[j],
			b = ring[i];
		if (onSegment(p, a, b)) return false;
		if (
			a[1] > p[1] !== b[1] > p[1] &&
			p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
		)
			hit = !hit;
	}
	return hit;
}
export function validateRing(p: readonly Vec[]) {
	if (p.length < 3 || p.some((v) => v.length !== 2 || !v.every(Number.isFinite)))
		throw new InvariantError('invalid-ring');
	for (let i = 0; i < p.length; i++) {
		if (length(sub(p[i], p[(i + 1) % p.length])) === 0) throw new InvariantError('zero-edge');
		for (let j = i + 1; j < p.length; j++)
			if (
				j !== i + 1 &&
				!(i === 0 && j === p.length - 1) &&
				intersects(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length])
			)
				throw new InvariantError('self-intersection');
	}
	if (!(area(p) > 0)) throw new InvariantError('non-positive-area');
}
export function quadQuality(p: readonly Vec[]): QuadQuality {
	if (p.length !== 4) throw new InvariantError('not-quad');
	let minAngle = 180,
		minJacobian = 1;
	const edges = p.map((v, i) => length(sub(p[(i + 1) % 4], v)));
	for (let i = 0; i < 4; i++) {
		const u = sub(p[(i + 1) % 4], p[i]),
			v = sub(p[(i + 3) % 4], p[i]),
			den = length(u) * length(v);
		const j = den ? cross(u, v) / den : -1;
		minJacobian = Math.min(minJacobian, j);
		const angle =
			orient(p[i], p[(i + 1) % 4], p[(i + 3) % 4]) > 0
				? (Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / den))) * 180) / Math.PI
				: 0;
		minAngle = Math.min(minAngle, angle);
	}
	return { minAngle, minJacobian, area: area(p), aspect: Math.max(...edges) / Math.min(...edges) };
}
export function acceptable(q: QuadQuality, l: Limits) {
	return (
		Object.values(q).every(Number.isFinite) &&
		q.minJacobian > 0 &&
		q.minJacobian >= l.minJacobian &&
		q.minAngle >= l.minAngle &&
		q.area >= l.minArea &&
		q.aspect <= l.maxAspect
	);
}
/** Deterministic ear clipping. Collinear boundary vertices are retained. */
export function triangulate(
	ids: readonly string[],
	positions: ReadonlyMap<string, Vec>
): string[][] {
	const ring = [...ids],
		result: string[][] = [];
	while (ring.length > 3) {
		let found = false;
		for (let i = 0; i < ring.length; i++) {
			const tri = [ring[(i + ring.length - 1) % ring.length], ring[i], ring[(i + 1) % ring.length]],
				[a, b, c] = tri.map((id) => positions.get(id)!);
			if (orient(a, b, c) <= 0) continue;
			if (
				ring.some(
					(id) =>
						!tri.includes(id) &&
						[
							orient(a, b, positions.get(id)!),
							orient(b, c, positions.get(id)!),
							orient(c, a, positions.get(id)!)
						].every((x) => x >= 0)
				)
			)
				continue;
			result.push(tri);
			ring.splice(i, 1);
			found = true;
			break;
		}
		if (!found) throw new InvariantError('triangulation-failed', ids);
	}
	result.push(ring);
	return result;
}
