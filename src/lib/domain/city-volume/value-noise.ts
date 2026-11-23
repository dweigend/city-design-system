import type { Random } from '../../core/random';

function fade(t: number) {
	return t * t * (3 - 2 * t);
}

/** Seeded value noise in [-1, 1] on a fixed world lattice, so the value at a point never
 * depends on the extent of the plan. */
export function valueNoise(random: Random, noiseWavelength: number) {
	const values = new Map<string, number>();
	const at = (i: number, j: number) => {
		const key = `${i},${j}`;
		let value = values.get(key);
		if (value === undefined) {
			value = random.derive(key).number({ min: -1, max: 1 });
			values.set(key, value);
		}
		return value;
	};
	return (x: number, y: number) => {
		const u = x / noiseWavelength;
		const v = y / noiseWavelength;
		const i = Math.floor(u);
		const j = Math.floor(v);
		const s = fade(u - i);
		const t = fade(v - j);
		const bottom = at(i, j) + s * (at(i + 1, j) - at(i, j));
		const top = at(i, j + 1) + s * (at(i + 1, j + 1) - at(i, j + 1));
		return bottom + t * (top - bottom);
	};
}
