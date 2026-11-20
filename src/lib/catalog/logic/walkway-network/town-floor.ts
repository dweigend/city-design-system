import { area, clipPolygon, type HalfPlane, type Point2 } from '../ansicht/geometrie';
import { finishMaterial } from '../material/surface';
import type { Primitive } from '../parametrik/types';

/** Plain cast paving for public ground spans and stair platforms. */
export const publicPaving = {
	token: '--paper',
	finish: 'beton-schalung',
	material: finishMaterial('beton-schalung')
} as const;

type Plate = Extract<Primitive, { kind: 'prism' }>;
type Disc = Extract<Primitive, { radius: number; height: number }> & { kind: 'cylinder' };
function plate(p: Plate | Disc): Plate {
	if (p.kind === 'prism') return p;
	const [x, y, z] = p.position;
	const polygon = Array.from({ length: 32 }, (_, i): Point2 => [
		x + p.radius * Math.cos((i * Math.PI) / 16),
		y + p.radius * Math.sin((i * Math.PI) / 16)
	]);
	return {
		kind: 'prism',
		role: p.role,
		id: p.id,
		token: p.token,
		finish: p.finish,
		material: p.material,
		z,
		height: p.height,
		polygon
	};
}
function perimeter(polygon: Point2[]) {
	const sign = Math.sign(
		polygon.reduce((s, [x, y], i) => {
			const q = polygon[(i + 1) % polygon.length];
			return s + x * q[1] - q[0] * y;
		}, 0)
	);
	return polygon.map(([x, y], i): HalfPlane => {
		const [u, v] = polygon[(i + 1) % polygon.length],
			normal: Point2 = [sign * (v - y), sign * (x - u)];
		return { normal, d: normal[0] * x + normal[1] * y };
	});
}
function box(poly: Point2[]) {
	const x = poly.map((p) => p[0]),
		y = poly.map((p) => p[1]);
	return [Math.min(...x), Math.max(...x), Math.min(...y), Math.max(...y)];
}
function subtract(poly: Point2[], edge: HalfPlane[]) {
	let inside = poly;
	for (const h of edge) {
		inside = clipPolygon(inside, h);
		if (inside.length < 3) return [poly];
	}
	if (area(inside) < 1e-9) return [poly];
	let rest = poly;
	const pieces: Point2[][] = [];
	for (const h of edge) {
		const outside = clipPolygon(rest, { normal: [-h.normal[0], -h.normal[1]], d: -h.d });
		if (area(outside) > 1e-9) pieces.push(outside);
		rest = clipPolygon(rest, h);
	}
	return pieces;
}
function isSurface(p: Primitive): p is Plate | Disc {
	return (
		(p.kind === 'prism' || p.kind === 'cylinder') &&
		!p.id.includes('/meeting/') &&
		!p.id.includes('/pier') &&
		!/\/(right|left)\//.test(p.id)
	);
}
type Seat = { bounds: number[]; edge: HalfPlane[] };
function fit(p: Plate, taken: Seat[]) {
	const b = box(p.polygon);
	let pieces = [p.polygon];
	for (const { bounds: q, edge } of taken) {
		if (b[0] >= q[1] || b[1] <= q[0] || b[2] >= q[3] || b[3] <= q[2]) continue;
		pieces = pieces.flatMap((poly) => subtract(poly, edge));
	}
	taken.push({ bounds: b, edge: perimeter(p.polygon) });
	return pieces.map((polygon, i) => ({ ...p, polygon, id: i ? p.id + '/panel/' + i : p.id }));
}
/** Gives each square metre of a level walking plane one owner, including at bends
 * and crowded stair landings. Rails, piers and fittings retain their surveyed positions. */
export function flushDecks(parts: Primitive[]): Primitive[] {
	const levels = new Map<number, Seat[]>();
	return parts.flatMap((p): Primitive[] => {
		if (!isSurface(p)) return [p];
		const floor = plate(p);
		if (area(floor.polygon) < 1e-9) return [];
		const z = Math.round((floor.z + floor.height) * 1e6);
		const taken = levels.get(z) ?? [];
		levels.set(z, taken);
		return fit(floor, taken);
	});
}
