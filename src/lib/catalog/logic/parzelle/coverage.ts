type XY = [number, number];
export type Footprint = { ring: XY[]; holes: XY[][] };
type Corners = readonly (readonly number[])[];

/** Signed doubled area of the oriented triangle in square metres. */
export function side(a: readonly number[], b: readonly number[], p: readonly number[]) {
	return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}
function area(ring: Corners) {
	return ring.slice(2).reduce((sum, p, i) => sum + side(ring[0], ring[i + 1], p) / 2, 0);
}
function split(ring: XY[], distance: (p: XY) => number) {
	const inside: XY[] = [],
		outside: XY[] = [];
	for (const [i, a] of ring.entries()) {
		const b = ring[(i + 1) % ring.length],
			u = distance(a),
			v = distance(b);
		(u >= 0 ? inside : outside).push(a);
		if (u >= 0 === v >= 0) continue;
		const t = u / (u - v);
		const cut: XY = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
		inside.push(cut);
		outside.push(cut);
	}
	return { inside, outside };
}
function cornerCuts(ring: XY[], corners: Corners, i: number, margin: number, sign: number) {
	const a = corners[i],
		prev = corners[(i + corners.length - 1) % corners.length],
		next = corners[(i + 1) % corners.length];
	const dx = a[0] - prev[0],
		dy = a[1] - prev[1],
		ex = next[0] - a[0],
		ey = next[1] - a[1];
	const beyond = ring.some(([x, y]) => {
		const u = x - a[0],
			v = y - a[1];
		return u * dx + v * dy > 0 && u * ex + v * ey < 0 && u * u + v * v > margin * margin;
	});
	if (!beyond) return [];
	const start = Math.atan2(-sign * dx, sign * dy);
	const angle = Math.atan2(Math.abs(dx * ey - dy * ex), dx * ex + dy * ey);
	const n = Math.ceil(angle / (2 * Math.acos(margin / (margin + 0.001))));
	return Array.from({ length: n - 1 }, (_, j) => {
		const theta = start + (sign * angle * (j + 1)) / n,
			nx = Math.cos(theta),
			ny = Math.sin(theta);
		return (p: XY) => margin - (p[0] - a[0]) * nx - (p[1] - a[1]) * ny;
	});
}

function subtractCell(ring: XY[], corners: Corners, margin: number) {
	const rest: XY[][] = [];
	const sign = Math.sign(area(corners));
	function cut(distance: (p: XY) => number) {
		const { inside, outside } = split(ring, distance);
		if (outside.length >= 3) rest.push(outside);
		ring = inside;
	}
	for (const [i, a] of corners.entries()) {
		const b = corners[(i + 1) % corners.length];
		const offset = margin * Math.hypot(b[0] - a[0], b[1] - a[1]);
		cut((p) => sign * side(a, b, p) + offset);
		if (ring.length < 3) return rest;
	}
	if (margin > 0)
		for (const i of corners.keys()) {
			for (const tangent of cornerCuts(ring, corners, i, margin, sign)) cut(tangent);
			if (ring.length < 3) break;
		}
	return rest;
}
/** Subtracts the union of convex cells dilated by a disk. Edge half-planes are exact.
 * Circumscribed corner tangents limit the radial excess to one millimetre. */
export function plotCovers(
	cells: readonly { corners: Corners }[],
	shape: Footprint,
	margin: number
) {
	function uncovered(ring: XY[]) {
		let pieces = [ring];
		for (const cell of cells) pieces = pieces.flatMap((r) => subtractCell(r, cell.corners, margin));
		return pieces.reduce((total, piece) => total + Math.abs(area(piece)), 0);
	}
	return (
		uncovered(shape.ring) - shape.holes.reduce((sum, hole) => sum + uncovered(hole), 0) <= 1e-6
	);
}
