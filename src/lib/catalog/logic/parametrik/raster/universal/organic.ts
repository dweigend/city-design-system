import type { Point2 } from '../../vocab';
import { random } from '../../random';
import { cell, clip, grid } from '../geometry';
import type { UniversalGrid } from './types';
/** Seeded density field, bounded curved flow and a scalloped outer contour. */
export function organicGrid(params: Record<string, number> = {}, seed = 42): UniversalGrid {
	const rng = random(seed),
		n = Math.max(8, Math.min(200, Math.round(params.sites ?? 32))),
		size = Math.max(2, params.size ?? 10);
	const radius = Math.sqrt(n) * size * 0.6,
		phase = rng() * Math.PI * 2,
		density = Math.max(0, Math.min(1, params.density ?? 0.7));
	const sites: Point2[] = [];
	while (sites.length < n) {
		const p: Point2 = [(rng() * 2 - 1) * radius, (rng() * 2 - 1) * radius];
		const r = Math.hypot(...p) / radius;
		if (r < 1 && rng() < 1 - density * 0.8 * r) sites.push(p);
	}
	const boundary: Point2[] = Array.from({ length: 24 }, (_, i) => {
		const a = (i * Math.PI) / 12;
		return [Math.cos(a) * radius, Math.sin(a) * radius];
	});
	const warp = (p: Point2): Point2 => {
		const r = Math.hypot(...p) / radius,
			a = Math.atan2(p[1], p[0]);
		const scale = 1 + 0.06 * r * r * Math.sin(3 * a + phase);
		return [
			p[0] * scale + 0.05 * radius * Math.sin((p[1] / radius) * 2 + phase),
			p[1] * scale + 0.04 * radius * Math.sin((p[0] / radius) * 2 - phase)
		];
	};
	const cells = sites.map((a, i) => {
		let polygon = boundary;
		sites.forEach((b, j) => {
			if (i !== j)
				polygon = clip(
					polygon,
					[b[0] - a[0], b[1] - a[1]],
					(b[0] ** 2 + b[1] ** 2 - a[0] ** 2 - a[1] ** 2) / 2
				);
		});
		const c = cell(polygon.map(warp), `organic:${i}`);
		c.fields = { dichte: 1 - (density * 0.8 * Math.hypot(...a)) / radius };
		return c;
	});
	return { ...grid('voronoi', cells), kind: 'organic' };
}
