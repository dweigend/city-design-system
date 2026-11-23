import type { Vec2 } from '../../core/geometry';
import { Random } from '../../core/random';

const turn = 2 * Math.PI;
const span = (random: Random, min: number, max: number) => random.number({ min, max });

function roughness(random: Random, wavelength: number) {
	const lattice = new Map<string, number>();
	function at(x: number, y: number) {
		const key = `${x},${y}`;
		const cached = lattice.get(key);
		if (cached !== undefined) return cached;
		const value = span(random.derive(key), -1, 1);
		lattice.set(key, value);
		return value;
	}
	const smooth = (t: number) => t * t * (3 - 2 * t);
	const mix = (a: number, b: number, t: number) => a + (b - a) * t;
	return ([x, y]: Vec2) => {
		const u = x / wavelength;
		const v = y / wavelength;
		const i = Math.floor(u);
		const j = Math.floor(v);
		const s = smooth(u - i);
		const t = smooth(v - j);
		return mix(mix(at(i, j), at(i + 1, j), s), mix(at(i, j + 1), at(i + 1, j + 1), s), t);
	};
}

function corridors(random: Random, bearing: number) {
	const count = Math.floor(span(random, 3, 7));
	const phase = span(random, -Math.PI, Math.PI);
	return Array.from({ length: count }, (_, index) => {
		const arm = random.derive(String(index));
		const heading =
			index < 2
				? bearing + index * Math.PI + span(arm, -0.34, 0.34)
				: phase + (index * turn) / (count - 2) + span(arm, -0.35, 0.35);
		return {
			x: Math.cos(heading),
			y: Math.sin(heading),
			speed: span(arm, 1.1, 2.85),
			reach: span(arm, 450, 1850),
			entry: span(arm, 40, 280)
		};
	});
}

/** Ranks world points by access from a seeded center and finite corridors. Ground supplies
 * a unitless grade and meters of dry clearance from water, independent of the water shape. */
export function cityAccessibility(seed: number, origin: Vec2, bearing: number) {
	const random = Random.create({ seed }).derive('accessibility');
	const arms = corridors(random.derive('corridors'), bearing);
	const shape = random.derive('shape');
	const spread = span(shape, 0.8, 1.38);
	const edge = roughness(random.derive('edge'), 210);
	const lobes = roughness(random.derive('lobes'), 570);
	return (point: Vec2, grade: number, dryClearance: number) => {
		const x = point[0] - origin[0];
		const y = point[1] - origin[1];
		const radial = Math.hypot(x, y);
		let travel = radial * spread;
		for (const arm of arms) {
			const advance = Math.max(0, Math.min(arm.reach, x * arm.x + y * arm.y));
			const lateral = Math.hypot(x - advance * arm.x, y - advance * arm.y);
			travel = Math.min(travel, arm.entry + advance / arm.speed + lateral * 1.55);
		}
		const shelter = 65 * Math.exp(-Math.max(0, dryClearance) / 55);
		const raggedness = Math.min(1, radial / 320) * (82 * edge(point) + 175 * lobes(point));
		return travel + 1100 * grade + shelter + raggedness;
	};
}
