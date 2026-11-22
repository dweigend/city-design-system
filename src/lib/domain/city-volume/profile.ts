import type { Vec2 } from '../../core/geometry';
import { Random } from '../../core/random';

export type ProfileDatum = Readonly<{
	origin: Vec2;
	bearing: number;
	length: number;
	width: number;
}>;

const edgeFraction = 0.17;

function peak(stream: Random, x: number, y: number, width: number, depth: number, weight: number) {
	const u = x + stream.number({ min: -0.016, max: 0.016 });
	const v = y + stream.number({ min: -0.035, max: 0.035 });
	return {
		position: [u, v] as const,
		sample(x: number, y: number) {
			const t = ((x - u) / width) ** 2 + ((y - v) / depth) ** 2;
			return weight * Math.max(0, 1 - t) ** 3;
		}
	};
}

export function createProfile(
	seed: number,
	{ origin: [ox, oy], bearing, length, width }: ProfileDatum,
	{ height, complexity }: { height: number; complexity: number }
) {
	if (![ox, oy, bearing, length, width].every(Number.isFinite) || length <= 0 || width <= 0)
		throw new RangeError('Expected a finite city datum with positive extents');
	const random = Random.create({ seed }).derive('city-profile');
	const cos = Math.cos(bearing);
	const sin = Math.sin(bearing);
	const main = peak(random.derive('main'), 0.055, -0.08, 0.3 - 0.125 * complexity, 0.39, 1);
	const west = peak(random.derive('west'), -0.34, -0.1, 0.24, 0.48, 0.49 * complexity);
	const east = peak(random.derive('east'), 0.39, -0.11, 0.21, 0.45, 0.48 * complexity);
	const [u, v] = main.position;
	const summit = Object.freeze([
		ox + length * u * cos - width * v * sin,
		oy + length * u * sin + width * v * cos
	] as const);
	return Object.freeze({
		summit,
		height(x: number, y: number) {
			const dx = x - ox;
			const dy = y - oy;
			const u = (dx * cos + dy * sin) / length;
			const v = (dy * cos - dx * sin) / width;
			const relief =
				1 - (1 - main.sample(u, v)) * (1 - west.sample(u, v)) * (1 - east.sample(u, v));
			return height * (edgeFraction + (1 - edgeFraction) * relief);
		}
	});
}
