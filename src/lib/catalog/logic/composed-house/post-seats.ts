import type { StockPart } from './house-object';

type Post = Extract<StockPart, { kind: 'pipe' }>;
type Plate = Extract<StockPart, { kind: 'prism' }>;
function touchesPlate(p: Post, plate: Plate) {
	const [foot, top] = p.points;
	const z = plate.z + plate.height,
		t = (z - foot[2]) / (top[2] - foot[2]);
	if (z < foot[2] - p.radius || t > 1) return false;
	const x = foot[0] + t * (top[0] - foot[0]),
		y = foot[1] + t * (top[1] - foot[1]);
	let inside = false;
	for (const [i, [a, b]] of plate.polygon.entries()) {
		const [c, d] = plate.polygon[(i + 1) % plate.polygon.length],
			dx = c - a,
			dy = d - b;
		const u = Math.min(1, Math.max(0, ((x - a) * dx + (y - b) * dy) / (dx * dx + dy * dy || 1)));
		if (Math.hypot(x - a - u * dx, y - b - u * dy) <= p.radius) return true;
		if (b > y !== d > y && x < a + ((y - b) * dx) / dy) inside = !inside;
	}
	return inside;
}
/** Finds the tread or landing that the foot of a pitched post penetrates. */
export function postSeats(walk: StockPart[]) {
	const rows = new Map<number, Extract<StockPart, { kind: 'prism' }>[]>();
	for (const p of walk) {
		if (p.kind !== 'prism' || p.id.includes('/stringer')) continue;
		const key = Math.floor((p.z + p.height) * 2);
		const row = rows.get(key) ?? [];
		row.push(p);
		rows.set(key, row);
	}
	return (p: Extract<StockPart, { kind: 'pipe' }>) => {
		const [foot] = p.points;
		for (let k = Math.floor((foot[2] - p.radius) * 2); k <= Math.floor((foot[2] + 0.4) * 2); k++) {
			for (const plate of rows.get(k) ?? []) {
				if (touchesPlate(p, plate)) return true;
			}
		}
		return false;
	};
}
