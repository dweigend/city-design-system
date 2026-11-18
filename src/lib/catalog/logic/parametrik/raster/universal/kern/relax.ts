import { required } from '../../../../required';
import { area, length, sub } from './geometry';
import { edgeId, type Intent, type Vec } from './types';
type Rings = readonly (readonly string[])[];
function neighborhood(intent: Intent, rings: Rings) {
	const nb = new Map<string, Set<string>>(),
		counts = new Map<string, number>(),
		ends = new Map<string, [string, string]>();
	for (const ring of rings)
		ring.forEach((a, i) => {
			const b = ring[(i + 1) % ring.length],
				key = edgeId(a, b);
			counts.set(key, (counts.get(key) ?? 0) + 1);
			ends.set(key, [a, b]);
			if (!nb.has(a)) nb.set(a, new Set());
			if (!nb.has(b)) nb.set(b, new Set());
			required(nb.get(a), 'nb.get(a)').add(b);
			required(nb.get(b), 'nb.get(b)').add(a);
		});
	const fixed = new Set(intent.fixed);
	for (const [key, n] of counts)
		if (n === 1) required(ends.get(key), 'ends.get(key)').forEach((v) => fixed.add(v));
	return { nb, fixed };
}

function minimumAngle(rings: Rings, ps: ReadonlyMap<string, Vec>) {
	return Math.min(
		...rings.map((ring) => {
			const ps0 = ring.map((v) => required(ps.get(v), 'ps.get(v)'));
			if (area(ps0) <= 0) return -Infinity;
			return Math.min(
				...ps0.map((p, i) => {
					const a = sub(ps0[(i + ps0.length - 1) % ps0.length], p),
						b = sub(ps0[(i + 1) % ps0.length], p);
					const cross = a[0] * b[1] - a[1] * b[0];
					const angle =
						(Math.acos(
							Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (length(a) * length(b))))
						) *
							180) /
						Math.PI;
					return cross > 0 ? 360 - angle : angle;
				})
			);
		})
	);
}

/** Jacobi proposals on source points; exterior and fixed points stay put. */
export function relax(intent: Intent, iterations: number): Intent {
	if (!iterations) return intent;
	const rings = [...intent.faces.values()].flatMap((f) => f.parts ?? [f.ring]);
	const { nb, fixed } = neighborhood(intent, rings);
	const quality = (ps: ReadonlyMap<string, Vec>) => minimumAngle(rings, ps);
	let positions = intent.positions;
	const limit = Math.min(quality(positions), 12);
	for (let pass = 0; pass < Math.min(6, Math.max(0, Math.round(iterations))); pass++)
		for (let step = 0.35; step > 0.001; step /= 2) {
			const proposed = new Map(positions);
			for (const [v, neighbors] of nb) {
				if (fixed.has(v)) continue;
				const a = required(positions.get(v), 'positions.get(v)'),
					ps = [...neighbors].map((w) => required(positions.get(w), 'positions.get(w)'));
				proposed.set(v, [
					a[0] * (1 - step) + (step * ps.reduce((s, p) => s + p[0], 0)) / ps.length,
					a[1] * (1 - step) + (step * ps.reduce((s, p) => s + p[1], 0)) / ps.length
				]);
			}
			if (quality(proposed) >= limit - 1e-8) {
				positions = proposed;
				break;
			}
		}
	return { ...intent, positions };
}
