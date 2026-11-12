import { cross, length, mix, sub } from './geometry';
import {
	InvariantError,
	defaultLimits,
	emptyMeaning,
	type Intent,
	type Vec,
	type SourceFace
} from './types';
import { compile } from './model';
export type FieldSource =
	| { kind: 'direction'; point: Vec; angle: number; radius: number; weight: number }
	| { kind: 'contour'; a: Vec; b: Vec; radius: number; weight: number }
	| { kind: 'existing'; a: Vec; b: Vec; radius: number; weight: number }
	| { kind: 'attractor'; point: Vec; radius: number; weight: number }
	| {
			kind: 'singularity';
			point: Vec;
			radius: number;
			weight: number;
			index: number;
			phase: number;
	  };
export type CrossField = {
	angle: number;
	strength: number;
	density: number;
	sources: readonly FieldSource[];
};
export type FieldSample = { angle: number; density: number; coherence: number; singular: boolean };
/** Q05: interpolate exp(4i theta); zeros are explicit, not assigned an arbitrary axis. */
export function sampleField(field: CrossField, p: Vec): FieldSample {
	if (
		![...p, field.angle, field.strength, field.density].every(Number.isFinite) ||
		field.strength < 0 ||
		field.density <= 0
	)
		throw new InvariantError('invalid-field');
	let x = field.strength * Math.cos(4 * field.angle),
		y = field.strength * Math.sin(4 * field.angle),
		total = field.strength,
		density = field.density;
	let atSingularity = false;
	for (const s of field.sources) {
		if (!(s.radius > 0) || !(s.weight >= 0) || ![s.radius, s.weight].every(Number.isFinite))
			throw new InvariantError('invalid-source-field');
		let point: Vec, theta: number;
		if (s.kind === 'contour' || s.kind === 'existing') {
			const d = sub(s.b, s.a),
				l = length(d);
			if (!l) throw new InvariantError('zero-contour');
			const v = sub(p, s.a),
				t = Math.max(0, Math.min(1, (v[0] * d[0] + v[1] * d[1]) / (l * l)));
			point = mix(s.a, s.b, t);
			theta = Math.atan2(d[1], d[0]);
		} else {
			point = s.point;
			const d = sub(p, point),
				r = length(d);
			if (s.kind === 'direction') theta = s.angle;
			else if (s.kind === 'attractor') {
				theta = Math.atan2(d[1], d[0]);
				if (r < 1e-12 && s.weight > 0) atSingularity = true;
			} else {
				if (!Number.isInteger(s.index * 4)) throw new InvariantError('non-quarter-index');
				theta = s.phase + s.index * Math.atan2(d[1], d[0]);
				if (r < 1e-12 && s.weight > 0) atSingularity = true;
			}
		}
		if (![...point, theta].every(Number.isFinite)) throw new InvariantError('non-finite-field');
		const r = length(sub(p, point)) / s.radius,
			w = s.weight * Math.max(0, 1 - r * r) ** 2;
		x += w * Math.cos(4 * theta);
		y += w * Math.sin(4 * theta);
		total += w;
		if (s.kind === 'attractor') density += w;
	}
	const coherence = total ? Math.hypot(x, y) / total : 0;
	return {
		angle: Math.atan2(y, x) / 4,
		density,
		coherence,
		singular: atSingularity || coherence < 1e-8
	};
}
function direction(f: CrossField, p: Vec, previous: Vec): Vec | null {
	const s = sampleField(f, p);
	if (s.singular) return null;
	let best: Vec = [0, 0],
		dot = -Infinity;
	for (let k = 0; k < 4; k++) {
		const a = s.angle + (k * Math.PI) / 2,
			d: Vec = [Math.cos(a), Math.sin(a)],
			v = d[0] * previous[0] + d[1] * previous[1];
		if (v > dot) {
			dot = v;
			best = d;
		}
	}
	return best;
}
export type Streamline = {
	points: Vec[];
	stop: 'boundary' | 'singularity' | 'budget';
	family: 0 | 1;
};
/** Midpoint integration, branch continuation, density-controlled steps; finite work budget. */
export function trace(
	field: CrossField,
	start: Vec,
	family: 0 | 1,
	bounds: { min: Vec; max: Vec },
	step: number,
	budget = 2000
): Streamline {
	if (
		!(step > 0) ||
		!Number.isFinite(step) ||
		!Number.isInteger(budget) ||
		budget < 1 ||
		bounds.min.some((v, i) => !Number.isFinite(v) || v >= bounds.max[i]) ||
		!bounds.max.every(Number.isFinite)
	)
		throw new InvariantError('invalid-trace');
	const points: Vec[] = [start];
	let previous: Vec = family === 0 ? [1, 0] : [0, 1];
	for (let n = 0; n < budget; n++) {
		const p = points.at(-1)!,
			d = direction(field, p, previous);
		if (!d) return { points, stop: 'singularity', family };
		const h = step / Math.sqrt(sampleField(field, p).density),
			mid: Vec = [p[0] + (d[0] * h) / 2, p[1] + (d[1] * h) / 2],
			v = direction(field, mid, d);
		if (!v) return { points, stop: 'singularity', family };
		const q: Vec = [p[0] + h * v[0], p[1] + h * v[1]];
		let t = 1;
		for (let k = 0; k < 2; k++) {
			if (q[k] < bounds.min[k]) t = Math.min(t, (bounds.min[k] - p[k]) / (q[k] - p[k]));
			if (q[k] > bounds.max[k]) t = Math.min(t, (bounds.max[k] - p[k]) / (q[k] - p[k]));
		}
		points.push(mix(p, q, Math.max(0, t)));
		if (t < 1) return { points, stop: 'boundary', family };
		previous = v;
	}
	return { points, stop: 'budget', family };
}
function crossings(a: Streamline, b: Streamline): Vec[] {
	const out: Vec[] = [];
	for (let i = 1; i < a.points.length; i++)
		for (let j = 1; j < b.points.length; j++) {
			if (
				Math.max(a.points[i - 1][0], a.points[i][0]) <
					Math.min(b.points[j - 1][0], b.points[j][0]) ||
				Math.max(b.points[j - 1][0], b.points[j][0]) <
					Math.min(a.points[i - 1][0], a.points[i][0]) ||
				Math.max(a.points[i - 1][1], a.points[i][1]) <
					Math.min(b.points[j - 1][1], b.points[j][1]) ||
				Math.max(b.points[j - 1][1], b.points[j][1]) < Math.min(a.points[i - 1][1], a.points[i][1])
			)
				continue;
			const p = a.points[i - 1],
				q = b.points[j - 1],
				u = sub(a.points[i], p),
				v = sub(b.points[j], q),
				den = cross(u, v);
			if (Math.abs(den) < 1e-12) continue;
			const w = sub(q, p),
				t = cross(w, v) / den,
				s = cross(w, u) / den;
			if (t >= 0 && t <= 1 && s >= 0 && s <= 1) {
				const c = mix(p, a.points[i], t);
				if (!out.some((o) => length(sub(o, c)) < 1e-8)) out.push(c);
			}
		}
	return out;
}
/** Restricted chart: each primary/secondary line pair must cross exactly once.
 * Singularities, recirculation and incomplete charts reject instead of inventing connections.
 */
