import type { Vec3 } from '../../core/geometry';

type Crossing = { across: number; water: number };

function span(polygon: readonly Vec3[], x: number) {
	const edges: Crossing[] = [];
	for (let i = 0; i < polygon.length; i++) {
		const [ax, ay, az] = polygon[i];
		const [bx, by, bz] = polygon[(i + 1) % polygon.length];
		if (x < Math.min(ax, bx) - 1e-9 || x > Math.max(ax, bx) + 1e-9) continue;
		const t = ax === bx ? 0 : (x - ax) / (bx - ax);
		edges.push({ across: ay + t * (by - ay), water: az + t * (bz - az) });
	}
	edges.sort((a, b) => a.across - b.across);
	return edges.length < 2 ? null : ([edges[0], edges[edges.length - 1]] as const);
}

export function sectionCuts(polygons: readonly (readonly Vec3[])[], x: number) {
	const spans = [];
	for (const polygon of polygons) {
		const endpoints = span(polygon, x);
		if (endpoints && endpoints[1].across - endpoints[0].across > 1e-5) spans.push(endpoints);
	}
	spans.sort(([a], [b]) => a.across - b.across);
	const merged: [Crossing, Crossing][] = [];
	for (const [a, b] of spans) {
		const last = merged.at(-1);
		if (!last || a.across - last[1].across > 1e-5) merged.push([a, b]);
		else if (b.across > last[1].across) last[1] = b;
	}
	return merged.flatMap(([a, b]) => {
		const span = b.across - a.across;
		const count = Math.max(2, Math.min(12, Math.ceil(span / 35)));
		return Array.from({ length: count + 1 }, (_, i) => ({
			across: a.across + (i * span) / count,
			water: a.water + (i * (b.water - a.water)) / count,
			bank: i === 0 || i === count,
			bankSide: i === 0 ? (-1 as const) : i === count ? (1 as const) : (0 as const)
		}));
	});
}