export type FieldChart = {
	positions: Map<string, Vec>;
	faces: Map<string, SourceFace>;
	lines: [Streamline[], Streamline[]];
};
export function fieldChart(
	field: CrossField,
	bounds: { min: Vec; max: Vec },
	count = 6,
	step = Math.min(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1]) / 100
): FieldChart {
	if (!Number.isInteger(count) || count < 2 || count > 100)
		throw new InvariantError('invalid-line-count');
	const lines: [Streamline[], Streamline[]] = [[], []];
	for (const family of [0, 1] as const)
		for (let i = 0; i < count; i++) {
			const target = (i + 1) / (count + 1);
			const weights = Array.from({ length: 100 }, (_, k) => {
				const t = (k + 0.5) / 100;
				const p: Vec =
					family === 0
						? [bounds.min[0], bounds.min[1] + t * (bounds.max[1] - bounds.min[1])]
						: [bounds.min[0] + t * (bounds.max[0] - bounds.min[0]), bounds.min[1]];
				return Math.sqrt(sampleField(field, p).density);
			});
			const total = weights.reduce((a, b) => a + b, 0);
			let cumulative = 0,
				seedFraction = target;
			for (let k = 0; k < weights.length; k++) {
				if (cumulative + weights[k] >= target * total) {
					seedFraction = (k + (target * total - cumulative) / weights[k]) / 100;
					break;
				}
				cumulative += weights[k];
			}
			const t = seedFraction,
				start: Vec =
					family === 0
						? [bounds.min[0], bounds.min[1] + t * (bounds.max[1] - bounds.min[1])]
						: [bounds.min[0] + t * (bounds.max[0] - bounds.min[0]), bounds.min[1]];
			const line = trace(field, start, family, bounds, step);
			if (line.stop !== 'boundary') throw new InvariantError(`chart-${line.stop}`);
			lines[family].push(line);
		}
	const positions = new Map<string, Vec>(),
		faces = new Map<string, SourceFace>();
	for (let i = 0; i < count; i++)
		for (let j = 0; j < count; j++) {
			const ps = crossings(lines[0][i], lines[1][j]);
			if (ps.length !== 1) throw new InvariantError('chart-intersection-count', [`${i}:${j}`]);
			positions.set(`cross:${i}:${j}`, ps[0]);
		}
	for (let i = 0; i < count - 1; i++)
		for (let j = 0; j < count - 1; j++) {
			const id = `field:${i}:${j}`;
			faces.set(id, {
				id,
				level: 0,
				ring: [
					`cross:${i}:${j}`,
					`cross:${i}:${j + 1}`,
					`cross:${i + 1}:${j + 1}`,
					`cross:${i + 1}:${j}`
				]
			});
		}
	return { positions, faces, lines };
}
export function fieldGrid(field: CrossField, bounds: { min: Vec; max: Vec }, count = 6, seed = 42) {
	const { positions, faces, lines } = fieldChart(field, bounds, count);

	const intent: Intent = {
		version: 1,
		seed,
		positions,
		faces,
		semantics: new Map([...faces.keys()].map((id) => [id, emptyMeaning()])),
		fixed: new Set(),
		limits: defaultLimits
	};
	return {
		model: compile(intent),
		field,
		alleys: lines
			.flat()
			.map((line, i) => ({ id: `alley:${i}`, level: 0, width: 1.5, points: line.points }))
	};
}
